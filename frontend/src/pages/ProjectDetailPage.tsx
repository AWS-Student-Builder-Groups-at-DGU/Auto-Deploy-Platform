import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { Github, Clock, Globe, ArrowLeft, RefreshCw, Square } from 'lucide-react';

interface LogLine {
  text: string;
  type: 'normal' | 'error' | 'success';
}

// 임의의 목업 데이터 (서버 미구현 상태용)
const MOCK_PROJECT_DATA = {
  projectId: '',
  projectName: 'my-awesome-project',
  framework: 'Spring',
  lastDeploy: '10분 전',
  githubUrl: 'https://github.com/my/repo',
  branch: 'main',
  appRunnerUrl: 'https://test-ab12cd.awsapprunner.com',
  currentStatus: 'FAILED', // SUCCESS, BUILDING, FAILED
  steps: [
    { label: '요청 접수', status: '완료' },
    { label: 'Git Clone', status: '완료' },
    { label: 'Dockerfile 빌드 준비', status: '완료' },
    { label: 'Docker Build', status: '실패' },
    { label: 'ECS 배포 적용', status: '대기' },
  ],
  aiSummary: {
    statusType: 'error', // success, error, info
    title: '빌드 실패 감지',
    description: 'Docker Build 단계에서 프로세스가 종료되었습니다. 로그를 분석해본 결과 npm run build 스크립트 실행 중 필요한 의존성(dependency) 모듈을 찾을 수 없는 문제가 발생한 것으로 추측됩니다.',
    suggestion: '솔루션: package.json 에 정의된 패키지들이 정상적으로 설치되었는지 확인하고, 로컬 환경에서 npm (또는 yarn) build 가 정상 동작하는지 테스트해 보세요.'
  },
  resources: {
    cpu: '82%',
    memory: '1.2 GB',
    disk: '15 GB'
  },
  logs: [
    { text: 'Waiting for deployment dispatch...', type: 'normal' },
    { text: 'Cloning repository https://github.com/my/repo (branch: main)...', type: 'normal' },
    { text: 'Repository cloned successfully.', type: 'normal' },
    { text: 'Step 1/5 : FROM openjdk:17-jdk-slim', type: 'normal' },
    { text: 'Step 2/5 : WORKDIR /app', type: 'normal' },
    { text: 'Step 3/5 : COPY . .', type: 'normal' },
    { text: 'Step 4/5 : RUN ./gradlew build -x test', type: 'normal' },
    { text: 'Downloading dependencies...', type: 'normal' },
    { text: 'ERROR: Could not fetch specific gradle plugin versions.', type: 'error' },
    { text: 'BUILD FAILED in 12s', type: 'error' },
    { text: 'Process exited with code 1.', type: 'error' }
  ] as LogLine[]
};

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<typeof MOCK_PROJECT_DATA | null>(null);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const fetchProjectDetails = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('로그인이 필요합니다.');
        navigate('/login');
        return;
      }

      try {
        const API_URL = import.meta.env.VITE_API_URL || 'https://6322si78va.execute-api.ap-northeast-2.amazonaws.com/default';
        const headers = { 'Authorization': `Bearer ${token}` };

        const [projectRes, metricsRes, logsRes] = await Promise.all([
          fetch(`${API_URL}/projects/${projectId}`, { headers }),
          fetch(`${API_URL}/projects/${projectId}/metrics`, { headers }).catch(() => null),
          fetch(`${API_URL}/projects/${projectId}/logs`, { headers }).catch(() => null)
        ]);

        if (projectRes.ok) {
          const resData = await projectRes.json();
          const p = resData.project;

          // 메트릭 데이터 파싱
          let cpuVal = '-';
          let memoryVal = '-';
          if (metricsRes && metricsRes.ok) {
            const mData = await metricsRes.json().catch(() => ({}));
            if (mData.cpu && mData.cpu.length > 0) {
              cpuVal = `${mData.cpu[mData.cpu.length - 1].value}%`;
            }
            if (mData.memory && mData.memory.length > 0) {
              memoryVal = `${mData.memory[mData.memory.length - 1].value} MB`;
            }
          }

          // 로그 데이터 파싱
          let logsArr: { text: string; type: 'normal' | 'error' | 'success' }[] = [];
          if (logsRes) {
            if (logsRes.ok) {
              const lData = await logsRes.json().catch(() => ({}));
              if (lData.logs && Array.isArray(lData.logs)) {
                logsArr = lData.logs.map((logStr: string) => {
                  const lower = logStr.toLowerCase();
                  let type: 'normal' | 'error' | 'success' = 'normal';
                  if (lower.includes('error') || lower.includes('fail') || lower.includes('exception') || lower.includes('nullpointer')) type = 'error';
                  else if (lower.includes('success')) type = 'success';
                  return { text: logStr, type };
                });
              } else {
                 logsArr = [{ text: '로그 내역이 없습니다.', type: 'normal' }];
              }
            } else if (logsRes.status === 404) {
              const lData = await logsRes.json().catch(() => ({}));
              logsArr = [{ text: lData.message || '로그를 찾을 수 없습니다.', type: 'normal' }];
            } else {
              logsArr = [{ text: '로그를 불러오는 데 실패했습니다.', type: 'error' }];
            }
          } else {
            logsArr = [{ text: '로그 데이터를 가져올 수 없습니다.', type: 'error' }];
          }

          // 상태 기반 스텝 생성
          const generateSteps = (status: string) => {
            const steps = [
              { label: '요청 접수', status: '대기' },
              { label: 'CodeBuild (빌드)', status: '대기' },
              { label: 'ECS 배포', status: '대기' },
              { label: '배포 완료', status: '대기' }
            ];

            if (status === 'PENDING') {
              steps[0].status = '완료';
              steps[1].status = '대기';
            } else if (status === 'BUILDING') {
              steps[0].status = '완료';
              steps[1].status = '진행중';
            } else if (status === 'DEPLOYING') {
              steps[0].status = '완료';
              steps[1].status = '완료';
              steps[2].status = '진행중';
            } else if (status === 'SUCCESS') {
              steps.forEach(s => s.status = '완료');
            } else if (status === 'FAILED') {
              steps[0].status = '완료';
              steps[1].status = '실패';
              steps[2].status = '대기';
              steps[3].status = '대기';
            }
            return steps;
          };

          // AI 요약 객체 매핑
          const getAiSummaryObj = (status: string, aiSummary: string | null, errorMessage: string | null) => {
            if (status === 'FAILED') {
              return {
                statusType: 'error' as const,
                title: '빌드/배포 실패 감지',
                description: aiSummary || '실패 원인을 분석 중이거나 요약 정보가 없습니다.',
                suggestion: errorMessage ? `에러 로그: ${errorMessage}` : ''
              };
            } else if (status === 'SUCCESS') {
              return {
                statusType: 'success' as const,
                title: '성공적으로 배포되었습니다',
                description: aiSummary || '정상 동작 중입니다.',
                suggestion: ''
              };
            }
            return {
              statusType: 'info' as const,
              title: '배포 진행 중',
              description: '현재 배포 파이프라인이 동작 중입니다.',
              suggestion: '잠시 후 다시 확인해주세요.'
            };
          };

          setData({
            projectId: p.projectId,
            projectName: p.projectName,
            framework: p.projectType,
            lastDeploy: p.updatedAt ? new Date(p.updatedAt).toLocaleString() : '-',
            githubUrl: p.githubUrl,
            branch: 'main', // 백엔드에 branch 정보가 없으므로 임의로 main 표시
            appRunnerUrl: p.appRunnerUrl,
            currentStatus: p.status,
            steps: generateSteps(p.status),
            aiSummary: getAiSummaryObj(p.status, p.aiSummary, p.errorMessage),
            resources: {
              cpu: cpuVal,
              memory: memoryVal,
              disk: '-' // 디스크 모니터링은 현재 API에 없으므로 기본값
            },
            logs: logsArr
          });

          // 상태가 진행 중인 경우 5초 뒤 다시 호출하여 폴링 (Polling)
          if (p.status === 'PENDING' || p.status === 'BUILDING' || p.status === 'DEPLOYING') {
            timeoutId = setTimeout(fetchProjectDetails, 5000);
          }

        } else {
          console.error('프로젝트 상세 조회 실패');
          alert('프로젝트를 찾을 수 없거나 권한이 없습니다.');
          navigate('/mypage');
        }
      } catch (error) {
        console.error('서버와의 통신 오류:', error);
      }
    };

    if (projectId) {
      fetchProjectDetails();
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [projectId, navigate]);

  if (!data) {
    return <div style={{paddingTop: '100px', textAlign: 'center'}}>데이터 준비 중...</div>;
  }

  return (
    <>
      <Header />
      <div className="project-detail-container">
        {/* 뒤로 가기 */}
        <div>
          <button 
            onClick={() => navigate('/mypage')} 
            style={{background: 'none', border:'none', cursor:'pointer', display: 'flex', alignItems:'center', gap:'8px', color:'var(--text-secondary)', fontWeight: 600}}
          >
            <ArrowLeft size={18} /> 목록으로 돌아가기
          </button>
        </div>

        {/* 상단 프로젝트 개요 */}
        <div className="panel span-12">
          <div className="info-header-content">
            <div className="info-title">
              <h1>{data.projectName}</h1>
              <div className="info-details">
                <span>프로젝트 타입: <strong>{data.framework}</strong></span>
                <span><Clock size={16}/> 최근 배포 시간: <strong>{data.lastDeploy}</strong></span>
                <span><Github size={16}/> Repo: <strong>{data.branch}</strong></span>
                <span><Globe size={16}/> URL: 
                  {data.appRunnerUrl ? <a href={data.appRunnerUrl} target="_blank" rel="noreferrer" className="url-link" style={{marginLeft: '4px'}}>Open Link</a> : ' 대기중'}
                </span>
              </div>
            </div>
            
            <div className="info-actions">
              <button className="action-btn secondary" title="접속 URL 열기" onClick={() => data.appRunnerUrl && window.open(data.appRunnerUrl)}>
                Open
              </button>
              <button className="action-btn primary" style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                <RefreshCw size={16} /> 재배포
              </button>
              <button className="action-btn danger" style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                <Square size={16} fill="currentColor" /> 중단
              </button>
            </div>
          </div>
        </div>

        <div className="dashboard-grid">
          
          {/* 배포 상태 리스트 */}
          <div className="panel span-4">
            <h2 className="panel-header">배포 상태 플로우</h2>
            <div className="status-list">
              {data.steps.map((step, idx) => (
                <div key={idx} className="status-item">
                  <div className="status-label">
                    <div className={`status-dot ${step.status}`}></div>
                    {step.label}
                  </div>
                  <div className={`status-text ${step.status}`}>
                    {step.status}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI 로그 분석 */}
          <div className="panel span-8">
            <h2 className="panel-header">AI 배포 상태 요약</h2>
            <div className={`ai-summary-content ${data.aiSummary.statusType}`}>
              <h3>✨ {data.aiSummary.title}</h3>
              <p>{data.aiSummary.description}</p>
              <p style={{fontWeight: 700, marginTop: '8px'}}>{data.aiSummary.suggestion}</p>
            </div>
          </div>

          {/* 시스템 리소스 */}
          <div className="panel span-4">
            <h2 className="panel-header">리소스 사용량 (ECS)</h2>
            <div className="resource-list">
              <div className="resource-item">
                <span className="resource-label">CPU 사용량</span>
                <span className="resource-value">{data.resources.cpu}</span>
              </div>
              <div className="resource-item">
                <span className="resource-label">Memory 사용량</span>
                <span className="resource-value">{data.resources.memory}</span>
              </div>
              <div className="resource-item">
                <span className="resource-label">Disk 사용량</span>
                <span className="resource-value">{data.resources.disk}</span>
              </div>
            </div>
          </div>

          {/* 빌드/서버 로그 */}
          <div className="panel span-8" style={{display: 'flex', flexDirection: 'column'}}>
            <div className="panel-header" style={{marginBottom: '16px'}}>
              최근 로그
              <div style={{display:'flex', gap: '10px'}}>
                <button className="action-btn secondary" style={{padding: '6px 12px', fontSize: '0.8rem'}}>라이브 로그 활성화</button>
              </div>
            </div>
            <div className="terminal-container">
              {data.logs.map((log, idx) => (
                <div key={idx} className={`terminal-line ${log.type}`}>
                  {log.text}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
