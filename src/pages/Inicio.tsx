import { useCallback, useEffect, useState } from 'react'
import { RefeicoesDaSemana } from './Refeicoes'
import { atendeChamados } from '../lib/permissoes'
import { chamadoEmAberto, nomeCurto, type Chamado } from '../lib/types'
import { Detalhe, haQuanto } from './Manutencao'
import { tarefasPreventiva, textoPrazo, type TarefaPreventiva } from '../lib/preventiva'
import { Avatar, Cartao, Selo, Titulo } from '../components/ui'
import arte from '../assets/banner-ozzy.jpg'
import Icone from '../components/Icone'
import { modulosVisiveis } from '../lib/modulos'
import { useApp } from '../lib/contexto'
import { conferirPrecos, type AlertaPreco } from '../lib/conferencia'
import { montarCatalogo } from '../lib/custos'
import { addDias, dataCurta, diaSemana, hoje, inicioDaSemana, tempoDesde } from '../lib/datas'
import { avisaFerias, isentoDeRotinas, podeGerenciar, podeVerPainel } from '../lib/permissoes'
import { COR_SITUACAO, TEXTO_SITUACAO, alertasFerias, type AlertaFerias as AlertaFeriasT } from '../lib/ferias'
const dataBr = (d: string) => d.split('-').reverse().join('/')
import Painel from './Painel'
import { ir } from '../lib/rota'
import type { Comunicado, Documento, EntregaUniforme, Folga, Ocorrencia } from '../lib/types'
import { exigenciasDe, pendencias, textoSituacao, type Pendencia } from '../lib/vencimentos'
import { nomeTipoOcorrencia } from '../lib/types'
import type { Desligamento } from '../lib/types'
import DiariaNaFolga from '../components/DiariaNaFolga'
import { CartaoEventosEscalado } from './EventoLogistica'
import { LIMITE_AFASTAMENTO, JANELA_AFASTAMENTO, alertasAfastamento, alertasExperiencia, aniversariantesDaSemana, prazoRescisao, progressoDesligamento, situacaoAniversario } from '../lib/pessoal'

