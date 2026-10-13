import { useCallback, useEffect, useState } from 'react'
import { Botao } from './ui'
import { useApp } from '../lib/contexto'
import { dataCurta } from '../lib/datas'
import { ir } from '../lib/rota'
import type { PedidoTirarFechamento } from '../lib/types'

// Pedidos de quem preenche o fechamento para tirar um item da lista (Heitor, 13/10). A gestão tira
// (sai da lista das duas lojas) ou mantém. Na Início aparece só o aviso, com o link para resolver.
const LOJA: Record<string, string> = { 'burger-psd': 'PSD', 'burger-va': 'Vila' }
export default function PedidosTirarLista({ aviso = false, aoResolver }: { aviso?: boolean; aoResolver?: () => void }) {
  const { store, avisar, nomeDe } = useApp()
  const [ps, setPs] = useState<PedidoTirarFechamento[]>([])
  const carregar = useCallback(() => store.pedidosTirarFechamento().then(setPs, () => setPs([])), [store])
  useEffect(() => { carregar() }, [carregar])
  if (!ps.length) return null
  if (aviso)
    return (
      <button onClick={() => ir('producao/listas')} className="block w-full rounded-2xl bg-amber-50 p-4 text-left ring-1 ring-amber-200 hover:ring-amber-400">
        <span className="flex items-center justify-between gap-2">
          <span className="font-semibold text-amber-900">{ps.length === 1 ? '1 pedido para tirar item do fechamento' : `${ps.length} pedidos para tirar itens do fechamento`}</span>
          <span className="text-sm font-semibold">Ver ›</span>
        </span>
        <span className="block text-sm text-stone-700">{ps.slice(0, 4).map((p) => p.nome).join(', ')}{ps.length > 4 ? '…' : ''}</span>
      </button>
    )
  const resolver = async (p: PedidoTirarFechamento, tirar: boolean) => {
    try {
      await store.resolverPedidoTirar(p.id, tirar)
      avisar(tirar ? `${p.nome} saiu da lista das duas lojas` : `${p.nome} continua na lista`)
      await carregar()
      aoResolver?.()
    } catch (e) { avisar((e as Error).message) }
  }
  return (
    <div className="rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
      <h3 className="font-bold text-amber-900">Pedidos para tirar da lista</h3>
      <ul className="mt-1 divide-y divide-amber-200">
        {ps.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
            <span className="min-w-0 flex-1">
              <b>{p.nome}</b> <span className="text-stone-500">· {p.setor === 'cozinha' ? 'cozinha' : 'atendimento'} · {LOJA[p.unidadeId] ?? p.unidadeId} · {p.pedidoPor ? nomeDe(p.pedidoPor) : '—'} em {dataCurta(p.criadoEm.slice(0, 10))}</span>
              {p.motivo && <span className="block text-stone-700">“{p.motivo}”</span>}
            </span>
            <Botao variante="secundario" className="py-1.5!" onClick={() => resolver(p, false)}>Manter</Botao>
            <Botao className="py-1.5!" onClick={() => resolver(p, true)}>Tirar das duas lojas</Botao>
          </li>
        ))}
      </ul>
    </div>
  )
}
