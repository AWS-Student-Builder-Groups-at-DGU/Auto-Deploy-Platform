import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import HeroSection from '../components/HeroSection';
import Button from '../components/Button';
import { ArrowRight } from 'lucide-react';

import heroImgDeploy from '../assets/hero_image_deploy_1776000548023.png';
import featureImgAi from '../assets/feature_image_ai_1776000561594.png';

export default function MainPage() {
  const navigate = useNavigate();

  const handleStartClick = () => {
    const isLoggedIn = !!localStorage.getItem('userEmail');
    if (isLoggedIn) {
      navigate('/create');
    } else {
      navigate('/login');
    }
  };

  return (
    <>
      <Header />
      <main style={{ paddingTop: '80px' }}>
        <HeroSection
          title={
            <>
              복잡한 서버 배포, <br />
              <span className="text-gradient">클릭 한 번으로 끝내세요</span>
            </>
          }
          description={'Github 저장소 URL만 입력하면 인프라 구축부터 배포까지 알아서 처리합니다.\n개발에만 집중하세요. 나머지는 서비스가 알아서 자동화해 드립니다.'}
          imageSrc={heroImgDeploy}
          actionNode={
            <Button onClick={handleStartClick}>
              배포 시작하기 <ArrowRight size={20} />
            </Button>
          }
        />

        <div style={{ background: '#F0F2F5', padding: '40px 0' }}>
          <HeroSection
            reverse={true}
            title={
              <>
                배포 중 발생한 에러? <br />
                <span className="text-gradient">AI가 즉시 분석해 드립니다</span>
              </>
            }
            description={'터미널 로그를 일일이 뒤져볼 필요 없이, AI 배포 어시스턴트가 실패 원인과\n해결책을 명확하게 요약하여 제공합니다. 강력하고 똑똑한 환경을 경험하세요.'}
            imageSrc={featureImgAi}
          />
        </div>

        <section className="cta-section">
          <Button style={{ fontSize: '1.25rem', padding: '20px 48px' }} onClick={handleStartClick}>
            지금 무료로 시작하기 <ArrowRight size={24} />
          </Button>
        </section>
      </main>
    </>
  );
}
