import { useCallback, useEffect, useState } from 'react'
import { Botao, Campo, Cartao, Modal, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { addDias, dataCurta, diaSemana, hoje } from '../lib/datas'
import { isentoDeRotinas, podeGerenciar } from '../lib/permissoes'
import { BaterPonto, Espelho, IncluirMarcacao, PontoEquipe } from '../components/PontoPortal'
import { TIPOS_AJUSTE_PONTO, type AjustePonto, type TipoAjustePonto } from '../lib/types'

const nomeTipo = (t: TipoAjustePonto) => TIPOS_AJUSTE_PONTO.find((x) => x.valor === t)?.nome ?? t
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

// Ponto pelo portal (Heitor, 13/10; antes era o Control iD): a pessoa bate aqui ou na Início, vê o próprio espelho
// e pede ajuste quando esqueceu. A gestão vê a equipe, inclui ou desconsidera marcações (com motivo) e exporta o mês.
export default function Ponto({ codigo }: { codigo?: string }) {
  const { eu, store, nomeDe, avisar } = useApp()
  const gestao = podeGerenciar(eu.nivel)
  const [visao, setVisao] = useState<'pendente' | 'todos'>('pendente')
  const [ajustes, setAjustes] = useState<AjustePonto[]>([])
  const [meus, setMeus] = useState<AjustePonto[]>([])
  const [pedir, setPedir] = useState(false)
  const [incluir, setIncluir] = useState<AjustePonto | null>(null)
  const [aba, setAba] = useState<'meu' | 'equipe' | 'ajustes'>(gestao ? 'equipe' : 'meu')

  const carregar = useCallback(async () => {
    if (gestao) setAjustes(await store.ajustesPonto(visao))
    if (!isentoDeRotinas(eu.nivel)) setMeus(await store.ajustesPonto('meus'))
  }, [store, gestao, visao, eu.nivel])
  useEffect(() => {
    carregar()
  }, [carregar])

  const resolver = async (a: AjustePonto, status: 'feito' | 'recusado') => {
    let resposta = ''
    if (status === 'recusado') {
      const r = prompt('Por que não vai ajustar? A pessoa vê esta resposta.')
      if (r === null) return
      resposta = r
    }
    await store.resolverAjustePonto(a.id, status, resposta)
    await carregar()
    avisar(status === 'feito' ? 'Marcado como ajustado' : 'Pedido recusado')
  }

  const pendentes = ajustes.filter((a) => a.status === 'pendente').length
  const abas = [
    ...(!isentoDeRotinas(eu.nivel) ? [['meu', 'Meu ponto'] as const] : []),
    ...(gestao ? [['equipe', 'Equipe'] as const, ['ajustes', `Pedidos de ajuste${pendentes ? ` (${pendentes})` : ''}`] as const] : []),
  ]

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Ponto</h1>
      {!isentoDeRotinas(eu.nivel) && <BaterPonto codigo={codigo} />}
      {abas.length > 1 && (
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-stone-200 p-1 text-sm font-semibold">
          {abas.map(([id, nome]) => (
            <button key={id} onClick={() => setAba(id)} className={`shrink-0 flex-1 rounded-lg px-3 py-2 whitespace-nowrap ${aba === id ? 'bg-white shadow-sm' : 'text-stone-600'}`}>{nome}</button>
          ))}
        </div>
      )}

      {aba === 'meu' && !isentoDeRotinas(eu.nivel) && (
        <>
          <section className="space-y-2">
            <h2 className="font-bold">Minhas marcações</h2>
            <Espelho funcionarioId={eu.id} />
          </section>
          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-bold">Meus pedidos de ajuste</h2>
                <p className="text-sm text-stone-500">Esqueceu de bater ou saiu errado? Peça o ajuste: a gestão inclui a marcação.</p>
              </div>
              <Botao variante="secundario" onClick={() => setPedir(true)}>Pedir ajuste no ponto</Botao>
            </div>
            {meus.length === 0 ? (
              <Vazio>Você ainda não pediu nenhum ajuste.</Vazio>
            ) : (
              meus.map((a) => (
                <Cartao key={a.id}>
                  <div className="flex items-start justify-between gap-3">
                    <LinhaAjuste a={a} />
                    <div className="flex flex-col items-end gap-1">
                      <SeloStatus a={a} />
                      {a.status === 'pendente' && (
                        <button
                          className="text-xs font-semibold text-stone-500 underline"
                          onClick={async () => {
                            await store.excluirAjustePonto(a.id)
                            await carregar()
                            avisar('Pedido cancelado')
                          }}
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                </Cartao>
              ))
            )}
          </section>
        </>
      )}

      {aba === 'equipe' && gestao && <PontoEquipe />}

      {aba === 'ajustes' && gestao && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold">Pedidos da equipe</h2>
            <div className="flex rounded-xl bg-stone-200 p-1 text-sm font-semibold">
              {(['pendente', 'todos'] as const).map((v) => (
                <button key={v} onClick={() => setVisao(v)} className={`rounded-lg px-3 py-1.5 ${visao === v ? 'bg-white shadow-sm' : 'text-stone-600'}`}>
                  {v === 'pendente' ? 'Para ajustar' : 'Todos'}
                </button>
              ))}
            </div>
          </div>
          {ajustes.length === 0 ? (
            <Vazio>{visao === 'pendente' ? 'Nenhum ajuste esperando.' : 'Nenhum pedido ainda.'}</Vazio>
          ) : (
            ajustes.map((a) => (
              <Cartao key={a.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold">{nomeDe(a.funcionarioId)}</div>
                    <LinhaAjuste a={a} />
                    <div className="mt-1 text-xs text-stone-500">
                      Pedido em {quando(a.criadoEm)}
                      {a.resolvidoPor && ` · ${a.status === 'feito' ? 'ajustado' : 'recusado'} por ${nomeDe(a.resolvidoPor)} em ${quando(a.resolvidoEm!)}`}
                    </div>
                  </div>
                  {a.status === 'pendente' ? (
                    <div className="flex gap-2">
                      <Botao variante="secundario" onClick={() => resolver(a, 'recusado')}>Recusar</Botao>
                      <Botao onClick={() => setIncluir(a)}>Incluir no ponto</Botao>
                    </div>
                  ) : (
                    <SeloStatus a={a} />
                  )}
                </div>
              </Cartao>
            ))
          )}
        </section>
      )}

      {incluir && (
        <IncluirMarcacao funcionarioId={incluir.funcionarioId} ajuste={incluir} aoFechar={() => setIncluir(null)}
          aoSalvar={async () => { setIncluir(null); await carregar() }} />
      )}
      {pedir && (
        <PedirAjuste
          aoFechar={() => setPedir(false)}
          aoSalvar={async () => {
            setPedir(false)
            await carregar()
            avisar('Pedido enviado para a gestão')
          }}
        />
      )}
    </div>
  )
}

function LinhaAjuste({ a }: { a: AjustePonto }) {
  return (
    <div className="min-w-0 text-sm">
      <div>
        <b>{diaSemana(a.data)} {dataCurta(a.data)}</b> · {nomeTipo(a.tipo)}
        {a.horario && <> · horário certo <b>{a.horario}</b></>}
      </div>
      {a.motivo && <div className="text-stone-600">{a.motivo}</div>}
      {a.status === 'recusado' && a.resposta && <div className="text-red-700">Resposta: {a.resposta}</div>}
    </div>
  )
}

function SeloStatus({ a }: { a: AjustePonto }) {
  return a.status === 'feito' ? <Selo cor="verde">Ajustado</Selo> : a.status === 'recusado' ? <Selo cor="vermelho">Recusado</Selo> : <Selo cor="ambar">Esperando</Selo>
}

function PedirAjuste({ aoFechar, aoSalvar }: { aoFechar: () => void; aoSalvar: () => void }) {
  const { store } = useApp()
  const [data, setData] = useState(hoje())
  const [tipo, setTipo] = useState<TipoAjustePonto>('esqueci_saida')
  const [horario, setHorario] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (tipo === 'outro' && !motivo.trim()) return setErro('Conte o que aconteceu.')
    setErro('')
    setEnviando(true)
    try {
      await store.pedirAjustePonto({ data, tipo, horario: horario || null, motivo })
      aoSalvar()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Pedir ajuste no ponto" aberto aoFechar={aoFechar}>
      <form onSubmit={enviar} className="space-y-4">
        <Campo rotulo="O que aconteceu?">
          <select className={estiloEntrada} value={tipo} onChange={(e) => setTipo(e.target.value as TipoAjustePonto)}>
            {TIPOS_AJUSTE_PONTO.map((t) => <option key={t.valor} value={t.valor}>{t.nome}</option>)}
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Dia">
            <input className={estiloEntrada} type="date" value={data} max={hoje()} min={addDias(hoje(), -45)} onChange={(e) => setData(e.target.value)} required />
          </Campo>
          <Campo rotulo="Horário certo">
            <input className={estiloEntrada} type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
          </Campo>
        </div>
        <Campo rotulo="Explique (opcional)">
          <textarea className={estiloEntrada} rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Campo>
        <p className="text-xs text-stone-500">Atraso não é ajuste de ponto: justifique o atraso com a gerente.</p>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar para a gestão'}</Botao>
      </form>
    </Modal>
  )
}
