# Inventário técnico G0 do Portal The Ozzy

Levantamento feito a partir do código do repositório em 12/10/2026, para auditoria externa. Descreve o que existe hoje,
sem propor mudanças no portal em uso. Os números (contagens de arquivos, tabelas, ocorrências) foram tirados com `grep`
no próprio repositório e podem mudar a cada commit.

## 1. Stack

| Camada | Tecnologia |
| --- | --- |
| Front-end | React 19 + TypeScript (compilador `tsc` 7, `strict`), Vite 8, Tailwind CSS 4 |
| Roteamento | Próprio, por hash (`#/area/sub/param`), em `src/App.tsx` (sem biblioteca de rotas) |
| Back-end | Supabase: Postgres, Auth, Storage, Row Level Security, funções SQL (RPC) e 1 Edge Function (Deno) |
| Bibliotecas de documento | `jspdf`, `html2canvas-pro`, `pdf-lib`, `pdfjs-dist` (PDF), `qrcode-generator` (QR Code) |
| Node | 22 (o CI usa 22; o `package.json` não fixa versão em `engines` e não há `.nvmrc`) |

Comandos (`package.json`): `dev`, `build` (`tsc && vite build`), `build:preview` (`tsc && vite build --mode preview`),
`typecheck` (`tsc`). Não há script de lint nem de testes.

Toda a comunicação com o banco passa pela interface `Store` (`src/lib/store.ts`), com duas implementações:
`supabaseStore.ts` (dados reais) e `demoStore.ts` (dados de exemplo em memória, ver seção 10).

## 2. Hospedagem e ambientes

