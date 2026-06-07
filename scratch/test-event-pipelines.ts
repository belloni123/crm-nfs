process.env.CRM_TEST_MODE = 'true';
import { PrismaClient } from '@prisma/client';
import { importLeadsAction, createPipeline, updatePipeline, deletePipeline } from '../app/actions/crm';

const prisma = new PrismaClient();

async function testEventPipelines() {
  console.log('=== INICIANDO TESTE INTEGRADO DE MÚLTIPLOS KANBANS E EVENTOS ===\n');

  // Obter um usuário real para o mock da sessão
  const dbUser = await prisma.user.findFirst();
  if (!dbUser) {
    throw new Error('Nenhum usuário cadastrado. Rode o seed primeiro.');
  }
  process.env.CRM_TEST_USER_ID = dbUser.id;
  console.log('DEBUG: dbUser found in test script:', dbUser.id);

  // 1. Obter o projeto criado pelo seed
  const project = await prisma.project.findFirst({
    include: {
      pipelines: {
        include: {
          stages: { orderBy: { order: 'asc' } }
        }
      }
    }
  });

  if (!project) {
    throw new Error('Nenhum projeto cadastrado. Rode o seed primeiro.');
  }

  const projectId = project.id;
  const initialPipelineCount = project.pipelines.length;
  const defaultPipeline = project.pipelines[0];
  const defaultStage = defaultPipeline.stages[0];

  console.log(`Projeto: "${project.name}" (ID: ${projectId})`);
  console.log(`Quantidade inicial de funis: ${initialPipelineCount}\n`);

  let createdPipelineId = '';
  let targetStageId = '';
  let webhookToken = '';
  let createdWebhookId = '';
  let testLeadId = '';

  try {
    // --- Teste A: Criar um novo Kanban de Evento ---
    console.log('--- Teste A: Criar novo Kanban "Lançamento Junho" ---');
    const newPipeline = await prisma.pipeline.create({
      data: {
        name: 'Lançamento Junho',
        projectId
      }
    });
    createdPipelineId = newPipeline.id;
    console.log(`Kanban criado com sucesso! ID: ${createdPipelineId}`);

    // Criar estágios para este novo Kanban
    const stage1 = await prisma.stage.create({
      data: {
        name: 'Inscrito',
        order: 0,
        color: '#6D8A6C',
        pipelineId: createdPipelineId
      }
    });
    targetStageId = stage1.id;
    console.log(`Estágio criado no funil: "${stage1.name}" (ID: ${targetStageId})`);

    // --- Teste B: Criar Webhook de Entrada direcionado ao novo Kanban ---
    console.log('\n--- Teste B: Configurar Webhook direcionado para Lançamento Junho -> Inscrito ---');
    webhookToken = 'token_test_' + Math.random().toString(36).substring(2, 15);
    const webhook = await prisma.webhookEndpoint.create({
      data: {
        name: 'Formulário WordPress Lançamento',
        token: webhookToken,
        targetStageId,
        projectId,
        fieldMapping: JSON.stringify({
          name: 'nome',
          email: 'email',
          phone: 'whatsapp'
        })
      }
    });
    createdWebhookId = webhook.id;
    console.log(`Webhook cadastrado. Token: ${webhookToken}`);

    // --- Teste C: Disparar Payload contra Webhook ---
    console.log('\n--- Teste C: Disparar Payload simulando entrada de Lead ---');
    // Para simplificar, vamos rodar a própria lógica do Route POST importando diretamente a função de processamento,
    // ou simplesmente chamando a API usando fetch se o servidor local estiver de pé.
    // Como queremos isolamento completo e robustez, podemos fazer uma requisição fetch.
    const baseUrl = 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/webhooks/incoming/${webhookToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: 'Lead Evento WordPress',
        email: 'lead_evento@test.com',
        whatsapp: '5511999998877'
      })
    });

    console.log(`Status do Webhook: ${response.status}`);
    const resBody = await response.json();
    console.log('Resposta do Webhook:', resBody);

    if (response.status !== 200 || !resBody.success) {
      throw new Error('Erro ao processar webhook de entrada.');
    }

    testLeadId = resBody.leadId;

    // Validar inserção no banco e atribuição correta de funil/etapa
    const leadEntries = await prisma.pipelineEntry.findMany({
      where: { leadId: testLeadId },
      include: { pipeline: true, stage: true }
    });

    console.log(`Participações criadas para o lead: ${leadEntries.length}`);
    leadEntries.forEach(entry => {
      console.log(`- Funil: "${entry.pipeline.name}" | Estágio: "${entry.stage.name}" | Status: ${entry.status}`);
    });

    const eventEntry = leadEntries.find(e => e.pipelineId === createdPipelineId);
    if (!eventEntry || eventEntry.stageId !== targetStageId) {
      throw new Error('Falha no Teste C: O lead não foi cadastrado no funil e estágio correto do evento.');
    }
    console.log('Webhook roteou o lead com sucesso para o Kanban do Evento! (OK)');

    // --- Teste D: Importar Leads via CSV direcionados ao novo Kanban ---
    console.log('\n--- Teste D: Importar Leads CSV direcionados ao Lançamento Junho ---');
    const csvRows = [
      { name: 'Lead CSV Evento 1', email: 'csv_e1@test.com', phone: '11988887766' },
      { name: 'Lead CSV Evento 2', email: 'csv_e2@test.com', phone: '11988887755' }
    ];

    // Chamamos a server action que atualizamos
    const importRes = await importLeadsAction(
      projectId,
      csvRows,
      null, // originId
      createdPipelineId,
      targetStageId
    );

    console.log(`Importação concluída. Sucessos: ${importRes.successCount}, Falhas: ${importRes.failureCount}`);
    if (importRes.successCount !== 2 || importRes.failureCount !== 0) {
      throw new Error(`Falha no Teste D: Erro ao importar CSV.`);
    }

    // Verificar participações dos novos leads importados
    const csvLeads = await prisma.lead.findMany({
      where: {
        email: { in: ['csv_e1@test.com', 'csv_e2@test.com'] }
      },
      include: {
        pipelineEntries: {
          include: { pipeline: true, stage: true }
        }
      }
    });

    if (csvLeads.length !== 2) {
      throw new Error('Não encontrou os leads importados no banco.');
    }

    csvLeads.forEach(l => {
      console.log(`Lead: "${l.name}"`);
      const entry = l.pipelineEntries.find(e => e.pipelineId === createdPipelineId);
      if (!entry || entry.stageId !== targetStageId) {
        throw new Error(`Lead ${l.name} não foi atribuído ao funil/etapa do evento.`);
      }
      console.log(`- Atribuído com sucesso ao funil: "${entry.pipeline.name}" -> Estágio: "${entry.stage.name}"`);
    });

    // --- Teste E: Renomear Kanban ---
    console.log('\n--- Teste E: Renomear Kanban de Evento ---');
    const updatedPipeline = await prisma.pipeline.update({
      where: { id: createdPipelineId },
      data: { name: 'Lançamento Junho VIP' }
    });
    console.log(`Nome atualizado no banco: "${updatedPipeline.name}"`);
    if (updatedPipeline.name !== 'Lançamento Junho VIP') {
      throw new Error('Falha no Teste E: O funil não foi renomeado.');
    }

    // --- Teste F: Deletar Kanban e Verificar Cascade / Isolamento ---
    console.log('\n--- Teste F: Deletar Kanban de Evento e testar cascade ---');
    // Deleta o pipeline
    await prisma.pipeline.delete({
      where: { id: createdPipelineId }
    });
    console.log('Kanban deletado com sucesso do banco.');

    // Verificar se as participações dele sumiram
    const checkEntries = await prisma.pipelineEntry.findMany({
      where: { pipelineId: createdPipelineId }
    });
    console.log(`Participações restantes no funil deletado: ${checkEntries.length} (Esperado: 0)`);
    if (checkEntries.length > 0) {
      throw new Error('Falha no Teste F: Participações do funil deletado continuam no banco.');
    }

    // Verificar se as colunas (stages) dele sumiram
    const checkStages = await prisma.stage.findMany({
      where: { pipelineId: createdPipelineId }
    });
    console.log(`Etapas/colunas restantes no funil deletado: ${checkStages.length} (Esperado: 0)`);
    if (checkStages.length > 0) {
      throw new Error('Falha no Teste F: Estágios do funil deletado continuam no banco.');
    }

    // Verificar se os leads ainda existem (eles NÃO devem ser excluídos, pois o Lead é a pessoa física no projeto)
    const baseLeadCheck = await prisma.lead.findUnique({
      where: { id: testLeadId }
    });
    console.log(`Lead criado via webhook existe no banco após deletar funil? ${baseLeadCheck ? 'Sim (Correto - base de leads preservada)' : 'Não (Erro - apagou a pessoa!)'}`);
    if (!baseLeadCheck) {
      throw new Error('Falha no Teste F: O lead físico foi apagado junto com o funil.');
    }

  } catch (err: any) {
    console.error('\n❌ ERRO DURANTE OS TESTES DE KANBAN/EVENTOS:', err.message);
    process.exit(1);
  } finally {
    console.log('\nLimpando vestígios do teste...');
    // Limpar leads de teste
    if (testLeadId) {
      await prisma.activity.deleteMany({ where: { leadId: testLeadId } });
      await prisma.pipelineEntry.deleteMany({ where: { leadId: testLeadId } });
      await prisma.lead.delete({ where: { id: testLeadId } }).catch(() => {});
    }

    await prisma.lead.deleteMany({
      where: {
        email: { in: ['csv_e1@test.com', 'csv_e2@test.com'] }
      }
    });

    if (createdWebhookId) {
      await prisma.webhookLog.deleteMany({ where: { webhookId: createdWebhookId } });
      await prisma.webhookEndpoint.delete({ where: { id: createdWebhookId } }).catch(() => {});
    }

    if (createdPipelineId) {
      await prisma.stage.deleteMany({ where: { pipelineId: createdPipelineId } });
      await prisma.pipeline.delete({ where: { id: createdPipelineId } }).catch(() => {});
    }

    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log('🎉 SUCESSO! TODOS OS TESTES DE MÚLTIPLOS KANBANS E WEBHOOKS PASSARAM! 🎉');
  console.log('================================================================');
}

testEventPipelines();
