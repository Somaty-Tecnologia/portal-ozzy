import { useEffect, useMemo, useRef, useState } from 'react'
import { ir } from '../lib/rota'

// "Ir para" (Heitor, 12/10): Alt+K (ou Ctrl+K) abre uma busca com todos os menus e abas; digita parte do nome
// ("mat", "ped comp", "listas") e Enter vai direto, sem passar pelo menu lateral.
export interface Destino {
  caminho: string
  modulo: string
  aba?: string
}

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function IrPara({ destinos, aberto, aoFechar }: { destinos: Destino[]; aberto: boolean; aoFechar: () => void }) {
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState(0)
  const entrada = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (aberto) {
      setBusca('')
      setSel(0)
      setTimeout(() => entrada.current?.focus(), 0)
    }
  }, [aberto])

  const lista = useMemo(() => {
    const termos = sem(busca).split(/\s+/).filter(Boolean)
    if (!termos.length) return destinos
    // Todas as palavras precisam aparecer; o que começa com a primeira palavra vem antes.
    return destinos
      .map((d) => ({ d, t: sem(`${d.modulo} ${d.aba ?? ''}`), a: sem(d.aba ?? d.modulo) }))
      .filter((x) => termos.every((p) => x.t.includes(p)))
      .sort((x, y) => Number(!x.a.startsWith(termos[0]) && !x.a.split(' ').some((w) => w.startsWith(termos[0])))
        - Number(!y.a.startsWith(termos[0]) && !y.a.split(' ').some((w) => w.startsWith(termos[0]))))
      .map((x) => x.d)
  }, [busca, destinos])

  if (!aberto) return null
  const ir_ = (d?: Destino) => {
    if (!d) return
    ir(d.caminho)
    aoFechar()
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-4 pt-[12vh] print:hidden" onClick={aoFechar}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-label="Ir para" onClick={(e) => e.stopPropagation()}>
        <input
          ref={entrada}
          className="w-full border-b border-stone-200 px-4 py-3 text-base outline-none"
          placeholder="Ir para… (ex.: materiais, pedidos, listas)"
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setSel(0) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(lista.length - 1, s + 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)) }
            else if (e.key === 'Enter') { e.preventDefault(); ir_(lista[sel]) }
            else if (e.key === 'Escape') aoFechar()
          }}
          aria-label="Para onde ir"
        />
        <ul className="max-h-[55vh] overflow-y-auto py-1">
          {lista.length === 0 && <li className="px-4 py-3 text-sm text-stone-500">Nada com esse nome.</li>}
          {lista.map((d, i) => (
            <li key={d.caminho}>
              <button
                className={`flex w-full items-baseline gap-2 px-4 py-2 text-left text-sm ${i === sel ? 'bg-ozzy-100' : 'hover:bg-stone-50'}`}
                onMouseEnter={() => setSel(i)}
                onClick={() => ir_(d)}
              >
                <span className={d.aba ? 'text-stone-500' : 'font-semibold'}>{d.modulo}</span>
                {d.aba && <><span className="text-stone-300">›</span><span className="font-semibold">{d.aba}</span></>}
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-stone-100 px-4 py-2 text-xs text-stone-400">↑ ↓ para escolher · Enter para ir · Esc para fechar · Alt+K abre de qualquer tela</div>
      </div>
    </div>
  )
}
