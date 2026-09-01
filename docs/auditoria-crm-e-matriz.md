# Auditoria e matriz de evolução — No Front Scale

Esta evolução parte do repositório `belloni123/crm-nfs`, branch `main`. A referência funcional foi o commit `215fa2de65b817cefa9c69bd7dd11d26c90fa527` do CRM B16. Nenhum dado, segredo, configuração ou identificador da referência é reutilizado.

| Funcionalidade | Estado anterior | Alteração no No Front Scale | Banco | Risco |
| --- | --- | --- | --- | --- |
| Campos personalizados | Texto, número e seleção básicos | 13 tipos, chave interna, regras, ordem, pausa e arquivamento | Migration aditiva | Médio |
| Webhook de entrada | Mapeamento fixo | Construtor visual, campos personalizados e compatibilidade legada | Sem troca de tokens | Médio |
| Webhook de saída | Ausente | Eventos, payload configurável, teste, logs e proteção SSRF | Colunas/tabelas aditivas | Médio |
| Ordem de etapas | Sem persistência segura | Reordenação otimista, transacional e validada | Sem recriar etapas | Baixo |
| Autorização | Checagens dispersas | Resolução de acesso por projeto e telas de 403 | Sem mudança | Médio |
| Erros | Experiência genérica | 403, 404, 500 e fallback global com a marca NFS | Sem mudança | Baixo |
| Deploy | `db push` no boot | Migrations versionadas e healthcheck | Requer ensaio prévio | Alto |

## Regras de publicação

- Não usar `prisma db push`, `prisma migrate reset`, seed, `DROP` ou `TRUNCATE` em produção.
- Criar backup verificável e ensaiar a migration em banco isolado antes do deploy.
- O rollback preferencial é redeploy da aplicação anterior; a migration é aditiva e suas colunas são ignoradas pelo código antigo.
- A publicação só ocorre após testes locais, migration validada, confirmação do serviço e smoke tests no domínio.
