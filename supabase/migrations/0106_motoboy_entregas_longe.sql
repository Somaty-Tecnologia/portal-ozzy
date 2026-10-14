-- Entregas acima de 6 km (Heitor, 14/10): o motoboy diz quantas entregas do dia passaram de 6 km e manda o print
-- do GPS de cada uma. Cada uma paga um adicional (padrão R$ 4, editável no cadastro). Na conferência a gestão
-- confere os prints e define o valor final desse adicional (vem sugerido: conferidas × valor).

alter table motoboys add column valor_entrega_longe numeric(10, 2) not null default 4 check (valor_entrega_longe >= 0);

alter table motoboy_envios
  add column longas int not null default 0 check (longas >= 0 and longas <= 200),
  add column fotos_longas text[] not null default '{}', -- prints do GPS
  add column longas_conferidas int check (longas_conferidas >= 0),
  add column valor_longas numeric(10, 2) check (valor_longas >= 0);

create or replace function motoboy_quem_sou(p_celular text) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  v_cel text := right(regexp_replace(p_celular, '\D', '', 'g'), 11);
  m motoboys;
begin
  if length(v_cel) < 10 then return json_build_object('tipo', 'invalido'); end if;
  select * into m from motoboys
  where ativo and right(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), 11) = v_cel
  order by criado_em limit 1;
  if m.id is null then return json_build_object('tipo', 'nao_achei'); end if;
  return json_build_object('tipo', 'motoboy', 'nome', split_part(m.nome, ' ', 1), 'unidadeId', m.unidade_id,
    'valorDiaria', m.valor_diaria, 'valorDiariaFds', m.valor_diaria_fds, 'entregasIncluidas', m.entregas_incluidas, 'valorEntrega', m.valor_entrega,
    'valorEntregaLonge', m.valor_entrega_longe);
end $$;

drop function motoboy_enviar(text, text, date, int, jsonb, text, text[]);
create function motoboy_enviar(p_celular text, p_unidade text, p_data date, p_entregas int, p_extras jsonb, p_obs text, p_fotos text[],
  p_longas int default 0, p_fotos_longas text[] default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_cel text := right(regexp_replace(p_celular, '\D', '', 'g'), 11);
  v_moto uuid;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_atual motoboy_envios;
  v_extras jsonb;
  v_fotos text[];
  v_gps text[];
  v_longas int := coalesce(p_longas, 0);
  v_id uuid;
begin
  select id into v_moto from motoboys
  where ativo and length(v_cel) >= 10 and right(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), 11) = v_cel
  order by criado_em limit 1;
  if v_moto is null then raise exception 'Celular não encontrado no cadastro dos motoboys. Fale com a gerente.'; end if;
  if not exists (select 1 from unidades where id = p_unidade and id not in ('central', 'eventos')) then raise exception 'Escolha a loja.'; end if;
  if p_data is null or p_data > v_hoje or p_data < v_hoje - 6 then raise exception 'Escolha um dia desta semana (até hoje).'; end if;
  if p_entregas is null or p_entregas < 0 or p_entregas > 200 then raise exception 'Confira o número de entregas.'; end if;
  if v_longas < 0 or v_longas > p_entregas then raise exception 'As entregas acima de 6 km não podem passar do total de entregas.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('descricao', left(trim(x->>'descricao'), 120), 'valor', round((x->>'valor')::numeric, 2))), '[]')
  into v_extras
  from jsonb_array_elements(coalesce(p_extras, '[]')) x
  where trim(coalesce(x->>'descricao', '')) <> '' and (x->>'valor') ~ '^-?\d+(\.\d+)?$' and (x->>'valor')::numeric <> 0;
  select coalesce(array_agg(f), '{}') into v_fotos
  from unnest(coalesce(p_fotos, '{}')) f
  where f like 'envios/%' and exists (select 1 from storage.objects o where o.bucket_id = 'motoboys' and o.name = f);
  select coalesce(array_agg(f), '{}') into v_gps
  from unnest(coalesce(p_fotos_longas, '{}')) f
  where f like 'envios/%' and exists (select 1 from storage.objects o where o.bucket_id = 'motoboys' and o.name = f);

  select * into v_atual from motoboy_envios
  where motoboy_id = v_moto and unidade_id = p_unidade and data = p_data and status <> 'recusado';
  if v_atual.status = 'aprovado' then raise exception 'Esse dia já foi conferido e aprovado. Se precisar mudar, fale com a gerente.'; end if;
  if v_longas > 0 and cardinality(coalesce(v_atual.fotos_longas, '{}') || v_gps) = 0 then
    raise exception 'Mande o print do GPS das entregas acima de 6 km.';
  end if;

  if v_atual.id is not null then
    update motoboy_envios set entregas = p_entregas, extras = v_extras, observacao = nullif(trim(p_obs), ''),
      fotos = v_atual.fotos || v_fotos, longas = v_longas, fotos_longas = v_atual.fotos_longas || v_gps, enviado_em = now()
    where id = v_atual.id returning id into v_id;
  else
    insert into motoboy_envios (motoboy_id, unidade_id, data, entregas, extras, observacao, fotos, longas, fotos_longas)
    values (v_moto, p_unidade, p_data, p_entregas, v_extras, nullif(trim(p_obs), ''), v_fotos, v_longas, v_gps)
    returning id into v_id;
  end if;
  return v_id;
