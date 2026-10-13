// Impressão em impressora térmica (Heitor, 13/10): papel de 80 mm (cabe também no de 58 mm, a largura
// acompanha o papel), letra preta e linhas pontilhadas para escrever à mão.
export const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export function imprimirTermica(titulo: string, corpo: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>
@page { size: 80mm auto; margin: 2mm 3mm; }
* { box-sizing: border-box; }
body { margin: 0; width: 100%; max-width: 76mm; font: 12px/1.25 Arial, Helvetica, sans-serif; color: #000; }
h1 { font-size: 15px; margin: 0 0 2px; }
.sub { font-size: 11px; margin-bottom: 4px; }
.cat { font-weight: bold; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #000; margin-top: 7px; padding-bottom: 1px; }
.l { display: flex; align-items: flex-end; gap: 4px; padding: 3px 0 2px; border-bottom: 1px dotted #000; page-break-inside: avoid; }
.n { flex: 1; min-width: 0; }
.u { font-size: 10px; }
.q { white-space: nowrap; font-weight: bold; }
.campo { white-space: nowrap; }
.fim { margin-top: 10px; font-size: 11px; }
</style></head><body>${corpo}</body></html>`
  const f = document.createElement('iframe')
  f.setAttribute('aria-hidden', 'true')
  Object.assign(f.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
  document.body.appendChild(f)
  const doc = f.contentDocument!
  doc.open()
  doc.write(html)
  doc.close()
  setTimeout(() => {
    f.contentWindow!.focus()
    f.contentWindow!.print()
    setTimeout(() => f.remove(), 60_000)
  }, 250)
}
