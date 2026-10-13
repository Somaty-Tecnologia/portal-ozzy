-- Heitor (13/10): na separação do evento apareciam itens sem nome ("previsto 0,6"): a ficha usa um material
-- ou pré-preparo inativo, e a lista de itens só trazia os ativos. Agora traz todos, com a marca de ativo;
-- as listas para escolher item continuam só com os ativos.
drop function if exists itens_contagem();
create function itens_contagem()
returns table (tipo text, id uuid, nome text, categoria text, unidade text, embalagem text, embalagem_qtd numeric, ativo boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (sou_gestao() or exists (select 1 from evento_responsaveis where funcionario_id = (eu()).id)) then
    raise exception 'Seu nível de acesso não permite esta ação.';
  end if;
  return query
    select 'insumo', i.id, i.nome, i.categoria, i.unidade, i.embalagem, i.embalagem_qtd, i.ativo from insumos i
    union all
    select 'preparo', r.id, r.nome, 'Pré-preparos', r.unidade, null::text, null::numeric, r.ativo from receitas r where r.tipo = 'preparo'
    order by 3;
end $$;
revoke execute on function itens_contagem() from public, anon;
grant execute on function itens_contagem() to authenticated;