export default function Inicio() {
  const { eu, store, equipe, nomeDe } = useApp()
  const [comunicados, setComunicados] = useState<Comunicado[]>([])
  const [minhasFolgas, setMinhasFolgas] = useState<Folga[]>([])
  const gestao = podeGerenciar(eu.nivel)
  const painel = podeVerPainel(eu.nivel)

  const [meusDocs, setMeusDocs] = useState<Documento[]>([])
  const [meusUniformes, setMeusUniformes] = useState<EntregaUniforme[]>([])
  const [docsEquipe, setDocsEquipe] = useState<Documento[]>([])
  const [assinouRegulamento, setAssinouRegulamento] = useState(true)
  const [diariaFolga, setDiariaFolga] = useState(false)

  useEffect(() => {
    store.documentos(eu.id).then(setMeusDocs)
    store.uniformes(eu.id).then(setMeusUniformes)
    Promise.all([store.versoesRegulamento(), store.leiturasRegulamento()]).then(([vs, ls]) =>
      setAssinouRegulamento(!vs[0] || ls.some((l) => l.funcionarioId === eu.id && l.versaoId === vs[0].id)),
    )
    if (podeGerenciar(eu.nivel)) store.documentosTodos().then(setDocsEquipe)
  }, [store, eu.id, eu.nivel])

  useEffect(() => {
    store.comunicados().then(setComunicados)
    const ini = inicioDaSemana(hoje())
    store.folgas(ini, addDias(ini, 13)).then((fs) => setMinhasFolgas(fs.filter((f) => f.funcionarioId === eu.id)))
  }, [store, eu.id])

  const naoLidos = comunicados.filter((c) => !c.lidoPor.includes(eu.id))
  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const niver = situacaoAniversario(eu.dataNascimento, hoje())

  return (
    <div className="space-y-6">
      <div className="relative h-44 overflow-hidden rounded-3xl bg-ozzy-400 sm:h-60">
        <img src={arte} alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_40%] sm:object-[50%_22%]" />
        <div className="relative flex h-full items-end p-4 sm:p-6">
          <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-carvao/90 py-2.5 pr-5 pl-3 shadow-lg ring-2 ring-ozzy-400">
            <Avatar nome={eu.nome} foto={eu.fotoUrl} tamanho={48} />
            <div className="min-w-0">
              <p className="text-sm text-white/80">{niver === 'hoje' ? 'Feliz aniversário,' : `${saudacao}! Bem-vindo,`}</p>
              <h1 className="truncate text-3xl leading-tight font-extrabold tracking-tight text-ozzy-400 uppercase sm:text-4xl">{eu.nome.split(' ')[0]}</h1>
            </div>
          </div>
        </div>
      </div>

      {niver && <Parabens hoje={niver === 'hoje'} nome={eu.nome.split(' ')[0]} />}

      <MeusAvisos docs={isentoDeRotinas(eu.nivel) ? null : meusDocs} uniformes={meusUniformes} regulamento={!assinouRegulamento && !isentoDeRotinas(eu.nivel)} />

      <DependeDeMim />
      <RefeicoesDaSemana />
      {gestao && <ComprasAtrasadas />}
      {(eu.nivel === 'administrativo' || eu.nivel === 'proprietario') && <PrecosForaDoPadrao />}
      {eu.nivel === 'manutencao' && <ResumoChamados />}
      {atendeChamados(eu.nivel) && <ResumoPreventiva />}

      {gestao && <AlertaEquipe pend={pendencias(equipe, docsEquipe)} />}

      {avisaFerias(eu.nivel) && <AlertaFerias />}

      {gestao && <AlertasDp docs={docsEquipe} />}
      {gestao && <AlertaTrocas />}

      <CartaoEventosEscalado />

      {painel && <Painel />}

      {/* O proprietário não tem folga marcada nem manda atestado (pedido de 07/10): só o card de avisos. */}
      <div className={`grid gap-3 ${isentoDeRotinas(eu.nivel) ? '' : 'sm:grid-cols-3'}`}>
        <Cartao onClick={() => ir('rh/avisos')}>
          <div className="text-sm text-stone-500">Avisos não lidos</div>
          <div className="mt-1 text-3xl font-bold">{naoLidos.length}</div>
        </Cartao>
        {!isentoDeRotinas(eu.nivel) && (<>
        <Cartao onClick={() => ir('rh/folgas')}>
          <div className="text-sm text-stone-500">Minhas próximas folgas</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {minhasFolgas.filter((f) => f.data >= hoje()).length === 0 ? (
              <span className="text-sm text-stone-400">Nenhuma marcada</span>
            ) : (
              minhasFolgas
                .filter((f) => f.data >= hoje())
                .sort((a, b) => a.data.localeCompare(b.data))
                .map((f) => (
                  <Selo key={f.id} cor={f.tipo === 'feriado' ? 'azul' : 'ambar'}>
                    {diaSemana(f.data)} {dataCurta(f.data)}
                  </Selo>
                ))
            )}
          </div>
        </Cartao>
        <Cartao onClick={() => ir('rh/perfil')} className="bg-carvao! text-white ring-0!">
          <div className="text-sm text-stone-300">Mandou atestado?</div>
          <div className="mt-1 font-semibold text-ozzy-400">Enviar documento ›</div>
        </Cartao>
        </>)}
      </div>

      {!isentoDeRotinas(eu.nivel) && (
        <button onClick={() => setDiariaFolga(true)} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-left ring-1 ring-stone-200 hover:ring-carvao">
          <span>
            <span className="block font-semibold">Fiz diária na folga</span>
            <span className="text-sm text-stone-500">Mande os dias até domingo 22h para entrar no pagamento</span>
          </span>
          <span className="text-lg text-stone-400">›</span>
        </button>
      )}
      {!isentoDeRotinas(eu.nivel) && (
        <button onClick={() => ir('rh/ponto')} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-left ring-1 ring-stone-200 hover:ring-carvao">
          <span>
            <span className="block font-semibold">Esqueci de bater o ponto</span>
            <span className="text-sm text-stone-500">Peça o ajuste para o escritório por aqui</span>
          </span>
          <span className="text-lg text-stone-400">›</span>
        </button>
      )}
      {diariaFolga && <DiariaNaFolga aoFechar={() => setDiariaFolga(false)} />}

      <Aniversariantes />

      {gestao && !painel && <PainelGestao totalAtivos={equipe.filter((f) => f.status === 'ativo').length} />}

      <section>
        <Titulo acao={<button onClick={() => ir('rh/avisos')} className="text-sm font-semibold text-carvao underline decoration-ozzy-500 decoration-2 underline-offset-4">Ver todos</button>}>
          Últimos avisos
        </Titulo>
        <div className="space-y-2">
          {comunicados.slice(0, 3).map((c) => (
            <Cartao key={c.id} onClick={() => ir('rh/avisos')}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold">{c.titulo}</div>
                {!c.lidoPor.includes(eu.id) && <Selo cor="ambar">Novo</Selo>}
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-stone-600">{c.corpo}</p>
              <div className="mt-2 text-xs text-stone-400">
                {nomeDe(c.autorId)} · {tempoDesde(c.criadoEm)}
              </div>
            </Cartao>
          ))}
        </div>
      </section>

      <section>
        <Titulo>Áreas do portal</Titulo>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {modulosVisiveis(eu)
            .filter((m) => m.id !== 'inicio')
            .map((m) => (
              <button
                key={m.id}
                onClick={() => ir(m.id === 'rh' ? 'rh/avisos' : m.id)}
                className="flex flex-col items-start gap-3 rounded-2xl bg-white p-4 text-left ring-1 ring-stone-200 transition hover:ring-carvao"
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${m.pronto ? 'bg-carvao text-ozzy-400' : 'bg-stone-100 text-stone-500'}`}>
                  <Icone nome={m.id} />
                </span>
                <span className="text-sm font-semibold">{m.nome}</span>
                {m.pronto ? <Selo cor="verde">Disponível</Selo> : <Selo>Em breve</Selo>}
              </button>
            ))}
        </div>
      </section>
    </div>
  )
}

function PainelGestao({ totalAtivos }: { totalAtivos: number }) {
  const { store, equipe, nomeDe } = useApp()
  const [atestados, setAtestados] = useState<Documento[]>([])
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])

  useEffect(() => {
    // Duas consultas para a equipe toda (antes eram duas por pessoa).
    const desde = addDias(hoje(), -14)
    const ids = new Set(equipe.map((f) => f.id))
    let vale = true
    store.documentosTodos().then((ds) => vale && setAtestados(ds.filter((d) => ids.has(d.funcionarioId) && d.tipo === 'atestado' && d.criadoEm.slice(0, 10) >= desde)), () => undefined)
    store.ocorrenciasEntre(desde, hoje()).then((os) => vale && setOcorrencias(os.filter((o) => ids.has(o.funcionarioId)).sort((a, b) => b.data.localeCompare(a.data))), () => undefined)
    return () => { vale = false }
  }, [store, equipe])

  return (
    <section>
      <Titulo>Visão da gestão</Titulo>
      <div className="grid gap-3 sm:grid-cols-3">
        <Cartao onClick={() => ir('rh/equipe')}>
          <div className="text-sm text-stone-500">Funcionários ativos</div>
          <div className="mt-1 text-3xl font-bold">{totalAtivos}</div>
        </Cartao>
        <Cartao>
          <div className="text-sm text-stone-500">Atestados (14 dias)</div>
          <div className="mt-1 text-3xl font-bold">{atestados.length}</div>
          <div className="mt-1 space-y-0.5">
            {atestados.slice(0, 3).map((d) => (
              <button key={d.id} onClick={() => ir('rh/equipe/' + d.funcionarioId)} className="block text-left text-xs text-stone-600 hover:underline">
                {nomeDe(d.funcionarioId)} · {d.inicio ? dataCurta(d.inicio) : dataCurta(d.criadoEm)}
              </button>
            ))}
          </div>
        </Cartao>
        <Cartao>
          <div className="text-sm text-stone-500">Ocorrências (14 dias)</div>
          <div className="mt-1 text-3xl font-bold">{ocorrencias.length}</div>
          <div className="mt-1 space-y-0.5">
            {ocorrencias.slice(0, 3).map((o) => (
              <button key={o.id} onClick={() => ir('rh/equipe/' + o.funcionarioId)} className="block text-left text-xs text-stone-600 hover:underline">
                {nomeTipoOcorrencia(o.tipo)} · {nomeDe(o.funcionarioId)} · {dataCurta(o.data)}
              </button>
            ))}
          </div>
        </Cartao>
      </div>
    </section>
  )
}

// Avisos pessoais: exame vencendo ou faltando, e termo de uniforme para assinar.
function MeusAvisos({ docs, uniformes, regulamento }: { docs: Documento[] | null; uniformes: EntregaUniforme[]; regulamento: boolean }) {
  const { eu } = useApp()
  // docs = null: a pessoa não entra no controle de exames.
  const exames = docs === null ? [] : exigenciasDe(docs, eu).filter((i) => i.situacao !== 'em_dia')
  const termos = uniformes.filter((u) => !u.assinatura)
  if (!exames.length && !termos.length && !regulamento) return null
  return (
    <section className="space-y-2">
      {regulamento && (
        <button onClick={() => ir('regras')} className="flex w-full items-center gap-3 rounded-2xl bg-ozzy-400 p-4 text-left text-carvao">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-carvao text-lg font-bold text-ozzy-400">!</span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Leia e assine o regulamento interno</span>
            <span className="block text-sm">As regras da casa, do ponto às refeições. Toque para ler.</span>
          </span>
          <span className="text-xl">›</span>
        </button>
      )}
      {termos.map((t) => (
        <button
          key={t.id}
          onClick={() => ir('rh/perfil')}
          className="flex w-full items-center gap-3 rounded-2xl bg-ozzy-400 p-4 text-left text-carvao"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-carvao text-lg font-bold text-ozzy-400">!</span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Assine o termo do uniforme</span>
            <span className="block text-sm">Você recebeu {t.itens.map((i) => i.item.toLowerCase()).join(', ')}. Toque para assinar.</span>
          </span>
          <span className="text-xl">›</span>
        </button>
      ))}
      {exames.length > 0 && (
        <button onClick={() => ir('rh/perfil')} className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left ring-2 ring-red-200">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-lg font-bold text-white">!</span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Seus exames precisam de atenção</span>
            {exames.map((i) => (
              <span key={i.id} className="block text-sm text-stone-600">
                {i.nome}: {textoSituacao(i).toLowerCase()}
              </span>
            ))}
          </span>
          <span className="text-xl text-stone-400">›</span>
        </button>
      )}
    </section>
  )
}

function AlertaFerias() {
  const { store, equipe } = useApp()
  const [alertas, setAlertas] = useState<AlertaFeriasT[]>([])
  useEffect(() => {
    store.ferias().then((fs) => setAlertas(alertasFerias(equipe, fs, hoje())))
  }, [store, equipe])
  if (!alertas.length) return null
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ozzy-400 text-sm font-bold">{alertas.length}</span>
        <span className="font-semibold">Férias vencendo nos próximos 3 meses</span>
      </div>
      <ul className="divide-y divide-stone-100">
        {alertas.map((a) => (
          <li key={a.pessoa.id + a.periodo.inicio}>
            <button onClick={() => ir('rh/equipe/' + a.pessoa.id)} className="flex w-full items-center justify-between gap-2 py-2 text-left text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{a.pessoa.nome}</span>
                <span className="block text-xs text-stone-500">
                  {a.periodo.saldo} dias a tirar · {a.periodo.situacao === 'vencida' ? `venceu em ${dataBr(a.periodo.concessivoFim)}` : `começar até ${dataBr(a.periodo.comecarAte)}`}
                </span>
              </span>
              <Selo cor={COR_SITUACAO[a.periodo.situacao]}>{TEXTO_SITUACAO[a.periodo.situacao]}</Selo>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AlertaEquipe({ pend }: { pend: Pendencia[] }) {
  if (!pend.length) return null
  const n = (s: string) => pend.filter((p) => p.item.situacao === s).length
  const partes = [
    n('vencido') && `${n('vencido')} vencido${n('vencido') > 1 ? 's' : ''}`,
    n('faltando') && `${n('faltando')} não enviado${n('faltando') > 1 ? 's' : ''}`,
    n('vence_logo') && `${n('vence_logo')} vencendo em 30 dias`,
  ].filter(Boolean)
  return (
    <button onClick={() => ir('rh/exames')} className="flex w-full items-center gap-3 rounded-2xl bg-carvao p-4 text-left text-white">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-lg font-bold">!</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Exames da equipe</span>
        <span className="block text-sm text-stone-300">{partes.join(' · ')}</span>
      </span>
      <span className="text-sm font-semibold text-ozzy-400">Ver ›</span>
    </button>
  )
}

// O que a manutenção está esperando de mim (Heitor, 09/10). Só aparece quando tem algo.
function DependeDeMim() {
  const { store, eu, nomeDe } = useApp()
  const [chamados, setChamados] = useState<Chamado[]>([])
  const [aberto, setAberto] = useState<string | null>(null)
  const carregar = useCallback(() => store.chamados().then(setChamados), [store])
  useEffect(() => { carregar() }, [carregar])
  const meus = chamados.filter((c) => c.aguardandoId === eu.id && chamadoEmAberto(c.status))
  const sel = chamados.find((c) => c.id === aberto)
  const modal = sel && <Detalhe chamado={sel} aoFechar={() => setAberto(null)} aoMudar={carregar} />
  if (!meus.length) return modal || null
  return (
    <div className="space-y-2 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
      <p className="font-semibold">Depende de você ({meus.length})</p>
      <ul className="divide-y divide-amber-200">
        {meus.map((c) => (
          <li key={c.id}>
            <button onClick={() => setAberto(c.id)} className="flex w-full items-center gap-3 py-2 text-left">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Chamado #{c.numero} · {c.titulo}</span>
                <span className="block text-sm text-stone-600">{c.aguardandoMotivo ?? 'A manutenção está esperando você'}</span>
                <span className="block text-xs text-stone-500">
                  {(() => { const quem = [...c.eventos].reverse().find((e) => e.texto?.startsWith('Aguardando'))?.autorId; return quem ? `${nomeCurto(nomeDe(quem))} marcou ` : '' })()}
                  {c.aguardandoDesde ? haQuanto(c.aguardandoDesde) : ''}
                </span>
              </span>
              <span className="text-sm font-semibold">Ver ›</span>
            </button>
          </li>
        ))}
      </ul>
      {modal}
    </div>
  )
}

// Compra que passou do dia previsto sem chegar (Heitor, 09/10): a gerência e o administrativo precisam saber na hora.
function ComprasAtrasadas() {
  const { store } = useApp()
  const [linhas, setLinhas] = useState<{ id: string; numero: number; fornecedor: string; itens: string; dias: number }[]>([])
  useEffect(() => {
    let vivo = true
    store.pedidosCompra().then(async (ps) => {
      const atrasadas = ps.filter((p) => p.status === 'pedido' && p.previsaoEntrega < hoje())
      if (!atrasadas.length || !vivo) return setLinhas([])
      const [fs, ins] = await Promise.all([store.fornecedores(), store.insumos()])
      const nome = (id: string) => ins.find((i) => i.id === id)?.nome ?? 'item'
      if (vivo) setLinhas(atrasadas.sort((a, b) => a.previsaoEntrega.localeCompare(b.previsaoEntrega)).map((p) => ({
        id: p.id, numero: p.numero, fornecedor: fs.find((f) => f.id === p.fornecedorId)?.nome ?? 'Fornecedor',
        itens: p.itens.slice(0, 3).map((i) => nome(i.insumoId)).join(', ') + (p.itens.length > 3 ? ` e mais ${p.itens.length - 3}` : ''),
        dias: Math.round((Date.parse(hoje() + 'T12:00:00') - Date.parse(p.previsaoEntrega + 'T12:00:00')) / 86400000),
      })))
    }, () => undefined)
    return () => { vivo = false }
  }, [store])
  if (!linhas.length) return null
  return (
    <button onClick={() => ir('compras')} className="block w-full space-y-1 rounded-2xl bg-red-50 p-4 text-left ring-1 ring-red-200 hover:ring-red-400">
      <span className="flex items-center justify-between gap-2">
        <span className="font-semibold text-red-800">{linhas.length === 1 ? '1 compra atrasada' : `${linhas.length} compras atrasadas`}</span>
        <span className="text-sm font-semibold">Ver ›</span>
      </span>
      {linhas.slice(0, 5).map((l) => (
        <span key={l.id} className="block text-sm text-stone-700">
          <b>{l.fornecedor}</b> #{l.numero} · {l.dias === 1 ? 'há 1 dia' : `há ${l.dias} dias`} · <span className="text-stone-500">{l.itens}</span>
        </span>
      ))}
      {linhas.length > 5 && <span className="block text-xs text-stone-500">e mais {linhas.length - 5}</span>}
    </button>
  )
}

// Conferência de preços (Heitor, 11/10): material com preço totalmente fora avisa o administrativo e o proprietário.
function PrecosForaDoPadrao() {
  const { store } = useApp()
  const [fora, setFora] = useState<AlertaPreco[]>([])
  useEffect(() => {
    let vivo = true
    Promise.all([store.insumos(), store.receitas(), store.versoesReceitas(), store.referenciasPreco(), store.produtosVenda().catch(() => [])])
      .then(([ins, rs, vs, refs, ps]) => {
        if (!vivo) return
        const alertas = conferirPrecos(ins, montarCatalogo(ins, rs, vs), refs, ps.filter((p) => p.ativo).map((p) => ({ nome: p.nome, receitaId: p.receitaId, preco: p.preco ?? p.precoPizza })))
        setFora(alertas.filter((a) => a.gravidade === 'fora'))
      }, () => undefined)
    return () => { vivo = false }
  }, [store])
  if (!fora.length) return null
  return (
    <button onClick={() => ir('cadastros/conferencia')} className="block w-full space-y-1 rounded-2xl bg-red-50 p-4 text-left ring-1 ring-red-200 hover:ring-red-400">
      <span className="flex items-center justify-between gap-2">
        <span className="font-semibold text-red-800">{fora.length === 1 ? '1 material com preço fora do padrão' : `${fora.length} materiais com preço fora do padrão`}</span>
        <span className="text-sm font-semibold">Conferir ›</span>
      </span>
      {fora.slice(0, 3).map((a) => (
        <span key={a.insumo.id} className="block text-sm text-stone-700"><b>{a.insumo.nome}</b> · <span className="text-stone-500">{a.motivos[0]}</span></span>
      ))}
      {fora.length > 3 && <span className="block text-xs text-stone-500">e mais {fora.length - 3}</span>}
    </button>
  )
}

function ResumoChamados() {
  const { store } = useApp()
  const [chamados, setChamados] = useState<Chamado[]>([])
  useEffect(() => {
    store.chamados().then(setChamados)
  }, [store])
  const abertos = chamados.filter((c) => chamadoEmAberto(c.status))
  if (!abertos.length) return null
  const urgentes = abertos.filter((c) => c.gravidade === 'urgente').length
  return (
    <button onClick={() => ir('manutencao')} className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left ring-1 ring-stone-200 hover:ring-carvao">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${urgentes ? 'bg-red-600 text-white' : 'bg-carvao text-ozzy-400'}`}>
        {abertos.length}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Chamados de manutenção em aberto</span>
        <span className="block text-sm text-stone-600">
          {urgentes ? `${urgentes} urgente${urgentes > 1 ? 's' : ''} · ` : ''}mais antigo aberto {haQuanto(abertos.reduce((a, c) => (c.abertoEm < a ? c.abertoEm : a), abertos[0].abertoEm))}
        </span>
      </span>
      <span className="text-sm font-semibold">Ver ›</span>
    </button>
  )
}

// Mensagem especial no dia e na semana do aniversário da pessoa.
function Parabens({ hoje: eHoje, nome }: { hoje: boolean; nome: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-carvao p-4 text-white ring-2 ring-ozzy-400">
      <span className="text-4xl" aria-hidden>🎂</span>
      <div className="min-w-0">
        <p className="text-lg font-extrabold text-ozzy-400">{eHoje ? `Parabéns, ${nome}!` : `Semana do seu aniversário, ${nome}!`}</p>
        <p className="text-sm text-stone-200">
          {eHoje
            ? 'Hoje o dia é seu. Toda a família The Ozzy deseja muita saúde, alegria e conquistas. Obrigado por fazer parte do time!'
            : 'A família The Ozzy deseja uma semana incrível para você. Obrigado por fazer parte do time!'}
        </p>
      </div>
    </div>
  )
}

function Aniversariantes() {
  const { eu, equipe } = useApp()
  const lista = aniversariantesDaSemana(equipe, hoje()).filter((a) => a.pessoa.id !== eu.id)
  if (!lista.length) return null
  return (
    <Cartao>
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <span aria-hidden>🎉</span> Aniversariantes da semana
      </div>
      <ul className="space-y-1.5">
        {lista.map(({ pessoa, dia }) => (
          <li key={pessoa.id} className="flex items-center gap-2 text-sm">
            <Avatar nome={pessoa.nome} foto={pessoa.fotoUrl} tamanho={28} />
            <span className="min-w-0 flex-1 truncate">{pessoa.nome}</span>
            {dia === hoje() ? <Selo cor="ambar">Hoje</Selo> : <span className="text-stone-500">{diaSemana(dia)} {dataCurta(dia)}</span>}
          </li>
        ))}
      </ul>
    </Cartao>
  )
}

// Avisos do Departamento Pessoal para a gestão: experiência vencendo, afastamento acima de 15 dias e desligamentos em aberto.
function AlertasDp({ docs }: { docs: Documento[] }) {
  const { store, equipe, nomeDe } = useApp()
  const [desligamentos, setDesligamentos] = useState<Desligamento[]>([])
  useEffect(() => {
    store.desligamentos().then((ds) => setDesligamentos(ds.filter((d) => !d.concluido && equipe.find((f) => f.id === d.funcionarioId)?.status === 'inativo'))).catch(() => setDesligamentos([]))
  }, [store, equipe])
  const exp = alertasExperiencia(equipe, hoje())
  const afast = alertasAfastamento(equipe, docs, hoje())
  if (!exp.length && !afast.length && !desligamentos.length) return null
  const todos = (id: string) => equipe.find((f) => f.id === id)
  const linha = (id: string, titulo: string, sub: string, selo: React.ReactNode) => (
    <li key={id + titulo}>
      <button onClick={() => ir('rh/equipe/' + id)} className="flex w-full items-center justify-between gap-2 py-2 text-left text-sm">
        <span className="min-w-0">
          <span className="block truncate font-medium">{titulo}</span>
          <span className="block text-xs text-stone-500">{sub}</span>
        </span>
        {selo}
      </button>
    </li>
  )
  return (
    <div className="space-y-3">
      {afast.length > 0 && (
        <div className="rounded-2xl bg-white p-4 ring-2 ring-red-200">
          <div className="mb-1 font-semibold">Afastamento acima de {LIMITE_AFASTAMENTO} dias: verificar INSS</div>
          <p className="mb-2 text-xs text-stone-500">
            Atestados somados nos últimos {JANELA_AFASTAMENTO} dias. Pela mesma doença, a partir do 16º dia o afastamento é pelo INSS: avise a contabilidade.
          </p>
          <ul className="divide-y divide-stone-100">
            {afast.map((a) => linha(a.pessoa.id, a.pessoa.nome, a.pessoa.cargo, <Selo cor="vermelho">{a.dias} dias</Selo>))}
          </ul>
        </div>
      )}
      {exp.length > 0 && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
          <div className="mb-2 font-semibold">Contrato de experiência vencendo</div>
          <ul className="divide-y divide-stone-100">
            {exp.map(({ pessoa, exp: e }) =>
              linha(
                pessoa.id,
                pessoa.nome,
                `${e.fase === 'periodo1' ? '1º contrato' : '2º contrato'} vence em ${dataBr(e.proximo!)}${e.fase === 'periodo1' && e.vence2 ? ' · prorrogar ou desligar' : ' · efetivar ou desligar'}`,
                <Selo cor={e.faltam! <= 2 ? 'vermelho' : 'ambar'}>{e.faltam === 0 ? 'hoje' : `${e.faltam} dia${e.faltam === 1 ? '' : 's'}`}</Selo>,
              ),
            )}
          </ul>
        </div>
      )}
      {desligamentos.length > 0 && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
          <div className="mb-2 font-semibold">Desligamentos em andamento</div>
          <ul className="divide-y divide-stone-100">
            {desligamentos.map((d) => {
              const p = todos(d.funcionarioId)
              const { feitas, total, pagamentoFeito } = progressoDesligamento(d, p ?? {})
              const prazo = prazoRescisao(d)
              const atrasado = !pagamentoFeito && hoje() > prazo
              return linha(
                d.funcionarioId,
                p?.nome ?? nomeDe(d.funcionarioId),
                `${feitas} de ${total} etapas${pagamentoFeito ? ' · rescisão paga' : ` · pagar rescisão até ${dataBr(prazo)}`}`,
                <Selo cor={atrasado ? 'vermelho' : 'ambar'}>{atrasado ? 'Atrasado' : 'Em aberto'}</Selo>,
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

// Preventiva atrasada ou vencendo (manutenção e gestão), separada dos chamados do que quebrou.
function ResumoPreventiva() {
  const { store, unidades } = useApp()
  const [tarefas, setTarefas] = useState<TarefaPreventiva[]>([])
  useEffect(() => {
    Promise.all([store.preventivas(), store.execucoesPreventiva()])
      .then(([i, x]) => setTarefas(tarefasPreventiva(i, x, unidades, hoje()).filter((t) => t.situacao !== 'em_dia')))
      .catch(() => setTarefas([]))
  }, [store, unidades])
  if (!tarefas.length) return null
  const atrasadas = tarefas.filter((t) => t.situacao === 'vencida').length
  const loja = (id: string) => (unidades.find((u) => u.id === id)?.nome ?? id).replace(/^The Ozzy (Burger )?/, '')
  return (
    <button onClick={() => ir('manutencao')} className="flex w-full items-start gap-3 rounded-2xl bg-white p-4 text-left ring-1 ring-stone-200 hover:ring-carvao">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${atrasadas ? 'bg-red-600 text-white' : 'bg-ozzy-400'}`}>{tarefas.length}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Manutenção preventiva</span>
        {tarefas.slice(0, 4).map((t) => (
          <span key={t.preventiva.id + t.unidadeId} className="block truncate text-sm text-stone-600">
            {t.preventiva.titulo} · {loja(t.unidadeId)}: <span className={t.situacao === 'vencida' ? 'font-semibold text-red-700' : ''}>{textoPrazo(t)}</span>
          </span>
        ))}
        {tarefas.length > 4 && <span className="block text-xs text-stone-500">e mais {tarefas.length - 4}</span>}
      </span>
      <span className="text-sm font-semibold">Ver ›</span>
    </button>
  )
}

// Pedidos de troca de uniforme em aberto (gestão), com atalho para Compras.
function AlertaTrocas() {
  const { store } = useApp()
  const [n, setN] = useState(0)
  useEffect(() => {
    store.solicitacoesUniforme().then((xs) => setN(xs.filter((x) => x.status === 'aberta').length)).catch(() => setN(0))
  }, [store])
  if (!n) return null
  return (
    <button onClick={() => ir('compras')} className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left ring-1 ring-stone-200 hover:ring-carvao">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ozzy-400 text-sm font-bold">{n}</span>
      <span className="min-w-0 flex-1 font-semibold">Pedido{n > 1 ? 's' : ''} de troca de uniforme</span>
      <span className="text-sm font-semibold">Ver ›</span>
    </button>
  )
}
