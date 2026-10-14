-- Heitor (14/10): os supervisores também veem e usam o menu Produção (pedidos das lojas, inventário),
-- com as mesmas permissões de quem é do setor Produção.
create or replace function sou_producao() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((eu()).setor::text = 'producao' or (eu()).nivel::text = 'supervisor', false)
$$;

-- Heitor (14/10): supervisores também usam Compras e Estoque como a gestão (pedidos de compra, entregas,
-- uniformes, notas fiscais, saldo e movimentos). Contas a pagar, conciliação e documentos da equipe continuam só gestão.
create function sou_supervisor() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((eu()).nivel::text = 'supervisor', false)
$$;

-- Regras de acesso das tabelas de compras e estoque: onde vale a gestão, passa a valer gestão ou supervisor.
do $$
declare
  p record;
  v_using text;
  v_check text;
begin
  for p in
    select * from pg_policies
    where schemaname = 'public'
      and tablename in ('categorias_insumo', 'compras_historico', 'compras_pedidos', 'estoque_movimentos', 'fornecedor_produtos',
        'fornecedores', 'insumo_precos', 'insumos', 'nota_itens', 'notas_fiscais', 'centros_custo', 'plano_contas', 'produtos_venda',
        'inventarios_estoque', 'inventario_estoque_itens', 'uniforme_devolucoes', 'uniforme_entregas', 'uniforme_estoque',
        'uniforme_pedido_itens', 'uniforme_pedidos', 'uniforme_solicitacoes', 'uniforme_valores')
      and (coalesce(qual, '') like '%sou_gestao()%' or coalesce(with_check, '') like '%sou_gestao()%')
  loop
    v_using := replace(p.qual, 'sou_gestao()', '(sou_gestao() or sou_supervisor())');
    v_check := replace(p.with_check, 'sou_gestao()', '(sou_gestao() or sou_supervisor())');
    execute format('alter policy %I on %I.%I%s%s', p.policyname, p.schemaname, p.tablename,
      case when v_using is not null then format(' using (%s)', v_using) else '' end,
      case when v_check is not null then format(' with check (%s)', v_check) else '' end);
  end loop;
end $$;

-- Funções das mesmas telas: a mesma troca no teste de acesso.
do $$
declare
  f record;
  v_def text;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('compras_do_fornecedor', 'estornar_nota', 'importar_nota', 'lancar_nota', 'marcar_compra_recebida',
        'precos_fornecedor', 'saldos_estoque', 'nota_ensina_razao_social')
  loop
    v_def := pg_get_functiondef(f.oid);
    if v_def like '%sou_gestao()%' then
      execute replace(v_def, 'sou_gestao()', '(sou_gestao() or sou_supervisor())');
    end if;
  end loop;
end $$;
