-- Refeição do dia (Heitor, 13/10): o manutencista também cuida das refeições da equipe.
-- - Todos veem a refeição do dia e dão joinha (positivo ou negativo) nas da semana. O voto é anônimo: nenhuma tela
--   e nenhuma consulta mostra quem votou; a pessoa só fica guardada para não votar duas vezes no mesmo prato.
-- - Quem cozinha (nível manutenção) e a gestão montam o prato com os insumos usados: dá baixa no estoque do local
--   e mostra o custo por refeição. Pratos padrão (fichas por pessoa) servem de base.
-- - Quem come no dia: equipe com turno naquele dia (sem folga, sem férias) + motoboys da escala. Freelancer não conta.

create function sou_cozinha() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(sou_gestao() or (eu()).nivel = 'manutencao', false)
$$;

-- Quem cozinha precisa ver os materiais para montar o prato.
create policy "cozinha ve insumos" on insumos for select using ((select sou_cozinha()));

-- Pratos padrão: ingredientes POR PESSOA, pelo nome (o portal liga ao material do cadastro na hora de usar).
create table refeicao_modelos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null default 'prato' check (tipo in ('prato', 'acompanhamento', 'salada')),
  modo_preparo text,
  itens jsonb not null default '[]', -- [{nome, quantidade, unidade, insumo_id?}] por pessoa
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index on refeicao_modelos (lower(nome));
alter table refeicao_modelos enable row level security;
create policy "cozinha ve pratos" on refeicao_modelos for select using ((select sou_cozinha()));
create policy "cozinha edita pratos" on refeicao_modelos for all using ((select sou_cozinha())) with check ((select sou_cozinha()));
grant select, insert, update on refeicao_modelos to authenticated;

