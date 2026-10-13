-- Heitor (13/10) mandou as fichas das Romanas para criar: elas já existiam desde a planilha DPEN (0035),
-- com a mesma composição, mas vieram inativas, por isso não apareciam nas fichas nem no cardápio do evento.
update receitas set ativo = true
where lower(nome) in ('romana de calabresa', 'romana de carbonara', 'romana de copa ao pesto', 'romana de marguerita',
                      'romana de quatro formaggi', 'romana de smores', 'mistura ovo carbonara')
  and (tipo = 'preparo' or coalesce(area, 'eventos') = 'eventos');
update insumos i set ativo = true from receitas r
where r.insumo_id = i.id and lower(r.nome) = 'mistura ovo carbonara' and r.tipo = 'preparo';
