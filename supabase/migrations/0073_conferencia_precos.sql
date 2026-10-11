-- Conferência de preços dos materiais (Heitor, 11/10): o portal aponta preço fora do padrão (ex.: guardanapo a R$ 90 a unidade)
-- para a gestão corrigir. A conta é feita na tela; o banco dá o preço anterior e o custo da última entrada no estoque.

-- Preço que alguém conferiu e disse "está certo": enquanto o preço for este, o material não volta a ser apontado.
alter table insumos add column preco_conferido numeric(14, 4);

create function conferencia_precos()
returns table (insumo_id uuid, preco_anterior numeric, anterior_em timestamptz, custo_entrada numeric, entrada_em date)
language sql stable security invoker set search_path = public as $$
  with hist as (
    select p.insumo_id, p.preco, p.em, row_number() over (partition by p.insumo_id order by p.em desc, p.id desc) as n
    from insumo_precos p
  ), entrada as (
    select distinct on (m.insumo_id) m.insumo_id, m.custo_unit, m.data
    from estoque_movimentos m
    where m.quantidade > 0 and m.custo_unit > 0
    order by m.insumo_id, m.data desc, m.criado_em desc
  )
  select i.id, h.preco, h.em, e.custo_unit, e.data
  from insumos i
  left join hist h on h.insumo_id = i.id and h.n = 2
  left join entrada e on e.insumo_id = i.id
  where i.ativo and (h.preco is not null or e.custo_unit is not null)
$$;
grant execute on function conferencia_precos() to authenticated;
