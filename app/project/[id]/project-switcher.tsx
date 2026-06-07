'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, FolderSync } from 'lucide-react';

interface Project {
  id: string;
  name: string;
}

interface ProjectSwitcherProps {
  currentProjectName: string;
  currentProjectId: string;
  projects: Project[];
}

export function ProjectSwitcher({ currentProjectName, currentProjectId, projects }: ProjectSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fecha o dropdown se o usuário clicar fora dele
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (id: string) => {
    setIsOpen(false);
    if (id !== currentProjectId) {
      router.push(`/project/${id}`);
    }
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)] rounded-lg text-xs font-semibold text-white cursor-pointer transition-all duration-150"
      >
        <span className="flex items-center gap-2 truncate">
          <FolderSync className="h-3.5 w-3.5 text-accent flex-shrink-0" />
          <span className="truncate">{currentProjectName}</span>
        </span>
        <ChevronDown className={`h-3 w-3 text-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-[#0f1811] border border-[rgba(255,255,255,0.08)] rounded-lg shadow-2xl z-50 py-1 max-h-60 overflow-y-auto backdrop-blur-md">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelect(p.id)}
              className={`w-full text-left px-3 py-2 text-xs transition-colors duration-100 truncate cursor-pointer flex items-center justify-between ${
                p.id === currentProjectId
                  ? 'bg-accent/10 text-accent font-semibold'
                  : 'text-text-secondary hover:text-white hover:bg-[rgba(255,255,255,0.02)]'
              }`}
            >
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
