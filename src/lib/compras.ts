import { addDias } from './datas'
import type { CompraFornecedor, Insumo } from './types'

// Sugestão de compra pelo histórico (Heitor, 09/10): a compra é toda segunda, então o pedido cobre uma semana.
// Item comprado toda semana: a média por semana. Item comprado de tempos em tempos (10+ dias): a média por compra.
// Arredonda para cima na embalagem do material (caixa com 12, fardo com 6…) quando ela é conhecida.
export function quantidadeSugerida(c: CompraFornecedor, ins?: Insumo): number | null {
  const semanal = c.intervaloDias === null || c.intervaloDias < 10
  const base = semanal ? c.porSemana : c.porCompra ?? c.ultimaQtd
  if (!base || base <= 0) return null
  const emb = ins?.embalagemQtd && ins.embalagemQtd > 0 && ins.embalagemQtd !== 1 ? ins.embalagemQtd : null
  if (emb) return Math.ceil(base / emb - 0.05) * emb
  return ins?.unidade === 'un' || !ins ? Math.ceil(base - 0.05) : Math.ceil(base * 10 - 0.5) / 10
}

// Está na hora de comprar de novo? A próxima compra esperada (última + intervalo) cai até uma semana depois da entrega.
export function naHoraDeComprar(c: CompraFornecedor, entrega: string): boolean {
  if (c.compras === 0) return false
  if (c.intervaloDias === null) return true
  return addDias(c.ultima, Math.round(c.intervaloDias)) <= addDias(entrega, 7)
}

// "a cada 7 dias", "toda semana", "a cada 2 semanas", "1 vez" (para a lista de sugestões).
export function ritmo(c: CompraFornecedor): string {
  if (c.intervaloDias === null) return 'comprado 1 vez'
  const d = Math.round(c.intervaloDias)
  if (d <= 8 && d >= 6) return 'toda semana'
  if (d < 6) return `a cada ${d} ${d === 1 ? 'dia' : 'dias'}`
  if (d % 7 === 0 || Math.abs(d / 7 - Math.round(d / 7)) < 0.15) return `a cada ${Math.round(d / 7)} semanas`
  return `a cada ${d} dias`
}
