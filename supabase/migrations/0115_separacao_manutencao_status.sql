-- Ajuste da 0114 (Heitor, 17/10/2026): o evento desta semana tem separação montada mas ainda está em
-- "planejamento", e o manutencista não o via. Para ele, vale todo evento com separação montada que não
-- foi finalizado nem cancelado, qualquer que seja o status. Para quem está escalado, nada muda.
create or replace function meus_eventos_escalados()
returns table (id uuid, nome text, status text, papel text, dias jsonb)
language sql stable security definer set search_path = public as $$
  select e.id, e.nome, e.status, coalesce(r.papel, case when r.evento_id is null then 'Separação (manutenção)' end),
         coalesce((select jsonb_agg(jsonb_build_object('data', d.data, 'abre', d.abre, 'fecha', d.fecha) order by d.data) from evento_dias d where d.evento_id = e.id), '[]')
  from eventos e left join evento_responsaveis r on r.evento_id = e.id and r.funcionario_id = (eu()).id
  where (r.evento_id is not null and e.status in ('aprovado', 'preparacao', 'execucao'))
     or (separo_eventos() and e.status not in ('finalizado', 'cancelado') and exists (select 1 from evento_envios v where v.evento_id = e.id))
$$;
