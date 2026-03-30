# 🍫 Oba Brownie - Sistema de Delivery & Gestão

Um sistema completo de cardápio digital e gestão de pedidos focado em alta performance, baixo consumo de dados e custo zero de infraestrutura. Desenvolvido com Vanilla JavaScript, o sistema integra pedidos via WhatsApp com um painel administrativo em tempo real.

## 🚀 Destaques da Arquitetura

Este projeto foi construído pensando em escalabilidade e economia de recursos, contornando limites de planos gratuitos de Backend as a Service (BaaS):

* **Modularização (Vanilla JS):** Arquitetura baseada em ES6 Modules, separando regras de negócio (Services) de manipulação de interface (UI DOM), garantindo um código limpo e manutenível.
* **Armazenamento Descentralizado:** Upload de imagens integrado diretamente à API do **ImgBB**, salvando apenas as URLs no banco de dados para poupar 100% da banda de rede do servidor principal.
* **Recorte de Imagem Client-Side:** Uso do `Cropper.js` para padronizar, comprimir (WebP) e redimensionar imagens no próprio navegador do administrador antes do upload.
* **Consultas Otimizadas:** Buscas no banco de dados estritamente limitadas às colunas necessárias (evitando `SELECT *`), reduzindo o payload de rede em mais de 90% nas abas de histórico e relatórios.
* **Exportação Local de Relatórios:** Geração de planilhas financeiras (CSV/Excel) processadas nativamente pelo JavaScript do navegador, sem onerar o servidor.

## ⚙️ Funcionalidades

### 📱 Visão do Cliente (App)
* Cardápio dinâmico com filtro de categorias e selos de esgotado/destaque.
* Carrinho de compras flutuante com validação de estoque em tempo real.
* Cálculo automático de taxa de entrega baseado no bairro selecionado.
* Sistema de cupons de desconto com regras de valor mínimo e quantidade.
* Bloqueio automático de compras fora do horário de funcionamento (com opção de agendamento para o dia seguinte).
* Geração inteligente de mensagem de checkout direto para o WhatsApp da loja.

### 💻 Visão da Loja (Painel Admin)
* **Monitor de Pedidos em Tempo Real:** Conexão via WebSockets que atualiza a tela e emite alertas sonoros/push instantaneamente quando um pedido é feito.
* **Wake Lock API:** Mantém a tela do dispositivo (tablet/computador) sempre ligada enquanto o monitor de pedidos estiver aberto.
* Gestão de Produtos (CRUD completo) com alertas visuais de estoque baixo.
* Gestão de Cupons e Histórico de Vendas.
* Controle de abertura/fechamento manual da loja.
* Geração de relatórios de vendas e itens mais vendidos com exportação para Excel.
* Botões de ação rápida (Imprimir cupom térmico, Enviar WhatsApp para Entregador).

## 🛠️ Tecnologias Utilizadas

* **Frontend:** HTML5, CSS3, JavaScript (ES6+ Vanilla)
* **Backend / Database:** [Supabase](https://supabase.com/) (PostgreSQL & Realtime WebSockets)
* **Storage de Imagens:** API [ImgBB](https://imgbb.com/)
* **Bibliotecas Auxiliares:**
    * `Cropper.js` (Manipulação de imagens)
    * `SortableJS` (Reordenação de categorias por Drag-and-Drop)
    * `FontAwesome` (Ícones)

## 📦 Estrutura de Pastas

A base de código está dividida logicamente para facilitar a manutenção:

* `/js/config/` - Constantes globais e inicialização de APIs.
* `/js/modules/` - Lógica da interface do cliente (Carrinho, Checkout, Renderização).
* `/js/admin_modules/` - Lógica exclusiva do painel administrativo (Auth, Relatórios, Gestão).

---
*Desenvolvido com dedicação de José Willians para a Oba Brownie.*
