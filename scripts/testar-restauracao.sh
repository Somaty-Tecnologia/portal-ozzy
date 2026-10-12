#!/usr/bin/env bash
# Teste de restauração do backup (usado por .github/workflows/restore-test.yml).
# Restaura um backup do pg_dump (portal-AAAA-MM-DD.sql.gz) num Postgres DESCARTÁVEL e confere se os dados estão lá.
# Nunca aponte isto para o banco real: o script apaga e recria o banco "restauracao".
#
# Uso: PSQL="psql -h localhost -U postgres" scripts/testar-restauracao.sh <backup.sql.gz> [pasta das migrations]
# Escreve o resumo em $GITHUB_STEP_SUMMARY (ou na tela). Sai com erro só quando faltam dados de verdade.
set -uo pipefail

DUMP=${1:?informe o arquivo .sql.gz}
MIG=${2:-supabase/migrations}
PSQL=${PSQL:-psql}
RESUMO=${GITHUB_STEP_SUMMARY:-/dev/stdout}
DB=restauracao
TMP=$(mktemp -d)
falhas=0
avisos=0

q() { $PSQL -d "$DB" -v ON_ERROR_STOP=1 -At -c "$1"; }
falha() { echo "::error title=Restauração::$1"; echo "- ❌ $1" >> "$TMP/itens"; falhas=$((falhas + 1)); }
aviso() { echo "::warning title=Restauração::$1"; echo "- ⚠️ $1" >> "$TMP/itens"; avisos=$((avisos + 1)); }
ok() { echo "- ✅ $1" >> "$TMP/itens"; }
: > "$TMP/itens"

# 1) Banco vazio, com os papéis e o schema de extensões que o Supabase tem e o Postgres puro não.
$PSQL -d postgres -v ON_ERROR_STOP=1 -q -c "drop database if exists $DB" -c "create database $DB" || exit 1
$PSQL -d "$DB" -v ON_ERROR_STOP=1 -q <<'SQL' || exit 1
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role', 'authenticator', 'supabase_admin',
    'supabase_auth_admin', 'supabase_storage_admin', 'dashboard_user', 'supabase_realtime_admin',
    'supabase_replication_admin', 'supabase_read_only_user', 'pgbouncer'] loop
    if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I nologin', r); end if;
  end loop;
end $$;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
SQL

# 2) Restaura. Erros de objetos do próprio Supabase (extensões, publicações, gatilhos internos) são esperados
#    e não param a restauração; o que importa é conferido depois, nos dados.
inicio=$(date +%s)
gunzip -c "$DUMP" | $PSQL -d "$DB" -q > /dev/null 2> "$TMP/erros.txt"
duracao=$(( $(date +%s) - inicio ))
n_erros=$(grep -c 'ERROR:' "$TMP/erros.txt" || true)

# 3) Conferências.
tabelas=$(q "select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'")
if [ "${tabelas:-0}" -gt 0 ]; then ok "$tabelas tabelas no schema public"; else falha "nenhuma tabela restaurada no schema public"; fi

# Tabelas que as migrations criam e que não vieram no backup.
grep -hoiE "create table (if not exists )?(public\.)?[a-z_0-9]+" "$MIG"/*.sql | sed -E 's/.* //; s/public\.//' | sort -u > "$TMP/esperadas"
q "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'" | sort -u > "$TMP/restauradas"
faltando=$(comm -23 "$TMP/esperadas" "$TMP/restauradas" | tr '\n' ' ')
if [ -z "$faltando" ]; then ok "todas as $(wc -l < "$TMP/esperadas") tabelas criadas pelas migrations estão no backup"
else aviso "tabelas das migrations que não estão no backup: $faltando"; fi

# Contagem de linhas. As obrigatórias não podem estar vazias (têm dados desde as primeiras migrations).
OBRIGATORIAS="unidades funcionarios insumos receitas"
OUTRAS="fornecedores contas_pagar estoque_movimentos notas_fiscais eventos comunicados"
{
  echo "| Tabela | Linhas |"
  echo "| --- | ---: |"
} > "$TMP/contagens"
for t in $OBRIGATORIAS $OUTRAS; do
  existe=$(q "select to_regclass('public.$t') is not null")
  if [ "$existe" != "t" ]; then
    echo "| $t | (não existe) |" >> "$TMP/contagens"
    falha "tabela $t não foi restaurada"
    continue
  fi
  n=$(q "select count(*) from public.$t")
  echo "| $t | $n |" >> "$TMP/contagens"
  if [ "$n" = "0" ] && echo " $OBRIGATORIAS " | grep -q " $t "; then falha "tabela $t está vazia no backup"; fi
done
usuarios=$(q "select count(*) from auth.users" 2>/dev/null || echo "?")
echo "| auth.users (logins) | $usuarios |" >> "$TMP/contagens"
if [ "$usuarios" = "?" ] || [ "$usuarios" = "0" ]; then aviso "logins (auth.users) não vieram no backup"; fi

# A última migration registrada no backup deve ser a última do repositório.
ultima_repo=$(ls "$MIG"/*.sql | sort | tail -1 | xargs basename | sed 's/\.sql$//')
ultima_bkp=$(q "select max(nome) from public._migracoes" 2>/dev/null || echo "")
if [ -z "$ultima_bkp" ]; then aviso "tabela _migracoes não está no backup"
elif [ "$ultima_bkp" = "$ultima_repo" ]; then ok "migrations em dia: $ultima_bkp"
elif [[ "$ultima_bkp" < "$ultima_repo" ]]; then aviso "backup está na migration $ultima_bkp; o repositório já tem $ultima_repo (normal se a migration é mais nova que o backup)"
else aviso "backup tem migration $ultima_bkp, mais nova que a do repositório ($ultima_repo)"; fi

# Idade do backup, pelo nome do arquivo.
data_bkp=$(basename "$DUMP" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' || true)
if [ -n "$data_bkp" ]; then
  dias=$(( ( $(date -u +%s) - $(date -u -d "$data_bkp" +%s) ) / 86400 ))
  if [ "$dias" -gt 3 ]; then aviso "o backup mais recente é de $data_bkp ($dias dias atrás)"; else ok "backup de $data_bkp"; fi
fi

# 4) Resumo. Os erros aparecem só pelo tipo, com os valores entre aspas escondidos (não expor dados no log).
{
  echo "## Teste de restauração do backup"
  echo
  echo "Arquivo: \`$(basename "$DUMP")\` ($(du -h "$DUMP" | cut -f1) compactado) · restaurado em ${duracao}s num Postgres descartável."
  echo
  cat "$TMP/itens"
  echo
  cat "$TMP/contagens"
  echo
  echo "Erros durante a restauração: $n_erros (objetos internos do Supabase costumam dar erro aqui e não afetam os dados)."
  if [ "$n_erros" -gt 0 ]; then
    echo
    echo '```'
    grep 'ERROR:' "$TMP/erros.txt" | sed -E 's/^.*ERROR: +//; s/"[^"]*"/"…"/g' | cut -c1-160 | sort | uniq -c | sort -rn | head -20
    echo '```'
  fi
  echo
  if [ $falhas -gt 0 ]; then echo "**Resultado: FALHOU** ($falhas problema(s), $avisos aviso(s))."
  else echo "**Resultado: OK** ($avisos aviso(s))."; fi
} >> "$RESUMO"

rm -rf "$TMP"
[ $falhas -eq 0 ]
