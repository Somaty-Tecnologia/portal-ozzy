-- Heitor (13/10): "pesto de rúcula" estava nas fichas de pré-preparo mas não no cadastro de materiais.
-- O material do pré-preparo só nascia ao lançar a primeira produção. Agora toda ficha de pré-preparo
-- já tem o seu material (para ter saldo, contar no inventário e abater na necessidade dos eventos).
create or replace function ligar_material_do_preparo(p_receita uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  r receitas;
  v_insumo uuid;
begin
  select * into r from receitas where id = p_receita;
  if r.id is null or r.tipo <> 'preparo' then return null; end if;
  if r.insumo_id is not null then return r.insumo_id; end if;
  -- Um material com o mesmo nome e a mesma unidade é o dele; com outra unidade, não mexe.
  select id into v_insumo from insumos where lower(nome) = lower(r.nome) and unidade = r.unidade limit 1;
  if v_insumo is null then
    if exists (select 1 from insumos where lower(nome) = lower(r.nome)) then return null; end if;
    insert into insumos (nome, categoria, unidade, observacao, ativo, pre_preparo)
    values (r.nome, 'Pré-preparos', r.unidade, 'Produção própria (ficha de pré-preparo).', r.ativo, true)
    returning id into v_insumo;
  else
    update insumos set pre_preparo = true, categoria = coalesce(categoria, 'Pré-preparos') where id = v_insumo;
  end if;
  update receitas set insumo_id = v_insumo where id = r.id;
  return v_insumo;
end $$;
revoke execute on function ligar_material_do_preparo(uuid) from public, anon, authenticated;

create or replace function receitas_material_do_preparo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.tipo = 'preparo' and new.insumo_id is null then perform ligar_material_do_preparo(new.id); end if;
  return null;
end $$;
create trigger receitas_material_do_preparo after insert or update of tipo, nome on receitas
  for each row execute function receitas_material_do_preparo();

-- As fichas que já existem.
select ligar_material_do_preparo(id) from receitas where tipo = 'preparo' and insumo_id is null;
