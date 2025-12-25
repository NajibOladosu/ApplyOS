import React from 'react';

interface LogoProps {
  width?: number;
  height?: number;
}

export const ApplyOSLogo: React.FC<LogoProps> = ({ width = 48, height = 48 }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {/* Logo SVG */}
      <svg
        width={width}
        height={height}
        viewBox="0 0 192 192"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Rounded square background */}
        <rect width="192" height="192" rx="32" fill="#000000" />
        {/* Green T letter */}
        <text
          x="96"
          y="136"
          fontSize="140"
          fontFamily="'Crimson Text', serif"
          fontWeight="700"
          fill="#00FF88"
          textAnchor="middle"
        >
          A
        </text>
      </svg>
      {/* Brand text */}
      <span
        style={{
          fontSize: '20px',
          fontWeight: '700',
          color: '#EDEDED',
          fontFamily: 'Manrope, sans-serif',
        }}
      >
        ApplyOS
      </span>
    </div>
  );
};
