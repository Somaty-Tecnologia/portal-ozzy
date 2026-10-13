import { useCallback, useEffect, useState } from 'react'
import { Botao, Campo, Cartao, Modal, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { addDias, dataCurta, dataLonga, diaSemana, hoje, tempoDesde } from '../lib/datas'
import { lerNumero, reais } from '../lib/financeiro'
import { ir } from '../lib/rota'
import FichasEvento from './FichasEvento'
import Insumos from './Insumos'
import EstoqueBase from './EstoqueBase'
import ComparativoEventos from './ComparativoEventos'
import PainelEventos from './PainelEventos'
import EquipeEvento from './EquipeEvento'
import FreelasEventos, { FreelasDoEvento } from './FreelasEventos'
import { ABAS_EVENTO, AbasEvento, CardapioPrevisao, InsumosDoEvento, Separacao, Sobras, VendasEvento, useDadosLogistica } from './EventoLogistica'
import { STATUS_EVENTO, nomeStatusEvento, type DiaEvento, type Evento, type HistoricoEvento, type NovoEvento, type Operacao, type StatusEvento } from '../lib/types'

const numero = lerNumero
const doNumero = (n: number | null) => (n === null ? '' : String(n).replace('.', ','))
const corStatus = (s: StatusEvento) => STATUS_EVENTO.find((x) => x.valor === s)?.cor ?? 'cinza'
const encerrado = (s: StatusEvento) => s === 'finalizado' || s === 'cancelado'
// 'AAAA-MM-DDTHH:MM' → '10/10 08:00'
const dataHora = (s: string | null) => (s ? `${dataCurta(s)} ${s.slice(11, 16)}` : null)
const horario = (d: DiaEvento) => (d.abre || d.fecha ? `${d.abre ?? '?'} às ${d.fecha ?? '?'}` : 'horário a definir')

export function periodo(e: Pick<Evento, 'dias'>) {
  if (!e.dias.length) return 'Datas a definir'
  const a = e.dias[0].data
  const b = e.dias[e.dias.length - 1].data
  return a === b ? dataLonga(a) : `${dataCurta(a)} a ${dataLonga(b)}`
}

const TIPOS = ['Feira gastronômica', 'Festival gastronômico', 'Show ou festival de música', 'Evento corporativo', 'Festa particular', 'Evento esportivo', 'Festa de rua']

// Nomes das colunas para o histórico (o banco grava o nome da coluna que mudou).
const CAMPOS: Record<string, string> = {
  nome: 'nome', tipo: 'tipo', organizador: 'organizador', organizador_contato: 'contato do organizador', local: 'local', endereco: 'endereço',
  publico_estimado: 'público estimado', montagem_inicio: 'início da montagem', montagem_fim: 'fim da montagem',
  desmontagem_inicio: 'início da desmontagem', desmontagem_fim: 'fim da desmontagem', taxa_organizador_pct: 'taxa do organizador',
  valor_fixo: 'valor fixo', condicoes: 'condições', quem_recebe: 'quem recebe as vendas', repasse_prazo_dias: 'prazo do repasse',
  repasse_obs: 'observação do repasse', infraestrutura: 'infraestrutura', observacao: 'observações',
  cidade: 'cidade', gastronomia: 'gastronomia', barracas: 'barracas', margem_seguranca_pct: 'folga da separação', diaria_freela: 'diária do freela', latitude: 'local no mapa', longitude: 'local no mapa', fora_da_media: 'fora da média',
}

// O que ainda falta definir no evento, para a gestão não esquecer (não impede salvar).
function pendencias(e: Evento): string[] {
  if (encerrado(e.status)) return []
  const p: string[] = []
  if (!e.dias.length) p.push('Datas de funcionamento')
  else if (e.dias.some((d) => !d.abre || !d.fecha)) p.push('Horário de algum dia')
  if (!e.local) p.push('Local')
  if (!e.operacoes.length) p.push('Operações que vão participar')
  if (!e.responsaveis.length) p.push('Responsável interno')
  if (e.taxaOrganizadorPct === null && e.valorFixo === null) p.push('Taxa ou valor cobrado pelo organizador')
  if (!e.quemRecebe) p.push('Quem recebe as vendas')
  if (e.quemRecebe === 'organizador' && e.repassePrazoDias === null) p.push('Prazo do repasse')
  if (e.dias.length && !e.montagemInicio) p.push('Montagem')
  if (e.dias.length && !e.desmontagemInicio) p.push('Desmontagem')
  const primeiro = e.dias[0]?.data
  const ultimo = e.dias[e.dias.length - 1]?.data
  if (primeiro && e.montagemInicio && e.montagemInicio.slice(0, 10) > primeiro) p.push('A montagem está depois do primeiro dia')
  if (ultimo && e.desmontagemInicio && e.desmontagemInicio.slice(0, 10) < ultimo) p.push('A desmontagem está antes do último dia')
  return p
}

export const ABAS_EVENTOS = [
  { id: '', nome: 'Eventos' },
  { id: 'painel', nome: 'Painel' },
  { id: 'historico', nome: 'Comparativo' },
  { id: 'estoque', nome: 'Estoque e checklist' },
  { id: 'freelancers', nome: 'Freelancers' },
  { id: 'fichas', nome: 'Fichas' },
  { id: 'insumos', nome: 'Insumos' },
  { id: 'fornecedores', nome: 'Fornecedores' },
]

// Último evento aberto (Heitor, 13/10): ao sair para Insumos, Fichas etc., uma barra leva de volta às abas dele
// sem passar pela lista. Fica só neste aparelho.
interface EventoRecente { id: string; nome: string; aba: string }
const CHAVE_RECENTE = 'evento-recente'
const lerRecente = (): EventoRecente | null => {
  try { return JSON.parse(localStorage.getItem(CHAVE_RECENTE) ?? 'null') } catch { return null }
}
const gravarRecente = (r: EventoRecente | null) => {
  try { if (r) localStorage.setItem(CHAVE_RECENTE, JSON.stringify(r)); else localStorage.removeItem(CHAVE_RECENTE) } catch { /* sem armazenamento */ }
}
function VoltarAoEvento({ aqui }: { aqui?: string }) {
  const [r, setR] = useState(lerRecente)
  useEffect(() => { setR(lerRecente()) }, [aqui])
  if (!r || r.id === aqui) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-ozzy-50 px-3 py-2 text-sm ring-1 ring-ozzy-400/60 print:hidden">
      <span className="mr-1 font-semibold">{r.nome}:</span>
      {ABAS_EVENTO.map((a) => (
        <button key={a.id} onClick={() => ir(`eventos/${r.id}${a.id ? '/' + a.id : ''}`)}
          className={`rounded-lg px-2.5 py-1 font-semibold ${a.id === r.aba ? 'bg-carvao text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-100'}`}>
          {a.nome}
        </button>
      ))}
      <button className="ml-auto rounded-full px-2 text-stone-400 hover:text-carvao" title="Esconder" aria-label="Esconder atalho do evento" onClick={() => { gravarRecente(null); setR(null) }}>✕</button>
    </div>
  )
}

