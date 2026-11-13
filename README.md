# 🍫 OBA BROWNIE — Sistema de Delivery & Gestão em Tempo Real

<div align="center">

![Versão](https://img.shields.io/badge/vers%C3%A3o-2.0.0-amber?style=for-the-badge)
![JavaScript](https://img.shields.io/badge/JavaScript-ES_Modules-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Turnstile-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)
![Cloudinary](https://img.shields.io/badge/Cloudinary-Media_API-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-Modern_UI-1572B6?style=for-the-badge&logo=css3&logoColor=white)

<p align="center">
  <b>Ecossistema completo de cardápio digital, controle de estoque atômico e gestão de pedidos para confeitarias.</b><br/>
  Arquitetura Vanilla JS modular de alto desempenho com consumo zero de servidores dedicados e integração direta com WhatsApp.
</p>

</div>

---

## 🍪 Visão Geral

O **Oba Brownie** foi desenvolvido para solucionar os desafios reais de operações de delivery e confeitarias artesanais: atendimento rápido no WhatsApp, eliminação de vendas concorrentes do último produto em estoque e custo zero de infraestrutura. Construído inteiramente com **Vanilla JavaScript (ES Modules)**, dispensa etapas de compilação ou bundlers pesados, entregando carregamento instantâneo mesmo em redes móveis 3G/4G.

O coração do sistema é respaldado pelo **Supabase**, utilizando procedimentos armazenados em **PL/pgSQL com bloqueio transacional exclusivo (`FOR UPDATE` / *advisory locks*)** acionados por **Edge Functions**, impedindo furos de estoque em horários de pico. O painel da loja opera com **WebSockets (Supabase Realtime)**, emitindo alertas visuais e sonoros a cada nova venda.

---

## ✨ Principais Funcionalidades

### 📱 Visão do Cliente (Cardápio Digital Público)
- **Catálogo Dinâmico com Destaques:** Carrossel de lançamentos e produtos em promoção, com ordenação personalizada e agrupamento visual automático de itens esgotados.
- **Campanhas Promocionais Inteligentes:** Descontos aplicados automaticamente por produto, seção do cardápio ou no pedido global ao atingir um valor mínimo.
- **Sistema de Cupons com Escopo:** Aplicação de cupons limitados à loja inteira, categorias específicas ou desconto integral na taxa de entrega.
- **Carrinho Flutuante com Saldo em Tempo Real:** Verificação contínua da fórmula `estoque - estoque_reservado`, impedindo adição de produtos indisponíveis.
- **Cálculo de Entrega e Meios de Pagamento:** Taxa dinâmica por bairro, repasse opcional de taxas de cartão ou opção de **Retirada no Local** com validação de horário.
- **Captura Inteligente via Pix:** Registro automático do pedido no painel assim que a chave Pix é copiada, protegendo o histórico caso o cliente saia para o app do banco.
- **Agendamento Inteligente:** Bloqueio fora do horário de atendimento com permissão de pedidos agendados para o dia útil seguinte.

### 💻 Visão da Loja (Painel Administrativo & Kanban)
- **Monitor Kanban em Tempo Real:** Conexão contínua via WebSockets com alertas sonoros e notificações de navegador a cada nova solicitação.
- **Workflow de Estoque Integrado:**
  - *Novos:* Mantém o item reservado no banco.
  - *Confirmar Preparo:* Efetiva a baixa física no estoque com log de auditoria.
  - *Em Rota / Pronto:* Dispara mensagem automatizada e formatada no WhatsApp do cliente com um clique.
  - *Cancelar Pedido:* Libera imediatamente a reserva do item para novos compradores.
- **Wake Lock API:** Previne o desligamento ou bloqueio automático da tela de computadores e tablets usados na cozinha.
- **Gestão de Produtos & Imagens:** Recorte `1:1` integrado diretamente no navegador via `Cropper.js` com conversão para formato leve **WebP** e envio para a API do **Cloudinary**.
- **Reordenação com Drag-and-Drop:** Organização rápida da ordem das seções usando a biblioteca `SortableJS`.
- **Relatórios & Cupom Fiscal:** Exportação de relatórios de faturamento em CSV (com UTF-8 BOM para Excel) e impressão formatada para impressoras térmicas (58mm e 80mm).

### 🛡️ Engenharia de Dados & Confiabilidade
- **Reserva Atômica via RPC:** Transações atômicas no PostgreSQL garantem que dois clientes comprando o último brownie no mesmo milissegundo nunca gerem erro de duplicidade.
- **Defesa Anti-Bot:** Integração invisível com **Cloudflare Turnstile** no fechamento do carrinho.
- **Row Level Security (RLS) Rigoroso:** Todas as tabelas são restritas; privilégios administrativos residem em esquemas privados e acessados apenas via tokens com roles válidas.
- **Estratégia de Cache Offline:** Service Worker com política *Cache-First* para imagens e cache de sessão com *Page Visibility API*.

---

## 🏗️ Arquitetura & Estrutura de Pastas

```bash
cardapio-oba-brownie-v2/
├── database/                     # Migrações e esquemas relacionais
│   └── migrations/               # Scripts SQL versionados (RLS, RPCs de estoque, cupons)
├── js/
│   ├── admin_modules/            # Módulos restritos ao painel da loja
│   │   ├── auth.js               # Gerenciamento de login administrativo e RLS
│   │   ├── kanban.js             # Monitor de pedidos em tempo real e transições
│   │   ├── products.js           # Cadastro de itens, galeria e recorte WebP
│   │   ├── promotions.js         # Criação de cupons e regras de campanhas
│   │   └── reports.js            # Exportação de planilhas financeiras e impressões
│   ├── config/                   # Configurações globais e conectores
│   │   ├── supabase.js           # Inicialização do client Supabase
│   │   └── turnstile.js          # Chaves e callbacks do Cloudflare Turnstile
│   └── modules/                  # Módulos do cardápio público
│       ├── api.js                # Consultas otimizadas e sem SELECT *
│       ├── cart.js               # Gestão de itens e cálculo dinâmico de totais
│       ├── checkout.js           # Validação de formulário e chamada RPC
│       └── pricing.js            # Regras matemáticas de descontos e taxas
├── supabase/
│   └── functions/
│       └── criar-pedido/         # Edge Function Deno/TS para processamento atômico
├── tests/                        # Testes automatizados com o runner nativo do Node.js
│   ├── pricing.test.js           # Testes de cupons, taxas e campanhas
│   └── stock.test.js             # Validação lógica de reserva de saldo
├── admin.html                    # Interface do painel administrativo
├── index.html                    # Interface do cardápio digital do cliente
├── sw.js                         # Service Worker para cache e performance
└── styles.css                    # Folhas de estilo customizadas com design premium
```

---

## 🚀 Como Executar o Projeto

### 1. Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18 ou superior para rodar os testes unitários)
- Conta no [Supabase](https://supabase.com/) com as migrações aplicadas
- Qualquer servidor estático HTTP local (ex.: VS Code Live Server ou `npx http-server`)

---

### 2. Executando Localmente

1. Clone o repositório e acerte as configurações no arquivo `js/config/supabase.js`:
   ```javascript
   export const SUPABASE_URL = "https://seu-projeto.supabase.co";
   export const SUPABASE_ANON_KEY = "sua-chave-anon-publica";
   ```

2. Inicie um servidor HTTP estático na raiz do projeto:
   ```bash
   npx http-server . -c-1 -p 8080
   ```

3. Acesse os ambientes no navegador:
   - **Cardápio do Cliente:** [http://localhost:8080/](http://localhost:8080/)
   - **Painel Administrativo:** [http://localhost:8080/admin.html](http://localhost:8080/admin.html)

---

### 3. Executando a Suíte de Testes Automatizados

O projeto utiliza o test runner nativo do Node.js (`node:test`), sem necessidade de instalar pacotes externos pesados:

```bash
# Executa os testes de precificação e reserva
node --test tests/*.test.js
```

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| **Linguagem & Módulos** | JavaScript Vanilla Moderno (ES6+ Modules) |
| **Backend as a Service** | Supabase (PostgreSQL 15, Auth, Realtime WebSockets) |
| **Lógica Transacional** | PostgreSQL Stored Procedures (PL/pgSQL) com `FOR UPDATE` |
| **Serverless Functions** | Supabase Edge Functions (Deno & TypeScript) |
| **Segurança Anti-Bot** | Cloudflare Turnstile |
| **Hospedagem de Mídia** | Cloudflare R2 Object Storage (CDN global, tráfego ilimitado gratuito e fallback vetorial) |
| **Interatividade & UI** | SortableJS, FontAwesome, Wake Lock API e Service Workers |
| **Qualidade & Auditoria** | Runner nativo `node:test` e linter Rust `oxlint` |

---

## 📄 Licença

Este projeto é desenvolvido para fins comerciais e de portfólio por [Jose Willians](https://github.com/JoseWillians).  
Todos os direitos reservados.
