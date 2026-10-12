-- Heitor, 12/10:
-- 1) Materiais e produtos nunca com tudo minúsculo: a primeira letra de cada palavra fica maiúscula (o resto como
--    foi digitado, para não estragar siglas como BBQ). Preposições do meio e unidades (kg, ml, g…) ficam minúsculas.
--    Vale para o que já existe e para tudo que entrar depois (telas, notas, importações). O índice único é por
--    lower(nome), então mudar só a caixa nunca colide com outro item.
-- 2) Motoboy novo se cadastra sozinho no link (#/motoboy): nome, CPF e Pix obrigatórios.

create or replace function nome_item(n text) returns text
language plpgsql immutable as $$
declare
  partes text[];
  saida text[] := '{}';
  p text;
  i int := 0;
  pre text;
  resto text;
begin
  if n is null then return null; end if;
  partes := regexp_split_to_array(trim(regexp_replace(n, '\s+', ' ', 'g')), ' ');
  foreach p in array partes loop
    i := i + 1;
    if i > 1 and lower(p) in ('a', 'as', 'o', 'os', 'da', 'das', 'de', 'di', 'do', 'dos', 'du', 'e', 'em', 'com', 'sem', 'para', 'p/', 'c/', 's/') then
      saida := saida || lower(p);
    elsif lower(p) in ('kg', 'g', 'gr', 'mg', 'ml', 'l', 'lt', 'un', 'und', 'cm', 'mm', 'x') then
      saida := saida || lower(p);
    else
      -- Pula abre-parêntese/aspas do começo: "(sem" → "(Sem".
      pre := substring(p from '^[("\[]*');
      resto := substr(p, length(pre) + 1);
      saida := saida || (pre || upper(left(resto, 1)) || substr(resto, 2));
    end if;
  end loop;
  return array_to_string(saida, ' ');
end $$;

create or replace function acerta_nome_item() returns trigger
language plpgsql as $$
begin
  new.nome := nome_item(new.nome);
  return new;
end $$;

create trigger nome_com_maiuscula before insert or update of nome on insumos
  for each row execute function acerta_nome_item();
create trigger nome_com_maiuscula before insert or update of nome on produtos_venda
  for each row execute function acerta_nome_item();
update insumos set nome = nome_item(nome) where nome is distinct from nome_item(nome);
update produtos_venda set nome = nome_item(nome) where nome is distinct from nome_item(nome);

-- Motoboys: nome de pessoa, igual à equipe (0025).
create trigger nome_com_maiuscula before insert or update of nome on motoboys
  for each row execute function acerta_nome();
update motoboys set nome = nome_proprio(nome) where nome is distinct from nome_proprio(nome);

-- Cadastro pelo próprio motoboy, no link. Celular já cadastrado: só devolve quem é.
create function motoboy_cadastrar(p_celular text, p_nome text, p_cpf text, p_pix text, p_unidade text) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_cel text := right(regexp_replace(p_celular, '\D', '', 'g'), 11);
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_nome text := nome_proprio(p_nome);
begin
  if length(v_cel) < 10 then raise exception 'Coloque o celular com DDD.'; end if;
  if exists (select 1 from motoboys where ativo and right(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), 11) = v_cel) then
    return motoboy_quem_sou(v_cel);
  end if;
  if v_nome is null or array_length(regexp_split_to_array(v_nome, ' '), 1) < 2 then raise exception 'Coloque o nome completo.'; end if;
  if not cpf_valido(v_cpf) then raise exception 'CPF inválido. Confira os números.'; end if;
  if trim(coalesce(p_pix, '')) = '' then raise exception 'Coloque a chave Pix.'; end if;
  if p_unidade is not null and not exists (select 1 from unidades where id = p_unidade and id not in ('central', 'eventos')) then
    raise exception 'Escolha a loja.';
  end if;
  if exists (select 1 from motoboys where regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = v_cpf) then
    raise exception 'Esse CPF já está cadastrado com outro celular. Fale com a gerente para trocar o celular.';
  end if;
  insert into motoboys (nome, unidade_id, pix, telefone, cpf, observacao)
  values (v_nome, p_unidade, trim(p_pix), v_cel, v_cpf, 'Cadastro feito pelo próprio motoboy no link');
  return motoboy_quem_sou(v_cel);
end $$;
revoke execute on function motoboy_cadastrar(text, text, text, text, text) from public;
grant execute on function motoboy_cadastrar(text, text, text, text, text) to anon, authenticated;