end $$;

-- Aprovação: entregas conferidas e, se teve entregas acima de 6 km, quantas valeram e o valor final do adicional.
drop function motoboy_resolver_envio(uuid, boolean, int, text);
create function motoboy_resolver_envio(p_id uuid, p_aprovar boolean, p_entregas int, p_motivo text,
  p_longas int default null, p_valor_longas numeric default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(sou_gestao(), false) then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  if p_aprovar and (p_entregas is null or p_entregas < 0) then raise exception 'Coloque quantas entregas foram conferidas.'; end if;
  if p_aprovar and (coalesce(p_longas, 0) < 0 or coalesce(p_valor_longas, 0) < 0) then raise exception 'Confira as entregas acima de 6 km e o valor.'; end if;
  if not p_aprovar and trim(coalesce(p_motivo, '')) = '' then raise exception 'Diga o motivo da recusa.'; end if;
  update motoboy_envios set
    status = case when p_aprovar then 'aprovado' else 'recusado' end,
    entregas_conferidas = case when p_aprovar then p_entregas end,
    longas_conferidas = case when p_aprovar then coalesce(p_longas, 0) end,
    valor_longas = case when p_aprovar then round(coalesce(p_valor_longas, 0), 2) end,
    motivo = nullif(trim(p_motivo), ''),
    resolvido_por = (eu()).id, resolvido_em = now()
  where id = p_id;
end $$;

create or replace function motoboy_reabrir_envio(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(sou_gestao(), false) then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  if exists (select 1 from motoboy_envios e where e.id = p_id and e.status = 'recusado'
             and exists (select 1 from motoboy_envios x where x.motoboy_id = e.motoboy_id and x.unidade_id = e.unidade_id and x.data = e.data and x.status <> 'recusado')) then
    raise exception 'Esse dia já foi mandado de novo.';
  end if;
  update motoboy_envios set status = 'pendente', entregas_conferidas = null, longas_conferidas = null, valor_longas = null,
    motivo = null, resolvido_por = null, resolvido_em = null where id = p_id;
end $$;

revoke execute on function motoboy_enviar(text, text, date, int, jsonb, text, text[], int, text[]) from public;
revoke execute on function motoboy_resolver_envio(uuid, boolean, int, text, int, numeric) from public, anon;
grant execute on function motoboy_enviar(text, text, date, int, jsonb, text, text[], int, text[]) to anon, authenticated;
grant execute on function motoboy_resolver_envio(uuid, boolean, int, text, int, numeric) to authenticated;
