-- Unidade em que a loja pede (Heitor, 15/10): batata e nuggets em pacote, sobrecoxa em unidades de sanduíche.
-- fator = quanto 1 unidade da lista vale na unidade do material (pacote de batata = 2,5 kg). Nulo = a mesma
-- unidade do material. Vale para as duas lojas, como a unidade.
alter table fechamento_itens add column fator numeric(14, 4) check (fator is null or fator > 0);

drop function pedidos_producao(date);
create function pedidos_producao(p_para date)
returns table (insumo_id uuid, nome text, setor text, unidade_contagem text, unidade text, pre_preparo boolean,
  psd numeric, va numeric, total numeric, central numeric, fator numeric)
language sql stable security definer set search_path = public as $$
  with p as (
    select c.insumo_id, f.setor, f.unidade_id, max(fi.unidade_contagem) un, max(fi.fator) fator, sum(c.pedido) q
    from fechamentos f
    join fechamento_contagens c on c.fechamento_id = f.id
    join fechamento_itens fi on fi.id = c.item_id
    where f.para = p_para and coalesce(c.pedido, 0) > 0
    group by 1, 2, 3
  )
  select i.id, i.nome, min(p.setor), max(p.un), i.unidade, i.pre_preparo,
    sum(p.q) filter (where p.unidade_id = 'burger-psd'), sum(p.q) filter (where p.unidade_id = 'burger-va'), sum(p.q),
    (select coalesce(sum(m.quantidade), 0) from estoque_movimentos m where m.centro_custo_id = 'central' and m.insumo_id = i.id),
    max(p.fator)
  from p join insumos i on i.id = p.insumo_id
  where sou_gestao() or sou_producao()
  group by i.id
  order by i.pre_preparo desc, min(p.setor), i.nome
$$;
grant execute on function pedidos_producao(date) to authenticated;
