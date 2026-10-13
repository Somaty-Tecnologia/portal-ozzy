-- Refeições, parte 2 (Heitor, 13/10): a equipe participa do cardápio.
-- - Votação da semana: quem cozinha monta as opções e a votação abre no sábado para a semana seguinte.
--   Cada pessoa escolhe até N pratos e pode sugerir outro. Voto anônimo (a pessoa fica gravada só para não votar 2x).
--   Durante a votação só quem cozinha e a gestão veem a parcial; depois que fecha, todos veem o resultado.
-- - Fale com a cozinha: canal aberto e anônimo (elogio, crítica, sugestão), sem autor gravado e só com a data.
--   Quem cozinha e a gestão leem todos os recados.
-- - Orçamento por refeição: a gestão define a meta; quem cozinha vê a média da semana contra a meta e quanto sobra
--   para um prato mais caprichado.

create table refeicao_config (
  id boolean primary key default true check (id),
  meta_por_refeicao numeric(10, 2) check (meta_por_refeicao > 0),
  atualizado_em timestamptz not null default now()
);
insert into refeicao_config default values;
alter table refeicao_config enable row level security;
create policy "cozinha ve meta" on refeicao_config for select using ((select sou_cozinha()));
create policy "gestao muda meta" on refeicao_config for update using ((select sou_gestao())) with check ((select sou_gestao()));
grant select, update on refeicao_config to authenticated;

create table refeicao_votacoes (
  id uuid primary key default gen_random_uuid(),
  semana date not null unique, -- segunda-feira da semana votada
  abre_em date not null,
  fecha_em date not null,
  max_escolhas int not null default 3 check (max_escolhas between 1 and 10),
  observacao text,
  criado_por uuid default (eu()).id references funcionarios (id),
  criado_em timestamptz not null default now(),
  check (fecha_em >= abre_em)
);
alter table refeicao_votacoes enable row level security;
create policy "todos veem votacoes" on refeicao_votacoes for select using ((eu()).id is not null);
create policy "cozinha edita votacoes" on refeicao_votacoes for all using ((select sou_cozinha())) with check ((select sou_cozinha()));
grant select, insert, update, delete on refeicao_votacoes to authenticated;

create table refeicao_votacao_opcoes (
  id uuid primary key default gen_random_uuid(),
  votacao_id uuid not null references refeicao_votacoes (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  descricao text,
  modelo_id uuid references refeicao_modelos (id) on delete set null, -- para estimar o custo (só quem cozinha vê)
  ordem int not null default 0
);
create index on refeicao_votacao_opcoes (votacao_id);
alter table refeicao_votacao_opcoes enable row level security;
create policy "todos veem opcoes" on refeicao_votacao_opcoes for select using ((eu()).id is not null);
create policy "cozinha edita opcoes" on refeicao_votacao_opcoes for all using ((select sou_cozinha())) with check ((select sou_cozinha()));
grant select, insert, update, delete on refeicao_votacao_opcoes to authenticated;

create table refeicao_votacao_votos (
  opcao_id uuid not null references refeicao_votacao_opcoes (id) on delete cascade,
  votacao_id uuid not null references refeicao_votacoes (id) on delete cascade,
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  primary key (opcao_id, funcionario_id)
);
create index on refeicao_votacao_votos (votacao_id, funcionario_id);
-- Sem política: só pelas funções abaixo, que nunca devolvem quem votou.
alter table refeicao_votacao_votos enable row level security;
revoke all on refeicao_votacao_votos from authenticated, anon;

-- Recados anônimos: não guarda quem mandou, e só o dia (não a hora), para não dar para deduzir pela escala.
create table refeicao_recados (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('elogio', 'critica', 'sugestao')),
  texto text not null check (length(trim(texto)) between 1 and 1000),
  refeicao_id uuid references refeicoes (id) on delete set null,
  votacao_id uuid references refeicao_votacoes (id) on delete set null,
  data date not null default (now() at time zone 'America/Sao_Paulo')::date,
  lido_em timestamptz
);
create index on refeicao_recados (data desc);
alter table refeicao_recados enable row level security;
create policy "cozinha le recados" on refeicao_recados for select using ((select sou_cozinha()));
revoke all on refeicao_recados from authenticated, anon;
grant select on refeicao_recados to authenticated;

create function enviar_recado_refeicao(p_tipo text, p_texto text, p_refeicao uuid default null, p_votacao uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if (eu()).id is null then raise exception 'Entre no portal para mandar o recado.'; end if;
  if trim(coalesce(p_texto, '')) = '' then raise exception 'Escreva o recado.'; end if;
  insert into refeicao_recados (tipo, texto, refeicao_id, votacao_id) values (p_tipo, left(trim(p_texto), 1000), p_refeicao, p_votacao);
end $$;

create function marcar_recados_lidos(p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not sou_cozinha() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  update refeicao_recados set lido_em = now() where id = any (p_ids) and lido_em is null;
end $$;

-- Votar: troca as escolhas da pessoa. Só com a votação aberta (horário de São Paulo).
create function votar_cardapio(p_votacao uuid, p_opcoes uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_eu uuid := (eu()).id;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v refeicao_votacoes;
begin
  if v_eu is null then raise exception 'Entre no portal para votar.'; end if;
  select * into v from refeicao_votacoes where id = p_votacao;
  if v.id is null then raise exception 'Votação não encontrada.'; end if;
  if v_hoje < v.abre_em then raise exception 'A votação ainda não abriu.'; end if;
  if v_hoje > v.fecha_em then raise exception 'A votação já fechou.'; end if;
  if coalesce(array_length(p_opcoes, 1), 0) > v.max_escolhas then raise exception 'Escolha no máximo % pratos.', v.max_escolhas; end if;
  delete from refeicao_votacao_votos where votacao_id = v.id and funcionario_id = v_eu;
  insert into refeicao_votacao_votos (opcao_id, votacao_id, funcionario_id)
  select o.id, v.id, v_eu from refeicao_votacao_opcoes o where o.votacao_id = v.id and o.id = any (p_opcoes);
end $$;

-- Votos por opção (quem cozinha e a gestão sempre; os outros só depois que fecha), minhas escolhas
-- e quantas pessoas votaram. Nunca quem votou.
create function resultado_votacao(p_votacao uuid)
returns table (opcao_id uuid, votos int, minha boolean, participantes int)
language sql stable security definer set search_path = public as $$
  select o.id,
    case when sou_cozinha() or (now() at time zone 'America/Sao_Paulo')::date > v.fecha_em
      then (select count(*)::int from refeicao_votacao_votos x where x.opcao_id = o.id) end,
    exists (select 1 from refeicao_votacao_votos x where x.opcao_id = o.id and x.funcionario_id = (eu()).id),
    (select count(distinct x.funcionario_id)::int from refeicao_votacao_votos x where x.votacao_id = v.id)
  from refeicao_votacoes v join refeicao_votacao_opcoes o on o.votacao_id = v.id
  where (eu()).id is not null and v.id = p_votacao
$$;
