-- Motoboys (Heitor, 12/10): um deles pode ser o responsável pelos motoboys e recebe um adicional por semana
-- (R$ 125, entra sozinho como extra na semana); e a escala da semana por loja, com os horários de cada dia.
alter table motoboys add column responsavel boolean not null default false;
alter table motoboys add column adicional_responsavel numeric(10, 2) not null default 125 check (adicional_responsavel >= 0);

-- Horário dos motoboys por loja e dia (0 = segunda … 6 = domingo). Dia sem linha = loja fechada.
create table motoboy_turnos (
  unidade_id text not null references unidades (id),
  dia smallint not null check (dia between 0 and 6),
  inicio time not null,
  fim time not null,
  primary key (unidade_id, dia)
);
alter table motoboy_turnos enable row level security;
create policy "gestao ve turnos de motoboy" on motoboy_turnos for select using ((select sou_gestao()));
create policy "gestao muda turnos de motoboy" on motoboy_turnos for all using ((select sou_gestao())) with check ((select sou_gestao()));
grant select, insert, update, delete on motoboy_turnos to authenticated;

-- PSD: ter, qua, qui e dom 18h–22h30; sex e sáb 18h–23h30. Vila: ter a dom 18h–23h. Segunda nenhuma abre.
-- A Pizza usa os motoboys da Vila, então não tem escala própria.
insert into motoboy_turnos (unidade_id, dia, inicio, fim)
select 'burger-psd', d, '18:00'::time, case when d in (4, 5) then '23:30'::time else '22:30'::time end from generate_series(1, 6) d
where exists (select 1 from unidades where id = 'burger-psd')
union all
select 'burger-va', d, '18:00'::time, '23:00'::time from generate_series(1, 6) d
where exists (select 1 from unidades where id = 'burger-va');

-- Quem está escalado em cada dia.
create table motoboy_escala (
  id uuid primary key default gen_random_uuid(),
  motoboy_id uuid not null references motoboys (id),
  unidade_id text not null references unidades (id),
  data date not null,
  criado_em timestamptz not null default now(),
  criado_por uuid references funcionarios (id) default (eu()).id,
  unique (motoboy_id, data)
);
create index on motoboy_escala (data);
alter table motoboy_escala enable row level security;
create policy "gestao ve escala de motoboy" on motoboy_escala for select using ((select sou_gestao()));
create policy "gestao muda escala de motoboy" on motoboy_escala for all using ((select sou_gestao())) with check ((select sou_gestao()));
grant select, insert, update, delete on motoboy_escala to authenticated;
