# **🚀 AutoDeploy Platform**

GitHub Repository URL만 입력하면 자동으로 컨테이너를 빌드하고 배포해주는 서버리스 미니 PaaS

접속 링크: https://d2oikwgfftn7km.cloudfront.net/

## **서비스 개요**

### **해결하는 문제**

개발자가 새로운 프로젝트를 외부에 배포하려면 다음과 같은 복잡한 작업들을 직접 해야 합니다.

- **인프라 설정의 복잡성**: EC2 인스턴스 생성, 보안 그룹 설정, 네트워크 구성 등 배포와 무관한 인프라 지식이 요구됨
- **Dockerfile 작성 부담**: 프레임워크별로 다른 컨테이너 빌드 설정을 개발자가 직접 작성해야 함
- **배포 파이프라인 부재**: CI/CD 파이프라인 구축 없이는 코드 변경 시마다 수동으로 빌드, 배포를 반복해야 함
- **운영 모니터링 부재**: 배포 이후 서비스 상태(CPU, Memory), 실행 로그를 한눈에 확인하기 어려움
- **에러 원인 파악의 어려움**: 빌드, 배포 실패 시 방대한 로그를 직접 분석해야 하는 진입 장벽

소규모 팀이나 사이드 프로젝트 개발자는 클라우드 인프라 전문 지식 없이도 **코드에만 집중하면서 빠르게 서비스를 런칭**하고 싶어합니다.

### **솔루션**

AutoDeploy Platform은 GitHub Repository URL과 프레임워크 종류만 입력하면 사용자의 애플리케이션을 자동으로 컨테이너화하고, AWS 기반 배포 파이프라인을 통해 실행 환경까지 구성합니다.

| 문제 | 솔루션 |
| --- | --- |
| 인프라 설정 복잡성 | ECS Express Mode를 활용해 사용자 애플리케이션 실행 환경 자동 구성 |
| Dockerfile 작성 부담 | CodeBuild에서 프레임워크별 Dockerfile 동적 자동 생성 |
| 배포 파이프라인 부재 | CodeBuild → ECR → ECS Express Mode 자동 배포 파이프라인 |
| 운영 모니터링 부재 | CloudWatch Metrics 연동 CPU/Memory 대시보드 |
| 에러 원인 파악 어려움 | Amazon Bedrock이 에러 로그를 한국어로 자동 요약 |

---

## **서비스 시스템 아키텍처**

AutoDeploy Platform 자체는 AWS 관리형/서버리스 서비스를 중심으로 구성됩니다.
사용자가 배포한 애플리케이션은 CodeBuild로 컨테이너 이미지가 생성되고, ECR에 저장된 뒤 ECS Express Mode에서 실행됩니다.

### **전체 아키텍처 다이어그램**
![architecture](architecture.png)
### **핵심 서비스 구성 요소**

| AWS 서비스 | 역할 |
| --- | --- |
| **S3 + CloudFront** | React 프론트엔드 정적 파일 호스팅 및 CDN 배포 |
| **Amazon API Gateway** | 프론트엔드의 로그인, 프로젝트 생성, 프로젝트 조회, 메트릭 조회 요청을 Lambda로 전달 |
| **AWS Lambda** | 핵심 비즈니스 로직 처리 (배포 요청, 상태 조회, AI 호출) |
| **AWS CodeBuild** | GitHub Repository Clone → 프레임워크별 Dockerfile 동적 생성 → Docker 이미지 빌드 |
| **Amazon ECR** | CodeBuild가 생성한 Docker 이미지 저장소 |
| **Amazon ECS Express Mode** | ECR 이미지를 기반으로 사용자의 애플리케이션 컨테이너 실행 |
| **Amazon DynamoDB** | 사용자 정보, 프로젝트 메타데이터, 빌드/배포 상태, ECS 서비스 정보, AI 요약 결과 저장 |
| **Amazon CloudWatch** | CodeBuild 빌드 로그, ECS 실행 로그, ECS CPU/Memory 메트릭 수집 |
| **Amazon Bedrock** | 빌드/배포 실패 로그를 Claude 모델로 분석하여 한국어 요약 생성 |
| **Amazon EventBridge** | CodeBuild 및 ECS 상태 변경 이벤트를 Webhook Lambda로 전달 |


### **주요 워크플로우**

