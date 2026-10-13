// Planilha .xlsx de verdade, sem biblioteca (Heitor, 13/10: "gerar uma planilha para eu poder mexer nela").
// Uma aba, cabeçalho em negrito e congelado, filtro, números como números e fórmulas que o Excel recalcula.

export type Estilo = 'texto' | 'cabecalho' | 'numero' | 'reais' | 'totalReais' | 'total'
export type Celula = string | number | null | { v?: string | number | null; f?: string; s?: Estilo }

const ESTILOS: Estilo[] = ['texto', 'cabecalho', 'numero', 'reais', 'totalReais', 'total']
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
export const coluna = (i: number) => {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

function celulaXml(c: Celula, ref: string): string {
  if (c === null || c === '') return ''
  const o = typeof c === 'object' ? c : { v: c }
  const s = o.s ? ` s="${ESTILOS.indexOf(o.s)}"` : typeof o.v === 'number' ? ` s="${ESTILOS.indexOf('numero')}"` : ''
  if (o.f) return `<c r="${ref}"${s}><f>${esc(o.f)}</f></c>`
  if (o.v === null || o.v === undefined || o.v === '') return s ? `<c r="${ref}"${s}/>` : ''
  if (typeof o.v === 'number') return `<c r="${ref}"${s}><v>${Number.isFinite(o.v) ? o.v : 0}</v></c>`
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(o.v)}</t></is></c>`
}

function planilhaXml(linhas: Celula[][], larguras: number[]) {
  const cols = larguras.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')
  const rows = linhas.map((l, r) => `<row r="${r + 1}">${l.map((c, i) => celulaXml(c, `${coluna(i)}${r + 1}`)).join('')}</row>`).join('')
  const ultima = `${coluna(Math.max(0, larguras.length - 1))}${linhas.length}`
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${rows}</sheetData><autoFilter ref="A1:${ultima}"/></worksheet>`
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.###"/><numFmt numFmtId="165" formatCode="&quot;R$&quot; #,##0.00"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEE41D"/></patternFill></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="6"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="165" applyNumberFormat="1"/><xf numFmtId="165" fontId="1" applyNumberFormat="1" applyFont="1"/><xf fontId="1" applyFont="1"/></cellXfs>
</styleSheet>`

const arquivos = (nomeAba: string, linhas: Celula[][], larguras: number[]): [string, string][] => [
  ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
  ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
  ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(nomeAba.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${esc(nomeAba.replace(/[\\/?*[\]:']/g, ' ').slice(0, 31))}'!$A$1:$${coluna(Math.max(0, larguras.length - 1))}$${linhas.length}</definedName></definedNames><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`],
  ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
  ['xl/worksheets/sheet1.xml', planilhaXml(linhas, larguras)],
  ['xl/styles.xml', STYLES],
]

// ZIP sem compressão (método "store"): o Excel abre normalmente.
const TABELA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
const crc32 = (b: Uint8Array) => {
  let c = 0xffffffff
  for (let i = 0; i < b.length; i++) c = TABELA_CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function zip(entradas: [string, string][]): Uint8Array {
  const enc = new TextEncoder()
  const partes: Uint8Array[] = []
  const central: Uint8Array[] = []
  let pos = 0
  for (const [nome, texto] of entradas) {
    const n = enc.encode(nome), d = enc.encode(texto), crc = crc32(d)
    const loc = new DataView(new ArrayBuffer(30))
    loc.setUint32(0, 0x04034b50, true); loc.setUint16(4, 20, true); loc.setUint16(6, 0x0800, true)
    loc.setUint32(14, crc, true); loc.setUint32(18, d.length, true); loc.setUint32(22, d.length, true); loc.setUint16(26, n.length, true)
    const cen = new DataView(new ArrayBuffer(46))
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true)
    cen.setUint32(16, crc, true); cen.setUint32(20, d.length, true); cen.setUint32(24, d.length, true); cen.setUint16(28, n.length, true)
    cen.setUint32(42, pos, true)
    partes.push(new Uint8Array(loc.buffer), n, d)
    central.push(new Uint8Array(cen.buffer), n)
    pos += 30 + n.length + d.length
  }
  const tamCentral = central.reduce((s, x) => s + x.length, 0)
  const fim = new DataView(new ArrayBuffer(22))
  fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, entradas.length, true); fim.setUint16(10, entradas.length, true)
  fim.setUint32(12, tamCentral, true); fim.setUint32(16, pos, true)
  const tudo = [...partes, ...central, new Uint8Array(fim.buffer)]
  const out = new Uint8Array(tudo.reduce((s, x) => s + x.length, 0))
  let o = 0
  for (const x of tudo) { out.set(x, o); o += x.length }
  return out
}

export function gerarXlsx(nomeAba: string, linhas: Celula[][], larguras: number[]): Blob {
  return new Blob([zip(arquivos(nomeAba, linhas, larguras)) as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export function baixarXlsx(arquivo: string, nomeAba: string, linhas: Celula[][], larguras: number[]) {
  const url = URL.createObjectURL(gerarXlsx(nomeAba, linhas, larguras))
  const a = document.createElement('a')
  a.href = url
  a.download = arquivo.endsWith('.xlsx') ? arquivo : `${arquivo}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
