-- Motoboy manda o dia pelo link (Heitor, 12/10): hoje mandam no WhatsApp quantas entregas fizeram e as fotos das
-- notinhas. Agora mandam por um link sem login (#/motoboy): celular do cadastro, loja, dia, entregas, fotos das
-- notinhas, valor a mais e observação. A gestão confere pelas fotos em Motoboys › Conferir, ajusta as entregas e
-- aprova; o dia aprovado já entra no pagamento da semana (diária + entregas além das incluídas).

create table motoboy_envios (
  id uuid primary key default gen_random_uuid(),
  motoboy_id uuid not null references motoboys (id),
  unidade_id text not null references unidades (id),
  data date not null,
  entregas int not null check (entregas >= 0 and entregas <= 200),
  extras jsonb not null default '[]', -- [{descricao, valor}]: pedágio, chuva, entrega longe…
  observacao text,
  fotos text[] not null default '{}', -- caminhos no bucket motoboys
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  entregas_conferidas int check (entregas_conferidas >= 0),
  motivo text,
  enviado_em timestamptz not null default now(),
  resolvido_por uuid references funcionarios (id),
  resolvido_em timestamptz
);
-- Um dia por motoboy e loja (recusado pode mandar de novo).
create unique index motoboy_envios_unico on motoboy_envios (motoboy_id, unidade_id, data) where status <> 'recusado';
create index on motoboy_envios (status, data);

alter table motoboy_envios enable row level security;
create policy "gestao ve envios de motoboy" on motoboy_envios for select using (sou_gestao());
grant select on motoboy_envios to authenticated;

-- Fotos das notinhas: o motoboy (sem login) só consegue mandar para a pasta envios/; ver, só a gestão.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('motoboys', 'motoboys', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;
create policy "motoboy manda foto da notinha" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'motoboys' and (storage.foldername(name))[1] = 'envios');
create policy "gestao ve fotos dos motoboys" on storage.objects for select
  using (bucket_id = 'motoboys' and sou_gestao());

-- "Quem é você": pelo celular do cadastro. Devolve só o primeiro nome, a loja e a regra de pagamento dele.
create function motoboy_quem_sou(p_celular text) returns json
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
    'valorDiaria', m.valor_diaria, 'entregasIncluidas', m.entregas_incluidas, 'valorEntrega', m.valor_entrega);
end $$;

-- Envio do dia. Mandar de novo o mesmo dia (ainda pendente) substitui; dia já aprovado não muda mais por aqui.
create function motoboy_enviar(p_celular text, p_unidade text, p_data date, p_entregas int, p_extras jsonb, p_obs text, p_fotos text[])
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_cel text := right(regexp_replace(p_celular, '\D', '', 'g'), 11);
  v_moto uuid;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_atual motoboy_envios;
  v_extras jsonb;
  v_fotos text[];
  v_id uuid;
begin
  select id into v_moto from motoboys
  where ativo and length(v_cel) >= 10 and right(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), 11) = v_cel
  order by criado_em limit 1;
  if v_moto is null then raise exception 'Celular não encontrado no cadastro dos motoboys. Fale com a gerente.'; end if;
  if not exists (select 1 from unidades where id = p_unidade and id not in ('central', 'eventos')) then raise exception 'Escolha a loja.'; end if;
  if p_data is null or p_data > v_hoje or p_data < v_hoje - 6 then raise exception 'Escolha um dia desta semana (até hoje).'; end if;
  if p_entregas is null or p_entregas < 0 or p_entregas > 200 then raise exception 'Confira o número de entregas.'; end if;

  -- Extras com descrição e valor; fotos só as que chegaram mesmo no bucket.
  select coalesce(jsonb_agg(jsonb_build_object('descricao', left(trim(x->>'descricao'), 120), 'valor', round((x->>'valor')::numeric, 2))), '[]')
  into v_extras
  from jsonb_array_elements(coalesce(p_extras, '[]')) x
  where trim(coalesce(x->>'descricao', '')) <> '' and (x->>'valor') ~ '^-?\d+(\.\d+)?$' and (x->>'valor')::numeric <> 0;
  select coalesce(array_agg(f), '{}') into v_fotos
  from unnest(coalesce(p_fotos, '{}')) f
  where f like 'envios/%' and exists (select 1 from storage.objects o where o.bucket_id = 'motoboys' and o.name = f);

  select * into v_atual from motoboy_envios
  where motoboy_id = v_moto and unidade_id = p_unidade and data = p_data and status <> 'recusado';
  if v_atual.status = 'aprovado' then raise exception 'Esse dia já foi conferido e aprovado. Se precisar mudar, fale com a gerente.'; end if;

  if v_atual.id is not null then
    update motoboy_envios set entregas = p_entregas, extras = v_extras, observacao = nullif(trim(p_obs), ''),
      fotos = v_atual.fotos || v_fotos, enviado_em = now()
    where id = v_atual.id returning id into v_id;
  else
    insert into motoboy_envios (motoboy_id, unidade_id, data, entregas, extras, observacao, fotos)
    values (v_moto, p_unidade, p_data, p_entregas, v_extras, nullif(trim(p_obs), ''), v_fotos)
    returning id into v_id;
  end if;
  return v_id;
end $$;

-- Conferência da gestão: aprova com as entregas conferidas (pelas notinhas) ou recusa com o motivo.
create function motoboy_resolver_envio(p_id uuid, p_aprovar boolean, p_entregas int, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(sou_gestao(), false) then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  if p_aprovar and (p_entregas is null or p_entregas < 0) then raise exception 'Coloque quantas entregas foram conferidas.'; end if;
  if not p_aprovar and trim(coalesce(p_motivo, '')) = '' then raise exception 'Diga o motivo da recusa.'; end if;
  update motoboy_envios set
    status = case when p_aprovar then 'aprovado' else 'recusado' end,
    entregas_conferidas = case when p_aprovar then p_entregas end,
    motivo = nullif(trim(p_motivo), ''),
    resolvido_por = (eu()).id, resolvido_em = now()
  where id = p_id;
end $$;

-- Volta para pendente (aprovou errado).
create function motoboy_reabrir_envio(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(sou_gestao(), false) then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  if exists (select 1 from motoboy_envios e where e.id = p_id and e.status = 'recusado'
             and exists (select 1 from motoboy_envios x where x.motoboy_id = e.motoboy_id and x.unidade_id = e.unidade_id and x.data = e.data and x.status <> 'recusado')) then
    raise exception 'Esse dia já foi mandado de novo.';
  end if;
  update motoboy_envios set status = 'pendente', entregas_conferidas = null, motivo = null, resolvido_por = null, resolvido_em = null where id = p_id;
end $$;

revoke execute on function motoboy_quem_sou(text) from public;
revoke execute on function motoboy_enviar(text, text, date, int, jsonb, text, text[]) from public;
revoke execute on function motoboy_resolver_envio(uuid, boolean, int, text) from public, anon;
revoke execute on function motoboy_reabrir_envio(uuid) from public, anon;
grant execute on function motoboy_quem_sou(text) to anon, authenticated;
grant execute on function motoboy_enviar(text, text, date, int, jsonb, text, text[]) to anon, authenticated;
grant execute on function motoboy_resolver_envio(uuid, boolean, int, text) to authenticated;
grant execute on function motoboy_reabrir_envio(uuid) to authenticated;
