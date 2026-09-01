# Operação, migration e rollback

O No Front Scale inicializa com `prisma migrate deploy`. Seed e `prisma db push` não podem ser usados no boot de produção.

## Antes da publicação

1. Registre somente contagens das tabelas críticas e verificações de integridade.
2. Crie um dump PostgreSQL custom; confira catálogo, tamanho e checksum sem expor credenciais.
3. Restaure o dump em banco isolado e execute `20260901150000_add_custom_fields_webhooks` com falha imediata.
4. Compare contagens, IDs e vínculos; descarte apenas o banco temporário e preserve o dump validado.
5. Confirme o baseline das migrations históricas antes do primeiro `migrate deploy` em produção.
6. Faça o deploy, acompanhe os logs e valide `/api/health`.

## Rollback

A migration é aditiva, exceto por tornar `WebhookEndpoint.targetStageId` opcional e por índices. O rollback preferencial é redeploy do commit anterior: ele ignora as colunas novas sem remover dados.

Uma restauração de banco só pode ser considerada após interromper escritas, preservar o estado atual, restaurar em banco separado, comparar registros e receber aprovação explícita. Nunca use `migrate reset`, `DROP`, `TRUNCATE`, recriação de volume ou restauração sobre o banco ativo.

## Após a publicação

Confirme migration concluída, aplicação e PostgreSQL saudáveis, healthcheck 200, contagens preservadas, ausência de vínculos cruzados e smoke tests de login, rota protegida, webhook inválido e 404.
