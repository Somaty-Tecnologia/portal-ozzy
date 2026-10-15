import { addDias } from './datas'
import { dataDoExcel, lerXlsx } from './lerXlsx'
import type { LinhaVenda } from './types'

// Exportação "Vendas por cupons" da Eclética (Heitor, 15/10): uma linha de cabeçalho por loja ("1 | THE OZZY
// BURGER PARQUE SÃO DOMINGOS") e, abaixo, uma linha por produto de cada cupom: cupom, tipo, data e hora, canal,
// …, código do produto, nome, preço, quantidade, total. O portal soma por loja, dia, produto e canal (delivery
// ou salão) e guarda só isso.

export const lojaDoNome = (nome: string): string | null => {
  const n = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  return n.includes('PIZZA') ? 'pizza' : n.includes('VILA') || n.includes('ANASTACIO') ? 'burger-va' : n.includes('PARQUE') || n.includes('DOMINGOS') ? 'burger-psd' : null
}

export interface VendasLidas {
  linhas: LinhaVenda[]
  de: string
  ate: string
  porLoja: Record<string, { cupons: number; quantidade: number; valor: number; dias: number }>
  lojasSemNome: string[]
}

export async function lerVendasEcletica(arq: Blob, aoProgresso?: (f: number) => void): Promise<VendasLidas> {
  const soma = new Map<string, LinhaVenda>()
  const cupons = new Map<string, Set<number>>()
  const semNome = new Set<string>()
  let loja: string | null = null
  await lerXlsx(arq, (c) => {
    if (typeof c[0] === 'string' && /^\d+$/.test(c[0].trim()) && typeof c[1] === 'string' && c[2] == null) {
      loja = lojaDoNome(c[1])
      if (!loja) semNome.add(c[1])
      return
    }
    if (!loja || typeof c[0] !== 'number' || typeof c[3] !== 'number' || c[8] == null || typeof c[11] !== 'number') return
    const { data, hora } = dataDoExcel(c[3])
    // Depois da meia-noite ainda é o movimento da noite anterior.
    const dia = hora < 5 ? addDias(data, -1) : data
    const codigo = String(c[8]).trim()
    const delivery = /^del/i.test(String(c[5] ?? '').trim())
    const k = `${loja}|${dia}|${codigo}|${delivery ? 1 : 0}`
    const l = soma.get(k) ?? { unidadeId: loja, data: dia, codigo, delivery, nome: String(c[9] ?? '').trim(), quantidade: 0, valor: 0 }
    l.quantidade += c[11]
    l.valor += typeof c[12] === 'number' ? c[12] : 0
    soma.set(k, l)
    const s = cupons.get(loja) ?? new Set()
    s.add(c[0])
    cupons.set(loja, s)
  }, aoProgresso)
  const linhas = [...soma.values()].map((l) => ({ ...l, quantidade: Math.round(l.quantidade * 1000) / 1000, valor: Math.round(l.valor * 100) / 100 }))
  if (!linhas.length) throw new Error('Não achei vendas nesta planilha. Use a exportação "Vendas por cupons" da Eclética, com todas as lojas.')
  const porLoja: VendasLidas['porLoja'] = {}
  for (const l of linhas) {
    const p = (porLoja[l.unidadeId] ??= { cupons: cupons.get(l.unidadeId)?.size ?? 0, quantidade: 0, valor: 0, dias: 0 })
    p.quantidade += l.quantidade
    p.valor += l.valor
  }
  for (const u of Object.keys(porLoja)) porLoja[u].dias = new Set(linhas.filter((l) => l.unidadeId === u).map((l) => l.data)).size
  const datas = linhas.map((l) => l.data).sort()
  return { linhas, de: datas[0], ate: datas[datas.length - 1], porLoja, lojasSemNome: [...semNome] }
}
