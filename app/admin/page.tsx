import React from 'react';
import { requireSuperadmin } from '@/lib/security';
import { getUsers } from '@/app/actions/users';
import { getProjects } from '@/app/actions/projects';
import { AdminPanel } from './admin-panel';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // 1. Valida que o usuário é SUPERADMIN
  await requireSuperadmin();

  // 2. Busca dados iniciais no lado do servidor
  const users = await getUsers();
  const projects = await getProjects();

  return (
    <AdminPanel 
      initialUsers={users as any} 
      initialProjects={projects as any} 
    />
  );
}