create table refeicoes (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  centro_custo_id text not null references centros_custo (id),
  prato text not null check (length(trim(prato)) > 0),
  acompanhamentos text,
  observacao text,
  pessoas int check (pessoas > 0),
  itens jsonb not null default '[]', -- [{insumo_id, quantidade, custo_unit}] na unidade do material
  custo_total numeric(14, 2),
  criado_por uuid default (eu()).id references funcionarios (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (data, centro_custo_id)
);
alter table refeicoes enable row level security;
create policy "todos veem refeicoes" on refeicoes for select using ((eu()).id is not null);
-- Todo mundo vê o prato; ingredientes e custo só quem cozinha e a gestão (refeicoes_cozinha).
revoke select on refeicoes from authenticated, anon;
grant select (id, data, centro_custo_id, prato, acompanhamentos, observacao) on refeicoes to authenticated;

alter table estoque_movimentos add column refeicao_id uuid references refeicoes (id) on delete cascade;

create table refeicao_votos (
  refeicao_id uuid not null references refeicoes (id) on delete cascade,
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  voto smallint not null check (voto in (-1, 1)),
  primary key (refeicao_id, funcionario_id)
);
-- Sem política nenhuma: ninguém lê nem grava direto, só pelas funções abaixo.
alter table refeicao_votos enable row level security;
revoke all on refeicao_votos from authenticated, anon;

create function refeicoes_cozinha(p_de date, p_ate date) returns setof refeicoes
language sql stable security definer set search_path = public as $$
  select * from refeicoes where sou_cozinha() and data between p_de and p_ate order by data, centro_custo_id
$$;

-- Salva (cria ou troca) a refeição e refaz a baixa dos ingredientes no estoque do local.
create function salvar_refeicao(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_itens jsonb;
  v_total numeric;
  r refeicoes;
begin
  if not sou_cozinha() then raise exception 'Só quem cuida das refeições e a gestão montam o prato.'; end if;
  if trim(coalesce(p->>'prato', '')) = '' then raise exception 'Coloque o nome do prato.'; end if;
  if not exists (select 1 from centros_custo where id = p->>'centro_custo_id') then raise exception 'Escolha o local.'; end if;

  -- Ingredientes com o preço de hoje do material.
  select coalesce(jsonb_agg(jsonb_build_object('insumo_id', i.id, 'quantidade', round((x->>'quantidade')::numeric, 4), 'custo_unit', i.preco)), '[]'),
         sum(round((x->>'quantidade')::numeric, 4) * coalesce(i.preco, 0))
  into v_itens, v_total
  from jsonb_array_elements(coalesce(p->'itens', '[]')) x
  join insumos i on i.id = (x->>'insumo_id')::uuid
  where (x->>'quantidade') ~ '^\d+(\.\d+)?$' and (x->>'quantidade')::numeric > 0;

  if v_id is null then
    insert into refeicoes (data, centro_custo_id, prato, acompanhamentos, observacao, pessoas, itens, custo_total)
    values ((p->>'data')::date, p->>'centro_custo_id', nome_item(trim(p->>'prato')), nullif(trim(p->>'acompanhamentos'), ''), nullif(trim(p->>'observacao'), ''),
            nullif(p->>'pessoas', '')::int, v_itens, round(coalesce(v_total, 0), 2))
    returning * into r;
  else
    update refeicoes set data = (p->>'data')::date, centro_custo_id = p->>'centro_custo_id', prato = nome_item(trim(p->>'prato')),
      acompanhamentos = nullif(trim(p->>'acompanhamentos'), ''), observacao = nullif(trim(p->>'observacao'), ''),
      pessoas = nullif(p->>'pessoas', '')::int, itens = v_itens, custo_total = round(coalesce(v_total, 0), 2), atualizado_em = now()
    where id = v_id returning * into r;
    if r.id is null then raise exception 'Refeição não encontrada.'; end if;
    delete from estoque_movimentos where refeicao_id = r.id;
  end if;

  insert into estoque_movimentos (centro_custo_id, insumo_id, data, tipo, quantidade, custo_unit, observacao, refeicao_id)
  select r.centro_custo_id, (x->>'insumo_id')::uuid, r.data, 'saida', -(x->>'quantidade')::numeric, (x->>'custo_unit')::numeric,
         'Refeição da equipe: ' || r.prato, r.id
  from jsonb_array_elements(r.itens) x;
  return r.id;
end $$;

create function excluir_refeicao(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not sou_cozinha() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  delete from refeicoes where id = p_id; -- a baixa no estoque sai junto (cascade)
end $$;

-- Joinha: 1, -1 ou 0 (tira o voto). Só refeições dos últimos 7 dias.
create function votar_refeicao(p_id uuid, p_voto int) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_eu uuid := (eu()).id;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if v_eu is null then raise exception 'Entre no portal para votar.'; end if;
  if not exists (select 1 from refeicoes where id = p_id and data between v_hoje - 7 and v_hoje) then
    raise exception 'Só dá para avaliar as refeições da última semana.';
  end if;
  if p_voto = 0 then
    delete from refeicao_votos where refeicao_id = p_id and funcionario_id = v_eu;
  elsif p_voto in (-1, 1) then
    insert into refeicao_votos (refeicao_id, funcionario_id, voto) values (p_id, v_eu, p_voto)
    on conflict (refeicao_id, funcionario_id) do update set voto = excluded.voto;
  else
    raise exception 'Voto inválido.';
  end if;
end $$;

-- Totais de cada refeição (só para quem cozinha e a gestão) e o voto da própria pessoa. Nunca quem votou.
create function votos_refeicoes(p_de date, p_ate date)
returns table (refeicao_id uuid, positivos int, negativos int, meu_voto int)
language sql stable security definer set search_path = public as $$
  select r.id,
    case when sou_cozinha() then (select count(*)::int from refeicao_votos v where v.refeicao_id = r.id and v.voto = 1) end,
    case when sou_cozinha() then (select count(*)::int from refeicao_votos v where v.refeicao_id = r.id and v.voto = -1) end,
    (select v.voto::int from refeicao_votos v where v.refeicao_id = r.id and v.funcionario_id = (eu()).id)
  from refeicoes r
  where (eu()).id is not null and r.data between p_de and p_ate
$$;

-- Quem trabalha no dia: equipe ativa com horário no turno naquele dia da semana (ou marcada para trabalhar),
-- sem folga e sem férias; e os motoboys da escala. Freelancer fica de fora.
create function quem_come(p_data date) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  v_dia int := (extract(isodow from p_data)::int - 1); -- 0 = segunda
  v_equipe json;
  v_motos json;
begin
  if not sou_cozinha() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  select coalesce(json_agg(json_build_object('id', f.id, 'nome', f.nome, 'local', coalesce(t.local, f.unidade_id), 'unidadeId', f.unidade_id,
    'turno', t.nome, 'horario', t.dias -> v_dia) order by coalesce(t.local, f.unidade_id), f.nome), '[]')
  into v_equipe
  from funcionarios f
  left join turnos t on t.id = f.turno_id
  left join folgas g on g.funcionario_id = f.id and g.data = p_data
  where f.status = 'ativo' and f.nivel <> 'proprietario' and f.data_admissao <= p_data
    and (
      (g.tipo = 'trabalha')
      or (g.id is null and t.id is not null and jsonb_typeof(t.dias -> v_dia) = 'object')
    )
    and not exists (select 1 from ferias fe where fe.funcionario_id = f.id and p_data between fe.inicio and fe.inicio + fe.dias - 1);

  select coalesce(json_agg(json_build_object('id', m.id, 'nome', m.nome, 'local', e.unidade_id) order by e.unidade_id, m.nome), '[]')
  into v_motos
  from motoboy_escala e join motoboys m on m.id = e.motoboy_id
  where e.data = p_data and m.ativo;

  return json_build_object('equipe', v_equipe, 'motoboys', v_motos);
end $$;

revoke execute on function refeicoes_cozinha(date, date), salvar_refeicao(jsonb), excluir_refeicao(uuid), votar_refeicao(uuid, int),
  votos_refeicoes(date, date), quem_come(date), sou_cozinha() from public, anon;
grant execute on function refeicoes_cozinha(date, date), salvar_refeicao(jsonb), excluir_refeicao(uuid), votar_refeicao(uuid, int),
  votos_refeicoes(date, date), quem_come(date), sou_cozinha() to authenticated;

-- Pratos padrão de comida brasileira, por pessoa (adulto que trabalha o dia todo). Ajustáveis na tela.
insert into refeicao_modelos (nome, tipo, modo_preparo, itens) values
('Arroz branco', 'acompanhamento', 'Refogue o alho no óleo, junte o arroz e o sal, mexa 1 minuto e cubra com o dobro de água fervente. Fogo baixo, tampado, até secar (cerca de 20 min).',
  '[{"nome":"Arroz","quantidade":0.08,"unidade":"kg"},{"nome":"Óleo","quantidade":0.005,"unidade":"l"},{"nome":"Alho","quantidade":0.002,"unidade":"kg"},{"nome":"Sal","quantidade":0.001,"unidade":"kg"}]'),
('Feijão carioca', 'acompanhamento', 'Deixe o feijão de molho na véspera. Cozinhe na pressão por 25 min. Refogue bacon, cebola e alho, junte uma concha do feijão amassado, volte para a panela e acerte o sal.',
  '[{"nome":"Feijão carioca","quantidade":0.06,"unidade":"kg"},{"nome":"Bacon","quantidade":0.01,"unidade":"kg"},{"nome":"Cebola","quantidade":0.01,"unidade":"kg"},{"nome":"Alho","quantidade":0.002,"unidade":"kg"},{"nome":"Óleo","quantidade":0.003,"unidade":"l"},{"nome":"Sal","quantidade":0.001,"unidade":"kg"}]'),
('Escondidinho de carne moída', 'prato', 'Cozinhe a batata e amasse com leite, manteiga e sal (purê firme). Refogue cebola e alho, doure a carne moída, junte o molho de tomate e acerte o sal. Numa assadeira: carne embaixo, purê por cima e mussarela. Forno a 200 °C até gratinar.',
  '[{"nome":"Carne moída","quantidade":0.15,"unidade":"kg"},{"nome":"Batata","quantidade":0.25,"unidade":"kg"},{"nome":"Leite","quantidade":0.05,"unidade":"l"},{"nome":"Manteiga","quantidade":0.01,"unidade":"kg"},{"nome":"Cebola","quantidade":0.02,"unidade":"kg"},{"nome":"Alho","quantidade":0.003,"unidade":"kg"},{"nome":"Molho de tomate","quantidade":0.03,"unidade":"kg"},{"nome":"Mussarela","quantidade":0.03,"unidade":"kg"},{"nome":"Sal","quantidade":0.002,"unidade":"kg"}]'),
('Frango grelhado', 'prato', 'Tempere os filés com alho, limão e sal (30 min). Grelhe na chapa bem quente com um fio de óleo, 4 a 5 min de cada lado.',
  '[{"nome":"Peito de frango","quantidade":0.18,"unidade":"kg"},{"nome":"Alho","quantidade":0.003,"unidade":"kg"},{"nome":"Limão","quantidade":0.2,"unidade":"un"},{"nome":"Óleo","quantidade":0.005,"unidade":"l"},{"nome":"Sal","quantidade":0.002,"unidade":"kg"}]'),
('Strogonoff de frango', 'prato', 'Corte o frango em cubos e doure. Junte cebola e alho, depois o molho de tomate e o ketchup. Desligue o fogo e misture o creme de leite. Sirva com batata palha.',
  '[{"nome":"Peito de frango","quantidade":0.15,"unidade":"kg"},{"nome":"Creme de leite","quantidade":0.05,"unidade":"kg"},{"nome":"Molho de tomate","quantidade":0.03,"unidade":"kg"},{"nome":"Ketchup","quantidade":0.01,"unidade":"kg"},{"nome":"Cebola","quantidade":0.02,"unidade":"kg"},{"nome":"Alho","quantidade":0.002,"unidade":"kg"},{"nome":"Batata palha","quantidade":0.03,"unidade":"kg"},{"nome":"Sal","quantidade":0.002,"unidade":"kg"}]'),
('Bife acebolado', 'prato', 'Tempere os bifes com sal e alho. Frite na chapa bem quente, 2 min de cada lado. Na mesma chapa, doure a cebola em rodelas e cubra os bifes.',
  '[{"nome":"Bife","quantidade":0.16,"unidade":"kg"},{"nome":"Cebola","quantidade":0.06,"unidade":"kg"},{"nome":"Alho","quantidade":0.002,"unidade":"kg"},{"nome":"Óleo","quantidade":0.008,"unidade":"l"},{"nome":"Sal","quantidade":0.002,"unidade":"kg"}]'),
('Frango assado (coxa e sobrecoxa)', 'prato', 'Tempere com alho, limão, sal e páprica de véspera. Asse coberto com papel-alumínio a 200 °C por 40 min e mais 20 min descoberto para dourar.',
  '[{"nome":"Coxa e sobrecoxa","quantidade":0.3,"unidade":"kg"},{"nome":"Alho","quantidade":0.004,"unidade":"kg"},{"nome":"Limão","quantidade":0.25,"unidade":"un"},{"nome":"Páprica","quantidade":0.001,"unidade":"kg"},{"nome":"Sal","quantidade":0.003,"unidade":"kg"}]'),
('Carne de panela com batata', 'prato', 'Corte o acém em cubos e doure aos poucos. Junte cebola, alho e molho de tomate, cubra com água e cozinhe na pressão por 35 min. Junte batata e cenoura e cozinhe mais 10 min.',
  '[{"nome":"Acém","quantidade":0.18,"unidade":"kg"},{"nome":"Batata","quantidade":0.12,"unidade":"kg"},{"nome":"Cenoura","quantidade":0.05,"unidade":"kg"},{"nome":"Cebola","quantidade":0.03,"unidade":"kg"},{"nome":"Alho","quantidade":0.003,"unidade":"kg"},{"nome":"Molho de tomate","quantidade":0.03,"unidade":"kg"},{"nome":"Óleo","quantidade":0.005,"unidade":"l"},{"nome":"Sal","quantidade":0.002,"unidade":"kg"}]'),
('Feijoada simples', 'prato', 'Deixe o feijão preto de molho. Cozinhe na pressão com a costelinha por 30 min. Doure bacon e calabresa, junte cebola e alho e volte tudo para a panela por mais 15 min. Sirva com couve refogada e farofa.',
  '[{"nome":"Feijão preto","quantidade":0.08,"unidade":"kg"},{"nome":"Costelinha suína","quantidade":0.06,"unidade":"kg"},{"nome":"Linguiça calabresa","quantidade":0.06,"unidade":"kg"},{"nome":"Bacon","quantidade":0.02,"unidade":"kg"},{"nome":"Cebola","quantidade":0.02,"unidade":"kg"},{"nome":"Alho","quantidade":0.004,"unidade":"kg"},{"nome":"Couve","quantidade":0.03,"unidade":"kg"},{"nome":"Sal","quantidade":0.001,"unidade":"kg"}]'),
('Macarrão à bolonhesa', 'prato', 'Cozinhe o macarrão em água com sal até ficar al dente. Refogue cebola e alho, doure a carne moída, junte o molho de tomate e deixe apurar 10 min. Misture e finalize com queijo ralado.',
  '[{"nome":"Macarrão","quantidade":0.12,"unidade":"kg"},{"nome":"Carne moída","quantidade":0.1,"unidade":"kg"},{"nome":"Molho de tomate","quantidade":0.08,"unidade":"kg"},{"nome":"Cebola","quantidade":0.02,"unidade":"kg"},{"nome":"Alho","quantidade":0.003,"unidade":"kg"},{"nome":"Queijo ralado","quantidade":0.01,"unidade":"kg"},{"nome":"Sal","quantidade":0.002,"unidade":"kg"}]'),
('Linguiça toscana acebolada', 'prato', 'Corte a linguiça em rodelas e doure na frigideira sem óleo. Junte a cebola em tiras e refogue até murchar.',
  '[{"nome":"Linguiça toscana","quantidade":0.16,"unidade":"kg"},{"nome":"Cebola","quantidade":0.05,"unidade":"kg"}]'),
('Peixe empanado', 'prato', 'Tempere os filés com sal e limão. Passe na farinha de trigo, no ovo batido e na farinha de rosca. Frite em óleo quente ou asse a 220 °C por 20 min.',
  '[{"nome":"Filé de tilápia","quantidade":0.18,"unidade":"kg"},{"nome":"Farinha de trigo","quantidade":0.02,"unidade":"kg"},{"nome":"Ovo","quantidade":0.3,"unidade":"un"},{"nome":"Farinha de rosca","quantidade":0.02,"unidade":"kg"},{"nome":"Limão","quantidade":0.2,"unidade":"un"},{"nome":"Óleo","quantidade":0.03,"unidade":"l"},{"nome":"Sal","quantidade":0.002,"unidade":"kg"}]'),
('Omelete', 'prato', 'Bata os ovos com sal, junte tomate, cebola e queijo picados. Frite em frigideira untada, dobrando ao meio.',
  '[{"nome":"Ovo","quantidade":3,"unidade":"un"},{"nome":"Mussarela","quantidade":0.03,"unidade":"kg"},{"nome":"Tomate","quantidade":0.04,"unidade":"kg"},{"nome":"Cebola","quantidade":0.02,"unidade":"kg"},{"nome":"Óleo","quantidade":0.005,"unidade":"l"},{"nome":"Sal","quantidade":0.001,"unidade":"kg"}]'),
('Purê de batata', 'acompanhamento', 'Cozinhe a batata descascada em água com sal até ficar macia. Amasse ainda quente e misture leite e manteiga no fogo baixo.',
  '[{"nome":"Batata","quantidade":0.2,"unidade":"kg"},{"nome":"Leite","quantidade":0.04,"unidade":"l"},{"nome":"Manteiga","quantidade":0.01,"unidade":"kg"},{"nome":"Sal","quantidade":0.002,"unidade":"kg"}]'),
('Farofa', 'acompanhamento', 'Doure o bacon, junte manteiga e cebola. Acrescente a farinha de mandioca aos poucos, mexendo até dourar.',
  '[{"nome":"Farinha de mandioca","quantidade":0.03,"unidade":"kg"},{"nome":"Manteiga","quantidade":0.008,"unidade":"kg"},{"nome":"Bacon","quantidade":0.01,"unidade":"kg"},{"nome":"Cebola","quantidade":0.01,"unidade":"kg"},{"nome":"Sal","quantidade":0.001,"unidade":"kg"}]'),
('Legumes refogados', 'acompanhamento', 'Corte cenoura, abobrinha e brócolis em pedaços parecidos. Refogue a cenoura primeiro no alho e óleo, depois os outros, até ficarem macios mas firmes.',
  '[{"nome":"Cenoura","quantidade":0.05,"unidade":"kg"},{"nome":"Abobrinha","quantidade":0.05,"unidade":"kg"},{"nome":"Brócolis","quantidade":0.05,"unidade":"kg"},{"nome":"Alho","quantidade":0.002,"unidade":"kg"},{"nome":"Óleo","quantidade":0.005,"unidade":"l"},{"nome":"Sal","quantidade":0.001,"unidade":"kg"}]'),
('Salada verde', 'salada', 'Lave bem as folhas e os tomates. Tempere na hora de servir com óleo, vinagre e sal (ou deixe o tempero à parte).',
  '[{"nome":"Alface","quantidade":0.04,"unidade":"kg"},{"nome":"Tomate","quantidade":0.05,"unidade":"kg"},{"nome":"Cebola","quantidade":0.01,"unidade":"kg"},{"nome":"Vinagre","quantidade":0.005,"unidade":"l"},{"nome":"Óleo","quantidade":0.005,"unidade":"l"},{"nome":"Sal","quantidade":0.001,"unidade":"kg"}]');
