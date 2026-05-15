import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Button from '../components/Button';

export default function CreatePage() {
  const [projectName, setProjectName] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [framework, setFramework] = useState('Spring');
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = localStorage.getItem('userEmail');

    if (!email) {
      alert('로그인이 필요한 서비스입니다.');
      navigate('/login');
      return;
    }

    const payload = {
      email,
      projectName,
      githubUrl,
      framework
    };

    // [테스트 모드] 백엔드 연동 전이라면 아래의 try 구문을 지우고 이걸 사용하세요.
    // console.log('Mock Create Project:', payload);
    // alert(`프로젝트 [${projectName}] 배포 요청이 정상적으로 처리되었습니다!\n(테스트 모드)`);
    // navigate('/mypage'); 
    // return;

    try {
      const response = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert('프로젝트 배포 요청이 완료되었습니다!');
        // 배포 후 내 프로젝트 목록을 볼 수 있는 마이페이지로 이동
        navigate('/mypage');
      } else {
        alert('배포 요청에 실패했습니다.');
      }
    } catch (error) {
      console.error('Project creation failed:', error);
      // 서버 에러 시 테스트를 위해 마이페이지로 이동하도록 할 수도 있지만 여기선 alert만 띄움
      alert('서버와의 통신에 실패했습니다.');
    }
  };

  return (
    <>
      <Header />
      <main className="create-page-container">
        <div className="create-form-wrapper">
          <h2>새 프로젝트 배포</h2>
          <p>Github 저장소를 연결하고 서버 배포를 간편하게 시작하세요.</p>
          
          <form onSubmit={handleSubmit} className="project-form">
            <div className="form-group">
              <label>Project Name <span style={{color: '#ff6b6b'}}>*</span></label>
              <input 
                type="text" 
                placeholder="예: my-first-spring"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Github URL <span style={{color: '#ff6b6b'}}>*</span></label>
              <input 
                type="url" 
                placeholder="https://github.com/my/repo"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Project Type (Framework) <span style={{color: '#ff6b6b'}}>*</span></label>
              <select 
                value={framework} 
                onChange={(e) => setFramework(e.target.value)}
                className="framework-select"
              >
                <option value="Spring">Spring</option>
                <option value="Django">Django</option>
                <option value="node js">Node.js</option>
                <option value="react">React</option>
                <option value="Flask">Flask</option>
              </select>
            </div>
            
            <Button type="submit" style={{marginTop: '10px', width: '100%', justifyContent: 'center'}}>
              배포하기
            </Button>
          </form>
        </div>
      </main>
    </>
  );
}
