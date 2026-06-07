import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

export type PlanningData = {
  titulo: string;
  atualizado: string;
  content: string;
} | null;

export async function getMemberPlanning(slug: string): Promise<PlanningData> {
  const contentPath = path.join(process.cwd(), 'content', `${slug}.md`);
  try {
    const fileContent = await fs.readFile(contentPath, 'utf-8');
    const { data, content } = matter(fileContent);
    return {
      titulo: (data.titulo as string) || 'Planejamento Estratégico',
      atualizado: (data.atualizado as string) || '',
      content,
    };
  } catch (error) {
    // If file does not exist, return null (dashboard will display a friendly blank screen instead of crash)
    return null;
  }
}
