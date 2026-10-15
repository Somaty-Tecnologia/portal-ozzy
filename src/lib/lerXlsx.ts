// Leitor de .xlsx no navegador, sem biblioteca (15/10): a exportação de vendas da Eclética tem 130 mil linhas
// (75 MB de XML), então a planilha é lida aos pedaços e cada linha vai para quem chamou, sem montar tudo na memória.

type Celula = string | number | null

interface Entrada { nome: string; metodo: number; tamanho: number; aberto: number; inicio: number }

async function entradas(arq: Blob): Promise<Entrada[]> {
  // Fim do diretório central: nos últimos 64 KB do arquivo.
  const fim = new DataView(await arq.slice(Math.max(0, arq.size - 66000)).arrayBuffer())
  let p = -1
  for (let i = fim.byteLength - 22; i >= 0; i--) if (fim.getUint32(i, true) === 0x06054b50) { p = i; break }
  if (p < 0) throw new Error('Este arquivo não é uma planilha .xlsx.')
  const qtd = fim.getUint16(p + 10, true)
  const tam = fim.getUint32(p + 12, true)
  const ini = fim.getUint32(p + 16, true)
  const cd = new DataView(await arq.slice(ini, ini + tam).arrayBuffer())
  const dec = new TextDecoder()
  const out: { nome: string; metodo: number; tamanho: number; aberto: number; local: number }[] = []
  for (let i = 0, o = 0; i < qtd; i++) {
    if (cd.getUint32(o, true) !== 0x02014b50) break
    const n = cd.getUint16(o + 28, true)
    out.push({
      metodo: cd.getUint16(o + 10, true), tamanho: cd.getUint32(o + 20, true), aberto: cd.getUint32(o + 24, true), local: cd.getUint32(o + 42, true),
      nome: dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + o + 46, n)),
    })
    o += 46 + n + cd.getUint16(o + 30, true) + cd.getUint16(o + 32, true)
  }
  return Promise.all(out.map(async (e) => {
    const h = new DataView(await arq.slice(e.local, e.local + 30).arrayBuffer())
    return { nome: e.nome, metodo: e.metodo, tamanho: e.tamanho, aberto: e.aberto, inicio: e.local + 30 + h.getUint16(26, true) + h.getUint16(28, true) }
  }))
}

// Conteúdo de um arquivo de dentro do zip, como texto, aos pedaços.
async function* texto(arq: Blob, e: Entrada): AsyncGenerator<string> {
  let s: ReadableStream<Uint8Array> = arq.slice(e.inicio, e.inicio + e.tamanho).stream()
  if (e.metodo === 8) s = s.pipeThrough(new DecompressionStream('deflate-raw') as unknown as TransformStream<Uint8Array, Uint8Array>)
  else if (e.metodo !== 0) throw new Error('Planilha com compressão que o portal não lê. Salve de novo como .xlsx.')
  const leitor = s.pipeThrough(new TextDecoderStream() as unknown as TransformStream<Uint8Array, string>).getReader()
  for (;;) {
    const { value, done } = await leitor.read()
    if (done) return
    yield value
  }
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const desescapar = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, c: string) =>
  c[0] === '#' ? String.fromCodePoint(c[1] === 'x' || c[1] === 'X' ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10)) : ENT[c] ?? m)
const textos = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => desescapar(m[1])).join('')

const coluna = (ref: string) => {
  let n = 0
  for (const ch of ref) n = n * 26 + ch.charCodeAt(0) - 64
  return n - 1
}

// Lê a primeira aba e chama aoLinha com as células de cada linha (texto ou número; data vem como número do Excel).
export async function lerXlsx(arq: Blob, aoLinha: (celulas: Celula[]) => void, aoProgresso?: (fracao: number) => void) {
  const es = await entradas(arq)
  const ss = es.find((e) => e.nome === 'xl/sharedStrings.xml')
  const abas = es.filter((e) => /^xl\/worksheets\/[^/]+\.xml$/i.test(e.nome)).sort((a, b) => a.nome.localeCompare(b.nome, undefined, { numeric: true }))
  if (!abas.length) throw new Error('Não achei nenhuma aba na planilha.')
  const comp: string[] = []
  if (ss) {
    let xml = ''
    for await (const t of texto(arq, ss)) xml += t
    for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) comp.push(textos(m[1]))
  }
  let resto = ''
  let lidos = 0
  for await (const t of texto(arq, abas[0])) {
    lidos += t.length
    resto += t
    const corte = resto.lastIndexOf('</row>')
    if (corte < 0) continue
    const bloco = resto.slice(0, corte + 6)
    resto = resto.slice(corte + 6)
    for (const r of bloco.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const cel: Celula[] = []
      for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = /\br="([A-Z]+)\d*"/.exec(c[1])?.[1]
        const i = ref ? coluna(ref) : cel.length
        const tipo = /\bt="(\w+)"/.exec(c[1])?.[1]
        const corpo = c[2] ?? ''
        const v = /<v>([\s\S]*?)<\/v>/.exec(corpo)?.[1]
        let x: Celula = null
        if (tipo === 's') x = v === undefined ? null : comp[Number(v)] ?? null
        else if (tipo === 'inlineStr') x = textos(corpo)
        else if (tipo === 'str' || tipo === 'e') x = v === undefined ? null : desescapar(v)
        else if (tipo === 'b') x = v === undefined ? null : Number(v)
        else x = v === undefined || v === '' ? null : Number(v)
        while (cel.length < i) cel.push(null)
        cel[i] = x
      }
      aoLinha(cel)
    }
    // Conta caracteres contra bytes: com acentos fica um pouco abaixo, serve para a barra andar.
    aoProgresso?.(Math.min(0.99, lidos / (abas[0].aberto || abas[0].tamanho * 10)))
  }
  aoProgresso?.(1)
}

// Número de data do Excel (dias desde 30/12/1899, com a hora na fração) → "aaaa-mm-dd" e hora.
export function dataDoExcel(n: number): { data: string; hora: number } {
  const ms = Math.round((n - 25569) * 86400000)
  const d = new Date(ms)
  return { data: d.toISOString().slice(0, 10), hora: d.getUTCHours() }
}
