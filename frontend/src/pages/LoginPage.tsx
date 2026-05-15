import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_URL || 'https://6322si78va.execute-api.ap-northeast-2.amazonaws.com/default';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        // 성공 시 프론트는 토큰과 유저 정보를 브라우저 로컬 스토리지에 저장
        localStorage.setItem('token', data.token);
        localStorage.setItem('userId', data.userId);
        localStorage.setItem('userEmail', data.email);
        console.log('Login successful');
        navigate('/');
      } else {
        const errorData = await response.json().catch(() => null);
        alert(errorData?.message || '로그인에 실패했습니다. (이메일 및 비밀번호를 다시 확인해주세요)');
      }
    } catch (error) {
      console.error('Login request failed:', error);
      alert('서버와의 통신에 실패했습니다.');
    }
  };

  return (
    <AuthLayout heading="지금 바로 로그인하고" subheading="">
      <h2 className="auth-title">로그인</h2>
      <p className="auth-subtitle">AutoShip과 함께 혁신적인 배포 자동화를 시작하세요.</p>
      
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
