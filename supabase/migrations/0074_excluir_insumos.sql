-- Excluir material (Heitor, 11/10): tirar do cadastro o que é antigo e não faz sentido controlar.
-- Sai de vez quando não tem história que precise dele (nota, produção, ficha, compra, evento, inventário);
-- se tiver, é inativado (some das listas e das fichas novas) e a tela diz o porquê.
create function excluir_insumos(p_ids uuid[])
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
revoke execute on function excluir_insumos(uuid[]) from public, anon;
grant execute on function excluir_insumos(uuid[]) to authenticated;
