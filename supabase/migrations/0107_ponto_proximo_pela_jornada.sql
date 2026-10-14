-- Próxima batida pela quantidade de batidas da jornada aberta (Heitor, 14/10): quem bateu "Entrada" por engano
-- na volta do intervalo ficava com "Saída para o intervalo" de novo. Mesma regra do espelho: jornada nova depois
-- de uma saída, depois de 16 h, ou com uma entrada mais de 6 h depois da última batida.
create or replace function proximo_tipo_ponto(p_func uuid, p_momento timestamptz) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  m record;
  v_ant timestamptz;
  v_n int := 0;
begin
  for m in
    select x.tipo, x.momento from ponto_marcacoes x
    where x.funcionario_id = p_func and x.momento <= p_momento and x.momento > p_momento - interval '3 days'
      and not exists (select 1 from ponto_desconsideradas d where d.marcacao_id = x.id)
    order by x.momento
  loop
    if v_ant is null or m.momento - v_ant > interval '16 hours' or (m.tipo = 'entrada' and m.momento - v_ant > interval '6 hours') then
      v_n := 1;
    else
      v_n := v_n + 1;
    end if;
    if m.tipo = 'saida' then v_n := 0; end if;
    v_ant := m.momento;
  end loop;
  if v_ant is null or p_momento - v_ant > interval '16 hours' then return 'entrada'; end if;
  return case v_n when 0 then 'entrada' when 1 then 'saida_intervalo' when 2 then 'volta_intervalo' else 'saida' end;
end $$;
