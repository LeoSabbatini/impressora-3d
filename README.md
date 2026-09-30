# LHS3D — Custos & Vendas

Calculadora de custo de impressão 3D, controle de vendas, pedidos em kanban e progresso de pagamento da impressora. Os dados ficam salvos no `localStorage` do navegador (não precisa de servidor/banco).

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

## Observação

Os dados (filamentos, produtos, pedidos, etc.) são salvos por navegador/dispositivo via `localStorage`. Se quiser sincronizar entre dispositivos, isso exigiria conectar a um banco (como a Netlify DB que você mencionou), o que ainda não está implementado aqui.
