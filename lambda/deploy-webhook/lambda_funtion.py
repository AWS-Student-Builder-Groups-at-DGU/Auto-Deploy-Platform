"""
Webhook Lambda — 팀원 B 담당
EventBridge → Lambda (CodeBuild 이벤트 / ECS 이벤트 수신)

상태 전이:
  PENDING → BUILDING   (CodeBuild 시작)
  BUILDING → DEPLOYING (CodeBuild 성공 → ECS Express Mode 서비스 생성 트리거)
  DEPLOYING → SUCCESS  (ECS 배포 완료)
  BUILDING → FAILED    (CodeBuild 실패)
  DEPLOYING → FAILED   (ECS 배포 실패)
"""

import json
import os
from datetime import datetime, timezone

import boto3

dynamodb      = boto3.resource("dynamodb", region_name="ap-northeast-2")
proj_tbl      = dynamodb.Table(os.environ.get("PROJECTS_TABLE", "Projects"))
lambda_client = boto3.client("lambda", region_name="ap-northeast-2")
ecs           = boto3.client("ecs",    region_name="ap-northeast-2")


# ── 메인 핸들러 ─────────────────────────────────────────────────────────────
def lambda_handler(event: dict, _context):
    print(f"[WEBHOOK] 수신 이벤트: {json.dumps(event, default=str)}")

    source      = event.get("source", "")
    detail_type = event.get("detail-type", "")
    detail      = event.get("detail", {})

    try:
        if source == "aws.codebuild" and detail_type == "CodeBuild Build State Change":
            handle_codebuild_event(detail)

        elif source == "aws.ecs" and detail_type == "ECS Service Action":
            handle_ecs_event(detail)

        elif source == "aws.ecs" and detail_type == "ECS Task State Change":
            handle_ecs_task_event(detail)

        else:
            print(f"[WEBHOOK] 처리하지 않는 이벤트: source={source}, type={detail_type}")

    except Exception as e:
        print(f"[WEBHOOK ERROR] {e}")
        raise

    return {"statusCode": 200}


# ecs task event 처리 함수 ───────────────────────────────────────────────────

def handle_ecs_task_event(detail: dict):
    group       = detail.get("group", "")
    service_arn = detail.get("serviceArn", "")
    last_status = detail.get("lastStatus", "")

    # group: "service:deploy-{projectId}"
    if not group.startswith("service:deploy-"):
        return
    project_id = group.replace("service:deploy-", "", 1)

    if last_status == "RUNNING":
        service_url = _get_ecs_service_url(f"deploy-{project_id}")
        _update_status(project_id, "SUCCESS", {
            "appRunnerUrl": f"https://{service_url}" if service_url else ""
        })
    elif last_status in ("STOPPED", "DEPROVISIONING"):
        _update_status(project_id, "FAILED", {"errorMessage": f"ECS 태스크 상태: {last_status}"})


# ── CodeBuild 이벤트 처리 ───────────────────────────────────────────────────
def handle_codebuild_event(detail: dict):
    build_status = detail.get("build-status")
    build_id     = detail.get("build-id", "")
    env_vars     = _extract_env_vars(detail)
    project_id   = env_vars.get("PROJECT_ID")
    ecr_image    = env_vars.get("ECR_IMAGE_URI")

    if not project_id:
        print("[WEBHOOK] PROJECT_ID 없음 — 스킵")
        return

    if build_status == "IN_PROGRESS":
        _update_status(project_id, "BUILDING", {"codeBuildId": build_id})

    elif build_status == "SUCCEEDED":
        _update_status(project_id, "DEPLOYING", {"ecrImageUri": ecr_image or ""})
        if ecr_image:
            _deploy_to_ecs_express(project_id, ecr_image)

    elif build_status == "FAILED":
        log_group  = "/aws/codebuild/autodeploy-build"
        log_stream = detail.get("additional-information", {}).get("logs", {}).get("stream-name", "")
        _update_status(project_id, "FAILED", {"errorMessage": "빌드 실패"})
        _invoke_bedrock_summary(project_id, log_group, log_stream, "BUILD")


# ── ECS 이벤트 처리 ─────────────────────────────────────────────────────────
def handle_ecs_task_event(detail: dict):
    group       = detail.get("group", "")
    last_status = detail.get("lastStatus", "")

    if not group.startswith("service:deploy-"):
        return
    project_id = group.replace("service:deploy-", "", 1)

    # DEPLOYING 상태인 프로젝트만 처리
    result = proj_tbl.get_item(Key={"projectId": project_id})
    project = result.get("Item")
    if not project or project.get("status") != "DEPLOYING":
        print(f"[WEBHOOK] {project_id} DEPLOYING 상태 아님 — 스킵")
        return

    if last_status == "RUNNING":
        service_url = _get_ecs_service_url(f"deploy-{project_id}")
        _update_status(project_id, "SUCCESS", {
            "appRunnerUrl": f"https://{service_url}" if service_url else ""
        })
    elif last_status in ("STOPPED", "DEPROVISIONING"):
        _update_status(project_id, "FAILED", {"errorMessage": f"ECS 태스크 상태: {last_status}"})


