-- Checklists (Heitor, 15/10): substituir o Konclui. Cada checklist tem unidade, setor, momento, responsável,
-- repetição (diária, semanal ou mensal) e horário limite. O portal gera a execução de cada dia; a pessoa responde
-- item a item pelo celular (com foto quando o item pede) e finaliza. Cada execução ganha pontualidade, esforço,
-- qualidade e score; a média do mês é a efetividade da pessoa (acima de 90% ganha o bônus de R$ 100).

create table checklist_modelos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) > 0),
  unidade_id text not null references unidades (id),
  setor text,
  momento text not null default 'outros' check (momento in ('abertura', 'troca', 'fechamento', 'outros')),
  frequencia text not null default 'diaria' check (frequencia in ('diaria', 'semanal', 'mensal')),
  dias_semana int[] not null default '{0,1,2,3,4,5,6}', -- 0 = segunda … 6 = domingo
  dia_mes int check (dia_mes between 1 and 31),
  horario time not null default '23:59', -- até quando precisa estar finalizado
  tolerancia_min int not null default 15 check (tolerancia_min >= 0),
  responsavel_id uuid references funcionarios (id),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table checklist_itens (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references checklist_modelos (id) on delete cascade,
  ordem int not null default 0,
  texto text not null check (length(trim(texto)) > 0),
  tipo text not null default 'check' check (tipo in ('check', 'numero', 'texto')),
  exige_foto boolean not null default false,
  obrigatorio boolean not null default true,
  minimo numeric, -- tipo número: fora da faixa = não conforme (ex.: temperatura)
  maximo numeric,
  instrucao text,
  ativo boolean not null default true -- item tirado do checklist some das próximas execuções, mas fica no histórico
);
create index on checklist_itens (modelo_id, ordem);

create table checklist_execucoes (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references checklist_modelos (id) on delete cascade,
  data date not null,
  prazo timestamptz not null,
  responsavel_id uuid references funcionarios (id),
  iniciado_em timestamptz,
  finalizado_em timestamptz,
  finalizado_por uuid references funcionarios (id),
  total_itens int,
  respondidos int,
  pontualidade numeric(5, 1),
  esforco numeric(5, 1),
  qualidade numeric(5, 1),
  score numeric(5, 1),
  unique (modelo_id, data)
);
create index on checklist_execucoes (data);
create index on checklist_execucoes (responsavel_id, data);

create table checklist_respostas (
  execucao_id uuid not null references checklist_execucoes (id) on delete cascade,
  item_id uuid not null references checklist_itens (id) on delete cascade,
  texto_item text not null,
  valor text, -- check: ok / nok / na; número; texto livre
  conforme boolean,
  foto text,
  observacao text,
  respondido_por uuid references funcionarios (id),
  respondido_em timestamptz not null default now(),
  primary key (execucao_id, item_id)
);

alter table checklist_modelos enable row level security;
alter table checklist_itens enable row level security;
alter table checklist_execucoes enable row level security;
alter table checklist_respostas enable row level security;

create policy "ver checklists" on checklist_modelos for select using ((eu()).id is not null);
create policy "gestao edita checklists" on checklist_modelos for all using (sou_gestao()) with check (sou_gestao());
create policy "ver itens de checklist" on checklist_itens for select using ((eu()).id is not null);
create policy "gestao edita itens de checklist" on checklist_itens for all using (sou_gestao()) with check (sou_gestao());
create policy "ver execucoes" on checklist_execucoes for select using (responsavel_id = (eu()).id or sou_gestao());
create policy "ver respostas" on checklist_respostas for select
  using (exists (select 1 from checklist_execucoes e where e.id = execucao_id and (e.responsavel_id = (eu()).id or sou_gestao())));

insert into storage.buckets (id, name, public) values ('checklists', 'checklists', false) on conflict do nothing;
create policy "ver fotos de checklist" on storage.objects for select using (bucket_id = 'checklists' and (eu()).id is not null);
create policy "enviar fotos de checklist" on storage.objects for insert with check (bucket_id = 'checklists' and (eu()).id is not null);

-- O checklist cai neste dia?
create or replace function checklist_no_dia(m checklist_modelos, d date) returns boolean
language sql immutable as $$
  select case m.frequencia
    when 'mensal' then extract(day from d)::int = least(coalesce(m.dia_mes, 1), extract(day from (date_trunc('month', d) + interval '1 month - 1 day'))::int)
    else (extract(isodow from d)::int - 1) = any (m.dias_semana)
  end
$$;

-- Gera as execuções que faltam entre p_de e p_ate (não antes do dia em que o checklist foi criado).
create or replace function gerar_checklists(p_de date, p_ate date) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if (eu()).id is null then raise exception 'Entre no portal.'; end if;
  insert into checklist_execucoes (modelo_id, data, prazo, responsavel_id)
  select m.id, d::date, ((d::date + m.horario) at time zone 'America/Sao_Paulo'), m.responsavel_id
    from checklist_modelos m
    cross join generate_series(greatest(p_de, (m.criado_em at time zone 'America/Sao_Paulo')::date), p_ate, interval '1 day') d
   where m.ativo and checklist_no_dia(m, d::date)
  on conflict (modelo_id, data) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Quem pode responder: o responsável ou a gestão.
create or replace function checklist_posso(p_exec uuid) returns checklist_execucoes
language plpgsql security definer set search_path = public as $$
declare e checklist_execucoes;
begin
  select * into e from checklist_execucoes where id = p_exec;
  if e.id is null then raise exception 'Checklist não encontrado.'; end if;
  if not (e.responsavel_id = (eu()).id or sou_gestao()) then raise exception 'Este checklist é de outra pessoa.'; end if;
  return e;
