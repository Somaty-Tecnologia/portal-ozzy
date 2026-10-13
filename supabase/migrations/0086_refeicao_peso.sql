-- Heitor (13/10): peso total da comida pronta, preenchido no fim; o portal divide pelas pessoas (porção por pessoa).
-- Todos veem a porção junto com o prato.
alter table refeicoes add column peso_kg numeric(8, 3) check (peso_kg > 0);
grant select (peso_kg, pessoas) on refeicoes to authenticated;

create or replace function salvar_refeicao(p jsonb) returns uuid
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
    insert into refeicoes (data, centro_custo_id, prato, acompanhamentos, observacao, pessoas, itens, custo_total, peso_kg)
    values ((p->>'data')::date, p->>'centro_custo_id', nome_item(trim(p->>'prato')), nullif(trim(p->>'acompanhamentos'), ''), nullif(trim(p->>'observacao'), ''),
            nullif(p->>'pessoas', '')::int, v_itens, round(coalesce(v_total, 0), 2), nullif(p->>'peso_kg', '')::numeric)
    returning * into r;
  else
    update refeicoes set data = (p->>'data')::date, centro_custo_id = p->>'centro_custo_id', prato = nome_item(trim(p->>'prato')),
      acompanhamentos = nullif(trim(p->>'acompanhamentos'), ''), observacao = nullif(trim(p->>'observacao'), ''),
      pessoas = nullif(p->>'pessoas', '')::int, itens = v_itens, custo_total = round(coalesce(v_total, 0), 2),
      peso_kg = nullif(p->>'peso_kg', '')::numeric, atualizado_em = now()
    where id = v_id returning * into r;
    if r.id is null then raise exception 'Refeição não encontrada.'; end if;
    delete from estoque_movimentos where refeicao_id = r.id;
  end if;

  insert into estoque_movimentos (centro_custo_id, insumo_id, data, tipo, quantidade, custo_unit, observacao, refeicao_id)
  select r.centro_custo_id, (x->>'insumo_id')::uuid, r.data, 'saida', -(x->>'quantidade')::numeric, (x->>'custo_unit')::numeric,
         'Refeição da equipe: ' || r.prato, r.id
  from jsonb_array_elements(r.itens) x;

  -- Cada prato montado fica salvo para repetir (quantidade por pessoa); o mesmo nome atualiza com a última vez.
  if coalesce(r.pessoas, 0) > 0 and jsonb_array_length(r.itens) > 0 then
    insert into refeicao_modelos (nome, tipo, itens)
    select r.prato, 'prato', jsonb_agg(jsonb_build_object('nome', i.nome, 'quantidade', round((x->>'quantidade')::numeric / r.pessoas, 4),
             'unidade', i.unidade, 'insumo_id', i.id))
    from jsonb_array_elements(r.itens) x join insumos i on i.id = (x->>'insumo_id')::uuid
    on conflict ((lower(nome))) do update set itens = excluded.itens, ativo = true;
  end if;
  return r.id;
end $$;

