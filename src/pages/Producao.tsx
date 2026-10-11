import { useCallback, useEffect, useMemo, useState } from 'react'
import { Botao, Campo, Modal, Vazio, estiloEntrada } from '../components/ui'
import { useOrdem } from '../components/Ordenar'
import { agruparPorCategoria } from '../lib/categorias'
import { useApp } from '../lib/contexto'
import { addDias, dataCurta, diaSemana, hoje } from '../lib/datas'
import { lerValor, mostrarQtd, nomeCentro, reais } from '../lib/financeiro'
import { podeGerenciar } from '../lib/permissoes'
import { LOJAS_FECHAMENTO } from '../lib/types'
import type { CentroCusto, Fechamento, Insumo, ItemListaFechamento, PedidoProducao, Producao as ProducaoT, Receita, SetorFechamento, VersaoReceita } from '../lib/types'

// Menu Produção (Heitor, 09/10): pedidos das lojas (vindos do fechamento), lista de preparo descontando o que
// já tem na Central, lançar o que foi produzido (entra o preparo, saem os ingredientes da ficha) e as listas.

interface Dados { insumos: Insumo[]; receitas: Receita[]; versoes: VersaoReceita[]; centros: CentroCusto[]; producoes: ProducaoT[] }
type Aba = 'pedidos' | 'produzido' | 'listas'
const NOME_LOJA: Record<string, string> = { 'burger-psd': 'PSD', 'burger-va': 'Vila' }
const NOME_SETOR: Record<SetorFechamento, string> = { cozinha: 'Cozinha', atendimento: 'Atendimento' }
const DIAS_CURTOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const q = (n: number | null) => (n === null || n === 0 ? '' : mostrarQtd(n))

export default function Producao() {
  const { eu } = useApp()
  const gestao = podeGerenciar(eu.nivel)
  const [aba, setAba] = useState<Aba>('pedidos')
  const abas: [Aba, string][] = gestao ? [['pedidos', 'Pedidos das lojas'], ['produzido', 'Produzido'], ['listas', 'Listas']] : [['pedidos', 'Pedidos das lojas']]
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Produção</h1>
        <p className="text-sm text-stone-500">Os pedidos que as lojas mandaram no fechamento, o que precisa preparar e o que foi produzido.</p>
      </div>
      {abas.length > 1 && (
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-200 p-1 text-sm font-semibold">
          {abas.map(([a, nome]) => (
            <button key={a} onClick={() => setAba(a)} className={`rounded-lg py-2 ${aba === a ? 'bg-white shadow-sm' : 'text-stone-600'}`}>{nome}</button>
          ))}
        </div>
      )}
      {aba === 'pedidos' && <Pedidos />}
      {aba === 'produzido' && <Produzido />}
      {aba === 'listas' && <Listas />}
    </div>
  )
}

// ——— Pedidos das lojas e lista de preparo ———

