import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateApiKey, isRateLimited } from '@/lib/api-auth';
import { createOrUpdateDeduplicatedLead } from '@/lib/leads';

export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url);
    const stageId = searchParams.get('stageId') || undefined;
    const status = searchParams.get('status') || 'ACTIVE'; // 'ACTIVE', 'ARCHIVED', 'LOST'

    const leads = await prisma.lead.findMany({
      where: {
        projectId: auth.projectId,
        pipelineEntries: {
          some: {
            stageId,
            status: status as any
          }
        }
      },
      include: {
        pipelineEntries: {
          include: {
            stage: true,
            lostStatus: true
          }
        },
        tags: true,
        origin: true,
        assignedUser: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return NextResponse.json({ leads });
  } catch (err: any) {
    console.error('Erro na rota GET API v1 leads:', err);
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
  }
}

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
    const { 
      name, 
      email, 
      phone, 
      company, 
      value, 
      priority, 
      stageId, 
      originId, 
      tags 
    } = body;

    // Validações básicas
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'O campo "name" é obrigatório.' }, { status: 400 });
    }
    if (!stageId) {
      return NextResponse.json({ error: 'O campo "stageId" é obrigatório para definir o estágio inicial.' }, { status: 400 });
    }

    // Cria ou atualiza o lead de forma deduplicada e distribui comercial se for novo
    const lead = await createOrUpdateDeduplicatedLead(
      auth.projectId,
      {
        name: name.trim(),
        email: email || null,
        phone: phone || null,
        company: company || null,
        value: typeof value === 'number' ? value : parseFloat(value) || 0.0,
        priority: ['BAIXA', 'MEDIA', 'ALTA'].includes(priority) ? priority : 'MEDIA',
        stageId,
        originId: originId || null,
        tags: Array.isArray(tags) ? tags : undefined
      },
      null // Sem usuário logado operando (é um bot/agente externo)
    );

    // Registra log de atividade específico da criação via API externa
    await prisma.activity.create({
      data: {
        leadId: lead.id,
        type: 'LOG',
        content: `Lead processado via API Key externa de integração.`,
      },
    });

    return NextResponse.json({ 
      success: true, 
      leadId: lead.id,
      message: 'Lead processado com sucesso (deduplicação e rodízio comercial aplicados).'
    });
  } catch (err: any) {
    console.error('Erro na rota POST API v1 leads:', err);
    return NextResponse.json({ error: err.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}
