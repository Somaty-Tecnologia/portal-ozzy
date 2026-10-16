-- Remover falta, advertência, suspensão ou qualquer ocorrência lançada por engano ou em teste (Heitor, 16/10/2026).
-- Só gerente, administrativo e proprietário, e só de quem não está acima (posso_alterar), sempre com justificativa.
-- A ocorrência sai da tabela (some do perfil, da caixinha e do painel), mas uma cópia fica guardada em
-- ocorrencias_removidas com quem removeu, quando e por quê. Ninguém remove ocorrência de si mesmo.
create table ocorrencias_removidas (
  id uuid primary key, -- o mesmo id que a ocorrência tinha
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  tipo tipo_ocorrencia not null,
  data date not null,
  descricao text not null,
  natureza text,
  suspensao_inicio date,
  suspensao_dias int,
  registrado_por uuid references funcionarios (id),
  registrado_em timestamptz not null,
  motivo text not null,
  removido_por uuid not null references funcionarios (id),
  removido_em timestamptz not null default now()
);
create index ocorrencias_removidas_func_idx on ocorrencias_removidas (funcionario_id);
alter table ocorrencias_removidas enable row level security;
create policy "gestao ve removidas" on ocorrencias_removidas for select using (posso_alterar(funcionario_id));
-- Só entra pela função abaixo: sem policy de insert, update ou delete.

create function remover_ocorrencia(p_ocorrencia uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare
  o ocorrencias;
begin
  select * into o from ocorrencias where id = p_ocorrencia for update;
  if o.id is null then raise exception 'Ocorrência não encontrada.'; end if;
  if not posso_alterar(o.funcionario_id) then raise exception 'Seu nível de acesso não permite remover esta ocorrência.'; end if;
  if o.funcionario_id = (eu()).id then raise exception 'Você não pode remover uma ocorrência sua.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'Escreva o motivo da remoção.'; end if;
  insert into ocorrencias_removidas (id, funcionario_id, tipo, data, descricao, natureza, suspensao_inicio, suspensao_dias,
                                     registrado_por, registrado_em, motivo, removido_por)
  values (o.id, o.funcionario_id, o.tipo, o.data, o.descricao, o.natureza, o.suspensao_inicio, o.suspensao_dias,
          o.registrado_por, o.criado_em, trim(p_motivo), (eu()).id);
  delete from ocorrencias where id = o.id;
end $$;
revoke execute on function remover_ocorrencia(uuid, text) from public, anon;
grant execute on function remover_ocorrencia(uuid, text) to authenticated;