```
[1] 로그인 및 사용자 인증
    사용자 → Frontend → API Gateway → API Lambda
    → 이메일/비밀번호 기반 로그인 또는 자동 회원가입
    → JWT 발급
    → 이후 프로젝트 조회 요청 시 Authorization Bearer 토큰으로 사용자 검증

[2] 배포 요청 생성
    사용자 → (GitHub URL, 프로젝트명, Framework 선택) → Frontend → API Gateway
    → Project Create Lambda
    → DynamoDB에 프로젝트 정보 저장
       status: PENDING
    → CodeBuild 실행 트리거

[3] 자동 빌드
    CodeBuild
    → GitHub Repository Clone
    → 선택된 Framework에 맞는 Dockerfile 동적 생성
      예: spring, node, react, django, flask
    → Docker 이미지 빌드
    → ECR에 이미지 Push

[4] 빌드 상태 처리
    CodeBuild 상태 변경 이벤트 발생
    → EventBridge
    → Webhook Lambda

    IN_PROGRESS:
      → DynamoDB status를 BUILDING으로 변경

    SUCCEEDED:
      → DynamoDB status를 DEPLOYING으로 변경
      → ECR 이미지 URI를 기반으로 ECS Express Mode 서비스 생성

    FAILED:
      → DynamoDB status를 FAILED로 변경
      → Bedrock Summary Lambda 비동기 호출

[5] 사용자 애플리케이션 자동 배포
    Webhook Lambda
    → ECS Express Mode 서비스 생성
    → 서비스 이름 deploy-{projectId} 생성
    → DynamoDB에 ecsServiceName 저장
    → ECS에서 사용자 애플리케이션 컨테이너 실행

[6] ECS 배포 상태 처리
    ECS 상태 변경 이벤트 발생
    → EventBridge
    → Webhook Lambda

    SERVICE_STEADY_STATE 또는 RUNNING:
      → DynamoDB status를 SUCCESS로 변경
      → 배포 URL 저장

    SERVICE_DEPLOYMENT_FAILED / TASKS_STOPPED / STOPPED:
      → DynamoDB status를 FAILED로 변경
      → Bedrock Summary Lambda 비동기 호출

[7] 실패 로그 분석
    빌드 또는 배포 실패 발생
    → Webhook Lambda가 logGroup, logStream, failType을 Bedrock Summary Lambda로 전달
    → Bedrock Summary Lambda가 CloudWatch 로그 조회
    → Bedrock Claude 모델로 실패 원인 분석
    → DynamoDB에 aiSummary 저장

[8] 사용자 확인
    Frontend
    → API Gateway
    → API Lambda로 프로젝트 목록/상세 상태 조회
    → Metrics Lambda로 ECS CPU/Memory 메트릭 조회

    SUCCESS:
      → 배포 URL 제공
      → CPU/Memory 모니터링 차트 표시

    FAILED:
      → AI가 분석한 에러 원인 한국어 텍스트 표시
```


## **기여자**

| 이름 | GitHub | 담당 영역 |
|------|--------|-----------|
| 김민서 | [galllee](https://github.com/galllee) | 빌드 파이프라인 |
| 백지은 | [Jieun13](https://github.com/Jieun13) | 배포 & 상태 관리 |
| 이승현 | [nanami-tomoe](https://github.com/nanami-tomoe) | 모니터링 & AI + 프론트 |


### **역할 분담**
### 👤 김민서 — 빌드 파이프라인
- 배포 요청 API 및 Lambda 로직 구현  
- CodeBuild 기반 Docker 이미지 빌드 자동화  
- ECR 이미지 저장 및 관리  

### 👤 백지은 — 배포 & 상태 관리
- ECS Express Mode 기반 사용자 애플리케이션 자동 배포 구성  
- EventBridge 기반 CodeBuild/ECS 상태 이벤트 처리  
- DynamoDB 상태 관리 및 ECS 서비스 정보 저장  
- Lambda를 통한 빌드/배포 상태 흐름 관리  

### 👤 이승현 — 모니터링 & AI + 프론트
- API Gateway 기반 로그인/프로젝트 조회 API 연동  
- CloudWatch 기반 ECS CPU/Memory 메트릭 조회 기능 구현  
- Bedrock을 활용한 빌드/배포 실패 로그 분석  
- React UI 및 사용자 인터페이스 개발  

### 🤝 공통 작업
- DynamoDB 스키마 설계  
- IAM 권한 구조 설계  
- API 인터페이스 정의  