-- Pagamento dos motoboys por dia (Heitor, 12/10): a diária (R$ 100) já inclui as primeiras 10 entregas do dia;
-- da 11ª em diante cada entrega paga R$ 4. Valores por motoboy, editáveis no cadastro. A semana guarda as entregas
-- de cada dia (dias = {"2026-10-14": 13, ...}) para conferência.
alter table motoboys add column valor_diaria numeric(10, 2) not null default 100 check (valor_diaria >= 0);
alter table motoboys add column entregas_incluidas int not null default 10 check (entregas_incluidas >= 0);
alter table motoboys add column valor_entrega numeric(10, 2) not null default 4 check (valor_entrega >= 0);
alter table motoboy_semanas add column dias jsonb not null default '{}';

create or replace function salvar_motoboys_semana(p_pagamento date, p_unidade text, p_linhas jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare
  l jsonb;
  v_moto motoboys;
  v_diarias numeric;
  v_entregas numeric;
  v_extras jsonb;
  v_dias jsonb;
  v_total numeric;
  v_pago boolean;
  v_origem text;
  v_conc boolean;
  v_desc text;
  n int := 0;
begin
  if not sou_gestao() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  if not exists (select 1 from unidades where id = p_unidade) then raise exception 'Escolha a loja.'; end if;
  for l in select * from jsonb_array_elements(coalesce(p_linhas, '[]')) loop
    select * into v_moto from motoboys where id = (l->>'motoboy_id')::uuid;
    if v_moto.id is null then raise exception 'Motoboy não encontrado.'; end if;
    v_diarias := round(coalesce((l->>'diarias')::numeric, 0), 2);
    v_entregas := round(coalesce((l->>'entregas')::numeric, 0), 2);
    select coalesce(jsonb_agg(jsonb_build_object('descricao', trim(e->>'descricao'), 'valor', round((e->>'valor')::numeric, 2))), '[]')
      into v_extras
      from jsonb_array_elements(case when jsonb_typeof(l->'extras') = 'array' then l->'extras' else '[]' end) e
      where coalesce((e->>'valor')::numeric, 0) <> 0;
    v_total := v_diarias + v_entregas + coalesce((select sum((e->>'valor')::numeric) from jsonb_array_elements(v_extras) e), 0);
    v_dias := case when jsonb_typeof(l->'dias') = 'object' then l->'dias' else '{}' end;
    v_pago := coalesce((l->>'ja_pago')::boolean, false);
    v_origem := 'moto:' || v_moto.id || ':' || p_pagamento || ':' || p_unidade;
    select conciliado into v_conc from contas_pagar where origem = v_origem;
    if coalesce(v_conc, false) then continue; end if;

    if v_total <= 0 then
      delete from motoboy_semanas where motoboy_id = v_moto.id and unidade_id = p_unidade and pagamento = p_pagamento;
      delete from contas_pagar where origem = v_origem and not conciliado;
      continue;
    end if;

    insert into motoboy_semanas (motoboy_id, unidade_id, pagamento, diarias, entregas, extras, dias, total, atualizado_por)
    values (v_moto.id, p_unidade, p_pagamento, v_diarias, v_entregas, v_extras, v_dias, v_total, (eu()).id)
    on conflict (motoboy_id, unidade_id, pagamento) do update set diarias = excluded.diarias, entregas = excluded.entregas,
      extras = excluded.extras, dias = excluded.dias, total = excluded.total, atualizado_em = now(), atualizado_por = excluded.atualizado_por;

    v_desc := 'Motoboy ' || to_char(p_pagamento - 7, 'DD/MM') || ' a ' || to_char(p_pagamento - 1, 'DD/MM') || ' · ' || v_moto.nome;
    insert into contas_pagar (centro_custo_id, conta_id, motoboy_id, favorecido, descricao, competencia, vencimento, valor, forma, origem, lote,
      observacao, pago_em, valor_pago)
    values (p_unidade, conta_ecletica('02001005002'), v_moto.id, v_moto.nome, v_desc, date_trunc('month', p_pagamento - 1)::date, p_pagamento,
      v_total, 'pix', v_origem, 'moto:' || p_pagamento, 'Lançada pela semana dos motoboys',
      case when v_pago then least(current_date, p_pagamento) end, case when v_pago then v_total end)
    on conflict (origem) do update set valor = excluded.valor, descricao = excluded.descricao, vencimento = excluded.vencimento,
      pago_em = case when v_pago then coalesce(contas_pagar.pago_em, excluded.pago_em) end,
      valor_pago = case when v_pago then excluded.valor end
    where not contas_pagar.conciliado;
    n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function salvar_motoboys_semana(date, text, jsonb) to authenticated;

drop function semanas_motoboys(date, date);
create function semanas_motoboys(p_de date, p_ate date)
returns table (id uuid, motoboy_id uuid, unidade_id text, pagamento date, diarias numeric, entregas numeric, extras jsonb, total numeric,
  pago_em date, conciliado boolean, dias jsonb)
language sql stable security definer set search_path = public as $$
  select s.id, s.motoboy_id, s.unidade_id, s.pagamento, s.diarias, s.entregas, s.extras, s.total, c.pago_em, coalesce(c.conciliado, false), s.dias
  from motoboy_semanas s
  left join contas_pagar c on c.origem = 'moto:' || s.motoboy_id || ':' || s.pagamento || ':' || s.unidade_id
  where sou_gestao() and s.pagamento between p_de and p_ate
  order by s.pagamento desc
$$;
grant execute on function semanas_motoboys(date, date) to authenticated;
