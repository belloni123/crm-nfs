import React from 'react';
import { requireProjectAccess } from '@/lib/security';
import { getTasks, getLeads } from '@/app/actions/crm';
import { TasksPanel } from './tasks-panel';

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function ProjectTasksPage({ params }: Props) {
  const { id: projectId } = await params;
  
  // 1. Valida acesso ao projeto
  await requireProjectAccess(projectId);

  // 2. Busca dados de tarefas e leads (para vinculação)
  const tasks = await getTasks(projectId);
  const leads = await getLeads(projectId);

  return (
    <TasksPanel
      projectId={projectId}
      initialTasks={tasks as any}
      leads={leads.map(l => ({ id: l.id, name: l.name }))}
    />
  );
}
