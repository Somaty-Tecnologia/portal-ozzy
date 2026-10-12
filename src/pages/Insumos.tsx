import { useCallback, useEffect, useState } from 'react'
import { Botao, Campo, Modal, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useOrdem } from '../components/Ordenar'
import EscolherConta from '../components/EscolherConta'
import { useApp } from '../lib/contexto'
import { montarCatalogo, nomeUnidade, reais, usadoEm, type Catalogo } from '../lib/custos'
import { dataLonga } from '../lib/datas'
import { lerNumero } from '../lib/financeiro'
import { ir } from '../lib/rota'
import { formatarCnpj } from '../lib/nfe'
import { conferirPrecos, type AlertaPreco } from '../lib/conferencia'

import ImportarFornecedores from './ImportarFornecedores'
import { SETORES_ENVIO, type ContaContabil, type CurvaAbc, type Fornecedor, type Insumo, type PrecoInsumo, type SetorEnvio, type UnidadeMedida } from '../lib/types'

const numero = lerNumero
const doNumero = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n).replace('.', ','))

// Cadastro único de insumos (com histórico de preço) e fornecedores, usado pelas fichas de eventos.
export default function Insumos({ aba }: { aba: 'insumos' | 'fornecedores' | 'categorias' | 'conferencia' }) {
  const { store } = useApp()
  const [insumos, setInsumos] = useState<Insumo[] | null>(null)
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [cat, setCat] = useState<Catalogo | null>(null)
  const [categorias, setCategorias] = useState<string[]>([])
  const [erro, setErro] = useState('')
  const carregar = useCallback(async () => {
    try {
      const [i, f, r, v, c] = await Promise.all([store.insumos(), store.fornecedores(), store.receitas(), store.versoesReceitas(), store.categoriasInsumo()])
      setInsumos(i)
      setFornecedores(f)
      setCategorias(c)
      setCat(montarCatalogo(i, r, v))
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [store])
  useEffect(() => {
    carregar()
  }, [carregar])

  if (erro) return <p className="text-red-600">{erro}</p>
  if (!insumos || !cat) return <p className="text-stone-400">Carregando…</p>
  return aba === 'insumos'
    ? <ListaInsumos insumos={insumos} fornecedores={fornecedores} categorias={categorias} cat={cat} aoMudar={carregar} />
    : aba === 'conferencia' ? <ConferenciaPrecos insumos={insumos} fornecedores={fornecedores} categorias={categorias} cat={cat} aoMudar={carregar} />
    : aba === 'categorias' ? <ListaCategorias insumos={insumos} categorias={categorias} aoMudar={carregar} />
    : <ListaFornecedores insumos={insumos} fornecedores={fornecedores} aoMudar={carregar} />
}

function ListaInsumos({ insumos, fornecedores, categorias, cat, aoMudar }: { insumos: Insumo[]; fornecedores: Fornecedor[]; categorias: string[]; cat: Catalogo; aoMudar: () => Promise<void> }) {
  const { avisar, store } = useApp()
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [semPreco, setSemPreco] = useState(false)
  const [inativos, setInativos] = useState(false)
  const [estoque, setEstoque] = useState<'' | 'sim' | 'nao'>('')
  // Curva ABC das compras dos últimos 90 dias (0077): mostra o que pesa no valor comprado.
  const [curva, setCurva] = useState<Map<string, CurvaAbc>>(new Map())
  useEffect(() => { store.curvaAbc().then((c) => setCurva(new Map(c.map((x) => [x.insumoId, x]))), () => {}) }, [store])
  // Marcar "controla estoque" na hora, sem recarregar a lista inteira a cada clique.
  const [controla, setControla] = useState<Record<string, boolean>>({})
  const controlaDe = (i: Insumo) => controla[i.id] ?? i.controlaEstoque !== false
  const [limite, setLimite] = useState(150)
  const [editando, setEditando] = useState<Insumo | 'novo' | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [excluindo, setExcluindo] = useState(false)
  const [resultado, setResultado] = useState<Awaited<ReturnType<typeof store.excluirInsumos>> | null>(null)
  const mudarEstoque = async (ids: string[], valor: boolean) => {
    const antes = controla
    setControla((c) => ({ ...c, ...Object.fromEntries(ids.map((id) => [id, valor])) }))
    try {
      await store.controlarEstoque(ids, valor)
    } catch (e) {
      setControla(antes)
      avisar((e as Error).message)
    }
  }
  const marcar = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const excluirSelecionados = async () => {
    if (!confirm(`Excluir ${sel.size} ${sel.size === 1 ? 'material' : 'materiais'} do cadastro? O que estiver em ficha, nota ou produção só é inativado.`)) return
    setExcluindo(true)
    try {
      setResultado(await store.excluirInsumos([...sel]))
      setSel(new Set())
      await aoMudar()
    } catch (e) {
      avisar((e as Error).message)
    }
    setExcluindo(false)
  }
  const nomeForn = (id: string | null) => fornecedores.find((f) => f.id === id)?.nome
  const termo = busca.trim().toLowerCase()
  const lista = insumos.filter(
    (i) => (inativos || i.ativo) && (!categoria || i.categoria === categoria) && (!estoque || controlaDe(i) === (estoque === 'sim')) && (!semPreco || i.preco === null)
      && (!termo || i.nome.toLowerCase().includes(termo) || i.ecleticaCodigo === termo),
  )
  const faltando = insumos.filter((i) => i.ativo && i.preco === null).length
  const { ordenada, cabecalho } = useOrdem(lista, {
    nome: (i) => i.nome, categoria: (i) => i.categoria, preco: (i) => i.preco, fornecedor: (i) => nomeForn(i.fornecedorId), codigo: (i) => i.ecleticaCodigo, estoque: (i) => (controlaDe(i) ? 1 : 0), curva: (i) => curva.get(i.id)?.valor,
  }, { col: 'nome' })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${estiloEntrada} basis-full py-2! sm:basis-0 sm:flex-1`} placeholder="Buscar por nome ou código" value={busca} onChange={(e) => { setBusca(e.target.value); setLimite(150) }} aria-label="Buscar insumo" />
        <select className={`${estiloEntrada} w-auto! py-2!`} value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {categorias.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className={`${estiloEntrada} w-auto! py-2!`} value={estoque} onChange={(e) => setEstoque(e.target.value as '' | 'sim' | 'nao')} aria-label="Controle de estoque">
          <option value="">Controla ou não o estoque</option>
          <option value="sim">Controla estoque</option>
          <option value="nao">Não controla estoque</option>
        </select>
        <Botao onClick={() => setEditando('novo')}>+ Material</Botao>
      </div>
      {sel.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-2xl bg-carvao px-4 py-2.5 text-sm text-white shadow-lg">
          <span className="font-semibold">{sel.size} {sel.size === 1 ? 'selecionado' : 'selecionados'}</span>
          <button className="underline" onClick={() => setSel(new Set())}>limpar</button>
          <button className="rounded-lg bg-white/10 px-3 py-1.5 font-semibold hover:bg-white/20" onClick={() => mudarEstoque([...sel], true)}>Controla estoque</button>
          <button className="rounded-lg bg-white/10 px-3 py-1.5 font-semibold hover:bg-white/20" onClick={() => mudarEstoque([...sel], false)}>Não controla</button>
          <Botao variante="perigo" className="ml-auto py-1.5!" disabled={excluindo} onClick={excluirSelecionados}>{excluindo ? 'Excluindo…' : 'Excluir'}</Botao>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4 text-sm text-stone-600">
        <span>{lista.length} {lista.length === 1 ? 'material' : 'materiais'}</span>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="accent-carvao" checked={semPreco} onChange={(e) => setSemPreco(e.target.checked)} /> Só sem preço {faltando > 0 && <Selo cor="ambar">{faltando} ativos</Selo>}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="accent-carvao" checked={inativos} onChange={(e) => setInativos(e.target.checked)} /> Mostrar inativos
        </label>
      </div>
      {lista.length === 0 ? (
        <Vazio>Nenhum insumo neste filtro.</Vazio>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs text-stone-500">
              <tr>
                <th className="w-8 py-2 pl-3">
                  <input type="checkbox" className="size-4 accent-carvao" aria-label="Selecionar todos"
                    checked={ordenada.slice(0, limite).length > 0 && ordenada.slice(0, limite).every((i) => sel.has(i.id))}
                    onChange={(e) => setSel(e.target.checked ? new Set(ordenada.slice(0, limite).map((i) => i.id)) : new Set())} />
                </th>
                {cabecalho('nome', 'Material')}
                {cabecalho('codigo', 'Código', 'hidden md:table-cell')}
                {cabecalho('categoria', 'Categoria', 'hidden sm:table-cell')}
                {cabecalho('preco', 'Preço', 'text-right', true)}
                {cabecalho('fornecedor', 'Fornecedor', 'hidden lg:table-cell')}
                {cabecalho('curva', 'Curva', 'hidden w-16 text-center sm:table-cell', true)}
                {cabecalho('estoque', 'Controla estoque', 'w-24 text-center', true)}
              </tr>
            </thead>
            <tbody>
              {ordenada.slice(0, limite).map((i) => {
                const usos = usadoEm(cat, { insumoId: i.id }).length
                return (
                  <tr key={i.id} onClick={() => setEditando(i)} className={`cursor-pointer border-t border-stone-100 hover:bg-stone-50 ${sel.has(i.id) ? 'bg-ozzy-400/15' : ''}`}>
                    <td className="py-2 pl-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="size-4 accent-carvao" aria-label={`Selecionar ${i.nome}`} checked={sel.has(i.id)} onChange={() => marcar(i.id)} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold">{i.nome} {!i.ativo && <Selo>Inativo</Selo>}</div>
                      <div className="text-xs text-stone-500">
                        <span className="md:hidden">{i.ecleticaCodigo && `cód. ${i.ecleticaCodigo} · `}</span>
                        <span className="sm:hidden">{i.categoria && `${i.categoria} · `}</span>
                        {[i.prePreparo && 'pré-preparo', usos ? `em ${usos} ficha${usos === 1 ? '' : 's'}` : null,
                          i.embalagem && `compra em ${i.embalagem}${i.embalagemQtd ? ` com ${String(i.embalagemQtd).replace('.', ',')}` : ''}`].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td className="hidden px-3 py-2 text-stone-600 md:table-cell">{i.ecleticaCodigo ?? '—'}</td>
                    <td className="hidden px-3 py-2 text-stone-600 sm:table-cell">{i.categoria ?? '—'}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {i.preco !== null ? `${reais(i.preco)}/${nomeUnidade(i.unidade)}` : <span className="font-semibold text-amber-700">sem preço</span>}
                      {i.precoEm && <div className="text-xs text-stone-400">{dataLonga(i.precoEm)}</div>}
                    </td>
                    <td className="hidden px-3 py-2 text-stone-600 lg:table-cell">{nomeForn(i.fornecedorId) ?? '—'}</td>
                    <td className="hidden px-3 py-2 text-center sm:table-cell" title={curva.get(i.id) ? `${String(curva.get(i.id)!.participacao).replace('.', ',')}% do valor comprado em 90 dias` : 'Sem compras em 90 dias'}>
                      {curva.get(i.id) ? <Selo cor={curva.get(i.id)!.classe === 'A' ? 'vermelho' : curva.get(i.id)!.classe === 'B' ? 'ambar' : 'cinza'}>{curva.get(i.id)!.classe}</Selo> : <span className="text-stone-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="size-5 accent-carvao" aria-label={`${i.nome} controla estoque`} checked={controlaDe(i)} onChange={(e) => mudarEstoque([i.id], e.target.checked)} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {lista.length > limite && (
            <button onClick={() => setLimite(lista.length)} className="w-full border-t border-stone-100 py-2.5 text-sm font-semibold text-stone-600 hover:bg-stone-50">
              Mostrar todos os {lista.length} (ou busque pelo nome)
            </button>
          )}
        </div>
      )}
      {resultado && (
        <Modal titulo="Exclusão de materiais" aberto aoFechar={() => setResultado(null)}>
          <div className="space-y-3 text-sm">
            <p><b>{resultado.filter((r) => r.excluido).length}</b> excluído{resultado.filter((r) => r.excluido).length === 1 ? '' : 's'} do cadastro.</p>
            {resultado.some((r) => !r.excluido) && (
              <div>
                <p className="mb-1">Estes têm uso e foram <b>inativados</b> (somem das listas e das fichas novas):</p>
                <ul className="space-y-1">{resultado.filter((r) => !r.excluido).map((r) => <li key={r.insumoId}><b>{r.nome}</b> <span className="text-stone-500">· {r.motivo}</span></li>)}</ul>
              </div>
            )}
            <Botao className="w-full" onClick={() => setResultado(null)}>Ok</Botao>
          </div>
        </Modal>
      )}
      {editando && (
        <EditarInsumo
          i={editando === 'novo' ? null : editando}
          fornecedores={fornecedores}
          categorias={categorias}
          cat={cat}
          aoFechar={() => setEditando(null)}
          aoSalvar={async (aviso) => {
            const novo = editando === 'novo'
            setEditando(null)
            await aoMudar()
            avisar(aviso ?? (novo ? 'Material cadastrado' : 'Material atualizado'))
          }}
        />
      )}
    </div>
  )
}

function EditarInsumo({ i, fornecedores, categorias, cat, aoFechar, aoSalvar }: {
  i: Insumo | null
  fornecedores: Fornecedor[]
  categorias: string[]
  cat: Catalogo
  aoFechar: () => void
  aoSalvar: (aviso?: string) => void
}) {
  const { store, nomeDe } = useApp()
  const [f, setF] = useState({
    nome: i?.nome ?? '', categoria: i?.categoria ?? '', unidade: i?.unidade ?? 'kg', preco: doNumero(i?.preco), embalagem: i?.embalagem ?? '',
    embalagemQtd: doNumero(i?.embalagemQtd), fornecedorId: i?.fornecedorId ?? '', observacao: i?.observacao ?? '',
    setorEnvio: i?.setorEnvio ?? '', contaId: i?.contaId ?? '', estoqueMinimo: doNumero(i?.estoqueMinimo),
  })
  const [prePreparo, setPrePreparo] = useState(!!i?.prePreparo)
  const [plano, setPlano] = useState<ContaContabil[]>([])
  const [ativo, setAtivo] = useState(i?.ativo ?? true)
  const [precos, setPrecos] = useState<PrecoInsumo[]>([])
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const mudar = (c: keyof typeof f) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [c]: ev.target.value })
  useEffect(() => {
    if (i) store.precosInsumo(i.id).then(setPrecos)
    store.planoContas().then(setPlano, () => setPlano([]))
  }, [store, i])
  const usos = i ? usadoEm(cat, { insumoId: i.id }) : []

  const excluir = async () => {
    if (!i || !confirm(`Excluir ${i.nome} do cadastro?`)) return
    setSalvando(true)
    try {
      const [r] = await store.excluirInsumos([i.id])
      aoSalvar(r?.excluido ? `${i.nome} excluído` : `${i.nome} não pôde ser excluído (${r?.motivo ?? 'tem uso'}). Foi inativado.`)
    } catch (e) {
      setErro((e as Error).message)
      setSalvando(false)
    }
  }
  const salvar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!f.nome.trim()) return setErro('Dê um nome ao insumo.')
    const preco = numero(f.preco)
    if (preco !== null && (Number.isNaN(preco) || preco < 0)) return setErro('Confira o preço.')
    const embQtd = numero(f.embalagemQtd)
    if (embQtd !== null && (Number.isNaN(embQtd) || embQtd <= 0)) return setErro('Confira quantas unidades vêm na embalagem.')
    const minimo = numero(f.estoqueMinimo)
    if (minimo !== null && (Number.isNaN(minimo) || minimo < 0)) return setErro('Confira o estoque mínimo.')
    setSalvando(true)
    try {
      await store.salvarInsumo({
        id: i?.id, nome: f.nome, categoria: f.categoria || null, unidade: f.unidade as UnidadeMedida, preco, embalagem: f.embalagem || null, embalagemQtd: embQtd,
        fornecedorId: f.fornecedorId || null, observacao: f.observacao || null, ativo,
        setorEnvio: (f.setorEnvio || null) as SetorEnvio | null, contaId: f.contaId || null, estoqueMinimo: minimo, prePreparo,
      })
      aoSalvar()
    } catch (e) {
      const m = (e as Error).message
      setErro(/duplicate|unique/i.test(m) ? 'Já existe um insumo com esse nome.' : m)
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={i ? `${i.nome}${i.ecleticaCodigo ? ` · cód. ${i.ecleticaCodigo}` : ''}` : 'Novo material'} aberto aoFechar={aoFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <Campo rotulo="Nome">
          <input className={estiloEntrada} value={f.nome} onChange={mudar('nome')} required />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Categoria" dica="Novas categorias em Cadastros › Categorias.">
            <select className={estiloEntrada} value={f.categoria} onChange={mudar('categoria')}>
              <option value="">Sem categoria</option>
              {[...new Set([...categorias, ...(f.categoria ? [f.categoria] : [])])].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Unidade de uso">
            <select className={estiloEntrada} value={f.unidade} onChange={mudar('unidade')}>
              <option value="kg">kg</option>
              <option value="l">litro</option>
              <option value="un">unidade</option>
            </select>
          </Campo>
        </div>
        <Campo rotulo={`Preço por ${nomeUnidade(f.unidade)} (R$)`} dica="Mudar o preço atualiza o custo das fichas e fica no histórico.">
          <input className={estiloEntrada} inputMode="decimal" value={f.preco} onChange={mudar('preco')} placeholder="0,00" />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Embalagem de compra">
            <input className={estiloEntrada} value={f.embalagem} onChange={mudar('embalagem')} placeholder="Fardo, caixa, pote…" />
          </Campo>
          <Campo rotulo={`Quantos ${nomeUnidade(f.unidade)} vêm nela`}>
            <input className={estiloEntrada} inputMode="decimal" value={f.embalagemQtd} onChange={mudar('embalagemQtd')} placeholder="Ex.: 12" />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Vai para">
            <select className={estiloEntrada} value={f.setorEnvio} onChange={mudar('setorEnvio')}>
              <option value="">Não vai para as lojas</option>
              {Object.entries(SETORES_ENVIO).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </Campo>
          <Campo rotulo={`Estoque mínimo (${nomeUnidade(f.unidade)})`}>
            <input className={estiloEntrada} inputMode="decimal" value={f.estoqueMinimo} onChange={mudar('estoqueMinimo')} placeholder="Opcional" />
          </Campo>
        </div>
        <Campo rotulo="Conta contábil" dica="A conta da despesa quando este material é comprado.">
          <EscolherConta plano={plano} valor={f.contaId} aoMudar={(id) => setF({ ...f, contaId: id })} vazio="Nenhuma" />
        </Campo>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-carvao" checked={prePreparo} onChange={(ev) => setPrePreparo(ev.target.checked)} />
          Pré-preparo feito na Central (aparece em Produção › Lançar)
        </label>
        <Campo rotulo="Fornecedor">
          <select className={estiloEntrada} value={f.fornecedorId} onChange={mudar('fornecedorId')}>
            <option value="">—</option>
            {fornecedores.filter((x) => x.ativo || x.id === f.fornecedorId).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Observação">
          <textarea className={estiloEntrada} rows={2} value={f.observacao} onChange={mudar('observacao')} />
        </Campo>
        {i && (
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="size-5 accent-carvao" checked={!ativo} onChange={(ev) => setAtivo(!ev.target.checked)} />
            Inativar (não aparece para novas fichas)
          </label>
        )}
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
        {i && (
          <button type="button" disabled={salvando} onClick={excluir} className="w-full text-center text-sm font-semibold text-red-700 hover:underline">
            Excluir material
          </button>
        )}
      </form>
      {i && (
        <div className="mt-5 space-y-3 border-t border-stone-200 pt-4 text-sm">
          <div>
            <h3 className="mb-1 font-bold">Usado nas fichas</h3>
            {usos.length === 0 ? (
              <p className="text-stone-500">Nenhuma ficha usa este insumo.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {usos.map((u) => <button key={u.id} onClick={() => ir('fichas/' + u.id)} className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold hover:bg-stone-200">{u.nome}</button>)}
              </div>
            )}
          </div>
          <div>
            <h3 className="mb-1 font-bold">Histórico de preço</h3>
            <ul className="space-y-0.5">
              {precos.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span>{p.preco !== null ? reais(p.preco) : 'sem preço'}</span>
                  <span className="text-stone-500">{dataLonga(p.em)} · {p.por ? nomeDe(p.por) : p.origem}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  )
}

// Conferência de preços (Heitor, 11/10): o que parece errado no preço dos materiais, para corrigir ou marcar "está certo".
function ConferenciaPrecos({ insumos, fornecedores, categorias, cat, aoMudar }: { insumos: Insumo[]; fornecedores: Fornecedor[]; categorias: string[]; cat: Catalogo; aoMudar: () => Promise<void> }) {
  const { store, avisar } = useApp()
  const [alertas, setAlertas] = useState<AlertaPreco[] | null>(null)
  const [erro, setErro] = useState('')
  const [so, setSo] = useState<'fora' | 'todos'>('fora')
  const [inativos, setInativos] = useState(false)
  const [editando, setEditando] = useState<Insumo | null>(null)
  useEffect(() => {
    let vivo = true
    Promise.all([store.referenciasPreco(), store.produtosVenda().catch(() => [])]).then(([refs, ps]) => {
      if (vivo) setAlertas(conferirPrecos(insumos, cat, refs, ps.filter((p) => p.ativo).map((p) => ({ nome: p.nome, receitaId: p.receitaId, preco: p.preco ?? p.precoPizza })), inativos))
    }, (e) => setErro((e as Error).message))
    return () => { vivo = false }
  }, [store, insumos, cat, inativos])
  const lista = (alertas ?? []).filter((a) => so === 'todos' || a.gravidade === 'fora')
  const { ordenada, cabecalho } = useOrdem(lista, {
    nome: (a) => a.insumo.nome, categoria: (a) => a.insumo.categoria, preco: (a) => a.insumo.preco, gravidade: (a) => (a.gravidade === 'fora' ? 0 : 1),
  }, { col: 'gravidade' })
  const estaCerto = async (a: AlertaPreco) => {
    try {
      await store.conferirPrecoInsumo(a.insumo.id, a.insumo.preco)
      await aoMudar()
      avisar(`${a.insumo.nome}: preço marcado como certo`)
    } catch (e) {
      avisar((e as Error).message)
    }
  }

  if (erro) return <p className="text-red-600">{erro}</p>
  if (!alertas) return <p className="text-stone-400">Conferindo os preços…</p>
  const fora = alertas.filter((a) => a.gravidade === 'fora').length
  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600">
        O portal compara o preço de cada material com a última entrada no estoque, com o preço anterior, com a ficha (nos pré-preparos), com os outros da mesma categoria e com o CMV dos produtos.
        Corrija o preço ou marque <b>Está certo</b>: ele só volta a aparecer se o preço mudar.
      </p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {([['fora', `Fora do padrão (${fora})`], ['todos', `Tudo para conferir (${alertas.length})`]] as const).map(([v, n]) => (
          <button key={v} onClick={() => setSo(v)} className={`rounded-lg px-3 py-1.5 font-semibold ${so === v ? 'bg-carvao text-white' : 'text-stone-600 hover:bg-stone-200'}`}>{n}</button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-stone-600">
          <input type="checkbox" className="accent-carvao" checked={inativos} onChange={(e) => setInativos(e.target.checked)} /> Mostrar inativos
        </label>
      </div>
      {lista.length === 0 ? <Vazio>Nenhum preço fora do padrão. 👍</Vazio> : (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs text-stone-500">
              <tr>
                {cabecalho('nome', 'Material')}
                {cabecalho('categoria', 'Categoria', 'hidden md:table-cell')}
                {cabecalho('preco', 'Preço', 'text-right', true)}
                {cabecalho('gravidade', 'O que parece errado')}
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {ordenada.map((a) => (
                <tr key={a.insumo.id} className="border-t border-stone-100 align-top">
                  <td className="px-3 py-2">
                    <button onClick={() => setEditando(a.insumo)} className="text-left font-semibold hover:underline">{a.insumo.nome}</button> {!a.insumo.ativo && <Selo>Inativo</Selo>}
                    <div className="text-xs text-stone-500">{a.insumo.ecleticaCodigo && `cód. ${a.insumo.ecleticaCodigo}`}<span className="md:hidden">{a.insumo.categoria && ` · ${a.insumo.categoria}`}</span></div>
                  </td>
                  <td className="hidden px-3 py-2 text-stone-600 md:table-cell">{a.insumo.categoria ?? '—'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{a.insumo.preco !== null ? `${reais(a.insumo.preco, a.insumo.preco < 1 ? 4 : 2)}/${nomeUnidade(a.insumo.unidade)}` : '—'}</td>
                  <td className="px-3 py-2">
                    <Selo cor={a.gravidade === 'fora' ? 'vermelho' : 'ambar'}>{a.gravidade === 'fora' ? 'Fora do padrão' : 'Conferir'}</Selo>
                    <ul className="mt-1 space-y-0.5 text-xs text-stone-600">{a.motivos.map((m) => <li key={m}>{m}</li>)}</ul>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <span className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end">
                      <Botao variante="secundario" className="px-2.5! py-1! text-xs" onClick={() => setEditando(a.insumo)}>Corrigir</Botao>
                      {a.insumo.preco !== null && <Botao variante="fantasma" className="px-2.5! py-1! text-xs" onClick={() => estaCerto(a)}>Está certo</Botao>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editando && (
        <EditarInsumo i={editando} fornecedores={fornecedores} categorias={categorias} cat={cat} aoFechar={() => setEditando(null)}
          aoSalvar={async (aviso) => { setEditando(null); await aoMudar(); avisar(aviso ?? 'Material atualizado') }} />
      )}
    </div>
  )
}

function ListaCategorias({ insumos, categorias, aoMudar }: { insumos: Insumo[]; categorias: string[]; aoMudar: () => Promise<void> }) {
  const { store, avisar } = useApp()
  const [editando, setEditando] = useState<string | 'nova' | null>(null)
  const [nome, setNome] = useState('')
  const [juntarCom, setJuntarCom] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const linhas = categorias.map((c) => {
    const deles = insumos.filter((i) => i.categoria === c)
    return { nome: c, ativos: deles.filter((i) => i.ativo).length, total: deles.length }
  })
  const semCategoria = insumos.filter((i) => i.ativo && !i.categoria).length
  const { ordenada, cabecalho } = useOrdem(linhas, { nome: (l) => l.nome, ativos: (l) => l.ativos }, { col: 'nome' })
  const abrir = (c: string | 'nova') => { setEditando(c); setNome(c === 'nova' ? '' : c); setJuntarCom(''); setErro('') }
  const fazer = async (acao: () => Promise<void>, aviso: string) => {
    setSalvando(true)
    try {
      await acao()
      setEditando(null)
      await aoMudar()
      avisar(aviso)
    } catch (e) {
      const m = (e as Error).message
      setErro(/duplicate|unique/i.test(m) ? 'Já existe uma categoria com esse nome. Para juntar as duas, use "Juntar com".' : m)
    }
    setSalvando(false)
  }
  const salvar = (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!nome.trim()) return setErro('Dê um nome à categoria.')
    if (editando === nome.trim()) return setEditando(null)
    fazer(() => store.salvarCategoriaInsumo(nome, editando === 'nova' ? undefined : editando!), editando === 'nova' ? 'Categoria criada' : 'Categoria renomeada')
  }
  const atual = linhas.find((l) => l.nome === editando)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-stone-600">
          {categorias.length} categorias{semCategoria > 0 && <> · <span className="font-semibold text-amber-700">{semCategoria} materiais ativos sem categoria</span></>}
        </span>
        <Botao onClick={() => abrir('nova')}>+ Categoria</Botao>
      </div>
      {linhas.length === 0 ? <Vazio>Nenhuma categoria cadastrada.</Vazio> : (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs text-stone-500">
              <tr>{cabecalho('nome', 'Categoria')}{cabecalho('ativos', 'Materiais ativos', 'text-right', true)}</tr>
            </thead>
            <tbody>
              {ordenada.map((l) => (
                <tr key={l.nome} onClick={() => abrir(l.nome)} className="cursor-pointer border-t border-stone-100 hover:bg-stone-50">
                  <td className="px-3 py-2 font-semibold">{l.nome}</td>
                  <td className="px-3 py-2 text-right">{l.ativos}{l.total > l.ativos && <span className="text-xs text-stone-400"> (+{l.total - l.ativos} inativos)</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editando && (
        <Modal titulo={editando === 'nova' ? 'Nova categoria' : editando} aberto aoFechar={() => setEditando(null)}>
          <form onSubmit={salvar} className="space-y-4">
            <Campo rotulo="Nome" dica={atual ? `Renomear muda os ${atual.total} materiais desta categoria.` : undefined}>
              <input className={estiloEntrada} value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
            </Campo>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <Botao className="w-full" disabled={salvando}>{editando === 'nova' ? 'Criar' : 'Salvar nome'}</Botao>
          </form>
          {atual && (
            <div className="mt-5 space-y-3 border-t border-stone-200 pt-4 text-sm">
              <Campo rotulo="Juntar com outra categoria" dica={`Os ${atual.total} materiais passam para a escolhida e esta categoria some.`}>
                <select className={estiloEntrada} value={juntarCom} onChange={(e) => setJuntarCom(e.target.value)}>
                  <option value="">Escolha…</option>
                  {categorias.filter((c) => c !== atual.nome).map((c) => <option key={c}>{c}</option>)}
                </select>
              </Campo>
              <div className="flex flex-wrap gap-2">
                <Botao variante="secundario" disabled={!juntarCom || salvando}
                  onClick={() => fazer(() => store.juntarCategoriaInsumo(atual.nome, juntarCom), `Juntada com ${juntarCom}`)}>Juntar</Botao>
                <Botao variante="secundario" disabled={salvando}
                  onClick={() => (atual.total === 0 || confirm(`Os ${atual.total} materiais ficam sem categoria. Tirar a categoria ${atual.nome}?`))
                    && fazer(() => store.juntarCategoriaInsumo(atual.nome, null), 'Categoria tirada')}>Tirar categoria</Botao>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

function ListaFornecedores({ insumos, fornecedores, aoMudar }: { insumos: Insumo[]; fornecedores: Fornecedor[]; aoMudar: () => Promise<void> }) {
  const { store, avisar } = useApp()
  const [editando, setEditando] = useState<Fornecedor | 'novo' | null>(null)
  const [f, setF] = useState({ nome: '', razaoSocial: '', cnpj: '', contato: '', telefone: '', observacao: '', contaPadraoId: '' })
  const [ativo, setAtivo] = useState(true)
  const [erro, setErro] = useState('')
  const [plano, setPlano] = useState<ContaContabil[]>([])
  const [importar, setImportar] = useState(false)
  const [busca, setBusca] = useState('')
  const [inativos, setInativos] = useState(false)
  useEffect(() => {
    store.planoContas().then(setPlano, () => setPlano([]))
  }, [store])
  const abrir = (x: Fornecedor | 'novo') => {
    setEditando(x)
    setErro('')
    setAtivo(x === 'novo' ? true : x.ativo)
    setF(x === 'novo'
      ? { nome: '', razaoSocial: '', cnpj: '', contato: '', telefone: '', observacao: '', contaPadraoId: '' }
      : { nome: x.nome, razaoSocial: x.razaoSocial ?? '', cnpj: formatarCnpj(x.cnpj), contato: x.contato ?? '', telefone: x.telefone ?? '', observacao: x.observacao ?? '', contaPadraoId: x.contaPadraoId ?? '' })
  }
  const salvar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!f.nome.trim()) return setErro('Dê um nome ao fornecedor.')
    const cnpj = f.cnpj.replace(/\D/g, '')
    if (cnpj && cnpj.length !== 14 && cnpj.length !== 11) return setErro('O CNPJ precisa ter 14 números (ou 11, se for CPF).')
    try {
      await store.salvarFornecedor({ id: editando === 'novo' ? undefined : editando!.id, nome: f.nome, contato: f.contato || null, telefone: f.telefone || null, observacao: f.observacao || null, ativo, cnpj: cnpj || null, contaPadraoId: f.contaPadraoId || null, razaoSocial: f.razaoSocial || null })
      setEditando(null)
      await aoMudar()
      avisar('Fornecedor salvo')
    } catch (e) {
      const m = (e as Error).message
      setErro(/duplicate|unique/i.test(m) ? 'Já existe um fornecedor com esse nome ou CNPJ.' : m)
    }
  }
  const mudar = (c: keyof typeof f) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [c]: ev.target.value })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-stone-600">
          {fornecedores.filter((x) => x.ativo).length} fornecedores
          {fornecedores.some((x) => !x.ativo) && (
            <button className="ml-2 underline" onClick={() => setInativos(!inativos)}>{inativos ? 'esconder inativos' : `ver ${fornecedores.filter((x) => !x.ativo).length} inativos`}</button>
          )}
        </span>
        <span className="flex gap-2">
          <Botao variante="secundario" onClick={() => setImportar(true)}>Importar</Botao>
          <Botao onClick={() => abrir('novo')}>+ Fornecedor</Botao>
        </span>
      </div>
      {fornecedores.length > 8 && <input className={estiloEntrada} placeholder="Buscar por nome ou CNPJ" value={busca} onChange={(e) => setBusca(e.target.value)} />}
      {importar && <ImportarFornecedores fornecedores={fornecedores} plano={plano} aoFechar={() => setImportar(false)} aoSalvar={async () => { setImportar(false); await aoMudar(); avisar('Fornecedores importados') }} />}
      {fornecedores.length === 0 ? (
        <Vazio>Nenhum fornecedor cadastrado.</Vazio>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {fornecedores.filter((x) => inativos || x.ativo).filter((x) => !busca || `${x.nome} ${x.razaoSocial ?? ''} ${x.cnpj ?? ''}`.toLowerCase().includes(busca.toLowerCase()) || (x.cnpj ?? '').includes(busca.replace(/\D/g, '') || '-')).map((x) => {
            const n = insumos.filter((i) => i.fornecedorId === x.id && i.ativo).length
            return (
              <li key={x.id}>
                <button onClick={() => abrir(x)} className="flex h-full w-full flex-col rounded-2xl bg-white p-3.5 text-left ring-1 ring-stone-200 hover:ring-carvao">
                  <span className="font-semibold">{x.nome} {!x.ativo && <Selo>Inativo</Selo>}</span>
                  {x.razaoSocial && <span className="text-xs text-stone-600">{x.razaoSocial}</span>}
                  <span className="text-xs text-stone-500">{[x.cnpj ? formatarCnpj(x.cnpj) : null, x.contato, x.telefone, n ? `${n} insumo${n === 1 ? '' : 's'} ativo${n === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {editando && (
        <Modal titulo={editando === 'novo' ? 'Novo fornecedor' : editando.nome} aberto aoFechar={() => setEditando(null)}>
          <form onSubmit={salvar} className="space-y-4">
            <Campo rotulo="Nome (fantasia)"><input className={estiloEntrada} value={f.nome} onChange={mudar('nome')} required /></Campo>
            <Campo rotulo="Razão social" dica="Como aparece no extrato do banco e nas notas. Ajuda a conciliação a achar este fornecedor.">
              <input className={estiloEntrada} value={f.razaoSocial} onChange={mudar('razaoSocial')} placeholder="Ex.: Gaivota Comércio de Alimentos Ltda" />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="CNPJ" dica="Liga as notas fiscais a este fornecedor."><input inputMode="numeric" className={estiloEntrada} value={f.cnpj} onChange={mudar('cnpj')} /></Campo>
              <Campo rotulo="Conta contábil de sempre">
                <EscolherConta plano={plano} valor={f.contaPadraoId} aoMudar={(id) => setF({ ...f, contaPadraoId: id })} vazio="Nenhuma" />
              </Campo>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Contato"><input className={estiloEntrada} value={f.contato} onChange={mudar('contato')} /></Campo>
              <Campo rotulo="Telefone"><input className={estiloEntrada} value={f.telefone} onChange={mudar('telefone')} /></Campo>
            </div>
            <Campo rotulo="Observação"><textarea className={estiloEntrada} rows={2} value={f.observacao} onChange={mudar('observacao')} placeholder="Dia de entrega, pedido mínimo…" /></Campo>
            {editando !== 'novo' && (
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" className="size-5 accent-carvao" checked={!ativo} onChange={(ev) => setAtivo(!ev.target.checked)} /> Inativar
              </label>
            )}
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <Botao className="w-full">Salvar</Botao>
          </form>
        </Modal>
      )}
    </div>
  )
}
