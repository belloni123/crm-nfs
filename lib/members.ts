import fs from 'fs/promises';
import path from 'path';
import { Member } from './types';

const membersFilePath = path.join(process.cwd(), 'data', 'members.json');

export async function getMembers(): Promise<Member[]> {
  try {
    const fileContent = await fs.readFile(membersFilePath, 'utf-8');
    return JSON.parse(fileContent) as Member[];
  } catch (error) {
    console.error('Error reading members.json:', error);
    return [];
  }
}

export async function getMemberByEmail(email: string): Promise<Member | null> {
  const members = await getMembers();
  const normalizedEmail = email.toLowerCase().trim();
  return members.find(m => m.email.toLowerCase().trim() === normalizedEmail) || null;
}

export async function getMemberBySlug(slug: string): Promise<Member | null> {
  const members = await getMembers();
  return members.find(m => m.slug === slug) || null;
}
