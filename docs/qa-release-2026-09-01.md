# Plano e evidências de QA — evolução No Front Scale

Este registro não reproduz dados pessoais, tokens, credenciais ou resultados de outro CRM. Os resultados serão preenchidos apenas após execução no commit deste repositório.

## Escopo

- campos personalizados tipados, com validação, ordem, pausa e arquivamento;
- construtor de webhooks de entrada compatível com mapeamentos legados;
- webhooks de saída, logs sanitizados, criptografia de headers e proteção SSRF;
- reordenação persistente das etapas do Kanban;
- autorização por projeto, telas 403/404/500 e fallback global;
- migration versionada, healthcheck e procedimento de rollback.

## Gates obrigatórios

| Verificação | Evidência exigida |
| --- | --- |
| Testes automatizados | Campos, mapeamentos, SSRF, logs e ordenação |
| Schema, TypeScript, lint e build | Comandos executados no SHA que será publicado |
| Migration | Backup catalogado e ensaio em banco isolado |
| Smoke HTTP | `/`, `/api/health`, rota protegida e 404 |
| QA autenticado | Sessão de QA autorizada; nenhuma conta real criada ou alterada para teste |

## Registro de release

### Gates locais

| Verificação | Resultado |
| --- | --- |
| Instalação pelo lockfile | `npm ci --legacy-peer-deps` aprovado |
| Testes automatizados | 16/16 aprovados |
| Prisma schema | `prisma validate` aprovado com URL local sintética |
| TypeScript | `tsc --noEmit` aprovado |
| ESLint | 0 erros; 36 avisos não bloqueantes preexistentes |
| Build de produção | aprovado; 12 páginas estáticas geradas |
| Auditoria de dependências | 0 vulnerabilidades conhecidas em produção |
| Patch | `git diff --check` aprovado |

O SHA de publicação, o backup, o deploy do Coolify, o healthcheck, o resultado da migration e as lacunas de QA autenticado serão registrados após a validação do ambiente de produção.
