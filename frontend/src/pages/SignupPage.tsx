import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_URL || 'https://6322si78va.execute-api.ap-northeast-2.amazonaws.com/default';

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

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
        const data = await response.json();
        // 성공 시 토큰과 유저 정보를 브라우저 로컬 스토리지에 저장
        localStorage.setItem('token', data.token);
        localStorage.setItem('userId', data.userId);
        localStorage.setItem('userEmail', data.email);
        alert('가입(로그인)이 완료되었습니다!');
        navigate('/');
      } else {
        const errorData = await response.json().catch(() => null);
        alert(errorData?.message || '회원가입에 실패했습니다.');
      }
    } catch (error) {
      console.error('Signup request failed:', error);
      alert('서버와의 통신에 실패했습니다.');
    }
  };

  return (
    <AuthLayout heading="간단하게 회원가입하고" subheading="">
      <h2 className="auth-title">회원가입</h2>
      <p className="auth-subtitle">AutoShip과 함께 혁신적인 배포 자동화를 시작하세요.</p>
      
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
