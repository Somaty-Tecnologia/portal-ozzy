import { useCallback, useEffect, useMemo, useState } from 'react'
import qrcode from 'qrcode-generator'
import { Botao, Modal, Selo, Vazio } from './ui'
import { useApp } from '../lib/contexto'
import { addDias, dataCurta, diaSemana, hoje } from '../lib/datas'
import { reais } from '../lib/financeiro'
import { apelidoUnidade, calcularMotoboy, type EnvioMotoboy, type EscalaMotoboy, type Motoboy } from '../lib/types'
import { linkMotoboy } from '../pages/EnviarMotoboy'

// Conferência dos dias que os motoboys mandaram pelo link (Heitor, 12/10): a gestão olha as fotos das notinhas,
// conta, ajusta o número de entregas se precisar e aprova. O dia aprovado entra sozinho no Pagamento da semana.
export default function ConferirMotoboys({ motoboys, aoMudar }: { motoboys: Motoboy[]; aoMudar: () => Promise<void> }) {
  const { store, nomeUnidade, avisar } = useApp()
  const [envios, setEnvios] = useState<EnvioMotoboy[] | null>(null)
  const [escala, setEscala] = useState<EscalaMotoboy[]>([])
  const [ver, setVer] = useState<'pendente' | 'resolvidos'>('pendente')
  const [abrindo, setAbrindo] = useState<EnvioMotoboy | null>(null)
  const de = addDias(hoje(), -30)
  const carregar = useCallback(async () => {
    try {
      const [e, s] = await Promise.all([store.enviosMotoboys(de, hoje()), store.escalaMotoboys(de, hoje()).catch(() => [])])
      setEnvios(e)
      setEscala(s)
    } catch (e) {
      avisar((e as Error).message)
    }
  }, [store, de, avisar])
  useEffect(() => { carregar() }, [carregar])
  const porId = useMemo(() => new Map(motoboys.map((m) => [m.id, m])), [motoboys])

  if (!envios) return <p className="text-stone-400">Carregando…</p>
  const pendentes = envios.filter((e) => e.status === 'pendente')
  const lista = (ver === 'pendente' ? pendentes : envios.filter((e) => e.status !== 'pendente').reverse())
  const mudou = async () => { setAbrindo(null); await carregar(); await aoMudar() }

  return (
    <div className="space-y-3">
      <LinkMotoboys />
      <div className="flex gap-2">
        {([['pendente', `A conferir (${pendentes.length})`], ['resolvidos', 'Conferidos']] as const).map(([v, nome]) => (
          <button key={v} onClick={() => setVer(v)}
            className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${ver === v ? 'bg-carvao text-white ring-carvao' : 'bg-white text-stone-600 ring-stone-300'}`}>{nome}</button>
        ))}
      </div>
      {lista.length === 0 ? (
        <Vazio>{ver === 'pendente' ? 'Nenhum dia esperando conferência.' : 'Nada conferido nos últimos 30 dias.'}</Vazio>
      ) : (
        <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
          {lista.map((e) => {
            const m = porId.get(e.motoboyId)
            const naEscala = escala.some((x) => x.motoboyId === e.motoboyId && x.data === e.data)
            const outraLoja = envios.find((x) => x.id !== e.id && x.motoboyId === e.motoboyId && x.data === e.data && x.status !== 'recusado')
            return (
              <button key={e.id} onClick={() => setAbrindo(e)} className="block w-full px-3 py-2.5 text-left hover:bg-stone-50">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{m?.nome ?? 'Motoboy'}</span>
                  <span className="text-sm text-stone-500">{apelidoUnidade(nomeUnidade(e.unidadeId))} · {diaSemana(e.data).toLowerCase()} {dataCurta(e.data)}</span>
                  {e.status === 'aprovado' && <Selo cor="verde">Aprovado · {e.entregasConferidas} entregas</Selo>}
                  {e.status === 'recusado' && <Selo cor="vermelho">Recusado</Selo>}
                </div>
                <div className="text-sm text-stone-600">
                  {e.entregas} {e.entregas === 1 ? 'entrega' : 'entregas'} · {e.fotos.length} {e.fotos.length === 1 ? 'foto' : 'fotos'}
                  {e.extras.length > 0 && ` · a mais: ${e.extras.map((x) => `${x.descricao} ${reais(x.valor)}`).join(', ')}`}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {!naEscala && <span className="font-semibold text-amber-700">Não estava na escala</span>}
                  {outraLoja && <span className="font-semibold text-red-700">Também mandou este dia em {apelidoUnidade(nomeUnidade(outraLoja.unidadeId))}</span>}
                  {e.observacao && <span className="text-stone-500">“{e.observacao}”</span>}
                  {e.motivo && <span className="text-red-700">Motivo: {e.motivo}</span>}
                </div>
              </button>
            )
          })}
        </div>
      )}
      {abrindo && <Conferencia envio={abrindo} motoboy={porId.get(abrindo.motoboyId)} aoFechar={() => setAbrindo(null)} aoMudar={mudou} />}
    </div>
  )
}

function Conferencia({ envio: e, motoboy: m, aoFechar, aoMudar }: { envio: EnvioMotoboy; motoboy?: Motoboy; aoFechar: () => void; aoMudar: () => Promise<void> }) {
  const { store, nomeUnidade, avisar } = useApp()
  const [urls, setUrls] = useState<string[] | null>(null)
  const [contadas, setContadas] = useState(e.entregasConferidas ?? e.entregas)
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => {
    store.fotosEnvioMotoboy(e.fotos).then(setUrls, () => setUrls([]))
  }, [store, e.fotos])

  const resolver = async (aprovar: boolean) => {
    let motivo = ''
    if (!aprovar) {
      motivo = prompt('Por que está recusando? (o motoboy pode mandar de novo)')?.trim() ?? ''
      if (!motivo) return
    } else if (contadas !== e.entregas) {
      motivo = `Disse ${e.entregas}, conferido ${contadas}`
    }
    setOcupado(true)
    try {
      await store.resolverEnvioMotoboy(e.id, aprovar, aprovar ? contadas : null, motivo)
      avisar(aprovar ? 'Aprovado: já está no pagamento da semana' : 'Recusado')
      await aoMudar()
    } catch (err) {
      avisar((err as Error).message)
      setOcupado(false)
    }
  }
  const reabrir = async () => {
    setOcupado(true)
    try {
      await store.reabrirEnvioMotoboy(e.id)
      await aoMudar()
    } catch (err) {
      avisar((err as Error).message)
      setOcupado(false)
    }
  }
  const c = calcularMotoboy(m, { [e.data]: contadas })

  return (
    <Modal titulo={`${m?.nome ?? 'Motoboy'} · ${dataCurta(e.data)}`} aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        <div className="text-sm text-stone-600">
          {apelidoUnidade(nomeUnidade(e.unidadeId))} · {diaSemana(e.data)} · mandou às {new Date(e.enviadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
          {e.observacao && <div className="mt-1 rounded-lg bg-stone-50 px-2 py-1">“{e.observacao}”</div>}
          {e.extras.map((x, i) => <div key={i}>A mais: <b>{x.descricao}</b> {reais(x.valor)}</div>)}
        </div>
        <p className="text-xs text-stone-500">Conte as notinhas nas fotos (toque na foto para abrir grande). Se a conta não bater, ajuste o número antes de aprovar.</p>
        {urls === null ? <p className="text-stone-400">Carregando fotos…</p> : urls.length === 0 ? <Vazio>Sem fotos.</Vazio> : (
          <div className="grid grid-cols-2 gap-2">
            {urls.map((u, i) => (
              <a key={i} href={u} target="_blank" rel="noreferrer" className="block">
                <img src={u} alt={`Notinha ${i + 1}`} className="w-full rounded-lg ring-1 ring-stone-200" loading="lazy" />
              </a>
            ))}
          </div>
        )}
        {e.status === 'pendente' ? (
          <div className="sticky bottom-0 space-y-2 rounded-xl bg-white p-3 shadow-lg ring-1 ring-stone-300">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm">Disse <b>{e.entregas}</b>. Conferidas:</span>
              <div className="flex items-center gap-1">
                <button className="grid size-9 place-items-center rounded-lg bg-stone-100 text-lg font-bold" onClick={() => setContadas(Math.max(0, contadas - 1))} aria-label="Uma a menos">−</button>
                <span className={`w-10 text-center text-xl font-bold ${contadas !== e.entregas ? 'text-amber-700' : ''}`}>{contadas}</span>
                <button className="grid size-9 place-items-center rounded-lg bg-stone-100 text-lg font-bold" onClick={() => setContadas(contadas + 1)} aria-label="Uma a mais">+</button>
              </div>
            </div>
            <p className="text-xs text-stone-500">
              Dia: {reais(c.diarias)} de diária{c.entregasExtras > 0 ? ` + ${c.entregasExtras} × ${reais(m?.valorEntrega ?? 4)} = ${reais(c.diarias + c.entregas)}` : ''}
              {e.extras.length > 0 && ` + a mais ${reais(e.extras.reduce((t, x) => t + x.valor, 0))}`}
            </p>
            <div className="flex gap-2">
              <Botao variante="perigo" className="flex-1" disabled={ocupado} onClick={() => resolver(false)}>Recusar</Botao>
              <Botao className="flex-[2]" disabled={ocupado} onClick={() => resolver(true)}>Aprovar {contadas} {contadas === 1 ? 'entrega' : 'entregas'}</Botao>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-stone-50 p-3 text-sm">
            <span>{e.status === 'aprovado' ? `Aprovado com ${e.entregasConferidas} entregas` : 'Recusado'}{e.motivo ? ` · ${e.motivo}` : ''}</span>
            <Botao variante="secundario" className="py-1.5!" disabled={ocupado} onClick={reabrir}>Voltar para conferir</Botao>
          </div>
        )}
      </div>
    </Modal>
  )
}

// Link e QR Code para mandar no grupo dos motoboys ou colar na loja.
function LinkMotoboys() {
  const { avisar } = useApp()
  const link = linkMotoboy()
  const qr = useMemo(() => {
    const q = qrcode(0, 'M')
    q.addData(link)
    q.make()
    return q.createDataURL(6, 2)
  }, [link])
  return (
    <details className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
      <summary className="cursor-pointer text-sm font-semibold">Link para os motoboys mandarem o dia</summary>
      <p className="mt-2 text-sm text-stone-600">
        Mande no grupo dos motoboys. No fim do turno, cada um entra com o celular do cadastro, escolhe a loja e o dia, diz quantas entregas fez,
        manda as fotos das notinhas e algum valor a mais. Chega aqui para conferir; o que for aprovado entra sozinho no Pagamento.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Botao variante="secundario" className="py-1.5!" onClick={() => navigator.clipboard.writeText(link).then(() => avisar('Link copiado'), () => avisar('Não deu para copiar neste aparelho'))}>Copiar link</Botao>
        <a href={link} target="_blank" rel="noreferrer" className="text-sm font-semibold text-sky-700">Abrir</a>
        <img src={qr} alt="QR Code do link dos motoboys" className="h-28 w-28" style={{ imageRendering: 'pixelated' }} />
      </div>
    </details>
  )
}
