import React from 'react';
import { requireProjectAccess } from '@/lib/security';
import { 
  getPipelines, 
  getLeads, 
  getTags, 
  getOrigins, 
  getLostStatuses 
} from '@/app/actions/crm';
import { KanbanBoard } from './kanban-board';

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function ProjectKanbanPage({ params }: Props) {
  const { id: projectId } = await params;
  
  // 1. Valida acesso ao projeto
  await requireProjectAccess(projectId);

  // 2. Busca dados necessários no servidor
  const pipelines = await getPipelines(projectId);
  const leads = await getLeads(projectId);
  const tags = await getTags(projectId);
  const origins = await getOrigins(projectId);
  const lostStatuses = await getLostStatuses(projectId);

  return (
    <KanbanBoard
      projectId={projectId}
      initialPipelines={pipelines as any}
      initialLeads={leads as any}
      tags={tags}
      origins={origins}
      lostStatuses={lostStatuses}
    />
  );
}
