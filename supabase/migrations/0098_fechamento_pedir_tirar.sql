-- Heitor (13/10): quem preenche o fechamento pode pedir para tirar um item da lista; a gestão aprova ou nega.
-- Aprovado, o item sai da lista das duas lojas (a lista é a mesma na PSD e na Vila).
create table fechamento_pedidos_tirar (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references unidades (id),
  setor text not null check (setor in ('cozinha', 'atendimento')),
  insumo_id uuid not null references insumos (id),
  motivo text,
  pedido_por uuid references funcionarios (id) default (eu()).id,
  criado_em timestamptz not null default now(),
  status text not null default 'pendente' check (status in ('pendente', 'tirado', 'mantido')),
  resolvido_por uuid references funcionarios (id),
  resolvido_em timestamptz
);
create index on fechamento_pedidos_tirar (status);
alter table fechamento_pedidos_tirar enable row level security;
create policy "ve pedidos para tirar" on fechamento_pedidos_tirar for select
  using (sou_gestao() or unidade_id = (eu()).unidade_id or pedido_por = (eu()).id);
create policy "quem e da loja pede para tirar" on fechamento_pedidos_tirar for insert
  with check (pedido_por = (eu()).id and status = 'pendente' and (sou_gestao() or unidade_id = (eu()).unidade_id));

-- Aprovar (tira das duas lojas) ou negar: só a gestão.
create function resolver_pedido_tirar(p_id uuid, p_tirar boolean) returns void
language plpgsql security definer set search_path = public as $$
declare p fechamento_pedidos_tirar;
begin
  if not sou_gestao() then raise exception 'Só a gestão aprova ou nega.'; end if;
  select * into p from fechamento_pedidos_tirar where id = p_id;
  if p.id is null or p.status <> 'pendente' then raise exception 'Pedido não encontrado ou já resolvido.'; end if;
  if p_tirar then
    update fechamento_itens set ativo = false where setor = p.setor and insumo_id = p.insumo_id;
  end if;
  -- Outros pedidos para o mesmo item ficam resolvidos junto.
  update fechamento_pedidos_tirar set status = case when p_tirar then 'tirado' else 'mantido' end, resolvido_por = (eu()).id, resolvido_em = now()
    where setor = p.setor and insumo_id = p.insumo_id and status = 'pendente';
end $$;
revoke execute on function resolver_pedido_tirar(uuid, boolean) from public, anon;
grant execute on function resolver_pedido_tirar(uuid, boolean) to authenticated;
