import { useCallback, useEffect, useState } from 'react'
import { nomeItem } from '../lib/store'
import { Botao, Campo, Modal, Selo, Titulo, Vazio, estiloEntrada } from '../components/ui'
import { useOrdem } from '../components/Ordenar'
import { useApp } from '../lib/contexto'
import { ir } from '../lib/rota'
import { reais } from '../lib/custos'
import { lerValor } from '../lib/financeiro'
import { TIPOS_PRODUTO_VENDA, type ProdutoVenda, type Receita, type TipoProdutoVenda } from '../lib/types'
import Insumos from './Insumos'

// Cadastros (Heitor, 09/10): materiais e produtos de venda da Eclética e os fornecedores, num lugar só.
// Até a integração, a base veio das planilhas da Eclética (código de cada um); depois passa a vir dela pelo código.
// Abas com endereço próprio (#/cadastros/<aba>), para o menu lateral e o "Ir para" (Heitor, 12/10).
export const ABAS_CADASTROS = [
  { id: '', nome: 'Materiais' },
  { id: 'categorias', nome: 'Categorias' },
  { id: 'produtos', nome: 'Produtos de venda' },
  { id: 'fornecedores', nome: 'Fornecedores' },
  { id: 'conferencia', nome: 'Conferência de preços' },
]
export default function Cadastros({ aba }: { aba?: string }) {
  const area = ABAS_CADASTROS.some((a) => a.id && a.id === aba) ? aba! : ''
  return (
    <div className="space-y-4">
      <Titulo>Cadastros</Titulo>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-200 p-1 text-sm font-semibold sm:grid-cols-5">
        {ABAS_CADASTROS.map((a) => (
          <button key={a.id} onClick={() => ir('cadastros' + (a.id ? '/' + a.id : ''))} className={`rounded-lg px-2 py-2 ${area === a.id ? 'bg-white shadow-sm' : 'text-stone-600'}`}>{a.nome}</button>
        ))}
      </div>
      {area === 'produtos' ? <ProdutosVenda /> : <Insumos key={area} aba={(area || 'insumos') as 'insumos' | 'fornecedores' | 'categorias' | 'conferencia'} />}
    </div>
  )
}

const numTexto = (n: number | null) => (n === null ? '' : String(n).replace('.', ','))

