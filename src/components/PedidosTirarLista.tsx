import { useCallback, useEffect, useState } from 'react'
import { Botao } from './ui'
import { useApp } from '../lib/contexto'
import { dataCurta } from '../lib/datas'
import { ir } from '../lib/rota'
import type { Insumo, PedidoTirarFechamento } from '../lib/types'

// Pedidos de quem preenche o fechamento para tirar um item da lista (Heitor, 13/10). A gestão tira
// (sai da lista das duas lojas) ou mantém. Na Início aparece só o aviso, com o link para resolver.
const LOJA: Record<string, string> = { 'burger-psd': 'PSD', 'burger-va': 'Vila' }
export default function PedidosTirarLista({ aviso = false, aoResolver }: { aviso?: boolean; aoResolver?: () => void }) {
  const { store, avisar, nomeDe } = useApp()
  const [ps, setPs] = useState<PedidoTirarFechamento[]>([])
  // Incluir: a gestão escolhe o material do cadastro (a loja só escreveu o nome).
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [escolha, setEscolha] = useState<Record<string, string>>({})
  const [busca, setBusca] = useState<Record<string, string>>({})
  useEffect(() => {
    if (aviso || !ps.some((p) => p.tipo === 'incluir') || insumos.length) return
    store.insumos().then((l) => setInsumos(l.filter((i) => i.ativo)), () => undefined)
  }, [aviso, ps, insumos.length, store])
  const carregar = useCallback(() => store.pedidosTirarFechamento().then(setPs, () => setPs([])), [store])
  useEffect(() => { carregar() }, [carregar])
  if (!ps.length) return null
  if (aviso)
    return (
      <button onClick={() => ir('producao/listas')} className="block w-full rounded-2xl bg-amber-50 p-4 text-left ring-1 ring-amber-200 hover:ring-amber-400">
        <span className="flex items-center justify-between gap-2">
          <span className="font-semibold text-amber-900">{ps.length === 1 ? '1 pedido para mudar a lista do fechamento' : `${ps.length} pedidos para mudar a lista do fechamento`}</span>
          <span className="text-sm font-semibold">Ver ›</span>
        </span>
        <span className="block text-sm text-stone-700">{ps.slice(0, 4).map((p) => `${p.tipo === 'incluir' ? 'incluir' : 'tirar'} ${p.nome}`).join(', ')}{ps.length > 4 ? '…' : ''}</span>
      </button>
    )
  const resolver = async (p: PedidoTirarFechamento, tirar: boolean) => {
    const material = p.tipo === 'incluir' ? escolha[p.id] : undefined
    if (p.tipo === 'incluir' && tirar && !material) return avisar('Escolha o material do cadastro para incluir.')
    try {
      await store.resolverPedidoTirar(p.id, tirar, material)
      avisar(p.tipo === 'incluir'
        ? tirar ? `${insumos.find((i) => i.id === material)?.nome ?? p.nome} entrou na lista das duas lojas` : `Pedido de incluir ${p.nome} negado`
        : tirar ? `${p.nome} saiu da lista das duas lojas` : `${p.nome} continua na lista`)
      await carregar()
      aoResolver?.()
    } catch (e) { avisar((e as Error).message) }
  }
  return (
    <div className="rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
      <h3 className="font-bold text-amber-900">Pedidos para mudar a lista</h3>
      <ul className="mt-1 divide-y divide-amber-200">
        {ps.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
            <span className="min-w-0 flex-1">
              <span className={`mr-1 rounded px-1.5 py-0.5 text-xs font-bold ${p.tipo === 'incluir' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{p.tipo === 'incluir' ? 'Incluir' : 'Tirar'}</span>
              <b>{p.nome}</b> <span className="text-stone-500">· {p.setor === 'cozinha' ? 'cozinha' : 'atendimento'} · {LOJA[p.unidadeId] ?? p.unidadeId} · {p.pedidoPor ? nomeDe(p.pedidoPor) : '—'} em {dataCurta(p.criadoEm.slice(0, 10))}</span>
              {p.motivo && <span className="block text-stone-700">“{p.motivo}”</span>}
            </span>
            {p.tipo === 'incluir' ? (
              <>
                <span className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <input list={`mat-${p.id}`} className="w-56 rounded-lg border border-stone-300 bg-white px-2 py-1.5" placeholder="Material do cadastro"
                    aria-label={`Material para ${p.nome}`} value={busca[p.id] ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      setBusca((b) => ({ ...b, [p.id]: v }))
                      setEscolha((x) => ({ ...x, [p.id]: insumos.find((i) => i.nome === v)?.id ?? '' }))
                    }} />
                  <datalist id={`mat-${p.id}`}>{insumos.map((i) => <option key={i.id} value={i.nome} />)}</datalist>
                </span>
                <Botao variante="secundario" className="py-1.5!" onClick={() => resolver(p, false)}>Negar</Botao>
                <Botao className="py-1.5!" disabled={!escolha[p.id]} onClick={() => resolver(p, true)}>Incluir nas duas lojas</Botao>
              </>
            ) : (
              <>
                <Botao variante="secundario" className="py-1.5!" onClick={() => resolver(p, false)}>Manter</Botao>
                <Botao className="py-1.5!" onClick={() => resolver(p, true)}>Tirar das duas lojas</Botao>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
