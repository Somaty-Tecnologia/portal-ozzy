-- Heitor (13/10): além de pedir para tirar, quem preenche o fechamento pode pedir para incluir um item.
-- A loja não vê o cadastro de materiais: escreve o nome, e a gestão escolhe o material ao aprovar.
alter table fechamento_pedidos_tirar add column tipo text not null default 'tirar' check (tipo in ('tirar', 'incluir'));
alter table fechamento_pedidos_tirar add column nome text;
alter table fechamento_pedidos_tirar alter column insumo_id drop not null;
alter table fechamento_pedidos_tirar add constraint pedido_lista_tem_item check (insumo_id is not null or nome is not null);
alter table fechamento_pedidos_tirar drop constraint fechamento_pedidos_tirar_status_check;
alter table fechamento_pedidos_tirar add constraint fechamento_pedidos_tirar_status_check
  check (status in ('pendente', 'tirado', 'mantido', 'incluido', 'recusado'));

-- Aceitar ou negar um pedido (tirar ou incluir). Incluir entra nas duas lojas (a lista é a mesma).
create function resolver_pedido_lista(p_id uuid, p_aceitar boolean, p_insumo uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  p fechamento_pedidos_tirar;
  v_insumo uuid;
  v_un text;
begin
  if not sou_gestao() then raise exception 'Só a gestão aprova ou nega.'; end if;
  select * into p from fechamento_pedidos_tirar where id = p_id;
  if p.id is null or p.status <> 'pendente' then raise exception 'Pedido não encontrado ou já resolvido.'; end if;
  if p.tipo = 'tirar' then
    perform resolver_pedido_tirar(p_id, p_aceitar);
    return;
  end if;
  if p_aceitar then
    v_insumo := coalesce(p_insumo, p.insumo_id);
    if v_insumo is null then raise exception 'Escolha o material para incluir.'; end if;
    select case unidade when 'kg' then 'Kg' when 'l' then 'Lts' else 'Uni' end into v_un from insumos where id = v_insumo;
    insert into fechamento_itens (unidade_id, setor, insumo_id, unidade_contagem, ordem, ativo)
      select u, p.setor, v_insumo, coalesce(v_un, 'Uni'),
        coalesce((select max(ordem) from fechamento_itens where unidade_id = u and setor = p.setor), 0) + 1, true
      from unnest(array['burger-psd', 'burger-va']) u
      on conflict (unidade_id, setor, insumo_id) do update set ativo = true;
  end if;
  update fechamento_pedidos_tirar set status = case when p_aceitar then 'incluido' else 'recusado' end,
    insumo_id = coalesce(p_insumo, insumo_id), resolvido_por = (eu()).id, resolvido_em = now()
    where id = p_id;
end $$;
revoke execute on function resolver_pedido_lista(uuid, boolean, uuid) from public, anon;
grant execute on function resolver_pedido_lista(uuid, boolean, uuid) to authenticated;

-- Tirar resolve só os pedidos de tirar do mesmo item.
create or replace function resolver_pedido_tirar(p_id uuid, p_tirar boolean) returns void
language plpgsql security definer set search_path = public as $$
declare p fechamento_pedidos_tirar;
begin
  if not sou_gestao() then raise exception 'Só a gestão aprova ou nega.'; end if;
  select * into p from fechamento_pedidos_tirar where id = p_id;
  if p.id is null or p.status <> 'pendente' or p.tipo <> 'tirar' then raise exception 'Pedido não encontrado ou já resolvido.'; end if;
  if p_tirar then
    update fechamento_itens set ativo = false where setor = p.setor and insumo_id = p.insumo_id;
  end if;
  update fechamento_pedidos_tirar set status = case when p_tirar then 'tirado' else 'mantido' end, resolvido_por = (eu()).id, resolvido_em = now()
    where setor = p.setor and insumo_id = p.insumo_id and tipo = 'tirar' and status = 'pendente';
end $$;
