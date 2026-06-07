import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateApiKey, isRateLimited } from '@/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
    const lead = await prisma.lead.findUnique({
      where: { id },
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
        },
        tasks: {
          orderBy: { dueDate: 'asc' }
        },
        activities: {
          orderBy: { createdAt: 'desc' }
        },
        customFieldValues: {
          include: {
            definition: true
          }
        }
      }
    });

    if (!lead || lead.projectId !== auth.projectId) {
      return NextResponse.json({ error: 'Lead não encontrado ou acesso negado.' }, { status: 404 });
    }

    return NextResponse.json({ lead });
  } catch (err: any) {
    console.error('Erro na rota GET API v1 lead por id:', err);
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.projectId !== auth.projectId) {
      return NextResponse.json({ error: 'Lead não encontrado ou acesso negado.' }, { status: 404 });
    }

    const body = await request.json();
    const { name, email, phone, company, priority } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (email !== undefined) updateData.email = email ? email.trim().toLowerCase() : null;
    if (phone !== undefined) updateData.phone = phone ? phone.replace(/\D/g, '') : null;
    if (company !== undefined) updateData.company = company ? company.trim() : null;
    if (priority !== undefined) {
      updateData.priority = ['BAIXA', 'MEDIA', 'ALTA'].includes(priority) ? priority : 'MEDIA';
    }

    const updatedLead = await prisma.lead.update({
      where: { id },
      data: updateData
    });

    // Registra histórico
    await prisma.activity.create({
      data: {
        leadId: id,
        type: 'LOG',
        content: `Dados cadastrais do lead atualizados via API externa.`,
      }
    });

    return NextResponse.json({ success: true, lead: updatedLead });
  } catch (err: any) {
    console.error('Erro na rota PATCH API v1 lead:', err);
    return NextResponse.json({ error: err.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.projectId !== auth.projectId) {
      return NextResponse.json({ error: 'Lead não encontrado ou acesso negado.' }, { status: 404 });
    }

    // SOFT-DELETE: Arquiva todas as participações (PipelineEntry) no projeto
    await prisma.pipelineEntry.updateMany({
      where: { leadId: id },
      data: { status: 'ARCHIVED' }
    });

    // Registra histórico de atividades para auditoria
    await prisma.activity.create({
      data: {
        leadId: id,
        type: 'STATUS_CHANGE',
        content: `Lead arquivado (soft-delete) de todos os funis via chamada DELETE da API externa.`,
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Participações do lead arquivadas com sucesso (soft-delete aplicado).' 
    });
  } catch (err: any) {
    console.error('Erro na rota DELETE API v1 lead:', err);
    return NextResponse.json({ error: err.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}
