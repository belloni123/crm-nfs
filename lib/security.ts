import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from './prisma';

export async function getSession() {
  if (process.env.CRM_TEST_MODE === 'true') {
    return {
      user: {
        id: process.env.CRM_TEST_USER_ID || 'test-user-id',
        email: 'test-admin@test.com',
        name: 'Test Admin',
        role: process.env.CRM_TEST_USER_ROLE || 'SUPERADMIN'
      }
    };
  }
  return await getServerSession(authOptions);
}

// Garante que o usuário logado é SUPERADMIN
export async function requireSuperadmin() {
  const session = await getSession();
  if (!session || !session.user || (session.user as any).role !== 'SUPERADMIN') {
    throw new Error('Acesso negado: Requer privilégios de Superadmin.');
  }
  return session.user as { id: string; email: string; name?: string; role: string };
}

// Garante que o usuário logado tem acesso ao projeto e valida o papel (se exigido)
export async function requireProjectAccess(projectId: string, requiredRole?: 'PROJECT_ADMIN' | 'MEMBER') {
  const session = await getSession();
  if (!session || !session.user) {
    throw new Error('Acesso negado: Não autenticado.');
  }

  const user = session.user as { id: string; email: string; name?: string; role: string };

  // Superadmin tem passe livre global
  if (user.role === 'SUPERADMIN') {
    return { user, projectRole: 'PROJECT_ADMIN' };
  }

  // Verifica se o usuário tem membership no projeto
  const membership = await prisma.membership.findUnique({
    where: {
      userId_projectId: {
        userId: user.id,
        projectId,
      },
    },
  });

  if (!membership) {
    throw new Error('Acesso negado: Você não tem permissão neste projeto.');
  }

  // Se for exigido papel específico (ex: PROJECT_ADMIN), valida
  if (requiredRole && requiredRole === 'PROJECT_ADMIN' && membership.role !== 'PROJECT_ADMIN') {
    throw new Error('Acesso negado: Apenas administradores do projeto podem realizar esta ação.');
  }

  return { user, projectRole: membership.role };
}
