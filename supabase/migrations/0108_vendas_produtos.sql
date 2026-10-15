-- Vendas por produto das lojas (Heitor, 15/10): a exportação "Vendas por cupons" da Eclética é importada pela
-- tela (Produção › Vendas das lojas), somada por loja, dia, produto e canal. Com as fichas, vira o estoque ideal
-- do fechamento e a sugestão de compra da semana. Só a gestão vê.
create table vendas_produtos (
  unidade_id text not null references unidades (id),
  data date not null, -- dia de operação: venda depois da meia-noite (até 5 h) conta no dia anterior
  codigo text not null, -- código do produto na Eclética
  delivery boolean not null default false,
  nome text not null,
  quantidade numeric(14, 3) not null,
  valor numeric(14, 2) not null default 0,
  importado_em timestamptz not null default now(),
  primary key (unidade_id, data, codigo, delivery)
);
create index on vendas_produtos (data);
alter table vendas_produtos enable row level security;
create policy "gestao ve vendas por produto" on vendas_produtos for select using (sou_gestao());
grant select on vendas_produtos to authenticated;

-- Substitui os dias que vieram no arquivo (de cada loja): importar de novo o mesmo período não duplica.
create function importar_vendas(p_linhas jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not sou_gestao() then raise exception 'Só a gestão importa as vendas.'; end if;
  delete from vendas_produtos v
  using (select distinct x->>'unidade_id' u, (x->>'data')::date d from jsonb_array_elements(p_linhas) x) dias
  where v.unidade_id = dias.u and v.data = dias.d;
  insert into vendas_produtos (unidade_id, data, codigo, delivery, nome, quantidade, valor)
  select x->>'unidade_id', (x->>'data')::date, x->>'codigo', coalesce((x->>'delivery')::boolean, false), x->>'nome',
    (x->>'quantidade')::numeric, coalesce((x->>'valor')::numeric, 0)
  from jsonb_array_elements(p_linhas) x;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
grant execute on function importar_vendas(jsonb) to authenticated;

-- O que já foi importado: por loja e mês.
create function vendas_resumo()
returns table (unidade_id text, mes date, dias int, primeiro date, ultimo date, quantidade numeric, valor numeric)
language sql stable security definer set search_path = public as $$
  select v.unidade_id, date_trunc('month', v.data)::date, count(distinct v.data)::int, min(v.data), max(v.data), sum(v.quantidade), sum(v.valor)
  from vendas_produtos v
  where sou_gestao()
  group by 1, 2
  order by 1, 2
$$;
grant execute on function vendas_resumo() to authenticated;

-- Média de cada produto por dia da semana (0 = segunda), nas últimas p_semanas até p_ate: soma ÷ dias em que a
-- loja vendeu naquele dia da semana (dia fechado não puxa a média para baixo).
create function vendas_medias(p_ate date, p_semanas int default 8)
returns table (unidade_id text, dia_semana int, codigo text, delivery boolean, nome text, media numeric, dias int)
language sql stable security definer set search_path = public as $$
  with janela as (
    select * from vendas_produtos v where sou_gestao() and v.data <= p_ate and v.data > p_ate - 7 * p_semanas
  ), abertos as (
    select j.unidade_id, extract(isodow from j.data)::int - 1 dow, count(distinct j.data)::int n from janela j group by 1, 2
  )
  select j.unidade_id, a.dow, j.codigo, j.delivery, max(j.nome), round(sum(j.quantidade) / a.n, 3), a.n
  from janela j join abertos a on a.unidade_id = j.unidade_id and a.dow = extract(isodow from j.data)::int - 1
  group by j.unidade_id, a.dow, a.n, j.codigo, j.delivery
$$;
grant execute on function vendas_medias(date, int) to authenticated;

-- Fornecedor de cada material, para agrupar a sugestão de compra: o da última compra (pedido, nota ou
-- histórico da Eclética), com o preço dela.
create function ultimo_fornecedor_insumos()
returns table (insumo_id uuid, fornecedor_id uuid, preco numeric, em date)
language sql stable security definer set search_path = public as $$
  select distinct on (t.insumo_id) t.insumo_id, t.fornecedor_id, round(t.preco, 4), t.em
  from (
    select (x->>'insumo_id')::uuid insumo_id, p.fornecedor_id, (x->>'preco')::numeric preco, p.data_pedido em, p.criado_em quando
    from compras_pedidos p, jsonb_array_elements(p.itens) x
    where p.status <> 'cancelado' and p.fornecedor_id is not null
    union all
    select ni.insumo_id, n.fornecedor_id, ni.valor_total / nullif(ni.quantidade, 0) / coalesce(ni.fator, 1), n.emissao, n.criado_em
    from nota_itens ni join notas_fiscais n on n.id = ni.nota_id
    where n.fornecedor_id is not null and ni.insumo_id is not null
    union all
    select h.insumo_id, h.fornecedor_id, h.preco, h.data::date, h.data
    from compras_historico h
    where h.fornecedor_id is not null and h.insumo_id is not null
  ) t
  where sou_gestao()
  order by t.insumo_id, t.em desc, t.quando desc
$$;
grant execute on function ultimo_fornecedor_insumos() to authenticated;
