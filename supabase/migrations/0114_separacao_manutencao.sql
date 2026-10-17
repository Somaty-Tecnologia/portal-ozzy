-- Separação dos eventos para o manutencista (Heitor, 17/10/2026): só a separação, sem o resto do menu Eventos.
-- Ele vê os eventos em andamento (aprovado, preparação, execução) como se estivesse escalado, com o papel
-- 'Separação (manutenção)', e confere a saída e o retorno dos itens. Não monta separação, não conta sobras,
-- não vê fichas, previsão, vendas nem freelas.
create function separo_eventos() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((eu()).nivel = 'manutencao', false)
$$;

create or replace function meus_eventos_escalados()
returns table (id uuid, nome text, status text, papel text, dias jsonb)
language sql stable security definer set search_path = public as $$
  select e.id, e.nome, e.status, coalesce(r.papel, case when r.evento_id is null then 'Separação (manutenção)' end),
         coalesce((select jsonb_agg(jsonb_build_object('data', d.data, 'abre', d.abre, 'fecha', d.fecha) order by d.data) from evento_dias d where d.evento_id = e.id), '[]')
  from eventos e left join evento_responsaveis r on r.evento_id = e.id and r.funcionario_id = (eu()).id
  where e.status in ('aprovado', 'preparacao', 'execucao') and (r.evento_id is not null or separo_eventos())
$$;

create policy "manutencao ve separacoes" on evento_envios for select using ((select separo_eventos()));
create policy "manutencao ve itens da separacao" on evento_envio_itens for select using ((select separo_eventos()));

create or replace function conferir_item_envio(p_item uuid, p_etapa text, p_quantidade numeric, p_ok boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare v_evento uuid;
begin
  select e.evento_id into v_evento from evento_envio_itens i join evento_envios e on e.id = i.envio_id where i.id = p_item;
  if v_evento is null then raise exception 'Item não encontrado.'; end if;
  if not (sou_gestao() or sou_responsavel_evento(v_evento) or separo_eventos()) then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  if p_etapa = 'saida' then
    update evento_envio_itens set quantidade = p_quantidade, conferido = p_ok,
      conferido_por = case when p_ok then (eu()).id end, conferido_em = case when p_ok then now() end
    where id = p_item;
  elsif p_etapa = 'retorno' then
    update evento_envio_itens set retornou = p_ok,
      retorno_por = case when p_ok then (eu()).id end, retorno_em = case when p_ok then now() end
    where id = p_item;
  else
    raise exception 'Etapa inválida.';
  end if;
end $$;

-- Nomes e unidades dos itens (sem preço), que a tela de separação usa.
create or replace function itens_contagem()
returns table (tipo text, id uuid, nome text, categoria text, unidade text, embalagem text, embalagem_qtd numeric, ativo boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (sou_gestao() or separo_eventos() or exists (select 1 from evento_responsaveis where funcionario_id = (eu()).id)) then
    raise exception 'Seu nível de acesso não permite esta ação.';
  end if;
  return query
    select 'insumo', i.id, i.nome, i.categoria, i.unidade, i.embalagem, i.embalagem_qtd, i.ativo from insumos i
    union all
    select 'preparo', r.id, r.nome, 'Pré-preparos', r.unidade, null::text, null::numeric, r.ativo from receitas r where r.tipo = 'preparo'
    order by 3;
end $$;