// Módulo Eventos: eventos (#/eventos/<id>), fichas (#/eventos/fichas/<id>), insumos e fornecedores.
export default function ModuloEventos({ sub, param }: { sub?: string; param?: string }) {
  const aba = ABAS_EVENTOS.some((a) => a.id && a.id === sub) ? sub! : ''
  return (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
        {ABAS_EVENTOS.map((a) => (
          <button
            key={a.id}
            onClick={() => ir(a.id ? 'eventos/' + a.id : 'eventos')}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold ${aba === a.id ? 'bg-carvao text-white' : 'text-stone-600 hover:bg-stone-200'}`}
          >
            {a.nome}
          </button>
        ))}
      </div>
      <VoltarAoEvento aqui={aba === '' ? sub : undefined} />
      {aba === 'fichas' ? <FichasEvento id={param} />
        : aba === 'insumos' || aba === 'fornecedores' ? <Insumos aba={aba} />
        : aba === 'estoque' ? <EstoqueBase />
        : aba === 'painel' ? <PainelEventos />
        : aba === 'historico' ? <ComparativoEventos />
        : aba === 'freelancers' ? <FreelasEventos />
        : <Eventos id={sub} aba={param ?? ''} />}
    </div>
  )
}

// Eventos (Entrega 1, 08/10): lista e cadastro. Cada evento tem sua página (#/eventos/<id>).
function Eventos({ id, aba }: { id?: string; aba: string }) {
  const { store } = useApp()
  const [lista, setLista] = useState<Evento[] | null>(null)
  const [operacoes, setOperacoes] = useState<Operacao[]>([])
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    try {
      const [e, o] = await Promise.all([store.eventos(), store.operacoes()])
      setLista(e)
      setOperacoes(o)
    } catch (err) {
      setErro((err as Error).message)
    }
  }, [store])
  useEffect(() => {
    carregar()
  }, [carregar])

  if (erro) return <p className="text-red-600">{erro}</p>
  if (!lista) return <p className="text-stone-400">Carregando…</p>
  if (id) {
    const e = lista.find((x) => x.id === id)
    if (!e) return <Vazio>Evento não encontrado. <button className="font-semibold underline" onClick={() => ir('eventos')}>Voltar para a lista</button></Vazio>
    return <PaginaEvento e={e} eventos={lista} operacoes={operacoes} aoMudar={carregar} aba={aba} />
  }
  return <ListaEventos lista={lista} operacoes={operacoes} aoMudar={carregar} />
}

function ListaEventos({ lista, operacoes, aoMudar }: { lista: Evento[]; operacoes: Operacao[]; aoMudar: () => Promise<void> }) {
  const { avisar } = useApp()
  const [filtro, setFiltro] = useState<'ativos' | 'finalizado' | 'cancelado' | 'todos'>('ativos')
  const [busca, setBusca] = useState('')
  const [novo, setNovo] = useState(false)
  const nomeOp = (id: string) => operacoes.find((o) => o.id === id)?.nome ?? id

  const filtrados = lista
    .filter((e) => (filtro === 'todos' ? true : filtro === 'ativos' ? !encerrado(e.status) : e.status === filtro))
    .filter((e) => !busca || `${e.nome} ${e.organizador ?? ''} ${e.local ?? ''}`.toLowerCase().includes(busca.toLowerCase()))
    // Próximos primeiro; sem data no fim. Encerrados: o mais recente primeiro.
    .sort((a, b) => {
      const da = a.dias[0]?.data ?? '9999'
      const db = b.dias[0]?.data ?? '9999'
      return filtro === 'ativos' ? da.localeCompare(db) : db.localeCompare(da)
    })
  const conta = (f: typeof filtro) => lista.filter((e) => (f === 'todos' ? true : f === 'ativos' ? !encerrado(e.status) : e.status === f)).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 overflow-x-auto">
          {([['ativos', 'Em andamento'], ['finalizado', 'Finalizados'], ['cancelado', 'Cancelados'], ['todos', 'Todos']] as const).map(([v, n]) => (
            <button
              key={v}
              onClick={() => setFiltro(v)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold ${filtro === v ? 'bg-carvao text-white' : 'text-stone-600 hover:bg-stone-200'}`}
            >
              {n} <span className="opacity-60">{conta(v)}</span>
            </button>
          ))}
        </div>
        <input className={`${estiloEntrada} py-2! sm:ml-auto sm:w-64!`} placeholder="Buscar evento, organizador ou local" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar evento" />
        <Botao onClick={() => setNovo(true)}>+ Novo evento</Botao>
      </div>

      {filtrados.length === 0 ? (
        <Vazio>
          {lista.length === 0
            ? 'Nenhum evento cadastrado ainda. Cadastre o próximo evento, mesmo que ainda esteja em negociação.'
            : 'Nenhum evento neste filtro.'}
        </Vazio>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {filtrados.map((e) => {
            const falta = pendencias(e).length
            return (
              <li key={e.id}>
                <button onClick={() => ir('eventos/' + e.id)} className="flex h-full w-full flex-col gap-1 rounded-2xl bg-white p-3.5 text-left ring-1 ring-stone-200 transition hover:ring-carvao">
                  <span className="flex w-full items-start justify-between gap-2">
                    <span className="font-semibold">{e.nome}</span>
                    <Selo cor={corStatus(e.status)}>{nomeStatusEvento(e.status)}</Selo>
                  </span>
                  <span className="text-sm text-stone-600">
                    {periodo(e)}
                    {e.local && ` · ${e.local}`}
                  </span>
                  <span className="text-xs text-stone-500">
                    {e.operacoes.length ? e.operacoes.map(nomeOp).join(', ') : 'Operações a definir'}
                    {e.taxaOrganizadorPct !== null && ` · taxa ${doNumero(e.taxaOrganizadorPct)}%`}
                    {e.publicoEstimado !== null && ` · ${e.publicoEstimado.toLocaleString('pt-BR')} pessoas`}
                  </span>
                  {falta > 0 && <span className="text-xs font-semibold text-amber-700">Falta definir {falta} {falta === 1 ? 'item' : 'itens'}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {novo && (
        <EditarEvento
          e={null}
          operacoes={operacoes}
          aoFechar={() => setNovo(false)}
          aoSalvar={async (salvo) => {
            setNovo(false)
            await aoMudar()
            avisar('Evento cadastrado')
            ir('eventos/' + salvo.id)
          }}
          aoMudarOperacoes={aoMudar}
        />
      )}
    </div>
  )
}

function PaginaEvento({ e, eventos, operacoes, aoMudar, aba }: { e: Evento; eventos: Evento[]; operacoes: Operacao[]; aoMudar: () => Promise<void>; aba: string }) {
  useEffect(() => { gravarRecente({ id: e.id, nome: e.nome, aba }) }, [e.id, e.nome, aba])
  return (
    <div className="space-y-4">
      <button onClick={() => ir('eventos')} className="text-sm font-semibold text-stone-500 hover:text-carvao">← Eventos</button>
      <div>
        <div className="text-xs font-semibold text-stone-400">Evento nº {e.numero}{e.tipo && ` · ${e.tipo}`}</div>
        <h1 className="text-2xl font-bold tracking-tight">{e.nome}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone-600">
          <Selo cor={corStatus(e.status)}>{nomeStatusEvento(e.status)}</Selo>
          <span>{periodo(e)}</span>
          {e.local && <span>· {e.local}</span>}
          {e.cidade && <span>· {e.cidade}</span>}
        </div>
      </div>
      <AbasEvento id={e.id} aba={aba} />
      {aba === '' ? <ResumoEvento e={e} operacoes={operacoes} aoMudar={aoMudar} />
        : aba === 'freelas' ? <FreelasDoEvento e={e} aoMudarEvento={aoMudar} />
        : aba === 'equipe' ? <EquipeEvento e={e} aoMudarEvento={aoMudar} />
        : <AbaLogistica e={e} eventos={eventos} aba={aba} />}
    </div>
  )
}

function AbaLogistica({ e, eventos, aba }: { e: Evento; eventos: Evento[]; aba: string }) {
  const { d, erro, carregar } = useDadosLogistica(e.id, true)
  if (erro) return <p className="text-red-600">{erro}</p>
  if (!d) return <p className="text-stone-400">Carregando…</p>
  if (aba === 'previsao') return <CardapioPrevisao e={e} eventos={eventos} d={d} aoMudar={carregar} />
  if (aba === 'insumos' && d.gestao) return <InsumosDoEvento e={e} d={d} />
  if (aba === 'vendas') return <VendasEvento e={e} d={d} aoMudar={carregar} />
  if (aba === 'separacao') return <Separacao e={e} d={d} aoMudar={carregar} />
  if (aba === 'sobras') return <Sobras e={e} d={d} aoMudar={carregar} />
  return <Vazio>Aba não encontrada.</Vazio>
}

function ResumoEvento({ e, operacoes, aoMudar }: { e: Evento; operacoes: Operacao[]; aoMudar: () => Promise<void> }) {
  const { store, nomeDe, avisar } = useApp()
  const [historico, setHistorico] = useState<HistoricoEvento[]>([])
  const [editando, setEditando] = useState(false)
  const [mudandoStatus, setMudandoStatus] = useState(false)
  const nomeOp = (id: string) => operacoes.find((o) => o.id === id)?.nome ?? id
  useEffect(() => {
    store.historicoEvento(e.id).then(setHistorico)
  }, [store, e])
  const falta = pendencias(e)

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Botao variante="secundario" onClick={() => setMudandoStatus(true)}>Mudar status</Botao>
        <Botao onClick={() => setEditando(true)}>Editar</Botao>
      </div>

      {falta.length > 0 && (
        <div className="rounded-2xl bg-amber-50 p-4 text-sm ring-1 ring-amber-200">
          <div className="font-semibold text-amber-900">Falta definir</div>
          <ul className="mt-1 list-disc pl-5 text-amber-900">
            {falta.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Cartao>
          <h2 className="mb-2 font-bold">Quando e onde</h2>
          {e.dias.length === 0 ? (
            <p className="text-sm text-stone-500">Dias de funcionamento a definir.</p>
          ) : (
            <ul className="space-y-0.5 text-sm">
              {e.dias.map((d) => (
                <li key={d.data}>
                  <b>{diaSemana(d.data)} {dataCurta(d.data)}</b> <span className="text-stone-600">{horario(d)}</span>
                </li>
              ))}
            </ul>
          )}
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-stone-500">Local</dt>
            <dd>{e.local ?? '—'}{e.cidade && <span className="text-stone-500"> · {e.cidade}</span>}</dd>
            <dt className="text-stone-500">Gastronomia</dt>
            <dd>{e.gastronomia ?? '—'}{e.barracas !== null && <span className="text-stone-500"> · {doNumero(e.barracas)} barraca(s)</span>}</dd>
            {e.endereco && (<><dt className="text-stone-500">Endereço</dt><dd>{e.endereco}</dd></>)}
            <dt className="text-stone-500">Público</dt>
            <dd>{e.publicoEstimado !== null ? `${e.publicoEstimado.toLocaleString('pt-BR')} pessoas (estimado)` : '—'}</dd>
            <dt className="text-stone-500">Montagem</dt>
            <dd>{e.montagemInicio ? `${dataHora(e.montagemInicio)}${e.montagemFim ? ` até ${dataHora(e.montagemFim)}` : ''}` : '—'}</dd>
            <dt className="text-stone-500">Desmontagem</dt>
            <dd>{e.desmontagemInicio ? `${dataHora(e.desmontagemInicio)}${e.desmontagemFim ? ` até ${dataHora(e.desmontagemFim)}` : ''}` : '—'}</dd>
          </dl>
        </Cartao>

        <Cartao>
          <h2 className="mb-2 font-bold">Organizador e condições</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-stone-500">Organizador</dt>
            <dd>{e.organizador ?? '—'}{e.organizadorContato && <span className="block text-stone-500">{e.organizadorContato}</span>}</dd>
            <dt className="text-stone-500">Taxa</dt>
            <dd>{e.taxaOrganizadorPct !== null ? `${doNumero(e.taxaOrganizadorPct)}% das vendas` : '—'}</dd>
            <dt className="text-stone-500">Valor fixo</dt>
            <dd>{e.valorFixo !== null ? reais(e.valorFixo) : '—'}</dd>
            <dt className="text-stone-500">Vendas</dt>
            <dd>{e.quemRecebe === 'organizador' ? 'Organizador recebe e repassa' : e.quemRecebe === 'the_ozzy' ? 'The Ozzy recebe e paga a taxa' : '—'}</dd>
            {e.quemRecebe === 'organizador' && (<><dt className="text-stone-500">Repasse</dt><dd>{e.repassePrazoDias !== null ? `${e.repassePrazoDias} dias após o evento` : '—'}{e.repasseObs && <span className="block text-stone-500">{e.repasseObs}</span>}</dd></>)}
          </dl>
          {e.condicoes && <p className="mt-2 text-sm whitespace-pre-line text-stone-700">{e.condicoes}</p>}
          <p className="mt-3 text-xs text-stone-500">A taxa do organizador é descontada antes do repasse e não é imposto. Os impostos terão regra própria no simulador.</p>
        </Cartao>

        <Cartao>
          <h2 className="mb-2 font-bold">Operações e responsáveis</h2>
          <div className="flex flex-wrap gap-1.5">
            {e.operacoes.length ? e.operacoes.map((o) => <Selo key={o}>{nomeOp(o)}</Selo>) : <span className="text-sm text-stone-500">Operações a definir.</span>}
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {e.responsaveis.length === 0 && <li className="text-stone-500">Nenhum responsável definido.</li>}
            {e.responsaveis.map((r) => (
              <li key={r.funcionarioId}>
                <b>{nomeDe(r.funcionarioId)}</b>
                {r.papel && <span className="text-stone-600"> · {r.papel}</span>}
              </li>
            ))}
          </ul>
        </Cartao>

        <Cartao>
          <h2 className="mb-2 font-bold">Infraestrutura e observações</h2>
          {!e.infraestrutura && !e.observacao && <p className="text-sm text-stone-500">Nada anotado.</p>}
          {e.infraestrutura && <p className="text-sm whitespace-pre-line"><b>Infraestrutura:</b> {e.infraestrutura}</p>}
          {e.observacao && <p className="mt-2 text-sm whitespace-pre-line">{e.observacao}</p>}
        </Cartao>
      </div>

      <div className="rounded-2xl border border-dashed border-stone-300 p-4">
        <h2 className="font-bold">Próximas etapas deste evento</h2>
        <p className="mt-1 text-sm text-stone-600">Cardápio, previsão, vendas, separação e sobras já estão nas abas acima. Falta o simulador financeiro.</p>
      </div>

      <Cartao>
        <h2 className="mb-2 font-bold">Histórico</h2>
        {historico.length === 0 ? (
          <p className="text-sm text-stone-500">Sem registros.</p>
        ) : (
          <ol className="space-y-2 border-l-2 border-stone-200 pl-4 text-sm">
            {historico.map((h) => (
              <li key={h.id}>
                <span className="text-stone-700">
                  {h.tipo === 'criado' && 'Evento cadastrado'}
                  {h.tipo === 'status' && <>Status: {nomeStatusEvento(h.de as StatusEvento)} → <b>{nomeStatusEvento(h.para as StatusEvento)}</b></>}
                  {h.tipo === 'dados' && `Alterou ${[...new Set((h.campos ?? []).map((c) => CAMPOS[c] ?? c))].join(', ')}`}
                </span>
                {h.motivo && <span className="block text-stone-600">“{h.motivo}”</span>}
                <span className="block text-xs text-stone-400" title={new Date(h.em).toLocaleString('pt-BR')}>
                  {nomeDe(h.por)} · {tempoDesde(h.em)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Cartao>

      {editando && (
        <EditarEvento
          e={e}
          operacoes={operacoes}
          aoFechar={() => setEditando(false)}
          aoSalvar={async () => {
            setEditando(false)
            await aoMudar()
            avisar('Evento atualizado')
          }}
          aoMudarOperacoes={aoMudar}
        />
      )}
      {mudandoStatus && (
        <MudarStatus
          e={e}
          aoFechar={() => setMudandoStatus(false)}
          aoSalvar={async () => {
            setMudandoStatus(false)
            await aoMudar()
            avisar('Status atualizado')
          }}
        />
      )}
    </div>
  )
}

function MudarStatus({ e, aoFechar, aoSalvar }: { e: Evento; aoFechar: () => void; aoSalvar: () => void }) {
  const { store } = useApp()
  const [status, setStatus] = useState<StatusEvento>(e.status)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const salvar = async () => {
    if (status === e.status) return aoFechar()
    if (status === 'cancelado' && !motivo.trim()) return setErro('Conte por que o evento foi cancelado.')
    setSalvando(true)
    try {
      await store.salvarEvento({ ...e, status, statusMotivo: motivo.trim() || null })
      aoSalvar()
    } catch (err) {
      setErro((err as Error).message)
      setSalvando(false)
    }
  }
  return (
    <Modal titulo="Mudar status" aberto aoFechar={aoFechar}>
      <div className="space-y-4">
        <div className="grid gap-1.5">
          {STATUS_EVENTO.map((s) => (
            <label key={s.valor} className={`flex items-center gap-3 rounded-xl px-3 py-2 ring-1 ${status === s.valor ? 'bg-stone-50 ring-carvao' : 'ring-stone-200'}`}>
              <input type="radio" name="status" className="accent-carvao" checked={status === s.valor} onChange={() => setStatus(s.valor)} />
              <span className="flex-1 text-sm font-medium">{s.nome}</span>
              {s.valor === e.status && <span className="text-xs text-stone-400">atual</span>}
            </label>
          ))}
        </div>
        <Campo rotulo={status === 'cancelado' ? 'Motivo do cancelamento' : 'Observação (opcional)'}>
          <textarea className={estiloEntrada} rows={2} value={motivo} onChange={(ev) => setMotivo(ev.target.value)} placeholder="Ex.: contrato assinado em 08/10" />
        </Campo>
        <p className="text-xs text-stone-500">A mudança fica no histórico do evento, com seu nome e a hora.</p>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
      </div>
    </Modal>
  )
}

const emBranco: NovoEvento = {
  nome: '', status: 'negociacao', statusMotivo: null, tipo: null, organizador: null, organizadorContato: null, local: null, endereco: null,
  publicoEstimado: null, montagemInicio: null, montagemFim: null, desmontagemInicio: null, desmontagemFim: null, taxaOrganizadorPct: null,
  valorFixo: null, condicoes: null, quemRecebe: null, repassePrazoDias: null, repasseObs: null, infraestrutura: null, observacao: null,
  cidade: null, gastronomia: null, barracas: null, margemSegurancaPct: 10, diariaFreela: null, latitude: null, longitude: null, foraDaMedia: false, layoutBarracas: {},
  dias: [], operacoes: [], responsaveis: [],
}

function EditarEvento({ e, operacoes, aoFechar, aoSalvar, aoMudarOperacoes }: {
  e: Evento | null
  operacoes: Operacao[]
  aoFechar: () => void
  aoSalvar: (salvo: Evento) => void
  aoMudarOperacoes: () => Promise<void>
}) {
  const { store, equipe } = useApp()
  const base = e ?? emBranco
  const [f, setF] = useState({
    nome: base.nome, tipo: base.tipo ?? '', organizador: base.organizador ?? '', organizadorContato: base.organizadorContato ?? '',
    local: base.local ?? '', endereco: base.endereco ?? '', publicoEstimado: base.publicoEstimado === null ? '' : String(base.publicoEstimado),
    montagemInicio: base.montagemInicio ?? '', montagemFim: base.montagemFim ?? '', desmontagemInicio: base.desmontagemInicio ?? '', desmontagemFim: base.desmontagemFim ?? '',
    taxaOrganizadorPct: doNumero(base.taxaOrganizadorPct), valorFixo: doNumero(base.valorFixo), condicoes: base.condicoes ?? '',
    quemRecebe: base.quemRecebe ?? '', repassePrazoDias: base.repassePrazoDias === null ? '' : String(base.repassePrazoDias), repasseObs: base.repasseObs ?? '',
    infraestrutura: base.infraestrutura ?? '', observacao: base.observacao ?? '',
    cidade: base.cidade ?? '', gastronomia: base.gastronomia ?? '', barracas: doNumero(base.barracas), margemSegurancaPct: doNumero(base.margemSegurancaPct),
    diariaFreela: doNumero(base.diariaFreela),
  })
  const [dias, setDias] = useState<DiaEvento[]>(base.dias)
  const [ops, setOps] = useState<string[]>(base.operacoes)
  const [resp, setResp] = useState(base.responsaveis)
  const [novaOp, setNovaOp] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const mudar = (c: keyof typeof f) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [c]: ev.target.value })
  const pessoas = equipe.filter((p) => p.status === 'ativo' && !resp.some((r) => r.funcionarioId === p.id)).sort((a, b) => a.nome.localeCompare(b.nome))

  const maisDia = () => {
    const ultimo = dias[dias.length - 1]
    setDias([...dias, { data: ultimo ? addDias(ultimo.data, 1) : '', abre: ultimo?.abre ?? null, fecha: ultimo?.fecha ?? null }])
  }
  const mudarDia = (i: number, d: Partial<DiaEvento>) => setDias(dias.map((x, j) => (j === i ? { ...x, ...d } : x)))

  const criarOperacao = async () => {
    const nome = novaOp.trim()
    if (!nome) return
    const id = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (!id) return
    try {
      await store.salvarOperacao({ id, nome, ativa: true })
      await aoMudarOperacoes()
      setOps([...ops.filter((o) => o !== id), id])
      setNovaOp('')
    } catch (err) {
      setErro((err as Error).message)
    }
  }

  const salvar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!f.nome.trim()) return setErro('Dê um nome ao evento.')
    const datas = dias.map((d) => d.data).filter(Boolean)
    if (new Set(datas).size !== datas.length) return setErro('Há um dia repetido na lista de dias.')
    const taxa = numero(f.taxaOrganizadorPct)
    if (taxa !== null && (Number.isNaN(taxa) || taxa < 0 || taxa > 100)) return setErro('A taxa do organizador precisa ser um percentual entre 0 e 100.')
    const fixo = numero(f.valorFixo)
    if (fixo !== null && (Number.isNaN(fixo) || fixo < 0)) return setErro('Confira o valor fixo.')
    const publico = f.publicoEstimado.trim() ? Number(f.publicoEstimado.replace(/\D/g, '')) : null
    const prazo = f.repassePrazoDias.trim() ? Number(f.repassePrazoDias) : null
    if (prazo !== null && (!Number.isInteger(prazo) || prazo < 0 || prazo > 365)) return setErro('O prazo do repasse é em dias (0 a 365).')
    if (f.montagemInicio && f.montagemFim && f.montagemFim < f.montagemInicio) return setErro('O fim da montagem está antes do início.')
    if (f.desmontagemInicio && f.desmontagemFim && f.desmontagemFim < f.desmontagemInicio) return setErro('O fim da desmontagem está antes do início.')
    const barracas = numero(f.barracas)
    if (barracas !== null && (Number.isNaN(barracas) || barracas < 0)) return setErro('Confira o número de barracas.')
    const margem = numero(f.margemSegurancaPct) ?? 10
    if (Number.isNaN(margem) || margem < 0 || margem > 200) return setErro('A folga da separação é um percentual entre 0 e 200.')
    const diaria = numero(f.diariaFreela)
    if (diaria !== null && (Number.isNaN(diaria) || diaria < 0)) return setErro('Confira o valor da diária do freelancer.')
    setSalvando(true)
    try {
      aoSalvar(
        await store.salvarEvento({
          ...base,
          id: e?.id, atualizadoEm: e?.atualizadoEm, status: e?.status ?? 'negociacao', statusMotivo: e?.statusMotivo ?? null,
          nome: f.nome, tipo: f.tipo || null, organizador: f.organizador || null, organizadorContato: f.organizadorContato || null,
          local: f.local || null, endereco: f.endereco || null, publicoEstimado: publico,
          montagemInicio: f.montagemInicio || null, montagemFim: f.montagemFim || null, desmontagemInicio: f.desmontagemInicio || null, desmontagemFim: f.desmontagemFim || null,
          taxaOrganizadorPct: taxa, valorFixo: fixo, condicoes: f.condicoes || null, quemRecebe: (f.quemRecebe || null) as Evento['quemRecebe'],
          repassePrazoDias: prazo, repasseObs: f.repasseObs || null, infraestrutura: f.infraestrutura || null, observacao: f.observacao || null,
          cidade: f.cidade || null, gastronomia: f.gastronomia || null, barracas, margemSegurancaPct: margem, diariaFreela: diaria,
          dias: dias.filter((d) => d.data), operacoes: ops, responsaveis: resp,
        }),
      )
    } catch (err) {
      setErro((err as Error).message)
      setSalvando(false)
    }
  }

  const secao = 'border-t border-stone-200 pt-4 font-bold'
  return (
    <Modal titulo={e ? 'Editar evento' : 'Novo evento'} aberto aoFechar={aoFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <Campo rotulo="Nome do evento">
          <input className={estiloEntrada} value={f.nome} onChange={mudar('nome')} placeholder="Ex.: Feira Gastronômica do Parque" required />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Tipo">
            <input className={estiloEntrada} list="tipos-evento" value={f.tipo} onChange={mudar('tipo')} placeholder="Feira, festival…" />
            <datalist id="tipos-evento">{TIPOS.map((t) => <option key={t} value={t} />)}</datalist>
          </Campo>
          <Campo rotulo="Público estimado">
            <input className={estiloEntrada} inputMode="numeric" value={f.publicoEstimado} onChange={mudar('publicoEstimado')} placeholder="Pessoas" />
          </Campo>
        </div>
        <Campo rotulo="Local">
          <input className={estiloEntrada} value={f.local} onChange={mudar('local')} placeholder="Nome do lugar" />
        </Campo>
        <Campo rotulo="Endereço">
          <input className={estiloEntrada} value={f.endereco} onChange={mudar('endereco')} />
        </Campo>
        <div className="grid grid-cols-3 gap-3">
          <Campo rotulo="Cidade">
            <input className={estiloEntrada} value={f.cidade} onChange={mudar('cidade')} />
          </Campo>
          <Campo rotulo="Gastronomia" dica="Para comparar">
            <input className={estiloEntrada} list="gastronomias" value={f.gastronomia} onChange={mudar('gastronomia')} placeholder="Italiano…" />
            <datalist id="gastronomias">{['Italiano', 'Árabe', 'Coreano', 'Junina', 'Geral'].map((t) => <option key={t} value={t} />)}</datalist>
          </Campo>
          <Campo rotulo="Barracas">
            <input className={estiloEntrada} inputMode="decimal" value={f.barracas} onChange={mudar('barracas')} />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Folga na separação (%)" dica="Quanto a sugestão de separação põe a mais em cima da previsão. Padrão 10%.">
            <input className={estiloEntrada} inputMode="decimal" value={f.margemSegurancaPct} onChange={mudar('margemSegurancaPct')} />
          </Campo>
          <Campo rotulo="Diária do freela (R$)" dica="Valor padrão das diárias deste evento. Freela com valor próprio no cadastro recebe o dele.">
            <input className={estiloEntrada} inputMode="decimal" value={f.diariaFreela} onChange={mudar('diariaFreela')} placeholder="Ex.: 150" />
          </Campo>
        </div>

        <h3 className={secao}>Dias e horários de funcionamento</h3>
        {dias.length === 0 && <p className="text-sm text-stone-500">Nenhum dia ainda.</p>}
        {dias.map((d, i) => (
          <div key={i} className="flex items-end gap-2">
            <Campo rotulo={i === 0 ? 'Dia' : ' '}>
              <input className={estiloEntrada} type="date" value={d.data} onChange={(ev) => mudarDia(i, { data: ev.target.value })} aria-label={`Dia ${i + 1}`} />
            </Campo>
            <Campo rotulo={i === 0 ? 'Abre' : ' '}>
              <input className={estiloEntrada} type="time" value={d.abre ?? ''} onChange={(ev) => mudarDia(i, { abre: ev.target.value || null })} aria-label={`Abre no dia ${i + 1}`} />
            </Campo>
            <Campo rotulo={i === 0 ? 'Fecha' : ' '}>
              <input className={estiloEntrada} type="time" value={d.fecha ?? ''} onChange={(ev) => mudarDia(i, { fecha: ev.target.value || null })} aria-label={`Fecha no dia ${i + 1}`} />
            </Campo>
            <button type="button" onClick={() => setDias(dias.filter((_, j) => j !== i))} className="mb-1 rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-red-600" aria-label={`Tirar dia ${i + 1}`}>✕</button>
          </div>
        ))}
        <Botao type="button" variante="secundario" onClick={maisDia}>+ Dia</Botao>

        <h3 className={secao}>Montagem e desmontagem</h3>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Montagem: início">
            <input className={estiloEntrada} type="datetime-local" value={f.montagemInicio} onChange={mudar('montagemInicio')} />
          </Campo>
          <Campo rotulo="Montagem: fim">
            <input className={estiloEntrada} type="datetime-local" value={f.montagemFim} onChange={mudar('montagemFim')} />
          </Campo>
          <Campo rotulo="Desmontagem: início">
            <input className={estiloEntrada} type="datetime-local" value={f.desmontagemInicio} onChange={mudar('desmontagemInicio')} />
          </Campo>
          <Campo rotulo="Desmontagem: fim">
            <input className={estiloEntrada} type="datetime-local" value={f.desmontagemFim} onChange={mudar('desmontagemFim')} />
          </Campo>
        </div>

        <h3 className={secao}>Operações e responsáveis</h3>
        <div className="flex flex-wrap gap-2">
          {operacoes.filter((o) => o.ativa || ops.includes(o.id)).map((o) => (
            <label key={o.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1 ${ops.includes(o.id) ? 'bg-stone-50 ring-carvao' : 'ring-stone-200'}`}>
              <input type="checkbox" className="accent-carvao" checked={ops.includes(o.id)} onChange={(ev) => setOps(ev.target.checked ? [...ops, o.id] : ops.filter((x) => x !== o.id))} />
              {o.nome}
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <input className={`${estiloEntrada} py-2!`} value={novaOp} onChange={(ev) => setNovaOp(ev.target.value)} placeholder="Outra operação (ex.: The Ozzy Focaccia)" aria-label="Nova operação" />
          <Botao type="button" variante="secundario" onClick={criarOperacao} disabled={!novaOp.trim()}>Incluir</Botao>
        </div>
        {resp.map((r, i) => (
          <div key={r.funcionarioId} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{equipe.find((p) => p.id === r.funcionarioId)?.nome ?? '—'}</span>
            <input className={`${estiloEntrada} w-40! py-2!`} value={r.papel ?? ''} onChange={(ev) => setResp(resp.map((x, j) => (j === i ? { ...x, papel: ev.target.value } : x)))} placeholder="Papel" aria-label="Papel no evento" />
            <button type="button" onClick={() => setResp(resp.filter((_, j) => j !== i))} className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-red-600" aria-label="Tirar responsável">✕</button>
          </div>
        ))}
        <select className={estiloEntrada} value="" onChange={(ev) => ev.target.value && setResp([...resp, { funcionarioId: ev.target.value, papel: resp.length ? null : 'Responsável geral' }])} aria-label="Incluir responsável">
          <option value="">+ Incluir responsável interno</option>
          {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome} ({p.cargo})</option>)}
        </select>

        <h3 className={secao}>Organizador e condições comerciais</h3>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Organizador">
            <input className={estiloEntrada} value={f.organizador} onChange={mudar('organizador')} />
          </Campo>
          <Campo rotulo="Contato">
            <input className={estiloEntrada} value={f.organizadorContato} onChange={mudar('organizadorContato')} placeholder="Nome e telefone" />
          </Campo>
          <Campo rotulo="Taxa do organizador (%)" dica="Descontada antes do repasse. Não é imposto.">
            <input className={estiloEntrada} inputMode="decimal" value={f.taxaOrganizadorPct} onChange={mudar('taxaOrganizadorPct')} placeholder="Ex.: 21" />
          </Campo>
          <Campo rotulo="Valor fixo (R$)" dica="Cota, aluguel do espaço ou inscrição.">
            <input className={estiloEntrada} inputMode="decimal" value={f.valorFixo} onChange={mudar('valorFixo')} placeholder="0,00" />
          </Campo>
        </div>
        <Campo rotulo="Quem recebe as vendas">
          <select className={estiloEntrada} value={f.quemRecebe} onChange={mudar('quemRecebe')}>
            <option value="">A definir</option>
            <option value="organizador">Organizador (maquininhas dele) e repassa para a The Ozzy</option>
            <option value="the_ozzy">The Ozzy (nossas maquininhas) e paga a taxa</option>
          </select>
        </Campo>
        {f.quemRecebe === 'organizador' && (
          <div className="grid grid-cols-[8rem_1fr] gap-3">
            <Campo rotulo="Prazo (dias)">
              <input className={estiloEntrada} inputMode="numeric" value={f.repassePrazoDias} onChange={mudar('repassePrazoDias')} placeholder="Ex.: 15" />
            </Campo>
            <Campo rotulo="Como é o repasse">
              <input className={estiloEntrada} value={f.repasseObs} onChange={mudar('repasseObs')} placeholder="Pix, boleto, depois do último dia…" />
            </Campo>
          </div>
        )}
        <Campo rotulo="Outras condições do contrato">
          <textarea className={estiloEntrada} rows={2} value={f.condicoes} onChange={mudar('condicoes')} placeholder="Sobre o que a taxa incide, multas, exclusividade…" />
        </Campo>

        <h3 className={secao}>Infraestrutura e observações</h3>
        <Campo rotulo="Infraestrutura necessária">
          <textarea className={estiloEntrada} rows={2} value={f.infraestrutura} onChange={mudar('infraestrutura')} placeholder="Energia, água, gás, tenda, ponto de lavagem…" />
        </Campo>
        <Campo rotulo="Observações">
          <textarea className={estiloEntrada} rows={2} value={f.observacao} onChange={mudar('observacao')} />
        </Campo>

        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full" disabled={salvando}>{salvando ? 'Salvando…' : e ? 'Salvar alterações' : 'Cadastrar evento'}</Botao>
        {!e && <p className="text-center text-xs text-stone-500">O evento começa como “Em negociação”. Hoje é {dataLonga(hoje())}.</p>}
      </form>
    </Modal>
  )
}
