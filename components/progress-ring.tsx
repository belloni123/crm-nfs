'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

export type ProgressRingProps = {
  percentage: number;
  size?: number;
};

export function ProgressRing({ percentage, size = 100 }: ProgressRingProps) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Guard against division/NaN issues
  const safePercentage = Math.min(Math.max(percentage, 0), 100);
  const strokeDashoffset = circumference - (safePercentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="var(--border-subtle)"
          strokeWidth={strokeWidth}
        />
        {/* Animated accent progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="var(--accent)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          strokeLinecap="round"
        />
      </svg>
      {/* Text inside ring */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-lg font-bold text-text-primary leading-none">
          {Math.round(safePercentage)}%
        </span>
        <span className="text-[8px] uppercase font-mono text-text-tertiary tracking-wider mt-0.5 leading-none">
          Feito
        </span>
      </div>
    </div>
  );
}
