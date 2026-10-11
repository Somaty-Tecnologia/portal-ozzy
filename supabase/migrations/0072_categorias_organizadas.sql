-- Categorias reorganizadas (Heitor, 11/10): juntar as repetidas, nomes curtos e cada material no lugar certo.
-- Junta pelo nome antigo e move alguns materiais pelo nome; o que não bater fica onde está.
create function pg_temp.juntar(p_de text, p_para text) returns void language sql as $$
  insert into categorias_insumo (nome) values (p_para) on conflict do nothing;
  update insumos set categoria = p_para where categoria = p_de and p_de <> p_para;
$$;

select pg_temp.juntar('Proteínas e Ovos', 'Proteínas e ovos');
select pg_temp.juntar('Carnes / Proteínas', 'Proteínas e ovos');
select pg_temp.juntar('Vegetarianos', 'Proteínas e ovos');
select pg_temp.juntar('Embutidos / Frios', 'Frios e embutidos');
select pg_temp.juntar('Bacon', 'Frios e embutidos');
select pg_temp.juntar('Laticínios / Queijos', 'Laticínios');
select pg_temp.juntar('Pão', 'Pães');
select pg_temp.juntar('Farinhas, fermentos e massas', 'Farinhas, massas e grãos');
select pg_temp.juntar('Massas / Pães', 'Farinhas, massas e grãos');
select pg_temp.juntar('Grãos, cereais e derivados', 'Farinhas, massas e grãos');
select pg_temp.juntar('Molhos / Condimentos', 'Molhos e condimentos');
select pg_temp.juntar('Temperos / Condimentos', 'Temperos');
select pg_temp.juntar('Gorduras, óleos e margarinas', 'Óleos e gorduras');
select pg_temp.juntar('Doces e Confeitaria', 'Doces e confeitaria');
select pg_temp.juntar('Confeitaria / Sobremesas', 'Doces e confeitaria');
select pg_temp.juntar('Mercearia / Secos', 'Doces e confeitaria');
select pg_temp.juntar('Batata-frita', 'Congelados e industrializados');
select pg_temp.juntar('Snacks e Industrializados', 'Congelados e industrializados');
select pg_temp.juntar('Bebidas / Insumos', 'Bebidas');
select pg_temp.juntar('Pré Preparos', 'Pré-preparos');
select pg_temp.juntar('Preparos / Semiprontos', 'Pré-preparos');
select pg_temp.juntar('Preparos', 'Pré-preparos');
select pg_temp.juntar('Adesivos', 'Adesivos e etiquetas');
select pg_temp.juntar('Utensílios e Descartáveis', 'Descartáveis e utensílios');
select pg_temp.juntar('Produtos de Limpeza', 'Limpeza');
select pg_temp.juntar('Material de Escritório', 'Escritório');
select pg_temp.juntar('Refeição / Cesta', 'Refeição e cesta dos funcionários');
select pg_temp.juntar('Bonificações', 'Refeição e cesta dos funcionários');
select pg_temp.juntar('Produtos', 'Observações do PDV');

