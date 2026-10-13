-- Heitor (13/10, "sim"): todo material que tem ficha de pré-preparo ativa fica marcado como pré-preparo
-- no cadastro (vários vieram da Eclética sem a marca). Na Produção eles passam para "preparar".
update insumos i set pre_preparo = true, atualizado_em = now()
from receitas r
where r.insumo_id = i.id and r.tipo = 'preparo' and r.ativo and not coalesce(i.pre_preparo, false);
