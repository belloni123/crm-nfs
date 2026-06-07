import React from 'react';
import { requireProjectAccess } from '@/lib/security';
import { HelpContent } from './help-content';
import fs from 'fs';
import path from 'path';

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function HelpPage({ params }: Props) {
  const { id: projectId } = await params;
  
  // 1. Valida acesso ao projeto para qualquer membro logado (não restrito a admins)
  const { projectRole } = await requireProjectAccess(projectId);

  // 2. Lê o arquivo do manual no servidor
  const filePath = path.join(process.cwd(), 'content/manual_crm_eventos.md');
  const markdown = fs.readFileSync(filePath, 'utf-8');

  return (
    <HelpContent 
      projectId={projectId} 
      projectRole={projectRole} 
      markdown={markdown} 
    />
  );
}
