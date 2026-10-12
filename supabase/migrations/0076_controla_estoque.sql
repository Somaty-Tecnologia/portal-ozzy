-- Materiais que controlam estoque (Heitor, 12/10): começam todos marcados e a gestão desmarca o que não controla.
-- Só os marcados entram no inventário de segunda. Observação do PDV ("Sem cebola") não é mercadoria: já sai desmarcada.
alter table insumos add column controla_estoque boolean not null default true;
update insumos set controla_estoque = false where categoria = 'Observações do PDV';