update insumos set categoria = 'Proteínas e ovos' where lower(nome) = lower('Blend 120g') and categoria is distinct from 'Proteínas e ovos';
update insumos set categoria = 'Proteínas e ovos' where lower(nome) = lower('Blend cordeiro') and categoria is distinct from 'Proteínas e ovos';
update insumos set categoria = 'Proteínas e ovos' where lower(nome) = lower('Pescoço s/ osso bovino') and categoria is distinct from 'Proteínas e ovos';
update insumos set categoria = 'Proteínas e ovos' where lower(nome) = lower('Sobrecoxa de frango desossada e sem pele') and categoria is distinct from 'Proteínas e ovos';
update insumos set categoria = 'Proteínas e ovos' where lower(nome) = lower('Ovo') and categoria is distinct from 'Proteínas e ovos';
update insumos set categoria = 'Proteínas e ovos' where lower(nome) = lower('Pernil suino') and categoria is distinct from 'Proteínas e ovos';
update insumos set categoria = 'Proteínas e ovos' where lower(nome) = lower('Sobrecoxa coreana') and categoria is distinct from 'Proteínas e ovos';
update insumos set categoria = 'Laticínios' where lower(nome) = lower('Creme de Leite') and categoria is distinct from 'Laticínios';
update insumos set categoria = 'Hortifruti' where lower(nome) = lower('Limão') and categoria is distinct from 'Hortifruti';
update insumos set categoria = 'Hortifruti' where lower(nome) = lower('Kimchi') and categoria is distinct from 'Hortifruti';
update insumos set categoria = 'Hortifruti' where lower(nome) = lower('Cogumelo Paris champetit') and categoria is distinct from 'Hortifruti';
update insumos set categoria = 'Temperos' where lower(nome) = lower('Sal') and categoria is distinct from 'Temperos';
update insumos set categoria = 'Molhos e condimentos' where lower(nome) = lower('Gochujang') and categoria is distinct from 'Molhos e condimentos';
update insumos set categoria = 'Molhos e condimentos' where lower(nome) = lower('Vinagre de arroz') and categoria is distinct from 'Molhos e condimentos';
update insumos set categoria = 'Molhos e condimentos' where lower(nome) = lower('Molho tonkatsu') and categoria is distinct from 'Molhos e condimentos';
update insumos set categoria = 'Molhos e condimentos' where lower(nome) = lower('Ketchup') and categoria is distinct from 'Molhos e condimentos';
update insumos set categoria = 'Molhos e condimentos' where lower(nome) = lower('Mostarda') and categoria is distinct from 'Molhos e condimentos';
update insumos set categoria = 'Molhos e condimentos' where lower(nome) = lower('Sour cream') and categoria is distinct from 'Molhos e condimentos';
update insumos set categoria = 'Doces e confeitaria' where lower(nome) = lower('Açúcar') and categoria is distinct from 'Doces e confeitaria';
update insumos set categoria = 'Doces e confeitaria' where lower(nome) = lower('Pistache') and categoria is distinct from 'Doces e confeitaria';
update insumos set categoria = 'Doces e confeitaria' where lower(nome) = lower('Ganache pistache - fondue') and categoria is distinct from 'Doces e confeitaria';
update insumos set categoria = 'Doces e confeitaria' where lower(nome) = lower('Cheesecake Pistache') and categoria is distinct from 'Doces e confeitaria';
update insumos set categoria = 'Descartáveis e utensílios' where lower(nome) = lower('Hashi') and categoria is distinct from 'Descartáveis e utensílios';
update insumos set categoria = 'Descartáveis e utensílios' where lower(nome) = lower('Luva Preta') and categoria is distinct from 'Descartáveis e utensílios';
update insumos set categoria = 'Descartáveis e utensílios' where lower(nome) = lower('Garrafinha') and categoria is distinct from 'Descartáveis e utensílios';
update insumos set categoria = 'Descartáveis e utensílios' where lower(nome) = lower('Guardanapo') and categoria is distinct from 'Descartáveis e utensílios';
update insumos set categoria = 'Bebidas' where lower(nome) = lower('Conhaque') and categoria is distinct from 'Bebidas';
update insumos set categoria = 'Pães' where lower(nome) = lower('Pão focaccia') and categoria is distinct from 'Pães';
update insumos set categoria = 'Farinhas, massas e grãos' where lower(nome) = lower('Arroz Japonês') and categoria is distinct from 'Farinhas, massas e grãos';
update insumos set categoria = 'Farinhas, massas e grãos' where lower(nome) = lower('Tteok') and categoria is distinct from 'Farinhas, massas e grãos';
update insumos set categoria = 'Farinhas, massas e grãos' where lower(nome) = lower('tokpokki') and categoria is distinct from 'Farinhas, massas e grãos';
update insumos set categoria = 'Farinhas, massas e grãos' where lower(nome) = lower('Macarrão fettuccine') and categoria is distinct from 'Farinhas, massas e grãos';
update insumos set categoria = 'Congelados e industrializados' where lower(nome) = lower('Guioza Bovina') and categoria is distinct from 'Congelados e industrializados';
update insumos set categoria = 'Congelados e industrializados' where lower(nome) = lower('Guioza Suino') and categoria is distinct from 'Congelados e industrializados';
update insumos set categoria = 'Congelados e industrializados' where lower(nome) = lower('Toppokki susin') and categoria is distinct from 'Congelados e industrializados';
update insumos set categoria = 'Pré-preparos' where lower(nome) = lower('Marinada do shoyu') and categoria is distinct from 'Pré-preparos';
update insumos set categoria = 'Pré-preparos' where lower(nome) = lower('Marinada sobrecoxa coreana') and categoria is distinct from 'Pré-preparos';
update insumos set categoria = 'Pré-preparos' where lower(nome) = lower('Pesto de pistache') and categoria is distinct from 'Pré-preparos';
update insumos set categoria = 'Pré-preparos' where lower(nome) = lower('Ozzy box vegetariano') and categoria is distinct from 'Pré-preparos';
update insumos set categoria = 'Escritório' where lower(nome) = lower('Lápis 12 cores') and categoria is distinct from 'Escritório';

update insumos set categoria = 'Descartáveis e utensílios' where lower(nome) = lower('Pedra afiar') and categoria is distinct from 'Descartáveis e utensílios';
update insumos set categoria = 'Bebidas' where lower(nome) = lower('Coca zero 350ml lata') and categoria is distinct from 'Bebidas';
update insumos set categoria = 'Proteínas e ovos' where lower(nome) = lower('Costela') and categoria is distinct from 'Proteínas e ovos';
update insumos set categoria = 'Observações do PDV' where lower(nome) = lower('Substituir (100388)') and categoria is distinct from 'Observações do PDV';
update insumos set categoria = 'Observações do PDV' where lower(nome) = lower('Substituir (100403)') and categoria is distinct from 'Observações do PDV';
update insumos set categoria = 'Observações do PDV' where lower(nome) = lower('Próximo Milkshake do mês') and categoria is distinct from 'Observações do PDV';
update insumos set categoria = 'Óleos e gorduras' where lower(nome) = lower('Spray desmoldante') and categoria is distinct from 'Óleos e gorduras';

