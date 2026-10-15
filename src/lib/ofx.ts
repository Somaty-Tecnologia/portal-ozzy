import type { ExtratoOfx } from './types'

// Lê o extrato OFX (o Itaú manda no formato antigo, SGML, sem as tags de fechamento; também aceita o OFX 2 em XML).
// Lê os bytes para acertar a acentuação: o Itaú grava em Windows-1252.
export async function lerArquivoOfx(arquivo: File): Promise<ExtratoOfx> {
  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  const cabecalho = new TextDecoder('latin1').decode(bytes.slice(0, 600))
  const utf8 = /ENCODING:UTF-8|encoding="utf-8"/i.test(cabecalho) && !/CHARSET:1252/i.test(cabecalho)
  let texto = new TextDecoder(utf8 ? 'utf-8' : 'windows-1252').decode(bytes)
  if (utf8 && texto.includes('�')) texto = new TextDecoder('windows-1252').decode(bytes)
  return lerOfx(texto)
}

const valorTag = (bloco: string, tag: string) => {
  const m = bloco.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'))
  return m ? m[1].trim() : null
}
// 20261009120000[-3:BRT] → 2026-10-09
const dataOfx = (s: string | null) => (s && /^\d{8}/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null)
const numeroOfx = (s: string | null) => {
  if (!s) return 0
  const t = s.includes(',') && !s.includes('.') ? s.replace(',', '.') : s.replace(/,/g, '')
  return Number(t) || 0
}

export function lerOfx(texto: string): ExtratoOfx {
  if (!/<OFX>/i.test(texto)) throw new Error('O arquivo não é um extrato OFX.')
  const banco = (valorTag(texto, 'BANKID') ?? '').replace(/^0+(?=\d)/, '')
  const agencia = valorTag(texto, 'BRANCHID') ?? ''
  const conta = valorTag(texto, 'ACCTID') ?? ''
  if (!conta) throw new Error('Não achei a conta no extrato.')
  const blocos = texto.split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/STMTTRN>|<\/BANKTRANLIST>/i)[0])
  const vistos = new Map<string, number>()
  const movimentos = blocos.map((b) => {
    const data = dataOfx(valorTag(b, 'DTPOSTED'))!
    const valor = Math.round(numeroOfx(valorTag(b, 'TRNAMT')) * 100) / 100
    const descricao = [valorTag(b, 'NAME'), valorTag(b, 'MEMO')].filter((x, i, a) => x && a.indexOf(x) === i).join(' · ')
    // O identificador do banco às vezes repete no mesmo arquivo: numera as repetições na ordem do arquivo
    // (o mesmo arquivo importado de novo gera os mesmos identificadores e não duplica).
    const base = valorTag(b, 'FITID') || `${data}|${valor}|${descricao}`
    const n = (vistos.get(base) ?? 0) + 1
    vistos.set(base, n)
    return {
      fitid: n > 1 ? `${base}#${n}` : base,
      data,
      valor,
      descricao,
      documento: valorTag(b, 'CHECKNUM') || valorTag(b, 'REFNUM'),
      tipo: valorTag(b, 'TRNTYPE'),
    }
  }).filter((m) => m.data && m.valor !== 0)
  if (!movimentos.length) throw new Error('O extrato não tem lançamentos.')
  const bal = texto.split(/<LEDGERBAL>/i)[1]
  const saldoData = bal ? dataOfx(valorTag(bal, 'DTASOF')) : null
  return {
    banco, agencia, conta,
    inicio: dataOfx(valorTag(texto, 'DTSTART')),
    fim: dataOfx(valorTag(texto, 'DTEND')),
    saldo: bal && saldoData ? { data: saldoData, valor: numeroOfx(valorTag(bal, 'BALAMT')) } : null,
    movimentos,
  }
}

// Chave da memória de classificação: o texto do extrato sem números, datas e acentos
// ("PIX ENVIADO JOAO 09/10 123456" → "pix enviado joao").
export const chaveExtrato = (descricao: string) =>
  descricao
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\b[a-z]\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// Separa o tipo da operação do nome de quem recebeu (Heitor, 09/10): "PIX ENVIADO MERCADO X" → tipo "Pix enviado",
// nome "MERCADO X". Na tela o nome fica em destaque e o tipo vira uma etiqueta pequena.
const TIPOS_EXTRATO: [RegExp, string][] = [
  [/^SISPAG\s+PIX\b/i, 'Pix em lote'],
  [/^SISPAG\b/i, 'SISPAG'],
  [/^PIX\s+(ENVIADO|ENV|TRANSF|TRANSFERENCIA)\b/i, 'Pix enviado'],
  [/^PIX\s+(RECEBIDO|REC)\b/i, 'Pix recebido'],
  [/^PIX\s+QRS?\b/i, 'Pix QR Code'],
  [/^PIX\b/i, 'Pix'],
  [/^(INT\s+)?(PAG(TO)?|PAGAMENTO)\s+(DE\s+)?(BOLETO|TIT(ULO)?S?)\b/i, 'Boleto'],
  [/^BOLETO(\s+PAGO)?\b/i, 'Boleto'],
  [/^(TED|DOC)\b(\s+(ENVIADA?|ENV|RECEBIDA?|REC))?/i, 'TED/DOC'],
  [/^(DA|DEB(ITO)?\s+AUT(OMATICO)?)\b/i, 'Débito automático'],
  [/^(TAR|TARIFA)\b/i, 'Tarifa'],
  [/^(CARTAO|FATURA)\b/i, 'Cartão'],
  [/^(SAQUE)\b/i, 'Saque'],
]
// CPF ou CNPJ no meio do texto (com ou sem pontos, às vezes mascarado com *): vai para outra etiqueta.
const DOC_RE = /(?<![\w*])(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|[\d*]{3}\.[\d*]{3}\.[\d*]{3}-[\d*]{2}|\d{14}|\d{11})(?![\w*])/
export function partesExtrato(descricao: string): { tipo: string | null; nome: string; documento: string | null } {
  let d = descricao.trim()
  const doc = d.match(DOC_RE)
  const documento = doc ? doc[0] : null
  if (doc) d = (d.slice(0, doc.index) + ' ' + d.slice(doc.index! + doc[0].length)).replace(/\s*·\s*·\s*/g, ' · ').replace(/\s+/g, ' ').replace(/^[\s·]+|[\s·]+$/g, '').trim()
  for (const [re, tipo] of TIPOS_EXTRATO) {
    const m = d.match(re)
    if (m) {
      // Tira datas e códigos soltos do fim ("MERCADO X 09/10 123456" → "MERCADO X").
      const nome = d.slice(m[0].length).replace(/^[\s·:\-]+/, '').replace(/(\s+(\d{2}\/\d{2}|\d{4,}))+\s*$/, '').trim()
      return { tipo, nome: nome || d, documento }
    }
  }
  return { tipo: null, nome: d, documento }
}

