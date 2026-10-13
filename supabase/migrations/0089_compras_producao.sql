-- Heitor (13/10): quem trabalha na produção vê as entregas da semana e marca se o item chegou ou não.
create policy "producao ve pedidos de compra" on compras_pedidos for select using ((select sou_producao()));
create policy "producao ve fornecedores" on fornecedores for select using ((select sou_producao()));

-- Só muda o "chegou"; o resto do pedido continua com a gestão.
create function marcar_compra_recebida(p_id uuid, p_recebido boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (sou_gestao() or sou_producao()) then raise exception 'Sem permissão'; end if;
  update compras_pedidos
     set status = case when p_recebido then 'recebido' else 'pedido' end,
         recebido_em = case when p_recebido then current_date else null end,
         atualizado_em = now()
   where id = p_id and status in ('pedido', 'recebido');
end $$;
revoke execute on function marcar_compra_recebida(uuid, boolean) from public, anon;
grant execute on function marcar_compra_recebida(uuid, boolean) to authenticated;