-- Preparo sem categoria que tem ficha técnica é pré-preparo.
update insumos i set categoria = 'Pré-preparos' where categoria is null and exists (select 1 from receitas r where r.insumo_id = i.id);

-- Categorias antigas que ficaram vazias saem do cadastro.
delete from categorias_insumo c where not exists (select 1 from insumos i where i.categoria = c.nome)
  and c.nome in ('Proteínas e Ovos', 'Carnes / Proteínas', 'Vegetarianos', 'Embutidos / Frios', 'Bacon', 'Laticínios / Queijos', 'Pão', 'Farinhas, fermentos e massas', 'Massas / Pães', 'Grãos, cereais e derivados', 'Molhos / Condimentos', 'Temperos / Condimentos', 'Gorduras, óleos e margarinas', 'Doces e Confeitaria', 'Confeitaria / Sobremesas', 'Mercearia / Secos', 'Batata-frita', 'Snacks e Industrializados', 'Bebidas / Insumos', 'Pré Preparos', 'Preparos / Semiprontos', 'Preparos', 'Adesivos', 'Utensílios e Descartáveis', 'Produtos de Limpeza', 'Material de Escritório', 'Refeição / Cesta', 'Bonificações', 'Produtos', 'Atendimento das lojas', 'Cozinha das lojas', 'Mercado');

-- Preparo novo criado ao lançar a produção entra em Pré-preparos.
create or replace function lancar_producao(p_centro text, p_data date, p_receita uuid, p_insumo uuid, p_quantidade numeric, p_saidas jsonb, p_obs text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  r receitas;
  v_insumo uuid := p_insumo;
  v_custo numeric := 0;
  v_id uuid;
  v_nome text;
  s jsonb;
begin
  if not (sou_gestao() or sou_producao()) then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  if not exists (select 1 from centros_custo where id = p_centro) then raise exception 'Escolha a loja.'; end if;
  if coalesce(p_quantidade, 0) <= 0 then raise exception 'Diga quanto foi produzido.'; end if;
  if p_receita is not null then
    select * into r from receitas where id = p_receita;
    if r.id is null then raise exception 'Ficha não encontrada.'; end if;
    -- O item de estoque do preparo: o já ligado, um insumo com o mesmo nome, ou um novo.
    v_insumo := coalesce(r.insumo_id, (select id from insumos where lower(nome) = lower(r.nome) limit 1));
    if v_insumo is null then
      insert into insumos (nome, categoria, unidade, observacao, ativo)
      values (r.nome, 'Pré-preparos', r.unidade, 'Produção própria (criado ao lançar a produção).', true)
      returning id into v_insumo;
    end if;
    if r.insumo_id is distinct from v_insumo then update receitas set insumo_id = v_insumo where id = r.id; end if;
  end if;
  if v_insumo is null then raise exception 'Escolha o que foi produzido.'; end if;
  select nome into v_nome from insumos where id = v_insumo;

  for s in select * from jsonb_array_elements(coalesce(p_saidas, '[]')) loop
    if (s->>'insumo_id')::uuid = v_insumo then raise exception 'O preparo não pode ser ingrediente dele mesmo.'; end if;
    if coalesce((s->>'quantidade')::numeric, 0) > 0 then
      v_custo := v_custo + (s->>'quantidade')::numeric * coalesce((select preco from insumos where id = (s->>'insumo_id')::uuid), 0);
    end if;
  end loop;

  insert into producoes (centro_custo_id, data, receita_id, versao, insumo_id, quantidade, custo_total, observacao)
  values (p_centro, p_data, p_receita, r.versao_atual, v_insumo, p_quantidade, round(v_custo, 4), nullif(trim(p_obs), ''))
  returning id into v_id;

  insert into estoque_movimentos (centro_custo_id, insumo_id, data, tipo, quantidade, custo_unit, observacao, producao_id)
  select p_centro, (x->>'insumo_id')::uuid, p_data, 'saida', -(x->>'quantidade')::numeric, null, 'Produção de ' || v_nome, v_id
  from jsonb_array_elements(coalesce(p_saidas, '[]')) x
  where coalesce((x->>'quantidade')::numeric, 0) > 0;

  insert into estoque_movimentos (centro_custo_id, insumo_id, data, tipo, quantidade, custo_unit, observacao, producao_id)
  values (p_centro, v_insumo, p_data, 'entrada', p_quantidade, case when v_custo > 0 then round(v_custo / p_quantidade, 6) end,
    'Produção' || coalesce(' · ' || nullif(trim(p_obs), ''), ''), v_id);

  -- Custo do preparo atualizado pela última produção (é o preço que as outras fichas usam).
  if v_custo > 0 then
    update insumos set preco = round(v_custo / p_quantidade, 4), preco_em = now(), ativo = true where id = v_insumo;
  else
    update insumos set ativo = true where id = v_insumo and not ativo;
  end if;
  return v_id;
end $$;
