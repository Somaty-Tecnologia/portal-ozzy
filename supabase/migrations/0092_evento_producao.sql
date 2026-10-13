-- Heitor (13/10): produção do evento por dia (segunda a domingo da semana anterior ao evento).
-- Pré-preparos que o cálculo pede + itens que ele põe à mão (ex.: calabresa fatiada pizza, que não é pré-preparo).
-- dia nulo = item posto à mão, sem dia ainda (marca que ele está na lista).
create table evento_producao (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos (id) on delete cascade,
  insumo_id uuid references insumos (id) on delete cascade,
  receita_id uuid references receitas (id) on delete cascade,
  dia date,
  quantidade numeric(12, 3) not null default 0 check (quantidade >= 0),
  check (num_nonnulls(insumo_id, receita_id) = 1)
);
create unique index on evento_producao (evento_id, coalesce(insumo_id, receita_id), coalesce(dia, '1900-01-01'));
alter table evento_producao enable row level security;
create policy "gestao ve producao do evento" on evento_producao for select using ((select sou_gestao()));
create policy "gestao edita producao do evento" on evento_producao for all using ((select sou_gestao())) with check ((select sou_gestao()));
grant select, insert, update, delete on evento_producao to authenticated;
