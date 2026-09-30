# LHS3D — Custos & Vendas

Calculadora de custo de impressão 3D, controle de vendas, pedidos em kanban e progresso de pagamento da impressora. Os dados ficam salvos num banco de dados compartilhado (Netlify Database), então qualquer dispositivo que abrir o site vê as mesmas informações — sem login nem senha.

## Estrutura

- `index.html` — estrutura das páginas/abas
- `style.css` — todo o visual (tema claro/escuro automático)
- `script.js` — lógica (cálculo de custo, filamentos, produtos, vendas, pedidos, impressora)
- `favicon.svg` — ícone da logo (aba do navegador)

## Rodar localmente

Basta abrir o `index.html` no navegador. Não precisa de build nem de instalar nada.

## Deploy no Netlify

1. Suba estes 3 arquivos para um repositório no GitHub.
2. No Netlify: **Add new site → Import an existing project** e conecte o repositório.
3. Deixe o "Build command" vazio e o "Publish directory" como `.` (raiz) — é um site estático, não precisa de build.

## Banco de dados

Filamentos e tipos, configurações de gastos (kWh e consumo), produtos/itens, impressora e pedidos ficam guardados na tabela `dados` do Netlify Database, acessada pela função `netlify/functions/dados.ts` (`/api/dados`). O navegador também mantém uma cópia local como cache; se a conexão falhar, a alteração fica só naquele dispositivo (o indicador no topo mostra "offline") e pode ser substituída pelos dados do banco na próxima sincronização. Ao voltar para a aba, o site busca as alterações feitas em outros dispositivos.

Na primeira vez que um navegador com dados antigos abre o site e o banco ainda está vazio, esses dados são enviados automaticamente para o banco.

Cada pedido pode incluir uma descrição opcional, exibida no cartão do kanban. O campo `descricao` é salvo junto aos demais dados do pedido na coleção `pedidos3d`, dentro da coluna JSONB `valor` da tabela `dados`, e sincronizado entre dispositivos. Pedidos antigos sem esse campo continuam funcionando. Como a coluna já aceita os atributos de cada pedido em JSON, não foi necessária uma alteração no esquema do banco nem nas migrações existentes.

Qualquer pessoa com o link consegue ver e editar os dados.
