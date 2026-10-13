-- Pré-preparo das refeições (Heitor, 13/10): feijão, arroz e afins são feitos à parte, com os ingredientes deles,
-- e depois entram nos pratos. Quem cozinha cadastra o preparo (ingredientes e quanto rende), lança cada vez que faz
-- (sai dos ingredientes e entra o preparo pronto no estoque da Central, com o custo) e usa o preparo pronto como
-- ingrediente em "Montar o prato".
-- O item de estoque do preparo pronto é criado sozinho ("<nome> (refeição)"); a cozinha não cria outros materiais.

create table refeicao_preparos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  unidade text not null default 'kg',
  rendimento numeric(14, 4) not null check (rendimento > 0), -- quanto a receita base rende, na unidade
  itens jsonb not null default '[]', -- [{insumo_id, quantidade}] da receita base, na unidade de cada material
  modo_preparo text,
  insumo_id uuid references insumos (id),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index on refeicao_preparos (lower(nome));
alter table refeicao_preparos enable row level security;
create policy "cozinha ve preparos" on refeicao_preparos for select using ((select sou_cozinha()));
grant select on refeicao_preparos to authenticated;

alter table producoes add column refeicao_preparo_id uuid references refeicao_preparos (id);
create policy "cozinha ve producao de refeicao" on producoes for select using (refeicao_preparo_id is not null and (select sou_cozinha()));

-- Cria ou altera o preparo e o item de estoque dele.
create function salvar_preparo_refeicao(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_nome text := nome_item(trim(coalesce(p->>'nome', '')));
  v_un text := coalesce(nullif(trim(p->>'unidade'), ''), 'kg');
  v_ins uuid;
  v_itens jsonb;
begin
  if not sou_cozinha() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  if v_nome = '' then raise exception 'Coloque o nome do preparo.'; end if;
  if coalesce((p->>'rendimento')::numeric, 0) <= 0 then raise exception 'Diga quanto a receita rende.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('insumo_id', i.id, 'quantidade', round((x->>'quantidade')::numeric, 4))), '[]')
  into v_itens
  from jsonb_array_elements(coalesce(p->'itens', '[]')) x
  join insumos i on i.id = (x->>'insumo_id')::uuid
  where (x->>'quantidade') ~ '^\d+(\.\d+)?$' and (x->>'quantidade')::numeric > 0;
  if jsonb_array_length(v_itens) = 0 then raise exception 'Coloque os ingredientes.'; end if;

  if v_id is not null then select insumo_id into v_ins from refeicao_preparos where id = v_id; end if;
  if v_ins is null then
    insert into insumos (nome, categoria, unidade, observacao, ativo, pre_preparo)
    values (v_nome || ' (refeição)', 'Pré-preparos', v_un, 'Pré-preparo das refeições da equipe (criado sozinho).', true, true)
    returning id into v_ins;
  else
    update insumos set nome = v_nome || ' (refeição)', unidade = v_un, ativo = coalesce((p->>'ativo')::boolean, true) where id = v_ins;
  end if;

  if v_id is null then
    insert into refeicao_preparos (nome, unidade, rendimento, itens, modo_preparo, insumo_id)
    values (v_nome, v_un, (p->>'rendimento')::numeric, v_itens, nullif(trim(p->>'modo_preparo'), ''), v_ins)
    returning id into v_id;
  else
    update refeicao_preparos set nome = v_nome, unidade = v_un, rendimento = (p->>'rendimento')::numeric, itens = v_itens,
      modo_preparo = nullif(trim(p->>'modo_preparo'), ''), insumo_id = v_ins, ativo = coalesce((p->>'ativo')::boolean, true)
    where id = v_id;
  end if;
  return v_id;
end $$;

-- Fez o preparo: baixa dos ingredientes e entrada do pronto no estoque da Central, com o custo do dia.
-- p_saidas: [{insumo_id, quantidade}] (a tela calcula pela receita e deixa ajustar).
create function lancar_preparo_refeicao(p_preparo uuid, p_data date, p_quantidade numeric, p_saidas jsonb, p_obs text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  r refeicao_preparos;
  v_custo numeric := 0;
  v_id uuid;
begin
  if not sou_cozinha() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  select * into r from refeicao_preparos where id = p_preparo;
  if r.id is null or r.insumo_id is null then raise exception 'Preparo não encontrado.'; end if;
  if coalesce(p_quantidade, 0) <= 0 then raise exception 'Diga quanto ficou pronto.'; end if;

  select coalesce(sum((x->>'quantidade')::numeric * coalesce(i.preco, 0)), 0) into v_custo
  from jsonb_array_elements(coalesce(p_saidas, '[]')) x join insumos i on i.id = (x->>'insumo_id')::uuid
  where coalesce((x->>'quantidade')::numeric, 0) > 0 and i.id <> r.insumo_id;

  insert into producoes (centro_custo_id, data, insumo_id, quantidade, custo_total, observacao, refeicao_preparo_id)
  values ('central', p_data, r.insumo_id, p_quantidade, round(v_custo, 4), nullif(trim(p_obs), ''), r.id)
  returning id into v_id;

  insert into estoque_movimentos (centro_custo_id, insumo_id, data, tipo, quantidade, custo_unit, observacao, producao_id)
  select 'central', (x->>'insumo_id')::uuid, p_data, 'saida', -(x->>'quantidade')::numeric, null, 'Pré-preparo da refeição: ' || r.nome, v_id
  from jsonb_array_elements(coalesce(p_saidas, '[]')) x
  where coalesce((x->>'quantidade')::numeric, 0) > 0 and (x->>'insumo_id')::uuid <> r.insumo_id;

  insert into estoque_movimentos (centro_custo_id, insumo_id, data, tipo, quantidade, custo_unit, observacao, producao_id)
  values ('central', r.insumo_id, p_data, 'entrada', p_quantidade, case when v_custo > 0 then round(v_custo / p_quantidade, 6) end,
    'Pré-preparo da refeição' || coalesce(' · ' || nullif(trim(p_obs), ''), ''), v_id);

  if v_custo > 0 then update insumos set preco = round(v_custo / p_quantidade, 4), preco_em = now() where id = r.insumo_id; end if;
  return v_id;
end $$;

create function desfazer_preparo_refeicao(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not sou_cozinha() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  delete from producoes where id = p_id and refeicao_preparo_id is not null;
end $$;

-- Peso de cada item pronto (Heitor, 13/10): arroz, feijão, a carne… pesados separados depois de prontos.
-- O peso total continua sendo a soma, e todos veem a porção de cada item por pessoa.
alter table refeicoes add column pesos jsonb not null default '[]'; -- [{nome, kg}]
grant select (pesos) on refeicoes to authenticated;

create function salvar_pesos_refeicao(p_id uuid, p_pesos jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v jsonb;
begin
  if not sou_cozinha() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('nome', trim(x->>'nome'), 'kg', round((x->>'kg')::numeric, 3))), '[]') into v
  from jsonb_array_elements(coalesce(p_pesos, '[]')) x
  where trim(coalesce(x->>'nome', '')) <> '' and (x->>'kg') ~ '^\d+(\.\d+)?$' and (x->>'kg')::numeric > 0;
  update refeicoes set pesos = v,
    peso_kg = case when jsonb_array_length(v) > 0 then (select sum((y->>'kg')::numeric) from jsonb_array_elements(v) y) else peso_kg end
  where id = p_id;
end $$;
