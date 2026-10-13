-- Heitor (13/10) perguntou por que duas pessoas não apareciam em "Quem trabalha". Agora:
-- - quem não tem turno cadastrado (ou o turno ainda sem horários) entra na conta, marcado "sem turno";
-- - quem fica de fora aparece à parte com o motivo (folga, férias, o turno não trabalha neste dia, admissão depois).
create or replace function quem_come(p_data date) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  v_dia int := (extract(isodow from p_data)::int - 1); -- 0 = segunda
  v_equipe json;
  v_fora json;
  v_motos json;
begin
  if not sou_cozinha() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;

  with base as (
    select f.id, f.nome, f.unidade_id, t.nome as turno, t.local, t.dias -> v_dia as horario,
      case
        when f.data_admissao > p_data then 'admissão depois deste dia'
        when exists (select 1 from ferias fe where fe.funcionario_id = f.id and p_data between fe.inicio and fe.inicio + fe.dias - 1) then 'férias'
        when g.tipo = 'trabalha' then null
        when g.tipo = 'feriado' then 'folga de feriado'
        when g.id is not null then 'folga'
        when t.id is null then null
        when not exists (select 1 from jsonb_array_elements(t.dias) d where jsonb_typeof(d) = 'object') then null
        when jsonb_typeof(t.dias -> v_dia) <> 'object' then 'o turno não trabalha neste dia'
        else null
      end as motivo
    from funcionarios f
    left join turnos t on t.id = f.turno_id
    left join folgas g on g.funcionario_id = f.id and g.data = p_data
    where f.status = 'ativo' and f.nivel <> 'proprietario'
  )
  select
    coalesce(json_agg(json_build_object('id', id, 'nome', nome, 'local', coalesce(local, unidade_id), 'unidadeId', unidade_id,
      'turno', turno, 'horario', case when jsonb_typeof(horario) = 'object' then horario end) order by coalesce(local, unidade_id), nome) filter (where motivo is null), '[]'),
    coalesce(json_agg(json_build_object('id', id, 'nome', nome, 'local', coalesce(local, unidade_id), 'motivo', motivo) order by nome) filter (where motivo is not null), '[]')
  into v_equipe, v_fora
  from base;

  select coalesce(json_agg(json_build_object('id', m.id, 'nome', m.nome, 'local', e.unidade_id) order by e.unidade_id, m.nome), '[]')
  into v_motos
  from motoboy_escala e join motoboys m on m.id = e.motoboy_id
  where e.data = p_data and m.ativo;

  return json_build_object('equipe', v_equipe, 'fora', v_fora, 'motoboys', v_motos);
end $$;
