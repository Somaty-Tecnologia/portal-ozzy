import { useCallback, useEffect, useMemo, useState } from 'react'
import { Botao, Campo, CampoNumero, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { addDias, dataCurta, diaSemana, hoje, inicioDaSemana } from '../lib/datas'
import { reais } from '../lib/financeiro'
import { podeGerenciar } from '../lib/permissoes'
import { ir } from '../lib/rota'
import type { Insumo, ModeloRefeicao, RecadoRefeicao, Refeicao, ResultadoVotacao, TipoRecado, VotacaoCardapio } from '../lib/types'

// Refeições, parte 2 (Heitor, 13/10): a equipe participa do cardápio.
// - Votação da semana: abre no sábado para a semana seguinte; cada pessoa escolhe até N pratos (anônimo).
// - Fale com a cozinha: recado anônimo (elogio, crítica, sugestão), sem autor gravado.
// - Orçamento: meta de custo por refeição; quem cozinha vê a média da semana e quanto sobra para caprichar.

const dia = (d: string) => `${diaSemana(d)} ${dataCurta(d)}`
const aberta = (v: VotacaoCardapio) => v.abreEm <= hoje() && hoje() <= v.fechaEm
const NOME_RECADO: Record<TipoRecado, string> = { elogio: '👏 Elogio', critica: '👎 Crítica', sugestao: '💡 Sugestão' }

// ——— Para todos: votar no cardápio da semana que vem ———

export function VotacaoDaSemana({ aviso = false }: { aviso?: boolean }) {
  const { store, avisar } = useApp()
  const [votacoes, setVotacoes] = useState<VotacaoCardapio[] | null>(null)
  const [resultados, setResultados] = useState<Record<string, ResultadoVotacao[]>>({})
  const [escolha, setEscolha] = useState<string[] | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [sugerir, setSugerir] = useState(false)
  const carregar = useCallback(async () => {
    try {
      const vs = await store.votacoesCardapio(addDias(hoje(), -7))
      setVotacoes(vs)
      const rs = await Promise.all(vs.map((v) => store.resultadoVotacao(v.id)))
      setResultados(Object.fromEntries(vs.map((v, i) => [v.id, rs[i]])))
    } catch {
      setVotacoes([])
    }
  }, [store])
  useEffect(() => { carregar() }, [carregar])
  if (!votacoes) return null
  const atual = votacoes.find(aberta)
  // Resultado da votação que já fechou (a semana que está rolando), para todos verem.
  const fechada = votacoes.find((v) => v.fechaEm < hoje())
  const minhas = atual ? (resultados[atual.id] ?? []).filter((r) => r.minha).map((r) => r.opcaoId) : []
  const jaVotei = minhas.length > 0

  if (aviso) {
    if (!atual || jaVotei) return null
    return (
      <button onClick={() => ir('refeicoes')} className="flex w-full items-center gap-3 rounded-2xl bg-ozzy-50 p-4 text-left ring-1 ring-ozzy-400/60">
        <span className="text-2xl">🗳️</span>
        <span className="flex-1">
          <span className="block font-bold">Vote no cardápio da semana que vem</span>
          <span className="text-sm text-stone-600">Escolha até {atual.maxEscolhas} pratos. A votação vai até {dia(atual.fechaEm)} e é anônima.</span>
        </span>
        <span className="font-semibold text-stone-500">Votar ›</span>
      </button>
    )
  }

  const selecionadas = escolha ?? minhas
  const alternar = (id: string) => {
    if (!atual) return
    const s = selecionadas.includes(id) ? selecionadas.filter((x) => x !== id) : [...selecionadas, id]
    if (s.length > atual.maxEscolhas) return avisar(`Escolha no máximo ${atual.maxEscolhas} pratos.`)
    setEscolha(s)
  }
  const votar = async () => {
    if (!atual) return
    setEnviando(true)
    try {
      await store.votarCardapio(atual.id, selecionadas)
      setEscolha(null)
      await carregar()
      avisar(selecionadas.length ? 'Voto registrado. Pode mudar até a votação fechar.' : 'Voto retirado')
    } catch (e) {
      avisar((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }
  const mudou = escolha !== null && (escolha.length !== minhas.length || escolha.some((x) => !minhas.includes(x)))

  return (
    <section className="space-y-3">
      {atual ? (
        <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
          <div>
            <h2 className="text-lg font-bold">🗳️ Cardápio da semana de {dataCurta(atual.semana)}</h2>
            <p className="text-sm text-stone-600">Escolha até {atual.maxEscolhas} pratos que você quer comer. Vai até {dia(atual.fechaEm)}. {atual.observacao}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {atual.opcoes.map((o) => {
              const sel = selecionadas.includes(o.id)
              return (
                <button key={o.id} onClick={() => alternar(o.id)} aria-pressed={sel}
                  className={`flex items-center gap-3 rounded-xl p-3 text-left ring-1 transition ${sel ? 'bg-ozzy-50 ring-2 ring-carvao' : 'bg-white ring-stone-300 hover:ring-stone-500'}`}>
                  <span className={`grid size-6 shrink-0 place-items-center rounded-md text-sm font-bold ${sel ? 'bg-carvao text-white' : 'ring-1 ring-stone-300'}`}>{sel ? '✓' : ''}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{o.nome}</span>
                    {o.descricao && <span className="block text-xs text-stone-500">{o.descricao}</span>}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Botao disabled={enviando || (!mudou && jaVotei) || (!jaVotei && !selecionadas.length)} onClick={votar}>
              {enviando ? 'Enviando…' : jaVotei && !mudou ? 'Voto registrado ✓' : jaVotei ? 'Mudar meu voto' : 'Votar'}
            </Botao>
            <Botao variante="secundario" onClick={() => setSugerir((x) => !x)}>💡 Sugerir outro prato</Botao>
            <span className="text-xs text-stone-500">{selecionadas.length} de {atual.maxEscolhas} · {resultados[atual.id]?.[0]?.participantes ?? 0} pessoas já votaram</span>
          </div>
          {sugerir && <FaleComCozinha tipoInicial="sugestao" votacaoId={atual.id} titulo="Que prato você gostaria de ver no cardápio?" aoEnviar={() => setSugerir(false)} />}
          <p className="text-xs text-stone-500">Seu voto é anônimo: ninguém, nem quem cozinha, vê em quem você votou.</p>
        </div>
      ) : null}
      {fechada && <ResultadoFechado votacao={fechada} resultado={resultados[fechada.id] ?? []} />}
    </section>
  )
}

function ResultadoFechado({ votacao, resultado }: { votacao: VotacaoCardapio; resultado: ResultadoVotacao[] }) {
  const linhas = votacao.opcoes.map((o) => ({ ...o, votos: resultado.find((r) => r.opcaoId === o.id)?.votos ?? 0 })).sort((a, b) => b.votos - a.votos)
  const max = Math.max(1, ...linhas.map((l) => l.votos))
  return (
    <details className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <summary className="cursor-pointer font-bold">Resultado da votação: semana de {dataCurta(votacao.semana)} <span className="font-normal text-stone-500">({resultado[0]?.participantes ?? 0} pessoas votaram)</span></summary>
      <ul className="mt-2 space-y-1.5">
        {linhas.map((l, i) => (
          <li key={l.id} className="flex items-center gap-2 text-sm">
            <span className="w-48 shrink-0 truncate font-semibold">{i < 3 && l.votos > 0 ? ['🥇', '🥈', '🥉'][i] + ' ' : ''}{l.nome}</span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-100"><span className="block h-full rounded-full bg-ozzy-400" style={{ width: `${(l.votos / max) * 100}%` }} /></span>
            <span className="w-8 text-right tabular-nums">{l.votos}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}

// ——— Para todos: recado anônimo para a cozinha ———

export function FaleComCozinha({ tipoInicial = 'sugestao', refeicao, votacaoId, titulo, aoEnviar }: {
  tipoInicial?: TipoRecado; refeicao?: Refeicao; votacaoId?: string; titulo?: string; aoEnviar?: () => void
}) {
  const { store, avisar } = useApp()
  const [tipo, setTipo] = useState<TipoRecado>(tipoInicial)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const enviar = async () => {
    setEnviando(true)
    try {
      await store.enviarRecadoRefeicao(tipo, texto, refeicao?.id ?? null, votacaoId ?? null)
      setTexto('')
      avisar('Recado enviado para a cozinha, sem o seu nome')
      aoEnviar?.()
    } catch (e) {
      avisar((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }
  return (
    <div className="space-y-2 rounded-xl bg-stone-50 p-3 ring-1 ring-stone-200">
      <div className="text-sm font-semibold">{titulo ?? (refeicao ? `Sobre: ${refeicao.prato}` : 'Fale com a cozinha')}</div>
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(NOME_RECADO) as TipoRecado[]).map((t) => (
          <button key={t} onClick={() => setTipo(t)} aria-pressed={tipo === t}
            className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${tipo === t ? 'bg-carvao text-white ring-carvao' : 'bg-white text-stone-600 ring-stone-300'}`}>{NOME_RECADO[t]}</button>
        ))}
      </div>
      <textarea className={`${estiloEntrada} min-h-20`} maxLength={1000} value={texto} onChange={(e) => setTexto(e.target.value)}
        placeholder={tipo === 'elogio' ? 'O que estava bom?' : tipo === 'critica' ? 'O que não estava legal? (sal, ponto, porção, temperatura…)' : 'Que prato ou mudança você sugere?'} aria-label="Recado" />
      <div className="flex flex-wrap items-center gap-2">
        <Botao disabled={enviando || !texto.trim()} onClick={enviar}>{enviando ? 'Enviando…' : 'Enviar'}</Botao>
        <span className="text-xs text-stone-500">Anônimo: o portal não grava quem mandou.</span>
      </div>
    </div>
  )
}

// ——— Quem cozinha: aviso de recados novos na Início ———

export function RecadosNovos() {
  const { store } = useApp()
  const [n, setN] = useState(0)
  useEffect(() => { store.recadosRefeicao(addDias(hoje(), -30)).then((rs) => setN(rs.filter((r) => !r.lidoEm).length), () => {}) }, [store])
  if (!n) return null
  return (
    <button onClick={() => ir('refeicoes/recados')} className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left ring-1 ring-stone-200">
      <span className="text-2xl">💬</span>
      <span className="flex-1 font-bold">{n} {n === 1 ? 'recado novo' : 'recados novos'} da equipe sobre as refeições</span>
      <span className="font-semibold text-stone-500">Ler ›</span>
    </button>
  )
}

// ——— Quem cozinha: recados da equipe ———

export function Recados() {
  const { store, avisar } = useApp()
  const [dias, setDias] = useState(30)
  const [recados, setRecados] = useState<RecadoRefeicao[] | null>(null)
  const [refeicoes, setRefeicoes] = useState<Refeicao[]>([])
  const [tipo, setTipo] = useState<TipoRecado | ''>('')
  useEffect(() => {
    const de = addDias(hoje(), -dias)
    Promise.all([store.recadosRefeicao(de), store.refeicoes(addDias(de, -7), hoje())]).then(([rs, rf]) => {
      setRecados(rs)
      setRefeicoes(rf)
      // Abriu a tela: os novos passam a lidos (continuam destacados até sair).
      store.marcarRecadosLidos(rs.filter((r) => !r.lidoEm).map((r) => r.id)).catch(() => {})
    }, (e) => avisar((e as Error).message))
  }, [store, dias, avisar])
  if (!recados) return <p className="text-stone-400">Carregando…</p>
  const lista = recados.filter((r) => !tipo || r.tipo === tipo)
  const conta = (t: TipoRecado) => recados.filter((r) => r.tipo === t).length
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${estiloEntrada} w-auto! py-2!`} value={dias} onChange={(e) => setDias(Number(e.target.value))} aria-label="Período">
          {[7, 30, 90, 365].map((d) => <option key={d} value={d}>Últimos {d} dias</option>)}
        </select>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setTipo('')} className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${!tipo ? 'bg-carvao text-white ring-carvao' : 'bg-white ring-stone-300'}`}>Todos ({recados.length})</button>
          {(Object.keys(NOME_RECADO) as TipoRecado[]).map((t) => (
            <button key={t} onClick={() => setTipo(t)} className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${tipo === t ? 'bg-carvao text-white ring-carvao' : 'bg-white ring-stone-300'}`}>{NOME_RECADO[t]} ({conta(t)})</button>
          ))}
        </div>
      </div>
      <p className="text-sm text-stone-600">Recados anônimos da equipe. Ninguém sabe quem mandou: é um canal aberto para melhorar a comida.</p>
      {lista.length === 0 ? <Vazio>Nenhum recado no período.</Vazio> : (
        <div className="space-y-2">
          {lista.map((r) => {
            const rf = refeicoes.find((x) => x.id === r.refeicaoId)
            return (
              <div key={r.id} className={`rounded-2xl bg-white p-3 ring-1 ${r.lidoEm ? 'ring-stone-200' : 'ring-2 ring-ozzy-400'}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                  <Selo cor={r.tipo === 'elogio' ? 'verde' : r.tipo === 'critica' ? 'vermelho' : 'azul'}>{NOME_RECADO[r.tipo]}</Selo>
                  <span>{dia(r.data)}</span>
                  {rf && <span>· sobre {rf.prato} ({dataCurta(rf.data)})</span>}
                  {r.votacaoId && !rf && <span>· na votação do cardápio</span>}
                  {!r.lidoEm && <Selo cor="ambar">Novo</Selo>}
                </div>
                <p className="mt-1 whitespace-pre-line">{r.texto}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ——— Orçamento: meta por refeição e semanas ———

interface Semana { inicio: string; refeicoes: number; custo: number; media: number | null; folga: number | null }

function useSemanas(semanas: number) {
  const { store, avisar } = useApp()
  const [dados, setDados] = useState<{ semanas: Semana[]; meta: number | null } | null>(null)
  const carregar = useCallback(async () => {
    const de = addDias(inicioDaSemana(hoje()), -7 * (semanas - 1))
    try {
      const [rs, meta] = await Promise.all([store.refeicoesCozinha(de, hoje()), store.metaRefeicao().catch(() => null)])
      const lista: Semana[] = []
      for (let k = 0; k < semanas; k++) {
        const inicio = addDias(de, 7 * k)
        const daSemana = rs.filter((r) => r.data >= inicio && r.data < addDias(inicio, 7) && r.pessoas && r.custoTotal != null)
        const refeicoes = daSemana.reduce((t, r) => t + (r.pessoas ?? 0), 0)
        const custo = daSemana.reduce((t, r) => t + (r.custoTotal ?? 0), 0)
        lista.push({ inicio, refeicoes, custo, media: refeicoes ? custo / refeicoes : null, folga: meta && refeicoes ? meta * refeicoes - custo : null })
      }
      setDados({ semanas: lista.reverse(), meta })
    } catch (e) {
      avisar((e as Error).message)
    }
  }, [store, semanas, avisar])
  useEffect(() => { carregar() }, [carregar])
  return { dados, carregar }
}

export function OrcamentoRefeicoes() {
  const { store, eu, avisar } = useApp()
  const { dados, carregar } = useSemanas(6)
  const [editando, setEditando] = useState<number | null | undefined>(undefined)
  if (!dados) return null
  const { semanas, meta } = dados
  const atual = semanas[0]
  const folga4 = semanas.slice(0, 4).reduce((t, s) => t + (s.folga ?? 0), 0)
  const salvarMeta = async () => {
    try {
      await store.salvarMetaRefeicao(editando && editando > 0 ? editando : null)
      setEditando(undefined)
      await carregar()
      avisar('Meta salva')
    } catch (e) {
      avisar((e as Error).message)
    }
  }
  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <div className="text-xs font-semibold tracking-wide text-stone-500 uppercase">Meta por refeição</div>
          {editando !== undefined ? (
            <div className="flex items-center gap-2">
              <CampoNumero className={`${estiloEntrada} w-24! py-1.5!`} valor={editando} aoMudar={setEditando} inputMode="decimal" aria-label="Meta por refeição em reais" />
              <Botao className="py-1.5!" onClick={salvarMeta}>Salvar</Botao>
              <button className="text-sm text-stone-500" onClick={() => setEditando(undefined)}>Cancelar</button>
            </div>
          ) : (
            <div className="text-xl font-bold">
              {meta ? reais(meta) : 'sem meta'}
              {podeGerenciar(eu.nivel) && <button className="ml-2 text-sm font-semibold text-stone-500 underline" onClick={() => setEditando(meta)}>mudar</button>}
            </div>
          )}
        </div>
        <div>
          <div className="text-xs font-semibold tracking-wide text-stone-500 uppercase">Esta semana</div>
          <div className="text-xl font-bold">{atual.media != null ? reais(atual.media) : '—'} <span className="text-sm font-normal text-stone-500">por refeição · {atual.refeicoes} refeições</span></div>
        </div>
        {meta && (
          <div>
            <div className="text-xs font-semibold tracking-wide text-stone-500 uppercase">Folga nas últimas 4 semanas</div>
            <div className={`text-xl font-bold ${folga4 >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{folga4 >= 0 ? '' : '−'}{reais(Math.abs(folga4))}</div>
          </div>
        )}
      </div>
      {meta ? (
        <p className="text-sm text-stone-600">
          {folga4 > 0 ? `Sobrou ${reais(folga4)} do orçamento nas últimas 4 semanas: dá para colocar um prato mais caprichado no cardápio.` : folga4 < 0 ? `O custo passou ${reais(-folga4)} da meta nas últimas 4 semanas: vale escolher pratos mais em conta.` : 'Sem refeições com custo nas últimas semanas.'}
        </p>
      ) : <p className="text-sm text-stone-600">{podeGerenciar(eu.nivel) ? 'Defina uma meta de custo por refeição para o portal mostrar quando dá para caprichar.' : 'A gestão ainda não definiu a meta de custo por refeição.'}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-stone-500">
            <tr><th className="py-1 pr-2">Semana</th><th className="px-2 py-1 text-right">Refeições</th><th className="px-2 py-1 text-right">Custo</th><th className="px-2 py-1 text-right">Por refeição</th>{meta && <th className="px-2 py-1 text-right">Folga</th>}</tr>
          </thead>
          <tbody>
            {semanas.map((s) => (
              <tr key={s.inicio} className="border-t border-stone-100">
                <td className="py-1 pr-2 whitespace-nowrap">{dataCurta(s.inicio)} a {dataCurta(addDias(s.inicio, 6))}</td>
                <td className="px-2 py-1 text-right">{s.refeicoes || '—'}</td>
                <td className="px-2 py-1 text-right whitespace-nowrap">{s.refeicoes ? reais(s.custo) : '—'}</td>
                <td className={`px-2 py-1 text-right font-semibold whitespace-nowrap ${meta && s.media != null ? (s.media <= meta ? 'text-emerald-700' : 'text-red-700') : ''}`}>{s.media != null ? reais(s.media) : '—'}</td>
                {meta && <td className="px-2 py-1 text-right whitespace-nowrap">{s.folga != null ? `${s.folga < 0 ? '−' : ''}${reais(Math.abs(s.folga))}` : '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ——— Quem cozinha: montar a votação e ver o resultado ———

interface OpcaoEd { id?: string; nome: string; descricao: string; modeloId: string | null }
const sabadoQueVem = () => {
  const segunda = addDias(inicioDaSemana(hoje()), 7)
  return { semana: segunda, abreEm: addDias(segunda, -2), fechaEm: addDias(segunda, -1) }
}

export function VotacaoCozinha() {
  const { store, avisar } = useApp()
  const [votacoes, setVotacoes] = useState<VotacaoCardapio[] | null>(null)
  const [resultados, setResultados] = useState<Record<string, ResultadoVotacao[]>>({})
  const [modelos, setModelos] = useState<ModeloRefeicao[]>([])
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [meta, setMeta] = useState<number | null>(null)
  const [editando, setEditando] = useState<(Omit<VotacaoCardapio, 'opcoes' | 'id'> & { id?: string; opcoes: OpcaoEd[] }) | null>(null)
  const [salvando, setSalvando] = useState(false)
  const carregar = useCallback(async () => {
    try {
      const vs = await store.votacoesCardapio(addDias(hoje(), -60))
      const rs = await Promise.all(vs.map((v) => store.resultadoVotacao(v.id)))
      setVotacoes(vs)
      setResultados(Object.fromEntries(vs.map((v, i) => [v.id, rs[i]])))
    } catch (e) {
      avisar((e as Error).message)
    }
  }, [store, avisar])
  useEffect(() => {
    carregar()
    Promise.all([store.modelosRefeicao(), store.insumos(), store.metaRefeicao().catch(() => null)]).then(([m, i, mt]) => { setModelos(m); setInsumos(i); setMeta(mt) }, () => {})
  }, [store, carregar])

  // Custo estimado por pessoa do prato salvo, com o preço de hoje dos materiais.
  const custoModelo = useMemo(() => {
    const preco = new Map(insumos.map((i) => [i.id, i.preco]))
    return (id: string | null) => {
      const m = id ? modelos.find((x) => x.id === id) : undefined
      if (!m || !m.itens.length) return null
      return m.itens.reduce((t, i) => t + i.quantidade * ((i.insumoId && preco.get(i.insumoId)) || 0), 0)
    }
  }, [modelos, insumos])

  if (!votacoes) return <p className="text-stone-400">Carregando…</p>
  const novo = () => {
    const d = sabadoQueVem()
    if (votacoes.some((v) => v.semana === d.semana)) return avisar('Já existe votação para a semana que vem. Abra ela para editar.')
    setEditando({ ...d, maxEscolhas: 3, observacao: null, opcoes: [{ nome: '', descricao: '', modeloId: null }] })
  }
  const salvar = async () => {
    if (!editando) return
    const opcoes = editando.opcoes.filter((o) => o.nome.trim())
    if (opcoes.length < 2) return avisar('Coloque pelo menos 2 opções.')
    setSalvando(true)
    try {
      await store.salvarVotacao({ ...editando, opcoes: opcoes.map((o) => ({ id: o.id, nome: o.nome, descricao: o.descricao || null, modeloId: o.modeloId })) })
      setEditando(null)
      await carregar()
      avisar('Votação salva')
    } catch (e) {
      avisar((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }
  const excluir = async (v: VotacaoCardapio) => {
    if (!confirm('Excluir esta votação e os votos dela?')) return
    try {
      await store.excluirVotacao(v.id)
      await carregar()
    } catch (e) {
      avisar((e as Error).message)
    }
  }
  const selo = (c: number | null) => {
    if (c == null) return <span className="text-xs text-stone-400">sem custo</span>
    const cor = !meta ? 'text-stone-600' : c <= meta ? 'text-emerald-700' : c <= meta * 1.2 ? 'text-amber-700' : 'text-red-700'
    return <span className={`text-xs font-semibold whitespace-nowrap ${cor}`}>≈ {reais(c)}/pessoa</span>
  }

  if (editando) {
    const mudarOp = (k: number, x: Partial<OpcaoEd>) => setEditando({ ...editando, opcoes: editando.opcoes.map((o, j) => (j === k ? { ...o, ...x } : o)) })
    return (
      <div className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
        <h3 className="font-bold">{editando.id ? 'Editar votação' : 'Nova votação'}</h3>
        <div className="flex flex-wrap gap-3">
          <Campo rotulo="Semana que começa em (segunda)">
            <input type="date" className={`${estiloEntrada} w-auto!`} value={editando.semana} onChange={(e) => {
              const s = e.target.value && inicioDaSemana(e.target.value)
              if (s) setEditando({ ...editando, semana: s, abreEm: addDias(s, -2), fechaEm: addDias(s, -1) })
            }} />
          </Campo>
          <Campo rotulo="Abre em"><input type="date" className={`${estiloEntrada} w-auto!`} value={editando.abreEm} onChange={(e) => e.target.value && setEditando({ ...editando, abreEm: e.target.value })} /></Campo>
          <Campo rotulo="Fecha em (inclusive)"><input type="date" className={`${estiloEntrada} w-auto!`} value={editando.fechaEm} onChange={(e) => e.target.value && setEditando({ ...editando, fechaEm: e.target.value })} /></Campo>
          <Campo rotulo="Cada pessoa escolhe até">
            <select className={`${estiloEntrada} w-auto!`} value={editando.maxEscolhas} onChange={(e) => setEditando({ ...editando, maxEscolhas: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'prato' : 'pratos'}</option>)}
            </select>
          </Campo>
        </div>
        <Campo rotulo="Recado para a equipe (opcional)">
          <input className={estiloEntrada} value={editando.observacao ?? ''} onChange={(e) => setEditando({ ...editando, observacao: e.target.value })} />
        </Campo>
        <div>
          <div className="mb-1 text-sm font-medium text-stone-700">Opções</div>
          <p className="mb-2 text-xs text-stone-500">Escolha um prato já feito (o portal estima o custo por pessoa{meta ? `, meta ${reais(meta)}` : ''}) ou escreva um novo. Só você e a gestão veem o custo.</p>
          <datalist id="pratos-votacao">{modelos.filter((m) => m.ativo && m.tipo === 'prato').map((m) => <option key={m.id} value={m.nome} />)}</datalist>
          <div className="space-y-2">
            {editando.opcoes.map((o, k) => (
              <div key={k} className="flex flex-wrap items-center gap-2">
                <input className={`${estiloEntrada} min-w-48 flex-[2] py-1.5!`} list="pratos-votacao" placeholder="Prato" value={o.nome} aria-label="Prato"
                  onChange={(e) => {
                    const m = modelos.find((x) => x.nome.toLowerCase() === e.target.value.trim().toLowerCase())
                    mudarOp(k, { nome: e.target.value, modeloId: m?.id ?? null })
                  }} />
                <input className={`${estiloEntrada} min-w-40 flex-[2] py-1.5!`} placeholder="Detalhe (opcional)" value={o.descricao} onChange={(e) => mudarOp(k, { descricao: e.target.value })} aria-label="Detalhe" />
                <span className="w-32 text-right">{selo(custoModelo(o.modeloId))}</span>
                <button className="px-1 text-stone-400 hover:text-red-600" onClick={() => setEditando({ ...editando, opcoes: editando.opcoes.filter((_, j) => j !== k) })} aria-label="Tirar opção">✕</button>
              </div>
            ))}
          </div>
          <Botao variante="secundario" className="mt-2 py-1.5!" onClick={() => setEditando({ ...editando, opcoes: [...editando.opcoes, { nome: '', descricao: '', modeloId: null }] })}>+ Opção</Botao>
        </div>
        <div className="flex flex-wrap gap-2">
          <Botao disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
          <Botao variante="secundario" onClick={() => setEditando(null)}>Cancelar</Botao>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <OrcamentoRefeicoes />
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm text-stone-600">A votação abre no sábado para a semana seguinte. Cada pessoa escolhe os pratos que quer; o voto é anônimo. Você vê a parcial, e a equipe vê o resultado quando fecha.</p>
        <Botao onClick={novo}>+ Votação da semana que vem</Botao>
      </div>
      {votacoes.length === 0 ? <Vazio>Nenhuma votação ainda.</Vazio> : votacoes.map((v) => {
        const rs = resultados[v.id] ?? []
        const linhas = v.opcoes.map((o) => ({ ...o, votos: rs.find((r) => r.opcaoId === o.id)?.votos ?? 0, custo: custoModelo(o.modeloId) })).sort((a, b) => b.votos - a.votos)
        const max = Math.max(1, ...linhas.map((l) => l.votos))
        const estado = hoje() < v.abreEm ? <Selo cor="azul">Abre {dia(v.abreEm)}</Selo> : aberta(v) ? <Selo cor="verde">Aberta até {dia(v.fechaEm)}</Selo> : <Selo>Fechada</Selo>
        return (
          <div key={v.id} className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold">Semana de {dataCurta(v.semana)}</h3>
              {estado}
              <span className="text-sm text-stone-500">{rs[0]?.participantes ?? 0} pessoas votaram</span>
              <span className="ml-auto flex gap-2">
                <Botao variante="secundario" className="py-1!" onClick={() => setEditando({ ...v, opcoes: v.opcoes.map((o) => ({ id: o.id, nome: o.nome, descricao: o.descricao ?? '', modeloId: o.modeloId })) })}>Editar</Botao>
                <Botao variante="perigo" className="py-1!" onClick={() => excluir(v)}>Excluir</Botao>
              </span>
            </div>
            <ul className="space-y-1.5">
              {linhas.map((l) => (
                <li key={l.id} className="flex items-center gap-2 text-sm">
                  <span className="w-48 shrink-0 truncate font-semibold" title={l.descricao ?? ''}>{l.nome}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-100"><span className="block h-full rounded-full bg-ozzy-400" style={{ width: `${(l.votos / max) * 100}%` }} /></span>
                  <span className="w-8 text-right tabular-nums">{l.votos}</span>
                  <span className="w-28 text-right">{selo(l.custo)}</span>
                </li>
              ))}
            </ul>
            <button className="text-sm font-semibold text-stone-600 underline" onClick={() => ir('refeicoes/recados')}>Ver sugestões da equipe</button>
          </div>
        )
      })}
    </div>
  )
}
