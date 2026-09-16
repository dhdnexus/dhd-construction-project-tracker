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
      aria-label="Construction Project Tracker Logo"
    >
      <rect width="100" height="100" rx="24" fill="#0F1E36" />
      {/* Precision structural framing & blueprint grid */}
      <path
        d="M24 74V26L50 41L76 26V74L50 59L24 74Z"
        stroke="#F59E0B"
        strokeWidth="6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Central vertical datum line */}
      <line x1="50" y1="24" x2="50" y2="76" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="50" cy="50" r="5.5" fill="#818CF8" />
    </svg>
  );
};
