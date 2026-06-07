import React from 'react';
import { requireProjectAccess } from '@/lib/security';
import { 
  getLeads, 
  getTags, 
  getOrigins, 
  getLostStatuses,
  getPipelines,
  getProjectMembers
} from '@/app/actions/crm';
import { LeadsList } from './leads-list';

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function ProjectLeadsPage({ params }: Props) {
  const { id: projectId } = await params;
  
  // 1. Valida acesso ao projeto
  await requireProjectAccess(projectId);

  // 2. Busca dados no lado do servidor
  const leads = await getLeads(projectId);
  const tags = await getTags(projectId);
  const origins = await getOrigins(projectId);
  const lostStatuses = await getLostStatuses(projectId);
  const pipelines = await getPipelines(projectId);
  const members = await getProjectMembers(projectId);

  return (
    <LeadsList
      projectId={projectId}
      initialLeads={leads as any}
      tags={tags}
      origins={origins}
      lostStatuses={lostStatuses}
      pipelines={pipelines as any}
      members={members as any}
    />
  );
}
