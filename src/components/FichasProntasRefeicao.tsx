import { useEffect, useMemo, useState } from 'react'
import { Botao, Modal, estiloEntrada } from './ui'
import { mostrarQtd, reais } from '../lib/financeiro'
import type { Insumo, TipoModeloRefeicao } from '../lib/types'

// Fichas prontas da comida da equipe (Heitor, 14/10): quem cozinha não sabe o nome de cada material no cadastro.
// As fichas vêm ligadas ao material pelo código da Eclética, com a quantidade por pessoa; é só escolher, ajustar
// e pesar o que ficou pronto. Geradas por scripts/gerar_fichas_refeicao.py (src/lib/fichasProntas.json).

interface ItemFicha { codigo: string | null; nome: string; quantidade: number; unidade: string }
interface Ficha { nome: string; tipo: TipoModeloRefeicao; categoria: string; itens: ItemFicha[]; modo: string }
export interface FichaResolvida extends Omit<Ficha, 'itens'> {
  itens: (ItemFicha & { insumo: Insumo | null })[]
  faltam: string[]
}

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

// Material do cadastro: pelo código da Eclética (ativo), senão pelo nome.
function achador(insumos: Insumo[]) {
  const ativos = insumos.filter((x) => x.ativo).map((x) => ({ x, n: sem(x.nome) }))
  const porCodigo = new Map(ativos.filter((a) => a.x.ecleticaCodigo).map((a) => [a.x.ecleticaCodigo!, a.x]))
  const porNome = new Map(ativos.map((a) => [a.n, a.x]))
  return (i: Pick<ItemFicha, 'codigo' | 'nome'>) => {
    const n = sem(i.nome)
    return (i.codigo ? porCodigo.get(i.codigo) : undefined) ?? porNome.get(n) ?? ativos.find((a) => a.n.startsWith(n + ' '))?.x ?? null
  }
}
const TODOS: TipoModeloRefeicao[] = ['prato', 'acompanhamento', 'salada']

let cache: Promise<{ tamanhos: string; fichas: Ficha[] }> | null = null
const carregarFichas = () => (cache ??= import('../lib/fichasProntas.json').then((m) => m.default as { tamanhos: string; fichas: Ficha[] }))

const NOME_TIPO: Record<TipoModeloRefeicao, string> = { prato: 'Pratos', acompanhamento: 'Acompanhamentos', salada: 'Saladas' }

