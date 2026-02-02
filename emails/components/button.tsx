import React from 'react';
import { Button as EmailButton } from '@react-email/components';

interface EmailButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

export const ApplyOSButton: React.FC<EmailButtonProps> = ({
  href,
  children,
  variant = 'primary',
}) => {
  const isPrimary = variant === 'primary';

  return (
    <EmailButton
      href={href}
      style={{
        backgroundColor: isPrimary ? '#18BB70' : '#1A1A1A',
        color: isPrimary ? '#000000' : '#EDEDED',
        padding: '12px 24px',
        fontSize: '14px',
        fontWeight: '600',
        borderRadius: '8px',
        textDecoration: 'none',
        display: 'inline-block',
        fontFamily: 'Manrope, sans-serif',
        border: isPrimary ? 'none' : '1px solid #2A2A2A',
      }}
    >
      {children}
    </EmailButton>
  );
};
