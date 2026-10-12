-- Inventário semanal (Heitor, 12/10): toda segunda cada loja conta o estoque de todos os materiais ativos (pode ser
-- falando). A contagem fica guardada com o saldo que o sistema tinha, e a diferença vira ajuste no estoque daquela loja.
-- Enviar de novo no mesmo dia substitui a contagem e os ajustes dela.

create table inventarios_estoque (
  id uuid primary key default gen_random_uuid(),
  centro_custo_id text not null references centros_custo (id),
  data date not null,
  responsavel text,
  observacao text,
  fala text,
  enviado_por uuid references funcionarios (id) default (eu()).id,
  enviado_em timestamptz not null default now(),
  unique (centro_custo_id, data)
);
create table inventario_estoque_itens (
  inventario_id uuid not null references inventarios_estoque (id) on delete cascade,
  insumo_id uuid not null references insumos (id),
  quantidade numeric(14, 4) not null check (quantidade >= 0),
  saldo_sistema numeric(14, 4) not null,
  custo_unit numeric(14, 6),
  primary key (inventario_id, insumo_id)
);
alter table estoque_movimentos add column inventario_id uuid references inventarios_estoque (id) on delete cascade;
create index on estoque_movimentos (inventario_id) where inventario_id is not null;

alter table inventarios_estoque enable row level security;
alter table inventario_estoque_itens enable row level security;
create policy "ve inventarios" on inventarios_estoque for select
  using ((select sou_gestao()) or (select sou_producao()) or centro_custo_id = (select (eu()).unidade_id));
create policy "ve itens do inventario" on inventario_estoque_itens for select
  using (exists (select 1 from inventarios_estoque v where v.id = inventario_id));
grant select on inventarios_estoque, inventario_estoque_itens to authenticated;

-- p_itens: [{insumo_id, quantidade}]. Só os itens contados entram; o que ficou em branco não mexe no estoque.
create function enviar_inventario(p_centro text, p_data date, p_responsavel text, p_obs text, p_fala text, p_itens jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not coalesce((select sou_gestao()) or (select sou_producao()) or p_centro = (eu()).unidade_id, false) then
    raise exception 'Seu nível de acesso não permite esta ação.';
  end if;
  insert into inventarios_estoque (centro_custo_id, data, responsavel, observacao, fala)
  values (p_centro, p_data, nullif(trim(p_responsavel), ''), nullif(trim(p_obs), ''), nullif(trim(p_fala), ''))
  on conflict (centro_custo_id, data) do update
    set responsavel = excluded.responsavel, observacao = excluded.observacao, fala = excluded.fala,
        enviado_por = (eu()).id, enviado_em = now()
  returning id into v_id;

  -- Reenvio: desfaz os ajustes e a contagem anteriores antes de calcular de novo.
  delete from estoque_movimentos where inventario_id = v_id;
  delete from inventario_estoque_itens where inventario_id = v_id;

  insert into inventario_estoque_itens (inventario_id, insumo_id, quantidade, saldo_sistema, custo_unit)
  select v_id, (x->>'insumo_id')::uuid, (x->>'quantidade')::numeric, coalesce(s.quantidade, 0), i.preco
  from jsonb_array_elements(p_itens) x
  join insumos i on i.id = (x->>'insumo_id')::uuid
  left join saldos_estoque(p_centro) s on s.insumo_id = i.id
  where x->>'quantidade' is not null;

  insert into estoque_movimentos (centro_custo_id, insumo_id, data, tipo, quantidade, custo_unit, observacao, inventario_id)
  select p_centro, it.insumo_id, p_data, 'ajuste', it.quantidade - it.saldo_sistema, it.custo_unit,
    'Inventário ' || to_char(p_data, 'DD/MM'), v_id
  from inventario_estoque_itens it
  where it.inventario_id = v_id and abs(it.quantidade - it.saldo_sistema) > 0.0001;

  return v_id;
end $$;
revoke execute on function enviar_inventario(text, date, text, text, text, jsonb) from public, anon;
grant execute on function enviar_inventario(text, date, text, text, text, jsonb) to authenticated;
