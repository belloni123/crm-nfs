import { PrismaClient } from '@prisma/client';
import { createOrUpdateDeduplicatedLead } from '../lib/leads';

const prisma = new PrismaClient();

async function testDistribution() {
  console.log('=== INICIANDO TESTE DE DISTRIBUIÇÃO E RODÍZIO DE COMERCIAIS ===\n');

  // 1. Obter o primeiro projeto e os estágios
  const project = await prisma.project.findFirst({
    include: {
      memberships: {
        include: {
          user: true
        }
      },
      pipelines: {
        include: {
          stages: {
            orderBy: { order: 'asc' }
          }
        }
      }
    }
  });

  if (!project) {
    throw new Error('Nenhum projeto encontrado. Rode o seed primeiro.');
  }

  const pipeline = project.pipelines[0];
  if (!pipeline || !pipeline.stages[0]) {
    throw new Error('Nenhum funil ou estágio encontrado no projeto.');
  }

  const stageId = pipeline.stages[0].id;
  console.log(`Usando Projeto: "${project.name}" (ID: ${project.id})`);
  console.log(`Estágio do Funil: "${pipeline.stages[0].name}" (ID: ${stageId})`);

  // Obter usuários das memberships ordenados por userId asc (para coincidir com a ordenação do round-robin)
  const sortedMemberships = [...project.memberships].sort((a, b) => a.userId.localeCompare(b.userId));
  if (sortedMemberships.length < 2) {
    throw new Error('O projeto precisa ter pelo menos 2 membros cadastrados para o teste de rodízio.');
  }

  const userA = sortedMemberships[0].userId;
  const userB = sortedMemberships[1].userId;
  const nameA = sortedMemberships[0].user.name || sortedMemberships[0].user.email;
  const nameB = sortedMemberships[1].user.name || sortedMemberships[1].user.email;

  console.log(`Comercial A: "${nameA}" (ID: ${userA})`);
  console.log(`Comercial B: "${nameB}" (ID: ${userB})`);

  // Resetar comerciais do projeto
  await prisma.membership.updateMany({
    where: { projectId: project.id },
    data: { isDesignatedCommercial: false }
  });
  await prisma.project.update({
    where: { id: project.id },
    data: { lastAssignedCommercialId: null }
  });

  // --- Caso 1: Apenas 1 comercial designado ---
  console.log('\n--- Cenário 1: Apenas 1 Comercial Designado (User A) ---');
  await prisma.membership.update({
    where: { id: sortedMemberships[0].id },
    data: { isDesignatedCommercial: true }
  });

  const leadSingle1 = await createOrUpdateDeduplicatedLead(project.id, {
    name: 'Lead Teste Único 1',
    email: 'single1@test.com',
    phone: '11911110001',
    stageId
  });

  console.log(`Lead 1 criado e atribuído ao comercial: ${leadSingle1.assignedUserId === userA ? 'A (Correto)' : 'Incorreto'}`);
  if (leadSingle1.assignedUserId !== userA) {
    throw new Error('Falha no cenário 1: Lead deveria ser atribuído ao Comercial A.');
  }

  const leadSingle2 = await createOrUpdateDeduplicatedLead(project.id, {
    name: 'Lead Teste Único 2',
    email: 'single2@test.com',
    phone: '11911110002',
    stageId
  });

  console.log(`Lead 2 criado e atribuído ao comercial: ${leadSingle2.assignedUserId === userA ? 'A (Correto)' : 'Incorreto'}`);
  if (leadSingle2.assignedUserId !== userA) {
    throw new Error('Falha no cenário 1: Lead deveria ser atribuído ao Comercial A.');
  }


  // --- Caso 2: 2 comerciais designados (Rodízio / Round-Robin) ---
  console.log('\n--- Cenário 2: Dois Comerciais Designados (Rodízio) ---');
  await prisma.membership.update({
    where: { id: sortedMemberships[1].id },
    data: { isDesignatedCommercial: true }
  });
  // Resetar estado de distribuição
  await prisma.project.update({
    where: { id: project.id },
    data: { lastAssignedCommercialId: null }
  });

  // Criar Leads em sequência e testar rodízio
  const order = [userA, userB];
  console.log('Criando 4 leads para verificar o rodízio alternado...');

  const createdLeads = [];
  for (let i = 1; i <= 4; i++) {
    const lead = await createOrUpdateDeduplicatedLead(project.id, {
      name: `Lead Rodízio ${i}`,
      email: `rodizio${i}@test.com',`,
      phone: `1192222000${i}`,
      stageId
    });

    const expectedIndex = (i - 1) % 2;
    const expectedUser = order[expectedIndex];
    const assignedUser = lead.assignedUserId;
    const isCorrect = assignedUser === expectedUser;

    console.log(`Lead ${i} atribuído a: ${assignedUser === userA ? 'Comercial A' : 'Comercial B'} (Esperado: ${expectedUser === userA ? 'Comercial A' : 'Comercial B'}) -> ${isCorrect ? 'OK' : 'FALHA'}`);
    
    if (!isCorrect) {
      throw new Error(`Falha no rodízio do Lead ${i}.`);
    }
    createdLeads.push(lead);
  }


  // --- Caso 3: Preservação de Dono de Lead ---
  console.log('\n--- Cenário 3: Preservação de Dono em Deduplicação ---');
  // leadSingle1 é do Comercial A. Vamos enviá-lo novamente (deduplicação) e ver se mantém Comercial A.
  console.log('Reinserindo Lead Teste Único 1 (já cadastrado para Comercial A)...');
  const leadSingle1Update = await createOrUpdateDeduplicatedLead(project.id, {
    name: 'Lead Teste Único 1 Modificado',
    email: 'single1@test.com', // Mesmo e-mail para bater deduplicação
    phone: '11911110001',
    stageId
  });

  console.log(`Lead ID: ${leadSingle1Update.id} (Primário: ${leadSingle1.id === leadSingle1Update.id ? 'Sim (Deduplicou)' : 'Não (Duplicou)'})`);
  console.log(`Comercial atribuído: ${leadSingle1Update.assignedUserId === userA ? 'Comercial A (Mantido)' : 'Outro comercial (Erro)'}`);

  if (leadSingle1.id !== leadSingle1Update.id) {
    throw new Error('Falha no cenário 3: O lead deveria ser deduplicado (mesmo ID).');
  }
  if (leadSingle1Update.assignedUserId !== userA) {
    throw new Error('Falha no cenário 3: O comercial responsável não deveria ter sido alterado no rodízio.');
  }

  // --- Limpeza ---
  console.log('\nLimpando registros de teste do banco de dados...');
  const allTestLeadIds = [leadSingle1.id, leadSingle2.id, ...createdLeads.map(l => l.id)];
  
  await prisma.pipelineEntry.deleteMany({
    where: { leadId: { in: allTestLeadIds } }
  });
  await prisma.activity.deleteMany({
    where: { leadId: { in: allTestLeadIds } }
  });
  await prisma.lead.deleteMany({
    where: { id: { in: allTestLeadIds } }
  });

  // Restaurar memberships originais
  await prisma.membership.updateMany({
    where: { projectId: project.id },
    data: { isDesignatedCommercial: false }
  });
  await prisma.project.update({
    where: { id: project.id },
    data: { lastAssignedCommercialId: null }
  });

  console.log('\n=== TODOS OS TESTES DE DISTRIBUIÇÃO E RODÍZIO PASSARAM COM SUCESSO! ===');
}

testDistribution()
  .catch(err => {
    console.error('Erro no teste de distribuição:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
