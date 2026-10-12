import type { Insumo, ItemReceita, Receita, VersaoReceita } from './types'

// Custo das fichas de eventos. Um lugar só para a conta, usado pelas telas e, nas próximas entregas,
// pela previsão de vendas, pela lista de compras e pelo simulador.
// Regra: comprar = quantidade ÷ aproveitamento; custo do item = comprar × preço da unidade.
// Pré-preparo usado como item custa (custo da versão atual ÷ rendimento) por unidade.

export interface Catalogo {
  insumos: Map<string, Insumo>
  receitas: Map<string, Receita>
  // Versão atual de cada ficha.
  atual: Map<string, VersaoReceita>
  // Material de estoque que é um pré-preparo → a ficha dele (receitas.insumo_id).
  fichaDoInsumo: Map<string, string>
}

export function montarCatalogo(insumos: Insumo[], receitas: Receita[], versoes: VersaoReceita[]): Catalogo {
  const atual = new Map<string, VersaoReceita>()
  for (const r of receitas) {
    const v = versoes.find((x) => x.receitaId === r.id && x.numero === r.versaoAtual)
    if (v) atual.set(r.id, v)
  }
  const fichaDoInsumo = new Map<string, string>()
  for (const r of receitas) if (r.insumoId && atual.has(r.id)) fichaDoInsumo.set(r.insumoId, r.id)
  return { insumos: new Map(insumos.map((i) => [i.id, i])), receitas: new Map(receitas.map((r) => [r.id, r])), atual, fichaDoInsumo }
}

export interface CustoItem {
  item: ItemReceita
  nome: string
  unidade: string
  bruto: number // quantidade a comprar/usar, já com o aproveitamento
  precoUnit: number | null
  custo: number | null
}
export interface CustoFicha {
  itens: CustoItem[]
  total: number
  porUnidade: number
  // Itens (com o caminho, se estiverem dentro de um pré-preparo) sem preço: o custo está incompleto.
  semPreco: string[]
  ciclo: boolean
}

export function custoItens(cat: Catalogo, itens: ItemReceita[], rendimento: number, pilha: string[] = []): CustoFicha {
  const linhas: CustoItem[] = []
  const semPreco: string[] = []
  let ciclo = false
  for (const item of itens) {
    const bruto = item.quantidade / (item.aproveitamento || 1)
    if (item.insumoId) {
      const ins = cat.insumos.get(item.insumoId)
      const preco = ins ? precoDoInsumo(cat, ins, pilha) : null
      if (preco === null) semPreco.push(ins?.nome ?? 'Insumo apagado')
      linhas.push({ item, nome: ins?.nome ?? '—', unidade: ins?.unidade ?? '', bruto, precoUnit: preco, custo: preco === null ? null : bruto * preco })
    } else if (item.subReceitaId) {
      const sub = cat.receitas.get(item.subReceitaId)
      const v = cat.atual.get(item.subReceitaId)
      if (pilha.includes(item.subReceitaId) || !sub || !v) {
        ciclo ||= pilha.includes(item.subReceitaId)
        linhas.push({ item, nome: sub?.nome ?? '—', unidade: sub?.unidade ?? '', bruto, precoUnit: null, custo: null })
        semPreco.push(sub?.nome ?? 'Ficha apagada')
        continue
      }
      const c = custoItens(cat, v.itens, v.rendimento, [...pilha, item.subReceitaId])
      ciclo ||= c.ciclo
      semPreco.push(...c.semPreco.map((s) => `${sub.nome} › ${s}`))
      linhas.push({ item, nome: sub.nome, unidade: sub.unidade, bruto, precoUnit: c.porUnidade, custo: bruto * c.porUnidade })
    }
  }
  const total = linhas.reduce((s, l) => s + (l.custo ?? 0), 0)
  return { itens: linhas, total, porUnidade: total / (rendimento || 1), semPreco, ciclo }
}

// Custo de um material (Heitor, 12/10): pré-preparo com ficha custa o que a ficha diz (custo ÷ rendimento), não o
// preço digitado no cadastro. Ficha sem custo completo, ou em ciclo, volta para o preço do cadastro.
export function precoDoInsumo(cat: Catalogo, ins: Insumo, pilha: string[] = []): number | null {
  const r = cat.fichaDoInsumo.get(ins.id)
  if (r && !pilha.includes(r)) {
    const v = cat.atual.get(r)!
    const c = custoItens(cat, v.itens, v.rendimento, [...pilha, r])
    if (!c.ciclo && c.semPreco.length === 0 && c.total > 0) return c.porUnidade
  }
  return ins.preco
}
export const precoPelaFicha = (cat: Catalogo, ins: Insumo) => cat.fichaDoInsumo.has(ins.id) && precoDoInsumo(cat, ins) !== ins.preco

export function custoFicha(cat: Catalogo, receitaId: string): CustoFicha | null {
  const v = cat.atual.get(receitaId)
  return v ? custoItens(cat, v.itens, v.rendimento, [receitaId]) : null
}

// CMV em % do preço de venda (null quando não há preço).
export const cmv = (custo: number, preco: number | null) => (preco ? (custo / preco) * 100 : null)

// Fichas que usam uma ficha ou insumo (só a versão atual de cada uma).
export function usadoEm(cat: Catalogo, alvo: { insumoId?: string; receitaId?: string }) {
  const r: Receita[] = []
  for (const [id, v] of cat.atual) {
    if (v.itens.some((i) => (alvo.insumoId && i.insumoId === alvo.insumoId) || (alvo.receitaId && i.subReceitaId === alvo.receitaId))) {
      const rec = cat.receitas.get(id)
      if (rec) r.push(rec)
    }
  }
  return r.sort((a, b) => a.nome.localeCompare(b.nome))
}

export const nomeUnidade = (u: string) => ({ kg: 'kg', l: 'L', un: 'un' })[u] ?? u
export { reais } from './financeiro'
export const qtd = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

// Quantidade para quem pesa na produção: abaixo de 1 kg em gramas, abaixo de 1 L em ml.
export function qtdLegivel(n: number, unidade: string) {
  const f = (x: number, casas: number) => x.toLocaleString('pt-BR', { maximumFractionDigits: casas })
  if (unidade === 'kg' || unidade === 'l') {
    const [menor, maior] = unidade === 'kg' ? ['g', 'kg'] : ['ml', 'L']
    if (n * 1000 < 999.5) {
      const m = n * 1000
      return `${f(m, m < 10 ? 1 : 0)} ${menor}`
    }
    return `${f(n, 3)} ${maior}`
  }
  return `${f(n, 2)} ${nomeUnidade(unidade)}`
}