function Pedidos() {
  const { store, avisar, nomeDe } = useApp()
  const [para, setPara] = useState(hoje())
  const [linhas, setLinhas] = useState<PedidoProducao[] | null>(null)
  const [fechs, setFechs] = useState<Fechamento[]>([])
  const [tem, setTem] = useState<Record<string, string>>({})
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  // Lançar direto da lista (Heitor, 10/10): o computador da produção mostra o que preparar e quem preparou lança ali.
  const [feitos, setFeitos] = useState<ProducaoT[]>([])
  const [dados, setDados] = useState<Dados | null>(null)
  const [lancar, setLancar] = useState<PedidoProducao | null>(null)
  const carregar = useCallback(async () => {
    try {
      const [l, f, p] = await Promise.all([store.pedidosProducao(para), store.fechamentos(addDias(para, -1), addDias(para, -1)),
        store.producoes(addDias(para, -1), para).catch(() => [])])
      setLinhas(l)
      setFechs(f)
      setFeitos(p)
      setTem(Object.fromEntries(l.filter((x) => x.prePreparo && x.central > 0).map((x) => [x.insumoId, String(Math.round(x.central * 1000) / 1000).replace('.', ',')])))
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [store, para])
  useEffect(() => { setLinhas(null); carregar() }, [carregar])

  const preparar = (linhas ?? []).filter((l) => l.prePreparo)
  const separar = (linhas ?? []).filter((l) => !l.prePreparo)
  const temNa = (l: PedidoProducao) => lerValor(tem[l.insumoId] ?? '') ?? 0
  const fazer = (l: PedidoProducao) => Math.max(0, Math.round((l.total - temNa(l)) * 1000) / 1000)
  const feito = (l: PedidoProducao) => feitos.filter((p) => p.insumoId === l.insumoId).reduce((t, p) => t + p.quantidade, 0)
  const posicao = new Map((linhas ?? []).map((l, k) => [l.insumoId, k]))
  const { ordenada: prepararOrd, cabecalho } = useOrdem(preparar, {
    ordem: (l) => posicao.get(l.insumoId), nome: (l) => l.nome, psd: (l) => l.psd || null, va: (l) => l.va || null, total: (l) => l.total, fazer, feito: (l) => feito(l) || null,
  }, { col: 'ordem' })
  if (erro) return <p className="text-red-700">{erro}</p>
  const abrirLancar = async (l: PedidoProducao) => {
    try {
      setDados(dados ?? (await carregarDados(store)))
      setLancar(l)
    } catch (e) { avisar((e as Error).message) }
  }
  const mudados = preparar.filter((l) => tem[l.insumoId] !== undefined && lerValor(tem[l.insumoId]) !== null && Math.abs((lerValor(tem[l.insumoId]) ?? 0) - l.central) > 0.0001)

  const copiar = async (texto: string) => {
    try { await navigator.clipboard.writeText(texto); avisar('Copiado') } catch { avisar('Não consegui copiar') }
  }
  const textoPreparo = () => [`*Preparar para ${diaSemana(para).toLowerCase()} ${dataCurta(para)}*`, ...preparar.filter((l) => fazer(l) > 0).map((l) => `${l.nome}: ${mostrarQtd(fazer(l))} ${l.unidadeContagem}`)].join('\n')
  const textoSeparar = (loja: string) => {
    const campo = loja === 'burger-psd' ? 'psd' : 'va'
    return [`*Separação ${NOME_LOJA[loja]} para ${dataCurta(para)}*`, ...(linhas ?? []).filter((l) => (l[campo] ?? 0) > 0).map((l) => `${l.nome}: ${mostrarQtd(l[campo]!)} ${l.unidadeContagem}`)].join('\n')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Botao variante="secundario" onClick={() => setPara(addDias(para, -1))} aria-label="Dia anterior">‹</Botao>
        <span className="min-w-44 text-center font-semibold">Para {diaSemana(para).toLowerCase()}, {dataCurta(para)}</span>
        <Botao variante="secundario" onClick={() => setPara(addDias(para, 1))} aria-label="Dia seguinte">›</Botao>
        {para !== hoje() && <button className="text-sm font-semibold text-stone-500 underline" onClick={() => setPara(hoje())}>Hoje</button>}
      </div>

      <div className="flex flex-wrap gap-2">
        {LOJAS_FECHAMENTO.flatMap((u) => (['cozinha', 'atendimento'] as const).map((s) => {
          const f = fechs.find((x) => x.unidadeId === u && x.setor === s)
          return (
            <span key={u + s} className={`rounded-full px-3 py-1 text-xs font-semibold ${f ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'}`}>
              {NOME_LOJA[u]} {NOME_SETOR[s].toLowerCase()}: {f ? `enviado ${new Date(f.enviadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${f.responsavel ? ' · ' + f.responsavel : f.enviadoPor ? ' · ' + nomeDe(f.enviadoPor) : ''}` : 'não enviou'}
            </span>
          )
        }))}
      </div>
      {fechs.filter((f) => f.observacao).map((f) => (
        <p key={f.id} className="text-sm text-stone-600"><b>{NOME_LOJA[f.unidadeId]} {NOME_SETOR[f.setor].toLowerCase()}:</b> {f.observacao}</p>
      ))}

      {!linhas ? <p className="text-stone-400">Carregando…</p> : linhas.length === 0 ? <Vazio>Nenhum pedido para este dia ainda.</Vazio> : (
        <>
          <section className="space-y-2">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="font-bold">Para preparar</h2>
                <p className="text-xs text-stone-500">Pedido das lojas menos o que já tem na Central. Corrija o “Tem na Central” se a contagem for outra.</p>
              </div>
              <div className="flex gap-2">
                {mudados.length > 0 && (
                  <Botao variante="secundario" disabled={salvando} onClick={async () => {
                    setSalvando(true)
                    try {
                      await store.contarCentral(hoje(), mudados.map((l) => ({ insumoId: l.insumoId, quantidade: lerValor(tem[l.insumoId])! })))
                      avisar('Estoque da Central atualizado')
                      await carregar()
                    } catch (e) { avisar((e as Error).message) } finally { setSalvando(false) }
                  }}>Salvar contagem da Central ({mudados.length})</Botao>
                )}
                <Botao variante="secundario" disabled={!preparar.some((l) => fazer(l) > 0)} onClick={() => copiar(textoPreparo())}>Copiar</Botao>
              </div>
            </div>
            {preparar.length === 0 ? <Vazio>Nenhum preparo pedido.</Vazio> : (
              <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-stone-500">
                    {cabecalho('nome', 'Preparo', 'px-2!')}{cabecalho('psd', 'PSD', 'px-1! text-right', true)}{cabecalho('va', 'Vila', 'px-1! text-right', true)}
                    {cabecalho('total', 'Total', 'px-1! text-right', true)}<th className="px-1 py-2 text-center">Tem na Central</th>{cabecalho('fazer', 'Fazer', 'px-2! text-right', true)}
                    {cabecalho('feito', 'Feito', 'px-2! text-right', true)}
                  </tr></thead>
                  <tbody className="divide-y divide-stone-100">
                    {prepararOrd.map((l) => (
                      <tr key={l.insumoId}>
                        <td className="px-2 py-2 font-semibold">{l.nome} <span className="text-xs font-normal text-stone-500">{l.unidadeContagem}</span></td>
                        <td className="px-1 py-2 text-right">{q(l.psd)}</td>
                        <td className="px-1 py-2 text-right">{q(l.va)}</td>
                        <td className="px-1 py-2 text-right">{mostrarQtd(l.total)}</td>
                        <td className="px-1 py-1 text-center">
                          <input inputMode="decimal" aria-label={`Quanto tem de ${l.nome} na Central`} value={tem[l.insumoId] ?? ''} placeholder="0"
                            onChange={(e) => setTem((v) => ({ ...v, [l.insumoId]: e.target.value }))} className={`${estiloEntrada} w-16! px-1! text-center`} />
                        </td>
                        <td className={`px-2 py-2 text-right font-bold ${fazer(l) > 0 ? '' : 'text-emerald-700'}`}>{fazer(l) > 0 ? mostrarQtd(fazer(l)) : 'tem'}</td>
                        <td className="px-2 py-1 text-right whitespace-nowrap">
                          {feito(l) > 0 && <span className="mr-1 text-xs font-semibold text-emerald-700">{mostrarQtd(feito(l))}</span>}
                          <button onClick={() => abrirLancar(l)} className="rounded-lg bg-carvao px-2 py-1 text-xs font-semibold text-white hover:bg-stone-700" aria-label={`Lançar ${l.nome}`}>
                            {feito(l) > 0 ? '+ Lançar' : 'Lançar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="font-bold">Para separar</h2>
                <p className="text-xs text-stone-500">Tudo o que as lojas pediram, com os preparos acima.</p>
              </div>
              <div className="flex gap-2">
                {LOJAS_FECHAMENTO.map((u) => (
                  <Botao key={u} variante="secundario" onClick={() => copiar(textoSeparar(u))}>Copiar {NOME_LOJA[u]}</Botao>
                ))}
              </div>
            </div>
            {(['cozinha', 'atendimento'] as const).map((s) => {
              const doSetor = [...preparar, ...separar].filter((l) => l.setor === s)
              if (!doSetor.length) return null
              return (
                <TabelaSeparar key={s} titulo={NOME_SETOR[s]} linhas={doSetor} />
              )
            })}
          </section>
        </>
      )}
      {lancar && dados && (
        <LancarProducao d={dados} inicial={{ insumoId: lancar.insumoId, quantidade: unidadeIgual(lancar.unidadeContagem, dados.insumos.find((i) => i.id === lancar.insumoId)?.unidade) && fazer(lancar) - feito(lancar) > 0 ? Math.round((fazer(lancar) - feito(lancar)) * 1000) / 1000 : null }}
          aoFechar={() => setLancar(null)} aoSalvar={async () => { setLancar(null); avisar('Produção lançada: estoque atualizado'); await carregar() }} />
      )}
    </div>
  )
}

function TabelaSeparar({ titulo, linhas }: { titulo: string; linhas: PedidoProducao[] }) {
  const posicao = new Map(linhas.map((l, k) => [l.insumoId, k]))
  const { ordenada, cabecalho } = useOrdem(linhas, {
    ordem: (l) => posicao.get(l.insumoId), nome: (l) => l.nome, psd: (l) => l.psd || null, va: (l) => l.va || null, total: (l) => l.total,
  }, { col: 'ordem' })
  return (
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
      <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{titulo}</p>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-stone-500">
          {cabecalho('nome', 'Item')}{cabecalho('psd', 'PSD', 'px-2! text-right', true)}{cabecalho('va', 'Vila', 'px-2! text-right', true)}{cabecalho('total', 'Total', 'text-right', true)}
        </tr></thead>
        <tbody className="divide-y divide-stone-100">
          {ordenada.map((l) => (
            <tr key={l.insumoId}>
              <td className="px-3 py-1.5">{l.nome} <span className="text-xs text-stone-500">{l.unidadeContagem}</span></td>
              <td className="px-2 py-1.5 text-right">{q(l.psd)}</td>
              <td className="px-2 py-1.5 text-right">{q(l.va)}</td>
              <td className="px-3 py-1.5 text-right font-semibold">{mostrarQtd(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ——— Listas de fechamento (gestão): itens, unidade de contagem e estoque ideal por dia ———

function Listas() {
  const { store, avisar } = useApp()
  const [loja, setLoja] = useState<string>('burger-psd')
  const [setor, setSetor] = useState<SetorFechamento>('cozinha')
  const [itens, setItens] = useState<ItemListaFechamento[] | null>(null)
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [mudou, setMudou] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')
  const [novo, setNovo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const carregar = useCallback(async () => {
    try {
      const [l, i] = await Promise.all([store.itensListaFechamento(loja, setor), store.insumos()])
      setItens(l)
      setInsumos(i)
      setMudou(new Set())
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [store, loja, setor])
  useEffect(() => { setItens(null); carregar() }, [carregar])

  const mudar = (id: string, m: Partial<ItemListaFechamento>) => {
    setItens((l) => l!.map((x) => (x.id === id ? { ...x, ...m } : x)))
    setMudou((s) => new Set(s).add(id))
  }
  const salvar = async () => {
    setSalvando(true)
    try {
      for (const i of itens!.filter((x) => mudou.has(x.id))) await store.salvarItemListaFechamento(i)
      avisar('Lista salva')
      await carregar()
    } catch (e) {
      avisar((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  const adicionar = async (ins: Insumo) => {
    // Item que já esteve na lista (tirado) volta com o ideal e a unidade de antes.
    const antes = itens?.find((x) => x.insumoId === ins.id)
    try {
      await store.salvarItemListaFechamento(antes ? { ...antes, ativo: true } : {
        unidadeId: loja, setor, insumoId: ins.id, unidadeContagem: ins.unidade === 'kg' ? 'Kg' : ins.unidade === 'l' ? 'Lts' : 'Uni',
        ordem: Math.max(0, ...(itens ?? []).map((x) => x.ordem)) + 1, ideal: Array(7).fill(null), prePreparo: !!ins.prePreparo, ativo: true,
      })
      setNovo('')
      avisar(`${ins.nome} entrou na lista`)
      await carregar()
    } catch (e) { avisar((e as Error).message) }
  }
  const tirar = async (i: ItemListaFechamento) => {
    if (mudou.size > 0) return avisar('Salve ou descarte as alterações antes de tirar um item.')
    try {
      await store.salvarItemListaFechamento({ ...i, ativo: false })
      avisar(`${i.nome} saiu da lista das duas lojas`)
      await carregar()
    } catch (e) { avisar((e as Error).message) }
  }

  if (erro) return <p className="text-red-700">{erro}</p>
  const termo = busca.trim().toLowerCase()
  const visiveis = (itens ?? []).filter((i) => i.ativo && (!termo || i.nome.toLowerCase().includes(termo)))
  const grupos = agruparPorCategoria(visiveis)
  const naLista = new Set((itens ?? []).filter((x) => x.ativo).map((x) => x.insumoId))
  const termoNovo = novo.trim().toLowerCase()
  const achados = termoNovo.length >= 2 ? insumos.filter((i) => i.ativo && !naLista.has(i.id) && i.nome.toLowerCase().includes(termoNovo)).slice(0, 10) : []

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={setor} onChange={(e) => setSetor(e.target.value as SetorFechamento)} className={`${estiloEntrada} w-auto!`} aria-label="Lista">
          <option value="cozinha">Lista da cozinha</option><option value="atendimento">Lista do atendimento</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-stone-600">
          Estoque ideal de
          <select value={loja} onChange={(e) => setLoja(e.target.value)} className={`${estiloEntrada} w-auto!`} aria-label="Estoque ideal de">
            {LOJAS_FECHAMENTO.map((u) => <option key={u} value={u}>{u === 'burger-psd' ? 'Parque São Domingos' : 'Vila Anastácio'}</option>)}
          </select>
        </label>
      </div>
      <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
        <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Adicionar item: digite o nome do material" aria-label="Adicionar item" className={estiloEntrada} />
        {achados.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {achados.map((i) => <button key={i.id} onClick={() => adicionar(i)} className="rounded-full bg-stone-100 px-3 py-1 text-sm hover:bg-stone-200">+ {i.nome}{i.categoria ? <span className="text-stone-500"> · {i.categoria}</span> : null}</button>)}
          </div>
        )}
        {termoNovo.length >= 2 && achados.length === 0 && <p className="mt-2 text-sm text-stone-500">Nada no cadastro com esse nome (ou já está na lista).</p>}
      </div>
      <p className="text-xs text-stone-500">A lista é a mesma nas duas lojas: adicionar, tirar, unidade e “Preparo” valem para as duas. Só o estoque ideal é de cada loja: quanto ela precisa ter no começo de cada dia, na unidade em que conta (em branco = sem sugestão). “Preparo” marca o que a Central prepara.</p>
      {(itens?.length ?? 0) > 8 && <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar na lista" aria-label="Procurar na lista" className={`${estiloEntrada} max-w-xs`} />}
      {!itens ? <p className="text-stone-400">Carregando…</p> : (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-stone-500">
              <th className="px-3 py-2">Item</th><th className="px-1 py-2">Un.</th>
              {DIAS_CURTOS.map((d) => <th key={d} className="px-1 py-2 text-center">{d}</th>)}
              <th className="px-1 py-2 text-center">Preparo</th><th className="px-2 py-2" />
            </tr></thead>
            {grupos.map(([cat, lista]) => (
              <tbody key={cat} className="divide-y divide-stone-100">
                <tr><td colSpan={11} className="bg-stone-50 px-3 py-1.5 text-xs font-bold tracking-wide text-stone-600 uppercase">{cat}</td></tr>
                {lista.map((i) => (
                  <tr key={i.id}>
                    <td className="min-w-48 px-3 py-1">{i.nome}</td>
                    <td className="px-1 py-1"><input value={i.unidadeContagem} onChange={(e) => mudar(i.id, { unidadeContagem: e.target.value })} className={`${estiloEntrada} w-14! px-1! text-center`} aria-label={`Unidade de ${i.nome}`} /></td>
                    {i.ideal.map((v, k) => (
                      <td key={k} className="px-1 py-1">
                        <input inputMode="decimal" defaultValue={v === null ? '' : String(v).replace('.', ',')} aria-label={`Ideal de ${i.nome} na ${DIAS_CURTOS[k]}`}
                          onChange={(e) => mudar(i.id, { ideal: i.ideal.map((x, j) => (j === k ? lerValor(e.target.value) : x)) })}
                          className={`${estiloEntrada} w-14! px-1! text-center`} />
                      </td>
                    ))}
                    <td className="px-1 py-1 text-center"><input type="checkbox" checked={i.prePreparo} onChange={(e) => mudar(i.id, { prePreparo: e.target.checked })} aria-label={`${i.nome} é preparo da Central`} /></td>
                    <td className="px-2 py-1 text-center"><button onClick={() => tirar(i)} className="text-xs font-semibold text-stone-500 underline hover:text-red-700" aria-label={`Tirar ${i.nome} da lista`}>Tirar</button></td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
      {mudou.size > 0 && (
        <div className="sticky bottom-2 z-10 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-stone-300">
          <span className="text-sm text-stone-600">{mudou.size} {mudou.size === 1 ? 'item alterado' : 'itens alterados'}</span>
          <div className="flex gap-2">
            <Botao variante="fantasma" onClick={() => { setItens(null); carregar() }}>Descartar</Botao>
            <Botao onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
          </div>
        </div>
      )}
    </div>
  )
}

// ——— Produzido: lançar a produção do dia ———

const carregarDados = (store: ReturnType<typeof useApp>['store']): Promise<Dados> =>
  Promise.all([store.insumos(), store.receitas(), store.versoesReceitas(), store.centrosCusto(), store.producoes(addDias(hoje(), -30), hoje())])
    .then(([insumos, receitas, versoes, centros, producoes]) => ({ insumos, receitas, versoes, centros, producoes }))
// A lista conta em "Kg", "Lts", "Uni"…; o estoque guarda em kg, l, un. Só sugere a quantidade quando é a mesma.
const unidadeIgual = (contagem: string, estoque?: string) => {
  const c = contagem.trim().toLowerCase()
  return !!estoque && (c === estoque || (estoque === 'kg' && c.startsWith('kg')) || (estoque === 'l' && /^(l|lt|lts|litros?)$/.test(c)) || (estoque === 'un' && /^(un|uni|und|unid)/.test(c)))
}

function Produzido() {
  const { store, avisar, nomeDe } = useApp()
  const [d, setD] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const [lancando, setLancando] = useState(false)
  const carregar = useCallback(() => carregarDados(store).then(setD, (e) => setErro(e.message)), [store])
  useEffect(() => { carregar() }, [carregar])

  if (erro) return <p className="text-red-700">{erro}</p>
  if (!d) return <p className="text-stone-400">Carregando…</p>

  const insumo = (id: string) => d.insumos.find((i) => i.id === id)
  const dias = [...new Set(d.producoes.map((p) => p.data))]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-stone-500">Lance o que foi produzido: entra o preparo e saem os ingredientes da ficha, no estoque da cozinha que produziu.</p>
        <Botao onClick={() => setLancando(true)}>+ Lançar produção</Botao>
      </div>

      {d.producoes.length === 0 ? <Vazio>Nenhuma produção lançada nos últimos 30 dias.</Vazio> : dias.map((dia) => (
        <div key={dia} className="space-y-1">
          <p className="text-sm font-semibold text-stone-600">{diaSemana(dia)}, {dataCurta(dia)}</p>
          <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
            {d.producoes.filter((p) => p.data === dia).map((p) => {
              const i = insumo(p.insumoId)
              return (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{mostrarQtd(p.quantidade)} {i?.unidade} de {i?.nome ?? 'preparo'}</div>
                    <div className="truncate text-xs text-stone-500">
                      {nomeCentro(d.centros.find((c) => c.id === p.centroCustoId))}
                      {p.custoTotal ? ` · custo ${reais(p.custoTotal)} (${reais(p.custoTotal / p.quantidade)}/${i?.unidade})` : ''}
                      {p.criadoPor ? ` · ${nomeDe(p.criadoPor)}` : ''}{p.observacao ? ` · ${p.observacao}` : ''}
                    </div>
                  </div>
                  <button className="text-xs font-semibold text-stone-500 underline hover:text-red-700" onClick={async () => {
                    if (!confirm('Desfazer esta produção? O preparo sai do estoque e os ingredientes voltam.')) return
                    try { await store.desfazerProducao(p.id); await carregar(); avisar('Produção desfeita') } catch (e) { setErro((e as Error).message) }
                  }}>Desfazer</button>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {lancando && <LancarProducao d={d} aoFechar={() => setLancando(false)} aoSalvar={async () => { setLancando(false); await carregar(); avisar('Produção lançada: estoque atualizado') }} />}
    </div>
  )
}

interface Saida { insumoId: string; qtd: string; daFicha: string | null }

function LancarProducao({ d, inicial, aoFechar, aoSalvar }: { d: Dados; inicial?: { insumoId: string; quantidade: number | null }; aoFechar: () => void; aoSalvar: () => void }) {
  const { store, eu } = useApp()
  const gestao = podeGerenciar(eu.nivel)
  const ativos = useMemo(() => d.insumos.filter((i) => i.ativo).sort((a, b) => a.nome.localeCompare(b.nome)), [d.insumos])
  // Só o que é pré-preparo entra na lista (Heitor, 10/10): os itens marcados como pré-preparo e as fichas de preparo.
  // Quem tem ficha já vem com os ingredientes dela como sugestão.
  const opcoes = useMemo(() => {
    const r: { valor: string; nome: string; semFicha: boolean }[] = []
    const ligados = new Set<string>()
    for (const x of d.receitas.filter((x) => x.tipo === 'preparo' && x.ativo)) {
      const ins = x.insumoId ?? d.insumos.find((i) => i.nome.toLowerCase() === x.nome.toLowerCase())?.id
      if (ins) ligados.add(ins)
      r.push({ valor: x.id, nome: x.nome, semFicha: !x.versaoAtual })
    }
    for (const i of d.insumos.filter((i) => i.ativo && i.prePreparo && !ligados.has(i.id))) r.push({ valor: 'i:' + i.id, nome: i.nome, semFicha: true })
    return r.sort((a, b) => a.nome.localeCompare(b.nome))
  }, [d.receitas, d.insumos])
  const [centro, setCentro] = useState(d.centros.some((c) => c.id === 'central') ? 'central' : d.centros[0]?.id ?? '')
  const [data, setData] = useState(hoje())
  // Vindo da lista do que preparar: já com o preparo (pela ficha ligada ao item) e o que falta fazer.
  const fichaInicial = inicial ? d.receitas.find((r) => r.tipo === 'preparo' && r.ativo && r.insumoId === inicial.insumoId) : undefined
  const [receitaId, setReceitaId] = useState(fichaInicial?.id ?? '')
  const [insumoId, setInsumoId] = useState(inicial && !fichaInicial ? inicial.insumoId : '')
  const [qtd, setQtd] = useState(inicial?.quantidade ? String(inicial.quantidade).replace('.', ',') : '')
  const [saidas, setSaidas] = useState<Saida[]>([])
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const receita = d.receitas.find((r) => r.id === receitaId)
  const versao = receita ? d.versoes.find((v) => v.receitaId === receita.id && v.numero === receita.versaoAtual) : undefined
  const unidade = receita?.unidade ?? d.insumos.find((i) => i.id === insumoId)?.unidade ?? ''
  // Item de estoque de um preparo usado dentro de outro (o ligado à ficha ou um com o mesmo nome).
  const insumoDoPreparo = (r: Receita | undefined) => r && (r.insumoId ?? d.insumos.find((i) => i.nome.toLowerCase() === r.nome.toLowerCase())?.id ?? null)

  // Ingredientes pela ficha, proporcionais ao que foi produzido (comprar = líquido ÷ aproveitamento).
  function pelaFicha(rid: string, q: string) {
    const r = d.receitas.find((x) => x.id === rid)
    const v = r ? d.versoes.find((x) => x.receitaId === r.id && x.numero === r.versaoAtual) : undefined
    const n = lerValor(q)
    if (!v || !n || n <= 0) return setSaidas([])
    const fator = n / v.rendimento
    setSaidas(v.itens.map((it) => {
      const id = it.insumoId ?? insumoDoPreparo(d.receitas.find((x) => x.id === it.subReceitaId)) ?? ''
      const valor = Math.round((it.quantidade / it.aproveitamento) * fator * 1000) / 1000
      const sub = it.subReceitaId ? d.receitas.find((x) => x.id === it.subReceitaId)?.nome ?? null : null
      return { insumoId: id, qtd: String(valor).replace('.', ','), daFicha: id ? null : sub }
    }))
  }

  useEffect(() => {
    if (fichaInicial && inicial?.quantidade) pelaFicha(fichaInicial.id, String(inicial.quantidade).replace('.', ','))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const custo = saidas.reduce((t, s) => t + (lerValor(s.qtd) ?? 0) * (d.insumos.find((i) => i.id === s.insumoId)?.preco ?? 0), 0)
  const semPreco = saidas.filter((s) => s.insumoId && d.insumos.find((i) => i.id === s.insumoId)?.preco == null).length
  const n = lerValor(qtd)

  async function salvar() {
    setErro('')
    if (!centro) return setErro('Escolha a cozinha.')
    if (!receitaId && !insumoId) return setErro('Escolha o que foi produzido.')
    if (!n || n <= 0) return setErro('Diga quanto foi produzido.')
    if (saidas.some((s) => !s.insumoId)) return setErro('Tem ingrediente sem item de estoque: escolha o item ou tire a linha.')
    if (saidas.some((s) => lerValor(s.qtd) === null || lerValor(s.qtd)! < 0)) return setErro('Confira as quantidades dos ingredientes.')
    setSalvando(true)
    try {
      await store.lancarProducao({
        centroCustoId: centro, data, receitaId: receitaId || null, insumoId: receitaId ? null : insumoId, quantidade: n, observacao: obs,
        saidas: saidas.map((s) => ({ insumoId: s.insumoId, quantidade: lerValor(s.qtd)! })).filter((s) => s.quantidade > 0),
      })
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
      setSalvando(false)
    }
  }

  return (
    <Modal titulo="Lançar produção" aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Cozinha que produziu">
            <select className={estiloEntrada} value={centro} onChange={(e) => setCentro(e.target.value)}>
              {d.centros.map((c) => <option key={c.id} value={c.id}>{nomeCentro(c)}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Dia"><input type="date" className={estiloEntrada} value={data} max={hoje()} onChange={(e) => setData(e.target.value)} /></Campo>
        </div>
        <Campo rotulo="O que foi produzido">
          <select className={estiloEntrada} value={receitaId || (insumoId ? 'i:' + insumoId : '')} aria-label="O que foi produzido"
            onChange={(e) => {
              const v = e.target.value
              if (v.startsWith('i:')) { setReceitaId(''); setInsumoId(v.slice(2)); setSaidas([]) } else { setReceitaId(v); setInsumoId(''); pelaFicha(v, qtd) }
            }}>
            <option value="">Escolher o pré-preparo</option>
            {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.nome}{o.semFicha ? ' (sem ficha: você põe os ingredientes)' : ''}</option>)}
          </select>
        </Campo>
        <Campo rotulo={`Quanto ficou pronto${unidade ? ` (${unidade})` : ''}`}>
          <input className={estiloEntrada} inputMode="decimal" value={qtd} aria-label="Quanto ficou pronto"
            onChange={(e) => { setQtd(e.target.value); if (receitaId) pelaFicha(receitaId, e.target.value) }} />
        </Campo>
        {versao && n ? <p className="text-xs text-stone-500">A ficha rende {mostrarQtd(versao.rendimento)} {receita?.unidade}: os ingredientes abaixo são para {mostrarQtd(n)} {receita?.unidade}. Se usou diferente, ajuste.</p> : null}

        {(saidas.length > 0 || (!receitaId && insumoId)) && (
          <div className="space-y-2 rounded-xl bg-stone-50 p-3">
            <p className="text-sm font-semibold">Saem do estoque</p>
            {saidas.map((s, k) => {
              const ins = d.insumos.find((i) => i.id === s.insumoId)
              return (
                <div key={k} className="flex items-center gap-2">
                  {s.insumoId && !s.daFicha ? (
                    <span className="min-w-0 flex-1 truncate text-sm">{ins?.nome}</span>
                  ) : (
                    <select className={estiloEntrada + ' min-w-0 flex-1 py-1.5!'} value={s.insumoId} aria-label="Ingrediente"
                      onChange={(e) => setSaidas(saidas.map((x, j) => (j === k ? { ...x, insumoId: e.target.value, daFicha: null } : x)))}>
                      <option value="">{s.daFicha ? `${s.daFicha}: qual item do estoque?` : 'Escolher ingrediente'}</option>
                      {ativos.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
                    </select>
                  )}
                  <input className={estiloEntrada + ' w-24! shrink-0 py-1.5! text-right'} inputMode="decimal" value={s.qtd} aria-label={`Quantidade de ${ins?.nome ?? 'ingrediente'}`}
                    onChange={(e) => setSaidas(saidas.map((x, j) => (j === k ? { ...x, qtd: e.target.value } : x)))} />
                  <span className="w-6 shrink-0 text-xs text-stone-500">{ins?.unidade}</span>
                  <button className="px-1 text-stone-400 hover:text-red-700" aria-label="Tirar" onClick={() => setSaidas(saidas.filter((_, j) => j !== k))}>✕</button>
                </div>
              )
            })}
            <button className="text-sm font-semibold underline" onClick={() => setSaidas([...saidas, { insumoId: '', qtd: '', daFicha: null }])}>+ Ingrediente</button>
            {gestao && custo > 0 && n ? (
              <p className="text-xs text-stone-600">
                Custo: <b>{reais(custo)}</b> ({reais(custo / n)} por {unidade}){semPreco ? ` · ${semPreco} sem preço cadastrado` : ''}. Vira o preço do preparo no estoque.
              </p>
            ) : null}
          </div>
        )}
        <Campo rotulo="Observação (opcional)"><input className={estiloEntrada} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: lote da tarde, pedido da PSD" /></Campo>
        {erro && <p className="text-sm text-red-700">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao onClick={salvar} disabled={salvando}>{salvando ? 'Lançando…' : 'Lançar'}</Botao>
        </div>
      </div>
    </Modal>
  )
}
