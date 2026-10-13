-- Heitor (13/10): refrigerantes do evento com o mesmo cadastro e o mesmo nome das lojas (materiais da Eclética).
-- Insumo da planilha dos eventos → junta no material da Eclética (o saldo da Central passa a contar).
-- Produto do cardápio dos eventos → ganha o nome do material; o histórico de vendas acompanha (liga pela ficha).
-- Águas: 'Água' e 'Água com gás' já eram o mesmo material das lojas desde a 0063.
do $$
declare
  r record;
  v_origem uuid;
  v_destino uuid;
  v_nome text;
  v_prod uuid;
begin
  for r in select * from (values
    ('coca-cola', '88'), ('coca-zero', '89'), ('guaraná', '91'), ('guaraná zero', '100484')
  ) t (evento, codigo) loop
    select id, nome into v_destino, v_nome from insumos where ecletica_codigo = r.codigo;
    if v_destino is null then continue; end if;
    select id into v_origem from insumos where lower(nome) = r.evento and ecletica_codigo is null;
    if v_origem is not null then
      -- juntar_insumos exige gestão; aqui roda como dono do banco, então repete o que ela faz.
      update inventario_itens x set quantidade = x.quantidade + y.quantidade
        from inventario_itens y where y.inventario_id = x.inventario_id and y.insumo_id = v_origem and x.insumo_id = v_destino;
      delete from inventario_itens x where x.insumo_id = v_origem and exists (select 1 from inventario_itens y where y.inventario_id = x.inventario_id and y.insumo_id = v_destino);
      delete from inventario_estoque_itens x where x.insumo_id = v_origem and exists (select 1 from inventario_estoque_itens y where y.inventario_id = x.inventario_id and y.insumo_id = v_destino);
      delete from evento_pedido_insumos x where x.insumo_id = v_origem and exists (select 1 from evento_pedido_insumos y where y.evento_id = x.evento_id and y.insumo_id = v_destino);
      delete from fechamento_contagens c using fechamento_itens f
        where c.item_id = f.id and f.insumo_id = v_origem
          and exists (select 1 from fechamento_itens g where g.unidade_id = f.unidade_id and g.setor = f.setor and g.insumo_id = v_destino);
      delete from fechamento_itens f where f.insumo_id = v_origem
        and exists (select 1 from fechamento_itens g where g.unidade_id = f.unidade_id and g.setor = f.setor and g.insumo_id = v_destino);
      declare c record; begin
        for c in
          select cl.relname as tabela, a.attname as coluna
          from pg_constraint k join pg_class cl on cl.oid = k.conrelid
          join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
          where k.contype = 'f' and k.confrelid = 'public.insumos'::regclass and array_length(k.conkey, 1) = 1 and cl.relnamespace = 'public'::regnamespace
        loop
          execute format('update %I set %I = $1 where %I = $2', c.tabela, c.coluna, c.coluna) using v_destino, v_origem;
        end loop;
      end;
      update compras_pedidos p set itens = (
        select jsonb_agg(case when x ->> 'insumo_id' = v_origem::text then jsonb_set(x, '{insumo_id}', to_jsonb(v_destino::text)) else x end order by n)
        from jsonb_array_elements(p.itens) with ordinality t (x, n))
      where exists (select 1 from jsonb_array_elements(p.itens) x where x ->> 'insumo_id' = v_origem::text);
      update insumos d set
        fornecedor_id = coalesce(d.fornecedor_id, o.fornecedor_id), embalagem = coalesce(d.embalagem, o.embalagem),
        embalagem_qtd = coalesce(d.embalagem_qtd, o.embalagem_qtd), preco = coalesce(d.preco, o.preco), ativo = true,
        observacao = concat_ws(' · ', nullif(d.observacao, ''), 'Juntado com ' || o.nome || ' (eventos) em 13/10/2026'), atualizado_em = now()
      from insumos o where d.id = v_destino and o.id = v_origem;
      delete from insumos where id = v_origem;
    end if;

    -- Produto do cardápio dos eventos com o nome do material.
    select id into v_prod from receitas where lower(nome) = r.evento and tipo = 'produto' and coalesce(area, 'eventos') = 'eventos';
    if v_prod is not null and not exists (select 1 from receitas where lower(nome) = lower(v_nome) and tipo = 'produto' and coalesce(area, 'eventos') = 'eventos') then
      update receitas set nome = v_nome where id = v_prod;
      update evento_vendas set receita_id = v_prod where receita_id is null and lower(produto) = r.evento;
      update evento_vendas v set produto = v_nome
        where v.receita_id = v_prod
          and not exists (select 1 from evento_vendas w where w.evento_id = v.evento_id and w.data = v.data and w.produto = v_nome);
    end if;
  end loop;
end $$;
