-- Caixa das lojas (Heitor, 13/10): um turno por dia e loja, com o dinheiro do início, as sangrias do dia
-- (saída do caixa para comprar algo), o valor contado no fechamento, o que foi enviado ao escritório,
-- observação e o responsável (quem fecha). Quem é da loja lança; depois de fechado só a gestão mexe.
create table caixa_turnos (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references unidades (id),
  data date not null,
  valor_inicial numeric(12, 2) not null default 0,
  valor_final numeric(12, 2),
  valor_enviado numeric(12, 2),
  observacao text,
  responsavel_id uuid references funcionarios (id),
  aberto_por uuid references funcionarios (id) default (eu()).id,
  aberto_em timestamptz not null default now(),
  fechado_por uuid references funcionarios (id),
  fechado_em timestamptz,
  unique (unidade_id, data)
);
create table caixa_sangrias (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references caixa_turnos (id) on delete cascade,
  valor numeric(12, 2) not null check (valor > 0),
  descricao text not null,
  criado_por uuid references funcionarios (id) default (eu()).id,
  criado_em timestamptz not null default now()
);
create index on caixa_sangrias (turno_id);

alter table caixa_turnos enable row level security;
alter table caixa_sangrias enable row level security;
create function caixa_da_loja(p_unidade text) returns boolean language sql stable security definer set search_path = public as $$
  select sou_gestao() or p_unidade = (eu()).unidade_id
$$;
create policy "ve caixa da loja" on caixa_turnos for select using (caixa_da_loja(unidade_id));
create policy "abre caixa da loja" on caixa_turnos for insert with check (caixa_da_loja(unidade_id) and fechado_em is null);
create policy "lanca no caixa aberto" on caixa_turnos for update
  using (sou_gestao() or (caixa_da_loja(unidade_id) and fechado_em is null)) with check (caixa_da_loja(unidade_id));
create policy "gestao apaga caixa" on caixa_turnos for delete using (sou_gestao());

create function caixa_aberto(p_turno uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from caixa_turnos t where t.id = p_turno and (sou_gestao() or (caixa_da_loja(t.unidade_id) and t.fechado_em is null)))
$$;
create policy "ve sangrias" on caixa_sangrias for select
  using (exists (select 1 from caixa_turnos t where t.id = turno_id and caixa_da_loja(t.unidade_id)));
create policy "lanca sangria" on caixa_sangrias for insert with check (caixa_aberto(turno_id));
create policy "apaga sangria" on caixa_sangrias for delete using (caixa_aberto(turno_id));