function ProdutosVenda() {
  const { store, avisar } = useApp()
  const [produtos, setProdutos] = useState<ProdutoVenda[] | null>(null)
  const [receitas, setReceitas] = useState<Receita[]>([])
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [grupo, setGrupo] = useState('')
  const [tipo, setTipo] = useState<TipoProdutoVenda | ''>('normal')
  const [semFicha, setSemFicha] = useState(false)
  const [editando, setEditando] = useState<ProdutoVenda | 'novo' | null>(null)
  const carregar = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([store.produtosVenda(), store.receitas().catch(() => [])])
      setProdutos(p)
      setReceitas(r.filter((x) => x.tipo === 'produto' && x.area === 'lojas'))
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [store])
  useEffect(() => { carregar() }, [carregar])

  const todos = produtos ?? []
  const grupos = [...new Set(todos.map((p) => p.grupo).filter(Boolean) as string[])].sort()
  const termo = busca.trim().toLowerCase()
  const lista = todos.filter((p) => p.ativo && (!grupo || p.grupo === grupo) && (!tipo || p.tipo === tipo) && (!semFicha || !p.receitaId)
    && (!termo || p.nome.toLowerCase().includes(termo) || p.ecleticaCodigo === termo))
  const nomeFicha = (id: string | null) => (id ? receitas.find((r) => r.id === id)?.nome ?? 'ligada' : null)
  const { ordenada, cabecalho } = useOrdem(lista, {
    nome: (p) => p.nome, codigo: (p) => p.ecleticaCodigo, grupo: (p) => (p.grupo ? [p.grupo, p.subgrupo ?? '', p.nome].join('\u0001') : null),
    subgrupo: (p) => p.subgrupo, preco: (p) => p.preco, pizza: (p) => p.precoPizza,
  }, { col: 'grupo' })

  if (erro) return <p className="text-red-700">{erro}</p>
  if (!produtos) return <p className="text-stone-400">Carregando…</p>
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${estiloEntrada} basis-full py-2! sm:basis-0 sm:flex-1`} placeholder="Buscar por nome ou código" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar produto" />
        <select className={`${estiloEntrada} w-auto! py-2!`} value={grupo} onChange={(e) => setGrupo(e.target.value)} aria-label="Grupo">
          <option value="">Todos os grupos</option>
          {grupos.map((g) => <option key={g}>{g}</option>)}
        </select>
        <select className={`${estiloEntrada} w-auto! py-2!`} value={tipo} onChange={(e) => setTipo(e.target.value as TipoProdutoVenda | '')} aria-label="Tipo">
          <option value="">Todos os tipos</option>
          {Object.entries(TIPOS_PRODUTO_VENDA).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
        </select>
        <Botao onClick={() => setEditando('novo')}>+ Produto</Botao>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm text-stone-600">
        <span>{lista.length} produto{lista.length === 1 ? '' : 's'}</span>
        <label className="flex items-center gap-2"><input type="checkbox" className="accent-carvao" checked={semFicha} onChange={(e) => setSemFicha(e.target.checked)} /> Só sem ficha técnica</label>
      </div>
      {lista.length === 0 ? <Vazio>Nenhum produto neste filtro.</Vazio> : (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs text-stone-500">
              <tr>
                {cabecalho('nome', 'Produto')}
                {cabecalho('codigo', 'Código', 'hidden md:table-cell')}
                {cabecalho('grupo', 'Grupo', 'hidden sm:table-cell')}
                {cabecalho('subgrupo', 'Subgrupo', 'hidden lg:table-cell')}
                {cabecalho('preco', 'Burger', 'text-right', true)}
                {cabecalho('pizza', 'Pizza', 'text-right', true)}
              </tr>
            </thead>
            <tbody>
              {ordenada.map((p) => (
                <tr key={p.id} onClick={() => setEditando(p)} className="cursor-pointer border-t border-stone-100 hover:bg-stone-50">
                  <td className="px-3 py-2">
                    <div className="font-semibold">{p.nome}</div>
                    <div className="text-xs text-stone-500">
                      <span className="md:hidden">{p.ecleticaCodigo && `cód. ${p.ecleticaCodigo} · `}</span>
                      <span className="sm:hidden">{(p.subgrupo || p.grupo) && `${p.subgrupo || p.grupo} · `}</span>
                      {[p.tipo !== 'normal' && TIPOS_PRODUTO_VENDA[p.tipo], p.receitaId ? `ficha: ${nomeFicha(p.receitaId)}` : 'sem ficha'].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 text-stone-600 md:table-cell">{p.ecleticaCodigo ?? '—'}</td>
                  <td className="hidden px-3 py-2 text-stone-600 sm:table-cell">{p.grupo ?? '—'}</td>
                  <td className="hidden px-3 py-2 text-stone-600 lg:table-cell">{p.subgrupo ?? '—'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{p.preco !== null ? reais(p.preco) : '—'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{p.precoPizza !== null ? reais(p.precoPizza) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editando && (
        <EditarProduto p={editando === 'novo' ? null : editando} grupos={grupos} receitas={receitas} aoFechar={() => setEditando(null)}
          aoSalvar={async () => { const novo = editando === 'novo'; setEditando(null); await carregar(); avisar(novo ? 'Produto cadastrado' : 'Produto salvo') }} />
      )}
    </div>
  )
}

function EditarProduto({ p, grupos, receitas, aoFechar, aoSalvar }: { p: ProdutoVenda | null; grupos: string[]; receitas: Receita[]; aoFechar: () => void; aoSalvar: () => void }) {
  const { store } = useApp()
  const [f, setF] = useState({
    nome: p?.nome ?? '', ecleticaCodigo: p?.ecleticaCodigo ?? '', grupo: p?.grupo ?? '', subgrupo: p?.subgrupo ?? '', tipo: p?.tipo ?? ('normal' as TipoProdutoVenda),
    preco: numTexto(p?.preco ?? null), precoPizza: numTexto(p?.precoPizza ?? null), receitaId: p?.receitaId ?? '',
  })
  const [ativo, setAtivo] = useState(p?.ativo ?? true)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const mudar = (c: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [c]: e.target.value })

  const salvar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!f.nome.trim()) return setErro('Dê um nome ao produto.')
    const preco = f.preco.trim() ? lerValor(f.preco) : null
    const precoPizza = f.precoPizza.trim() ? lerValor(f.precoPizza) : null
    if ((f.preco.trim() && (preco === null || preco < 0)) || (f.precoPizza.trim() && (precoPizza === null || precoPizza < 0))) return setErro('Confira os preços.')
    setSalvando(true)
    try {
      await store.salvarProdutoVenda({
        id: p?.id, nome: f.nome, ecleticaCodigo: f.ecleticaCodigo.trim() || null, grupo: f.grupo || null, subgrupo: f.subgrupo || null, tipo: f.tipo,
        unidade: p?.unidade ?? 'un', preco, precoPizza, receitaId: f.receitaId || null, ativo,
      })
      aoSalvar()
    } catch (e) {
      const m = (e as Error).message
      setErro(/duplicate|unique/i.test(m) ? 'Já existe um produto com esse código da Eclética.' : m)
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={p ? p.nome : 'Novo produto de venda'} aberto aoFechar={aoFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <Campo rotulo="Nome (como no PDV)"><input className={estiloEntrada} value={f.nome} onChange={mudar('nome')} onBlur={() => setF((x) => ({ ...x, nome: nomeItem(x.nome) }))} required /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Código na Eclética"><input className={estiloEntrada} inputMode="numeric" value={f.ecleticaCodigo} onChange={mudar('ecleticaCodigo')} /></Campo>
          <Campo rotulo="Tipo">
            <select className={estiloEntrada} value={f.tipo} onChange={mudar('tipo')}>
              {Object.entries(TIPOS_PRODUTO_VENDA).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Grupo">
            <input className={estiloEntrada} list="grupos-produto" value={f.grupo} onChange={mudar('grupo')} />
            <datalist id="grupos-produto">{grupos.map((g) => <option key={g} value={g} />)}</datalist>
          </Campo>
          <Campo rotulo="Subgrupo"><input className={estiloEntrada} value={f.subgrupo} onChange={mudar('subgrupo')} placeholder="Ex.: BURGERS" /></Campo>
          <Campo rotulo="Preço The Ozzy Burger (R$)"><input className={estiloEntrada} inputMode="decimal" value={f.preco} onChange={mudar('preco')} placeholder="Tabela padrão" /></Campo>
          <Campo rotulo="Preço The Ozzy Pizza (R$)"><input className={estiloEntrada} inputMode="decimal" value={f.precoPizza} onChange={mudar('precoPizza')} placeholder="Tabela da Pizza" /></Campo>
        </div>
        <Campo rotulo="Ficha técnica" dica="Liga o produto à ficha, para o custo e o consumo de insumos pelas vendas.">
          <select className={estiloEntrada} value={f.receitaId} onChange={mudar('receitaId')}>
            <option value="">Sem ficha</option>
            {receitas.filter((r) => r.ativo || r.id === f.receitaId).map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </Campo>
        {p?.receitaId && p.receitaId === f.receitaId && (
          <Botao type="button" variante="secundario" className="w-full" onClick={() => ir('fichas/' + p.receitaId)}>Abrir a ficha técnica ›</Botao>
        )}
        {p && !f.receitaId && (
          <Botao type="button" variante="secundario" className="w-full" onClick={() => ir('fichas')}>Ir para Fichas técnicas para criar a ficha ›</Botao>
        )}
        {p && (
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="size-5 accent-carvao" checked={!ativo} onChange={(e) => setAtivo(!e.target.checked)} /> Inativar {!ativo && <Selo>Some da lista</Selo>}
          </label>
        )}
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
      </form>
    </Modal>
  )
}
