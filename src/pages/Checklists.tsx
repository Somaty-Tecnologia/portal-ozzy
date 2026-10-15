import { useCallback, useEffect, useMemo, useState } from 'react'
import { Botao, Campo, Cartao, Modal, Selo, Titulo, Vazio, estiloEntrada } from '../components/ui'
import { useOrdem } from '../components/Ordenar'
import { useApp } from '../lib/contexto'
import { addDias, dataCurta, diaSemana, hoje } from '../lib/datas'
import { reduzirFoto } from '../lib/imagem'
import { podeGerenciar } from '../lib/permissoes'
import { ir } from '../lib/rota'
import {
  DIAS_SEMANA, META_BONUS, SITUACOES, VALOR_BONUS, conformeDe, efetividade, nomeDias, pct, respondido, situacao, type SituacaoChecklist,
} from '../lib/checklists'
import {
  FREQUENCIAS_CHECKLIST, MOMENTOS_CHECKLIST, SETORES, apelidoUnidade,
  type ExecucaoChecklist, type FrequenciaChecklist, type ItemChecklist, type ModeloChecklist, type MomentoChecklist, type RespostaChecklist, type Setor, type TipoItemChecklist,
} from '../lib/types'

// Checklists (Heitor, 15/10): no lugar do Konclui, que a equipe já usa. Mesma lógica: cada checklist tem loja, setor,
// momento, responsável, repetição e horário limite; a pessoa responde pelo celular (com foto quando pede) e finaliza.
// Pontualidade, esforço e qualidade viram o score; a média do mês é a efetividade (acima de 90% ganha R$ 100).


export const ABAS_CHECKLISTS = [
  { id: '', nome: 'Meus checklists' },
  { id: 'pontuacao', nome: 'Minha pontuação' },
  { id: 'painel', nome: 'Painel', gestao: true },
  { id: 'cadastro', nome: 'Cadastro', gestao: true },
]

const inicioDoMes = (d: string) => d.slice(0, 8) + '01'
const fimDoMes = (d: string) => {
  const [a, m] = d.split('-').map(Number)
  return `${d.slice(0, 8)}${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`
}
const horaSP = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const nomeSetor = (s: string | null) => SETORES.find((x) => x.valor === s)?.nome ?? '—'
const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const corScore = (n: number | null) => (n === null ? 'text-stone-400' : n > META_BONUS ? 'text-emerald-700' : n >= 75 ? 'text-amber-700' : 'text-red-700')

export default function Checklists({ sub, param }: { sub?: string; param?: string }) {
  const { eu } = useApp()
  const gestao = podeGerenciar(eu.nivel)
  if (sub === 'fazer' && param) return <FazerChecklist id={param} key={param} />
  const abas = ABAS_CHECKLISTS.filter((a) => gestao || !a.gestao)
  const aba = abas.some((a) => a.id && a.id === sub) ? sub! : ''
  return (
    <div className="space-y-4">
      <Titulo>Checklists</Titulo>
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-stone-200 p-1 text-sm font-semibold">
        {abas.map((a) => (
          <button key={a.id} onClick={() => ir('checklists' + (a.id ? '/' + a.id : ''))}
            className={`flex-1 shrink-0 rounded-lg px-3 py-2 whitespace-nowrap ${aba === a.id ? 'bg-white shadow-sm' : 'text-stone-600'}`}>{a.nome}</button>
        ))}
      </div>
      {aba === '' && <MeusChecklists />}
      {aba === 'pontuacao' && <Pontuacao pessoaId={param ?? eu.id} />}
      {aba === 'painel' && <Painel />}
      {aba === 'cadastro' && <Cadastro />}
    </div>
  )
}

function useModelos() {
  const { store, avisar } = useApp()
  const [modelos, setModelos] = useState<ModeloChecklist[] | null>(null)
  const carregar = useCallback(() => store.modelosChecklist().then(setModelos, (e) => avisar((e as Error).message)), [store, avisar])
  useEffect(() => { carregar() }, [carregar])
  const porId = useMemo(() => new Map((modelos ?? []).map((m) => [m.id!, m])), [modelos])
  return { modelos, porId, carregar }
}

function SeloSituacao({ s }: { s: SituacaoChecklist }) {
  return <span className="whitespace-nowrap"><Selo cor={SITUACOES[s].cor}>{SITUACOES[s].nome}</Selo></span>
}

// ——— Meus checklists (hoje) ———

