# 🍫 Oba Brownie - Sistema de Delivery & Gestão

Um sistema completo de cardápio digital e gestão de pedidos focado em alta performance, segurança, baixo consumo de dados e custo zero de infraestrutura. Desenvolvido com Vanilla JavaScript (ES Modules), o sistema integra pedidos via WhatsApp com reserva transacional de estoque e painel administrativo em tempo real.

## 🚀 Destaques da Arquitetura

Este projeto foi construído pensando em escalabilidade, integridade de estoque e economia de recursos, contornando limites de planos gratuitos de Backend as a Service (BaaS):

* **Modularização (Vanilla JS ES6+):** Arquitetura baseada em ES Modules, separando regras de negócio, precificação e submissão de pedidos da manipulação de interface (DOM).
* **Reserva Atômica de Estoque & Idempotência:** Checkout protegido por **Cloudflare Turnstile** e processado via **Supabase Edge Functions** + **PostgreSQL RPC** (`FOR UPDATE` e *advisory locks*), garantindo reserva imediata de saldo sem vendas concorrentes do último item e evitando pedidos duplicados em falhas de rede.
* **Segurança em Camadas (RLS & Anti-XSS):** *Row Level Security* (RLS) ativo em todas as tabelas, verificação administrativa via *allowlist* em schema privado (`app_private`), consulta segura de cupons por RPC e sanitização de saída no DOM e nas exportações CSV.
* **Armazenamento Descentralizado de Imagens:** Upload integrado diretamente à API do **Cloudinary** com recorte `1:1` (1080x1080) e compressão client-side em **WebP** via `Cropper.js`, além de galeria interna para reaproveitamento de fotos.
* **Service Worker & Cache Inteligente:** Cache local de imagens via *Service Worker* (`Cache-First`) e cache de catálogo em `sessionStorage` sincronizado automaticamente pela *Page Visibility API*.
* **Consultas Otimizadas & Relatórios Locais:** Buscas no banco restritas às colunas estritamente necessárias (evitando `SELECT *`) e exportação de planilhas financeiras (CSV/Excel com UTF-8 BOM) processada localmente no navegador.

## ⚙️ Funcionalidades

### 📱 Visão do Cliente (Cardápio Público)
* Cardápio dinâmico com carrossel de **Destaques**, ordenação personalizada de seções e agrupamento automático de itens esgotados.
* **Campanhas e Promoções Dinâmicas:** Descontos automáticos configuráveis por produto, seção ou loja inteira, com suporte a valor mínimo de pedido.
* **Sistema de Cupons Escopados:** Cupons aplicáveis à loja toda, a uma categoria específica ou sobre a taxa de entrega.
* Carrinho de compras flutuante com validação de estoque disponível (`estoque - estoque_reservado`) em tempo real.
* Cálculo automático de taxa de entrega por bairro e repasse configurável de taxa de maquininha (crédito/débito), ou opção de **Retirada no Local** com validação de horário nas observações.
* **Modal de Revisão e Captura Inteligente via Pix:** Registro automático do pedido no painel administrativo assim que o cliente copia a chave Pix, evitando perda de pedidos quando o cliente alterna para o aplicativo do banco.
* Bloqueio automático fora do horário de funcionamento com modo de **Agendamento** para o dia seguinte.

### 💻 Visão da Loja (Painel Administrativo)
* **Monitor Kanban em Tempo Real:** Conexão via WebSockets (*Supabase Realtime*) com alertas sonoros e notificações de navegador a cada novo pedido.
* **Fluxo de Estoque Vinculado ao Kanban:**
  * *Novos:* mantém o estoque reservado até a decisão da loja.
  * *Confirmar Preparo:* consome a reserva e abate o estoque físico atomicamente com registro de auditoria.
  * *Enviar para Entrega / Pronto para Retirada:* atualiza o status e abre mensagem pronta no WhatsApp do cliente.
  * *Cancelar Pedido:* libera automaticamente a reserva de estoque de pedidos ainda não preparados.
* **Wake Lock API:** Mantém a tela do dispositivo (tablet/PC) sempre ativa enquanto o monitor estiver aberto.
* Gestão completa de Produtos (CRUD, destaques, alertas visuais de estoque baixo e galeria de imagens), Cupons, Campanhas Promocionais e Histórico de Vendas.
* Controle de abertura/fechamento manual da loja, chave Pix e reordenação de categorias com *Drag-and-Drop* (`SortableJS`).
* Relatórios de faturamento e ranking de produtos mais vendidos com exportação direta para Excel (`.csv`) e impressão de cupom térmico (80mm/58mm).

## 🛠️ Tecnologias Utilizadas

* **Frontend:** HTML5, CSS3, JavaScript (ES6+ Vanilla Modules), Service Worker API, Wake Lock API
* **Backend & Database:** [Supabase](https://supabase.com/) (PostgreSQL, Auth, Realtime WebSockets, Edge Functions em Deno/TypeScript e RPCs PL/pgSQL)
* **Segurança Anti-Bot:** [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/)
* **Storage de Imagens:** API [Cloudinary](https://cloudinary.com/)
* **Bibliotecas Auxiliares:**
  * `Cropper.js` (Recorte e conversão de imagens para WebP)
  * `SortableJS` (Reordenação de categorias por Drag-and-Drop)
  * `FontAwesome` (Ícones)
* **Qualidade & Testes:** Testes unitários nativos (`node:test`) e lint com `oxlint`

## 📦 Estrutura de Pastas

* `/js/config/` - Constantes globais, bairros/taxas e inicialização do Supabase e Turnstile.
* `/js/modules/` - Lógica do cardápio público (API, Precificação, Carrinho, Cupons, Agendamento, Checkout, Submissão Idempotente e Modo Mock Local).
* `/js/admin_modules/` - Lógica exclusiva do painel administrativo (Auth/RBAC, Kanban/Workflow de Estoque, Produtos/Galeria, Promoções/Cupons, Histórico, Relatórios e Configurações).
* `/supabase/functions/criar-pedido/` - Edge Function responsável por validar origem/Turnstile e acionar a reserva transacional no banco.
* `/database/migrations/` - Migrations SQL versionadas de integridade, RLS, escopo de cupons/promoções e reserva concorrente de estoque.
* `/tests/` - Testes automatizados de regras de precificação e fixtures locais de segurança/renderização.

---
*Desenvolvido com dedicação por José Willians para a Oba Brownie.*
