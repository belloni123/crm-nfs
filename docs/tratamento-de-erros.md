# Tratamento de erros e acesso negado

O No Front Scale separa estados esperados de falhas inesperadas sem exibir SQL, stack trace, payloads ou segredos.

| Situação | Tela | Ação disponível |
| --- | --- | --- |
| Sem acesso ao projeto | 403 de projeto | Voltar aos projetos ou trocar de conta |
| Área administrativa sem papel adequado | 403 de administrador | Voltar aos projetos ou trocar de conta |
| Rota/recurso inexistente | 404 | Voltar aos projetos ou início |
| Falha inesperada de rota | 500 | Tentar novamente; digest seguro se disponível |
| Falha do layout raiz | Fallback global | Tentar novamente |

Páginas e layouts usam `resolveProjectAccess`; Server Actions continuam repetindo autenticação e autorização no servidor com `requireProjectAccess` e `requireSuperadmin`. Usuários sem sessão continuam sendo direcionados ao login.
