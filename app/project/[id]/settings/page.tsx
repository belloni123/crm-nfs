import React from 'react';
import { requireProjectAccess } from '@/lib/security';
import { 
  getPipelines, 
  getTags, 
  getOrigins, 
  getLostStatuses, 
  getCustomFieldDefinitions, 
  getWebhookEndpoints, 
  getWebhookLogs,
  getProjectMembers,
  getProjectApiKeyInfo,
  getForms
} from '@/app/actions/crm';
import { getWhatsAppInstances } from '@/app/actions/whatsapp';
import { SettingsPanel } from './settings-panel';

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function ProjectSettingsPage({ params }: Props) {
  const { id: projectId } = await params;

  // 1. Valida acesso ao projeto (qualquer nível de acesso do projeto)
  const { projectRole } = await requireProjectAccess(projectId);

  // 2. Busca dados de configurações no servidor
  const pipelines = await getPipelines(projectId);
  const tags = await getTags(projectId);
  const origins = await getOrigins(projectId);
  const lostStatuses = await getLostStatuses(projectId);
  const customFieldDefs = await getCustomFieldDefinitions(projectId);
  const webhooks = await getWebhookEndpoints(projectId);
  const webhookLogs = await getWebhookLogs(projectId);
  const whatsappInstances = await getWhatsAppInstances(projectId);
  const members = await getProjectMembers(projectId);
  const { apiKeyPrefix } = await getProjectApiKeyInfo(projectId);
  const forms = await getForms(projectId);

  return (
    <SettingsPanel
      projectId={projectId}
      projectRole={projectRole}
      pipelines={pipelines as any}
      tags={tags}
      origins={origins}
      lostStatuses={lostStatuses}
      customFieldDefs={customFieldDefs}
      webhooks={webhooks as any}
      webhookLogs={webhookLogs as any}
      whatsappInstances={whatsappInstances as any}
      members={members as any}
      initialApiKeyPrefix={apiKeyPrefix}
      initialForms={forms as any}
    />
  );
}
