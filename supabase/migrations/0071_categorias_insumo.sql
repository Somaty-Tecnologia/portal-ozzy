-- Cadastro de categorias dos materiais (Heitor, 11/10): para renomear, juntar e criar categorias num lugar só.
-- insumos.categoria aponta para cá pelo nome; renomear a categoria muda todos os materiais dela.
create table categorias_insumo (
  nome text primary key check (nome = trim(nome) and nome <> ''),
  criado_em timestamptz not null default now()
);

update insumos set categoria = nullif(trim(categoria), '') where categoria is distinct from nullif(trim(categoria), '');
insert into categorias_insumo (nome) select distinct categoria from insumos where categoria is not null on conflict do nothing;

alter table insumos add constraint insumos_categoria_fk foreign key (categoria) references categorias_insumo (nome) on update cascade;

-- Categoria nova num material (nota fiscal, produção, cadastro) entra sozinha no cadastro.
create or replace function insumos_categoria() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.categoria := nullif(trim(new.categoria), '');
  if new.categoria is not null then
    insert into categorias_insumo (nome) values (new.categoria) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger insumos_categoria before insert or update of categoria on insumos for each row execute function insumos_categoria();

alter table categorias_insumo enable row level security;
create policy "gestao ve categorias de insumo" on categorias_insumo for select using ((select sou_gestao()) or (select sou_producao()));
create policy "gestao cria categorias de insumo" on categorias_insumo for insert with check ((select sou_gestao()));
create policy "gestao renomeia categorias de insumo" on categorias_insumo for update using ((select sou_gestao())) with check ((select sou_gestao()));

-- Juntar (passa os materiais de uma para outra) ou tirar (p_para vazio: os materiais ficam sem categoria).
create or replace function juntar_categoria_insumo(p_de text, p_para text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not sou_gestao() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  p_para := nullif(trim(p_para), '');
  if p_para = p_de then return; end if;
  if p_para is not null then insert into categorias_insumo (nome) values (p_para) on conflict do nothing; end if;
  update insumos set categoria = p_para where categoria = p_de;
  delete from categorias_insumo where nome = p_de;
end $$;
