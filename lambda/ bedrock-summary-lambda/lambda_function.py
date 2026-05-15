import json
import boto3
import logging
from datetime import datetime, timedelta

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS 클라이언트 초기화
logs_client = boto3.client('logs')
bedrock_client = boto3.client('bedrock-runtime')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('Projects')  

def lambda_handler(event, context):
    try:
        # B팀에서 전달받은 정보 파싱
        project_id = event['projectId']
        log_group = event['logGroup']
        log_stream = event['logStream']
        
        logger.info(f"Processing project {project_id}, log group: {log_group}")
        
        # 1. CloudWatch 로그 추출
        log_events = get_error_logs(log_group, log_stream)
        
        # 2. Bedrock(Claude)로 로그 분석
        summary = analyze_logs_with_bedrock(log_events)
        
        # 3. DynamoDB 업데이트
        update_project_summary(project_id, summary, log_events)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Log analysis completed successfully',
                'projectId': project_id,
                'summary': summary
            })
        }
        
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def get_error_logs(log_group, log_stream):
    """CloudWatch에서 에러 로그 추출"""
    try:
        # 최근 1시간 로그만 가져오기
        end_time = datetime.now()
        start_time = end_time - timedelta(hours=1)
        
        response = logs_client.get_log_events(
            logGroupName=log_group,
            logStreamName=log_stream,
            startTime=int(start_time.timestamp() * 1000),
            endTime=int(end_time.timestamp() * 1000),
            limit=100  # 최대 100개 이벤트
        )
        
        # ERROR, FAILED, Exception 키워드가 포함된 로그만 필터링
        error_logs = []
        for event in response['events']:
            message = event['message']
            if any(keyword in message.upper() for keyword in ['ERROR', 'FAILED', 'EXCEPTION', 'FATAL']):
                error_logs.append(message)
        
        return error_logs[:50]  # 최대 50개 에러 로그만 반환
        
    except Exception as e:
        logger.error(f"Error fetching logs: {str(e)}")
        return []

def analyze_logs_with_bedrock(log_events):
    """Bedrock Claude를 사용한 로그 분석"""
    if not log_events:
        return "로그에서 특별한 에러를 찾을 수 없습니다. 일반적인 빌드/배포 실패일 수 있습니다."
    
    # 로그를 문자열로 결합
    logs_text = "\n".join(log_events)
    
    prompt = f"""
너는 AWS 전문가야. 아래 로그를 보고 왜 빌드나 배포가 실패했는지 원인을 찾아서, 
개발자가 바로 해결할 수 있게 한국어 3줄 요약해줘.

로그:
{logs_text}

응답 형식:
1. 주요 원인: [핵심 문제점]
2. 해결 방법: [구체적인 해결책]
3. 참고사항: [추가 팁이나 주의사항]
"""
    
    try:
        response = bedrock_client.invoke_model(
            modelId='anthropic.claude-3-haiku-20240307-v1:0',
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 500,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            })
        )
        
        result = json.loads(response['body'].read())
        return result['content'][0]['text']
        
    except Exception as e:
        logger.error(f"Error calling Bedrock: {str(e)}")
        return f"로그 분석 중 오류가 발생했습니다: {str(e)}"

def update_project_summary(project_id, summary, log_events):
    """DynamoDB에 AI 요약 업데이트 (백엔드 DTO 필터링을 우회하기 위해 summary에 로그를 합쳐서 저장)"""
    try:
        # 로그를 JSON 문자열로 변환 후 특수 구분자와 함께 summary에 합침
        logs_json = json.dumps(log_events, ensure_ascii=False)
        combined_summary = f"{summary}###LOGS###{logs_json}"
        
        table.update_item(
            Key={'projectId': project_id},
            UpdateExpression='SET aiSummary = :summary, updatedAt = :timestamp',
            ExpressionAttributeValues={
                ':summary': combined_summary,
                ':timestamp': datetime.now().isoformat()
            }
        )
        logger.info(f"Updated project {project_id} with AI summary")
        
    except Exception as e:
        logger.error(f"Error updating DynamoDB: {str(e)}")
        raise
