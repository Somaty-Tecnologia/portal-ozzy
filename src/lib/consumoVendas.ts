import type { Catalogo } from './custos'
import type { Insumo, MediaVenda, ProdutoVenda } from './types'

// Vendas × fichas (Heitor, 15/10): quanto de cada material as lojas gastam, pelo que venderam. Serve para o
// estoque ideal do fechamento (por loja e dia da semana) e para a sugestão de compra da semana.

// "SMASH (100G)" sai com preço zero junto de cada burger, e a ficha do burger já tem o blend: contar os dois
// dobraria a carne. O "DUPLO (200G)" é carne a mais de verdade e conta.
const PRODUTOS_IGNORADOS = new Set(['318'])
// "Refrigerante do combo" (material 100161) está na ficha do combo, mas o refrigerante escolhido sai numa linha
// própria do cupom (preço zero) e é contado por ela.
const MATERIAIS_IGNORADOS = new Set(['100161'])

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

export type Ligacao = { receitaId: string } | { insumoId: string } | null

// Produto → ficha (cadastro dos produtos de venda) ou, se for revenda sem ficha (refrigerante, água), o material
// de mesmo código da Eclética cujo nome começa igual (código de produto e de material são listas diferentes).
export function ligarProdutos(produtos: ProdutoVenda[], insumos: Insumo[]) {
  const porCodigo = new Map(produtos.filter((p) => p.ecleticaCodigo).map((p) => [p.ecleticaCodigo!, p]))
  const material = new Map(insumos.filter((i) => i.ecleticaCodigo).map((i) => [i.ecleticaCodigo!, i]))
  return (codigo: string, nome: string): Ligacao => {
    if (PRODUTOS_IGNORADOS.has(codigo)) return null
    const p = porCodigo.get(codigo)
    if (p?.receitaId) return { receitaId: p.receitaId }
    const m = material.get(codigo)
    if (m && sem(m.nome).slice(0, 4) === sem(nome).slice(0, 4)) return { insumoId: m.id }
    return null
  }
}
export const ignorado = (codigo: string) => PRODUTOS_IGNORADOS.has(codigo)

export interface LinhaConsumo { ligacao: Exclude<Ligacao, null>; quantidade: number; delivery: boolean }

// Material gasto. Com "parar", a conta para nos itens dessa lista (o que a loja conta no fechamento): um
// pré-preparo da lista conta como ele mesmo, e o que está fora dela e não tem ficha é deixado de lado. Sem
// "parar", abre tudo até o material comprado (compras).
export function consumo(cat: Catalogo, linhas: LinhaConsumo[], parar?: Set<string>): Map<string, number> {
  const total = new Map<string, number>()
  const somar = (id: string, q: number) => total.set(id, (total.get(id) ?? 0) + q)
  const abrir = (rid: string, unidades: number, delivery: boolean, pilha: string[]) => {
    const v = cat.atual.get(rid)
    if (!v) return
    const f = unidades / (v.rendimento || 1)
    for (const i of v.itens) {
      if (i.soDelivery && !delivery) continue
      const ins = i.insumoId ? cat.insumos.get(i.insumoId) : undefined
      if (ins?.ecleticaCodigo && MATERIAIS_IGNORADOS.has(ins.ecleticaCodigo)) continue
      const q = (i.quantidade / (i.aproveitamento || 1)) * f
      const sub = i.subReceitaId ?? (i.insumoId ? cat.fichaDoInsumo.get(i.insumoId) : undefined)
      // Material que a ficha usa ou o material ligado ao pré-preparo.
      const comoMaterial = i.insumoId ?? (sub ? cat.receitas.get(sub)?.insumoId ?? null : null)
      if (parar && comoMaterial && parar.has(comoMaterial)) somar(comoMaterial, q)
      else if (sub && cat.atual.has(sub) && !pilha.includes(sub)) abrir(sub, q, delivery, [...pilha, sub])
      else if (!parar && i.insumoId) somar(i.insumoId, q)
    }
  }
  for (const l of linhas) {
    if (l.quantidade <= 0) continue
    if ('insumoId' in l.ligacao) {
      if (!parar || parar.has(l.ligacao.insumoId)) somar(l.ligacao.insumoId, l.quantidade)
    } else abrir(l.ligacao.receitaId, l.quantidade, l.delivery, [l.ligacao.receitaId])
  }
  return total
}

// Linhas de consumo de um conjunto de médias (uma loja e um dia, ou a semana toda).
export function linhasDe(medias: MediaVenda[], ligar: ReturnType<typeof ligarProdutos>): LinhaConsumo[] {
  const out: LinhaConsumo[] = []
  for (const m of medias) {
    const ligacao = ligar(m.codigo, m.nome)
    if (ligacao) out.push({ ligacao, quantidade: m.media, delivery: m.delivery })
  }
  return out
}

// Produtos vendidos que não entram na conta (sem ficha e sem material de revenda), com a média por semana.
export function produtosSemFicha(medias: MediaVenda[], ligar: ReturnType<typeof ligarProdutos>) {
  const soma = new Map<string, { codigo: string; nome: string; porSemana: number }>()
  for (const m of medias) {
    if (ignorado(m.codigo) || ligar(m.codigo, m.nome)) continue
    const s = soma.get(m.codigo) ?? { codigo: m.codigo, nome: m.nome, porSemana: 0 }
    s.porSemana += m.media
    soma.set(m.codigo, s)
  }
  return [...soma.values()].sort((a, b) => b.porSemana - a.porSemana)
}

// Arredonda para cima: unidade inteira; kg e litro com uma casa.
export const arredondarIdeal = (q: number, unidade: string) => {
  if (q <= 0) return 0
  return /^(kg|l)$/.test(unidade) ? Math.ceil(q * 10 - 0.01) / 10 : Math.ceil(q - 0.01)
}
