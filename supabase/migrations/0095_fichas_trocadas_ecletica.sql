-- Heitor (13/10): "mussarela de búfala aparece como pré-preparo nas fichas, mas no cadastro não".
-- Na Eclética, algumas fichas usam o código de um material comprado, mas a composição é de outro item
-- (a ficha 100189 "Mussarela de Búfala" tem pão, blend e batata do Ozzy Bites). A importação (0070) criou
-- essas fichas como pré-preparo e ligou ao material. Aqui elas saem: a ficha fica inativa e desligada do
-- material, e quem usava a ficha (as pizzas usam a búfala) passa a usar o material comprado direto.
do $$
declare
  r record;
begin
  for r in
    select f.id as receita_id, f.insumo_id
    from receitas f
    where f.tipo = 'preparo'
      and f.ecletica_codigo in ('100189', '100295', '100328', '100331', '100338', '100420', '100235')
  loop
    if r.insumo_id is not null then
      update receita_itens set insumo_id = r.insumo_id, sub_receita_id = null where sub_receita_id = r.receita_id;
      update insumos set pre_preparo = false where id = r.insumo_id;
    end if;
    update receitas set ativo = false, insumo_id = null,
      observacoes = concat_ws(' · ', nullif(observacoes, ''), 'Ficha da Eclética com a composição de outro item; desativada em 13/10/2026')
      where id = r.receita_id;
  end loop;
end $$;
