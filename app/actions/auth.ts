'use server';

import { redirect } from 'next/navigation';
import { getMemberByEmail } from '@/lib/members';

export type ActionState = {
  error?: string;
};

export async function loginAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const emailInput = formData.get('email');
  
  if (!emailInput || typeof emailInput !== 'string') {
    return { error: 'Por favor, insira um e-mail válido.' };
  }

  const member = await getMemberByEmail(emailInput);

  if (member) {
    redirect(`/member/${member.slug}`);
  }

  return { error: 'E-mail não encontrado. Verifique com o organizador.' };
}
