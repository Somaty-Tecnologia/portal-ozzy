-- Ponto pelo portal (Heitor, 13/10): sai o Control iD. A pessoa bate o ponto pelo celular com um toque.
-- - A hora é a do servidor (o relógio do celular não conta) e cada marcação ganha um número sequencial (NSR)
--   e um código de conferência encadeado com a anterior: se alguém mexer no banco, a corrente quebra.
-- - Marcação nunca é editada nem apagada. Correção é feita pela gestão incluindo uma marcação (com motivo)
--   ou desconsiderando uma (com motivo); a original continua guardada.
-- - Dentro da loja: o celular manda a localização e o portal mede a distância até a loja mais perto
--   (mesmo raio da diária do freela). Sem GPS, vale o QR Code colado na loja. Fora da loja a marcação
--   é gravada do mesmo jeito, mas chega marcada para a gestão conferir.
-- - Tipo pela ordem da jornada: entrada, saída para o intervalo, volta do intervalo, saída. Jornada nova
--   quando a última foi saída ou passou de 16 h (turno da noite que passa da meia-noite continua a mesma).

create table ponto_marcacoes (
  id uuid primary key default gen_random_uuid(),
  nsr bigint generated always as identity unique,
  funcionario_id uuid not null references funcionarios (id),
  momento timestamptz not null default now(),
  tipo text not null check (tipo in ('entrada', 'saida_intervalo', 'volta_intervalo', 'saida')),
  origem text not null check (origem in ('celular', 'qr', 'ajuste')),
  unidade_id text references unidades (id),
  latitude double precision,
  longitude double precision,
  precisao_m int,
  distancia_m int,
  na_loja boolean not null default false,
  motivo text, -- só nas incluídas pela gestão
  incluido_por uuid references funcionarios (id),
  ajuste_id uuid references ponto_ajustes (id),
  registrado_em timestamptz not null default now(),
  hash text not null
);
create index on ponto_marcacoes (funcionario_id, momento);
create index on ponto_marcacoes (momento);
alter table ponto_marcacoes enable row level security;
create policy "ver marcacoes" on ponto_marcacoes for select using (funcionario_id = (eu()).id or (select sou_gestao()));
revoke all on ponto_marcacoes from authenticated, anon;
grant select on ponto_marcacoes to authenticated;

create table ponto_desconsideradas (
  marcacao_id uuid primary key references ponto_marcacoes (id),
  motivo text not null check (length(trim(motivo)) > 0),
  por uuid not null references funcionarios (id),
  em timestamptz not null default now()
);
alter table ponto_desconsideradas enable row level security;
create policy "ver desconsideradas" on ponto_desconsideradas for select
  using ((select sou_gestao()) or exists (select 1 from ponto_marcacoes m where m.id = marcacao_id and m.funcionario_id = (eu()).id));
revoke all on ponto_desconsideradas from authenticated, anon;
grant select on ponto_desconsideradas to authenticated;

-- Código do QR Code de cada loja (só a gestão vê, para imprimir).
create table ponto_codigos (
  unidade_id text primary key references unidades (id),
  codigo text not null default substr(md5(gen_random_uuid()::text), 1, 10)
);
insert into ponto_codigos (unidade_id) select id from unidades;
alter table ponto_codigos enable row level security;
create policy "gestao ve codigos" on ponto_codigos for select using ((select sou_gestao()));
grant select on ponto_codigos to authenticated;

-- Grava uma marcação com o NSR e o código encadeado (uma de cada vez, para a corrente não se cruzar).
create function gravar_marcacao(p_func uuid, p_momento timestamptz, p_tipo text, p_origem text, p_unidade text,
  p_lat double precision, p_lng double precision, p_precisao int, p_dist int, p_na_loja boolean,
  p_motivo text, p_por uuid, p_ajuste uuid) returns ponto_marcacoes
language plpgsql security definer set search_path = public as $$
declare
  v_ant text;
  r ponto_marcacoes;