end $$;

create or replace function responder_checklist(p_exec uuid, p_item uuid, p_valor text, p_obs text, p_foto text)
returns void language plpgsql security definer set search_path = public as $$
declare
  e checklist_execucoes := checklist_posso(p_exec);
  i checklist_itens;
  v_conf boolean;
  n numeric;
begin
  if e.finalizado_em is not null then raise exception 'Este checklist já foi finalizado.'; end if;
  select * into i from checklist_itens where id = p_item and modelo_id = e.modelo_id;
  if i.id is null then raise exception 'Item não é deste checklist.'; end if;
  p_valor := nullif(trim(p_valor), '');
  if i.tipo = 'check' then
    v_conf := case p_valor when 'ok' then true when 'nok' then false else null end;
  elsif i.tipo = 'numero' and p_valor is not null then
    n := replace(p_valor, ',', '.')::numeric;
    v_conf := (i.minimo is null or n >= i.minimo) and (i.maximo is null or n <= i.maximo);
  end if;
  insert into checklist_respostas (execucao_id, item_id, texto_item, valor, conforme, foto, observacao, respondido_por)
  values (p_exec, p_item, i.texto, p_valor, v_conf, p_foto, nullif(trim(p_obs), ''), (eu()).id)
  on conflict (execucao_id, item_id) do update set valor = excluded.valor, conforme = excluded.conforme,
    foto = coalesce(excluded.foto, checklist_respostas.foto), observacao = excluded.observacao,
    respondido_por = excluded.respondido_por, respondido_em = now();
  update checklist_execucoes set iniciado_em = coalesce(iniciado_em, now()) where id = p_exec;
end $$;

-- Pontuação de uma execução:
--   esforço = itens obrigatórios respondidos (com foto, quando o item pede) ÷ obrigatórios;
--   qualidade = conformes ÷ itens avaliados (check e número com faixa);
--   pontualidade = 100 até o horário + tolerância; depois perde 2 pontos por minuto;
--   score = média das três.
create or replace function finalizar_checklist(p_exec uuid) returns checklist_execucoes
language plpgsql security definer set search_path = public as $$
declare
  e checklist_execucoes := checklist_posso(p_exec);
  v_total int; v_resp int; v_aval int; v_conf int; v_atraso numeric;
  v_pont numeric; v_esf numeric; v_qual numeric;
begin
  if e.finalizado_em is not null then return e; end if;
  select count(*) filter (where i.obrigatorio),
         count(*) filter (where i.obrigatorio and r.item_id is not null and (r.valor is not null or i.tipo = 'texto' and r.foto is not null) and (not i.exige_foto or r.foto is not null)),
         count(*) filter (where r.conforme is not null),
         count(*) filter (where r.conforme)
    into v_total, v_resp, v_aval, v_conf
    from checklist_itens i
    left join checklist_respostas r on r.execucao_id = p_exec and r.item_id = i.id
   where i.modelo_id = e.modelo_id and (i.ativo or r.item_id is not null);
  select tolerancia_min into v_atraso from checklist_modelos where id = e.modelo_id;
  v_atraso := greatest(0, extract(epoch from (now() - e.prazo)) / 60 - v_atraso);
  v_pont := greatest(0, 100 - 2 * v_atraso);
  v_esf := case when v_total > 0 then 100.0 * v_resp / v_total else 100 end;
  v_qual := case when v_aval > 0 then 100.0 * v_conf / v_aval end;
  update checklist_execucoes set
    iniciado_em = coalesce(iniciado_em, now()), finalizado_em = now(), finalizado_por = (eu()).id,
    total_itens = v_total, respondidos = v_resp,
    pontualidade = round(v_pont, 1), esforco = round(v_esf, 1), qualidade = round(v_qual, 1),
    score = round((v_pont + v_esf + coalesce(v_qual, v_esf)) / 3, 1)
  where id = p_exec returning * into e;
  return e;
end $$;

-- A gestão reabre um checklist finalizado por engano (a pontuação é refeita ao finalizar de novo).
create or replace function reabrir_checklist(p_exec uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not sou_gestao() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  update checklist_execucoes set finalizado_em = null, finalizado_por = null, pontualidade = null, esforco = null, qualidade = null, score = null
  where id = p_exec;
end $$;

-- A gestão troca o responsável de uma execução (folga, troca de turno).
create or replace function trocar_responsavel_checklist(p_exec uuid, p_func uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not sou_gestao() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  update checklist_execucoes set responsavel_id = p_func where id = p_exec and finalizado_em is null;
end $$;

-- Ao trocar o responsável ou o horário do checklist, as execuções ainda não feitas de hoje em diante acompanham.
create or replace function checklist_modelo_mudou() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.atualizado_em := now();
  if new.responsavel_id is distinct from old.responsavel_id or new.horario is distinct from old.horario then
    update checklist_execucoes set responsavel_id = new.responsavel_id, prazo = ((data + new.horario) at time zone 'America/Sao_Paulo')
     where modelo_id = new.id and finalizado_em is null and iniciado_em is null and data >= (now() at time zone 'America/Sao_Paulo')::date;
  end if;
  if not new.ativo and old.ativo then
    delete from checklist_execucoes where modelo_id = new.id and iniciado_em is null and data >= (now() at time zone 'America/Sao_Paulo')::date;
  end if;
  return new;
end $$;
create trigger checklist_modelo_mudou before update on checklist_modelos for each row execute function checklist_modelo_mudou();
