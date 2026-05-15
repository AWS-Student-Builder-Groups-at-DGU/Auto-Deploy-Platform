import { useEffect, useState } from 'react';
import Header from '../components/Header';
import { useNavigate } from 'react-router-dom';

interface Project {
  projectId: string;
  projectName: string;
  status: string;
  appRunnerUrl: string | null;
  // 명세서 상엔 없는 항목이지만 화면설계서(UI)상 존재하므로 UI 목업용으로 추가
  framework?: string;
  createdAt?: string; 
}

export default function MyPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  // 이메일에서 앞부분만 따서 유저 이름처럼 사용 (ex: user@test.com -> user)
  const userName = localStorage.getItem('userEmail')?.split('@')[0] || '사용자';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    const fetchProjects = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'https://6322si78va.execute-api.ap-northeast-2.amazonaws.com/default';
        const response = await fetch(`${API_URL}/projects`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          // API 응답 형태가 { projects: [...] } 임
          if (data.projects) {
            // UI에 맞게 데이터 매핑
            const mappedProjects = data.projects.map((p: any) => ({
              ...p,
              framework: p.projectType, // UI의 framework는 백엔드의 projectType
              createdAt: p.createdAt ? new Date(p.createdAt).toLocaleString() : '-'
            }));
            setProjects(mappedProjects);
          } else {
            setProjects([]);
          }
        } else {
          console.error('리스트 조회 실패');
        }
      } catch (error) {
        console.error('서버와의 통신 오류:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, [navigate]);

  return (
    <>
      <Header />
      <main className="mypage-container">
        <div className="mypage-dashboard">
          
          <div className="mypage-greeting">
            <h2>안녕하세요, {userName}님</h2>
            <p>현재 활성화 된 서비스는 {projects.filter(p => p.status === 'SUCCESS').length}개입니다.</p>
          </div>

          <div className="table-container">
            <table className="project-table">
              <thead>
                <tr>
                  <th>프로젝트 이름</th>
                  <th>프로젝트 타입</th>
                  <th>배포 상태</th>
                  <th>접속 URL</th>
                  <th>최근 배포 시간</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{textAlign: 'center', padding: '40px'}}>로딩 중...</td>
                  </tr>
                ) : projects.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{textAlign: 'center', padding: '40px'}}>아직 배포된 프로젝트가 없습니다.</td>
                  </tr>
                ) : (
                  projects.map(p => (
                    <tr 
                      key={p.projectId} 
                      onClick={() => navigate(`/project/${p.projectId}`)}
                      style={{cursor: 'pointer'}}
                      title="클릭하여 상세 정보 보기"
                    >
                      <td className="font-semibold text-primary-color">{p.projectName}</td>
                      <td>{p.framework || '-'}</td>
                      <td>
                        <span className={`status-badge ${p.status.toLowerCase()}`}>
                          {p.status}
                        </span>
                      </td>
                      <td>
                        {p.appRunnerUrl ? (
                          <a href={p.appRunnerUrl} target="_blank" rel="noopener noreferrer" className="url-link" onClick={(e) => e.stopPropagation()}>
                            Open
                          </a>
                        ) : (
                          <span className="text-muted">대기 중</span>
                        )}
                      </td>
                      <td>{p.createdAt || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      </main>
    </>
  );
}
