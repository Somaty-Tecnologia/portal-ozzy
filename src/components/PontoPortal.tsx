import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import qrcode from 'qrcode-generator'
import { Botao, Campo, Modal, Selo, Vazio, estiloEntrada } from './ui'
import Impressao from './Impressao'
import { useApp } from '../lib/contexto'
import { addDias, addMeses, dataCurta, diaSemana, hoje, ultimoDia } from '../lib/datas'
import { pegarLocalizacao } from '../lib/store'
import { baixar, csv } from '../lib/salarios'
import { diaSP, horaSP, horas, jornadas, momentoSP } from '../lib/ponto'
import { ir } from '../lib/rota'
import { apelidoUnidade, NOME_MARCACAO, type AjustePonto, type MarcacaoPonto, type TipoMarcacao } from '../lib/types'
import logo from '../assets/logo.png'

// Ponto pelo portal (Heitor, 13/10): um toque no celular. A hora é a do servidor, a localização diz se estava
// na loja (ou o QR Code colado nela), e cada marcação tem número (NSR) e código de conferência.

const TIPOS = Object.keys(NOME_MARCACAO) as TipoMarcacao[]
const codigoCurto = (hash: string) => hash.slice(0, 12).toUpperCase().replace(/(.{4})(?=.)/g, '$1-')
const nsr = (n: number) => String(n).padStart(9, '0')
export const linkQrPonto = (codigo: string) => `${location.origin}${location.pathname}#/rh/ponto/${codigo}`

// ——— Bater o ponto (Início e DP › Ponto) ———

