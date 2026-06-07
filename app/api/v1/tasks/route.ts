import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateApiKey, isRateLimited } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  // Autenticação
  const auth = await authenticateApiKey(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Rate Limiting
  const limit = isRateLimited(auth.prefix);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Limite de requisições excedido. Limite de 60 req/min.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    );
  }

  try {
    const body = await request.json();
    const { leadId, title, description, dueDate } = body;

    // Validações básicas
    if (!leadId) {
      return NextResponse.json({ error: 'O campo "leadId" é obrigatório.' }, { status: 400 });
    }
    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'O campo "title" é obrigatório.' }, { status: 400 });
    }

    // Busca o lead para validar se ele pertence ao mesmo projeto
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.projectId !== auth.projectId) {
      return NextResponse.json({ error: 'Lead não encontrado ou acesso negado.' }, { status: 404 });
    }

    // Cria a tarefa
    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'PENDING',
        leadId,
        projectId: auth.projectId
      }
    });

    // Registra histórico
    await prisma.activity.create({
      data: {
        leadId,
        type: 'LOG',
        content: `Nova tarefa agendada via API de integração: "${task.title}".`,
      }
    });

    return NextResponse.json({ success: true, task });
  } catch (err: any) {
    console.error('Erro na rota POST API v1 tasks:', err);
    return NextResponse.json({ error: err.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}
