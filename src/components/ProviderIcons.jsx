import React from "react";

export function MicrosoftIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3h8.5v8.5H3V3z" fill="#F25022" />
      <path d="M12.5 3H21v8.5h-8.5V3z" fill="#7FBA00" />
      <path d="M3 12.5h8.5V21H3v-8.5z" fill="#00A4EF" />
      <path d="M12.5 12.5H21V21h-8.5v-8.5z" fill="#FFB900" />
    </svg>
  );
}

export function FacebookIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.017 1.792-4.683 4.533-4.683 1.312 0 2.686.235 2.686.235v2.97h-1.514c-1.49 0-1.955.928-1.955 1.879v2.262h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" fill="#1877F2" />
    </svg>
  );
}

export function AppleIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.05 12.04c-.03-3.07 2.51-4.55 2.63-4.62-1.43-2.09-3.66-2.37-4.45-2.4-1.89-.19-3.69 1.11-4.65 1.11-.97 0-2.45-1.09-4.03-1.06-2.07.03-3.99 1.21-5.06 3.06-2.17 3.76-.55 9.33 1.55 12.39 1.03 1.5 2.24 3.18 3.83 3.12 1.54-.06 2.12-1 3.98-1 1.85 0 2.38 1 4 .97 1.65-.03 2.7-1.52 3.71-3.03 1.17-1.74 1.65-3.43 1.68-3.52-.04-.02-3.22-1.24-3.19-4.92zM14.23 3.39c.85-1.04 1.43-2.48 1.27-3.91-1.23.05-2.72.82-3.6 1.85-.79.92-1.49 2.39-1.3 3.79 1.37.11 2.78-.7 3.63-1.73z" fill="currentColor" />
    </svg>
  );
}