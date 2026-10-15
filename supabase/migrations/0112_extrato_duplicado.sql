-- Lançamento do extrato importado duas vezes (Heitor, 15/10): o Itaú mudou o texto do mesmo boleto entre um OFX e
-- outro ("PAMA COMERCI PAMA COMERCIO…" e "PAMA COMERCIO…"), e o portal não reconheceu como repetido.
-- Excluir o repetido: só quando existe outro lançamento igual (mesma conta, dia e valor). Se ele já foi conciliado,
-- a conciliação é desfeita; a conta a pagar que a própria conciliação criou ("Lançar como despesa") é apagada junto.
create or replace function excluir_movimento_duplicado(p_mov uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  m extrato_movimentos;
begin
  if not vejo_resultado() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  select * into m from extrato_movimentos where id = p_mov for update;
  if m.id is null then raise exception 'Lançamento não encontrado.'; end if;
  if not exists (select 1 from extrato_movimentos x where x.id <> m.id and x.banco = m.banco and x.agencia = m.agencia and x.conta = m.conta
                   and x.data = m.data and x.valor = m.valor) then
    raise exception 'Não há outro lançamento igual (mesmo dia e valor) para este ser o repetido.';
  end if;
  if m.conta_pagar_id is not null and exists (select 1 from contas_pagar c where c.id = m.conta_pagar_id and c.observacao = 'Lançada pela conciliação bancária') then
    update extrato_movimentos set conta_pagar_id = null where id = p_mov;
    delete from contas_pagar where id = m.conta_pagar_id;
  end if;
  perform desconciliar_movimento(p_mov);
  update notas_fiscais set extrato_movimento_id = null where extrato_movimento_id = p_mov;
  delete from extrato_movimentos where id = p_mov;
end $$;
grant execute on function excluir_movimento_duplicado(uuid) to authenticated;
