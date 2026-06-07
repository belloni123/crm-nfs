import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateApiKey, isRateLimited } from '@/lib/api-auth';

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
    const pipelines = await prisma.pipeline.findMany({
      where: { projectId: auth.projectId },
      include: {
        stages: {
          orderBy: { order: 'asc' }
        }
      }
    });

    return NextResponse.json({ pipelines });
  } catch (err: any) {
    console.error('Erro na rota API v1 pipelines:', err);
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
  }
}
