import { prisma } from './prisma';
import { getPhoneVariants } from './utils';

async function getNextAssignedCommercial(projectId: string): Promise<string | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { lastAssignedCommercialId: true }
  });

  const memberships = await prisma.membership.findMany({
    where: { projectId, isDesignatedCommercial: true },
    select: { userId: true },
    orderBy: { userId: 'asc' }
  });

  if (memberships.length === 0) {
    return null;
  }

  if (memberships.length === 1) {
    return memberships[0].userId;
  }

  const commercialA = memberships[0].userId;
  const commercialB = memberships[1].userId;
  
  let nextCommercialId = commercialA;
  if (project?.lastAssignedCommercialId === commercialA) {
    nextCommercialId = commercialB;
  } else {
    nextCommercialId = commercialA;
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { lastAssignedCommercialId: nextCommercialId }
  });

  return nextCommercialId;
}

export async function createOrUpdateDeduplicatedLead(
  projectId: string,
  data: {
    name: string;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    value?: number;
    priority?: 'BAIXA' | 'MEDIA' | 'ALTA';
    stageId: string;
    originId?: string | null;
    tags?: string[];
    // UTMs & Campaign Data
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    utmContent?: string | null;
    utmTerm?: string | null;
    referrer?: string | null;
    landingPage?: string | null;
  },
  operatorUserId?: string | null
) {
  const stage = await prisma.stage.findUnique({
    where: { id: data.stageId },
    include: { pipeline: true }
  });

  if (!stage) {
    throw new Error('Estágio inválido.');
  }

  const pipelineId = stage.pipelineId;
  const normalizedEmail = data.email?.trim().toLowerCase() || null;
  let normalizedPhone = data.phone || null;
  if (normalizedPhone) {
    normalizedPhone = normalizedPhone.replace(/\D/g, '');
  }

  let lead = null;
  let isNew = false;

  if (normalizedEmail || normalizedPhone) {
    const conditions: any[] = [];
    if (normalizedEmail) conditions.push({ email: normalizedEmail });
    if (normalizedPhone) {
      const variants = getPhoneVariants(normalizedPhone);
      variants.forEach(v => {
        conditions.push({ phone: v });
      });
    }

    lead = await prisma.lead.findFirst({
      where: {
        projectId,
        OR: conditions
      }
    });
  }

  if (lead) {
    const updateData: any = {};
    if (!lead.email && normalizedEmail) updateData.email = normalizedEmail;
    if (!lead.phone && normalizedPhone) updateData.phone = normalizedPhone;
    if (!lead.company && data.company?.trim()) updateData.company = data.company.trim();
    if (data.originId && !lead.originId) updateData.originId = data.originId;
    if (data.priority && lead.priority === 'MEDIA' && data.priority !== 'MEDIA') {
      updateData.priority = data.priority;
    }

    if (data.tags && data.tags.length > 0) {
      updateData.tags = {
        connect: data.tags.map(id => ({ id }))
      };
    }

    // Set UTM values only if they were not already recorded (preserving first-touch attribution)
    if (!lead.utmSource && data.utmSource) updateData.utmSource = data.utmSource;
    if (!lead.utmMedium && data.utmMedium) updateData.utmMedium = data.utmMedium;
    if (!lead.utmCampaign && data.utmCampaign) updateData.utmCampaign = data.utmCampaign;
    if (!lead.utmContent && data.utmContent) updateData.utmContent = data.utmContent;
    if (!lead.utmTerm && data.utmTerm) updateData.utmTerm = data.utmTerm;
    if (!lead.referrer && data.referrer) updateData.referrer = data.referrer;
    if (!lead.landingPage && data.landingPage) updateData.landingPage = data.landingPage;

    lead = await prisma.lead.update({
      where: { id: lead.id },
      data: updateData
    });

    // Registrar novas UTMs no histórico de atividades na re-entrada/deduplicação
    const newUtmsList: string[] = [];
    if (data.utmSource) newUtmsList.push(`utm_source: "${data.utmSource}"`);
    if (data.utmMedium) newUtmsList.push(`utm_medium: "${data.utmMedium}"`);
    if (data.utmCampaign) newUtmsList.push(`utm_campaign: "${data.utmCampaign}"`);
    if (data.utmContent) newUtmsList.push(`utm_content: "${data.utmContent}"`);
    if (data.utmTerm) newUtmsList.push(`utm_term: "${data.utmTerm}"`);
    if (data.referrer) newUtmsList.push(`referrer: "${data.referrer}"`);
    if (data.landingPage) newUtmsList.push(`url: "${data.landingPage}"`);

    if (newUtmsList.length > 0) {
      await prisma.activity.create({
        data: {
          leadId: lead.id,
          type: 'LOG',
          content: `Lead re-enviou formulário com novos dados de campanha: ${newUtmsList.join(', ')}`
        }
      });
    }
  } else {
    const assignedUserId = await getNextAssignedCommercial(projectId);
    isNew = true;

    lead = await prisma.lead.create({
      data: {
        name: data.name.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        company: data.company?.trim() || null,
        priority: data.priority || 'MEDIA',
        projectId,
        originId: data.originId || null,
        assignedUserId,
        tags: data.tags && data.tags.length > 0 ? {
          connect: data.tags.map(id => ({ id }))
        } : undefined,
        utmSource: data.utmSource || null,
        utmMedium: data.utmMedium || null,
        utmCampaign: data.utmCampaign || null,
        utmContent: data.utmContent || null,
        utmTerm: data.utmTerm || null,
        referrer: data.referrer || null,
        landingPage: data.landingPage || null
      }
    });
  }

  const existingEntry = await prisma.pipelineEntry.findUnique({
    where: {
      leadId_pipelineId: {
        leadId: lead.id,
        pipelineId
      }
    }
  });

  const origin = data.originId 
    ? await prisma.origin.findUnique({ where: { id: data.originId } })
    : null;

  if (!existingEntry) {
    await prisma.pipelineEntry.create({
      data: {
        leadId: lead.id,
        pipelineId,
        stageId: data.stageId,
        value: data.value || 0.0,
        status: 'ACTIVE'
      }
    });

    const content = isNew
      ? `Lead cadastrado pela primeira vez ${origin ? `via ${origin.name}` : ''} no estágio "${stage.name}" do funil "${stage.pipeline.name}".`
      : `Lead re-cadastrado ${origin ? `via ${origin.name}` : ''} no estágio "${stage.name}" do funil "${stage.pipeline.name}".`;

    await prisma.activity.create({
      data: {
        leadId: lead.id,
        userId: operatorUserId || null,
        type: 'LOG',
        content
      }
    });
  } else {
    await prisma.pipelineEntry.update({
      where: {
        leadId_pipelineId: {
          leadId: lead.id,
          pipelineId
        }
      },
      data: {
        stageId: data.stageId,
        value: data.value !== undefined ? data.value : existingEntry.value,
        status: 'ACTIVE',
        lostStatusId: null
      }
    });

    await prisma.activity.create({
      data: {
        leadId: lead.id,
        userId: operatorUserId || null,
        type: 'STATUS_CHANGE',
        content: `Lead movimentado no funil "${stage.pipeline.name}" para o estágio "${stage.name}" via novo cadastro.`
      }
    });
  }

  return lead;
}