# ── ECS Express Mode 서비스 생성 ────────────────────────────────────────────
def _deploy_to_ecs_express(project_id: str, ecr_image_uri: str):
    service_name            = f"deploy-{project_id}"
    execution_role_arn      = os.environ.get("ECS_EXECUTION_ROLE_ARN", "")
    infrastructure_role_arn = os.environ.get("ECS_INFRASTRUCTURE_ROLE_ARN", "")

    try:
        # 1. 태스크 정의 먼저 등록
        task_def = ecs.register_task_definition(
            family=service_name,
            networkMode="awsvpc",
            requiresCompatibilities=["FARGATE"],
            executionRoleArn=execution_role_arn,
            taskRoleArn=execution_role_arn,
            cpu="1024",
            memory="2048",
            containerDefinitions=[{
                "name":  "app",
                "image": ecr_image_uri,
                "portMappings": [{"containerPort": 8080, "protocol": "tcp"}],
                "logConfiguration": {
                    "logDriver": "awslogs",
                    "options": {
                        "awslogs-group":         f"/ecs/{service_name}",
                        "awslogs-region":        "ap-northeast-2",
                        "awslogs-stream-prefix": "ecs",
                        "awslogs-create-group":  "true",
                    }
                }
            }]
        )
        task_def_arn = task_def["taskDefinition"]["taskDefinitionArn"]
        print(f"[ECS] 태스크 정의 등록: {task_def_arn}")

        # 2. Express Mode 서비스 생성
        ecs.create_express_gateway_service(
            serviceName=service_name,
            executionRoleArn=execution_role_arn,
            infrastructureRoleArn=infrastructure_role_arn,
            taskRoleArn=execution_role_arn,
            primaryContainer={
                "image":         ecr_image_uri,
                "containerPort": 8080,
            },
            cpu="1024",
            memory="2048",
            tags=[{"key": "projectId", "value": project_id}],
        )
        print(f"[ECS] Express Mode 서비스 생성: {service_name}")
        _update_status(project_id, "DEPLOYING", {"ecsServiceName": service_name})

    except Exception as e:
        print(f"[ECS ERROR] {e}")
        _update_status(project_id, "FAILED", {"errorMessage": str(e)})


def _get_ecs_service_url(service_name: str) -> str:
    try:
        print(f"[ECS URL DEBUG] 조회할 서비스 이름: {service_name}")
        res  = ecs.describe_services(
            cluster="default",
            services=[service_name]
        )
        svcs = res.get("services", [])
        if not svcs:
            return ""

        svc = svcs[0]
        print(f"[ECS URL DEBUG] 조회된 서비스 ARN: {svc['serviceArn']}")

        # 현재 활성 배포의 serviceRevisionArn 가져오기
        current_revision_arn = ""
        for deployment in svc.get("deployments", []):
            if deployment.get("status") == "PRIMARY":
                current_revision_arn = deployment.get("id", "")
                break

        express_res = ecs.describe_express_gateway_service(
            serviceArn=svc["serviceArn"]
        )
        configs = express_res.get("service", {}).get("activeConfigurations", [])
        
        for config in configs:
            # 현재 배포의 serviceRevisionArn과 매칭
            revision_arn = config.get("serviceRevisionArn", "")
            if current_revision_arn and current_revision_arn in revision_arn:
                ingress_paths = config.get("ingressPaths", [])
                if ingress_paths:
                    endpoint = ingress_paths[0].get("endpoint", "")
                    print(f"[ECS URL DEBUG] endpoint: {endpoint}")
                    return endpoint

        # 매칭 안 되면 마지막 config 사용
        if configs:
            ingress_paths = configs[-1].get("ingressPaths", [])
            if ingress_paths:
                endpoint = ingress_paths[0].get("endpoint", "")
                return endpoint
        
        return ""
    except Exception as e:
        print(f"[ECS URL ERROR] {e}")
        return ""


# ── DynamoDB 상태 업데이트 ──────────────────────────────────────────────────
def _update_status(project_id: str, status: str, extra: dict = None):
    now         = datetime.now(timezone.utc).isoformat()
    update_expr = "SET #s = :s, updatedAt = :u"
    expr_names  = {"#s": "status"}
    expr_values = {":s": status, ":u": now}

    if extra:
        for k, v in extra.items():
            if v:
                update_expr += f", {k} = :{k}"
                expr_values[f":{k}"] = v

    proj_tbl.update_item(
        Key={"projectId": project_id},
        UpdateExpression=update_expr,
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_values,
    )
    print(f"[STATUS] {project_id} → {status}")


# ── C팀 Bedrock Lambda 비동기 호출 ─────────────────────────────────────────
def _invoke_bedrock_summary(project_id: str, log_group: str, log_stream: str, fail_type: str):
    fn_name = os.environ.get("BEDROCK_LAMBDA", "bedrock-summary-lambda")
    try:
        lambda_client.invoke(
            FunctionName=fn_name,
            InvocationType="Event",
            Payload=json.dumps({
                "projectId": project_id,
                "logGroup":  log_group,
                "logStream": log_stream,
                "failType":  fail_type,
            }),
        )
        print(f"[BEDROCK] AI 요약 Lambda 호출: {project_id}")
    except Exception as e:
        print(f"[BEDROCK ERROR] {e}")


# ── 유틸 ────────────────────────────────────────────────────────────────────
def _extract_env_vars(detail: dict) -> dict:
    env_vars = {}
    try:
        for ev in detail["additional-information"]["environment"]["environment-variables"]:
            env_vars[ev["name"]] = ev["value"]
    except (KeyError, TypeError):
        pass
    return env_vars


def _get_codebuild_log_url(detail: dict) -> str:
    try:
        return detail["additional-information"]["logs"]["deep-link"]
    except (KeyError, TypeError):
        return ""
