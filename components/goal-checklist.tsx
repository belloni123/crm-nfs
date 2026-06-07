'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Goal } from '@/lib/types';
import { ProgressRing } from './progress-ring';
import { Card } from './ui/card';
import { cn } from '@/lib/utils';

export type GoalChecklistProps = {
  initialMetas: Goal[];
  slug: string;
};

export function GoalChecklist({ initialMetas, slug }: GoalChecklistProps) {
  const [metas, setMetas] = useState<Goal[]>(initialMetas);
  const [isMounted, setIsMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const storageKey = `nfs-goals-${slug}`;
    const cached = localStorage.getItem(storageKey);
    if (cached) {
      try {
        const cachedMetas = JSON.parse(cached) as Goal[];
        // Merge cached values into initialMetas (localStorage wins)
        const merged = initialMetas.map(meta => {
          const cachedItem = cachedMetas.find(c => c.id === meta.id);
          return cachedItem ? { ...meta, feito: cachedItem.feito } : meta;
        });
        setMetas(merged);
      } catch (e) {
        console.error('Error parsing cached metas:', e);
      }
    }
    setIsMounted(true);
  }, [initialMetas, slug]);

  const toggleGoal = (id: string) => {
    const updated = metas.map(meta =>
      meta.id === id ? { ...meta, feito: !meta.feito } : meta
    );
    setMetas(updated);
    localStorage.setItem(`nfs-goals-${slug}`, JSON.stringify(updated));
  };

  const completedCount = metas.filter(m => m.feito).length;
  const percentage = metas.length > 0 ? (completedCount / metas.length) * 100 : 0;

  return (
    <Card className="flex flex-col gap-6">
      {/* Top Section with Title and ProgressRing */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-text-primary mb-1">
            Objetivos de Evolução
          </h2>
          <p className="text-sm text-text-secondary">
            Marque suas metas de crescimento e foco.
          </p>
        </div>
        {/* ProgressRing will animate smoothly */}
        <ProgressRing percentage={isMounted ? percentage : 0} />
      </div>

      {/* Checklist List */}
      <div className="flex flex-col gap-3">
        {metas.map((meta, index) => (
          <motion.div
            key={meta.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.06, ease: 'easeOut' }}
            onClick={() => toggleGoal(meta.id)}
            className="flex items-center gap-3 p-4 rounded-xl border border-border-subtle bg-bg-base hover:border-border-strong hover:shadow-[0_0_0_1px_#2a2a2a] transition-all duration-300 ease-out group cursor-pointer"
          >
            {/* Custom Checkbox (16x16 is w-4 h-4, border 1.5px is border-[1.5px]) */}
            <motion.div
              key={meta.feito ? 'done' : 'pending'}
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "w-4 h-4 rounded-[4px] border-[1.5px] flex items-center justify-center shrink-0 transition-all duration-200 ease-out",
                meta.feito
                  ? "bg-accent border-accent text-bg-base"
                  : "border-border-strong bg-transparent group-hover:border-text-tertiary"
              )}
            >
              {meta.feito && <Check className="w-3 h-3 stroke-[3.5] text-bg-base" />}
            </motion.div>

            {/* Title Text */}
            <span
              className={cn(
                "text-sm font-sans select-none transition-all duration-300 ease-out",
                meta.feito
                  ? "text-text-tertiary line-through opacity-50"
                  : "text-text-primary"
              )}
            >
              {meta.titulo}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Button link in footer */}
      <div className="border-t border-border-subtle pt-6 flex justify-end">
        <Link
          href={`/member/${slug}/planejamento`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-text-primary transition-all duration-300 ease-out group cursor-pointer"
        >
          Abrir planejamento
          <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform duration-300 ease-out" />
        </Link>
      </div>
    </Card>
  );
}
