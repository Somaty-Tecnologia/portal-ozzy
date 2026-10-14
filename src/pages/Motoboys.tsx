import { useCallback, useEffect, useMemo, useState } from 'react'
import { Botao, Campo, Modal, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { addDias, dataCurta, hoje, indiceSemana, inicioDaSemana } from '../lib/datas'
import { lerNumero } from '../lib/financeiro'
import { soDigitos } from '../lib/store'
import { EXTRA_LONGE, apelidoUnidade, calcularMotoboy, nomeCurto, type EnvioMotoboy, type EscalaMotoboy, type ExtraMotoboy, type Motoboy, type SemanaMotoboy, type TurnoMotoboy } from '../lib/types'
import { reais } from '../lib/financeiro'
import ArquivoBanco from '../components/ArquivoBanco'
import ConferirMotoboys from '../components/ConferirMotoboys'

// Motoboys (Heitor, 09/10): não são da equipe, mas têm cadastro (nome, Pix). Todo domingo a gestão lança a semana
// de cada loja (diárias, entregas com taxas, extras); vira conta a pagar na segunda e entra na conciliação.

type Aba = 'conferir' | 'escala' | 'semana' | 'cadastro'
const EXTRA_RESPONSAVEL = 'Responsável pelos motoboys'
interface Linha { motoboyId: string; diarias: string; entregas: string; extras: { descricao: string; valor: string }[]; jaPago: boolean; dias: Record<string, string> }
const DIAS_CURTOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const num = (s: string) => lerNumero(s) ?? 0
const texto = (n: number) => (n ? String(n).replace('.', ',') : '')
const diasNumero = (l: Linha) => Object.fromEntries(Object.entries(l.dias).filter(([, q]) => q.trim() !== '' && lerNumero(q) !== null).map(([d, q]) => [d, Math.max(0, Math.round(lerNumero(q)!))]))
const totalLinha = (l: Linha) => num(l.diarias) + num(l.entregas) + l.extras.reduce((t, e) => t + num(e.valor), 0)
// Segunda do pagamento: amanhã se hoje é domingo, hoje se é segunda, senão a próxima.
const proximaSegunda = () => (inicioDaSemana(hoje()) === hoje() ? hoje() : addDias(inicioDaSemana(hoje()), 7))

export default function Motoboys() {
  const { store, unidades, avisar } = useApp()
  const [aba, setAba] = useState<Aba>('semana')
  const [pagamento, setPagamento] = useState(proximaSegunda)
  const lojas = useMemo(() => unidades.filter((u) => u.id !== 'central' && u.id !== 'eventos'), [unidades])
  const [loja, setLoja] = useState('')
  const [motoboys, setMotoboys] = useState<Motoboy[] | null>(null)
  const [semanas, setSemanas] = useState<SemanaMotoboy[]>([])
  const [escalados, setEscalados] = useState<EscalaMotoboy[]>([])
  const [envios, setEnvios] = useState<EnvioMotoboy[]>([])
  const [pendentes, setPendentes] = useState(0)
  const [editando, setEditando] = useState<Motoboy | 'novo' | null>(null)

  const carregar = useCallback(async () => {
    const [m, s, e, ev, pend] = await Promise.all([store.motoboys(), store.semanasMotoboys(addDias(pagamento, -84), pagamento), store.escalaMotoboys(addDias(pagamento, -7), addDias(pagamento, -1)).catch(() => []),
      store.enviosMotoboys(addDias(pagamento, -7), addDias(pagamento, -1)).catch(() => []), store.enviosMotoboys(addDias(hoje(), -30), hoje()).catch(() => [])])
    setMotoboys(m)
    setSemanas(s)
    setEscalados(e)
    setEnvios(ev)
    setPendentes(pend.filter((x) => x.status === 'pendente').length)
  }, [store, pagamento])
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { if (!loja && lojas.length) setLoja(lojas[0].id) }, [loja, lojas])

  if (!motoboys) return <p className="text-stone-400">Carregando…</p>

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Motoboys</h1>
          <p className="text-sm text-stone-500">Lance a semana no domingo: vira conta a pagar na segunda e já entra na conciliação.</p>
        </div>
        {aba === 'cadastro' && <Botao onClick={() => setEditando('novo')}>+ Novo motoboy</Botao>}
      </div>

      <div className="grid grid-cols-4 gap-1 rounded-xl bg-stone-200 p-1 text-sm font-semibold">
        {([['conferir', 'Conferir'], ['escala', 'Escala'], ['semana', 'Pagamento'], ['cadastro', 'Cadastro']] as const).map(([a, nome]) => (
          <button key={a} onClick={() => setAba(a)} className={`rounded-lg py-2 ${aba === a ? 'bg-white shadow-sm' : 'text-stone-600'}`}>
            {nome}{a === 'conferir' && pendentes > 0 && <span className="ml-1 rounded-full bg-red-600 px-1.5 text-xs text-white">{pendentes}</span>}
          </button>
        ))}
      </div>

      {aba === 'semana' && (
        <>
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-white p-2 ring-1 ring-stone-200">
            <button onClick={() => setPagamento(addDias(pagamento, -7))} className="rounded-xl px-3 py-2 text-lg hover:bg-stone-100" aria-label="Semana anterior">‹</button>
            <div className="text-center">
              <div className="font-semibold">Pagamento na segunda, {dataCurta(pagamento)}</div>
              <div className="text-xs text-stone-500">Semana de {dataCurta(addDias(pagamento, -7))} a {dataCurta(addDias(pagamento, -1))}</div>
            </div>
            <button onClick={() => setPagamento(addDias(pagamento, 7))} className="rounded-xl px-3 py-2 text-lg hover:bg-stone-100" aria-label="Próxima semana">›</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {lojas.map((u) => {
              const n = semanas.filter((s) => s.pagamento === pagamento && s.unidadeId === u.id)
              return (
                <button key={u.id} onClick={() => setLoja(u.id)}
                  className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${loja === u.id ? 'bg-carvao text-white ring-carvao' : 'bg-white text-stone-600 ring-stone-300'}`}>
                  {apelidoUnidade(u.nome)}{n.length ? ` · ${reais(n.reduce((t, s) => t + s.total, 0))}` : ''}
                </button>
              )
            })}
          </div>
          {loja && (
            <SemanaLoja
              key={pagamento + loja + envios.filter((x) => x.status === 'aprovado').length}
              envios={envios}
              conferir={() => setAba('conferir')}
              pagamento={pagamento}
              loja={loja}
              motoboys={motoboys}
              semanas={semanas}
              escalados={escalados}
              novo={() => setEditando('novo')}
              aoSalvar={async () => { await carregar(); avisar('Semana salva. As contas entram no contas a pagar com vencimento na segunda.') }}
            />
          )}
        </>
      )}

      {aba === 'conferir' && <ConferirMotoboys motoboys={motoboys} aoMudar={carregar} />}

      {aba === 'escala' && <Escala motoboys={motoboys} lojas={lojas.filter((u) => u.id !== 'pizza')} />}

      {aba === 'cadastro' && <Cadastro motoboys={motoboys} semanas={semanas} editar={setEditando} />}

      {editando && (
        <FormMotoboy
          existente={editando === 'novo' ? undefined : editando}
          lojaPadrao={loja}
          aoFechar={() => setEditando(null)}
          aoSalvar={async () => { setEditando(null); await carregar(); avisar('Cadastro salvo') }}
        />
      )}
    </div>
  )
}

function SemanaLoja({ pagamento, loja, motoboys, semanas, escalados, envios, conferir, novo, aoSalvar }: {
  pagamento: string; loja: string; motoboys: Motoboy[]; semanas: SemanaMotoboy[]; escalados: EscalaMotoboy[]; envios: EnvioMotoboy[]; conferir: () => void; novo: () => void; aoSalvar: () => Promise<void>
}) {
  const { store, nomeUnidade, avisar } = useApp()
  const desta = semanas.filter((s) => s.pagamento === pagamento && s.unidadeId === loja)
  const porId = new Map(motoboys.map((m) => [m.id, m]))
  const daLoja = envios.filter((e) => e.unidadeId === loja)
  const aprovados = daLoja.filter((e) => e.status === 'aprovado')
  // Dias conferidos em Motoboys › Conferir entram sozinhos (dia ainda vazio) com as entregas conferidas e os valores a mais.
  const [veioDosEnvios] = useState(() => ({ n: 0 }))
  const inicial = (): Linha[] => {
    const ids = [...new Set([...desta.map((s) => s.motoboyId), ...motoboys.filter((m) => m.ativo && m.unidadeId === loja).map((m) => m.id), ...aprovados.map((e) => e.motoboyId)])]
    return ids.map((id) => {
      const s = desta.find((x) => x.motoboyId === id)
      const m = porId.get(id)
      // Semana ainda não salva do responsável: o adicional já vem preenchido (dá para tirar).
      const adicional = !s && m?.responsavel && m.unidadeId === loja ? [{ descricao: EXTRA_RESPONSAVEL, valor: texto(m.adicionalResponsavel ?? 125) }] : []
      const l: Linha = {
        motoboyId: id, diarias: texto(s?.diarias ?? 0), entregas: texto(s?.entregas ?? 0),
        dias: Object.fromEntries(Object.entries(s?.dias ?? {}).map(([d, q]) => [d, String(q)])),
        extras: s ? s.extras.map((e) => ({ descricao: e.descricao, valor: texto(e.valor) })) : adicional, jaPago: !!s?.pagoEm,
      }
      if (s?.conciliado) return l
      let veio = false
      for (const e of aprovados.filter((x) => x.motoboyId === id)) {
        if ((l.dias[e.data] ?? '').trim() === '') { l.dias[e.data] = String(e.entregasConferidas ?? e.entregas); veio = true }
        for (const x of e.extras) {
          const descricao = `${dataCurta(e.data)} ${x.descricao}`
          if (!l.extras.some((y) => y.descricao === descricao)) { l.extras.push({ descricao, valor: texto(x.valor) }); veio = true }
        }
        // Entregas acima de 6 km aprovadas: o valor final que a gestão definiu na conferência.
        if ((e.longasConferidas ?? 0) > 0 && (e.valorLongas ?? 0) > 0) {
          const descricao = `${dataCurta(e.data)} ${e.longasConferidas} ${e.longasConferidas === 1 ? 'entrega' : 'entregas'} ${EXTRA_LONGE}`
          if (!l.extras.some((y) => y.descricao === descricao)) { l.extras.push({ descricao, valor: texto(e.valorLongas!) }); veio = true }
        }
      }
      if (veio) {
        const c = calcularMotoboy(m, diasNumero(l))
        l.diarias = texto(c.diarias)
        l.entregas = texto(c.entregas)
        veioDosEnvios.n++
      }
      return l
    }).sort((a, b) => (porId.get(a.motoboyId)?.nome ?? '').localeCompare(porId.get(b.motoboyId)?.nome ?? ''))
  }
  const [linhas, setLinhas] = useState<Linha[]>(inicial)
  const [mexeu, setMexeu] = useState(() => veioDosEnvios.n > 0)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [pix, setPix] = useState(false)
  // Motoboy novo cadastrado com a tela aberta: entra na lista.
  useEffect(() => {
    setLinhas((ls) => {
      const novos = motoboys.filter((m) => m.ativo && m.unidadeId === loja && !ls.some((l) => l.motoboyId === m.id))
      return novos.length ? [...ls, ...novos.map((m) => ({ motoboyId: m.id, diarias: '', entregas: '', extras: [], jaPago: false, dias: {} }))] : ls
    })
  }, [motoboys, loja])

  const semana = Array.from({ length: 7 }, (_, k) => addDias(pagamento, k - 7))
  // Entregas de um dia: recalcula diárias e entregas pela regra do motoboy (diária inclui as primeiras entregas).
  const mudarDia = (i: number, data: string, valor: string) => {
    const l = linhas[i]
    const dias = { ...l.dias, [data]: valor }
    const c = calcularMotoboy(porId.get(l.motoboyId), diasNumero({ ...l, dias }))
    mudar(i, { dias, diarias: texto(c.diarias), entregas: texto(c.entregas) })
  }
  // ✓ dia conferido pelas notinhas; • mandado e ainda não conferido.
  const marca = (id: string, data: string) => {
    const e = daLoja.find((x) => x.motoboyId === id && x.data === data && x.status !== 'recusado')
    return e ? (e.status === 'aprovado' ? ' ✓' : ' •') : ''
  }
  const naEscala = (id: string, data: string) => escalados.some((e) => e.motoboyId === id && e.data === data)
  const diasEscala = (id: string) => escalados.filter((e) => e.motoboyId === id).length
  const fechada = (id: string) => desta.find((s) => s.motoboyId === id)?.conciliado ?? false
  const mudar = (i: number, l: Partial<Linha>) => { setMexeu(true); setLinhas(linhas.map((x, j) => (j === i ? { ...x, ...l } : x))) }
  const outros = motoboys.filter((m) => m.ativo && !linhas.some((l) => l.motoboyId === m.id))
  const total = linhas.reduce((t, l) => t + (Number.isFinite(totalLinha(l)) ? totalLinha(l) : 0), 0)

  async function salvar() {
    setErro('')
    const ruim = linhas.find((l) => !Number.isFinite(totalLinha(l)))
    if (ruim) return setErro(`Confira os valores de ${porId.get(ruim.motoboyId)?.nome}.`)
    const semDescricao = linhas.find((l) => l.extras.some((e) => num(e.valor) && !e.descricao.trim()))
    if (semDescricao) return setErro(`Diga o que é o extra de ${porId.get(semDescricao.motoboyId)?.nome} (ex.: adiantamento, supervisão).`)
    setSalvando(true)
    try {
      await store.salvarSemanaMotoboys(pagamento, loja, linhas.filter((l) => !fechada(l.motoboyId)).map((l) => ({
        motoboyId: l.motoboyId, diarias: num(l.diarias), entregas: num(l.entregas), jaPago: l.jaPago, dias: diasNumero(l),
        extras: l.extras.map((e): ExtraMotoboy => ({ descricao: e.descricao.trim(), valor: num(e.valor) })).filter((e) => e.valor),
      })))
      setMexeu(false)
      await aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  const comValor = linhas.filter((l) => totalLinha(l) > 0)
  const relatorio = [
    `*Motoboys ${apelidoUnidade(nomeUnidade(loja))}* · pagamento ${dataCurta(pagamento)}`,
    ...comValor.map((l) => {
      const m = porId.get(l.motoboyId)
      const extras = l.extras.filter((e) => num(e.valor)).map((e) => ` + ${e.descricao} ${reais(num(e.valor))}`).join('')
      const partes = num(l.diarias) || num(l.entregas) ? `diárias ${reais(num(l.diarias))} + entregas ${reais(num(l.entregas))}${extras}` : extras.slice(3)
      return `${m?.nome}: *${reais(totalLinha(l))}* (${partes}) · Pix ${l.jaPago ? 'PAGO' : m?.pix ?? 'sem chave'}`
    }),
    `Total: *${reais(total)}*`,
  ].join('\n')
  const aPagar = comValor.filter((l) => !l.jaPago && !fechada(l.motoboyId)).map((l) => {
    const m = porId.get(l.motoboyId)!
    return { nome: m.nome, cpf: m.cpf ?? '', chavePix: m.pix ?? '', valor: Math.round(totalLinha(l) * 100) / 100, seuNumero: `MOTO ${pagamento}` }
  })

  const aConferir = daLoja.filter((e) => e.status === 'pendente').length
  return (
    <div className="space-y-3">
      {(aConferir > 0 || veioDosEnvios.n > 0) && (
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
          {veioDosEnvios.n > 0 && <>Os dias conferidos que os motoboys mandaram já estão preenchidos (✓). Confira e salve a semana. </>}
          {aConferir > 0 && <>{aConferir} {aConferir === 1 ? 'dia mandado ainda não foi conferido' : 'dias mandados ainda não foram conferidos'} (•). <button className="font-semibold underline" onClick={conferir}>Conferir</button></>}
        </div>
      )}
      {linhas.length === 0 ? (
        <Vazio>Nenhum motoboy desta loja. <button className="font-semibold underline" onClick={novo}>Cadastrar</button></Vazio>
      ) : (
        <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
          <div className="hidden grid-cols-[1fr_7rem_7rem_6rem] gap-2 px-3 py-2 text-xs font-semibold text-stone-500 sm:grid">
            <span>Nome</span><span>Diárias</span><span>Entregas com taxas</span><span className="text-right">Total</span>
          </div>
          {linhas.map((l, i) => {
            const m = porId.get(l.motoboyId)
            const t = totalLinha(l)
            const travada = fechada(l.motoboyId)
            const salva = desta.find((s) => s.motoboyId === l.motoboyId)
            return (
              <div key={l.motoboyId} className="space-y-2 px-3 py-2.5">
                <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_7rem_7rem_6rem]">
                  <div className="col-span-2 min-w-0 sm:col-span-1">
                    <div className="truncate text-sm font-semibold">{m?.nome ?? 'Motoboy'}</div>
                    <div className="truncate text-xs text-stone-500">
                      {m?.responsavel ? 'Responsável · ' : ''}Pix {m?.pix ?? 'sem chave'}{m?.unidadeId && m.unidadeId !== loja ? ` · de ${apelidoUnidade(nomeUnidade(m.unidadeId))}` : ''}
                      {diasEscala(l.motoboyId) ? ` · ${diasEscala(l.motoboyId)} ${diasEscala(l.motoboyId) === 1 ? 'dia' : 'dias'} na escala` : ''}
                    </div>
                  </div>
                  <input className={estiloEntrada + ' py-1.5!'} inputMode="decimal" placeholder="Diárias" aria-label={`Diárias de ${m?.nome}`} disabled={travada}
                    value={l.diarias} onChange={(e) => mudar(i, { diarias: e.target.value })} />
                  <input className={estiloEntrada + ' py-1.5!'} inputMode="decimal" placeholder="Entregas" aria-label={`Entregas de ${m?.nome}`} disabled={travada}
                    value={l.entregas} onChange={(e) => mudar(i, { entregas: e.target.value })} />
                  <div className={`col-span-2 text-right text-sm font-bold sm:col-span-1 ${Number.isFinite(t) ? '' : 'text-red-700'}`}>{Number.isFinite(t) ? reais(t) : 'confira'}</div>
                </div>
                {!travada && (
                  <div className="grid grid-cols-7 gap-1">
                    {semana.map((d, k) => (
                      <label key={d} className="text-center text-[11px] text-stone-500">
                        <span className={naEscala(l.motoboyId, d) ? 'font-bold text-carvao' : ''}>{DIAS_CURTOS[k]} {d.slice(8)}{marca(l.motoboyId, d)}</span>
                        <input className={`${estiloEntrada} mt-0.5 px-1! py-1! text-center`} inputMode="numeric" placeholder={naEscala(l.motoboyId, d) ? 'escala' : ''}
                          aria-label={`Entregas de ${m?.nome} em ${dataCurta(d)}`} value={l.dias[d] ?? ''} onChange={(e) => mudarDia(i, d, e.target.value)} />
                      </label>
                    ))}
                  </div>
                )}
                {(() => {
                  const c = calcularMotoboy(m, diasNumero(l))
                  return c.dias > 0 && (
                    <p className="text-xs text-stone-500">
                      {c.dias - c.diasFds > 0 && <>{c.dias - c.diasFds} × {reais(m?.valorDiaria ?? 100)}</>}{c.dias - c.diasFds > 0 && c.diasFds > 0 && ' + '}{c.diasFds > 0 && <>{c.diasFds} sáb/dom × {reais(m?.valorDiariaFds ?? 115)}</>} · {c.entregasTotal} entregas, {c.entregasExtras} além das {m?.entregasIncluidas ?? 10} do dia × {reais(m?.valorEntrega ?? 4)}
                    </p>
                  )
                })()}
                {l.extras.map((e, k) => (
                  <div key={k} className="flex items-center gap-2">
                    <input className={estiloEntrada + ' py-1.5! min-w-0 flex-1'} placeholder="Extra (adiantamento, supervisão…)" disabled={travada} value={e.descricao}
                      onChange={(ev) => mudar(i, { extras: l.extras.map((x, j) => (j === k ? { ...x, descricao: ev.target.value } : x)) })} />
                    <input className={estiloEntrada + ' py-1.5! w-28! shrink-0'} inputMode="decimal" placeholder="Valor" disabled={travada} value={e.valor}
                      onChange={(ev) => mudar(i, { extras: l.extras.map((x, j) => (j === k ? { ...x, valor: ev.target.value } : x)) })} />
                    {!travada && <button className="px-1 text-stone-400 hover:text-red-700" aria-label="Tirar extra" onClick={() => mudar(i, { extras: l.extras.filter((_, j) => j !== k) })}>✕</button>}
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {travada ? <Selo cor="verde">Conciliado no banco</Selo> : (
                    <>
                      <button className="font-semibold text-stone-600 underline" onClick={() => mudar(i, { extras: [...l.extras, { descricao: '', valor: '' }] })}>+ Extra</button>
                      <label className="flex items-center gap-1.5 text-stone-600">
                        <input type="checkbox" checked={l.jaPago} onChange={(e) => mudar(i, { jaPago: e.target.checked })} /> Já pago
                      </label>
                    </>
                  )}
                  {salva && !travada && <span className="text-stone-400">Salvo{salva.pagoEm ? ' · pago' : ''}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {outros.length > 0 && (
          <select className={estiloEntrada + ' w-auto! py-1.5!'} value="" aria-label="Pôr motoboy de outra loja"
            onChange={(e) => { if (e.target.value) { setMexeu(true); setLinhas([...linhas, { motoboyId: e.target.value, diarias: '', entregas: '', extras: [], jaPago: false, dias: {} }]) } }}>
            <option value="">+ Motoboy de outra loja</option>
            {outros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        )}
        <button className="text-sm font-semibold underline" onClick={novo}>+ Cadastrar motoboy</button>
      </div>

      <div className="sticky bottom-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-stone-300">
        <div className="text-sm">Total da loja <b className="text-base">{reais(total)}</b>{mexeu ? <span className="ml-2 font-semibold text-amber-700">não salvo</span> : null}</div>
        <div className="flex flex-wrap gap-2">
          <Botao variante="secundario" className="py-1.5!" disabled={!comValor.length}
            onClick={() => navigator.clipboard.writeText(relatorio).then(() => avisar('Copiado para colar no WhatsApp'))}>Copiar</Botao>
          <Botao variante="secundario" className="py-1.5!" disabled={!aPagar.length || mexeu} onClick={() => setPix(true)}>Pix em lote</Botao>
          <Botao className="py-1.5!" disabled={salvando || !linhas.length} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar semana'}</Botao>
        </div>
      </div>
      {erro && <p className="text-sm text-red-700">{erro}</p>}
      <p className="text-xs text-stone-500">
        Nos dias (Seg a Dom), coloque o total de entregas do dia; a diária e as entregas além das incluídas são calculadas sozinhas. Cada motoboy vira uma conta a pagar (conta 3.1 Motoboys, loja {apelidoUnidade(nomeUnidade(loja))}) vencendo na segunda. Na conciliação, o Pix de cada um acha a conta dele,
        e o Pix em lote acha a semana inteira. Valor zerado tira a pessoa da semana. Extra negativo é desconto.
      </p>
      {pix && (
        <ArquivoBanco tipo="freelancer" referencia={`moto:${pagamento}:${loja}`} dataPagamento={pagamento} historico="MOTOBOYS" pagamentos={aPagar} aoFechar={() => setPix(false)} />
      )}
    </div>
  )
}

// ——— Escala da semana (Heitor, 12/10) ———
const DIAS_NOME = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
const hora = (t: string) => t.replace(':00', 'h').replace(':', 'h')

function Escala({ motoboys, lojas }: { motoboys: Motoboy[]; lojas: { id: string; nome: string }[] }) {
  const { store, avisar } = useApp()
  const [inicio, setInicio] = useState(() => inicioDaSemana(hoje()))
  const [loja, setLoja] = useState(lojas[0]?.id ?? '')
  const [turnos, setTurnos] = useState<TurnoMotoboy[] | null>(null)
  const [escala, setEscala] = useState<EscalaMotoboy[]>([])
  const [editarHorarios, setEditarHorarios] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const fim = addDias(inicio, 6)
  const carregar = useCallback(async () => {
    try {
      const [t, e] = await Promise.all([store.turnosMotoboys(), store.escalaMotoboys(addDias(inicio, -7), addDias(inicio, 6))])
      setTurnos(t)
      setEscala(e)
    } catch (e) {
      avisar((e as Error).message)
    }
  }, [store, inicio, avisar])
  useEffect(() => { carregar() }, [carregar])
  if (!turnos) return <p className="text-stone-400">Carregando…</p>

  const porId = new Map(motoboys.map((m) => [m.id, m]))
  const dias = Array.from({ length: 7 }, (_, i) => addDias(inicio, i))
  const turno = (d: string) => turnos.find((t) => t.unidadeId === loja && t.dia === indiceSemana(d))
  const doDia = (d: string) => escala.filter((e) => e.data === d && e.unidadeId === loja)
  const ativos = motoboys.filter((m) => m.ativo).sort((a, b) => Number(b.unidadeId === loja) - Number(a.unidadeId === loja) || a.nome.localeCompare(b.nome))
  const nomeLoja = apelidoUnidade(lojas.find((l) => l.id === loja)?.nome ?? '')

  const mudar = async (motoboyId: string, data: string, escalado: boolean) => {
    setOcupado(true)
    try {
      await store.escalarMotoboy(motoboyId, loja, data, escalado)
      await carregar()
    } catch (e) {
      avisar((e as Error).message)
    }
    setOcupado(false)
  }
  const repetirAnterior = async () => {
    const anterior = escala.filter((e) => e.unidadeId === loja && e.data < inicio)
    if (!anterior.length) return avisar('A semana anterior não tem escala nesta loja.')
    setOcupado(true)
    try {
      for (const e of anterior) {
        const d = addDias(e.data, 7)
        if (turno(d) && !escala.some((x) => x.motoboyId === e.motoboyId && x.data === d)) await store.escalarMotoboy(e.motoboyId, loja, d, true)
      }
      await carregar()
      avisar('Escala copiada da semana anterior')
    } catch (e) {
      avisar((e as Error).message)
    }
    setOcupado(false)
  }
  const textoWhats = () => [
    `*Escala motoboys ${nomeLoja}* · ${dataCurta(inicio)} a ${dataCurta(fim)}`,
    ...dias.map((d) => {
      const t = turno(d)
      if (!t) return `${DIAS_NOME[indiceSemana(d)]} ${dataCurta(d)}: fechado`
      const nomes = doDia(d).map((e) => nomeCurto(porId.get(e.motoboyId)?.nome ?? '')).join(', ')
      return `${DIAS_NOME[indiceSemana(d)]} ${dataCurta(d)} (${hora(t.inicio)} às ${hora(t.fim)}): ${nomes || 'ninguém escalado'}`
    }),
  ].join('\n')

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-white p-2 ring-1 ring-stone-200">
        <button onClick={() => setInicio(addDias(inicio, -7))} className="rounded-xl px-3 py-2 text-lg hover:bg-stone-100" aria-label="Semana anterior">‹</button>
        <div className="text-center font-semibold">Semana de {dataCurta(inicio)} a {dataCurta(fim)}</div>
        <button onClick={() => setInicio(addDias(inicio, 7))} className="rounded-xl px-3 py-2 text-lg hover:bg-stone-100" aria-label="Próxima semana">›</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {lojas.map((u) => (
          <button key={u.id} onClick={() => setLoja(u.id)}
            className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${loja === u.id ? 'bg-carvao text-white ring-carvao' : 'bg-white text-stone-600 ring-stone-300'}`}>{apelidoUnidade(u.nome)}</button>
        ))}
        <span className="text-xs text-stone-500">A Pizza usa os motoboys da Vila.</span>
      </div>

      <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
        {dias.map((d) => {
          const t = turno(d)
          const nesse = doDia(d)
          const livres = ativos.filter((m) => !escala.some((e) => e.motoboyId === m.id && e.data === d))
          return (
            <div key={d} className={`flex flex-wrap items-center gap-2 px-3 py-2.5 ${d === hoje() ? 'bg-ozzy-50' : ''}`}>
              <div className="w-36 shrink-0">
                <div className="text-sm font-semibold">{DIAS_NOME[indiceSemana(d)]} {dataCurta(d)}</div>
                <div className="text-xs text-stone-500">{t ? `${hora(t.inicio)} às ${hora(t.fim)}` : 'Fechado'}</div>
              </div>
              {t && (
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  {nesse.map((e) => (
                    <span key={e.id} className="flex items-center gap-1 rounded-full bg-stone-100 py-1 pr-1 pl-3 text-sm">
                      {nomeCurto(porId.get(e.motoboyId)?.nome ?? 'Motoboy')}
                      <button disabled={ocupado} onClick={() => mudar(e.motoboyId, d, false)} className="rounded-full px-1.5 text-stone-400 hover:text-red-700" aria-label={`Tirar ${porId.get(e.motoboyId)?.nome} de ${dataCurta(d)}`}>✕</button>
                    </span>
                  ))}
                  {livres.length > 0 && (
                    <select className={estiloEntrada + ' w-auto! py-1!'} value="" disabled={ocupado} aria-label={`Escalar em ${dataCurta(d)}`}
                      onChange={(ev) => ev.target.value && mudar(ev.target.value, d, true)}>
                      <option value="">+ Escalar</option>
                      {livres.map((m) => <option key={m.id} value={m.id}>{m.nome}{m.unidadeId && m.unidadeId !== loja ? ' (outra loja)' : ''}</option>)}
                    </select>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Botao variante="secundario" className="py-1.5!" disabled={ocupado} onClick={repetirAnterior}>Repetir a semana anterior</Botao>
        <Botao variante="secundario" className="py-1.5!" onClick={() => navigator.clipboard.writeText(textoWhats()).then(() => avisar('Escala copiada para o WhatsApp'))}>Copiar para WhatsApp</Botao>
        <button className="text-sm font-semibold text-stone-600 underline" onClick={() => setEditarHorarios(!editarHorarios)}>{editarHorarios ? 'Fechar horários' : 'Mudar horários'}</button>
      </div>
      {editarHorarios && <Horarios key={loja} loja={loja} nomeLoja={nomeLoja} turnos={turnos} aoMudar={carregar} />}
      <p className="text-xs text-stone-500">Os dias na escala aparecem no pagamento da semana, ao lado de cada motoboy, para conferir as diárias.</p>
    </div>
  )
}

function Horarios({ loja, nomeLoja, turnos, aoMudar }: { loja: string; nomeLoja: string; turnos: TurnoMotoboy[]; aoMudar: () => Promise<void> }) {
  const { store, avisar } = useApp()
  const [v, setV] = useState(() => DIAS_NOME.map((_, dia) => {
    const t = turnos.find((x) => x.unidadeId === loja && x.dia === dia)
    return { aberto: !!t, inicio: t?.inicio ?? '18:00', fim: t?.fim ?? '23:00' }
  }))
  const [salvando, setSalvando] = useState(false)
  const mudarDia = (dia: number, x: Partial<(typeof v)[number]>) => setV(v.map((d, j) => (j === dia ? { ...d, ...x } : d)))
  const salvar = async () => {
    setSalvando(true)
    try {
      for (const [dia, d] of v.entries()) await store.salvarTurnoMotoboy(loja, dia, d.aberto ? { inicio: d.inicio, fim: d.fim } : null)
      await aoMudar()
      avisar('Horários salvos')
    } catch (e) {
      avisar((e as Error).message)
    }
    setSalvando(false)
  }
  return (
    <div className="space-y-2 rounded-2xl bg-white p-3 ring-1 ring-stone-200">
      <h3 className="text-sm font-bold">Horários dos motoboys · {nomeLoja}</h3>
      {v.map((d, dia) => (
        <div key={dia} className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex w-28 items-center gap-2"><input type="checkbox" checked={d.aberto} onChange={(e) => mudarDia(dia, { aberto: e.target.checked })} /> {DIAS_NOME[dia]}</label>
          {d.aberto ? (
            <>
              <input type="time" className={estiloEntrada + ' w-32! py-1!'} value={d.inicio} onChange={(e) => mudarDia(dia, { inicio: e.target.value })} aria-label={`Início ${DIAS_NOME[dia]}`} />
              às
              <input type="time" className={estiloEntrada + ' w-32! py-1!'} value={d.fim} onChange={(e) => mudarDia(dia, { fim: e.target.value })} aria-label={`Fim ${DIAS_NOME[dia]}`} />
            </>
          ) : <span className="text-stone-400">Fechado</span>}
        </div>
      ))}
      <Botao className="py-1.5!" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar horários'}</Botao>
    </div>
  )
}

function Cadastro({ motoboys, semanas, editar }: { motoboys: Motoboy[]; semanas: SemanaMotoboy[]; editar: (m: Motoboy) => void }) {
  const { nomeUnidade } = useApp()
  const [busca, setBusca] = useState('')
  if (!motoboys.length) return <Vazio>Nenhum motoboy cadastrado ainda.</Vazio>
  const termo = busca.trim().toLowerCase()
  const lista = motoboys.filter((m) => !termo || m.nome.toLowerCase().includes(termo) || (m.pix ?? '').toLowerCase().includes(termo))
  return (
    <div className="space-y-2">
      <input className={estiloEntrada} type="search" placeholder="Buscar por nome ou Pix" value={busca} onChange={(e) => setBusca(e.target.value)} />
      <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
        {lista.map((m) => {
          const ult = semanas.filter((s) => s.motoboyId === m.id).sort((a, b) => b.pagamento.localeCompare(a.pagamento))
          return (
            <button key={m.id} onClick={() => editar(m)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-stone-50">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{m.nome}</div>
                <div className="truncate text-xs text-stone-500">
                  {m.unidadeId ? apelidoUnidade(nomeUnidade(m.unidadeId)) + ' · ' : ''}Pix {m.pix ?? 'sem chave'}
                  {ult.length ? ` · últimas ${ult.length} semanas: ${reais(ult.reduce((t, s) => t + s.total, 0))}` : ''}
                </div>
              </div>
              {m.responsavel && <Selo cor="azul">Responsável</Selo>}
              {!m.ativo && <Selo>Inativo</Selo>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FormMotoboy({ existente, lojaPadrao, aoFechar, aoSalvar }: { existente?: Motoboy; lojaPadrao: string; aoFechar: () => void; aoSalvar: () => void }) {
  const { store, unidades } = useApp()
  const [f, setF] = useState({
    nome: existente?.nome ?? '', unidadeId: existente?.unidadeId ?? lojaPadrao, pix: existente?.pix ?? '', telefone: existente?.telefone ?? '',
    cpf: existente?.cpf ?? '', observacao: existente?.observacao ?? '', ativo: existente?.ativo ?? true,
    responsavel: existente?.responsavel ?? false, adicional: texto(existente?.adicionalResponsavel ?? 125),
    valorDiaria: texto(existente?.valorDiaria ?? 100), valorDiariaFds: texto(existente?.valorDiariaFds ?? 115), incluidas: String(existente?.entregasIncluidas ?? 10), valorEntrega: texto(existente?.valorEntrega ?? 4), valorLonge: texto(existente?.valorEntregaLonge ?? 4),
  })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!f.nome.trim()) return setErro('Diga o nome.')
    if (f.cpf && soDigitos(f.cpf).length !== 11) return setErro('CPF com 11 números (ou deixe em branco).')
    setErro('')
    setSalvando(true)
    try {
      const { adicional, valorDiaria, valorDiariaFds, incluidas, valorEntrega, valorLonge, ...resto } = f
      if ([valorDiaria, valorDiariaFds, incluidas, valorEntrega, valorLonge].some((x) => lerNumero(x) === null)) { setSalvando(false); return setErro('Confira diária, entregas incluídas e valor por entrega.') }
      if (f.responsavel && lerNumero(adicional) === null) { setSalvando(false); return setErro('Diga o valor do adicional do responsável.') }
      await store.salvarMotoboy({ ...resto, adicionalResponsavel: lerNumero(adicional) ?? 125, valorDiaria: lerNumero(valorDiaria)!, valorDiariaFds: lerNumero(valorDiariaFds)!, entregasIncluidas: Math.round(lerNumero(incluidas)!), valorEntrega: lerNumero(valorEntrega)!, valorEntregaLonge: lerNumero(valorLonge)!, id: existente?.id, unidadeId: f.unidadeId || null, pix: f.pix || null, telefone: f.telefone || null, cpf: f.cpf || null, observacao: f.observacao || null })
      aoSalvar()
    } catch (err) {
      setErro((err as Error).message)
      setSalvando(false)
    }
  }
  return (
    <Modal titulo={existente ? `Editar ${nomeCurto(existente.nome)}` : 'Novo motoboy'} aberto aoFechar={aoFechar}>
      <form onSubmit={salvar} className="space-y-3">
        <Campo rotulo="Nome"><input className={estiloEntrada} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} autoFocus /></Campo>
        <Campo rotulo="Loja onde roda">
          <select className={estiloEntrada} value={f.unidadeId} onChange={(e) => setF({ ...f, unidadeId: e.target.value })}>
            <option value="">Escolher</option>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Chave Pix" dica="Celular, CPF, e-mail ou chave aleatória."><input className={estiloEntrada} value={f.pix} onChange={(e) => setF({ ...f, pix: e.target.value })} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Celular" dica="É com ele que o motoboy entra no link para mandar o dia."><input className={estiloEntrada} inputMode="tel" value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></Campo>
          <Campo rotulo="CPF (opcional)" dica="Precisa para o Pix em lote."><input className={estiloEntrada} inputMode="numeric" value={f.cpf} onChange={(e) => setF({ ...f, cpf: e.target.value })} /></Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Diária seg a sex (R$)"><input className={estiloEntrada} inputMode="decimal" value={f.valorDiaria} onChange={(e) => setF({ ...f, valorDiaria: e.target.value })} /></Campo>
          <Campo rotulo="Diária sáb e dom (R$)"><input className={estiloEntrada} inputMode="decimal" value={f.valorDiariaFds} onChange={(e) => setF({ ...f, valorDiariaFds: e.target.value })} /></Campo>
          <Campo rotulo="Entregas na diária"><input className={estiloEntrada} inputMode="numeric" value={f.incluidas} onChange={(e) => setF({ ...f, incluidas: e.target.value })} /></Campo>
          <Campo rotulo="Por entrega a mais (R$)"><input className={estiloEntrada} inputMode="decimal" value={f.valorEntrega} onChange={(e) => setF({ ...f, valorEntrega: e.target.value })} /></Campo>
          <Campo rotulo="Entrega acima de 6 km (R$ a mais)" dica="Com print do GPS."><input className={estiloEntrada} inputMode="decimal" value={f.valorLonge} onChange={(e) => setF({ ...f, valorLonge: e.target.value })} /></Campo>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.responsavel} onChange={(e) => setF({ ...f, responsavel: e.target.checked })} /> Responsável pelos motoboys
        </label>
        {f.responsavel && (
          <Campo rotulo="Adicional por semana (R$)" dica="Entra sozinho como extra na semana dele.">
            <input className={estiloEntrada} inputMode="decimal" value={f.adicional} onChange={(e) => setF({ ...f, adicional: e.target.value })} />
          </Campo>
        )}
        <Campo rotulo="Observação (opcional)"><input className={estiloEntrada} value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} /></Campo>
        {existente && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} /> Ativo (aparece na semana da loja)
          </label>
        )}
        {erro && <p className="text-sm text-red-700">{erro}</p>}
        <Botao className="w-full" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
      </form>
    </Modal>
  )
}
