-- Heitor (13/10): o pedido do fechamento pode ser para o dia seguinte (padrão) ou para o mesmo dia.
-- Um fechamento por loja, setor, dia e "para": o pedido de hoje e o de amanhã não se substituem.
alter table fechamentos drop constraint fechamentos_unidade_id_setor_data_key;
alter table fechamentos add constraint fechamentos_unidade_setor_data_para_key unique (unidade_id, setor, data, para);
alter table fechamentos add constraint fechamentos_para_hoje_ou_amanha check (para in (data, data + 1));

drop function itens_fechamento(text, text, date);
create function itens_fechamento(p_unidade text, p_setor text, p_data date, p_para date default null)
returns table (item_id uuid, insumo_id uuid, nome text, categoria text, unidade_contagem text, ordem int, pre_preparo boolean,
  ideal numeric, contagem numeric, sugestao numeric, pedido numeric)
language sql stable security definer set search_path = public as $$
  select fi.id, fi.insumo_id, i.nome, i.categoria, fi.unidade_contagem, fi.ordem, i.pre_preparo,
    fi.ideal[extract(isodow from coalesce(p_para, p_data + 1))::int], c.contagem, c.sugestao, c.pedido
  from fechamento_itens fi
  join insumos i on i.id = fi.insumo_id
  left join fechamentos f on f.unidade_id = fi.unidade_id and f.setor = fi.setor and f.data = p_data and f.para = coalesce(p_para, p_data + 1)
  left join fechamento_contagens c on c.fechamento_id = f.id and c.item_id = fi.id
  where fi.unidade_id = p_unidade and fi.setor = p_setor and (fi.ativo or c.item_id is not null)
    and (sou_gestao() or sou_producao() or p_unidade = (eu()).unidade_id)
  order by i.categoria nulls last, fi.ordem, i.nome
$$;
grant execute on function itens_fechamento(text, text, date, date) to authenticated;

drop function enviar_fechamento(text, text, date, text, text, text, jsonb);
create function enviar_fechamento(p_unidade text, p_setor text, p_data date, p_responsavel text, p_obs text, p_fala text, p_itens jsonb, p_para date default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_para date := coalesce(p_para, p_data + 1);
  x jsonb;
  fi fechamento_itens;
begin
  if (eu()).id is null or not (sou_gestao() or p_unidade = (eu()).unidade_id) then
    raise exception 'Só quem é desta loja (ou a gestão) envia o fechamento.';
  end if;
  if p_setor not in ('cozinha', 'atendimento') then raise exception 'Escolha cozinha ou atendimento.'; end if;
  if p_data > current_date + 1 then raise exception 'Confira a data do fechamento.'; end if;
  if v_para not in (p_data, p_data + 1) then raise exception 'O pedido é para o mesmo dia ou para o dia seguinte.'; end if;
  insert into fechamentos (unidade_id, setor, data, para, responsavel, observacao, fala, enviado_por)
  values (p_unidade, p_setor, p_data, v_para, nullif(trim(p_responsavel), ''), nullif(trim(p_obs), ''), nullif(trim(p_fala), ''), (eu()).id)
  on conflict (unidade_id, setor, data, para) do update set responsavel = excluded.responsavel, observacao = excluded.observacao,
    fala = excluded.fala, enviado_em = now(), enviado_por = excluded.enviado_por
  returning id into v_id;
  -- Reenvio: o que não veio desta vez fica em branco.
  update fechamento_contagens set contagem = null, sugestao = null, pedido = null where fechamento_id = v_id;
  for x in select * from jsonb_array_elements(coalesce(p_itens, '[]')) loop
    select * into fi from fechamento_itens where id = (x->>'item_id')::uuid;
    if fi.id is null or fi.unidade_id <> p_unidade or fi.setor <> p_setor then raise exception 'Item fora da lista desta loja.'; end if;
    insert into fechamento_contagens (fechamento_id, item_id, insumo_id, contagem, sugestao, pedido)
    values (v_id, fi.id, fi.insumo_id, (x->>'contagem')::numeric, (x->>'sugestao')::numeric, nullif((x->>'pedido')::numeric, 0))
    on conflict (fechamento_id, item_id) do update set contagem = excluded.contagem, sugestao = excluded.sugestao, pedido = excluded.pedido;
  end loop;
  return v_id;
end $$;
grant execute on function enviar_fechamento(text, text, date, text, text, text, jsonb, date) to authenticated;
