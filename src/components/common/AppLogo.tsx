import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: number;
}

export const AppLogo: React.FC<AppLogoProps> = ({ className = 'h-8 w-8', size = 32 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="DHD Construction Tracker Logo"
    >
      <rect width="100" height="100" rx="26" fill="#0F1E36" />
      {/* Golden D shape */}
      <path
        d="M26 30C26 27.2386 28.2386 25 31 25H52C65.2548 25 76 35.7452 76 49C76 62.2548 65.2548 73 52 73H31C28.2386 73 26 70.7614 26 68V30Z"
        stroke="#F59E0B"
        strokeWidth="9"
        strokeLinejoin="round"
      />
      {/* Vertical center measuring rod */}
      <line x1="41" y1="26" x2="41" y2="72" stroke="#FFFFFF" strokeWidth="5.5" strokeLinecap="round" />
      <circle cx="41" cy="49" r="6.5" fill="#F59E0B" />
      {/* Lavender X cross accent */}
      <path
        d="M59 41L81 63"
        stroke="#818CF8"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M81 41L59 63"
        stroke="#818CF8"
        strokeWidth="9"
        strokeLinecap="round"
      />
    </svg>
  );
};