export function BaterPonto({ compacto = false, codigo }: { compacto?: boolean; codigo?: string }) {
  const { store, eu, unidades, avisar } = useApp()
  const [proximo, setProximo] = useState<TipoMarcacao | null>(null)
  const [outro, setOutro] = useState(false)
  const [estado, setEstado] = useState<string | null>(null)
  const [feita, setFeita] = useState<MarcacaoPonto | null>(null)
  const usouQr = useRef<string | null>(null)
  const carregar = useCallback(() => store.meuProximoPonto().then(setProximo, () => setProximo('entrada')), [store])
  useEffect(() => { carregar() }, [carregar])

  const bater = useCallback(async (tipo?: TipoMarcacao, qr?: string) => {
    setEstado('Pegando sua localização…')
    try {
      const local = await pegarLocalizacao()
      setEstado('Registrando…')
      const m = await store.baterPonto(local, qr ?? null, tipo ?? null)
      setFeita(m)
      setOutro(false)
      await carregar()
    } catch (e) {
      avisar((e as Error).message)
    } finally {
      setEstado(null)
    }
  }, [store, carregar, avisar])

  // Escaneou o QR da loja: já bate (uma vez) e tira o código do endereço.
  useEffect(() => {
    if (!codigo || usouQr.current === codigo) return
    usouQr.current = codigo
    bater(undefined, codigo).then(() => ir('rh/ponto'))
  }, [codigo, bater])

  if (!proximo) return null
  const loja = (id: string | null) => apelidoUnidade(unidades.find((u) => u.id === id)?.nome ?? '')

  return (
    <section className={`space-y-3 rounded-2xl bg-carvao p-4 text-white ${compacto ? '' : 'sm:p-5'}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold tracking-wide text-ozzy-400 uppercase">Ponto</div>
          <div className="text-lg font-bold">Próxima: {NOME_MARCACAO[proximo]}</div>
        </div>
        <button disabled={!!estado} onClick={() => bater()}
          className="rounded-2xl bg-ozzy-400 px-6 py-4 text-lg font-extrabold text-carvao shadow-sm transition active:scale-95 disabled:opacity-60">
          {estado ?? 'Bater ponto'}
        </button>
      </div>
      {!outro ? (
        <button className="text-xs text-white/70 underline" onClick={() => setOutro(true)}>Não é {NOME_MARCACAO[proximo].toLowerCase()}? Escolher outro tipo</button>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {/* Heitor, 14/10: gente batia "Entrada" na volta do intervalo. Com a jornada aberta, entrada só como turno novo e com confirmação. */}
          {TIPOS.filter((t) => t !== proximo && !(proximo === 'saida_intervalo' && t === 'volta_intervalo') && !(proximo === 'volta_intervalo' && t === 'saida_intervalo')).map((t) => (
            <button key={t} disabled={!!estado} className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold ring-1 ring-white/30"
              onClick={() => {
                if (t === 'entrada' && proximo !== 'entrada' && !confirm(`Você ainda não bateu a saída do turno de hoje.\n\nSe está voltando do intervalo, use "${NOME_MARCACAO.volta_intervalo}". Bater "Entrada" começa um turno novo. Continuar?`)) return
                bater(t)
              }}>{t === 'entrada' && proximo !== 'entrada' ? 'Entrada de outro turno' : NOME_MARCACAO[t]}</button>
          ))}
        </div>
      )}
      {feita && (
        <div className="rounded-xl bg-white p-3 text-sm text-carvao">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold">✓ {NOME_MARCACAO[feita.tipo]} às {horaSP(feita.momento)}</span>
            {feita.naLoja ? <Selo cor="verde">Na loja{feita.unidadeId ? ` · ${loja(feita.unidadeId)}` : ''}</Selo> : <Selo cor="ambar">Fora da loja: a gestão vai conferir</Selo>}
          </div>
          <div className="mt-1 text-xs text-stone-500">Comprovante: NSR {nsr(feita.nsr)} · {eu.nome} · {dataCurta(diaSP(feita.momento))} {horaSP(feita.momento)} · código {codigoCurto(feita.hash)}</div>
          {!feita.naLoja && <div className="mt-1 text-xs text-amber-700">Não achamos você dentro da loja{feita.distanciaM != null ? ` (a ${feita.distanciaM >= 1000 ? `${(feita.distanciaM / 1000).toFixed(1)} km` : `${feita.distanciaM} m`})` : ' (sem localização)'}. Se estava lá, ligue a localização ou use o QR Code da loja na próxima.</div>}
        </div>
      )}
      {!compacto && <p className="text-xs text-white/60">A hora é a do servidor, não a do celular. O portal usa a localização só na hora da batida, para saber se você está na loja.</p>}
    </section>
  )
}

// ——— Espelho: jornadas de uma pessoa ———

export function Espelho({ funcionarioId, gestao = false }: { funcionarioId: string; gestao?: boolean }) {
  const { store, unidades, nomeDe, avisar } = useApp()
  const [mes, setMes] = useState(hoje().slice(0, 7))
  const [lista, setLista] = useState<MarcacaoPonto[] | null>(null)
  const [incluir, setIncluir] = useState<{ data: string } | null>(null)
  const de = `${mes}-01`
  const ate = ultimoDia(mes)
  const carregar = useCallback(() => store.marcacoesPonto(funcionarioId, de, addDias(ate, 1)).then(setLista, (e) => avisar((e as Error).message)), [store, funcionarioId, de, ate, avisar])
  useEffect(() => { carregar() }, [carregar])
  const js = useMemo(() => jornadas(lista ?? []).filter((j) => j.data >= de && j.data <= ate).reverse(), [lista, de, ate])
  const desconsideradas = (lista ?? []).filter((m) => m.desconsiderada && diaSP(m.momento) >= de && diaSP(m.momento) <= ate)
  const total = js.reduce((t, j) => t + j.trabalhadoMin, 0)
  const loja = (id: string | null) => apelidoUnidade(unidades.find((u) => u.id === id)?.nome ?? '')
  const desconsiderar = async (m: MarcacaoPonto) => {
    const motivo = prompt(`Desconsiderar ${NOME_MARCACAO[m.tipo].toLowerCase()} de ${horaSP(m.momento)}? A marcação continua guardada. Motivo:`)
    if (!motivo?.trim()) return
    try {
      await store.desconsiderarMarcacao(m.id, motivo)
      await carregar()
    } catch (e) {
      avisar((e as Error).message)
    }
  }
  const meses = Array.from({ length: 6 }, (_, k) => addMeses(hoje().slice(0, 7), -k))

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${estiloEntrada} w-auto! py-2!`} value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mês">
          {meses.map((m) => <option key={m} value={m}>{new Date(`${m}-15`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</option>)}
        </select>
        <span className="text-sm text-stone-600">{js.length} {js.length === 1 ? 'dia' : 'dias'} · {horas(total)} trabalhadas</span>
        {gestao && <Botao variante="secundario" className="ml-auto py-1.5!" onClick={() => setIncluir({ data: hoje() })}>+ Incluir marcação</Botao>}
      </div>
      {!lista ? <p className="text-stone-400">Carregando…</p> : js.length === 0 ? <Vazio>Nenhuma marcação neste mês.</Vazio> : (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs text-stone-500">
              <tr><th className="px-3 py-1.5">Dia</th><th className="px-3 py-1.5">Marcações</th><th className="px-3 py-1.5 text-right">Intervalo</th><th className="px-3 py-1.5 text-right">Trabalhado</th></tr>
            </thead>
            <tbody>
              {js.map((j) => (
                <tr key={j.marcacoes[0].id} className="border-t border-stone-100 align-top">
                  <td className="px-3 py-1.5 whitespace-nowrap">{diaSemana(j.data)} {dataCurta(j.data)}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {j.marcacoes.map((m) => (
                        <span key={m.id} title={`${NOME_MARCACAO[m.tipo]} · NSR ${nsr(m.nsr)} · código ${codigoCurto(m.hash)}${m.motivo ? ` · ${m.motivo}` : ''}${m.unidadeId ? ` · ${loja(m.unidadeId)}` : ''}`}
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-semibold tabular-nums ring-1 ${m.origem === 'ajuste' ? 'bg-sky-50 ring-sky-300' : m.naLoja ? 'bg-stone-50 ring-stone-200' : 'bg-amber-50 ring-amber-400'}`}>
                          {horaSP(m.momento)}{diaSP(m.momento) !== j.data && <span className="text-[10px] text-stone-500">+1</span>}
                          {m.origem === 'qr' && <span className="text-[10px] text-stone-500">QR</span>}
                          {m.origem === 'ajuste' && <span className="text-[10px] text-sky-700">incluída</span>}
                          {!m.naLoja && <span className="text-[10px] text-amber-700">fora</span>}
                          {gestao && <button className="text-stone-400 hover:text-red-600" onClick={() => desconsiderar(m)} aria-label={`Desconsiderar ${horaSP(m.momento)}`}>✕</button>}
                        </span>
                      ))}
                      {j.incompleta && <span className="text-xs text-amber-700">sem saída</span>}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">{j.intervaloMin != null ? horas(j.intervaloMin) : '—'}</td>
                  <td className="px-3 py-1.5 text-right font-semibold whitespace-nowrap">{horas(j.trabalhadoMin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-stone-500">Cinza: na loja. Amarelo: fora da loja. Azul: incluída pela gestão. Passe o dedo ou o mouse na hora para ver o comprovante (NSR e código).</p>
      {desconsideradas.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-stone-600">Desconsideradas: {desconsideradas.length}</summary>
          <ul className="mt-1 space-y-0.5">
            {desconsideradas.map((m) => <li key={m.id}>{dataCurta(diaSP(m.momento))} {horaSP(m.momento)} · {NOME_MARCACAO[m.tipo]} · {m.desconsiderada!.motivo} ({nomeDe(m.desconsiderada!.por)})</li>)}
          </ul>
        </details>
      )}
      {incluir && <IncluirMarcacao funcionarioId={funcionarioId} aoFechar={() => setIncluir(null)} aoSalvar={async () => { setIncluir(null); await carregar() }} />}
    </div>
  )
}

// ——— Gestão: incluir marcação (também resolve o pedido de ajuste) ———

const TIPO_DO_AJUSTE: Record<string, TipoMarcacao> = { esqueci_entrada: 'entrada', esqueci_saida: 'saida' }

export function IncluirMarcacao({ funcionarioId, ajuste, aoFechar, aoSalvar }: { funcionarioId: string; ajuste?: AjustePonto; aoFechar: () => void; aoSalvar: () => void }) {
  const { store, nomeDe, avisar } = useApp()
  const [data, setData] = useState(ajuste?.data ?? hoje())
  const [hora, setHora] = useState(ajuste?.horario ?? '')
  const [tipo, setTipo] = useState<TipoMarcacao>((ajuste && TIPO_DO_AJUSTE[ajuste.tipo]) ?? 'entrada')
  const [motivo, setMotivo] = useState(ajuste ? `Pedido de ajuste: ${ajuste.motivo ?? ajuste.tipo}` : '')
  const [salvando, setSalvando] = useState(false)
  const salvar = async () => {
    if (!hora) return avisar('Coloque o horário.')
    setSalvando(true)
    try {
      await store.incluirMarcacao({ funcionarioId, momento: momentoSP(data, hora), tipo, motivo, ajusteId: ajuste?.id ?? null })
      avisar('Marcação incluída')
      aoSalvar()
    } catch (e) {
      avisar((e as Error).message)
      setSalvando(false)
    }
  }
  return (
    <Modal titulo={`Incluir marcação: ${nomeDe(funcionarioId)}`} aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Dia"><input type="date" className={estiloEntrada} value={data} max={hoje()} onChange={(e) => setData(e.target.value)} /></Campo>
          <Campo rotulo="Horário"><input type="time" className={estiloEntrada} value={hora} onChange={(e) => setHora(e.target.value)} /></Campo>
        </div>
        <Campo rotulo="Tipo">
          <select className={estiloEntrada} value={tipo} onChange={(e) => setTipo(e.target.value as TipoMarcacao)}>
            {TIPOS.map((t) => <option key={t} value={t}>{NOME_MARCACAO[t]}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Motivo (fica registrado)"><input className={estiloEntrada} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
        <p className="text-xs text-stone-500">A marcação incluída aparece em azul no espelho, com quem incluiu e o motivo. Nada é apagado.</p>
        <Botao className="w-full" disabled={salvando || !motivo.trim()} onClick={salvar}>{salvando ? 'Salvando…' : 'Incluir'}</Botao>
      </div>
    </Modal>
  )
}

// ——— Gestão: equipe hoje, exportar e QR das lojas ———

export function PontoEquipe() {
  const { store, equipe, unidades, nomeDe, avisar } = useApp()
  const [dia, setDia] = useState(hoje())
  const [lista, setLista] = useState<MarcacaoPonto[] | null>(null)
  const [pessoa, setPessoa] = useState('')
  useEffect(() => { store.marcacoesPonto(null, addDias(dia, -1), dia).then(setLista, (e) => avisar((e as Error).message)) }, [store, dia, avisar])
  const ativos = equipe.filter((f) => f.status === 'ativo' && f.nivel !== 'proprietario').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const porPessoa = useMemo(() => {
    const m = new Map<string, ReturnType<typeof jornadas>[number]>()
    for (const f of ativos) {
      const j = jornadas((lista ?? []).filter((x) => x.funcionarioId === f.id)).filter((x) => x.data === dia).at(-1)
      if (j) m.set(f.id, j)
    }
    return m
  }, [lista, ativos, dia])
  const loja = (id: string | null) => apelidoUnidade(unidades.find((u) => u.id === id)?.nome ?? '')
  if (pessoa) return (
    <div className="space-y-2">
      <button className="text-sm font-semibold text-stone-600" onClick={() => setPessoa('')}>‹ Equipe</button>
      <h3 className="font-bold">{nomeDe(pessoa)}</h3>
      <Espelho funcionarioId={pessoa} gestao />
    </div>
  )
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" className={`${estiloEntrada} w-auto! py-2!`} value={dia} max={hoje()} onChange={(e) => e.target.value && setDia(e.target.value)} aria-label="Dia" />
        <span className="text-sm text-stone-600">{porPessoa.size} de {ativos.length} bateram ponto</span>
        <span className="ml-auto flex flex-wrap gap-2"><ExportarPonto /><QrDasLojas /><ConferirCorrente /></span>
      </div>
      {!lista ? <p className="text-stone-400">Carregando…</p> : (
        <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
          {ativos.map((f) => {
            const j = porPessoa.get(f.id)
            const fora = j?.marcacoes.filter((m) => !m.naLoja).length ?? 0
            return (
              <button key={f.id} onClick={() => setPessoa(f.id)} className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left hover:bg-stone-50">
                <span className="min-w-40 flex-1 font-semibold">{f.nome} <span className="text-xs font-normal text-stone-500">{loja(f.unidadeId)}</span></span>
                {j ? (
                  <span className="flex flex-wrap items-center gap-1 text-sm tabular-nums">
                    {j.marcacoes.map((m) => <span key={m.id} className={`rounded px-1.5 ${m.naLoja ? 'bg-stone-100' : 'bg-amber-100'}`}>{horaSP(m.momento)}</span>)}
                    {fora > 0 && <Selo cor="ambar">{fora} fora da loja</Selo>}
                    <span className="text-xs text-stone-500">{j.incompleta ? NOME_MARCACAO[j.marcacoes.at(-1)!.tipo].toLowerCase() : horas(j.trabalhadoMin)}</span>
                  </span>
                ) : <span className="text-sm text-stone-400">sem marcação</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ExportarPonto() {
  const { store, equipe, unidades, avisar } = useApp()
  const exportar = async () => {
    const mes = prompt('Exportar as marcações de qual mês? (AAAA-MM)', hoje().slice(0, 7))
    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) return
    try {
      const ms = await store.marcacoesPonto(null, `${mes}-01`, ultimoDia(mes))
      const pessoa = (id: string) => equipe.find((f) => f.id === id)
      baixar(`ponto-${mes}.csv`, csv([
        ['NSR', 'Data', 'Hora', 'Nome', 'CPF', 'Tipo', 'Origem', 'Loja', 'Na loja', 'Distância (m)', 'Motivo', 'Desconsiderada', 'Código'],
        ...ms.map((m) => [nsr(m.nsr), dataCurta(diaSP(m.momento)), horaSP(m.momento), pessoa(m.funcionarioId)?.nome ?? '', pessoa(m.funcionarioId)?.cpf ?? '',
          NOME_MARCACAO[m.tipo], m.origem === 'ajuste' ? 'Incluída' : m.origem === 'qr' ? 'QR Code' : 'Celular', apelidoUnidade(unidades.find((u) => u.id === m.unidadeId)?.nome ?? ''),
          m.naLoja ? 'sim' : 'não', m.distanciaM ?? '', m.motivo ?? '', m.desconsiderada?.motivo ?? '', m.hash]),
      ]))
    } catch (e) {
      avisar((e as Error).message)
    }
  }
  return <Botao variante="secundario" className="py-1.5!" onClick={exportar}>Exportar mês</Botao>
}

function ConferirCorrente() {
  const { store, avisar } = useApp()
  const conferir = async () => {
    try {
      const n = await store.conferirCorrentePonto()
      avisar(n === null ? 'Tudo certo: nenhuma marcação foi alterada no banco.' : `Atenção: a marcação NSR ${nsr(n)} foi alterada fora do portal.`)
    } catch (e) {
      avisar((e as Error).message)
    }
  }
  return <Botao variante="secundario" className="py-1.5!" onClick={conferir}>Conferir integridade</Botao>
}

function QrDasLojas() {
  const { store, unidades, avisar } = useApp()
  const [codigos, setCodigos] = useState<{ unidadeId: string; codigo: string }[] | null>(null)
  const abrir = () => store.codigosPonto().then(setCodigos, (e) => avisar((e as Error).message))
  const qr = (codigo: string) => { const q = qrcode(0, 'M'); q.addData(linkQrPonto(codigo)); q.make(); return q.createDataURL(8, 2) }
  return (
    <>
      <Botao variante="secundario" className="py-1.5!" onClick={abrir}>QR Code das lojas</Botao>
      {codigos && (
        <Impressao titulo="QR Code do ponto" aoFechar={() => setCodigos(null)}>
          {codigos.map((c) => (
            <div key={c.unidadeId} className="flex flex-col items-center gap-5 py-6 text-center" style={{ breakAfter: 'page' }}>
              <img src={logo} alt="The Ozzy" className="h-20 w-20" />
              <div className="text-3xl font-bold">Bater o ponto</div>
              <div className="text-xl">{apelidoUnidade(unidades.find((u) => u.id === c.unidadeId)?.nome ?? c.unidadeId)}</div>
              <img src={qr(c.codigo)} alt="QR Code" className="h-72 w-72" style={{ imageRendering: 'pixelated' }} />
              <div className="max-w-md text-lg">Aponte a câmera do celular. Use quando a localização do celular não estiver funcionando.</div>
            </div>
          ))}
        </Impressao>
      )}
    </>
  )
}
