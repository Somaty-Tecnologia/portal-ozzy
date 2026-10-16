# Cópia diária do Lucro Fácil para o portal

Roda como rotina agendada do Claude (todo dia de madrugada), com o conector do Lucro Fácil.
Só LEITURA no Lucro Fácil: nunca chamar ferramentas que criam, alteram ou apagam.

1. Clone `https://github.com/Somaty-Tecnologia/portal-ozzy` (se ainda não estiver no ambiente) e crie uma pasta de trabalho vazia, ex. `/tmp/lucro`.
2. Resultado do mês: `get-financial-summary` para as empresas 410, 411 e 412, mês atual (AAAA-MM, fuso de São Paulo).
   Nos dias 1 a 5 do mês, também o mês anterior (fecha os números).
   Salve cada resposta como veio em `/tmp/lucro/resultado-<empresa>-<AAAA-MM>.json`.
3. Fichas técnicas: NÃO copiar mais (Heitor, 10/10). As fichas agora são do portal (vindas da Eclética, migration 0070)
   e são editadas lá. Sem fichas no arquivo, a importação não mexe nas tabelas antigas do Lucro Fácil.
4. `node scripts/lucro/montar.mjs /tmp/lucro lucro.json`
5. Publique só o `lucro.json` no branch `dados-lucro`, num commit único (branch órfão, push forçado),
   para não acumular histórico de dados financeiros. Depois rode a importação:
   `gh workflow run importar-lucro.yml -R Somaty-Tecnologia/portal-ozzy --ref main`
   (o workflow fica no main e lê o arquivo do branch `dados-lucro`).
6. Confira em Actions se a importação ficou verde. Se algo falhar, diga o que falhou no resumo final.
