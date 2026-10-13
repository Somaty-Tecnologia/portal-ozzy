// Ler o print das vendas do DPEN (Heitor, 13/10): o celular mostra uma tabela
// "PRODUTO | R$ preço | quantidade | R$ total", com o nome quebrado em 2 ou 3 linhas.
// O OCR devolve as palavras com a posição; cada linha com preço/quantidade/total é uma venda,
// e as palavras da coluna do nome vão para a venda mais perto na altura.

export interface PalavraOcr { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }
export interface VendaLida { nome: string; preco: number | null; quantidade: number | null; total: number | null; confere: boolean }

const DINHEIRO = /^(?:R\$)?(\d{1,3}(?:\.\d{3})*,\d{2})$/
const valor = (t: string) => Number(t.replace(/\./g, '').replace(',', '.'))
const meio = (w: PalavraOcr) => (w.bbox.y0 + w.bbox.y1) / 2

export function lerPrintVendas(palavras: PalavraOcr[]): VendaLida[] {
  const ws = palavras.filter((w) => w.text.trim())
  // Junta "R$" com o número que vem logo depois ("R$ 50,00" pode vir em duas palavras).
  const fichas: { w: PalavraOcr; dinheiro: number | null; inteiro: number | null }[] = ws.map((w) => {
    const t = w.text.trim()
    const m = t.match(DINHEIRO)
    return { w, dinheiro: m ? valor(m[1]) : null, inteiro: /^\d{1,4}$/.test(t) ? Number(t) : null }
  })
  // Linhas da tabela: palavras com a mesma altura.
  const ordenadas = [...fichas].sort((a, b) => meio(a.w) - meio(b.w))
  const linhas: (typeof fichas)[] = []
  for (const f of ordenadas) {
    const ult = linhas[linhas.length - 1]
    const alt = f.w.bbox.y1 - f.w.bbox.y0
    if (ult && Math.abs(meio(ult[0].w) - meio(f.w)) < alt * 0.6) ult.push(f)
    else linhas.push([f])
  }
  type Ancora = { y: number; x: number; preco: number | null; quantidade: number | null; total: number | null }
  const ancoras: Ancora[] = []
  for (const l of linhas) {
    const xs = [...l].sort((a, b) => a.w.bbox.x0 - b.w.bbox.x0)
    const din = xs.filter((f) => f.dinheiro !== null)
    if (!din.length) continue
    const primeiro = din[0]
    const depois = xs.filter((f) => f.w.bbox.x0 > primeiro.w.bbox.x1)
    const qtd = depois.find((f) => f.inteiro !== null && f.dinheiro === null)
    // Linha só com um valor (a última, coberta pela barra do navegador) vale como total.
    if (din.length === 1 && !qtd) {
      ancoras.push({ y: meio(primeiro.w), x: primeiro.w.bbox.x0, preco: null, quantidade: null, total: primeiro.dinheiro })
      continue
    }
    ancoras.push({
      y: xs.reduce((s, f) => s + meio(f.w), 0) / xs.length, x: primeiro.w.bbox.x0,
      preco: din.length >= 2 || qtd ? primeiro.dinheiro : null, quantidade: qtd?.inteiro ?? null, total: din.length >= 2 ? din[din.length - 1].dinheiro : null,
    })
  }
  if (!ancoras.length) return []
  // Coluna do nome: tudo à esquerda do preço.
  const xPreco = [...ancoras.map((a) => a.x)].sort((a, b) => a - b)[Math.floor(ancoras.length / 2)]
  const passo = ancoras.length > 1 ? (ancoras[ancoras.length - 1].y - ancoras[0].y) / (ancoras.length - 1) : 200
  const nomes = ancoras.map(() => [] as PalavraOcr[])
  for (const f of fichas) {
    if (f.dinheiro !== null || f.w.bbox.x1 > xPreco - 4 || !/\p{L}/u.test(f.w.text)) continue
    let melhor = -1
    let dist = Infinity
    ancoras.forEach((a, i) => { const d = Math.abs(a.y - meio(f.w)); if (d < dist) { dist = d; melhor = i } })
    if (melhor >= 0 && dist < passo * 0.75) nomes[melhor].push(f.w)
  }
  return ancoras.map((a, i) => {
    const nome = nomes[i].sort((x, y) => meio(x) - meio(y) || x.bbox.x0 - y.bbox.x0).map((w) => w.text.replace(/[^\p{L}\p{N}\-+/&]/gu, '')).filter(Boolean).join(' ')
    let { quantidade } = a
    if (quantidade === null && a.preco && a.total) quantidade = Math.round(a.total / a.preco)
    const confere = a.preco !== null && quantidade !== null && a.total !== null && Math.abs(a.preco * quantidade - a.total) < 0.05
    return { nome, preco: a.preco, quantidade, total: a.total, confere }
  }).filter((v) => v.nome)
}

// Produto do portal mais parecido com o nome lido (sem acento; tolera 1 letra errada do OCR).
export const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const quase = (a: string, b: string) => {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1 || a.length < 5) return false
  let i = 0
  while (i < a.length && a[i] === b[i]) i++
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i) || a.slice(i) === b.slice(i + 1)
}
const PALAVRA_VAZIA = new Set(['na', 'no', 'nas', 'nos', 'de', 'da', 'do', 'das', 'dos', 'a', 'o', 'e', 'lata', 'garrafa', 'un'])
const MODIFICADOR = new Set(['zero', 'diet', 'light'])
const tokens = (t: string) => normalizar(t).split(' ').filter((x) => x && !PALAVRA_VAZIA.has(x) && !/^\d+(ml|l|g|kg)$/.test(x))
export function produtoParecido(nome: string, candidatos: { id: string; nomes: string[] }[]): string | null {
  const a = tokens(nome)
  if (!a.length) return null
  let melhor: { id: string; nota: number } | null = null
  for (const c of candidatos)
    for (const n of c.nomes) {
      const b = tokens(n)
      if (!b.length) continue
      if (b.join(' ') === a.join(' ')) return c.id
      // Nos dois sentidos: "Guaraná" não vira "Guaraná Zero"; "Água sem gás" não vira "Água com gás".
      let nota = (a.filter((t) => b.some((u) => quase(t, u))).length / a.length + b.filter((u) => a.some((t) => quase(t, u))).length / b.length) / 2
      nota -= 0.5 * b.filter((u) => MODIFICADOR.has(u) && !a.includes(u)).length
      if ((a.includes('sem') && b.includes('com')) || (a.includes('com') && b.includes('sem'))) nota -= 0.5
      if (nota >= 0.6 && (!melhor || nota > melhor.nota)) melhor = { id: c.id, nota }
    }
  return melhor?.id ?? null
}

// OCR no próprio navegador (tesseract.js, português). Carrega só quando usa.
export async function lerImagem(arquivo: File, progresso?: (p: number) => void): Promise<PalavraOcr[]> {
  const { createWorker } = await import('tesseract.js')
  // Arquivos do OCR servidos pelo próprio portal (public/ocr), sem depender de CDN.
  const base = new URL(import.meta.env.BASE_URL + 'ocr/', location.href).href
  const w = await createWorker('por', 1, { workerPath: base + 'worker.min.js', corePath: base, langPath: base, gzip: true, logger: (m: { status: string; progress: number }) => { if (m.status === 'recognizing text') progresso?.(m.progress) } })
  try {
    const { data } = await w.recognize(arquivo)
    return data.words.map((x) => ({ text: x.text, bbox: x.bbox }))
  } finally {
    await w.terminate()
  }
}
