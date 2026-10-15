import type { Destino } from './IrPara'
import { ir } from '../lib/rota'

// Atalhos entre produção, cadastros, fichas, compras e estoque (Heitor, 15/10): pular de uma aba para outra sem
// abrir o menu. Só aparecem os destinos que a pessoa pode ver (os mesmos do "Ir para…").
export const ATALHOS_OPERACAO = ['producao', 'cadastros', 'fichas', 'compras', 'estoque']

export default function AtalhosOperacao({ destinos, atual }: { destinos: Destino[]; atual: string }) {
  if (destinos.length < 2) return null
  const grupos = ATALHOS_OPERACAO.map((m) => destinos.filter((d) => d.caminho.split('/')[0] === m)).filter((g) => g.length)
  return (
    <nav aria-label="Atalhos" className="sticky top-[57px] z-20 -mx-4 mb-4 overflow-x-auto lg:top-0 border-b border-stone-200 bg-stone-100/95 px-4 py-2 backdrop-blur print:hidden">
      <div className="flex w-max items-center gap-1.5 text-xs">
        <button onClick={() => history.back()} className="rounded-full px-2.5 py-1 font-semibold text-stone-600 ring-1 ring-stone-300 hover:bg-white" aria-label="Voltar">← Voltar</button>
        {grupos.map((g) => (
          <div key={g[0].modulo} className="flex items-center gap-1 border-l border-stone-300 pl-1.5">
            {(g.length > 1 || g[0].aba) && <span className="font-bold text-stone-500">{g[0].modulo}</span>}
            {g.map((d) => (
              <button key={d.caminho} onClick={() => ir(d.caminho)} aria-current={d.caminho === atual ? 'page' : undefined}
                className={`rounded-full px-2.5 py-1 font-semibold whitespace-nowrap ${d.caminho === atual ? 'bg-carvao text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:ring-stone-400'}`}>
                {d.aba ?? d.modulo}
              </button>
            ))}
          </div>
        ))}
      </div>
    </nav>
  )
}
