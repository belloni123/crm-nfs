const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function normalizePhone(phone) {
  if (!phone) return null;
  const cleaned = String(phone).replace(/\D/g, '');
  return cleaned || null;
}

function normalizeEmail(email) {
  if (!email) return null;
  return email.trim().toLowerCase() || null;
}

async function runMigration() {
  console.log('=== INICIANDO MIGRAÇÃO E DEDUPLICAÇÃO DE LEADS ===\n');

  const projects = await prisma.project.findMany();
  console.log(`Encontrados ${projects.length} projetos para processar.`);

  for (const project of projects) {
    console.log(`\nProcessando Projeto: "${project.name}" (ID: ${project.id})`);

    // 1. Carregar todos os leads deste projeto com suas relações
    const leads = await prisma.lead.findMany({
      where: { projectId: project.id },
      include: {
        tags: true,
        tasks: true,
        activities: true,
        conversations: true,
        customFieldValues: true,
        stage: true
      }
    });

    console.log(`Total de leads encontrados no projeto: ${leads.length}`);
    if (leads.length === 0) continue;

    // 2. Agrupamento por telefone ou e-mail (Connected Components)
    // Para simplificar, faremos agrupamento iterativo:
    const groups = []; // Array de arrays de leads
    
    for (const lead of leads) {
      const normEmail = normalizeEmail(lead.email);
      const normPhone = normalizePhone(lead.phone);

      // Acha grupos que batem com este lead
      let matchedGroupIndices = [];
      for (let gIdx = 0; gIdx < groups.length; gIdx++) {
        const group = groups[gIdx];
        const match = group.some(other => {
          const otherEmail = normalizeEmail(other.email);
          const otherPhone = normalizePhone(other.phone);
          const emailMatch = normEmail && otherEmail && normEmail === otherEmail;
          const phoneMatch = normPhone && otherPhone && normPhone === otherPhone;
          return emailMatch || phoneMatch;
        });
        if (match) {
          matchedGroupIndices.push(gIdx);
        }
      }

      if (matchedGroupIndices.length === 0) {
        // Cria um novo grupo
        groups.push([lead]);
      } else if (matchedGroupIndices.length === 1) {
        // Adiciona ao grupo correspondente
        groups[matchedGroupIndices[0]].push(lead);
      } else {
        // O lead bate com múltiplos grupos (ex: Lead A bate por email, Lead B por telefone).
        // Funde os grupos em um só!
        const mergedGroup = [lead];
        // Adiciona todos os leads dos grupos coincidentes
        matchedGroupIndices.forEach(idx => {
          mergedGroup.push(...groups[idx]);
        });
        // Remove os grupos antigos (de trás para frente para não alterar índices)
        matchedGroupIndices.sort((a, b) => b - a).forEach(idx => {
          groups.splice(idx, 1);
        });
        // Salva o novo grupo fundido
        groups.push(mergedGroup);
      }
    }

    console.log(`Agrupamento concluído: ${groups.length} pessoas/leads únicos identificados.`);

    // 3. Processar cada grupo
    for (const group of groups) {
      if (group.length === 1) {
        // Lead sem duplicados. Apenas cria o PipelineEntry correspondente!
        const lead = group[0];
        
        // Verifica se o lead tem stageId e se o stage ainda existe
        if (!lead.stageId) {
          console.log(`Lead "${lead.name}" (${lead.id}) não possui estágio. Pulando criação de participação.`);
          continue;
        }

        const stage = await prisma.stage.findUnique({
          where: { id: lead.stageId },
          include: { pipeline: true }
        });

        if (!stage) {
          console.log(`Estágio do Lead "${lead.name}" não existe mais. Pulando criação de participação.`);
          continue;
        }

        // Cria a participação
        await prisma.pipelineEntry.upsert({
          where: {
            leadId_pipelineId: {
              leadId: lead.id,
              pipelineId: stage.pipelineId
            }
          },
          update: {},
          create: {
            leadId: lead.id,
            pipelineId: stage.pipelineId,
            stageId: stage.id,
            value: lead.value || 0.0,
            status: lead.status || 'ACTIVE',
            lostStatusId: lead.lostStatusId
          }
        });

      } else {
        // Encontramos DUPLICADOS! Precisamos fundir!
        console.log(`\n[FUSÃO] Fundindo grupo de ${group.length} leads duplicados:`);
        group.forEach(l => console.log(`  - "${l.name}" | E-mail: ${l.email} | Tel: ${l.phone} | Status: ${l.status}`));

        // 3.1 Escolher o Lead Primário
        // Escolhemos o ativo que tiver mais campos preenchidos, ou simplesmente o primeiro ativo
        let primary = group.find(l => l.status === 'ACTIVE');
        if (!primary) primary = group[0];

        console.log(`Selecionado como Primário: "${primary.name}" (ID: ${primary.id})`);

        // 3.2 Consolidar dados básicos no primário
        const updateData = {};
        
        // E-mail e telefone
        const allEmails = group.map(l => normalizeEmail(l.email)).filter(Boolean);
        const allPhones = group.map(l => normalizePhone(l.phone)).filter(Boolean);
        const allCompanies = group.map(l => l.company?.trim()).filter(Boolean);

        if (!primary.email && allEmails.length > 0) updateData.email = allEmails[0];
        if (!primary.phone && allPhones.length > 0) updateData.phone = allPhones[0];
        if (!primary.company && allCompanies.length > 0) updateData.company = allCompanies[0];

        // Prioridade (Manter a mais alta)
        const priorities = group.map(l => l.priority);
        if (priorities.includes('ALTA')) updateData.priority = 'ALTA';
        else if (priorities.includes('MEDIA')) updateData.priority = 'MEDIA';
        else if (priorities.includes('BAIXA')) updateData.priority = 'BAIXA';

        // Tags acumuladas (todos os IDs únicos)
        const allTagIds = [...new Set(group.flatMap(l => l.tags.map(t => t.id)))];
        if (allTagIds.length > 0) {
          updateData.tags = {
            connect: allTagIds.map(id => ({ id }))
          };
        }

        // Salva dados atualizados no primário
        await prisma.lead.update({
          where: { id: primary.id },
          data: updateData
        });

        // 3.3 Mover entidades relacionadas dos secundários para o primário
        const secondaries = group.filter(l => l.id !== primary.id);
        const secondaryNames = secondaries.map(l => `"${l.name}" (E-mail: ${l.email || '—'}, Tel: ${l.phone || '—'})`).join(', ');

        for (const secondary of secondaries) {
          // Tarefas
          await prisma.task.updateMany({
            where: { leadId: secondary.id },
            data: { leadId: primary.id }
          });

          // Atividades
          await prisma.activity.updateMany({
            where: { leadId: secondary.id },
            data: { leadId: primary.id }
          });

          // Conversas WhatsApp
          await prisma.conversation.updateMany({
            where: { leadId: secondary.id },
            data: { leadId: primary.id }
          });

          // Campos personalizados (Mover apenas se o primário não tiver aquele valor)
          for (const val of secondary.customFieldValues) {
            const hasValOnPrimary = primary.customFieldValues.some(v => v.fieldDefinitionId === val.fieldDefinitionId);
            if (!hasValOnPrimary) {
              await prisma.customFieldValue.update({
                where: { id: val.id },
                data: { leadId: primary.id }
              });
            } else {
              // Deleta duplicado para não violar chaves
              await prisma.customFieldValue.delete({ where: { id: val.id } });
            }
          }
        }

        // 3.4 Processar as participações em funis
        // Coleta todas as participações de todos os membros do grupo
        const participations = [];
        for (const lead of group) {
          if (!lead.stageId) continue;
          const stage = await prisma.stage.findUnique({
            where: { id: lead.stageId },
            include: { pipeline: true }
          });
          if (stage) {
            participations.push({
              pipelineId: stage.pipelineId,
              stageId: stage.id,
              value: lead.value || 0.0,
              status: lead.status || 'ACTIVE',
              lostStatusId: lead.lostStatusId,
              pipelineName: stage.pipeline.name,
              stageName: stage.name
            });
          }
        }

        // Agrupa por pipelineId para evitar duplicar no mesmo funil
        const uniquePipelineEntries = {};
        for (const p of participations) {
          const existing = uniquePipelineEntries[p.pipelineId];
          if (!existing) {
            uniquePipelineEntries[p.pipelineId] = p;
          } else {
            // Se já existe, decide qual manter
            // Prioriza ACTIVE sobre outros
            if (existing.status !== 'ACTIVE' && p.status === 'ACTIVE') {
              uniquePipelineEntries[p.pipelineId] = p;
            } else if (existing.status === p.status) {
              // Se o status é o mesmo, prioriza valor maior ou estágio mais avançado
              if (p.value > existing.value) {
                uniquePipelineEntries[p.pipelineId] = p;
              }
            }
          }
        }

        // Cria os PipelineEntry para o primário
        for (const entry of Object.values(uniquePipelineEntries)) {
          await prisma.pipelineEntry.create({
            data: {
              leadId: primary.id,
              pipelineId: entry.pipelineId,
              stageId: entry.stageId,
              value: entry.value,
              status: entry.status,
              lostStatusId: entry.lostStatusId
            }
          });
        }

        // 3.5 Logar a fusão nas atividades do lead primário
        await prisma.activity.create({
          data: {
            leadId: primary.id,
            type: 'LOG',
            content: `Estes registros de leads duplicados foram fundidos neste contato principal: ${secondaryNames}. Tags e históricos foram consolidados.`
          }
        });

        // 3.6 Excluir os leads secundários
        const secondaryIds = secondaries.map(s => s.id);
        await prisma.lead.deleteMany({
          where: { id: { in: secondaryIds } }
        });

        console.log(`Fusão concluída! Removidos ${secondaryIds.length} secundários.`);
      }
    }
  }

  console.log('\n=== MIGRAÇÃO E DEDUPLICAÇÃO CONCLUÍDAS COM SUCESSO! ===');
}

runMigration()
  .catch(err => {
    console.error('Erro ao executar a migração:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