| Ambiente | Front-end | Banco | Como é escolhido |
| --- | --- | --- | --- |
| Produção | Vercel, branch `main` | Projeto Supabase de produção | Variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` configuradas na Vercel (ver `.env.example`) |
| Testes | Vercel, branch `teste` | Projeto Supabase separado, só com dados fictícios (`supabase/teste/dados-de-teste.sql`) | `vite.config.ts`: quando `VERCEL_GIT_COMMIT_REF === 'teste'`, troca URL e chave pública (anon) para as do projeto de teste e mostra a faixa "Ambiente de testes" |
| Prévia/demonstração | HTML único (`dist-preview/`) | Nenhum | `npm run build:preview` (modo `preview`) |

- Não há `vercel.json`: a Vercel usa a detecção padrão de projeto Vite. Plano da Vercel: Hobby.
- A chave usada no navegador é a chave pública (anon) do Supabase; as permissões reais ficam no banco (RLS, seção 6).
  A chave de serviço só existe na Edge Function, como variável do Supabase.
- O repositório no GitHub é público.

## 3. Deploy e migrations automáticas

**Front-end:** a Vercel monta e publica a cada push (produção no `main`, testes no `teste`). Não há etapa de deploy nos
workflows do GitHub.

**Banco:** `.github/workflows/migrations.yml` ("Rodar migrations"):

- Dispara em push no `main` ou no `teste` que mexa em `supabase/migrations/**` ou `supabase/teste/**`, e manualmente
  (`workflow_dispatch`, com opção de só marcar como aplicadas migrations rodadas à mão).
- Conecta com o secret `SUPABASE_DB_URL` (produção, branch `main`) ou `SUPABASE_TESTE_DB_URL` (branch `teste`).
- Controle do que já rodou na tabela `public._migracoes` (nome + data). As migrations até a `0027` foram aplicadas à mão
  no SQL Editor e são só registradas; no banco de teste roda tudo desde a `0001`.
- Antes da primeira migration nova, faz `pg_dump` do schema `public` e guarda como artefato `antes-das-migrations-<n>` (90 dias).
- Cada migration roda em `--single-transaction` com `ON_ERROR_STOP`: se der erro, nada dela fica e a rotina para.
- No `teste`, depois das migrations, roda `supabase/teste/dados-de-teste.sql`.
- `concurrency` por branch evita duas execuções ao mesmo tempo.

Hoje são 75 migrations (`0001` a `0075`). Várias são migrations **de dados** geradas por scripts Python em `scripts/`
a partir de planilhas (cadastros, fichas técnicas, plano de contas, eventos anteriores, lista de fechamento).
`supabase/setup/` guarda scripts de instalação manual (banco completo até uma certa data, primeiro acesso, consertos).

**Edge Function:** publicada à mão (`supabase functions deploy criar-acesso`); não há workflow para ela.

**CI (`.github/workflows/ci.yml`, novo):** em push e pull request no `main`, roda `npm ci`, `npm run typecheck`,
`npm run build` e `npm run build:preview`. Não acessa banco nem publica nada.

**Outro workflow:** `importar-lucro.yml` importa no banco o arquivo `lucro.json` publicado no branch `dados-lucro`
(seção 8).

## 4. Backups

- `.github/workflows/backup.yml`: todo dia às 06:00 UTC, `pg_dump --no-owner --no-privileges` dos schemas `public`, `auth`
  e `storage`, compactado (`portal-AAAA-MM-DD.sql.gz`) e guardado como artefato do GitHub Actions `backup-<n>` por 90 dias.
- O backup contém as tabelas e os metadados do Storage, **não os arquivos** guardados nos buckets (documentos, fotos,
  holerites, guias, chamados).
- `.github/workflows/restore-test.yml` (novo): todo dia 1 do mês, às 09:00 UTC, e manualmente. Baixa o artefato `backup-*`
  mais recente (com o `GITHUB_TOKEN`, permissão `actions: read`), sobe um Postgres 17 descartável como serviço do job,
  cria os papéis do Supabase (`anon`, `authenticated`, `service_role` etc.) e o schema `extensions`, restaura e confere
  (`scripts/testar-restauracao.sh`):
  - quantidade de tabelas no `public` e se todas as tabelas criadas pelas migrations estão no backup;
  - linhas de `unidades`, `funcionarios`, `insumos`, `receitas` (falha se vazias) e de `fornecedores`, `contas_pagar`,
    `estoque_movimentos`, `notas_fiscais`, `eventos`, `comunicados`, `auth.users` (informativo);
  - se a última migration em `_migracoes` é a última de `supabase/migrations` (aviso, não falha);
  - idade do backup (aviso se mais de 3 dias).
  O resultado vai para o resumo da execução. Erros de objetos internos do Supabase durante a restauração são contados,
  mostrados só pelo tipo (sem valores) e não reprovam o teste. O workflow não usa `SUPABASE_DB_URL` e não conecta no
  banco real.

## 5. Áreas e páginas

Menu lateral definido em `src/lib/modulos.ts`; quem vê cada módulo depende do nível (`funcionario`, `supervisor`,
`gerente`, `administrativo`, `proprietario`, `manutencao`), do setor e da loja. "Gestão" = gerente, administrativo
ou proprietário.

| Módulo (rota) | Quem vê | O que faz |
| --- | --- | --- |
| Início (`#/inicio`) | Todos | Avisos pessoais (exame vencendo, termo de uniforme a assinar) e atalhos |
| Departamento Pessoal (`#/rh/...`) | Todos (abas variam) | Avisos/comunicados com confirmação de leitura, turnos, folgas, equipe/organograma e perfil, exames, caixinha, salários, ajuste de ponto |
| Freelancers (`#/freelancers`) | Gestão | Cadastro e diárias dos freelancers das lojas, aprovação e pagamento |
| Motoboys (`#/motoboys`) | Gestão | Cadastro e lançamento semanal de pagamento dos motoboys |
| Fechamento e pedido (`#/fechamento`) | Gestão e equipe das lojas com fechamento | Contagem de estoque no fim do turno e pedido à Central de Produção |
| Produção (`#/producao`) | Gestão e setor de produção | Pedidos das lojas, lista de preparo, lançamento do produzido, inventário semanal das lojas |
| Fichas técnicas (`#/fichas`) | Gestão | Fichas técnicas (receitas com versões e custo) |
| Financeiro (`#/financeiro/...`) | Administrativo e proprietário | Contas a pagar, recorrentes, conciliação bancária (OFX), despesas, fornecedores, resultado do Lucro Fácil, plano de contas |
| Cadastros (`#/cadastros`) | Gestão | Materiais (insumos), produtos de venda com preço e fornecedores |
| Compras (`#/compras`) | Gestão | Pedidos de compra, semana de compras, estoque e pedidos de uniformes |
| Estoque (`#/estoque/...`) | Gestão | Notas fiscais (importação de XML), saldo por loja, movimentos (contagem, saída, perda, entrada, transferência) |
| Regras e processos (`#/regras`) | Todos | Regulamento interno com versões e confirmação de leitura |
| Manutenção (`#/manutencao`) | Todos (atendimento: manutenção e gestão) | Chamados, equipamentos e manutenção preventiva |
| Eventos (`#/eventos/...`) | Gestão | Cadastro de eventos, painel, comparativo, estoque da base e checklist, freelancers de evento, fichas, insumos, fornecedores, logística (cardápio/previsão, separação, sobras, vendas) |
| Meu evento (`#/meu-evento/<id>`) | Quem está escalado no evento | Conferência da separação e contagem das sobras |
| Checklists, Treinamentos | — | Marcados "em breve" (tela `EmBreve`, sem funcionalidade) |

Páginas sem login (abertas por link ou QR Code): `#/diaria/<loja>` (freelancer envia diárias), `#/diaria-evento[/<evento>]`
(freelancer de evento) e `#/g/<código>` (guia de exame, válida por 7 dias). Usam funções SQL específicas liberadas
para o papel `anon` (seção 6).

Arquivos em `src/pages/` (50), uma linha cada:

| Arquivo | Função |
| --- | --- |
| AbrirGuia | Abre a guia de exame pelo link curto, enquanto válido |
| AnaliseCmv | CMV: custo pela ficha × preço de venda, por tabela de preço |
| Cadastros | Materiais, produtos de venda e fornecedores |
| Caixinha | Divisão mensal da caixinha |
| ComparativoEventos | Comparativo de vendas entre eventos |
| Compras | Módulo Compras (pedidos e uniformes) |
| ComprasPedidos | Pedido de compra ao fornecedor e relatório da semana |
| Comunicados | Avisos com confirmação de leitura |
| Conciliacao | Conciliação do extrato OFX com contas a pagar |
| EmBreve | Tela dos módulos ainda não feitos |
| EnviarDiaria | Envio de diárias por freelancer de loja (sem login) |
| EnviarDiariaEvento | Envio de diárias por freelancer de evento (sem login) |
| Equipamentos | Inventário de equipamentos por loja e histórico de manutenções |
| Equipe | Organograma e lista da equipe |
| EquipeEvento | Quem trabalha em cada evento e onde |
| Escala | Folgas da semana |
| Estoque | Notas fiscais, saldo e movimentos |
| EstoqueBase | Estoque da base (Central) e itens fixos do checklist de eventos |
| EstoqueUniformes | Estoque de uniformes por peça, cor e tamanho |
| EventoLogistica | Abas de logística de um evento |
| Eventos | Módulo Eventos |
| Fechamento | Fechamento do turno e pedido à Central |
| FeriasPessoa | Férias por período aquisitivo e 13º |
| FichasEvento | Fichas técnicas (lojas e eventos) |
| Financeiro | Resultado/indicadores por loja |
| Freelancers | Freelancers das lojas |
| FreelasEventos | Freelancers de eventos |
| ImportarFornecedores | Importação de fornecedores em lote (CSV/planilha colada) |
| Inicio | Página inicial |
| Insumos | Cadastro único de insumos e histórico de preço |
| InventarioLojas | Inventário semanal das lojas, com contagem por voz |
| LancarContas | Lançamento de contas a pagar, inclusive em lote (CSV) |
| Login | Entrada por celular e senha |
| Manutencao | Chamados de manutenção |
| ModuloFinanceiro | Abas do Financeiro e plano de contas |
| Motoboys | Motoboys e semanas de pagamento |
| Painel | Indicadores de pessoal (ativos por dia) |
| PainelAvaliacoes | Avaliações das lojas em plataformas de delivery |
| PainelEventos | Gráficos dos eventos |
| PainelPedidos | Painel de pedidos/vendas |
| Perfil | Perfil da pessoa (dados, documentos, foto) |
| Ponto | Pedido de ajuste de ponto |
| Preventiva | Manutenção preventiva por loja |
| Producao | Pedidos das lojas, lista de preparo e produção |
| Recorrentes | Contas recorrentes |
| Regras | Regulamento interno |
| Salarios | Salários, holerites e arquivo de pagamento |
| Turnos | Turnos de trabalho |
| Uniformes | Pedido de troca de uniforme |
| Vencimentos | Controle de exames da equipe (dados de saúde, só gestão) |

## 6. Banco de dados

90 tabelas no schema `public` criadas pelas migrations, mais `_migracoes` (criada pelo workflow). Agrupadas por domínio:

| Domínio | Tabelas |
| --- | --- |
| Base e acesso | `unidades`, `funcionarios` |
| Pessoal (RH) | `documentos`, `ocorrencias`, `comunicados`, `comunicado_leituras`, `folgas`, `turnos`, `ponto_ajustes`, `admissoes`, `desligamentos`, `ferias`, `decimo_terceiro`, `salarios`, `caixinha_mensal`, `vinculos_anteriores`, `links_guia`, `regulamento_versoes`, `regulamento_leituras` |
| Uniformes | `uniforme_entregas`, `uniforme_estoque`, `uniforme_valores`, `uniforme_solicitacoes`, `uniforme_pedidos`, `uniforme_pedido_itens`, `uniforme_devolucoes` |
| Freelancers e motoboys | `freelancers`, `freela_diarias`, `freela_envios`, `freela_pagamentos`, `motoboys`, `motoboy_semanas` |
| Pagamentos bancários | `contas_pagamento`, `remessas_pagamento` |
| Manutenção | `chamados`, `chamado_eventos`, `equipamentos`, `equipamento_manutencoes`, `preventivas`, `preventiva_execucoes` |
| Cadastros e fichas | `insumos`, `insumo_precos`, `categorias_insumo`, `fornecedores`, `fornecedor_produtos`, `produtos_venda`, `receitas`, `receita_versoes`, `receita_itens` |
| Compras e estoque | `compras_pedidos`, `compras_historico`, `notas_fiscais`, `nota_itens`, `estoque_movimentos`, `inventarios`, `inventario_itens`, `inventarios_estoque`, `inventario_estoque_itens` |
| Fechamento e produção | `fechamentos`, `fechamento_itens`, `fechamento_contagens`, `producoes` |
| Financeiro | `contas_pagar`, `contas_recorrentes`, `plano_contas`, `centros_custo`, `extrato_movimentos`, `extrato_regras`, `extrato_saldos` |
| Vendas e painéis | `vendas_diarias`, `avaliacoes` |
| Eventos | `eventos`, `evento_dias`, `evento_historico`, `evento_responsaveis`, `operacoes`, `evento_operacoes`, `evento_produtos`, `evento_previsao`, `evento_vendas`, `evento_equipe`, `evento_envios`, `evento_envio_itens`, `checklist_evento_modelo`, `freelas_evento`, `evento_freela_diarias` |
| Lucro Fácil (cópia) | `lf_resultados`, `lf_fichas`, `lf_fichas_custo`, `lf_sincronizacao` |

Storage (buckets citados nas migrations): `documentos`, `fotos`, `holerites`, `guias`, `chamados`.

### Regras de acesso (RLS)

- RLS ligada em todas as tabelas (88 comandos `enable row level security` nas migrations) e cerca de 200 políticas
  (`create policy`).
- As políticas usam funções auxiliares `security definer` com `search_path = public`, definidas nas migrations:
  - `eu()`: o registro de `funcionarios` ligado ao `auth.uid()` (só se ativo);
  - `sou_gestao()`: nível gerente, administrativo ou proprietário;
  - `vejo_resultado()`: administrativo ou proprietário (Financeiro);
  - `vejo_painel()`: gerente ou proprietário;
  - `sou_producao()`: setor produção;
  - `atendo_chamados()`: manutenção ou gestão;
  - `sou_responsavel_evento(evento)`: responsável pelo evento;
  - `posso_ver_funcionario(alvo)`: a própria pessoa, a gestão, ou o supervisor da mesma loja;
  - `posso_alterar(alvo)`: gestão, e só sobre pessoas de nível igual ou abaixo (`degrau()`).
- Operações com regra de negócio (lançar nota, registrar movimento, enviar fechamento, conciliar extrato, gerar
  recorrentes, salvar inventário etc.) são funções SQL chamadas por RPC; cerca de 80 funções `security definer` ao todo.
- Para as páginas sem login, só funções específicas recebem `grant execute ... to anon`: `freela_lojas`,
  `freela_quem_sou`, `freela_enviar_diarias`, `freela_eventos_abertos`, `freela_evento_quem_sou`, `freela_evento_enviar`
  e `guia_valida`.
- `src/lib/permissoes.ts` espelha essas regras nas telas (só para esconder botões; a regra que vale é a do banco).

## 7. Edge Functions

| Função | O que faz |
| --- | --- |
| `supabase/functions/criar-acesso` | Cria ou redefine o login de um funcionário (e-mail sintético `<celular>@portal.theozzy` + senha inicial). Confere `sou_gestao()` com o token de quem chama e usa a chave de serviço (variável do Supabase) para o Auth admin. Chamada por `supabaseStore.ts` via `functions.invoke`. |

## 8. Integrações

Todas por arquivo; não há chamadas a APIs de terceiros a partir do navegador.

| Integração | Onde | Como |
| --- | --- | --- |
| NF-e (XML) | `src/lib/nfe.ts`, módulo Estoque | Lê o XML da nota no navegador (itens, fornecedor, pagamento) e lança via RPC (`importar_nota`, `lancar_nota`) |
| Extrato bancário (OFX) | `src/lib/ofx.ts`, Conciliação | Lê o OFX e concilia com contas a pagar (`conciliar_movimento`, `conciliar_lote`) |
| Planilhas (CSV/colar) | `LancarContas`, `ImportarFornecedores` | Contas a pagar e fornecedores em lote, colando linhas ou abrindo CSV; há planilha modelo para baixar |
| Holerites (PDF) | `src/lib/holerite.ts`, Salários | Lê os PDFs da contabilidade com `pdfjs-dist`, separa por pessoa e propõe os valores para conferência |
| Itaú SISPAG (CNAB 240) | `src/lib/sispag.ts`, `ArquivoBanco.tsx` | Gera o arquivo de remessa de Pix em lote (salários, adiantamentos, diárias de freelancer, motoboys) para subir no internet banking; registro em `remessas_pagamento`. Não há conexão direta com o banco |
| Lucro Fácil | `scripts/lucro/`, `importar-lucro.yml`, função `lf_importar` | Rotina externa, só leitura no Lucro Fácil, monta `lucro.json`, publica no branch `dados-lucro` e o workflow importa nas tabelas `lf_*` |
| Planilhas de implantação | `scripts/*.py` | Geram migrations de dados a partir de planilhas (rodadas uma vez, fora do portal) |
| Sefaz (DF-e) | `docs/sefaz-notas.md` | Apenas pesquisa; não implementado |

## 9. Contagem por voz

`src/lib/voz.ts` usa a Web Speech API do navegador (`SpeechRecognition` / `webkitSpeechRecognition`, `pt-BR`, contínua)
e interpreta a fala ("item, quantidade") contra a lista da contagem. Usada em `Fechamento`, `InventarioLojas` e
`EventoLogistica` (sobras). Sem a API (ex.: Firefox), a tela avisa e a contagem é digitada. O áudio é processado pelo
serviço de reconhecimento do próprio navegador; o portal não grava áudio.

## 10. Modo demonstração

- `App.tsx` usa `demoStore` quando o modo do Vite é `preview` ou quando faltam as variáveis do Supabase; caso contrário,
  `supabaseStore`. O build de produção na Vercel tem as variáveis, então usa sempre `supabaseStore`.
- `npm run build:preview` gera um HTML único (`vite-plugin-singlefile`) com dados de exemplo em memória (nada é salvo),
  faixa "Modo demonstração" e as bibliotecas de PDF trocadas por um substituto (`src/preview/pdf-stub.ts`).
- `demoStore.ts` (cerca de 2.750 linhas) implementa a mesma interface `Store` que `supabaseStore.ts` (cerca de 1.600 linhas).

## 11. Empresa e lojas fixas no código

O portal foi feito para uma empresa só; lojas e dados da empresa aparecem fixos em vários lugares
(contagens de ocorrências em 12/10/2026):

| O quê | Onde | Ocorrências |
| --- | --- | --- |
| Id de loja `burger-psd` | `src/` | 78 em 17 arquivos; 25 nas migrations |
| Id de loja `burger-va` | `src/` | 42 em 10 arquivos; 12 nas migrations |
| Id de loja `pizza` | `src/` | 26 em 7 arquivos; 12 nas migrations |
| `'central'` (Central de Produção) | `src/` | 24 em 7 arquivos; 56 nas migrations |
| Lojas com fechamento (`LOJAS_FECHAMENTO`) | `src/lib/types.ts` | lista fixa de 2 lojas |
| Razão social, CNPJ, IE e endereço das empresas | `src/lib/empresas.ts` | 3 CNPJs (cabeçalho de documentos) |
| CNPJs das empresas sem formatação | `src/lib/demoStore.ts` (5), `supabase/migrations/0044_financeiro_notas.sql` (3) | 8 |
| Nome/marca "The Ozzy" | `src/` | 59 em 28 arquivos; 16 nas migrations |
| Domínio dos logins `@portal.theozzy` | `supabaseStore.ts`, `criar-acesso`, `supabase/setup`, `supabase/teste` | 1 em `src/`, mais 1 na Edge Function |
| Cadastros da contabilidade (Eclética) | `src/` e migrations de dados | 86 em 13 arquivos; 144 nas migrations |
| Lojas e coordenadas | `0001_portal_funcionario.sql` (`insert into unidades`), `supabase/setup/local-das-lojas.sql` | 3 lojas |
| URL e chave pública do projeto de teste | `vite.config.ts` | 1 |
| Códigos das empresas no Lucro Fácil | `scripts/lucro/ROTINA.md` | 3 |
| Logo | `src/assets/logo.png` | 1 |

## 12. Lacunas conhecidas

- **Sem modelo de inquilino (tenant):** não há coluna de empresa nas tabelas; as lojas são linhas de `unidades` e várias
  regras dependem dos ids fixos acima. Replicar para outra empresa hoje exige outro projeto Supabase e mudanças no código.
- **Testes automatizados não estão no repositório** (nenhum arquivo `*.test.*`/`*.spec.*`, nenhum script de teste). Não há lint.
- **Restauração do backup nunca tinha sido testada** antes do `restore-test.yml` (primeira execução em 12/10/2026).
- **Arquivos do Storage fora do backup:** o `pg_dump` leva só as tabelas; os arquivos dos buckets não são copiados.
- **Retenção do backup:** 90 dias, só como artefato do GitHub Actions (sem cópia em outro lugar).
- **Edge Function sem deploy automático** e sem versão registrada além do código.
- **Primeiras migrations (até a 0027) aplicadas à mão**; `supabase/setup/` tem scripts manuais que podem divergir das migrations.
- **Migrations de dados** misturadas às de estrutura (geradas de planilhas), o que dificulta subir um banco limpo para outra empresa.
- **Vercel no plano Hobby** (uso não comercial pelos termos da Vercel; sem recursos de equipe).
- **Repositório público:** código, migrations (inclusive as de dados) e resumos das execuções dos workflows ficam visíveis
  publicamente; a visibilidade do repositório e dos artefatos precisa ser revista.
- Dependências sem `engines`/`.nvmrc`: a versão do Node não está fixada no projeto.
