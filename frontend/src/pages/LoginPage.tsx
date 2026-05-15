import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // [테스트 모드] 백엔드 미구현 상태에서 프론트엔트 테스트를 위한 Mock 로직
    // 허용할 임의의 테스트 데이터: 이메일 'test@acc.com', 비밀번호 '123456'
    if (email === 'test@acc.com' && password === '123456') {
      localStorage.setItem('userEmail', email);
      console.log('Mock Login successful');
      navigate('/');
      return;
    } else {
      alert('로그인 실패! 테스트용 계정을 이용해주세요.\n(이메일: test@acc.com / 비밀번호: 123456)');
      return;
    }

    /* 실제 API 연동 코드는 주석 처리해 두었습니다. 백엔드가 준비되면 위 if문 그룹을 지우고 아래 주석을 해제하세요.
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        // 성공 시 프론트는 이메일을 브라우저 로컬 스토리지에 저장
        localStorage.setItem('userEmail', email);
        console.log('Login successful');
        navigate('/');
      } else {
        alert('로그인에 실패했습니다. (회원가입 및 비밀번호를 다시 확인해주세요)');
      }
    } catch (error) {
      console.error('Login request failed:', error);
      alert('서버와의 통신에 실패했습니다.');
    }
    */
  };

  return (
    <AuthLayout heading="지금 바로 로그인하고" subheading="">
      <h2 className="auth-title">로그인</h2>
      <p className="auth-subtitle">AutoDeploy와 함께 혁신적인 배포 자동화를 시작하세요.</p>
      
      <form onSubmit={handleLogin} className="auth-form">
        <div className="form-group">
          <label>E-mail</label>
          <input 
            type="email" 
            placeholder="example@email.com" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input 
            type="password" 
            placeholder="비밀번호를 입력하세요" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
          />
        </div>
        
        <button type="submit" className="auth-submit-btn">로그인하기</button>
      </form>
      
      <div className="auth-footer-link">
        계정이 없으신가요? <Link to="/signup">회원가입</Link>
      </div>
    </AuthLayout>
  );
}
