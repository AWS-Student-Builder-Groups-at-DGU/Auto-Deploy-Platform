"""
API Lambda
API Gateway → Lambda (단일 함수, 라우팅 내부 처리)
"""

import json
import os
import uuid
import hashlib
import hmac
import base64
from datetime import datetime, timezone, timedelta

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

# ── 클라이언트 ──────────────────────────────────────────────────────────────
dynamodb   = boto3.resource("dynamodb", region_name="ap-northeast-2")
users_tbl  = dynamodb.Table(os.environ.get("USERS_TABLE",    "Users"))
proj_tbl   = dynamodb.Table(os.environ.get("PROJECTS_TABLE", "Projects"))
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-in-prod")


# ── JWT (외부 라이브러리 없이 HS256 대충 구현) ─────────────────────────────
def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def jwt_encode(payload: dict) -> str:
    header  = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body    = _b64url(json.dumps(payload).encode())
    sig     = _b64url(
        hmac.new(JWT_SECRET.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest()
    )
    return f"{header}.{body}.{sig}"


def jwt_decode(token: str) -> dict:
    """유효하면 payload 반환, 아니면 ValueError."""
    try:
        header, body, sig = token.split(".")
        expected = _b64url(
            hmac.new(JWT_SECRET.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest()
        )
        if not hmac.compare_digest(sig, expected):
            raise ValueError("signature mismatch")
        payload = json.loads(base64.urlsafe_b64decode(body + "=="))
        if payload.get("exp", 0) < datetime.now(timezone.utc).timestamp():
            raise ValueError("token expired")
        return payload
    except Exception as e:
        raise ValueError(f"invalid token: {e}")


def hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


# ── 응답 헬퍼 ──────────────────────────────────────────────────────────────
def resp(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",  
        },
        "body": json.dumps(body, ensure_ascii=False, default=str),
    }


def get_user_id_from_event(event: dict) -> str:
    """Authorization 헤더에서 userId 추출."""
    headers = event.get("headers") or {}
    auth = headers.get("Authorization") or headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise ValueError("Authorization header missing")
    return jwt_decode(auth[7:])["userId"]


# ── 핸들러 ─────────────────────────────────────────────────────────────────
def lambda_handler(event: dict, _context):
    print(f"[DEBUG] event: {json.dumps(event, default=str)}")
    method = event.get("httpMethod", "")
    path   = event.get("path", "").replace("/default", "", 1)
    
    try:
        # POST /auth/login
        if method == "POST" and path == "/auth/login":
            return handle_login(event)

        # GET /projects
        if method == "GET" and path == "/projects":
            return handle_list_projects(event)

        # GET /projects/{id}
        if method == "GET" and path.startswith("/projects/"):
            project_id = (event.get("pathParameters") or {}).get("id", "")
            return handle_get_project(event, project_id)

        return resp(404, {"message": "Not Found"})

    except ValueError as e:
        return resp(401, {"message": str(e)})
    except Exception as e:
        print(f"[ERROR] {e}")
        return resp(500, {"message": "Internal Server Error"})


# ── /auth/login ─────────────────────────────────────────────────────────────
def handle_login(event: dict) -> dict:
    body     = json.loads(event.get("body") or "{}")
    email    = body.get("email", "").strip().lower()
    password = body.get("password", "")

    if not email or not password:
        return resp(400, {"message": "email, password 필수"})

    pw_hash = hash_password(password)

    # 이메일로 기존 유저 조회
    result = users_tbl.query(
        IndexName="email-index",
        KeyConditionExpression=Key("email").eq(email),
    )
    items = result.get("Items", [])

    if items:
        # 로그인
        user = items[0]
        if user["passwordHash"] != pw_hash:
            return resp(401, {"message": "비밀번호가 틀렸습니다"})
    else:
        # 자동 회원가입
        user = {
            "userId":       str(uuid.uuid4()),
            "email":        email,
            "passwordHash": pw_hash,
            "createdAt":    datetime.now(timezone.utc).isoformat(),
        }
        users_tbl.put_item(Item=user)

    # JWT 발급 (24시간)
    token = jwt_encode({
        "userId": user["userId"],
        "email":  user["email"],
        "exp":    int((datetime.now(timezone.utc) + timedelta(hours=24)).timestamp()),
    })

    return resp(200, {"token": token, "userId": user["userId"], "email": user["email"]})


# ── GET /projects ────────────────────────────────────────────────────────────
def handle_list_projects(event: dict) -> dict:
    user_id = get_user_id_from_event(event)

    result = proj_tbl.query(
        IndexName="userId-createdAt-index",
        KeyConditionExpression=Key("userId").eq(user_id),
        ScanIndexForward=False,   # 최신순
        Limit=50,
    )

    projects = [_sanitize_project(p) for p in result.get("Items", [])]
    return resp(200, {"projects": projects})


# ── GET /projects/{id} ───────────────────────────────────────────────────────
def handle_get_project(event: dict, project_id: str) -> dict:
    user_id = get_user_id_from_event(event)

    result = proj_tbl.get_item(Key={"projectId": project_id})
    project = result.get("Item")

    if not project:
        return resp(404, {"message": "프로젝트를 찾을 수 없습니다"})

    # 본인 소유 확인
    if project["userId"] != user_id:
        return resp(403, {"message": "접근 권한 없음"})

    return resp(200, {"project": _sanitize_project(project)})


# ── 헬퍼 ─────────────────────────────────────────────────────────────────────
def _sanitize_project(p: dict) -> dict:
    """응답에서 내부 필드(ecrImageUri 등)는 제거."""
    return {
        "projectId":    p.get("projectId"),
        "projectName":  p.get("projectName"),
        "githubUrl":    p.get("githubUrl"),
        "projectType":  p.get("projectType"),
        "status":       p.get("status"),
        "appRunnerUrl": p.get("appRunnerUrl"),
        "aiSummary":    p.get("aiSummary"),
        "errorMessage": p.get("errorMessage"),
        "createdAt":    p.get("createdAt"),
        "updatedAt":    p.get("updatedAt"),
    }
