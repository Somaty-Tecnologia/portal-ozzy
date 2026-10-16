# Portal The Ozzy — guia para o Claude e para o time

Portal interno da The Ozzy Burger e The Ozzy Pizza: RH/Departamento Pessoal, freelancers, motoboys,
fechamento das lojas, produção, fichas técnicas, compras, estoque, financeiro (contas, conciliação, Lucro Fácil),
checklists, manutenção, eventos e refeição da equipe.

Repositório: `Somaty-Tecnologia/portal-ozzy` (antes `theozzyburger/portal-ozzy`; transferido em 10/2026).

## Stack

- React 19 + TypeScript + Vite + Tailwind 4 (`src/`). Sem roteador externo: as telas ficam em `src/pages/`.
- Supabase (Postgres + Auth + Storage + Edge Function `supabase/functions/criar-acesso`).
- Vercel publica sozinha a partir do GitHub (não há deploy manual).

## Como o código vira produção

| Branch | Vercel | Banco |
| --- | --- | --- |
| `main` | Produção | Supabase real (secret `SUPABASE_DB_URL`) |
| `teste` | Ambiente de testes (faixa azul) | Supabase de teste (secret `SUPABASE_TESTE_DB_URL`) + `supabase/teste/dados-de-teste.sql` |
| `dados-lucro` | — | Só carrega o `lucro.json` da rotina do Lucro Fácil |
| PR para `main` | Link de preview | Nenhum (o CI só confere tipos e monta) |

Banco de teste (projeto Supabase `ctpxygjchnqisbzfsoew`; produção é `kblvyncdlwcxgltyjocm`): refeito do zero em
16/10/2026 com as 112 migrations e os dados fictícios. Desde então o `migrations.yml` aplica sozinho as migrations
novas em todo push no `teste`. Mandar o código para o teste: `git push origin main:teste`
(ou rodar o workflow "Rodar migrations" no branch `teste`). Não aplicar migration no teste pelo conector.

Workflows em `.github/workflows/`:

- `ci.yml`: `npm run typecheck`, `npm run build` e `npm run build:preview` em todo push/PR na `main`.
- `migrations.yml`: aplica as migrations novas de `supabase/migrations` (uma transação cada, com backup antes).
  Controle na tabela `public._migracoes`. Até a 0027 foram rodadas à mão.
- `backup.yml`: `pg_dump` diário (3h de Brasília), guardado como artifact por 90 dias.
- `restore-test.yml`: todo dia 1, restaura o último backup num Postgres descartável.
- `importar-lucro.yml`: importa o `lucro.json` do branch `dados-lucro`.

## Regras de trabalho

1. **Nunca alterar o banco pelo SQL Editor.** Toda mudança de schema é uma migration nova numerada
   (`supabase/migrations/00NN_nome_curto.sql`), que roda sozinha no merge. Não editar migration já aplicada.
2. **Publicar direto na `main`** (decisão do Heitor em 16/10/2026: o portal ainda está em elaboração e ele quer ver
   as mudanças na hora). Fluxo: PR para a `main`, typecheck/build e CI verdes, e o Claude faz o merge. O `teste`
   fica para quando houver mais clientes; até lá, é opcional.
3. **Permissões valem no banco (RLS)**, não só na tela. Quem pode o quê fica em `src/lib/permissoes.ts`
   e precisa estar espelhado nas policies das migrations.
4. Dados sensíveis (documentos, atestados, salários, LGPD) só para o próprio funcionário e a gestão.
5. Menu e visibilidade dos módulos: `src/lib/modulos.ts`.
6. Acesso ao banco pelas telas passa por `src/lib/store.ts` (`supabaseStore.ts` real, `demoStore.ts` exemplo).
   Toda função nova precisa existir nos dois.
7. Antes de abrir PR: `npm run typecheck && npm run build`.
8. Comentários e mensagens de commit em português, explicando o porquê e citando quem pediu e quando.
9. Toda tabela nova é ordenável (`useOrdem` de `src/components/Ordenar.tsx`) e tem a categoria em coluna própria.
10. Nomes de pessoas ganham iniciais maiúsculas automáticas.
11. Não fixar lojas nem CNPJs no código de recursos novos: ler de `src/lib/empresas.ts` (preparo para multi-cliente).
12. Nunca pedir senha, chave ou certificado no chat: o Heitor cola direto nos segredos do Supabase, da Vercel ou do GitHub.
13. Este repositório é **público**: não commitar dados reais de vendas, salários, documentos ou planilhas da equipe.
14. Tarefas grandes (planilhas, varreduras, conferências): usar a skill `economia-de-tokens` (`.claude/skills/`).

## Como falar com o Heitor

- Ele escreve em pt-BR, muitas vezes por áudio transcrito do celular; integrações e sincronizações ele faz depois no PC.
- A marca é **The Ozzy** (o áudio às vezes transcreve "Deose" ou "DOs"). O app se chama **Portal do Time The Ozzy**,
  nunca "Portal do Funcionário".
- Lucro Fácil: o conector não está mais em uso (16/10/2026); o portal já substitui o LF desde 11/10.

## Níveis de acesso

`funcionario`, `manutencao` (degrau 1) → `supervisor` (2) → `gerente`, `administrativo` (3) → `proprietario` (4).
Ninguém altera dados de quem está acima nem dá um nível acima do seu.

## Rodar local

```bash
npm install
npm run dev   # sem .env abre em modo demonstração (senha 1234)
```

Variáveis: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (ver `.env.example`). Chaves de produção ficam só na Vercel.

## Outras referências

- `scripts/lucro/ROTINA.md`: rotina diária de cópia do Lucro Fácil (tarefa agendada do Claude).
- `scripts/*.py`: importações pontuais de planilhas (DPEN, Eclética, cadastros).
- `docs/`: inventário e notas SEFAZ.