function MeusChecklists() {
  const { store, eu, nomeDe, nomeUnidade, avisar } = useApp()
  const gestao = podeGerenciar(eu.nivel)
  const { porId } = useModelos()
  const [todos, setTodos] = useState(false)
  const [execs, setExecs] = useState<ExecucaoChecklist[] | null>(null)
  const [mes, setMes] = useState<ExecucaoChecklist[]>([])
  useEffect(() => {
    store.execucoesChecklist(hoje(), hoje(), todos ? null : eu.id).then(setExecs, (e) => avisar((e as Error).message))
  }, [store, eu.id, todos, avisar])
  useEffect(() => {
    store.execucoesChecklist(inicioDoMes(hoje()), hoje(), eu.id).then(setMes, () => setMes([]))
  }, [store, eu.id])
  const ef = efetividade(mes)
  const lista = (execs ?? []).filter((e) => porId.has(e.modeloId))

  return (
    <div className="space-y-3">
      {ef && (
        <Cartao className="flex flex-wrap items-center gap-3" onClick={() => ir('checklists/pontuacao')}>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-stone-500 uppercase">Sua pontuação no mês</div>
            <div className={`text-2xl font-extrabold ${corScore(ef.score)}`}>{pct(ef.score)}</div>
          </div>
          <div className="text-right text-sm text-stone-600">
            {ef.score > META_BONUS ? <>Acima de {META_BONUS}%: <b>bônus de R$ {VALOR_BONUS}</b> se fechar o mês assim</> : <>Falta {Math.ceil(META_BONUS - ef.score + 0.1)} ponto(s) para o bônus de R$ {VALOR_BONUS}</>}
            <div className="text-xs text-stone-400">ver detalhes ›</div>
          </div>
        </Cartao>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Hoje, {diaSemana(hoje()).toLowerCase()} {dataCurta(hoje())}</h2>
        {gestao && (
          <div className="flex gap-1 rounded-lg bg-stone-200 p-0.5 text-sm font-semibold">
            <button className={`rounded-md px-3 py-1 ${!todos ? 'bg-white shadow-sm' : 'text-stone-600'}`} onClick={() => setTodos(false)}>Meus</button>
            <button className={`rounded-md px-3 py-1 ${todos ? 'bg-white shadow-sm' : 'text-stone-600'}`} onClick={() => setTodos(true)}>De todos</button>
          </div>
        )}
      </div>
      {!execs ? <p className="text-stone-400">Carregando…</p> : lista.length === 0 ? (
        <Vazio>{todos ? 'Nenhum checklist para hoje.' : 'Você não tem checklist para hoje.'}</Vazio>
      ) : (
        <div className="space-y-2">
          {lista.map((e) => {
            const m = porId.get(e.modeloId)!
            const s = situacao(e)
            return (
              <Cartao key={e.id} className="flex items-center gap-3" onClick={() => ir('checklists/fazer/' + e.id)}>
                <div className={`size-3 shrink-0 rounded-full ${s === 'finalizado' ? 'bg-emerald-500' : s === 'atrasado' ? 'bg-red-500' : s === 'iniciado' ? 'bg-sky-500' : 'bg-stone-300'}`} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{m.titulo}</div>
                  <div className="text-xs text-stone-500">
                    {apelidoUnidade(nomeUnidade(m.unidadeId))} · {nomeSetor(m.setor)} · {MOMENTOS_CHECKLIST[m.momento]} · até {horaSP(e.prazo)}
                    {todos && ` · ${nomeDe(e.responsavelId) || 'sem responsável'}`}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <SeloSituacao s={s} />
                  {e.score !== null && <span className={`text-sm font-bold ${corScore(e.score)}`}>{pct(e.score)}</span>}
                </div>
              </Cartao>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Card na Início: o que falta hoje e a pontuação do mês.
export function ChecklistsInicio() {
  const { store, eu } = useApp()
  const gestao = podeGerenciar(eu.nivel)
  const [hojeExecs, setHoje] = useState<ExecucaoChecklist[] | null>(null)
  const [mes, setMes] = useState<ExecucaoChecklist[]>([])
  useEffect(() => {
    store.execucoesChecklist(hoje(), hoje(), gestao ? null : eu.id).then(setHoje, () => setHoje([]))
    if (!gestao) store.execucoesChecklist(inicioDoMes(hoje()), hoje(), eu.id).then(setMes, () => setMes([]))
  }, [store, eu.id, gestao])
  if (!hojeExecs) return null
  const sit = hojeExecs.map((e) => situacao(e))
  const falta = sit.filter((s) => s !== 'finalizado').length
  const atrasados = sit.filter((s) => s === 'atrasado').length
  const ef = efetividade(mes)
  if (!hojeExecs.length && !ef) return null
  return (
    <Cartao className="space-y-1" onClick={() => ir(gestao ? 'checklists/painel' : 'checklists')}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-stone-500 uppercase">Checklists de hoje</div>
        {ef && <span className={`text-sm font-bold ${corScore(ef.score)}`}>Mês: {pct(ef.score)}</span>}
      </div>
      <div className="font-semibold">
        {!hojeExecs.length ? 'Nenhum para hoje' : falta === 0 ? `Todos os ${hojeExecs.length} finalizados ✓` : `${falta} de ${hojeExecs.length} para fazer`}
        {atrasados > 0 && <span className="text-red-700"> · {atrasados} atrasado{atrasados > 1 ? 's' : ''}</span>}
      </div>
      {ef && !gestao && <div className="text-xs text-stone-500">{ef.score > META_BONUS ? `Acima de ${META_BONUS}%: bônus de R$ ${VALOR_BONUS} no fim do mês` : `Bônus de R$ ${VALOR_BONUS} a partir de ${META_BONUS}%`}</div>}
    </Cartao>
  )
}

// ——— Fazer o checklist ———

function FazerChecklist({ id }: { id: string }) {
  const { store, eu, equipe, nomeDe, nomeUnidade, avisar } = useApp()
  const gestao = podeGerenciar(eu.nivel)
  const { porId } = useModelos()
  const [e, setE] = useState<ExecucaoChecklist | null | undefined>(undefined)
  const [resp, setResp] = useState<RespostaChecklist[]>([])
  const [salvando, setSalvando] = useState<string | null>(null)
  const [finalizando, setFinalizando] = useState(false)
  const [trocar, setTrocar] = useState(false)
  const carregar = useCallback(async () => {
    const [x, r] = await Promise.all([store.execucaoChecklist(id), store.respostasChecklist(id)])
    setE(x)
    setResp(r)
  }, [store, id])
  useEffect(() => { carregar().catch((err) => avisar((err as Error).message)) }, [carregar, avisar])

  const m = e ? porId.get(e.modeloId) : undefined
  if (e === undefined || (e && !m)) return <p className="text-stone-400">Carregando…</p>
  if (!e || !m) return <Vazio>Checklist não encontrado.</Vazio>
  const s = situacao(e)
  const meu = e.responsavelId === eu.id
  const podeResponder = !e.finalizadoEm && (meu || gestao) && s !== 'nao_executado'
  const porItem = new Map(resp.map((r) => [r.itemId, r]))
  const itens = m.itens.filter((i) => i.ativo || porItem.has(i.id!))
  const obrig = itens.filter((i) => i.obrigatorio)
  const feitos = obrig.filter((i) => respondido(i, porItem.get(i.id!))).length

  const responder = async (i: ItemChecklist, mudanca: { valor?: string | null; observacao?: string | null; foto?: File | null }) => {
    const antes = porItem.get(i.id!)
    const valor = mudanca.valor !== undefined ? mudanca.valor : antes?.valor ?? null
    const observacao = mudanca.observacao !== undefined ? mudanca.observacao : antes?.observacao ?? null
    setSalvando(i.id!)
    try {
      const foto = mudanca.foto ? await reduzirFoto(mudanca.foto) : null
      await store.responderChecklist(e.id, i.id!, { valor, observacao, foto })
      setResp(await store.respostasChecklist(e.id))
      if (!e.iniciadoEm) setE({ ...e, iniciadoEm: new Date().toISOString() })
    } catch (err) {
      avisar((err as Error).message)
    } finally {
      setSalvando(null)
    }
  }
  const finalizar = async () => {
    const faltam = obrig.length - feitos
    if (faltam > 0 && !confirm(`Faltam ${faltam} ${faltam === 1 ? 'item obrigatório' : 'itens obrigatórios'} (ou a foto deles). Finalizar assim baixa o esforço. Finalizar mesmo assim?`)) return
    setFinalizando(true)
    try {
      setE(await store.finalizarChecklist(e.id))
      avisar('Checklist finalizado')
    } catch (err) {
      avisar((err as Error).message)
    } finally {
      setFinalizando(false)
    }
  }

  return (
    <div className="space-y-3 pb-24">
      <button className="text-sm text-stone-500" onClick={() => ir('checklists')}>← Checklists</button>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">{m.titulo}</h1>
          <p className="text-sm text-stone-500">
            {apelidoUnidade(nomeUnidade(m.unidadeId))} · {nomeSetor(m.setor)} · {MOMENTOS_CHECKLIST[m.momento]} · {diaSemana(e.data)} {dataCurta(e.data)} até {horaSP(e.prazo)}
          </p>
          <p className="text-sm text-stone-500">Responsável: {nomeDe(e.responsavelId) || '—'}</p>
        </div>
        <SeloSituacao s={s} />
      </div>

      {e.finalizadoEm && (
        <Cartao className="grid grid-cols-4 gap-2 text-center">
          {([['Score', e.score], ['Pontualidade', e.pontualidade], ['Esforço', e.esforco], ['Qualidade', e.qualidade]] as const).map(([n, v]) => (
            <div key={n}>
              <div className="text-xs text-stone-500">{n}</div>
              <div className={`text-lg font-extrabold ${corScore(v)}`}>{pct(v)}</div>
            </div>
          ))}
          <p className="col-span-4 text-xs text-stone-500">Finalizado às {horaSP(e.finalizadoEm)}</p>
        </Cartao>
      )}
      {s === 'nao_executado' && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">O dia passou e este checklist não foi finalizado. Conta 0 na pontuação.</p>}
      {s === 'atrasado' && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Passou do horário. Ainda dá para fazer, mas a pontualidade cai a cada minuto.</p>}

      <div className="space-y-2">
        {itens.map((i, k) => (
          <ItemFazer key={i.id} n={k + 1} i={i} r={porItem.get(i.id!)} pode={podeResponder} salvando={salvando === i.id} aoResponder={(x) => responder(i, x)} />
        ))}
      </div>

      {gestao && (
        <div className="flex flex-wrap gap-2">
          {e.finalizadoEm && <Botao variante="secundario" onClick={async () => { await store.reabrirChecklist(e.id); await carregar(); avisar('Checklist reaberto') }}>Reabrir</Botao>}
          {!e.finalizadoEm && <Botao variante="secundario" onClick={() => setTrocar(true)}>Trocar responsável</Botao>}
        </div>
      )}

      {podeResponder && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 p-3 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{feitos} de {obrig.length} obrigatórios</div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-200"><div className="h-full bg-emerald-500" style={{ width: `${obrig.length ? (100 * feitos) / obrig.length : 100}%` }} /></div>
            </div>
            <Botao disabled={finalizando || !!salvando} onClick={finalizar}>{finalizando ? 'Finalizando…' : 'Finalizar'}</Botao>
          </div>
        </div>
      )}

      {trocar && (
        <Modal titulo="Trocar responsável" aberto aoFechar={() => setTrocar(false)}>
          <div className="space-y-2">
            <p className="text-sm text-stone-600">Só para hoje. Para mudar sempre, edite o checklist no Cadastro.</p>
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {equipe.filter((f) => f.status === 'ativo').sort((a, b) => a.nome.localeCompare(b.nome)).map((f) => (
                <button key={f.id} className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-stone-100 ${f.unidadeId === m.unidadeId ? 'font-semibold' : 'text-stone-500'}`}
                  onClick={async () => { await store.trocarResponsavelChecklist(e.id, f.id); setTrocar(false); await carregar(); avisar('Responsável trocado') }}>
                  {f.nome} <span className="text-xs font-normal text-stone-400">{apelidoUnidade(nomeUnidade(f.unidadeId))}</span>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function ItemFazer({ n, i, r, pode, salvando, aoResponder }: {
  n: number; i: ItemChecklist; r?: RespostaChecklist; pode: boolean; salvando: boolean
  aoResponder: (x: { valor?: string | null; observacao?: string | null; foto?: File | null }) => void
}) {
  const { store } = useApp()
  const [valor, setValor] = useState(r?.valor ?? '')
  const [obs, setObs] = useState(r?.observacao ?? '')
  const [verObs, setVerObs] = useState(!!r?.observacao)
  const [foto, setFoto] = useState<string | null>(null)
  useEffect(() => { setValor(r?.valor ?? ''); setObs(r?.observacao ?? '') }, [r?.valor, r?.observacao])
  useEffect(() => {
    if (r?.foto) store.fotoChecklist(r.foto).then(setFoto)
  }, [store, r?.foto])
  const ok = respondido(i, r)
  const conf = r ? conformeDe(i, r.valor) : null
  const faixa = i.tipo === 'numero' && (i.minimo !== null || i.maximo !== null)
    ? i.minimo !== null && i.maximo !== null ? `entre ${i.minimo} e ${i.maximo}` : i.minimo !== null ? `mínimo ${i.minimo}` : `máximo ${i.maximo}`
    : null
  const botao = (v: string, rotulo: string, cor: string) => (
    <button disabled={!pode || salvando} onClick={() => { aoResponder({ valor: valor === v ? null : v }); if (v === 'nok') setVerObs(true) }}
      className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-bold ring-1 transition disabled:opacity-60 ${valor === v ? cor : 'bg-white text-stone-600 ring-stone-300'}`}>{rotulo}</button>
  )
  return (
    <Cartao className={`space-y-2 ${ok ? 'ring-emerald-200' : ''}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${ok ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-600'}`}>{ok ? '✓' : n}</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{i.texto}</p>
          <div className="flex flex-wrap gap-1 text-xs text-stone-500">
            {i.exigeFoto && <span className={r?.foto ? 'text-emerald-700' : 'font-semibold text-amber-700'}>📷 foto obrigatória</span>}
            {!i.obrigatorio && <span>opcional</span>}
            {faixa && <span>· {faixa}</span>}
            {i.instrucao && <span>· {i.instrucao}</span>}
          </div>
        </div>
        {salvando && <span className="text-xs text-stone-400">salvando…</span>}
      </div>
      {i.tipo === 'check' && (
        <div className="flex gap-2">
          {botao('ok', 'OK', 'bg-emerald-500 text-white ring-emerald-500')}
          {botao('nok', 'Não OK', 'bg-red-500 text-white ring-red-500')}
          {botao('na', 'N/A', 'bg-stone-600 text-white ring-stone-600')}
        </div>
      )}
      {i.tipo === 'numero' && (
        <div className="flex items-center gap-2">
          <input inputMode="decimal" disabled={!pode} className={`${estiloEntrada} w-32!`} value={valor} placeholder="Valor" aria-label={`Valor de ${i.texto}`}
            onChange={(ev) => setValor(ev.target.value)} onBlur={() => valor !== (r?.valor ?? '') && aoResponder({ valor })} />
          {conf === false && <Selo cor="vermelho">Fora da faixa</Selo>}
          {conf === true && <Selo cor="verde">Dentro da faixa</Selo>}
        </div>
      )}
      {i.tipo === 'texto' && (
        <textarea disabled={!pode} rows={2} className={estiloEntrada} value={valor} placeholder="Escreva aqui" aria-label={i.texto}
          onChange={(ev) => setValor(ev.target.value)} onBlur={() => valor !== (r?.valor ?? '') && aoResponder({ valor })} />
      )}
      <div className="flex flex-wrap items-center gap-3">
        {foto && <a href={foto} target="_blank" rel="noreferrer"><img src={foto} alt="Foto do item" className="size-16 rounded-lg object-cover ring-1 ring-stone-200" /></a>}
        {pode && (
          <label className={`cursor-pointer rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${i.exigeFoto && !r?.foto ? 'bg-ozzy-400 ring-ozzy-400' : 'bg-white ring-stone-300'}`}>
            📷 {r?.foto ? 'Trocar foto' : 'Foto'}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(ev) => { const f = ev.target.files?.[0]; if (f) aoResponder({ foto: f }); ev.target.value = '' }} />
          </label>
        )}
        {pode && !verObs && <button className="text-sm text-stone-500 underline" onClick={() => setVerObs(true)}>+ observação</button>}
      </div>
      {(verObs || (!pode && r?.observacao)) && (
        <textarea disabled={!pode} rows={2} className={estiloEntrada} value={obs} placeholder={conf === false ? 'O que aconteceu? O que você fez?' : 'Observação'} aria-label={`Observação de ${i.texto}`}
          onChange={(ev) => setObs(ev.target.value)} onBlur={() => obs !== (r?.observacao ?? '') && aoResponder({ observacao: obs })} />
      )}
    </Cartao>
  )
}

// ——— Minha pontuação ———

function Pontuacao({ pessoaId }: { pessoaId: string }) {
  const { store, eu, nomeDe, avisar } = useApp()
  const { porId } = useModelos()
  const [mes, setMes] = useState(inicioDoMes(hoje()))
  const [execs, setExecs] = useState<ExecucaoChecklist[] | null>(null)
  useEffect(() => {
    setExecs(null)
    store.execucoesChecklist(mes, fimDoMes(mes), pessoaId).then(setExecs, (e) => avisar((e as Error).message))
  }, [store, mes, pessoaId, avisar])
  const ef = execs ? efetividade(execs) : null
  const meses = [0, 1, 2].map((k) => {
    const d = new Date(Number(hoje().slice(0, 4)), Number(hoje().slice(5, 7)) - 1 - k, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const nomeMes = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const passados = (execs ?? []).filter((e) => e.data <= hoje()).reverse()

  return (
    <div className="space-y-3">
      {pessoaId !== eu.id && <p className="font-semibold">{nomeDe(pessoaId)}</p>}
      <select className={`${estiloEntrada} w-auto!`} value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mês">
        {meses.map((m) => <option key={m} value={m}>{nomeMes(m)}</option>)}
      </select>
      {!execs ? <p className="text-stone-400">Carregando…</p> : !ef ? <Vazio>Nenhum checklist contado neste mês ainda.</Vazio> : (
        <>
          <Cartao className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-stone-500 uppercase">Efetividade</div>
                <div className={`text-4xl font-extrabold ${corScore(ef.score)}`}>{pct(ef.score)}</div>
              </div>
              <div className={`rounded-xl px-3 py-2 text-sm font-semibold ${ef.score > META_BONUS ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-700'}`}>
                {ef.score > META_BONUS ? `Bônus de R$ ${VALOR_BONUS}${mes === inicioDoMes(hoje()) ? ' se fechar o mês assim' : ' ganho'} 🎉` : `Bônus de R$ ${VALOR_BONUS} acima de ${META_BONUS}%`}
              </div>
            </div>
            <div className="relative h-3 overflow-hidden rounded-full bg-stone-200">
              <div className={`h-full ${ef.score > META_BONUS ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, ef.score)}%` }} />
              <div className="absolute inset-y-0 w-0.5 bg-carvao" style={{ left: `${META_BONUS}%` }} title={`Meta ${META_BONUS}%`} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              {([['Pontualidade', ef.pontualidade, 'terminar no horário'], ['Esforço', ef.esforco, 'responder tudo, com as fotos'], ['Qualidade', ef.qualidade, 'itens OK e dentro da faixa']] as const).map(([n, v, d]) => (
                <div key={n} className="rounded-xl bg-stone-50 p-2">
                  <div className="text-xs text-stone-500">{n}</div>
                  <div className={`text-lg font-bold ${corScore(v)}`}>{pct(v)}</div>
                  <div className="text-[11px] text-stone-400">{d}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-stone-500">{ef.finalizados} de {ef.contam} checklists finalizados. Checklist não feito conta 0. Os de hoje que ainda estão abertos só contam depois.</p>
          </Cartao>
          <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
            {passados.map((e) => {
              const m = porId.get(e.modeloId)
              const s = situacao(e)
              return (
                <button key={e.id} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-stone-50" onClick={() => ir('checklists/fazer/' + e.id)}>
                  <span className="w-20 shrink-0 text-xs text-stone-500">{diaSemana(e.data).slice(0, 3)} {dataCurta(e.data)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{m?.titulo ?? '—'}</span>
                  <SeloSituacao s={s} />
                  <span className={`w-12 text-right text-sm font-bold ${corScore(e.finalizadoEm ? e.score : s === 'nao_executado' ? 0 : null)}`}>{e.finalizadoEm ? pct(e.score) : s === 'nao_executado' ? '0%' : '—'}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ——— Painel (gestão) ———

const PERIODOS = [
  { id: 'hoje', nome: 'Hoje' }, { id: '7', nome: '7 dias' }, { id: '30', nome: '30 dias' }, { id: 'mes', nome: 'Este mês' }, { id: 'mesAnt', nome: 'Mês passado' },
] as const

function Painel() {
  const { store, unidades, nomeDe, nomeUnidade, avisar } = useApp()
  const { porId } = useModelos()
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]['id']>('mes')
  const [unidade, setUnidade] = useState('')
  const [setor, setSetor] = useState('')
  const [filtroSit, setFiltroSit] = useState<SituacaoChecklist | ''>('')
  const [execs, setExecs] = useState<ExecucaoChecklist[] | null>(null)
  const [de, ate] = useMemo((): [string, string] => {
    const h = hoje()
    if (periodo === 'hoje') return [h, h]
    if (periodo === '7') return [addDias(h, -6), h]
    if (periodo === '30') return [addDias(h, -29), h]
    if (periodo === 'mes') return [inicioDoMes(h), h]
    const ant = addDias(inicioDoMes(h), -1)
    return [inicioDoMes(ant), ant]
  }, [periodo])
  useEffect(() => {
    setExecs(null)
    store.execucoesChecklist(de, ate, null).then(setExecs, (e) => avisar((e as Error).message))
  }, [store, de, ate, avisar])

  const agora = new Date()
  const linhas = useMemo(() => (execs ?? []).filter((e) => {
    const m = porId.get(e.modeloId)
    return m && (!unidade || m.unidadeId === unidade) && (!setor || m.setor === setor)
  }).map((e) => ({ e, m: porId.get(e.modeloId)!, s: situacao(e, agora) })), [execs, porId, unidade, setor]) // eslint-disable-line react-hooks/exhaustive-deps

  const conta = (s: SituacaoChecklist) => linhas.filter((l) => l.s === s).length
  const vencidos = linhas.filter((l) => l.s === 'finalizado' || l.s === 'nao_executado')
  const taxa = vencidos.length ? (100 * conta('finalizado')) / vencidos.length : null
  const geral = efetividade(linhas.map((l) => l.e), agora)
  const ranking = (chave: (l: (typeof linhas)[number]) => string | null) => {
    const grupos = new Map<string, ExecucaoChecklist[]>()
    for (const l of linhas) {
      const k = chave(l)
      if (!k) continue
      grupos.set(k, [...(grupos.get(k) ?? []), l.e])
    }
    return [...grupos].map(([k, es]) => ({ k, ef: efetividade(es, agora) })).filter((x) => x.ef).sort((a, b) => b.ef!.score - a.ef!.score)
  }
  const porPessoa = ranking((l) => l.e.responsavelId)
  const porUnidade = ranking((l) => l.m.unidadeId)
  const porSetor = ranking((l) => l.m.setor)
  const mesFechado = periodo === 'mes' || periodo === 'mesAnt'
  const detalhe = linhas.filter((l) => !filtroSit || l.s === filtroSit)
  const { ordenada, cabecalho } = useOrdem(detalhe, {
    data: (l) => l.e.prazo, titulo: (l) => l.m.titulo, unidade: (l) => apelidoUnidade(nomeUnidade(l.m.unidadeId)), setor: (l) => nomeSetor(l.m.setor),
    momento: (l) => MOMENTOS_CHECKLIST[l.m.momento], pessoa: (l) => nomeDe(l.e.responsavelId), situacao: (l) => SITUACOES[l.s].nome,
    pont: (l) => l.e.pontualidade, esf: (l) => l.e.esforco, qual: (l) => l.e.qualidade, score: (l) => l.e.score,
  }, { col: 'data', desc: true })
  const [ver, setVer] = useState(30)

  const Ranking = ({ titulo, itens, nome, bonus, abrir }: { titulo: string; itens: typeof porPessoa; nome: (k: string) => string; bonus?: boolean; abrir?: (k: string) => void }) => (
    <Cartao className="space-y-2">
      <h3 className="font-semibold">{titulo}</h3>
      {itens.length === 0 ? <p className="text-sm text-stone-400">Sem dados</p> : (
        <ol className="space-y-1 text-sm">
          {itens.map((x, k) => (
            <li key={x.k} className="flex items-center gap-2">
              <span className="w-5 text-right text-xs text-stone-400">{k + 1}</span>
              {abrir ? <button className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => abrir(x.k)}>{nome(x.k)}</button> : <span className="min-w-0 flex-1 truncate">{nome(x.k)}</span>}
              {bonus && mesFechado && x.ef!.score > META_BONUS && <span title={`Bônus de R$ ${VALOR_BONUS}`}>💰</span>}
              <span className={`w-12 text-right font-bold ${corScore(x.ef!.score)}`}>{pct(x.ef!.score)}</span>
            </li>
          ))}
        </ol>
      )}
    </Cartao>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-stone-200 p-0.5 text-sm font-semibold">
          {PERIODOS.map((p) => (
            <button key={p.id} className={`rounded-md px-3 py-1 whitespace-nowrap ${periodo === p.id ? 'bg-white shadow-sm' : 'text-stone-600'}`} onClick={() => setPeriodo(p.id)}>{p.nome}</button>
          ))}
        </div>
        <select className={`${estiloEntrada} w-auto! py-1.5!`} value={unidade} onChange={(e) => setUnidade(e.target.value)} aria-label="Loja">
          <option value="">Todas as lojas</option>
          {unidades.map((u) => <option key={u.id} value={u.id}>{apelidoUnidade(u.nome)}</option>)}
        </select>
        <select className={`${estiloEntrada} w-auto! py-1.5!`} value={setor} onChange={(e) => setSetor(e.target.value)} aria-label="Setor">
          <option value="">Todos os setores</option>
          {SETORES.map((s) => <option key={s.valor} value={s.valor}>{s.nome}</option>)}
        </select>
      </div>
      {!execs ? <p className="text-stone-400">Carregando…</p> : (
        <>
          <div className="text-sm text-stone-500"><b className="text-2xl text-carvao">{linhas.length}</b> checklists no período</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(Object.keys(SITUACOES) as SituacaoChecklist[]).map((s) => (
              <button key={s} onClick={() => setFiltroSit(filtroSit === s ? '' : s)}
                className={`rounded-2xl bg-white p-3 text-left ring-1 ${filtroSit === s ? 'ring-2 ring-carvao' : 'ring-stone-200'}`}>
                <SeloSituacao s={s} />
                <div className="mt-1 text-2xl font-extrabold">{conta(s)}</div>
                <div className="text-xs text-stone-500">{linhas.length ? Math.round((100 * conta(s)) / linhas.length) : 0}% do total</div>
              </button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Cartao className="space-y-2">
              <h3 className="font-semibold">Taxa de conclusão</h3>
              <div className={`text-4xl font-extrabold ${corScore(taxa)}`}>{pct(taxa)}</div>
              <p className="text-xs text-stone-500">Finalizados entre os que já venceram (o dia acabou ou foram feitos).</p>
              {geral && (
                <div className="grid grid-cols-2 gap-1 text-sm">
                  <span className="text-stone-500">Score</span><b className={corScore(geral.score)}>{pct(geral.score)}</b>
                  <span className="text-stone-500">Pontualidade</span><b>{pct(geral.pontualidade)}</b>
                  <span className="text-stone-500">Esforço</span><b>{pct(geral.esforco)}</b>
                  <span className="text-stone-500">Qualidade</span><b>{pct(geral.qualidade)}</b>
                </div>
              )}
            </Cartao>
            <Ranking titulo="Ranking por pessoa" itens={porPessoa} nome={(k) => nomeDe(k)} bonus abrir={(k) => ir('checklists/pontuacao/' + k)} />
            <Ranking titulo="Ranking por loja" itens={porUnidade} nome={(k) => apelidoUnidade(nomeUnidade(k))} />
            <Ranking titulo="Ranking por setor" itens={porSetor} nome={nomeSetor} />
          </div>
          {mesFechado && (
            <p className="text-sm text-stone-600">
              💰 Bônus de R$ {VALOR_BONUS} ({periodo === 'mes' ? 'até agora' : 'mês fechado'}): {porPessoa.filter((x) => x.ef!.score > META_BONUS).map((x) => nomeDe(x.k)).join(', ') || 'ninguém acima de ' + META_BONUS + '%'}
            </p>
          )}
          <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs text-stone-500">
                <tr>
                  {cabecalho('data', 'Data')}
                  {cabecalho('titulo', 'Checklist')}
                  {cabecalho('unidade', 'Loja', 'hidden md:table-cell')}
                  {cabecalho('setor', 'Setor', 'hidden lg:table-cell')}
                  {cabecalho('momento', 'Momento', 'hidden lg:table-cell')}
                  {cabecalho('pessoa', 'Responsável', 'hidden sm:table-cell')}
                  {cabecalho('situacao', 'Situação')}
                  {cabecalho('pont', 'Pont.', 'hidden xl:table-cell text-right', true)}
                  {cabecalho('esf', 'Esforço', 'hidden xl:table-cell text-right', true)}
                  {cabecalho('qual', 'Qualid.', 'hidden xl:table-cell text-right', true)}
                  {cabecalho('score', 'Score', 'text-right', true)}
                </tr>
              </thead>
              <tbody>
                {ordenada.slice(0, ver).map(({ e, m, s }) => (
                  <tr key={e.id} className="cursor-pointer border-t border-stone-100 hover:bg-stone-50" onClick={() => ir('checklists/fazer/' + e.id)}>
                    <td className="px-3 py-2 whitespace-nowrap">{dataCurta(e.data)} <span className="text-xs text-stone-400">{horaSP(e.prazo)}</span></td>
                    <td className="px-3 py-2 font-medium">{m.titulo}<div className="text-xs font-normal text-stone-500 sm:hidden">{nomeDe(e.responsavelId)}</div></td>
                    <td className="hidden px-3 py-2 md:table-cell">{apelidoUnidade(nomeUnidade(m.unidadeId))}</td>
                    <td className="hidden px-3 py-2 lg:table-cell">{nomeSetor(m.setor)}</td>
                    <td className="hidden px-3 py-2 lg:table-cell">{MOMENTOS_CHECKLIST[m.momento]}</td>
                    <td className="hidden px-3 py-2 sm:table-cell">{nomeDe(e.responsavelId) || '—'}</td>
                    <td className="px-3 py-2"><SeloSituacao s={s} /></td>
                    <td className="hidden px-3 py-2 text-right xl:table-cell">{pct(e.pontualidade)}</td>
                    <td className="hidden px-3 py-2 text-right xl:table-cell">{pct(e.esforco)}</td>
                    <td className="hidden px-3 py-2 text-right xl:table-cell">{pct(e.qualidade)}</td>
                    <td className={`px-3 py-2 text-right font-bold ${corScore(e.score)}`}>{pct(e.score)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ordenada.length > ver && <button className="w-full border-t border-stone-100 py-2 text-sm font-semibold" onClick={() => setVer(ver + 50)}>Mostrar mais ({ordenada.length - ver})</button>}
          </div>
        </>
      )}
    </div>
  )
}

// ——— Cadastro (gestão) ———

const modeloVazio = (): ModeloChecklist => ({
  titulo: '', unidadeId: 'burger-psd', setor: 'cozinha', momento: 'abertura', frequencia: 'diaria', diasSemana: [0, 1, 2, 3, 4, 5, 6], diaMes: null,
  horario: '18:00', toleranciaMin: 15, responsavelId: null, ativo: true, itens: [],
})
const itemVazio = (texto = ''): ItemChecklist => ({ ordem: 0, texto, tipo: 'check', exigeFoto: false, obrigatorio: true, minimo: null, maximo: null, instrucao: null, ativo: true })

function Cadastro() {
  const { unidades, nomeDe, nomeUnidade } = useApp()
  const { modelos, carregar } = useModelos()
  const [busca, setBusca] = useState('')
  const [unidade, setUnidade] = useState('')
  const [status, setStatus] = useState<'ativos' | 'inativos' | ''>('ativos')
  const [editando, setEditando] = useState<ModeloChecklist | null>(null)
  const t = sem(busca.trim())
  const lista = (modelos ?? []).filter((m) => (!unidade || m.unidadeId === unidade) && (!status || m.ativo === (status === 'ativos'))
    && (!t || sem(`${m.titulo} ${nomeDe(m.responsavelId)} ${nomeUnidade(m.unidadeId)}`).includes(t)))
  const { ordenada, cabecalho } = useOrdem(lista, {
    titulo: (m) => m.titulo, freq: (m) => FREQUENCIAS_CHECKLIST[m.frequencia], horario: (m) => m.horario, pessoa: (m) => nomeDe(m.responsavelId),
    setor: (m) => nomeSetor(m.setor), momento: (m) => MOMENTOS_CHECKLIST[m.momento], itens: (m) => m.itens.filter((i) => i.ativo).length,
  }, { col: 'titulo' })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${estiloEntrada} max-w-xs`} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por título, responsável ou loja" aria-label="Buscar checklist" />
        <select className={`${estiloEntrada} w-auto!`} value={unidade} onChange={(e) => setUnidade(e.target.value)} aria-label="Loja">
          <option value="">Todas as lojas</option>
          {unidades.map((u) => <option key={u.id} value={u.id}>{apelidoUnidade(u.nome)}</option>)}
        </select>
        <select className={`${estiloEntrada} w-auto!`} value={status} onChange={(e) => setStatus(e.target.value as never)} aria-label="Status">
          <option value="ativos">Ativos</option><option value="inativos">Inativos</option><option value="">Todos</option>
        </select>
        <div className="flex-1" />
        <Botao onClick={() => setEditando(modeloVazio())}>+ Novo checklist</Botao>
      </div>
      <p className="text-sm text-stone-500">{lista.length} {lista.length === 1 ? 'checklist' : 'checklists'}</p>
      {!modelos ? <p className="text-stone-400">Carregando…</p> : lista.length === 0 ? <Vazio>Nenhum checklist. Crie o primeiro em "+ Novo checklist".</Vazio> : (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs text-stone-500">
              <tr>
                {cabecalho('titulo', 'Checklist')}
                {cabecalho('freq', 'Execução', 'hidden sm:table-cell')}
                {cabecalho('horario', 'Horário')}
                {cabecalho('pessoa', 'Responsável', 'hidden md:table-cell')}
                {cabecalho('setor', 'Setor', 'hidden lg:table-cell')}
                {cabecalho('momento', 'Momento', 'hidden lg:table-cell')}
                {cabecalho('itens', 'Itens', 'text-right', true)}
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {ordenada.map((m) => (
                <tr key={m.id} className="cursor-pointer border-t border-stone-100 hover:bg-stone-50" onClick={() => setEditando(structuredClone(m))}>
                  <td className="px-3 py-2"><div className="font-semibold">{m.titulo}</div><div className="text-xs text-stone-500">{apelidoUnidade(nomeUnidade(m.unidadeId))}</div></td>
                  <td className="hidden px-3 py-2 sm:table-cell">{FREQUENCIAS_CHECKLIST[m.frequencia]}<div className="text-xs text-stone-500">{m.frequencia === 'mensal' ? `dia ${m.diaMes ?? 1}` : nomeDias(m.diasSemana)}</div></td>
                  <td className="px-3 py-2">{m.horario}</td>
                  <td className="hidden px-3 py-2 md:table-cell">{nomeDe(m.responsavelId) || '—'}</td>
                  <td className="hidden px-3 py-2 lg:table-cell">{nomeSetor(m.setor)}</td>
                  <td className="hidden px-3 py-2 lg:table-cell">{MOMENTOS_CHECKLIST[m.momento]}</td>
                  <td className="px-3 py-2 text-right">{m.itens.filter((i) => i.ativo).length}</td>
                  <td className="px-3 py-2">{m.ativo ? <Selo cor="verde">Ativo</Selo> : <Selo>Inativo</Selo>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editando && <EditarModelo m={editando} aoFechar={() => setEditando(null)} aoSalvar={async () => { setEditando(null); await carregar() }} aoDuplicar={(c) => setEditando(c)} />}
    </div>
  )
}

function EditarModelo({ m: inicial, aoFechar, aoSalvar, aoDuplicar }: { m: ModeloChecklist; aoFechar: () => void; aoSalvar: () => void; aoDuplicar: (copia: ModeloChecklist) => void }) {
  const { store, unidades, equipe, avisar } = useApp()
  const [m, setM] = useState<ModeloChecklist>({ ...inicial, itens: inicial.itens.filter((i) => i.ativo) })
  const [colar, setColar] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const mudar = (x: Partial<ModeloChecklist>) => setM({ ...m, ...x })
  const mudarItem = (k: number, x: Partial<ItemChecklist>) => mudar({ itens: m.itens.map((i, j) => (j === k ? { ...i, ...x } : i)) })
  const mover = (k: number, d: number) => {
    const it = [...m.itens]
    const [x] = it.splice(k, 1)
    it.splice(Math.max(0, Math.min(it.length, k + d)), 0, x)
    mudar({ itens: it })
  }
  const pessoas = equipe.filter((f) => f.status === 'ativo').sort((a, b) => Number(b.unidadeId === m.unidadeId) - Number(a.unidadeId === m.unidadeId) || a.nome.localeCompare(b.nome))

  const salvar = async () => {
    const itens = m.itens.filter((i) => i.texto.trim())
    if (!m.titulo.trim()) return setErro('Dê um nome ao checklist.')
    if (!itens.length) return setErro('Coloque pelo menos um item.')
    if (m.frequencia !== 'mensal' && !m.diasSemana.length) return setErro('Escolha os dias da semana.')
    if (!/^\d{2}:\d{2}$/.test(m.horario)) return setErro('Confira o horário.')
    setSalvando(true)
    try {
      await store.salvarModeloChecklist({ ...m, itens })
      avisar(m.id ? 'Checklist salvo' : 'Checklist criado')
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={m.id ? m.titulo || 'Checklist' : 'Novo checklist'} aberto aoFechar={aoFechar}>
      <div className="space-y-4">
        <Campo rotulo="Nome"><input className={estiloEntrada} value={m.titulo} onChange={(e) => mudar({ titulo: e.target.value })} placeholder="Ex.: Abertura da cozinha" /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Loja">
            <select className={estiloEntrada} value={m.unidadeId} onChange={(e) => mudar({ unidadeId: e.target.value })}>
              {unidades.map((u) => <option key={u.id} value={u.id}>{apelidoUnidade(u.nome)}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Responsável">
            <select className={estiloEntrada} value={m.responsavelId ?? ''} onChange={(e) => mudar({ responsavelId: e.target.value || null })}>
              <option value="">Ninguém (só a gestão vê)</option>
              {pessoas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Setor">
            <select className={estiloEntrada} value={m.setor ?? ''} onChange={(e) => mudar({ setor: (e.target.value || null) as Setor | null })}>
              <option value="">—</option>
              {SETORES.map((s) => <option key={s.valor} value={s.valor}>{s.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Momento">
            <select className={estiloEntrada} value={m.momento} onChange={(e) => mudar({ momento: e.target.value as MomentoChecklist })}>
              {Object.entries(MOMENTOS_CHECKLIST).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Repete">
            <select className={estiloEntrada} value={m.frequencia} onChange={(e) => {
              const f = e.target.value as FrequenciaChecklist
              mudar({ frequencia: f, diasSemana: f === 'diaria' ? [0, 1, 2, 3, 4, 5, 6] : f === 'semanal' ? [m.diasSemana[0] ?? 0] : m.diasSemana, diaMes: f === 'mensal' ? m.diaMes ?? 1 : null })
            }}>
              {Object.entries(FREQUENCIAS_CHECKLIST).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Finalizar até" dica={`Tolerância de ${m.toleranciaMin} min antes de perder pontualidade.`}>
            <input type="time" className={estiloEntrada} value={m.horario} onChange={(e) => mudar({ horario: e.target.value })} />
          </Campo>
        </div>
        {m.frequencia === 'mensal' ? (
          <Campo rotulo="Dia do mês"><input type="number" min={1} max={31} className={`${estiloEntrada} w-24!`} value={m.diaMes ?? 1} onChange={(e) => mudar({ diaMes: Number(e.target.value) || 1 })} /></Campo>
        ) : (
          <div>
            <div className="mb-1 text-sm font-semibold">Dias</div>
            <div className="flex flex-wrap gap-1">
              {DIAS_SEMANA.map((d, k) => (
                <button key={d} type="button" onClick={() => mudar({ diasSemana: m.diasSemana.includes(k) ? m.diasSemana.filter((x) => x !== k) : [...m.diasSemana, k].sort() })}
                  className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${m.diasSemana.includes(k) ? 'bg-carvao text-white ring-carvao' : 'bg-white ring-stone-300'}`}>{d}</button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Itens ({m.itens.length})</h3>
            <button type="button" className="text-sm font-semibold underline" onClick={() => setColar('')}>Colar vários</button>
          </div>
          {colar !== null && (
            <div className="space-y-2 rounded-xl bg-stone-50 p-3">
              <textarea rows={6} className={estiloEntrada} value={colar} onChange={(e) => setColar(e.target.value)} placeholder={'Um item por linha. Ex.:\nLigar fritadeiras\nConferir validade dos pré-preparos'} aria-label="Itens, um por linha" />
              <div className="flex gap-2">
                <Botao type="button" onClick={() => {
                  const novos = colar.split('\n').map((l) => l.replace(/^\s*[-•*\d.)]+\s*/, '').trim()).filter(Boolean).map((l) => itemVazio(l))
                  mudar({ itens: [...m.itens, ...novos] })
                  setColar(null)
                }}>Adicionar</Botao>
                <Botao type="button" variante="fantasma" onClick={() => setColar(null)}>Cancelar</Botao>
              </div>
            </div>
          )}
          {m.itens.map((i, k) => (
            <div key={i.id ?? 'n' + k} className="space-y-2 rounded-xl p-2 ring-1 ring-stone-200">
              <div className="flex items-center gap-1">
                <span className="w-5 text-right text-xs text-stone-400">{k + 1}</span>
                <input className={`${estiloEntrada} py-1.5!`} value={i.texto} onChange={(e) => mudarItem(k, { texto: e.target.value })} placeholder="O que conferir" aria-label={`Item ${k + 1}`} />
                <button type="button" className="px-1 text-stone-400 hover:text-carvao" onClick={() => mover(k, -1)} aria-label="Subir">↑</button>
                <button type="button" className="px-1 text-stone-400 hover:text-carvao" onClick={() => mover(k, 1)} aria-label="Descer">↓</button>
                <button type="button" className="px-1 text-stone-400 hover:text-red-600" onClick={() => mudar({ itens: m.itens.filter((_, j) => j !== k) })} aria-label="Tirar item">✕</button>
              </div>
              <div className="flex flex-wrap items-center gap-3 pl-6 text-sm">
                <select className={`${estiloEntrada} w-auto! py-1!`} value={i.tipo} onChange={(e) => mudarItem(k, { tipo: e.target.value as TipoItemChecklist })} aria-label="Tipo de resposta">
                  <option value="check">OK / Não OK</option><option value="numero">Número (ex.: temperatura)</option><option value="texto">Texto</option>
                </select>
                {i.tipo === 'numero' && (
                  <>
                    <label className="flex items-center gap-1">mín <input inputMode="decimal" className={`${estiloEntrada} w-16! py-1!`} value={i.minimo ?? ''} onChange={(e) => mudarItem(k, { minimo: e.target.value === '' ? null : Number(e.target.value.replace(',', '.')) })} /></label>
                    <label className="flex items-center gap-1">máx <input inputMode="decimal" className={`${estiloEntrada} w-16! py-1!`} value={i.maximo ?? ''} onChange={(e) => mudarItem(k, { maximo: e.target.value === '' ? null : Number(e.target.value.replace(',', '.')) })} /></label>
                  </>
                )}
                <label className="flex items-center gap-1"><input type="checkbox" checked={i.exigeFoto} onChange={(e) => mudarItem(k, { exigeFoto: e.target.checked })} /> foto obrigatória</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={!i.obrigatorio} onChange={(e) => mudarItem(k, { obrigatorio: !e.target.checked })} /> opcional</label>
              </div>
            </div>
          ))}
          <Botao type="button" variante="secundario" onClick={() => mudar({ itens: [...m.itens, itemVazio()] })}>+ Item</Botao>
        </div>

        {m.id && (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!m.ativo} onChange={(e) => mudar({ ativo: !e.target.checked })} /> Inativar (para de gerar novos)</label>
        )}
        {erro && <p className="text-sm text-red-700">{erro}</p>}
        <div className="flex flex-wrap gap-2">
          <Botao disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
          {m.id && <Botao variante="secundario" onClick={() => aoDuplicar({ ...structuredClone(m), id: undefined, titulo: m.titulo + ' (cópia)', itens: m.itens.map((i) => ({ ...i, id: undefined })) })}>Duplicar para outra pessoa ou loja</Botao>}
          <Botao variante="fantasma" onClick={aoFechar}>Cancelar</Botao>
        </div>
      </div>
    </Modal>
  )
}
