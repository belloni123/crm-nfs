import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { Card } from './ui/card';

export type MemberHeaderProps = {
  nome: string;
  empresa: string;
};

export function MemberHeader({ nome, empresa }: MemberHeaderProps) {
  return (
    <header className="w-full flex items-center justify-between pb-6 border-b border-border-subtle">
      <div>
        <h1 className="text-xl font-medium tracking-tight text-text-primary">
          {nome}
        </h1>
        <p className="text-sm text-text-secondary opacity-60">
          {empresa}
        </p>
      </div>
      <Link
        href="/"
        className="flex items-center gap-2 text-xs font-mono text-text-secondary hover:text-text-primary transition-all duration-300 ease-out py-2 px-3 border border-border-subtle hover:border-border-strong rounded-lg bg-bg-elevated cursor-pointer"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sair
      </Link>
    </header>
  );
}

export type MemberSummaryProps = {
  resumo: string;
};

export function MemberSummaryCard({ resumo }: MemberSummaryProps) {
  return (
    <Card className="p-6 flex flex-col gap-2">
      <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
        Resumo Estratégico
      </span>
      <p className="text-sm text-text-primary leading-relaxed font-sans">
        {resumo}
      </p>
    </Card>
  );
}
