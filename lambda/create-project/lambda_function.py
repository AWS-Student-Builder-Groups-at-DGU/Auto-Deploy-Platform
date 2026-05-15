import json
import os
import uuid
from datetime import datetime, timezone

import boto3

PROJECTS_TABLE = os.environ.get("PROJECTS_TABLE", "Projects")
CODEBUILD_PROJECT = os.environ.get("CODEBUILD_PROJECT", "autodeploy-build")
AWS_REGION = os.environ.get("AWS_REGION", "ap-northeast-2")
AWS_ACCOUNT_ID = os.environ["AWS_ACCOUNT_ID"]
ECR_REPO_NAME = os.environ.get("ECR_REPO_NAME", "autodeploy-images")

dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
projects_table = dynamodb.Table(PROJECTS_TABLE)
codebuild = boto3.client("codebuild", region_name=AWS_REGION)


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body, ensure_ascii=False),
    }


def lambda_handler(event, context):
    try:
        body = json.loads(event.get("body") or "{}")

        user_id = body.get("userId")
        project_name = body.get("projectName")
        github_url = body.get("githubUrl")
        project_type = body.get("projectType")

        if not user_id or not project_name or not github_url or not project_type:
            return response(400, {"message": "userId, projectName, githubUrl, projectType are required"})

        allowed_types = ["spring", "node", "react", "django", "flask"]
        if project_type not in allowed_types:
            return response(400, {"message": f"projectType must be one of: {', '.join(allowed_types)}"})

        project_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        image_tag = f"{project_type}-{project_id}"
        ecr_image_uri = f"{AWS_ACCOUNT_ID}.dkr.ecr.{AWS_REGION}.amazonaws.com/{ECR_REPO_NAME}:{image_tag}"

        projects_table.put_item(
            Item={
                "projectId": project_id,
                "userId": user_id,
                "projectName": project_name,
                "githubUrl": github_url,
                "projectType": project_type,
                "status": "PENDING",
                "createdAt": now,
                "updatedAt": now,
            }
        )

        build_result = codebuild.start_build(
            projectName=CODEBUILD_PROJECT,
            environmentVariablesOverride=[
                {"name": "PROJECT_ID",      "value": project_id,      "type": "PLAINTEXT"},
                {"name": "PROJECT_TYPE",    "value": project_type,    "type": "PLAINTEXT"},
                {"name": "GITHUB_URL",      "value": github_url,      "type": "PLAINTEXT"},
                {"name": "IMAGE_REPO_NAME", "value": ECR_REPO_NAME,   "type": "PLAINTEXT"},
                {"name": "IMAGE_TAG",       "value": image_tag,       "type": "PLAINTEXT"},
                {"name": "ECR_IMAGE_URI",   "value": ecr_image_uri,   "type": "PLAINTEXT"},
                {"name": "AWS_ACCOUNT_ID",  "value": AWS_ACCOUNT_ID,  "type": "PLAINTEXT"},
            ],
        )

        build_id = build_result["build"]["id"]

        projects_table.update_item(
            Key={"projectId": project_id},
            UpdateExpression="SET codeBuildId = :b, ecrImageUri = :e, updatedAt = :u",
            ExpressionAttributeValues={
                ":b": build_id,
                ":e": ecr_image_uri,
                ":u": datetime.now(timezone.utc).isoformat(),
            },
        )

        return response(201, {
            "projectId": project_id,
            "status": "PENDING",
            "codeBuildId": build_id,
        })

    except Exception as e:
        print(f"[ERROR] {e}")
        return response(500, {"message": "Failed to create project", "error": str(e)})
