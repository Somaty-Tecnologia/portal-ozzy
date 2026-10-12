-- Curva ABC das compras (Heitor, 12/10): o inventário de segunda foca nos itens que somam a maior parte do valor
-- comprado (carne, pão, batata...). Classe A = até 80% do valor dos últimos p_dias; B = até 95%; C = o resto.
-- Soma o histórico da Eclética e as entradas por nota fiscal do portal, de todas as lojas.
create function curva_abc(p_dias int default 90)
returns table (insumo_id uuid, valor numeric, participacao numeric, classe text)
language sql stable security definer set search_path = public as $$
  with compras as (
    select h.insumo_id, coalesce(h.total, h.quantidade * h.preco) as valor
    from compras_historico h
    where h.insumo_id is not null and h.data >= now() - make_interval(days => p_dias)
    union all
    select m.insumo_id, m.quantidade * m.custo_unit
    from estoque_movimentos m
    where m.tipo = 'entrada_nf' and m.custo_unit is not null and m.data >= current_date - p_dias
  ), v as (
    select c.insumo_id, sum(c.valor) as valor from compras c group by 1 having sum(c.valor) > 0
  ), r as (
    select v.*, sum(v.valor) over (order by v.valor desc, v.insumo_id) / sum(v.valor) over () as acum,
      v.valor / sum(v.valor) over () as part
    from v
  )
  select r.insumo_id, round(r.valor, 2), round(r.part * 100, 2),
    case when r.acum - r.part < 0.80 then 'A' when r.acum - r.part < 0.95 then 'B' else 'C' end
  from r
  where coalesce((select sou_gestao()) or (select sou_producao()) or (eu()).id is not null, false)
$$;
revoke execute on function curva_abc(int) from public, anon;
grant execute on function curva_abc(int) to authenticated;