begin
  perform pg_advisory_xact_lock(hashtext('ponto_marcacoes'));
  select hash into v_ant from ponto_marcacoes order by nsr desc limit 1;
  insert into ponto_marcacoes (funcionario_id, momento, tipo, origem, unidade_id, latitude, longitude, precisao_m, distancia_m, na_loja,
    motivo, incluido_por, ajuste_id, hash)
  values (p_func, p_momento, p_tipo, p_origem, p_unidade, p_lat, p_lng, p_precisao, p_dist, p_na_loja, p_motivo, p_por, p_ajuste, '-')
  returning * into r;
  update ponto_marcacoes set hash = encode(sha256(convert_to(concat_ws('|', coalesce(v_ant, 'inicio'), r.nsr, r.funcionario_id,
    to_char(r.momento at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'), r.tipo, r.origem), 'UTF8')), 'hex')
  where id = r.id returning * into r;
  return r;
end $$;
revoke execute on function gravar_marcacao from public, authenticated, anon;

-- Próximo tipo da jornada da pessoa num momento.
create function proximo_tipo_ponto(p_func uuid, p_momento timestamptz) returns text
language sql stable security definer set search_path = public as $$
  select case
    when u.tipo is null or u.tipo = 'saida' or p_momento - u.momento > interval '16 hours' then 'entrada'
    when u.tipo = 'entrada' then 'saida_intervalo'
    when u.tipo = 'saida_intervalo' then 'volta_intervalo'
    else 'saida' end
  from (select null) x
  left join lateral (
    select m.tipo, m.momento from ponto_marcacoes m
    where m.funcionario_id = p_func and m.momento <= p_momento
      and not exists (select 1 from ponto_desconsideradas d where d.marcacao_id = m.id)
    order by m.momento desc limit 1) u on true
$$;

create function meu_proximo_ponto() returns text
language sql stable security definer set search_path = public as $$
  select proximo_tipo_ponto((eu()).id, now()) where (eu()).id is not null
$$;

-- Bater o ponto. p_local: {"lat","lng","precisao"} (pode vir vazio); p_codigo: o do QR da loja, quando escaneou;
-- p_tipo: quando a pessoa escolhe outro tipo (ex.: saída direto, sem intervalo).
create function bater_ponto(p_local jsonb default null, p_codigo text default null, p_tipo text default null) returns ponto_marcacoes
language plpgsql security definer set search_path = public as $$
declare
  v_eu uuid := (eu()).id;
  lat double precision := (p_local->>'lat')::double precision;
  lng double precision := (p_local->>'lng')::double precision;
  precisao int := case when (p_local->>'precisao')::numeric between 0 and 100000 then round((p_local->>'precisao')::numeric) end;
  v_loja unidades;
  v_dist int;
  v_qr text;
  v_na boolean := false;
  v_ultima timestamptz;
begin
  if v_eu is null then raise exception 'Entre no portal para bater o ponto.'; end if;
  if p_tipo is not null and p_tipo not in ('entrada', 'saida_intervalo', 'volta_intervalo', 'saida') then raise exception 'Tipo inválido.'; end if;
  -- Toque duplo: ignora outra batida em menos de 1 minuto.
  select max(momento) into v_ultima from ponto_marcacoes where funcionario_id = v_eu and origem <> 'ajuste';
  if v_ultima > now() - interval '1 minute' then raise exception 'Você acabou de bater o ponto. Espere um minuto para bater de novo.'; end if;

  if lat between -90 and 90 and lng between -180 and 180 then
    select * into v_loja from unidades where latitude is not null order by distancia_m(lat, lng, latitude, longitude) limit 1;
    if v_loja.id is not null then
      v_dist := round(distancia_m(lat, lng, v_loja.latitude, v_loja.longitude));
      v_na := v_dist - least(coalesce(precisao, 0), 100) <= v_loja.raio_m;
    end if;
  end if;
  -- QR da loja: vale sem GPS ou com o GPS perto (até 1 km, por causa da imprecisão dentro de prédio).
  if nullif(trim(p_codigo), '') is not null then
    select c.unidade_id into v_qr from ponto_codigos c where c.codigo = trim(p_codigo);
    if v_qr is null then raise exception 'QR Code não reconhecido. Use o QR colado na loja.'; end if;
    if v_dist is null or v_loja.id <> v_qr then
      select * into v_loja from unidades where id = v_qr;
      v_dist := case when lat between -90 and 90 and v_loja.latitude is not null then round(distancia_m(lat, lng, v_loja.latitude, v_loja.longitude)) end;
    end if;
    v_na := v_dist is null or v_dist <= 1000;
  end if;

  return gravar_marcacao(v_eu, now(), coalesce(p_tipo, proximo_tipo_ponto(v_eu, now())), case when v_qr is not null then 'qr' else 'celular' end,
    coalesce(v_loja.id, (eu()).unidade_id), lat, lng, precisao, v_dist, v_na, null, null, null);
end $$;

-- Gestão: incluir marcação que faltou (com motivo). Pode resolver um pedido de ajuste junto.
create function incluir_marcacao(p_func uuid, p_momento timestamptz, p_tipo text, p_motivo text, p_ajuste uuid default null) returns ponto_marcacoes
language plpgsql security definer set search_path = public as $$
declare
  r ponto_marcacoes;
begin
  if not sou_gestao() then raise exception 'Só a gestão inclui marcações.'; end if;
  if trim(coalesce(p_motivo, '')) = '' then raise exception 'Diga o motivo da inclusão.'; end if;
  if p_momento > now() then raise exception 'Não dá para incluir marcação no futuro.'; end if;
  if p_tipo not in ('entrada', 'saida_intervalo', 'volta_intervalo', 'saida') then raise exception 'Tipo inválido.'; end if;
  r := gravar_marcacao(p_func, p_momento, p_tipo, 'ajuste', (select unidade_id from funcionarios where id = p_func),
    null, null, null, null, true, trim(p_motivo), (eu()).id, p_ajuste);
  if p_ajuste is not null then
    update ponto_ajustes set status = 'feito', resolvido_por = (eu()).id, resolvido_em = now() where id = p_ajuste and status = 'pendente';
  end if;
  return r;
end $$;

create function desconsiderar_marcacao(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not sou_gestao() then raise exception 'Só a gestão desconsidera marcações.'; end if;
  if trim(coalesce(p_motivo, '')) = '' then raise exception 'Diga o motivo.'; end if;
  insert into ponto_desconsideradas (marcacao_id, motivo, por) values (p_id, trim(p_motivo), (eu()).id)
  on conflict (marcacao_id) do nothing;
end $$;

-- Conferência da corrente: devolve o primeiro NSR em que o código não bate (null = tudo certo).
create function conferir_corrente_ponto() returns bigint
language plpgsql stable security definer set search_path = public as $$
declare
  m ponto_marcacoes;
  v_ant text;
begin
  if not sou_gestao() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  for m in select * from ponto_marcacoes order by nsr loop
    if m.hash <> encode(sha256(convert_to(concat_ws('|', coalesce(v_ant, 'inicio'), m.nsr, m.funcionario_id,
      to_char(m.momento at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'), m.tipo, m.origem), 'UTF8')), 'hex') then
      return m.nsr;
    end if;
    v_ant := m.hash;
  end loop;
  return null;
end $$;
