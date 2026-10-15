-- A memória da conciliação (fornecedor_produtos) é por CNPJ + código e não guardava a unidade da nota.
-- Quando o fornecedor muda a unidade do mesmo código (muçarela da PMG: antes por peça de 4 kg, agora em KG),
-- o fator antigo era aplicado de novo e o custo saía dividido (R$ 34,98/kg virou R$ 8,74/kg).
-- Agora, ao entrar um item de nota com fator lembrado:
--   - se a nota já vem na unidade do insumo (KG e kg, L e l, UN e un), o fator é 1;
--   - se a última nota desse código veio em outra unidade, o fator fica em branco para conferir.
create or replace function nota_item_confere_fator() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_un_insumo text;
  v_cnpj text;
  v_un_antes text;
begin
  if new.insumo_id is null or new.fator is null or new.fator = 1 then return new; end if;
  select lower(unidade) into v_un_insumo from insumos where id = new.insumo_id;
  if lower(coalesce(new.unidade, '')) = v_un_insumo then
    new.fator := 1;
    return new;
  end if;
  select emitente_cnpj into v_cnpj from notas_fiscais where id = new.nota_id;
  select i.unidade into v_un_antes
    from nota_itens i join notas_fiscais n on n.id = i.nota_id
    where n.emitente_cnpj = v_cnpj and i.codigo = new.codigo and i.fator is not null and i.nota_id <> new.nota_id
    order by n.emissao desc nulls last, i.id desc limit 1;
  if v_un_antes is not null and lower(v_un_antes) <> lower(coalesce(new.unidade, '')) then
    new.fator := null;
  end if;
  return new;
end $$;

drop trigger if exists nota_item_confere_fator on nota_itens;
create trigger nota_item_confere_fator before insert on nota_itens
  for each row execute function nota_item_confere_fator();
