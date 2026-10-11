import { custoFicha, reais, usadoEm, type Catalogo } from './custos'
import type { Insumo, ReferenciaPreco } from './types'

// Conferência de preços dos materiais (Heitor, 11/10): aponta preço que parece errado (ex.: guardanapo a R$ 90 a unidade).
// "fora" = muito provável erro (vai para a Início do administrativo e do proprietário); "conferir" = vale olhar.
// A conta roda toda vez que a tela abre, então acompanha as notas, a produção e os cadastros novos.
export type Gravidade = 'fora' | 'conferir'
export interface AlertaPreco {
  insumo: Insumo
  gravidade: Gravidade
  motivos: string[]
}

const VEZES_FORA = 3 // contra a última entrada, o preço anterior ou a ficha do pré-preparo
const VEZES_CATEGORIA = 20 // contra a mediana da categoria (mesma unidade), que mistura itens muito diferentes
const MIN_CATEGORIA = 5

const vezes = (a: number, b: number) => (a >= b ? a / b : b / a)
const fmt = (n: number) => (n >= 1 ? reais(n) : reais(n, 4))
const fator = (a: number, b: number) => {
  const v = vezes(a, b)
  return `${v >= 10 ? Math.round(v) : v.toFixed(1).replace('.', ',')}× ${a > b ? 'mais caro' : 'mais barato'}`
}
const mediana = (ns: number[]) => {
  const o = [...ns].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

// Material que não entra na conferência (observações do PDV não são compradas).
export const foraDaConferencia = (i: Insumo) => !i.ativo || i.categoria === 'Observações do PDV'

export function conferirPrecos(insumos: Insumo[], cat: Catalogo, refs: ReferenciaPreco[], produtos: { nome: string; receitaId: string | null; preco: number | null }[] = []): AlertaPreco[] {
  const porId = new Map(refs.map((r) => [r.insumoId, r]))
  const ativos = insumos.filter((i) => !foraDaConferencia(i))
  const grupos = new Map<string, number[]>()
  for (const i of ativos) {
    if (!i.preco) continue
    const k = `${i.categoria ?? ''}|${i.unidade}`
    grupos.set(k, [...(grupos.get(k) ?? []), i.preco])
  }
  const alertas = new Map<string, AlertaPreco>()
  const apontar = (i: Insumo, g: Gravidade, motivo: string) => {
    const a = alertas.get(i.id) ?? { insumo: i, gravidade: g, motivos: [] }
    if (g === 'fora') a.gravidade = 'fora'
    a.motivos.push(motivo)
    alertas.set(i.id, a)
  }
  const un = (i: Insumo) => (i.unidade === 'l' ? 'L' : i.unidade)

  for (const i of ativos) {
    // "Está certo": a gestão conferiu este preço.
    if (i.preco !== null && i.precoConferido === i.preco) continue
    if (i.preco === null) {
      const n = usadoEm(cat, { insumoId: i.id }).length
      if (n) apontar(i, 'conferir', `Sem preço e usado em ${n} ficha${n === 1 ? '' : 's'}`)
      continue
    }
    if (i.preco === 0) { apontar(i, 'conferir', 'Preço zero'); continue }
    const r = porId.get(i.id)
    if (r?.custoEntrada && vezes(i.preco, r.custoEntrada) >= VEZES_FORA) {
      apontar(i, 'fora', `A última entrada no estoque custou ${fmt(r.custoEntrada)}/${un(i)}: o cadastro está ${fator(i.preco, r.custoEntrada)}`)
    }
    if (r?.precoAnterior && vezes(i.preco, r.precoAnterior) >= VEZES_FORA) {
      apontar(i, 'fora', `O preço mudou de ${fmt(r.precoAnterior)} para ${fmt(i.preco)} (${fator(i.preco, r.precoAnterior)})`)
    }
    // Pré-preparo: o preço deve bater com o custo da ficha.
    const ficha = [...cat.receitas.values()].find((x) => x.insumoId === i.id && x.ativo)
    const c = ficha ? custoFicha(cat, ficha.id) : null
    if (c && c.porUnidade > 0 && !c.semPreco.length && vezes(i.preco, c.porUnidade) >= VEZES_FORA) {
      apontar(i, 'fora', `Pela ficha custa ${fmt(c.porUnidade)}/${un(i)}: o cadastro está ${fator(i.preco, c.porUnidade)}`)
    }
    const g = grupos.get(`${i.categoria ?? ''}|${i.unidade}`) ?? []
    if (g.length >= MIN_CATEGORIA) {
      const m = mediana(g)
      if (m > 0 && vezes(i.preco, m) >= VEZES_CATEGORIA) {
        // Bem mais caro que o normal é quase sempre preço da caixa como unidade; bem mais barato em "un" pode ser peça miúda (sachê, tampa).
        apontar(i, i.preco > m || i.unidade !== 'un' ? 'fora' : 'conferir',`${fator(i.preco, m)} que o normal em ${i.categoria ?? 'sem categoria'} (${fmt(m)}/${un(i)})`)
      }
    }
  }

  // Produto que custa mais do que é vendido: aponta o item que mais pesa na ficha.
  for (const p of produtos) {
    if (!p.receitaId || !p.preco) continue
    const c = custoFicha(cat, p.receitaId)
    if (!c || c.porUnidade <= p.preco) continue
    const maior = [...c.itens].sort((a, b) => (b.custo ?? 0) - (a.custo ?? 0))[0]
    const i = maior?.item.insumoId ? ativos.find((x) => x.id === maior.item.insumoId) : null
    if (i && !(i.preco !== null && i.precoConferido === i.preco)) {
      apontar(i, 'fora', `Faz "${p.nome}" custar ${fmt(c.porUnidade)}, mais que o preço de venda (${fmt(p.preco)})`)
    }
  }
  return [...alertas.values()].sort((a, b) => (a.gravidade === b.gravidade ? a.insumo.nome.localeCompare(b.insumo.nome, 'pt-BR') : a.gravidade === 'fora' ? -1 : 1))
}
