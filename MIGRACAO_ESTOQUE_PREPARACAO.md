# Reserva concorrente de estoque

**Estado em 26/09/2026:** backup completo criado; migration aplicada ao Supabase de produção; Edge Function `criar-pedido` publicada (v1); chaves Turnstile configuradas e token inválido rejeitado. O frontend compatível ainda será publicado; a loja permanece fechada até conferir os pedidos legados.

## Regra

- O checkout chama a Edge Function `criar-pedido`; após validar o desafio, ela chama `public.criar_pedido_com_reserva` uma única vez. A transação verifica os produtos ativos e o saldo disponível (`estoque - estoque_reservado`), cria o pedido em `Novo` e reserva todas as quantidades.
- Os produtos são bloqueados pelo banco em ordem estável. Dois pedidos pelo último item ficam serializados: o primeiro reserva a unidade; o seguinte recebe erro e não deixa pedido parcial.
- A chave UUID torna uma repetição idempotente: o banco compara os dados comerciais normalizados com o pedido original, retorna sem reservar de novo quando são iguais e rejeita a mesma chave com payload diferente. Falhas de rede mantêm a chave no navegador para um retry seguro.
- Ao confirmar a preparação, a mesma transação consome as reservas, reduz o estoque físico e muda o pedido de estado. O total reservado diminui na mesma quantidade, sem baixa duplicada.
- Remover um pedido ainda em `Novo` marca-o como cancelado e libera a reserva atomicamente. Pedidos concluídos podem ser removidos do histórico pelo admin; o ledger permanece e estoque consumido não é restaurado.
- Pedidos `Novo` ficam visíveis no Kanban independentemente da data até serem preparados ou cancelados. A interface pública desconta reservas do saldo mostrado.
- Pedidos que já existiam ficam como `legado`: não são reservados nem baixados automaticamente; precisam de conferência manual.

## Migration e sequência

O SQL versionado está em [`database/migrations/20260926_reserva_estoque_concorrencia.sql`](database/migrations/20260926_reserva_estoque_concorrencia.sql). Ele acrescenta o contador reservado, ledger privado, idempotência e RPCs; converte saldos `NULL` existentes em zero e torna estoque obrigatório; remove inserção/alteração/exclusão direta de pedidos para `anon`/`authenticated` e substitui o checkout e ações de Kanban por operações controladas. A RPC de criação fica restrita a `service_role`; o navegador chama a Edge Function `criar-pedido`, que valida Turnstile antes de chamar a RPC.

### Próximos passos antes de abrir o checkout

1. Publicar o frontend compatível, que já contém a **site key pública**. A secret `TURNSTILE_SECRET_KEY` está configurada no Supabase; o endpoint rejeitou o token inválido de diagnóstico sem criar pedido.
2. Conferir manualmente os pedidos `Novo` anteriores à migration antes de preparar ou abrir a loja. Há 22 pedidos legados; a demanda de um produto (Coxinha costela com catupiry) excede o estoque atual e quatro itens não correspondem a produtos do catálogo. Nenhum saldo foi alterado para esses pedidos.
3. Antes de reabrir o checkout, confirmar: token inválido, expirado, reutilizado, hostname/ação incorretos e origem diferente falham sem criar pedido; token válido cria pedido e reserva. Uma chamada anônima direta à RPC deve ser negada.

Concluído em produção:

- Backup completo criado fora do repositório, com `roles.sql`, `schema.sql` e `data.sql` não vazios.
- Estrutura atual, RLS e privilégios inspecionados; migration registrada no histórico do Supabase; nenhuma reserva inválida encontrada após aplicar.
- Edge Function `criar-pedido` publicada e secret Turnstile configurada; token inválido de diagnóstico foi rejeitado sem criar pedido. O frontend ainda está pendente de publicação.
- Testes locais de fluxo de pedido/admin: 8 passaram. A concorrência real no banco ainda não foi testada em branch isolada.

O rollback não deve remover ledger nem liberar reservas automaticamente. Primeiro interrompa a entrada de pedidos, reconcilie pedidos/reservas ativos e aplique um rollback SQL revisado; não restaure INSERT direto do checkout antigo sem uma barreira contra venda concorrente.

## Limitações conhecidas

- A garantia de concorrência só existe depois que a migration e o frontend compatível estiverem ambos ativos. A migration está ativa em produção, mas o frontend ainda não foi publicado; portanto, o checkout público ainda não usa reservas.
- O preço e o total ainda são calculados no navegador. Esta migration protege estoque e atomicidade de reserva, mas a próxima etapa de segurança deve tornar preços, promoções, cupons e frete autoritativos no servidor.
- Reservas de pedidos novos não expiram automaticamente: a administradora deve preparar ou cancelar os pedidos. O Kanban os mantém visíveis mesmo após a virada do dia para evitar unidades presas sem aviso.
- Turnstile validado na Edge Function dificulta automação e a RPC de criação não é acessível a usuários anônimos. Ainda é recomendável uma quota/rate limit server-side: desafios resolvidos por pessoas ou serviços de CAPTCHA ainda poderiam gerar pedidos falsos e reter reservas, que só são liberadas quando a admin cancela o pedido. Não há expiração automática de reserva nesta versão.
- A migration foi executada em produção e seus grants/RLS foram conferidos. Testes concorrentes de ponta a ponta ainda dependem de uma branch Supabase isolada; não foram simulados por testes JavaScript.
