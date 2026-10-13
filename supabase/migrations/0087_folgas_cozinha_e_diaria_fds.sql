-- Heitor (13/10):
-- 1) O manutencista (que faz a comida da equipe) vê as folgas de todos. Só nome, loja, setor e a folga:
--    nada do resto do cadastro. As folgas automáticas do turno (dia sem horário) entram também.
-- 2) Motoboys: diária padrão de sábado e domingo R$ 115 (dia de semana continua R$ 100), editável por motoboy.

create function folgas_da_equipe(p_inicio date, p_fim date) returns json
language sql stable security definer set search_path = public as $$
  with pessoas as (
    select f.id, f.nome, f.unidade_id, f.setor, f.data_admissao, t.dias
    from funcionarios f left join turnos t on t.id = f.turno_id
    where f.status = 'ativo' and sou_cozinha()
  ),
  marcadas as (
    select g.funcionario_id, g.data, g.tipo, false as automatica
    from folgas g join pessoas p on p.id = g.funcionario_id
    where g.data between p_inicio and p_fim and g.tipo <> 'trabalha'
  ),
  automaticas as (
    select p.id, d::date, 'normal', true
    from pessoas p, generate_series(p_inicio, p_fim, interval '1 day') d
    where p.dias is not null
      and exists (select 1 from jsonb_array_elements(p.dias) x where jsonb_typeof(x) = 'object')
      and jsonb_typeof(p.dias -> (extract(isodow from d)::int - 1)) <> 'object'
      and d::date >= p.data_admissao
      and not exists (select 1 from folgas g where g.funcionario_id = p.id and g.data = d::date)
  )
  select coalesce(json_agg(json_build_object('funcionarioId', p.id, 'nome', p.nome, 'unidadeId', p.unidade_id, 'setor', p.setor,
    'data', x.data, 'tipo', x.tipo, 'automatica', x.automatica) order by x.data, p.nome), '[]')
  from (select * from marcadas union all select * from automaticas) x(funcionario_id, data, tipo, automatica)
  join pessoas p on p.id = x.funcionario_id
$$;
revoke execute on function folgas_da_equipe(date, date) from public, anon;
grant execute on function folgas_da_equipe(date, date) to authenticated;

alter table motoboys add column valor_diaria_fds numeric(10, 2) not null default 115 check (valor_diaria_fds >= 0);

create or replace function motoboy_quem_sou(p_celular text) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  v_cel text := right(regexp_replace(p_celular, '\D', '', 'g'), 11);
  m motoboys;
begin
  if length(v_cel) < 10 then return json_build_object('tipo', 'invalido'); end if;
  select * into m from motoboys
  where ativo and right(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), 11) = v_cel
  order by criado_em limit 1;
  if m.id is null then return json_build_object('tipo', 'nao_achei'); end if;
  return json_build_object('tipo', 'motoboy', 'nome', split_part(m.nome, ' ', 1), 'unidadeId', m.unidade_id,
    'valorDiaria', m.valor_diaria, 'valorDiariaFds', m.valor_diaria_fds, 'entregasIncluidas', m.entregas_incluidas, 'valorEntrega', m.valor_entrega);
end $$;
