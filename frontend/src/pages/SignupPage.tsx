import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    // [테스트 모드] 백엔드 미구현 상태에서 프론트엔트 테스트를 위한 Mock 로직
    if (email === 'test@acc.com' && password === '123456') {
      localStorage.setItem('userEmail', email);
      alert('테스트 모드: 가입이 완료되었습니다!');
      navigate('/');
      return;
    } else {
      alert('회원가입 실패! 테스트용 계정으로만 가입이 가능합니다.\n(이메일: test@acc.com / 비밀번호: 123456)');
      return;
    }

    /* 실제 API 연동 코드는 주석 처리해 두었습니다. 백엔드가 준비되면 위 if문 그룹을 지우고 아래 주석을 해제하세요.
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // API 문서에 이메일, 비밀번호만 존재하므로 두 항목만 전송
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        // 성공 시 이메일을 브라우저 로컬 스토리지에 저장
        localStorage.setItem('userEmail', email);
        alert('가입이 완료되었습니다!');
        navigate('/');
      } else {
        alert('회원가입에 실패했습니다.');
      }
    } catch (error) {
      console.error('Signup request failed:', error);
      alert('서버와의 통신에 실패했습니다.');
    }
    */
  };

  return (
    <AuthLayout heading="간단하게 회원가입하고" subheading="">
      <h2 className="auth-title">회원가입</h2>
      <p className="auth-subtitle">AutoDeploy와 함께 혁신적인 배포 자동화를 시작하세요.</p>
      
      <form onSubmit={handleSignup} className="auth-form">
        <div className="form-group">
          <label>이름</label>
          <input 
            type="text" 
            placeholder="이름을 입력하세요" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            required 
          />
        </div>
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
            minLength={6}
            required 
          />
          <span className="form-help-text">6자 이상 입력하세요</span>
        </div>
        
        <button type="submit" className="auth-submit-btn">회원가입하기</button>
      </form>
      
      <div className="auth-footer-link">
        이미 계정이 있으신가요? <Link to="/login">로그인</Link>
      </div>
    </AuthLayout>
  );
}
