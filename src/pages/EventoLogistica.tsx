import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Botao, CampoNumero, Cartao, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { cmv, custoFicha, montarCatalogo, nomeUnidade, qtd, reais, type Catalogo } from '../lib/custos'
import { dataCurta, diaSemana, hoje, tempoDesde } from '../lib/datas'
import { lerNumero } from '../lib/financeiro'
import { arredondarPara, consumoEvento, estoqueBase, quantoLevar, referenciasPadrao, semFicha, sugerirVendas, type LinhaLevar } from '../lib/logistica'
import { posicaoEventos } from '../lib/painelEventos'
import InsumosEvento from '../components/InsumosEvento'
import { ir } from '../lib/rota'
import { criarReconhecedor, lerContagem } from '../lib/voz'
import {
  chaveDe, daChave, type ChaveItem, type EnvioEvento, type Evento, type EventoEscalado, type Inventario, type ItemContagem, type ItemEnvio, type ItemModeloChecklist,
  type NovoItemEnvio, type Operacao, type ProdutoEvento, type QtdDiaProduto, type Receita, type VendaEvento,
} from '../lib/types'

const numero = lerNumero
const doNumero = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(Math.round(n * 1000) / 1000).replace('.', ','))
const diaCurto = (d: string) => `${diaSemana(d).slice(0, 3)} ${dataCurta(d)}`
const inteiro = (n: number) => Math.round(n).toLocaleString('pt-BR')

// Abas da página do evento (#/eventos/<id>/<aba>).
export const ABAS_EVENTO = [
  { id: '', nome: 'Resumo' },
  { id: 'previsao', nome: 'Cardápio e previsão' },
  { id: 'insumos', nome: 'Insumos a providenciar' },
  { id: 'vendas', nome: 'Vendas' },
  { id: 'separacao', nome: 'Separação' },
  { id: 'sobras', nome: 'Sobras do dia' },
  { id: 'equipe', nome: 'Equipe' },
  { id: 'freelas', nome: 'Freelas' },
]

export function AbasEvento({ id, aba, base = 'eventos', abas = ABAS_EVENTO }: { id: string; aba: string; base?: string; abas?: typeof ABAS_EVENTO }) {
  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-stone-200 px-1">
      {abas.map((a) => (
        <button
          key={a.id}
          onClick={() => ir(`${base}/${id}${a.id ? '/' + a.id : ''}`)}
          className={`shrink-0 border-b-2 px-3 py-2 text-sm font-semibold ${aba === a.id ? 'border-carvao text-carvao' : 'border-transparent text-stone-500 hover:text-carvao'}`}
        >
          {a.nome}
        </button>
      ))}
    </div>
  )
}

export interface DadosLogistica {
  itens: ItemContagem[]
  envios: EnvioEvento[]
  inventarios: Inventario[]
  // Só para a gestão (fichas, previsão e vendas).
  gestao: null | {
    cat: Catalogo
    receitas: Receita[]
    cardapio: ProdutoEvento[]
    previsao: QtdDiaProduto[]
    vendas: VendaEvento[] // de todos os eventos
    modelo: ItemModeloChecklist[]
    contagensBase: Inventario[]
    enviosTodos: EnvioEvento[]
    operacoes: Operacao[]
  }
}

