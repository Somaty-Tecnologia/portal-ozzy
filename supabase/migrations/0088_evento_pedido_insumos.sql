-- Heitor (13/10): nos insumos a providenciar do evento, "Pedir (final)" é a quantidade que ele decide pedir
-- (o Providenciar é só a sugestão). Fica salvo por evento e insumo; em branco = não decidiu.
create table evento_pedido_insumos (
  evento_id uuid not null references eventos (id) on delete cascade,
  insumo_id uuid not null references insumos (id) on delete cascade,
  quantidade numeric(12, 3) not null check (quantidade >= 0),
  atualizado_em timestamptz not null default now(),
  primary key (evento_id, insumo_id)
);
alter table evento_pedido_insumos enable row level security;
create policy "gestao ve pedido de insumos do evento" on evento_pedido_insumos for select using (sou_gestao());
create policy "gestao edita pedido de insumos do evento" on evento_pedido_insumos for all using (sou_gestao()) with check (sou_gestao());
grant select, insert, update, delete on evento_pedido_insumos to authenticated;
