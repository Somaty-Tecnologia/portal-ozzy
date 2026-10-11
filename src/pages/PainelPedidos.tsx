import { useEffect, useMemo, useState } from 'react'
import { BarraParticipacao, COR_SEMANA, ColunasSemanas, Legenda, LinhasDias, TINTA, moeda, numero, pct, type Semana } from '../components/graficos'
import { useOrdem } from '../components/Ordenar'
import { useApp } from '../lib/contexto'
import { addDias, dataCurta, hoje, inicioDaSemana } from '../lib/datas'
import { CANAIS, apelidoUnidade, type Avaliacao, type Canal, type VendaDia } from '../lib/types'

const SEMANAS = 8
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const NOMES_DIA = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo']
const TINTA_CLARA: Canal[] = ['salao']

const soma = (vs: VendaDia[]) => vs.reduce((a, v) => ({ pedidos: a.pedidos + v.pedidos, faturamento: a.faturamento + v.faturamento }), { pedidos: 0, faturamento: 0 })
const entre = (vs: VendaDia[], ini: string, fim: string) => vs.filter((v) => v.data >= ini && v.data <= fim)
const variacao = (agora: number, antes: number) => (antes ? ((agora - antes) / antes) * 100 : 0)

export default function PainelPedidos({ unidade, avaliacoes }: { unidade: string; avaliacoes: Avaliacao[] }) {
  const { store, unidades } = useApp()
  const [todas, setTodas] = useState<VendaDia[]>([])
  const hj = hoje()
  const seg = inicioDaSemana(hj)
  const decorridos = Math.round((new Date(hj + 'T12:00').getTime() - new Date(seg + 'T12:00').getTime()) / 864e5) + 1

  useEffect(() => {
    store.vendasEntre(addDias(seg, -7 * (SEMANAS - 1)), hj).then(setTodas)
  }, [store, seg, hj])

  const r = useMemo(() => resumir(todas.filter((v) => !unidade || v.unidadeId === unidade), seg, hj, decorridos), [todas, unidade, seg, hj, decorridos])
  const lojas = unidade ? [] : unidades.map((u) => ({ u, r: resumir(todas.filter((v) => v.unidadeId === u.id), seg, hj, decorridos) }))
  const comparacao = `vs ${DIAS[0].toLowerCase()} a ${DIAS[decorridos - 1].toLowerCase()} da semana passada`
  const { ordenada: canais, cabecalho } = useOrdem(CANAIS, {
    ordem: (c) => CANAIS.indexOf(c), nome: (c) => c.nome, pedidos: (c) => r.canais[c.valor].pedidos, pct: (c) => r.canais[c.valor].pedidos, faturado: (c) => r.canais[c.valor].faturamento,
    ticket: (c) => r.canais[c.valor].faturamento / (r.canais[c.valor].pedidos || 1), vs: (c) => variacao(r.canais[c.valor].pedidos, r.canaisPassada[c.valor].pedidos),
  }, { col: 'ordem' })

  if (!todas.length) return <p className="text-sm text-stone-500">Carregando pedidos…</p>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi nome="Pedidos na semana" valor={numero(r.semana.pedidos)} delta={variacao(r.semana.pedidos, r.passada.pedidos)} comparacao={comparacao} destaque />
        <Kpi nome="Faturado na semana" valor={moeda(r.semana.faturamento)} delta={variacao(r.semana.faturamento, r.passada.faturamento)} comparacao={comparacao} />
        <Kpi nome="Ticket médio" valor={moeda(r.semana.faturamento / (r.semana.pedidos || 1))} delta={variacao(r.semana.faturamento / (r.semana.pedidos || 1), r.passada.faturamento / (r.passada.pedidos || 1))} comparacao={comparacao} />
        <div className="rounded-2xl bg-ozzy-100 p-3 ring-1 ring-ozzy-600/40">
          <div className="text-sm text-stone-600">Estimativa até domingo</div>
          <div className="mt-1 text-3xl font-bold">~{numero(r.estimativa.pedidos)}</div>
          <div className="mt-0.5 text-xs font-medium text-stone-600">
            pedidos · {moeda(r.estimativa.faturamento)} · média das 4 anteriores: {numero(r.media4)}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloco titulo="Pedidos por semana" subtitulo="Esta semana até hoje, com a estimativa até domingo">
          <Legenda
            itens={[
              { nome: 'Semanas anteriores', cor: COR_SEMANA.anterior },
              { nome: 'Esta semana', cor: COR_SEMANA.atual },
              { nome: 'Estimativa', cor: COR_SEMANA.estimativa },
            ]}
          />
          <div className="mt-2">
            <ColunasSemanas semanas={r.semanas} />
          </div>
        </Bloco>
        <Bloco titulo="Pedidos por dia" subtitulo="Esta semana comparada com a semana passada">
          <Legenda
            itens={[
              { nome: 'Esta semana', cor: TINTA.forte, tipo: 'linha' },
              { nome: 'Semana passada', cor: '#a8a29e', tipo: 'linha' },
            ]}
          />
          <div className="mt-2">
            <LinhasDias
              rotulos={DIAS}
              series={[
                { nome: 'Semana passada', cor: '#a8a29e', valores: r.diasPassada },
                { nome: 'Esta semana', cor: TINTA.forte, valores: r.diasSemana },
              ]}
            />
          </div>
        </Bloco>
      </div>

      <Bloco titulo="Pedidos por canal" subtitulo="Participação de cada canal nos pedidos desta semana">
        <Legenda itens={CANAIS.map((c) => ({ nome: c.nome, cor: c.cor }))} />
        <div className="mt-3 space-y-3">
          {(unidade ? [{ nome: apelidoUnidade(unidades.find((u) => u.id === unidade)?.nome ?? ''), r }] : [...lojas.map((l) => ({ nome: apelidoUnidade(l.u.nome), r: l.r })), { nome: 'Todas as lojas', r }]).map((l) => (
            <div key={l.nome} className="grid items-center gap-1 sm:grid-cols-[11rem_1fr] sm:gap-3">
              <div className="truncate text-sm font-semibold">{l.nome}</div>
              <BarraParticipacao
                rotulo={l.nome}
                fatias={CANAIS.map((c) => ({
                  nome: c.nome,
                  cor: c.cor,
                  valor: l.r.canais[c.valor].pedidos,
                  tintaClara: TINTA_CLARA.includes(c.valor),
                  detalhe: `${numero(l.r.canais[c.valor].pedidos)} pedidos · ${moeda(l.r.canais[c.valor].faturamento)}`,
                }))}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm tabular-nums">
            <thead>
              <tr className="border-b border-stone-200 text-left text-stone-500">
                {cabecalho('nome', 'Canal', 'pl-0! pr-3!')}
                {cabecalho('pedidos', 'Pedidos', 'px-2! text-right', true)}
                {cabecalho('pct', '% dos pedidos', 'px-2! text-right', true)}
                {cabecalho('faturado', 'Faturado', 'px-2! text-right', true)}
                {cabecalho('ticket', 'Ticket', 'px-2! text-right', true)}
                {cabecalho('vs', 'vs semana passada', 'pl-2! pr-0! text-right', true)}
              </tr>
            </thead>
            <tbody>
              {canais.map((c) => {
                const v = r.canais[c.valor]
                const antes = r.canaisPassada[c.valor]
                return (
                  <tr key={c.valor} className="border-b border-stone-100 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-2 font-semibold">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.cor }} />
                        {c.nome}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">{numero(v.pedidos)}</td>
                    <td className="px-2 py-2 text-right">{pct((v.pedidos / (r.semana.pedidos || 1)) * 100)}</td>
                    <td className="px-2 py-2 text-right">{moeda(v.faturamento)}</td>
                    <td className="px-2 py-2 text-right">{moeda(v.faturamento / (v.pedidos || 1))}</td>
                    <td className="py-2 pl-2 text-right">
                      <Delta valor={variacao(v.pedidos, antes.pedidos)} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Bloco>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        {!unidade && (
          <Bloco titulo="Por loja" subtitulo={`Semana até hoje, ${comparacao}`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-stone-500">
                    <th className="py-2 pr-3 font-semibold">Loja</th>
                    <th className="px-2 py-2 text-right font-semibold">Pedidos</th>
                    <th className="px-2 py-2 text-right font-semibold">vs</th>
                    <th className="px-2 py-2 text-right font-semibold">Faturado</th>
                    <th className="px-2 py-2 text-right font-semibold">Ticket</th>
                    <th className="px-2 py-2 text-right font-semibold">iFood</th>
                    <th className="py-2 pl-2 text-right font-semibold">99Food</th>
                  </tr>
                </thead>
                <tbody>
                  {lojas.map(({ u, r: lr }) => {
                    const nota = (p: string) => avaliacoes.find((a) => a.unidadeId === u.id && a.plataforma === p)?.nota
                    return (
                      <tr key={u.id} className="border-b border-stone-100 last:border-0">
                        <td className="py-2 pr-3 font-semibold">{apelidoUnidade(u.nome)}</td>
                        <td className="px-2 py-2 text-right">{numero(lr.semana.pedidos)}</td>
                        <td className="px-2 py-2 text-right">
                          <Delta valor={variacao(lr.semana.pedidos, lr.passada.pedidos)} />
                        </td>
                        <td className="px-2 py-2 text-right">{moeda(lr.semana.faturamento)}</td>
                        <td className="px-2 py-2 text-right">{moeda(lr.semana.faturamento / (lr.semana.pedidos || 1))}</td>
                        <td className="px-2 py-2 text-right">{nota('ifood')?.toLocaleString('pt-BR', { minimumFractionDigits: 1 }) ?? '—'} ★</td>
                        <td className="py-2 pl-2 text-right">{nota('99food')?.toLocaleString('pt-BR', { minimumFractionDigits: 1 }) ?? '—'} ★</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Bloco>
        )}
        <Bloco titulo="Destaques" subtitulo="Calculados automaticamente">
          <ul className="space-y-2.5 text-sm">
            <li>
              <span className="font-semibold">Dia mais forte:</span> {NOMES_DIA[r.melhorDia.dia]}, com média de {numero(r.melhorDia.media)} pedidos nas últimas 4 semanas.
            </li>
            <li>
              <span className="font-semibold">Canal que mais cresceu:</span> {r.canalAlta.nome} ({r.canalAlta.v >= 0 ? '+' : '−'}
              {pct(Math.abs(r.canalAlta.v))} vs semana passada).
            </li>
            <li>
              <span className="font-semibold">Delivery:</span> {pct(r.delivery)} dos pedidos da semana (iFood, 99Food e delivery próprio).
            </li>
            {!unidade && lojas.length > 0 && (() => {
              const top = [...lojas].sort((a, b) => variacao(b.r.semana.pedidos, b.r.passada.pedidos) - variacao(a.r.semana.pedidos, a.r.passada.pedidos))[0]
              const v = variacao(top.r.semana.pedidos, top.r.passada.pedidos)
              return (
                <li>
                  <span className="font-semibold">Loja em maior alta:</span> {apelidoUnidade(top.u.nome)} ({v >= 0 ? '+' : '−'}
                  {pct(Math.abs(v))}).
                </li>
              )
            })()}
          </ul>
        </Bloco>
      </div>

      <p className="text-xs text-stone-500">
        Números de exemplo. Os reais vão vir do PDV, do iFood e da 99Food. A estimativa usa o ritmo desta semana sobre a média das 4 semanas anteriores para os dias que faltam.
      </p>
    </div>
  )
}

function resumir(vs: VendaDia[], seg: string, hj: string, decorridos: number) {
  const semana = soma(entre(vs, seg, hj))
  const passada = soma(entre(vs, addDias(seg, -7), addDias(seg, decorridos - 8)))
  const porDia = (d: string) => soma(vs.filter((v) => v.data === d))

  // Média do mesmo dia da semana nas 4 semanas anteriores.
  const mediaDia = (k: number) => {
    const xs = [1, 2, 3, 4].map((s) => porDia(addDias(seg, k - 7 * s)))
    return { pedidos: xs.reduce((a, x) => a + x.pedidos, 0) / 4, faturamento: xs.reduce((a, x) => a + x.faturamento, 0) / 4 }
  }
  const medias = DIAS.map((_, k) => mediaDia(k))
  const esperadoAteHoje = medias.slice(0, decorridos).reduce((a, m) => a + m.pedidos, 0)
  const ritmo = esperadoAteHoje ? semana.pedidos / esperadoAteHoje : 1
  const falta = medias.slice(decorridos)
  const estimativa = {
    pedidos: semana.pedidos + ritmo * falta.reduce((a, m) => a + m.pedidos, 0),
    faturamento: semana.faturamento + ritmo * falta.reduce((a, m) => a + m.faturamento, 0),
  }
  const media4 = medias.reduce((a, m) => a + m.pedidos, 0)
  const melhor = medias.reduce((b, m, k) => (m.pedidos > b.media ? { dia: k, media: m.pedidos } : b), { dia: 0, media: -1 })

  const semanas: Semana[] = Array.from({ length: SEMANAS }, (_, i) => {
    const ini = addDias(seg, -7 * (SEMANAS - 1 - i))
    const atual = i === SEMANAS - 1
    const t = soma(entre(vs, ini, atual ? hj : addDias(ini, 6)))
    return {
      rotulo: dataCurta(ini),
      periodo: atual ? `Esta semana (${dataCurta(ini)} a ${dataCurta(hj)})` : `${dataCurta(ini)} a ${dataCurta(addDias(ini, 6))}`,
      pedidos: t.pedidos,
      faturamento: t.faturamento,
      atual,
      estimativa: atual ? Math.round(estimativa.pedidos - t.pedidos) : undefined,
    }
  })

  const porCanal = (lista: VendaDia[]) =>
    Object.fromEntries(CANAIS.map((c) => [c.valor, soma(lista.filter((v) => v.canal === c.valor))])) as Record<Canal, { pedidos: number; faturamento: number }>
  const canais = porCanal(entre(vs, seg, hj))
  const canaisPassada = porCanal(entre(vs, addDias(seg, -7), addDias(seg, decorridos - 8)))
  const canalAlta = CANAIS.map((c) => ({ nome: c.nome, v: variacao(canais[c.valor].pedidos, canaisPassada[c.valor].pedidos) })).sort((a, b) => b.v - a.v)[0]
  const delivery = ((semana.pedidos - canais.salao.pedidos) / (semana.pedidos || 1)) * 100

  return {
    semana,
    passada,
    estimativa,
    media4,
    melhorDia: melhor,
    semanas,
    diasSemana: DIAS.map((_, k) => (k < decorridos ? porDia(addDias(seg, k)).pedidos : null)),
    diasPassada: DIAS.map((_, k) => porDia(addDias(seg, k - 7)).pedidos),
    canais,
    canaisPassada,
    canalAlta,
    delivery,
  }
}

function Delta({ valor }: { valor: number }) {
  const v = Math.round(valor)
  if (v === 0) return <span className="text-stone-500">igual</span>
  return (
    <span className={v > 0 ? 'text-emerald-700' : 'text-red-700'}>
      {v > 0 ? '▲' : '▼'} {pct(Math.abs(v))}
    </span>
  )
}

function Kpi({ nome, valor, delta, comparacao, destaque = false }: { nome: string; valor: string; delta: number; comparacao: string; destaque?: boolean }) {
  const v = Math.round(delta)
  const cor = v === 0 ? (destaque ? 'text-stone-400' : 'text-stone-500') : v > 0 ? (destaque ? 'text-emerald-300' : 'text-emerald-700') : destaque ? 'text-red-300' : 'text-red-700'
  return (
    <div className={`min-w-0 rounded-2xl p-3 ${destaque ? 'bg-carvao text-white' : 'bg-stone-50 ring-1 ring-stone-200'}`}>
      <div className={`text-sm ${destaque ? 'text-stone-300' : 'text-stone-500'}`}>{nome}</div>
      <div className={`mt-1 truncate text-2xl font-bold sm:text-3xl ${destaque ? 'text-ozzy-400' : ''}`}>{valor}</div>
      <div className={`mt-0.5 text-xs font-medium ${cor}`}>
        {v === 0 ? 'igual' : `${v > 0 ? '▲' : '▼'} ${pct(Math.abs(v))}`} <span className={destaque ? 'text-stone-400' : 'text-stone-500'}>{comparacao}</span>
      </div>
    </div>
  )
}

export function Bloco({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl p-3 ring-1 ring-stone-200 sm:p-4">
      <h4 className="font-bold">{titulo}</h4>
      {subtitulo && <p className="mb-3 text-xs text-stone-500">{subtitulo}</p>}
      {children}
    </div>
  )
}
