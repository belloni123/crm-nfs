const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testBatchOperations() {
  console.log('=== INICIANDO TESTE DE OPERAÇÕES EM LOTE NO POSTGRESQL ===\n');

  // 1. Obter um projeto e o usuário raiz
  const project = await prisma.project.findFirst({
    include: {
      memberships: {
        include: {
          user: true
        }
      }
    }
  });

  if (!project) {
    throw new Error('Nenhum projeto encontrado no banco de dados. Rode o seed primeiro.');
  }

  const user = project.memberships[0]?.user;
  if (!user) {
    throw new Error('Nenhum usuário associado ao projeto encontrado.');
  }

  console.log(`Usando Projeto: "${project.name}" (ID: ${project.id})`);
  console.log(`Usando Usuário: "${user.name || user.email}" (ID: ${user.id})`);

  // 2. Obter o estágio inicial do pipeline
  const pipeline = await prisma.pipeline.findFirst({
    where: { projectId: project.id },
    include: {
      stages: {
        orderBy: { order: 'asc' },
        take: 1
      }
    }
  });

  if (!pipeline || !pipeline.stages[0]) {
    throw new Error(`Nenhum estágio inicial encontrado para o projeto ${project.id}`);
  }
  
  const stageId = pipeline.stages[0].id;
  console.log(`Estágio inicial do Pipeline: "${pipeline.stages[0].name}" (ID: ${stageId})`);

  // 3. Teste 1: Importar leads (2 válidos e 1 inválido de propósito)
  console.log('\n--- Teste 1: Importando Leads via CSV (Simulação) ---');
  const importRows = [
    { name: 'Lead Bom Um', email: 'bom1@test.com', phone: '11999999991', company: 'Empresa Teste 1', value: '1500,50' },
    { name: '  ', email: 'ruim@test.com', phone: '11999999992', company: 'Empresa Ruim', value: '100' }, // Inválido: nome vazio
    { name: 'Lead Bom Dois', email: 'bom2@test.com', phone: '11999999993', company: 'Empresa Teste 2', value: '2500' }
  ];

  let successCount = 0;
  let failureCount = 0;
  const errors = [];
  const createdLeadIds = [];

  for (let i = 0; i < importRows.length; i++) {
    const row = importRows[i];
    const line = i + 1;
    try {
      if (!row.name || !row.name.trim()) {
        throw new Error('Nome do lead está em branco.');
      }
      
      let val = 0.0;
      if (row.value) {
        const cleanVal = String(row.value).replace(/[^\d.,]/g, '').replace(',', '.');
        const parsed = parseFloat(cleanVal);
        if (!isNaN(parsed)) {
          val = parsed;
        }
      }

      // Cria a Pessoa (Lead)
      const lead = await prisma.lead.create({
        data: {
          name: row.name.trim(),
          email: row.email,
          phone: row.phone,
          company: row.company,
          priority: 'MEDIA',
          projectId: project.id
        }
      });

      // Cria a Participação no Funil (PipelineEntry)
      await prisma.pipelineEntry.create({
        data: {
          leadId: lead.id,
          pipelineId: pipeline.id,
          stageId,
          value: val,
          status: 'ACTIVE'
        }
      });

      // Cria atividade de log
      await prisma.activity.create({
        data: {
          leadId: lead.id,
          userId: user.id,
          type: 'LOG',
          content: `Lead importado via arquivo CSV (teste).`
        }
      });

      createdLeadIds.push(lead.id);
      successCount++;
      console.log(`[SUCESSO] Linha ${line}: Lead "${lead.name}" criado com ID ${lead.id}`);
    } catch (err) {
      failureCount++;
      errors.push({ line, error: err.message });
      console.log(`[FALHA] Linha ${line}: ${err.message}`);
    }
  }

  console.log(`Resumo da Importação: ${successCount} importados com sucesso, ${failureCount} falhas.`);
  
  if (successCount !== 2 || failureCount !== 1) {
    throw new Error('Falha no teste de importação: contagem de sucesso/erro incorreta.');
  }

  // 4. Teste 2: Exportar leads para CSV
  console.log('\n--- Teste 2: Exportando Leads para CSV (Simulação) ---');
  // Busca todos os leads ativos do projeto (que tenham pelo menos um pipelineEntry ativo)
  const leads = await prisma.lead.findMany({
    where: {
      projectId: project.id,
      pipelineEntries: {
        some: {
          status: 'ACTIVE'
        }
      }
    },
    include: {
      pipelineEntries: {
        include: {
          stage: true
        }
      },
      origin: true
    }
  });

  const customDefs = await prisma.customFieldDefinition.findMany({
    where: { projectId: project.id }
  });

  console.log(`Total de leads ativos para exportar: ${leads.length}`);

  let csvContent = 'sep=;\n';
  const headers = ['Nome', 'Empresa', 'Email', 'Telefone', 'Valor', 'Estagio', 'Status'];
  customDefs.forEach(def => headers.push(def.name));
  csvContent += headers.join(';') + '\n';

  leads.forEach(lead => {
    const entry = lead.pipelineEntries.find(e => e.status === 'ACTIVE') || { stage: { name: '—' }, value: 0, status: '—' };
    const row = [
      lead.name,
      lead.company || '',
      lead.email || '',
      lead.phone || '',
      entry.value.toString(),
      entry.stage.name,
      entry.status
    ];
    // Custom fields placeholders
    customDefs.forEach(() => row.push(''));
    csvContent += row.join(';') + '\n';
  });

  console.log('CSV Gerado com Sucesso! Conteúdo da prévia:');
  console.log(csvContent.split('\n').slice(0, 5).join('\n'));

  if (!csvContent.includes('Lead Bom Um') || !csvContent.includes('Lead Bom Dois')) {
    throw new Error('Falha no teste de exportação: leads recém-criados não estão presentes no CSV.');
  }

  // 5. Teste 3: Exclusão em lote (Soft delete das participações nos funis)
  console.log('\n--- Teste 3: Exclusão em Lote (Soft-delete) ---');
  console.log(`Arquivando participações dos leads com IDs: ${createdLeadIds.join(', ')}`);

  for (const leadId of createdLeadIds) {
    // Verifica propriedade
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.projectId !== project.id) {
      throw new Error(`Acesso negado ou lead não encontrado: ${leadId}`);
    }

    // Soft delete (arquiva as participações)
    await prisma.pipelineEntry.updateMany({
      where: { leadId },
      data: { status: 'ARCHIVED' }
    });

    // Registra atividade
    await prisma.activity.create({
      data: {
        leadId,
        userId: user.id,
        type: 'STATUS_CHANGE',
        content: `Lead arquivado (soft-delete) de todos os funis via exclusão em lote por ${user.name || user.email}.`
      }
    });
  }

  // Confirma que foram arquivados
  for (const leadId of createdLeadIds) {
    const entries = await prisma.pipelineEntry.findMany({
      where: { leadId }
    });
    
    entries.forEach(entry => {
      console.log(`Participação ID ${entry.id} - Status atual no banco: ${entry.status}`);
      if (entry.status !== 'ARCHIVED') {
        throw new Error(`Falha no soft-delete: PipelineEntry ${entry.id} não foi arquivado.`);
      }
    });
  }

  // Confirma logs de atividade
  const activities = await prisma.activity.findMany({
    where: { leadId: { in: createdLeadIds }, type: 'STATUS_CHANGE' }
  });
  console.log(`Total de logs de exclusão em lote registrados: ${activities.length}`);
  if (activities.length !== 2) {
    throw new Error('Falha no registro de atividade de soft-delete.');
  }

  // 6. Teste 4: Restaurar um lead e limpar
  console.log('\n--- Teste 4: Restaurando um Lead e Limpando Teste ---');
  const restoreLeadId = createdLeadIds[0];
  await prisma.pipelineEntry.updateMany({
    where: { leadId: restoreLeadId },
    data: { status: 'ACTIVE' }
  });

  const restoredEntry = await prisma.pipelineEntry.findFirst({ where: { leadId: restoreLeadId } });
  console.log(`Participação do Lead ID ${restoreLeadId} restaurada! Status: ${restoredEntry.status}`);
  if (restoredEntry.status !== 'ACTIVE') {
    throw new Error('Falha ao restaurar lead.');
  }

  // Limpeza final para não sujar o banco de desenvolvimento
  console.log('\nLimpando leads, participações e atividades de teste criados...');
  await prisma.pipelineEntry.deleteMany({
    where: { leadId: { in: createdLeadIds } }
  });
  await prisma.activity.deleteMany({
    where: { leadId: { in: createdLeadIds } }
  });
  await prisma.lead.deleteMany({
    where: { id: { in: createdLeadIds } }
  });

  console.log('\n=== TODOS OS TESTES PASSARAM COM SUCESSO NO POSTGRESQL! ===');
}

testBatchOperations()
  .catch(err => {
    console.error('Ocorreu um erro no teste:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
