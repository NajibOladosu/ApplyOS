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
        justifyContent: 'center',
        gap: '10px',
        marginBottom: '20px',
      }}
    >
      <img
        src={`${process.env.NEXT_PUBLIC_APP_URL || 'https://applyos.io'}/logo.svg`}
        alt="ApplyOS"
        width={width}
        height={height}
        style={{
          display: 'block',
          outline: 'none',
          border: 'none',
          textDecoration: 'none',
        }}
      />
      <span
        style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#00FF88',
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        }}
      >
        ApplyOS
      </span>
    </div>
  );
};
