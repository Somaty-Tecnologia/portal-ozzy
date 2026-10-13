-- Heitor (13/10): os insumos dos eventos (planilha DPEN) que não casaram pelo nome com os materiais da Eclética
-- ficaram duplicados (Coca-Cola × Coca cola 350ml lata…), e o saldo da Central fica no material da Eclética.
-- juntar_insumos(origem, destino): tudo que aponta para a origem passa para o destino e a origem sai do cadastro.
create function juntar_insumos(p_origem uuid, p_destino uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  o insumos;
  d insumos;
  r record;
begin
  if not sou_gestao() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  if p_origem = p_destino then raise exception 'Escolha um material diferente.'; end if;
  select * into o from insumos where id = p_origem;
  select * into d from insumos where id = p_destino;
  if o.id is null or d.id is null then raise exception 'Material não encontrado.'; end if;
  if o.unidade <> d.unidade then
    raise exception '% está em % e % em %. Acerte a unidade antes de juntar.', o.nome, o.unidade, d.nome, d.unidade;
  end if;

  -- Tabelas em que o destino pode já ter a mesma linha: fica a do destino (somando a contagem do evento).
  update inventario_itens x set quantidade = x.quantidade + y.quantidade
    from inventario_itens y where y.inventario_id = x.inventario_id and y.insumo_id = p_origem and x.insumo_id = p_destino;
  delete from inventario_itens x where x.insumo_id = p_origem and exists (select 1 from inventario_itens y where y.inventario_id = x.inventario_id and y.insumo_id = p_destino);
  delete from inventario_estoque_itens x where x.insumo_id = p_origem and exists (select 1 from inventario_estoque_itens y where y.inventario_id = x.inventario_id and y.insumo_id = p_destino);
  delete from evento_pedido_insumos x where x.insumo_id = p_origem and exists (select 1 from evento_pedido_insumos y where y.evento_id = x.evento_id and y.insumo_id = p_destino);
  delete from fechamento_contagens c using fechamento_itens f
    where c.item_id = f.id and f.insumo_id = p_origem
      and exists (select 1 from fechamento_itens g where g.unidade_id = f.unidade_id and g.setor = f.setor and g.insumo_id = p_destino);
  delete from fechamento_itens f where f.insumo_id = p_origem
    and exists (select 1 from fechamento_itens g where g.unidade_id = f.unidade_id and g.setor = f.setor and g.insumo_id = p_destino);

  -- Todas as colunas que apontam para insumos (fichas, estoque, notas, eventos, produção, compras…).
  for r in
    select cl.relname as tabela, a.attname as coluna
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = 'public.insumos'::regclass and array_length(c.conkey, 1) = 1
      and cl.relnamespace = 'public'::regnamespace
  loop
    execute format('update %I set %I = $1 where %I = $2', r.tabela, r.coluna, r.coluna) using p_destino, p_origem;
  end loop;
  update compras_pedidos p set itens = (
    select jsonb_agg(case when x ->> 'insumo_id' = p_origem::text then jsonb_set(x, '{insumo_id}', to_jsonb(p_destino::text)) else x end order by n)
    from jsonb_array_elements(p.itens) with ordinality t (x, n))
  where exists (select 1 from jsonb_array_elements(p.itens) x where x ->> 'insumo_id' = p_origem::text);

  -- O destino fica com o que só a origem tinha.
  update insumos set
    fornecedor_id = coalesce(fornecedor_id, o.fornecedor_id),
    embalagem = coalesce(embalagem, o.embalagem),
    embalagem_qtd = coalesce(embalagem_qtd, o.embalagem_qtd),
    preco = coalesce(preco, o.preco),
    preco_em = coalesce(preco_em, o.preco_em),
    categoria = coalesce(categoria, o.categoria),
    pre_preparo = pre_preparo or o.pre_preparo,
    ativo = true,
    observacao = concat_ws(' · ', nullif(observacao, ''), 'Juntado com ' || o.nome || ' em ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY')),
    atualizado_em = now()
  where id = p_destino;
  delete from insumos where id = p_origem;
end $$;
revoke execute on function juntar_insumos(uuid, uuid) from public, anon;
grant execute on function juntar_insumos(uuid, uuid) to authenticated;
