-- Tirar do cadastro as "Observações do PDV" (Heitor, 12/10): "Sem cebola", "Ponto da carne" e afins vêm da Eclética,
-- mas não são mercadoria. Sai de vez o que não tem história; o que estiver em ficha, nota etc. só fica inativo.
-- Também: excluir_insumos passa a considerar o inventário das lojas (0075) como história.
create or replace function excluir_insumos(p_ids uuid[])
returns table (insumo_id uuid, nome text, excluido boolean, motivo text)
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_nome text;
  v_motivo text;
begin
  if not sou_gestao() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  foreach v_id in array p_ids loop
    select i.nome into v_nome from insumos i where i.id = v_id;
    if v_nome is null then continue; end if;
    v_motivo := case
      when exists (select 1 from receitas r where r.insumo_id = v_id) then 'é o estoque de uma ficha de pré-preparo'
      when exists (select 1 from receita_itens ri where ri.insumo_id = v_id) then 'está em ficha técnica: ' || (
        select string_agg(distinct r.nome, ', ') from receita_itens ri join receita_versoes v on v.id = ri.versao_id join receitas r on r.id = v.receita_id where ri.insumo_id = v_id)
      when exists (select 1 from nota_itens n where n.insumo_id = v_id) then 'tem nota fiscal lançada'
      when exists (select 1 from estoque_movimentos m where m.insumo_id = v_id and (m.nota_item_id is not null or m.producao_id is not null)) then 'tem entrada por nota ou produção'
      when exists (select 1 from producoes p where p.insumo_id = v_id) then 'tem produção lançada'
      when exists (select 1 from compras_historico c where c.insumo_id = v_id) then 'tem histórico de compra'
      when exists (select 1 from evento_envio_itens e where e.insumo_id = v_id) then 'foi enviado para evento'
      when exists (select 1 from inventario_itens e where e.insumo_id = v_id) then 'está em contagem de evento'
      when exists (select 1 from inventario_estoque_itens e where e.insumo_id = v_id) then 'está no inventário das lojas'
      when exists (select 1 from compras_pedidos p, jsonb_array_elements(p.itens) x where (x ->> 'insumo_id')::uuid = v_id) then 'está em pedido de compra'
    end;
    if v_motivo is null then
      -- Sem história: sai com o que é só dele (saldo/ajustes, preço, lista de fechamento, conversões de nota).
      delete from fechamento_contagens c where c.insumo_id = v_id or c.item_id in (select f.id from fechamento_itens f where f.insumo_id = v_id);
      delete from fechamento_itens f where f.insumo_id = v_id;
      delete from estoque_movimentos m where m.insumo_id = v_id;
      delete from fornecedor_produtos f where f.insumo_id = v_id;
      delete from insumos i where i.id = v_id;
      return query select v_id, v_nome, true, null::text;
    else
      update insumos set ativo = false where id = v_id;
      update fechamento_itens f set ativo = false where f.insumo_id = v_id;
      return query select v_id, v_nome, false, v_motivo;
    end if;
  end loop;
end $$;

do $$
declare
  v_id uuid;
  v_hist boolean;
  v_apagados int := 0;
  v_inativados int := 0;
begin
  for v_id in select id from insumos where categoria = 'Observações do PDV' loop
    v_hist := exists (select 1 from receitas r where r.insumo_id = v_id)
      or exists (select 1 from receita_itens ri where ri.insumo_id = v_id)
      or exists (select 1 from nota_itens n where n.insumo_id = v_id)
      or exists (select 1 from estoque_movimentos m where m.insumo_id = v_id and (m.nota_item_id is not null or m.producao_id is not null))
      or exists (select 1 from producoes p where p.insumo_id = v_id)
      or exists (select 1 from compras_historico c where c.insumo_id = v_id)
      or exists (select 1 from evento_envio_itens e where e.insumo_id = v_id)
      or exists (select 1 from inventario_itens e where e.insumo_id = v_id)
      or exists (select 1 from inventario_estoque_itens e where e.insumo_id = v_id)
      or exists (select 1 from compras_pedidos p, jsonb_array_elements(p.itens) x where (x ->> 'insumo_id')::uuid = v_id);
    if v_hist then
      update insumos set ativo = false where id = v_id;
      update fechamento_itens f set ativo = false where f.insumo_id = v_id;
      v_inativados := v_inativados + 1;
    else
      delete from fechamento_contagens c where c.insumo_id = v_id or c.item_id in (select f.id from fechamento_itens f where f.insumo_id = v_id);
      delete from fechamento_itens f where f.insumo_id = v_id;
      delete from estoque_movimentos m where m.insumo_id = v_id;
      delete from fornecedor_produtos f where f.insumo_id = v_id;
      delete from insumos i where i.id = v_id;
      v_apagados := v_apagados + 1;
    end if;
  end loop;
  raise notice 'Observações do PDV: % excluídas, % só inativadas (têm história)', v_apagados, v_inativados;
end $$;
