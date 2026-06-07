export type Goal = {
  id: string;           // slug curto, ex: "expandir-clube"
  titulo: string;
  feito: boolean;
};

export type Member = {
  email: string;        // lowercase, trimmed, único
  slug: string;         // kebab-case sem acentos, único
  nome: string;
  empresa: string;
  resumo: string;       // 1-2 frases, max 200 caracteres
  metas: Goal[];
};

export type MembersFile = Member[];
