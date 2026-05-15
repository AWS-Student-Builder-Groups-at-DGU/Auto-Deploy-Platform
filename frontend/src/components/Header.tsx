import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Ship } from 'lucide-react';

export default function Header() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // 로컬 스토리지에서 유저 정보를 확인
    const email = localStorage.getItem('userEmail');
    if (email) {
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogout = () => {
    // 로그아웃 시 로컬 스토리지 정보 삭제 및 상태 업데이트
    localStorage.removeItem('userEmail');
    setIsLoggedIn(false);
    navigate('/');
    // 필요에 따라 페이지를 새로고침하여 상태를 완벽히 초기화할 수도 있습니다.
    // window.location.reload();
  };

  return (
    <header className="header">
      <Link to="/" className="logo-container">
        <Ship size={20} />
        <span style={{ fontWeight: 800 }}>AutoShip</span>
      </Link>
      <nav className="nav-links" style={{ alignItems: 'center' }}>
        {isLoggedIn ? (
          <>
            <Link to="/create">생성페이지</Link>
            <Link to="/mypage">마이페이지</Link>
            <a onClick={handleLogout} style={{ cursor: 'pointer' }}>로그아웃</a>
          </>
        ) : (
          <>
            <Link to="/login">로그인</Link>
            <Link to="/signup">회원가입</Link>
          </>
        )}
      </nav>
    </header>
  );
}
