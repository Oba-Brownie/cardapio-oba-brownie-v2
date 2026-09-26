# Migração de cupons, promoções e RLS

## Estado

No projeto Supabase `diyskqeunfunotqfmncq`, branch `main (PRODUCTION)`, as migrations foram aplicadas em 25/09/2026 depois da criação do backup. Além do escopo de cupons, tabela `public.promocoes`, allowlist privada e RPCs, a segunda migration adicionou constraints de integridade, o índice de configuração singleton e `public.pedidos` à publicação Realtime. As policies abertas a qualquer usuário autenticado foram substituídas.

## Administradores

As contas autorizadas foram verificadas no Supabase Auth e incluídas em `app_private.admin_users` na mesma transação da migration. A tabela privada armazena os IDs Auth, não os e-mails, e não pode ser alterada pela API pública.

## O que a migration faz

- Adiciona escopo de cupom para loja, seção ou frete; linhas existentes ficam no escopo da loja.
- Cria `public.promocoes`, com campanhas para loja, seção ou produto e mínimo opcional do pedido.
- Cria allowlist privada de administradores e uma função `public.is_admin()` usada pelo painel e pelas policies.
- Restringe a leitura pública de produtos aos ativos e de promoções às ativas.
- Remove a listagem pública de todos os cupons; `public.consultar_cupom(text)` retorna somente o cupom informado.
- Restringe pedidos públicos a `INSERT` e leituras/alterações de pedidos ao admin.
- Revoga grants excessivos de `anon` e `authenticated`, incluindo privilégios que RLS não controla, como `TRUNCATE`.

## Limite atual do checkout

O checkout ainda envia preços, descontos e total calculados no navegador e grava o pedido em uma operação separada da baixa de estoque. A policy de insert faz validações básicas de formato, mas não torna esses valores confiáveis nem a operação transacional. A correção definitiva exige uma RPC/Edge Function que recalcule os valores no servidor e grave pedido, estoque e quantidade do cupom atomicamente. Planeje essa etapa antes de tratar o banco como autoridade financeira/estoque.

## Sequência de implantação

1. O backup lógico está em `%LOCALAPPDATA%\ObaBrownieBackups\Temp-Oba-Brownie-2026-09-24`, com `roles.sql`, `schema.sql` e `data.sql`. O dump de dados contém pedidos/clientes e deve ficar privado. A restauração ainda não foi ensaiada em outro projeto.
2. O frontend atualizado está no repositório local; a publicação no site deve ser confirmada separadamente.
3. Validar no site o login dos dois admins, o bloqueio de usuário comum, listagem de produtos e promoções ativas, lookup de cupom, criação de pedido e alerta Realtime.
4. Implementar a RPC transacional de checkout antes de depender do banco para valores ou estoque.

As alterações de schema e policies foram aplicadas remotamente; não houve alteração nos pedidos, produtos ou cupons existentes.
