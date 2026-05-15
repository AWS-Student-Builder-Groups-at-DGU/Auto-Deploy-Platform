import React from 'react';
import Header from './Header';

interface AuthLayoutProps {
  children: React.ReactNode;
  heading?: string;
  subheading?: string;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <>
      <Header />
      <div className="auth-container">
        <div className="auth-card">
          {children}
        </div>
      </div>
    </>
  );
}
