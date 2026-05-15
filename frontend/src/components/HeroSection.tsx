import React from 'react';

interface HeroSectionProps {
  title: React.ReactNode;
  description: string;
  imageSrc: string;
  reverse?: boolean;
  actionNode?: React.ReactNode;
}

export default function HeroSection({ title, description, imageSrc, reverse = false, actionNode }: HeroSectionProps) {
  return (
    <section className={`hero-section ${reverse ? 'reverse' : ''}`}>
      <div className="hero-content">
        <h1>{title}</h1>
        <p>{description}</p>
        {actionNode && <div>{actionNode}</div>}
      </div>
      <div className="hero-image-wrapper">
        <img src={imageSrc} alt="Feature Illustration" className="hero-image" />
      </div>
    </section>
  );
}