export function useDadosLogistica(eventoId: string, gestao: boolean) {
  const { store } = useApp()
  const [d, setD] = useState<DadosLogistica | null>(null)
  const [erro, setErro] = useState('')
  const carregar = useCallback(async () => {
    try {
      const [itens, envios, inventarios] = await Promise.all([store.itensContagem(), store.envios(eventoId), store.inventarios({ eventoId })])
      let g: DadosLogistica['gestao'] = null
      if (gestao) {
        const [insumos, receitas, versoes, cardapio, previsao, vendas, modelo, contagensBase, enviosTodos, operacoes] = await Promise.all([
          store.insumos(), store.receitas(), store.versoesReceitas(), store.cardapioEvento(eventoId), store.previsaoEvento(eventoId),
          store.vendasEventos(), store.modeloChecklist(), store.inventarios({ local: 'base' }), store.envios(), store.operacoes(),
        ])
        g = { cat: montarCatalogo(insumos, receitas, versoes), receitas, cardapio, previsao, vendas, modelo, contagensBase, enviosTodos, operacoes }
      }
      setD({ itens, envios, inventarios, gestao: g })
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [store, eventoId, gestao])
  useEffect(() => {
    carregar()
  }, [carregar])
  return { d, erro, carregar }
}

// Itens fixos do checklist que este evento leva: os sem operação e os das operações do evento.
// Evento sem operação marcada leva todos (para não sumir nada).
export const itensFixosDoEvento = (modelo: ItemModeloChecklist[], e: Pick<Evento, 'operacoes'>) =>
  modelo.filter((m) => m.ativo && (!m.operacaoId || !e.operacoes.length || e.operacoes.includes(m.operacaoId)))

const infoItem = (itens: ItemContagem[], chave: ChaveItem | null) => (chave ? itens.find((i) => i.chave === chave) : undefined)
const nomeLinha = (itens: ItemContagem[], i: Pick<ItemEnvio, 'insumoId' | 'receitaId' | 'item'>) => infoItem(itens, chaveDe(i))?.nome ?? i.item ?? '—'
const embalagens = (it: ItemContagem | undefined, q: number) =>
  it?.embalagem && it.embalagemQtd ? ` ≈ ${qtd(Math.ceil((q / it.embalagemQtd) * 10) / 10)} ${it.embalagem}${q / it.embalagemQtd > 1 ? 's' : ''}` : ''

// ——— Cardápio e previsão ———

export function CardapioPrevisao({ e, eventos, d, aoMudar }: { e: Evento; eventos: Evento[]; d: DadosLogistica; aoMudar: () => Promise<void> }) {
  const { store, avisar } = useApp()
  const g = d.gestao!
  const dias = e.dias.map((x) => x.data)
  const [cardapio, setCardapio] = useState(g.cardapio)
  const [grade, setGrade] = useState<Record<string, string>>(() => Object.fromEntries(g.previsao.map((p) => [`${p.receitaId}|${p.data}`, doNumero(p.quantidade)])))
  const [mudou, setMudou] = useState(false)
  const [sugerindo, setSugerindo] = useState(false)
  const [refs, setRefs] = useState<string[]>(() => referenciasPadrao(e, eventos, g.vendas).map((x) => x.id))
  const [ajuste, setAjuste] = useState('100')
  const [base, setBase] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [novo, setNovo] = useState('')
  // Heitor (13/10): qualquer produto do cadastro (fichas dos eventos e das lojas) pode entrar no cardápio.
  const [buscaProduto, setBuscaProduto] = useState('')
  const produtos = g.receitas.filter((r) => r.tipo === 'produto' && r.ativo).sort((a, b) => a.nome.localeCompare(b.nome))
  const termosProduto = buscaProduto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/\s+/).filter(Boolean)
  const paraAdicionar = produtos.filter((p) => !cardapio.some((c) => c.receitaId === p.id)
    && termosProduto.every((t) => p.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(t)))
  const grupoProduto = (area: string) => paraAdicionar.filter((p) => (p.area ?? 'eventos') === area)
  const receita = (id: string) => g.receitas.find((r) => r.id === id)
  const q = (r: string, dia: string) => numero(grade[`${r}|${dia}`] ?? '') ?? 0
  const finalizados = eventos.filter((x) => x.id !== e.id && x.status === 'finalizado' && g.vendas.some((v) => v.eventoId === x.id))
  const posicao = useMemo(() => posicaoEventos(eventos, g.vendas), [eventos, g.vendas])

  const totalDia = (dia: string) => cardapio.reduce((s, c) => s + q(c.receitaId, dia), 0)
  const fatDia = (dia: string) => cardapio.reduce((s, c) => s + q(c.receitaId, dia) * (c.preco ?? 0), 0)
  const custoDia = (dia: string) => cardapio.reduce((s, c) => s + q(c.receitaId, dia) * (custoFicha(g.cat, c.receitaId)?.porUnidade ?? 0), 0)
  const fatTotal = dias.reduce((s, x) => s + fatDia(x), 0)
  const custoTotal = dias.reduce((s, x) => s + custoDia(x), 0)
  const faltaFicha = semFicha(g.cat, cardapio.map((c) => c.receitaId))

  const aplicarSugestao = () => {
    let card = cardapio
    // Sem cardápio: começa pelos produtos que mais venderam nos eventos de referência.
    if (!card.length) {
      const soma = new Map<string, number>()
      for (const v of g.vendas) if (refs.includes(v.eventoId) && v.receitaId) soma.set(v.receitaId, (soma.get(v.receitaId) ?? 0) + v.quantidade)
      card = [...soma.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([receitaId], i) => ({ receitaId, preco: receita(receitaId)?.precoVenda ?? null, ordem: i + 1 }))
      setCardapio(card)
    }
    const s = sugerirVendas(dias, card.map((c) => c.receitaId), refs, g.vendas, numero(ajuste) ?? 100)
    setGrade(Object.fromEntries(s.linhas.map((l) => [`${l.receitaId}|${l.data}`, String(l.quantidade)])))
    setBase(s.base)
    setMudou(true)
    setSugerindo(false)
  }

  const salvar = async () => {
    setSalvando(true)
    try {
      await store.salvarCardapioEvento(e.id, cardapio)
      await store.salvarPrevisaoEvento(e.id, cardapio.flatMap((c) => dias.map((dia) => ({ data: dia, receitaId: c.receitaId, quantidade: q(c.receitaId, dia) }))))
      await aoMudar()
      setMudou(false)
      avisar('Cardápio e previsão salvos')
    } catch (err) {
      avisar((err as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  if (!dias.length) return <Vazio>Cadastre os dias do evento (botão Editar, no Resumo) para montar a previsão por dia.</Vazio>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-stone-600">Previsão de vendas por dia. Ela calcula a separação de cada dia e fica separada das vendas reais.</p>
        <div className="flex gap-2 sm:ml-auto">
          <Botao variante="secundario" onClick={() => setSugerindo((x) => !x)}>Sugerir pelo histórico</Botao>
          <Botao disabled={!mudou || salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
        </div>
      </div>

      {sugerindo && (
        <Cartao>
          <h3 className="font-bold">Sugerir pelo histórico</h3>
          <p className="mt-1 text-sm text-stone-600">
            Média de vendas por dia de cada produto nos eventos marcados. Sexta, sábado e domingo usam a média do mesmo dia da semana.
            {e.gastronomia && ` Já marquei os mais recentes de gastronomia ${e.gastronomia}`}{e.gastronomia ? ', menos os que estão fora da média.' : ' Os que estão fora da média começam desmarcados.'}
            {' '}Desmarque o que for muito diferente do evento que vem.
          </p>
          <div className="mt-3 max-h-56 space-y-1 overflow-y-auto">
            {finalizados.length === 0 && <p className="text-sm text-stone-500">Nenhum evento finalizado com vendas.</p>}
            {[...finalizados].sort((a, b) => (b.dias[0]?.data ?? '').localeCompare(a.dias[0]?.data ?? '')).map((x) => (
              <label key={x.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={refs.includes(x.id)} onChange={(ev) => setRefs((r) => (ev.target.checked ? [...r, x.id] : r.filter((y) => y !== x.id)))} />
                <span>{x.nome}</span>
                <span className="text-xs text-stone-500">
                  {x.dias[0] && dataCurta(x.dias[0].data)}{x.gastronomia && ` · ${x.gastronomia}`}{x.barracas !== null && ` · ${doNumero(x.barracas)} barraca(s)`}
                  {posicao.get(x.id) && ` · ${reais(posicao.get(x.id)!.porDia, 0)} por dia`}
                </span>
                {x.foraDaMedia ? <span className="rounded-md bg-stone-100 px-1.5 text-xs font-semibold text-stone-600">fora da média</span>
                  : posicao.get(x.id)?.aviso && <span className="rounded-md bg-amber-50 px-1.5 text-xs font-semibold text-amber-800">{posicao.get(x.id)!.aviso === 'acima' ? 'muito acima' : 'muito abaixo'} do normal</span>}
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="block font-semibold">Ajuste (%)</span>
              <input className={`${estiloEntrada} w-28!`} inputMode="decimal" value={ajuste} onChange={(ev) => setAjuste(ev.target.value)} aria-label="Ajuste da sugestão em porcentagem" />
            </label>
            <p className="pb-2 text-xs text-stone-500">100 = igual à média. Use 120 para um evento 20% maior, por exemplo.</p>
            <Botao className="sm:ml-auto" disabled={!refs.length} onClick={aplicarSugestao}>Preencher a previsão</Botao>
          </div>
        </Cartao>
      )}

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs text-stone-500">
            <tr>
              <th className="px-3 py-2">Produto</th>
              <th className="px-2 py-2 text-right">Preço</th>
              <th className="px-2 py-2 text-right">Custo</th>
              {dias.map((x) => (
                <th key={x} className="px-2 py-2 text-right" title={base[x]}>
                  {diaCurto(x)}
                  {base[x] && <span className="block font-normal">{base[x]}</span>}
                </th>
              ))}
              <th className="px-2 py-2 text-right">Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cardapio.length === 0 && (
              <tr><td colSpan={dias.length + 5} className="px-3 py-4 text-stone-500">Cardápio vazio. Adicione produtos abaixo ou use “Sugerir pelo histórico”.</td></tr>
            )}
            {cardapio.map((c, i) => {
              const r = receita(c.receitaId)
              const custo = custoFicha(g.cat, c.receitaId)
              const m = custo && c.preco ? cmv(custo.porUnidade, c.preco) : null
              return (
                <tr key={c.receitaId} className="border-t border-stone-100">
                  <td className="px-3 py-1.5">
                    <button className="text-left font-semibold hover:underline" onClick={() => ir('eventos/fichas/' + c.receitaId)}>{r?.nome ?? '—'}</button>
                    {!custo && <span className="block text-xs text-amber-700">sem ficha técnica</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <CampoNumero
                      className="w-20 rounded-lg border border-stone-200 px-2 py-1 text-right"
                      aria-label={`Preço de ${r?.nome}`}
                      valor={c.preco}
                      aoMudar={(n) => {
                        setCardapio((cs) => cs.map((x, j) => (j === i ? { ...x, preco: n } : x)))
                        setMudou(true)
                      }}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap text-stone-600">
                    {custo ? reais(custo.porUnidade) : '—'}
                    {m !== null && <span className={`block text-xs ${m > 35 ? 'text-red-600' : 'text-stone-400'}`}>CMV {m.toFixed(0)}%</span>}
                  </td>
                  {dias.map((x) => (
                    <td key={x} className="px-2 py-1.5 text-right">
                      <input
                        className="w-20 rounded-lg border border-stone-200 px-2 py-1 text-right"
                        inputMode="numeric"
                        aria-label={`Previsão de ${r?.nome} em ${dataCurta(x)}`}
                        value={grade[`${c.receitaId}|${x}`] ?? ''}
                        onChange={(ev) => {
                          setGrade((gr) => ({ ...gr, [`${c.receitaId}|${x}`]: ev.target.value }))
                          setMudou(true)
                        }}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right font-semibold">{inteiro(dias.reduce((s, x) => s + q(c.receitaId, x), 0))}</td>
                  <td className="px-2">
                    <button
                      className="text-stone-400 hover:text-red-600"
                      aria-label={`Tirar ${r?.nome} do cardápio`}
                      onClick={() => {
                        setCardapio((cs) => cs.filter((_, j) => j !== i))
                        setMudou(true)
                      }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {cardapio.length > 0 && (
            <tfoot className="border-t border-stone-200 bg-stone-50 text-xs">
              <tr>
                <td className="px-3 py-1.5 font-semibold" colSpan={3}>Itens</td>
                {dias.map((x) => <td key={x} className="px-2 py-1.5 text-right font-semibold">{inteiro(totalDia(x))}</td>)}
                <td className="px-2 py-1.5 text-right font-semibold">{inteiro(dias.reduce((s, x) => s + totalDia(x), 0))}</td>
                <td />
              </tr>
              <tr>
                <td className="px-3 py-1.5 font-semibold" colSpan={3}>Faturamento previsto</td>
                {dias.map((x) => <td key={x} className="px-2 py-1.5 text-right">{reais(fatDia(x), 0)}</td>)}
                <td className="px-2 py-1.5 text-right font-semibold">{reais(fatTotal, 0)}</td>
                <td />
              </tr>
              <tr>
                <td className="px-3 py-1.5 font-semibold" colSpan={3}>Custo dos produtos (CMV)</td>
                {dias.map((x) => <td key={x} className="px-2 py-1.5 text-right">{reais(custoDia(x), 0)}</td>)}
                <td className="px-2 py-1.5 text-right font-semibold">{reais(custoTotal, 0)}{fatTotal > 0 && ` · ${((custoTotal / fatTotal) * 100).toFixed(0)}%`}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input className={`${estiloEntrada} sm:w-56!`} placeholder="Buscar produto" value={buscaProduto} aria-label="Buscar produto para o cardápio"
          onChange={(ev) => { setBuscaProduto(ev.target.value); setNovo('') }} />
        <select className={`${estiloEntrada} sm:w-80!`} value={novo} onChange={(ev) => setNovo(ev.target.value)} aria-label="Produto para adicionar ao cardápio">
          <option value="">{paraAdicionar.length ? `Adicionar produto ao cardápio (${paraAdicionar.length})…` : 'Nenhum produto com esse nome'}</option>
          {[['eventos', 'Fichas dos eventos'], ['lojas', 'Fichas das lojas']].map(([area, nome]) => grupoProduto(area).length > 0 && (
            <optgroup key={area} label={nome}>
              {grupoProduto(area).map((p) => <option key={p.id} value={p.id}>{p.nome}{p.linha ? ` (${p.linha})` : ''}</option>)}
            </optgroup>
          ))}
        </select>
        <Botao
          variante="secundario"
          disabled={!novo}
          onClick={() => {
            setCardapio((cs) => [...cs, { receitaId: novo, preco: receita(novo)?.precoVenda ?? null, ordem: cs.length + 1 }])
            setNovo('')
            setBuscaProduto('')
            setMudou(true)
          }}
        >
          Adicionar
        </Botao>
      </div>
      {faltaFicha.length > 0 && (
        <p className="text-sm text-amber-800">
          {faltaFicha.length === 1 ? '1 produto não tem' : `${faltaFicha.length} produtos não têm`} ficha técnica: o custo e a separação não contam {faltaFicha.length === 1 ? 'ele' : 'eles'}.
        </p>
      )}
      {mudou && <p className="text-sm font-semibold text-amber-700">Alterações não salvas.</p>}
      {cardapio.length > 0 && (
        <button className="text-sm font-semibold text-sky-700 hover:underline" onClick={() => ir(`eventos/${e.id}/insumos`)}>
          Ver os insumos a providenciar{mudou ? ' (salve a previsão antes)' : ''} →
        </button>
      )}
    </div>
  )
}

// ——— Insumos a providenciar (aba própria, Heitor 13/10): usa a previsão salva ———

export function InsumosDoEvento({ e, d, aoMudar }: { e: Evento; d: DadosLogistica; aoMudar: () => Promise<void> }) {
  const g = d.gestao!
  const saldoBase = useMemo(() => estoqueBase(g.contagensBase, g.enviosTodos), [g.contagensBase, g.enviosTodos])
  const linhas = useMemo(() => g.cardapio.map((c) => ({
    receitaId: c.receitaId, quantidade: g.previsao.filter((p) => p.receitaId === c.receitaId).reduce((s, p) => s + p.quantidade, 0),
  })), [g.cardapio, g.previsao])
  if (!linhas.some((l) => l.quantidade > 0)) {
    return (
      <Vazio>
        Ainda não tem previsão de vendas salva.{' '}
        <button className="font-semibold underline" onClick={() => ir(`eventos/${e.id}/previsao`)}>Fazer em Cardápio e previsão</button>
      </Vazio>
    )
  }
  return <InsumosEvento cat={g.cat} eventoId={e.id} nomeEvento={e.nome} saldoBase={saldoBase} linhas={linhas} aoMudar={aoMudar} />
}

// ——— Vendas reais ———

export function VendasEvento({ e, d, aoMudar }: { e: Evento; d: DadosLogistica; aoMudar: () => Promise<void> }) {
  const { store, avisar } = useApp()
  const g = d.gestao!
  const vendas = g.vendas.filter((v) => v.eventoId === e.id)
  const dias = [...new Set([...e.dias.map((x) => x.data), ...vendas.map((v) => v.data)])].sort()
  const [editando, setEditando] = useState(false)
  const [grade, setGrade] = useState<Record<string, string>>({})
  const preco = (receitaId: string) => g.cardapio.find((c) => c.receitaId === receitaId)?.preco ?? g.receitas.find((r) => r.id === receitaId)?.precoVenda ?? null
  const produtos = [...new Set([...g.cardapio.map((c) => c.receitaId), ...vendas.map((v) => v.receitaId).filter(Boolean)])] as string[]
  const nome = (id: string) => g.receitas.find((r) => r.id === id)?.nome ?? vendas.find((v) => v.receitaId === id)?.produto ?? '—'
  const vq = (r: string, dia: string) => vendas.filter((v) => v.receitaId === r && v.data === dia).reduce((s, v) => s + v.quantidade, 0)
  const vt = (r: string, dia: string) => vendas.filter((v) => v.receitaId === r && v.data === dia).reduce((s, v) => s + (v.total ?? 0), 0)
  const pq = (r: string, dia: string) => g.previsao.find((p) => p.receitaId === r && p.data === dia)?.quantidade ?? null
  const temPrevisao = g.previsao.length > 0
  const total = vendas.reduce((s, v) => s + (v.total ?? 0), 0)
  const itens = vendas.reduce((s, v) => s + v.quantidade, 0)
  const ordenados = [...produtos].sort((a, b) => dias.reduce((s, x) => s + vq(b, x), 0) - dias.reduce((s, x) => s + vq(a, x), 0))

  const abrirEdicao = () => {
    setGrade(Object.fromEntries(produtos.flatMap((r) => dias.map((x) => [`${r}|${x}`, vq(r, x) ? String(vq(r, x)) : '']))))
    setEditando(true)
  }
  const salvar = async () => {
    try {
      await store.salvarVendasEvento(e.id, produtos.flatMap((r) => dias.map((x) => {
        const quantidade = numero(grade[`${r}|${x}`] ?? '') ?? 0
        // Mantém o total importado quando a quantidade não mudou; senão quantidade × preço do cardápio.
        const total = quantidade === vq(r, x) ? vt(r, x) : quantidade * (preco(r) ?? 0)
        return { data: x, receitaId: r, quantidade, total }
      })))
      await aoMudar()
      setEditando(false)
      avisar('Vendas salvas')
    } catch (err) {
      avisar((err as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Faturamento', reais(total, 0)],
          ['Itens vendidos', inteiro(itens)],
          ['Preço médio por item', itens ? reais(total / itens) : '—'],
          ['Por dia', dias.length ? reais(total / dias.length, 0) : '—'],
        ].map(([t, v]) => (
          <Cartao key={t}>
            <div className="text-xs text-stone-500">{t}</div>
            <div className="text-xl font-bold">{v}</div>
          </Cartao>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-stone-600">
          Vendas reais por dia{vendas.some((v) => v.origem === 'dpen') ? ', importadas do DPEN' : ''}.{temPrevisao && ' Entre parênteses, a diferença para a previsão.'}
        </p>
        <div className="flex gap-2 sm:ml-auto">
          {editando ? (
            <>
              <Botao variante="secundario" onClick={() => setEditando(false)}>Cancelar</Botao>
              <Botao onClick={salvar}>Salvar vendas</Botao>
            </>
          ) : (
            <Botao variante="secundario" disabled={!produtos.length} onClick={abrirEdicao}>Lançar vendas</Botao>
          )}
        </div>
      </div>
      {!produtos.length ? (
        <Vazio>Sem vendas nem cardápio. Monte o cardápio na aba Cardápio e previsão para lançar as vendas.</Vazio>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs text-stone-500">
              <tr>
                <th className="px-3 py-2">Produto</th>
                {dias.map((x) => <th key={x} className="px-2 py-2 text-right">{diaCurto(x)}</th>)}
                <th className="px-2 py-2 text-right">Total</th>
                <th className="px-2 py-2 text-right">Receita</th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map((r) => {
                const tq = dias.reduce((s, x) => s + vq(r, x), 0)
                return (
                  <tr key={r} className="border-t border-stone-100">
                    <td className="px-3 py-1.5 font-semibold">{nome(r)}</td>
                    {dias.map((x) => {
                      const p = pq(r, x)
                      const v = vq(r, x)
                      return (
                        <td key={x} className="px-2 py-1.5 text-right whitespace-nowrap">
                          {editando ? (
                            <input
                              className="w-20 rounded-lg border border-stone-200 px-2 py-1 text-right"
                              inputMode="numeric"
                              aria-label={`Vendas de ${nome(r)} em ${dataCurta(x)}`}
                              value={grade[`${r}|${x}`] ?? ''}
                              onChange={(ev) => setGrade((gr) => ({ ...gr, [`${r}|${x}`]: ev.target.value }))}
                            />
                          ) : (
                            <>
                              {v ? inteiro(v) : '—'}
                              {p !== null && p > 0 && (v > 0 || x < hoje()) && (
                                <span className={`ml-1 text-xs ${v >= p ? 'text-green-700' : 'text-amber-700'}`}>({v >= p ? '+' : ''}{Math.round(((v - p) / p) * 100)}%)</span>
                              )}
                            </>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-2 py-1.5 text-right font-semibold">{inteiro(tq)}</td>
                    <td className="px-2 py-1.5 text-right text-stone-600">{reais(dias.reduce((s, x) => s + vt(r, x), 0), 0)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t border-stone-200 bg-stone-50 text-xs font-semibold">
              <tr>
                <td className="px-3 py-1.5">Faturamento</td>
                {dias.map((x) => <td key={x} className="px-2 py-1.5 text-right">{reais(vendas.filter((v) => v.data === x).reduce((s, v) => s + (v.total ?? 0), 0), 0)}</td>)}
                <td />
                <td className="px-2 py-1.5 text-right">{reais(total, 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ——— Separação (checklist de saída e retorno) ———

const ehConsumivel = (i: Pick<ItemEnvio, 'insumoId' | 'receitaId'>) => !!(i.insumoId || i.receitaId)

export function Separacao({ e, d, aoMudar }: { e: Evento; d: DadosLogistica; aoMudar: () => Promise<void> }) {
  const { store, avisar } = useApp()
  const g = d.gestao
  const [montando, setMontando] = useState<string | null>(null)
  const [aberto, setAberto] = useState<string | null>(d.envios.find((x) => x.itens.some((i) => !i.conferido))?.id ?? d.envios[d.envios.length - 1]?.id ?? null)
  const diaN = (dia: string) => e.dias.findIndex((x) => x.data === dia) + 1
  const proximoDia = e.dias.map((x) => x.data).find((x) => !d.envios.some((v) => v.data === x)) ?? e.dias[0]?.data ?? hoje()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-stone-600">Cada carga que sai da base para um dia do evento é um checklist: confere na saída e, para equipamentos e utensílios, no retorno.</p>
        {g && !montando && <Botao className="sm:ml-auto" onClick={() => setMontando(proximoDia)}>+ Montar separação</Botao>}
      </div>

      {montando && g && (
        <MontarSeparacao
          e={e}
          d={d}
          diaInicial={montando}
          aoFechar={() => setMontando(null)}
          aoCriar={async (id) => {
            setMontando(null)
            await aoMudar()
            setAberto(id)
            avisar('Separação criada')
          }}
        />
      )}

      {d.envios.length === 0 && !montando && (
        <Vazio>{g ? 'Nenhuma separação ainda. Monte a do primeiro dia: o portal sugere as quantidades pela previsão de vendas e põe os itens fixos (equipamentos, utensílios…).' : 'A gestão ainda não montou a separação deste evento.'}</Vazio>
      )}

      {d.envios.map((v) => {
        const saida = v.itens.filter((i) => i.conferido).length
        const voltam = v.itens.filter((i) => !ehConsumivel(i))
        const voltou = voltam.filter((i) => i.retornou).length
        return (
          <Cartao key={v.id}>
            <button className="flex w-full flex-wrap items-center gap-2 text-left" onClick={() => setAberto((a) => (a === v.id ? null : v.id))}>
              <span className="font-bold">
                {v.tipo === 'separacao' ? 'Separação' : 'Reposição'} para {diaCurto(v.data)}
                {diaN(v.data) > 0 && <span className="font-normal text-stone-500"> · dia {diaN(v.data)}</span>}
              </span>
              <Selo cor={saida === v.itens.length ? 'verde' : 'ambar'}>Saída {saida}/{v.itens.length}</Selo>
              {voltam.length > 0 && <Selo cor={voltou === voltam.length ? 'verde' : 'cinza'}>Retorno {voltou}/{voltam.length}</Selo>}
              <span className="ml-auto text-stone-400">{aberto === v.id ? '▲' : '▼'}</span>
            </button>
            {v.observacao && <p className="mt-1 text-sm text-stone-600">{v.observacao}</p>}
            {aberto === v.id && <ChecklistEnvio v={v} d={d} aoMudar={aoMudar} />}
            {aberto === v.id && g && (
              <div className="mt-3 flex justify-end">
                <Botao
                  variante="perigo"
                  onClick={async () => {
                    if (!confirm('Excluir esta separação? As conferências dela também somem.')) return
                    await store.excluirEnvio(v.id)
                    await aoMudar()
                  }}
                >
                  Excluir separação
                </Botao>
              </div>
            )}
          </Cartao>
        )
      })}
    </div>
  )
}

function ChecklistEnvio({ v, d, aoMudar }: { v: EnvioEvento; d: DadosLogistica; aoMudar: () => Promise<void> }) {
  const { store, avisar, nomeDe } = useApp()
  const [qtds, setQtds] = useState<Record<string, string>>({})
  const [ocupado, setOcupado] = useState<string | null>(null)
  const saldo = useMemo(() => (d.gestao ? estoqueBase(d.gestao.contagensBase, d.gestao.enviosTodos) : null), [d.gestao])
  const categorias = [...new Set(v.itens.map((i) => i.categoria ?? 'Outros'))]

  const conferir = async (i: ItemEnvio, etapa: 'saida' | 'retorno', feito: boolean) => {
    setOcupado(i.id + etapa)
    try {
      const q = qtds[i.id] !== undefined ? numero(qtds[i.id]) : i.quantidade ?? i.previsto
      await store.conferirItemEnvio(i.id, etapa, etapa === 'saida' ? q : i.quantidade, feito)
      await aoMudar()
    } catch (err) {
      avisar((err as Error).message)
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div className="mt-3 space-y-3">
      {categorias.map((c) => (
        <div key={c}>
          <h4 className="mb-1 text-xs font-bold tracking-wide text-stone-500 uppercase">{c}</h4>
          <ul className="divide-y divide-stone-100 rounded-xl ring-1 ring-stone-200">
            {v.itens.filter((i) => (i.categoria ?? 'Outros') === c).map((i) => {
              const info = infoItem(d.itens, chaveDe(i))
              const consumivel = ehConsumivel(i)
              const base = saldo && chaveDe(i) ? saldo.get(chaveDe(i)!) : undefined
              return (
                <li key={i.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 ${i.conferido ? 'bg-green-50/60' : ''}`}>
                  <label className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-0">
                    <input type="checkbox" className="h-5 w-5" checked={i.conferido} disabled={ocupado !== null} onChange={(ev) => conferir(i, 'saida', ev.target.checked)} aria-label={`Saída de ${nomeLinha(d.itens, i)}`} />
                    <span className="min-w-0">
                      <span className="font-semibold">{nomeLinha(d.itens, i)}</span>
                      {i.operacao && <span className="ml-1.5 rounded bg-stone-100 px-1.5 text-xs text-stone-600">{i.operacao}</span>}
                      {i.conferido && i.conferidoPor && <span className="block text-xs text-stone-500">Saída: {nomeDe(i.conferidoPor)} · {i.conferidoEm && tempoDesde(i.conferidoEm)}</span>}
                    </span>
                  </label>
                  {consumivel ? (
                    <span className="ml-7 flex items-center gap-1.5 text-sm sm:ml-0">
                      {i.previsto !== null && !i.conferido && <span className="text-xs text-stone-500">sugerido {qtd(i.previsto)}</span>}
                      <input
                        className="w-20 rounded-lg border border-stone-200 px-2 py-1 text-right disabled:bg-transparent disabled:border-transparent"
                        inputMode="decimal"
                        disabled={i.conferido}
                        aria-label={`Quantidade separada de ${nomeLinha(d.itens, i)}`}
                        value={qtds[i.id] ?? doNumero(i.quantidade ?? i.previsto)}
                        onChange={(ev) => setQtds((q) => ({ ...q, [i.id]: ev.target.value }))}
                      />
                      <span className="w-8 text-stone-500">{nomeUnidade(info?.unidade ?? i.unidade ?? '')}</span>
                      {info && <span className="hidden text-xs text-stone-400 sm:inline">{embalagens(info, i.quantidade ?? i.previsto ?? 0)}</span>}
                      {base && !i.conferido && (i.quantidade ?? i.previsto ?? 0) > base.saldo && <span className="text-xs font-semibold text-red-600">base tem {qtd(Math.max(0, base.saldo))}</span>}
                    </span>
                  ) : (
                    <span className="flex items-center gap-3 text-sm">
                      <span className="text-stone-600">{i.quantidadeTexto ?? (i.quantidade !== null ? qtd(i.quantidade) : '')}</span>
                      <label className="flex items-center gap-1.5 text-xs text-stone-600">
                        <input type="checkbox" checked={i.retornou} disabled={ocupado !== null || !i.conferido} onChange={(ev) => conferir(i, 'retorno', ev.target.checked)} aria-label={`Retorno de ${nomeLinha(d.itens, i)}`} />
                        voltou
                      </label>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

interface LinhaMontagem extends NovoItemEnvio {
  k: string
  usar: boolean
  nota?: string
}

function MontarSeparacao({ e, d, diaInicial, aoFechar, aoCriar }: { e: Evento; d: DadosLogistica; diaInicial: string; aoFechar: () => void; aoCriar: (id: string) => Promise<void> }) {
  const { store, avisar } = useApp()
  const g = d.gestao!
  const [dia, setDia] = useState(diaInicial)
  const primeira = !d.envios.some((v) => v.tipo === 'separacao')
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [novoItem, setNovoItem] = useState('')
  const saldo = useMemo(() => estoqueBase(g.contagensBase, g.enviosTodos), [g])
  const consumo = useMemo(
    () => consumoEvento(g.cat, e.dias.map((x) => x.data), d.envios, d.inventarios, g.vendas.filter((v) => v.eventoId === e.id) as QtdDiaProduto[], g.previsao),
    [g, e, d.envios, d.inventarios],
  )
  const sugestao = (data: string): LinhaMontagem[] => {
    const arred = (k: ChaveItem, q: number) => arredondarPara(infoItem(d.itens, k)?.unidade ?? 'kg', q)
    const levar = quantoLevar(g.cat, e, data, g.previsao, consumo, d.envios, d.inventarios, arred)
    const linhas: LinhaMontagem[] = levar
      .filter((l) => l.levar > 0)
      .sort((a, b) => (infoItem(d.itens, a.chave)?.nome ?? '').localeCompare(infoItem(d.itens, b.chave)?.nome ?? ''))
      .map((l) => {
        const info = infoItem(d.itens, l.chave)
        const k = daChave(l.chave)
        return {
          k: l.chave, usar: true, categoria: l.chave.startsWith('r:') ? 'Pré-preparos' : 'Insumos', operacao: null, ...k, item: null,
          previsto: l.levar, quantidade: l.levar, quantidadeTexto: null, unidade: info?.unidade ?? null, nota: notaLevar(l),
        }
      })
    // Itens fixos: só os das operações que vão para este evento (e os que valem para todas).
    if (primeira)
      for (const m of itensFixosDoEvento(g.modelo, e))
        linhas.push({ k: 'm:' + m.id, usar: true, categoria: m.categoria, operacao: g.operacoes.find((o) => o.id === m.operacaoId)?.nome ?? m.operacao, insumoId: null, receitaId: null, item: m.item, previsto: null, quantidade: null, quantidadeTexto: m.quantidade, unidade: null })
    return linhas
  }
  const [linhas, setLinhas] = useState<LinhaMontagem[]>(() => sugestao(diaInicial))
  const semPrevisao = !g.previsao.some((p) => p.data === dia)
  const mudar = (k: string, m: Partial<LinhaMontagem>) => setLinhas((ls) => ls.map((l) => (l.k === k ? { ...l, ...m } : l)))

  const criar = async () => {
    setSalvando(true)
    try {
      const usadas = linhas.filter((l) => l.usar)
      const id = await store.criarEnvio(e.id, dia, primeira ? 'separacao' : 'reposicao', obs, usadas.map(({ k: _k, usar: _u, nota: _n, ...x }) => x))
      await aoCriar(id)
    } catch (err) {
      avisar((err as Error).message)
      setSalvando(false)
    }
  }

  const grupos = [...new Set(linhas.map((l) => l.categoria ?? 'Outros'))]
  return (
    <Cartao>
      <div className="flex flex-wrap items-end gap-2">
        <h3 className="font-bold">{primeira ? 'Montar a separação' : 'Montar reposição'}</h3>
        <label className="text-sm sm:ml-auto">
          <span className="mr-2 font-semibold">Para o dia</span>
          <select
            className="rounded-lg border border-stone-200 px-2 py-1.5"
            value={dia}
            onChange={(ev) => {
              setDia(ev.target.value)
              setLinhas(sugestao(ev.target.value))
            }}
          >
            {e.dias.map((x, i) => <option key={x.data} value={x.data}>Dia {i + 1}: {diaCurto(x.data)}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-1 text-sm text-stone-600">
        Quantidade = previsão de vendas do dia × fichas técnicas{consumo.some((c) => c.ajuste) ? ' × ajuste pelo consumo real dos dias anteriores' : ''} + {e.margemSegurancaPct}% de folga − o que já está no evento. Pré-preparos vão prontos da base.
        {primeira && ' Os itens fixos (equipamentos, utensílios…) entram só na primeira separação.'}
      </p>
      {semPrevisao && <p className="mt-2 text-sm font-semibold text-amber-700">Sem previsão de vendas para este dia: só os itens fixos entram. Preencha a previsão em Cardápio e previsão.</p>}

      <div className="mt-3 space-y-3">
        {grupos.map((c) => (
          <div key={c}>
            <h4 className="mb-1 text-xs font-bold tracking-wide text-stone-500 uppercase">{c}</h4>
            <ul className="divide-y divide-stone-100 rounded-xl ring-1 ring-stone-200">
              {linhas.filter((l) => (l.categoria ?? 'Outros') === c).map((l) => {
                const info = infoItem(d.itens, chaveDe(l))
                const base = chaveDe(l) ? saldo.get(chaveDe(l)!) : undefined
                return (
                  <li key={l.k} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-sm ${l.usar ? '' : 'opacity-50'}`}>
                    <label className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-0">
                      <input type="checkbox" checked={l.usar} onChange={(ev) => mudar(l.k, { usar: ev.target.checked })} aria-label={`Levar ${info?.nome ?? l.item}`} />
                      <span>
                        <span className="font-semibold">{info?.nome ?? l.item}</span>
                        {l.operacao && <span className="ml-1.5 rounded bg-stone-100 px-1.5 text-xs text-stone-600">{l.operacao}</span>}
                        {l.nota && <span className="block text-xs text-stone-500">{l.nota}</span>}
                      </span>
                    </label>
                    {chaveDe(l) ? (
                      <span className="ml-7 flex items-center gap-1.5 sm:ml-0">
                        <CampoNumero
                          className="w-20 rounded-lg border border-stone-200 px-2 py-1 text-right"
                          aria-label={`Quantidade de ${info?.nome}`}
                          valor={l.quantidade}
                          aoMudar={(n) => mudar(l.k, { quantidade: n })}
                        />
                        <span className="w-8 text-stone-500">{nomeUnidade(info?.unidade ?? '')}</span>
                        <span className="hidden w-28 text-xs text-stone-400 sm:inline">{embalagens(info, l.quantidade ?? 0)}</span>
                        <span className={`text-right text-xs sm:w-24 ${base && base.saldo < (l.quantidade ?? 0) ? 'font-semibold text-red-600' : 'text-stone-400'}`}>
                          {base ? `base: ${qtd(Math.max(0, base.saldo))}` : 'base: sem contagem'}
                        </span>
                      </span>
                    ) : (
                      <input
                        className="w-32 rounded-lg border border-stone-200 px-2 py-1"
                        aria-label={`Quantidade de ${l.item}`}
                        value={l.quantidadeTexto ?? ''}
                        onChange={(ev) => mudar(l.k, { quantidadeTexto: ev.target.value })}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <select className={`${estiloEntrada} sm:w-72!`} value={novoItem} onChange={(ev) => setNovoItem(ev.target.value)} aria-label="Item para acrescentar">
          <option value="">Acrescentar insumo ou pré-preparo…</option>
          {d.itens.filter((i) => !linhas.some((l) => chaveDe(l) === i.chave)).map((i) => <option key={i.chave} value={i.chave}>{i.nome}</option>)}
        </select>
        <Botao
          variante="secundario"
          disabled={!novoItem}
          onClick={() => {
            const info = infoItem(d.itens, novoItem)
            setLinhas((ls) => [...ls, {
              k: novoItem, usar: true, categoria: novoItem.startsWith('r:') ? 'Pré-preparos' : 'Insumos', operacao: null, ...daChave(novoItem), item: null,
              previsto: null, quantidade: null, quantidadeTexto: null, unidade: info?.unidade ?? null,
            }])
            setNovoItem('')
          }}
        >
          Acrescentar
        </Botao>
        <Botao
          variante="fantasma"
          onClick={() => {
            const nome = prompt('Nome do item (equipamento, utensílio…)')
            if (nome?.trim())
              setLinhas((ls) => [...ls, { k: 'x:' + Date.now(), usar: true, categoria: 'Outros', operacao: null, insumoId: null, receitaId: null, item: nome.trim(), previsto: null, quantidade: null, quantidadeTexto: '', unidade: null }])
          }}
        >
          + Item avulso
        </Botao>
      </div>
      <textarea className={`${estiloEntrada} mt-3`} rows={2} placeholder="Observação (opcional)" value={obs} onChange={(ev) => setObs(ev.target.value)} aria-label="Observação da separação" />
      <div className="mt-3 flex justify-end gap-2">
        <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
        <Botao disabled={salvando || !linhas.some((l) => l.usar)} onClick={criar}>{salvando ? 'Criando…' : `Criar checklist (${linhas.filter((l) => l.usar).length} itens)`}</Botao>
      </div>
    </Cartao>
  )
}

const notaLevar = (l: LinhaLevar) => {
  const p: string[] = [`previsto ${qtd(Math.round(l.previsto * 100) / 100)}`]
  if (l.ajuste !== null && Math.abs(l.ajuste - 1) >= 0.03) p.push(`consumo real ${l.ajuste > 1 ? '+' : ''}${Math.round((l.ajuste - 1) * 100)}%`)
  if (l.sobra > 0) p.push(`já tem ${qtd(l.sobra)} no evento`)
  if (l.jaEnviado > 0) p.push(`já separado ${qtd(l.jaEnviado)}`)
  return p.join(' · ')
}

// ——— Sobras do dia (inventário no evento) ———

export function Sobras({ e, d, aoMudar }: { e: Evento; d: DadosLogistica; aoMudar: () => Promise<void> }) {
  const { store, avisar, nomeDe } = useApp()
  const g = d.gestao
  const dias = e.dias.map((x) => x.data)
  const [contando, setContando] = useState<string | null>(null)
  const contagem = (dia: string) => d.inventarios.find((i) => i.data === dia)
  const consumo = useMemo(
    () => (g ? consumoEvento(g.cat, dias, d.envios, d.inventarios, g.vendas.filter((v) => v.eventoId === e.id), g.previsao) : []),
    [g, dias.join(), d.envios, d.inventarios, e.id], // eslint-disable-line react-hooks/exhaustive-deps
  )
  // Itens que foram para o evento aparecem primeiro na contagem.
  const enviados = [...new Set(d.envios.flatMap((v) => v.itens.map(chaveDe).filter(Boolean)))] as ChaveItem[]
  const ultimoContado = [...dias].reverse().find((x) => contagem(x))
  const proximo = dias.find((x) => x > (ultimoContado ?? '')) ?? null

  if (contando)
    return (
      <Contagem
        titulo={`Sobra do fim do dia ${dias.indexOf(contando) + 1} (${diaCurto(contando)})`}
        itens={d.itens}
        primeiro={enviados}
        inicial={contagem(contando)}
        aoCancelar={() => setContando(null)}
        aoSalvar={async (itens, fala, obs) => {
          await store.salvarInventario('evento', e.id, contando, itens, fala, obs)
          await aoMudar()
          setContando(null)
          avisar('Contagem salva')
        }}
      />
    )

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600">
        No fim de cada dia, conte o que sobrou de cada insumo e pré-preparo (pode falar em vez de digitar). Com a contagem o portal calcula o consumo real e quanto levar no dia seguinte.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {dias.map((x, i) => {
          const c = contagem(x)
          return (
            <Cartao key={x}>
              <div className="text-xs text-stone-500">Dia {i + 1}</div>
              <div className="font-bold">{diaCurto(x)}</div>
              {c ? (
                <p className="mt-1 text-sm text-stone-600">Contado por {nomeDe(c.contadoPor)} · {tempoDesde(c.contadoEm)} · {c.itens.length} itens</p>
              ) : (
                <p className="mt-1 text-sm text-stone-500">Sem contagem.</p>
              )}
              <Botao variante={c ? 'secundario' : 'primario'} className="mt-2 w-full" onClick={() => setContando(x)}>{c ? 'Contar de novo' : 'Contar sobra'}</Botao>
            </Cartao>
          )
        })}
      </div>

      {g && consumo.length > 0 && (
        <Cartao>
          <h3 className="font-bold">Consumo por dia</h3>
          <p className="mt-1 text-sm text-stone-600">Real = sobra da véspera + o que chegou − sobra contada. Teórico = vendas do dia × fichas (sem vendas lançadas, usa a previsão).</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-stone-500">
                <tr>
                  <th className="py-1 pr-2">Item</th>
                  {dias.map((x) => <th key={x} className="px-2 py-1 text-right">{diaCurto(x)}<span className="block font-normal">chegou · sobrou · real / teórico</span></th>)}
                  <th className="px-2 py-1 text-right">Real ÷ teórico</th>
                </tr>
              </thead>
              <tbody>
                {consumo.sort((a, b) => (infoItem(d.itens, a.chave)?.nome ?? '').localeCompare(infoItem(d.itens, b.chave)?.nome ?? '')).map((c) => {
                  const info = infoItem(d.itens, c.chave)
                  return (
                    <tr key={c.chave} className="border-t border-stone-100">
                      <td className="py-1 pr-2 font-semibold">{info?.nome ?? '—'} <span className="font-normal text-stone-400">{nomeUnidade(info?.unidade ?? '')}</span></td>
                      {dias.map((x) => {
                        const p = c.porDia[x]
                        return (
                          <td key={x} className="px-2 py-1 text-right whitespace-nowrap text-stone-600">
                            {qtd(Math.round(p.entrou * 100) / 100)} · {p.sobrou === null ? '?' : qtd(p.sobrou)} · <b className="text-carvao">{p.real === null ? '?' : qtd(Math.round(p.real * 100) / 100)}</b>
                            {' / '}{p.teorico === null ? '—' : qtd(Math.round(p.teorico * 100) / 100)}
                          </td>
                        )
                      })}
                      <td className={`px-2 py-1 text-right font-semibold ${c.ajuste && c.ajuste > 1.1 ? 'text-red-600' : ''}`}>{c.ajuste ? `${Math.round(c.ajuste * 100)}%` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-stone-500">Acima de 100% = gastou mais do que a ficha prevê (perda, porção maior, ficha desatualizada). Esse ajuste entra na sugestão do dia seguinte (limitado entre 80% e 150%).</p>
        </Cartao>
      )}

      {g && proximo && ultimoContado && (
        <Cartao className="ring-ozzy-400">
          <h3 className="font-bold">Para {diaCurto(proximo)}</h3>
          <p className="mt-1 text-sm text-stone-600">
            Com a sobra de {diaCurto(ultimoContado)} contada, monte a reposição: o portal desconta o que já está no evento.
          </p>
          <Botao className="mt-2" onClick={() => ir(`eventos/${e.id}/separacao`)}>Ir para a Separação</Botao>
        </Cartao>
      )}
    </div>
  )
}

// ——— Contagem (sobras no evento ou estoque da base), digitando ou falando ———

export function Contagem({
  titulo, itens, primeiro, inicial, aoSalvar, aoCancelar,
}: {
  titulo: string
  itens: ItemContagem[]
  primeiro: ChaveItem[]
  inicial?: Inventario
  aoSalvar: (itens: { chave: ChaveItem; quantidade: number }[], fala: string, observacao: string) => Promise<void>
  aoCancelar: () => void
}) {
  const { avisar } = useApp()
  const [valores, setValores] = useState<Record<string, string>>(() => Object.fromEntries((inicial?.itens ?? []).map((i) => [i.chave, doNumero(i.quantidade)])))
  const [lista, setLista] = useState<ChaveItem[]>(() => [...new Set([...primeiro, ...(inicial?.itens.map((i) => i.chave) ?? [])])])
  const [fala, setFala] = useState(inicial?.fala ?? '')
  const [parcial, setParcial] = useState('')
  const [ouvindo, setOuvindo] = useState(false)
  const [naoEntendi, setNaoEntendi] = useState<string[]>([])
  const [destaque, setDestaque] = useState<Set<string>>(new Set())
  const [obs, setObs] = useState(inicial?.observacao ?? '')
  const [busca, setBusca] = useState('')
  // Heitor (13/10): quem não quiser falar preenche item por item; sem nada enviado, já abre com todos.
  const [todos, setTodos] = useState(() => primeiro.length === 0 && !inicial?.itens.length)
  const [salvando, setSalvando] = useState(false)
  const rec = useRef<ReturnType<typeof criarReconhecedor>>(null)
  const suportaVoz = typeof window !== 'undefined' && !!((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition)

  const ler = (texto: string) => {
    const r = lerContagem(texto, itens)
    if (r.lidos.length) {
      setValores((v) => ({ ...v, ...Object.fromEntries(r.lidos.map((l) => [l.chave, doNumero(l.quantidade)])) }))
      setLista((ls) => [...new Set([...ls, ...r.lidos.map((l) => l.chave)])])
      setDestaque(new Set(r.lidos.map((l) => l.chave)))
    }
    setNaoEntendi(r.naoEntendi)
    return r.lidos.length
  }

  const ouvir = () => {
    if (ouvindo) {
      rec.current?.stop()
      return
    }
    const r = criarReconhecedor()
    if (!r) return
    rec.current = r
    let acumulado = fala ? fala + ', ' : ''
    r.onresult = (ev) => {
      let interino = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i]
        if (res.isFinal) {
          acumulado += res[0].transcript.trim() + ', '
          setFala(acumulado.replace(/, $/, ''))
          ler(acumulado)
        } else interino += res[0].transcript
      }
      setParcial(interino)
    }
    r.onerror = (ev) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') avisar('O navegador não deixou usar o microfone. Libere o microfone para este site ou digite.')
      else if (ev.error !== 'no-speech' && ev.error !== 'aborted') avisar('Não consegui ouvir: ' + ev.error)
    }
    r.onend = () => {
      setOuvindo(false)
      setParcial('')
    }
    r.start()
    setOuvindo(true)
  }
  useEffect(() => () => rec.current?.stop(), [])

  const daLista = lista.map((k) => infoItem(itens, k)).filter(Boolean) as ItemContagem[]
  const filtro = busca.trim().toLowerCase()
  const visiveis = todos
    ? [...daLista, ...itens.filter((i) => !lista.includes(i.chave)).sort((a, b) => a.nome.localeCompare(b.nome))].filter((i) => !filtro || i.nome.toLowerCase().includes(filtro))
    : daLista
  const achados = !todos && busca.trim().length >= 2 ? itens.filter((i) => !lista.includes(i.chave) && i.nome.toLowerCase().includes(busca.toLowerCase())).slice(0, 8) : []
  const preenchidos = Object.entries(valores).filter(([, v]) => numero(v) !== null)

  const salvar = async () => {
    setSalvando(true)
    try {
      await aoSalvar(preenchidos.map(([chave, v]) => ({ chave, quantidade: Math.max(0, numero(v)!) })), fala, obs)
    } catch (err) {
      avisar((err as Error).message)
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={aoCancelar} className="text-sm font-semibold text-stone-500 hover:text-carvao">← Voltar</button>
      <h2 className="text-xl font-bold">{titulo}</h2>

      <Cartao>
        <div className="flex flex-wrap items-center gap-3">
          {suportaVoz ? (
            <button
              onClick={ouvir}
              className={`flex h-14 items-center gap-2 rounded-full px-5 font-bold text-white ${ouvindo ? 'animate-pulse bg-red-600' : 'bg-carvao'}`}
              aria-label={ouvindo ? 'Parar de ouvir' : 'Contar falando'}
            >
              <span aria-hidden className="text-xl">🎤</span> {ouvindo ? 'Ouvindo… toque para parar' : 'Contar falando'}
            </button>
          ) : (
            <p className="text-sm text-stone-500">Este navegador não reconhece fala. Digite abaixo ou use o Chrome (Android) ou o Safari (iPhone).</p>
          )}
          <p className="text-sm text-stone-600">Fale o item e a quantidade: <i>“mussarela 3 quilos e meio, focaccia 20, coca-cola 4 fardos”</i>.</p>
        </div>
        {(fala || parcial) && (
          <p className="mt-3 rounded-xl bg-stone-50 p-3 text-sm">
            {fala}
            {parcial && <span className="text-stone-400"> {parcial}</span>}
          </p>
        )}
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-stone-500">Escrever o texto (ou colar uma mensagem)</summary>
          <textarea className={`${estiloEntrada} mt-2`} rows={3} value={fala} onChange={(ev) => setFala(ev.target.value)} aria-label="Texto da contagem" />
          <Botao variante="secundario" className="mt-2" onClick={() => avisar(`${ler(fala)} itens preenchidos`)}>Ler o texto</Botao>
        </details>
        {naoEntendi.length > 0 && <p className="mt-2 text-sm text-amber-800">Não entendi: {naoEntendi.join('; ')}. Corrija na lista ou fale de novo.</p>}
      </Cartao>

      <div className="rounded-2xl bg-white ring-1 ring-stone-200">
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-3 py-2">
          <h3 className="font-bold">Ou preencha item por item</h3>
          <span className="text-sm text-stone-500">{todos ? `todos os itens (${itens.length})` : 'o que foi para o evento'}</span>
          <button className="ml-auto text-sm font-semibold text-sky-700 underline" onClick={() => setTodos((t) => !t)}>
            {todos ? 'Só o que foi para o evento' : 'Mostrar todos os itens'}
          </button>
          {todos && <input className={`${estiloEntrada} sm:w-64!`} placeholder="Filtrar a lista" value={busca} onChange={(ev) => setBusca(ev.target.value)} aria-label="Filtrar itens" />}
        </div>
        <ul className="divide-y divide-stone-100">
          {visiveis.length === 0 && <li className="px-3 py-4 text-sm text-stone-500">{todos ? 'Nenhum item com esse nome.' : 'Fale, busque abaixo ou toque em Mostrar todos os itens.'}</li>}
          {visiveis.map((i) => (
            <li key={i.chave} className={`flex items-center gap-3 px-3 py-2 ${destaque.has(i.chave) ? 'bg-ozzy-400/15' : ''}`}>
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{i.nome}</span>
                {i.embalagem && i.embalagemQtd && <span className="block text-xs text-stone-500">{i.embalagem} com {qtd(i.embalagemQtd)} {nomeUnidade(i.unidade)}</span>}
              </span>
              <input
                className="w-24 rounded-lg border border-stone-200 px-2 py-1.5 text-right"
                inputMode="decimal"
                aria-label={`Sobra de ${i.nome}`}
                placeholder="—"
                value={valores[i.chave] ?? ''}
                onChange={(ev) => setValores((v) => ({ ...v, [i.chave]: ev.target.value }))}
              />
              <span className="w-8 text-sm text-stone-500">{nomeUnidade(i.unidade)}</span>
            </li>
          ))}
        </ul>
        {!todos && <div className="border-t border-stone-100 p-3">
          <input className={estiloEntrada} placeholder="Buscar outro item para contar" value={busca} onChange={(ev) => setBusca(ev.target.value)} aria-label="Buscar item" />
          {achados.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {achados.map((i) => (
                <button key={i.chave} className="rounded-full bg-stone-100 px-3 py-1 text-sm hover:bg-stone-200" onClick={() => (setLista((ls) => [...ls, i.chave]), setBusca(''))}>
                  + {i.nome}
                </button>
              ))}
            </div>
          )}
        </div>}
      </div>
      <textarea className={estiloEntrada} rows={2} placeholder="Observação (opcional)" value={obs} onChange={(ev) => setObs(ev.target.value)} aria-label="Observação da contagem" />
      <p className="text-xs text-stone-500">Item sem número não entra na contagem. Para dizer que acabou, ponha 0.</p>
      <div className="flex justify-end gap-2">
        <Botao variante="secundario" onClick={aoCancelar}>Cancelar</Botao>
        <Botao disabled={salvando || !preenchidos.length} onClick={salvar}>{salvando ? 'Salvando…' : `Salvar contagem (${preenchidos.length})`}</Botao>
      </div>
    </div>
  )
}

// ——— Para quem está escalado no evento (sem acesso ao módulo Eventos): conferir a separação e contar as sobras ———

const ABAS_ESCALADO = [
  { id: '', nome: 'Separação' },
  { id: 'sobras', nome: 'Sobras do dia' },
]

export function MeuEvento({ id, aba }: { id?: string; aba?: string }) {
  const { store } = useApp()
  const [eventos, setEventos] = useState<EventoEscalado[] | null>(null)
  useEffect(() => {
    store.meusEventosEscalados().then(setEventos).catch(() => setEventos([]))
  }, [store])
  if (!eventos) return <p className="text-stone-400">Carregando…</p>
  const ev = eventos.find((x) => x.id === id) ?? (eventos.length === 1 ? eventos[0] : undefined)
  if (!ev)
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Meus eventos</h1>
        {eventos.length === 0 ? (
          <Vazio>Você não está escalado em nenhum evento em andamento.</Vazio>
        ) : (
          eventos.map((x) => (
            <Cartao key={x.id} onClick={() => ir('meu-evento/' + x.id)}>
              <b>{x.nome}</b>
              <span className="block text-sm text-stone-600">{x.dias.map((d) => diaCurto(d.data)).join(', ')}{x.papel && ` · ${x.papel}`}</span>
            </Cartao>
          ))
        )}
      </div>
    )
  // As telas de separação e sobras usam só nome, dias e margem do evento.
  const e = { id: ev.id, nome: ev.nome, status: ev.status, dias: ev.dias, margemSegurancaPct: 10 } as Evento
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold text-stone-400">Você está escalado{ev.papel && ` como ${ev.papel}`}</div>
        <h1 className="text-2xl font-bold tracking-tight">{ev.nome}</h1>
        <p className="text-sm text-stone-600">{ev.dias.map((d) => diaCurto(d.data)).join(', ')}</p>
      </div>
      <AbasEvento id={ev.id} aba={aba ?? ''} base="meu-evento" abas={ABAS_ESCALADO} />
      <MeuEventoAba e={e} aba={aba ?? ''} />
    </div>
  )
}

function MeuEventoAba({ e, aba }: { e: Evento; aba: string }) {
  const { d, erro, carregar } = useDadosLogistica(e.id, false)
  if (erro) return <p className="text-red-600">{erro}</p>
  if (!d) return <p className="text-stone-400">Carregando…</p>
  return aba === 'sobras' ? <Sobras e={e} d={d} aoMudar={carregar} /> : <Separacao e={e} d={d} aoMudar={carregar} />
}

// Cartão do início para quem está escalado em algum evento.
export function CartaoEventosEscalado() {
  const { store } = useApp()
  const [eventos, setEventos] = useState<EventoEscalado[]>([])
  useEffect(() => {
    store.meusEventosEscalados().then(setEventos).catch(() => setEventos([]))
  }, [store])
  if (!eventos.length) return null
  return (
    <Cartao>
      <h2 className="font-bold">Eventos em que você está escalado</h2>
      <ul className="mt-2 space-y-2">
        {eventos.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center gap-2">
            <span className="flex-1">
              <b>{x.nome}</b>
              <span className="block text-sm text-stone-600">{x.dias.map((d) => diaCurto(d.data)).join(', ')}{x.papel && ` · ${x.papel}`}</span>
            </span>
            <Botao variante="secundario" onClick={() => ir('meu-evento/' + x.id)}>Separação</Botao>
            <Botao onClick={() => ir('meu-evento/' + x.id + '/sobras')}>Contar sobra</Botao>
          </li>
        ))}
      </ul>
    </Cartao>
  )
}