export default function FichasProntas({ insumos, vezes, rotulo, tipos = TODOS, aoUsar, aoFechar }: {
  insumos: Insumo[]
  vezes: number // pessoas (Montar o prato) ou porções (pré-preparo)
  rotulo: string // "pessoas" ou "porções"
  tipos?: TipoModeloRefeicao[]
  aoUsar: (f: FichaResolvida) => void
  aoFechar: () => void
}) {
  const [dados, setDados] = useState<{ tamanhos: string; fichas: Ficha[] } | null>(null)
  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState<TipoModeloRefeicao | ''>(tipos.length === 1 ? tipos[0] : '')
  const [categoria, setCategoria] = useState('')
  const [tudo, setTudo] = useState(true)
  const [aberta, setAberta] = useState<string | null>(null)
  useEffect(() => { carregarFichas().then(setDados, () => setDados({ tamanhos: '', fichas: [] })) }, [])

  const resolvidas = useMemo<FichaResolvida[]>(() => {
    const achar = achador(insumos)
    return (dados?.fichas ?? []).filter((f) => tipos.includes(f.tipo)).map((f) => {
    const itens = f.itens.map((i) => ({ ...i, insumo: achar(i) }))
    return { ...f, itens, faltam: itens.filter((i) => !i.insumo).map((i) => i.nome) }
  })
  }, [dados, insumos, tipos])
  const categorias = [...new Set(resolvidas.filter((f) => !tipo || f.tipo === tipo).map((f) => f.categoria))]
  const termos = sem(busca).split(' ').filter(Boolean)
  const lista = resolvidas.filter((f) => (!tipo || f.tipo === tipo) && (!categoria || f.categoria === categoria) && (!tudo || !f.faltam.length)
    && termos.every((t) => sem(f.nome).includes(t) || f.itens.some((i) => sem(i.insumo?.nome ?? i.nome).includes(t))))
    // Quem tem a busca no nome vem antes de quem só tem no ingrediente.
    .map((f) => ({ f, nome: termos.every((t) => sem(f.nome).includes(t)) ? 0 : 1 })).sort((a, b) => a.nome - b.nome).map((x) => x.f)
  const custo = (f: FichaResolvida) => f.itens.reduce((t, i) => t + i.quantidade * (i.insumo?.preco ?? 0), 0)
  const comFalta = resolvidas.filter((f) => f.faltam.length).length

  return (
    <Modal titulo="Fichas prontas" aberto aoFechar={aoFechar}>
      {!dados ? <p className="text-stone-400">Carregando…</p> : (
        <div className="space-y-3">
          <p className="text-sm text-stone-600">
            {resolvidas.length} fichas com os materiais do cadastro e a quantidade por pessoa. Escolha uma: os ingredientes entram calculados
            para <b>{vezes} {rotulo}</b> e você ajusta o que precisar.
          </p>
          <input className={estiloEntrada} placeholder="Buscar prato ou ingrediente (ex.: frango, abobrinha)" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar ficha" autoFocus />
          <div className="flex flex-wrap items-center gap-2">
            {tipos.length > 1 && (['', ...tipos] as const).map((t) => (
              <button key={t} onClick={() => { setTipo(t); setCategoria('') }}
                className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${tipo === t ? 'bg-carvao text-white ring-carvao' : 'bg-white text-stone-600 ring-stone-300'}`}>
                {t ? NOME_TIPO[t] : 'Todas'}
              </button>
            ))}
            <select className={`${estiloEntrada} w-auto! py-1!`} value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoria">
              <option value="">Todas as categorias</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {comFalta > 0 && (
            <label className="flex items-center gap-2 text-sm text-stone-600">
              <input type="checkbox" checked={!tudo} onChange={(e) => setTudo(!e.target.checked)} />
              Mostrar também as {comFalta} que usam material que ainda não está no cadastro
            </label>
          )}
          <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
            {lista.length === 0 && <p className="p-3 text-sm text-stone-500">Nenhuma ficha com esse nome.</p>}
            {lista.slice(0, 80).map((f) => (
              <div key={f.nome} className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setAberta(aberta === f.nome ? null : f.nome)}>
                    <div className="font-semibold">{f.nome}</div>
                    <div className="text-xs text-stone-500">
                      {f.categoria} · {f.itens.length} ingredientes · {reais(custo(f))} por pessoa
                      {f.faltam.length > 0 && <span className="font-semibold text-amber-700"> · falta cadastrar: {f.faltam.join(', ')}</span>}
                    </div>
                  </button>
                  <Botao className="py-1.5!" onClick={() => aoUsar(f)}>Usar</Botao>
                </div>
                {aberta === f.nome && (
                  <div className="mt-2 space-y-1 rounded-xl bg-stone-50 p-2 text-sm">
                    {f.itens.map((i) => (
                      <div key={i.nome} className="flex justify-between gap-2">
                        <span className={i.insumo ? '' : 'text-amber-700'}>{i.insumo?.nome ?? `${i.nome} (não cadastrado)`}</span>
                        <span className="text-stone-600">{mostrarQtd(Math.round(i.quantidade * vezes * 1000) / 1000)} {i.insumo?.unidade ?? i.unidade}</span>
                      </div>
                    ))}
                    <p className="pt-1 text-stone-600">{f.modo}</p>
                  </div>
                )}
              </div>
            ))}
            {lista.length > 80 && <p className="p-3 text-sm text-stone-500">Mais {lista.length - 80}: busque pelo nome para achar.</p>}
          </div>
          {dados.tamanhos && <p className="text-xs text-stone-500">Material comprado por pacote ou unidade usa um tamanho médio: {dados.tamanhos}</p>}
        </div>
      )}
    </Modal>
  )
}