// O que é novo neste extrato (Heitor, 12/10). O Itaú numera o FITID pelo dia (20261013001, 002…): importado no
// meio do dia, um lançamento que entra depois pode mudar a numeração, e o mesmo FITID passa a ser outro lançamento.
// Por isso o repetido é reconhecido pelo dia + valor + texto (contando repetições iguais), não só pelo FITID;
// e um lançamento novo cujo FITID já foi usado ganha um sufixo, para não ser descartado.
// 15/10: o Itaú também muda o texto do mesmo lançamento entre um OFX e outro ("PAMA COMERCI PAMA COMERCIO…" e
// "PAMA COMERCIO…"). O que sobra sem texto igual é comparado só por dia + valor, contando: se o banco já tem 1
// lançamento de R$ 100 no dia e o arquivo traz 2, só 1 é novo.
type Mov = ExtratoOfx['movimentos'][number]
type Existente = { fitid: string; data: string; valor: number; descricao: string | null }
export function movimentosNovos(movs: Mov[], existentes: Existente[]): Mov[] {
  const centavos = (v: number) => Math.round(v * 100)
  const chave = (m: { data: string; valor: number; descricao: string | null }) => `${m.data}|${centavos(m.valor)}|${m.descricao ?? ''}`
  const diaValor = (m: { data: string; valor: number }) => `${m.data}|${centavos(m.valor)}`
  const restam = new Map<string, Existente[]>()
  for (const x of existentes) restam.set(chave(x), [...(restam.get(chave(x)) ?? []), x])
  // 1ª volta: texto igual.
  const sobra: Mov[] = []
  const casados = new Set<Existente>()
  for (const m of movs) {
    const x = restam.get(chave(m))?.shift()
    if (x) casados.add(x)
    else sobra.push(m)
  }
  // 2ª volta: dia + valor, entre os que ainda não casaram.
  const porDia = new Map<string, number>()
  for (const x of existentes) if (!casados.has(x)) porDia.set(diaValor(x), (porDia.get(diaValor(x)) ?? 0) + 1)
  const usados = new Set(existentes.map((x) => x.fitid))
  const novos: Mov[] = []
  for (const m of sobra) {
    const n = porDia.get(diaValor(m)) ?? 0
    if (n > 0) {
      porDia.set(diaValor(m), n - 1)
      continue
    }
    let fitid = m.fitid
    for (let k = 1; usados.has(fitid); k++) fitid = `${m.fitid}~${centavos(m.valor)}${k > 1 ? `#${k}` : ''}`
    usados.add(fitid)
    novos.push({ ...m, fitid })
  }
  return novos
}

// Repetidos que já entraram (15/10, antes da 2ª volta acima): mesma conta, dia e valor, vindos de importações
// diferentes. Em cada dia + valor, o número certo de lançamentos é o maior que uma importação sozinha trouxe; o que
// passa disso é repetido. Sai primeiro o que não foi conciliado e, entre iguais, o importado por último.
export function repetidosNoExtrato<T extends { id: string; banco: string; agencia: string; conta: string; data: string; valor: number; status: string; importadoEm: string }>(movs: T[]): T[] {
  const grupos = new Map<string, T[]>()
  for (const m of movs) {
    const k = `${m.banco}|${m.agencia}|${m.conta}|${m.data}|${Math.round(m.valor * 100)}`
    grupos.set(k, [...(grupos.get(k) ?? []), m])
  }
  const fora: T[] = []
  for (const g of grupos.values()) {
    if (g.length < 2) continue
    const porImportacao = new Map<string, number>()
    for (const m of g) porImportacao.set(m.importadoEm, (porImportacao.get(m.importadoEm) ?? 0) + 1)
    const certos = Math.max(...porImportacao.values())
    if (g.length <= certos) continue
    const peso = (m: T) => (m.status === 'pendente' ? 0 : m.status === 'ignorado' ? 1 : 2)
    const ordem = [...g].sort((a, b) => peso(a) - peso(b) || b.importadoEm.localeCompare(a.importadoEm))
    fora.push(...ordem.slice(0, g.length - certos))
  }
  return fora
}
