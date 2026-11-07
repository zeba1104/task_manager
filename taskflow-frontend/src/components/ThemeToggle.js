import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ className = '', style = {} }) {
  const { theme, toggleTheme } = useTheme();

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className={`theme-toggle-btn ${className}`}
      onClick={toggleTheme}
      title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
      aria-label={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
        color: isDark ? '#f1f5f9' : '#334155',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.12)',
        borderRadius: '8px',
        padding: '6px 12px',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: 600,
        transition: 'all 0.2s ease',
        ...style,
      }}
    >
      {isDark ? (
        <>
          <Sun size={15} color="#fbbf24" />
          <span>Light</span>
        </>
      ) : (
        <>
          <Moon size={15} color="#6366f1" />
          <span>Dark</span>
        </>
      )}
    </button>
  );
}
