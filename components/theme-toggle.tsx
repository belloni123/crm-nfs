'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  variant?: 'compact' | 'full';
}

export function ThemeToggle({ variant = 'compact' }: ThemeToggleProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Inicializa o tema no client-side
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      // Se não houver preferência, verifica atributo data-theme ou padrão do sistema
      const currentTheme = document.documentElement.getAttribute('data-theme') as 'dark' | 'light' | null;
      if (currentTheme) {
        setTheme(currentTheme);
      }
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  if (variant === 'full') {
    return (
      <button
        onClick={toggleTheme}
        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-glass-3 border border-transparent hover:border-glass-4 transition-all duration-150 font-medium cursor-pointer"
      >
        <div className="flex items-center gap-3">
          {theme === 'dark' ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4 text-blue-500" />
          )}
          <span>Tema do Sistema</span>
        </div>
        <span className="text-[10px] uppercase font-bold text-text-tertiary">
          {theme === 'dark' ? 'Black' : 'Light'}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      className="p-2 rounded-lg bg-glass-2 hover:bg-glass-4 border border-border-subtle hover:border-text-secondary text-text-secondary hover:text-text-primary transition-all duration-150 flex items-center justify-center cursor-pointer"
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4 text-amber-400 animate-pulse" />
      ) : (
        <Moon className="h-4 w-4 text-blue-500" />
      )}
    </button>
  );
}
