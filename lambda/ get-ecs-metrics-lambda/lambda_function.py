import json
import boto3
from datetime import datetime, timedelta

cloudwatch = boto3.client('cloudwatch')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('Projects')

DEFAULT_CLUSTER_NAME = "default" 

def lambda_handler(event, context):
    try:
        # 1. API Gateway 경로 파라미터에서 projectId 추출
        project_id = event['pathParameters']['id']
        
        # 2. DynamoDB에서 프로젝트 정보 조회
        response = table.get_item(Key={'projectId': project_id})
        
        if 'Item' not in response:
            return create_response(404, {'error': 'Project not found'})
            
        project = response['Item']
        
        service_name = project.get('ecsServiceName')
        if not service_name:
            service_name = f"service-{project_id}"
            
        # 클러스터 이름 결정 (DB에 필드가 있으면 가져오고, 없으면 고정값 사용)
        cluster_name = project.get('ecsClusterName', DEFAULT_CLUSTER_NAME)
        
        # 3. 메트릭 데이터 조회 호출
        metrics_data = get_ecs_metrics(cluster_name, service_name)
        
        return create_response(200, metrics_data)
            
    except Exception as e:
        return create_response(500, {'error': str(e)})

def get_ecs_metrics(cluster_name, service_name):
    """ECS 서비스의 CPU/메모리 메트릭 조회"""
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(hours=1)
    
    # 헬퍼 함수: 실제 CloudWatch 쿼리 로직
    def fetch_metric(metric_name, query_id):
        return cloudwatch.get_metric_data(
            MetricDataQueries=[{
                'Id': query_id,
                'MetricStat': {
                    'Metric': {
                        'Namespace': 'AWS/ECS',
                        'MetricName': metric_name,
                        'Dimensions': [
                            {'Name': 'ServiceName', 'Value': service_name},
                            {'Name': 'ClusterName', 'Value': cluster_name}
                        ]
                    },
                    'Period': 300,
                    'Stat': 'Average'
                }
            }],
            StartTime=start_time,
            EndTime=end_time
        )

    try:
        cpu_res = fetch_metric('CPUUtilization', 'cpu_util')
        mem_res = fetch_metric('MemoryUtilization', 'mem_util')
        
        return {
            'cpu': format_metrics(cpu_res),
            'memory': format_metrics(mem_res)
        }
    except Exception as e:
        print(f"Error fetching metrics: {str(e)}")
        return {'cpu': [], 'memory': []}

def format_metrics(response):
    """CloudWatch 응답 데이터를 리스트 형태로 변환"""
    data = []
    if response['MetricDataResults']:
        result = response['MetricDataResults'][0]
        for i, timestamp in enumerate(result['Timestamps']):
            data.append({
                'timestamp': timestamp.isoformat(),
                'value': round(result['Values'][i], 2)
            })
    return sorted(data, key=lambda x: x['timestamp'])

def create_response(status_code, body):
    """CORS 처리가 포함된 응답 생성 헬퍼"""
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*', # React 연동을 위해 필수
            'Content-Type': 'application/json'
        },
        'body': json.dumps(body)
    }