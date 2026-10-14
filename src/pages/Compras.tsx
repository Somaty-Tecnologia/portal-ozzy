import { useCallback, useEffect, useState } from 'react'
import Impressao from '../components/Impressao'
import EstoqueUniformes from './EstoqueUniformes'
import { PedidosCompra, SemanaCompras } from './ComprasPedidos'
import { Botao, Campo, Modal, Selo, Titulo, Vazio, estiloEntrada } from '../components/ui'
import logo from '../assets/logo.png'
import { useApp } from '../lib/contexto'
import { dataLonga, hoje } from '../lib/datas'
import { lerNumero, reais } from '../lib/financeiro'
import { ir } from '../lib/rota'
import { operaEstoque } from '../lib/permissoes'
import { CORES_CAMISETA, PECAS, consolidado, corCamiseta, descricaoPeca, modelagemDe } from '../lib/uniformes'
import {
  STATUS_PEDIDO_UNIFORME, apelidoUnidade,
  type Funcionario, type ItemPedidoUniforme, type Modelagem, type PedidoUniforme, type SolicitacaoUniforme, type StatusPedidoUniforme, type StatusTroca,
} from '../lib/types'

const SELO_TROCA: Record<StatusTroca, 'ambar' | 'verde' | 'cinza'> = { aberta: 'ambar', atendida: 'verde', recusada: 'cinza' }
const NOME_TROCA: Record<StatusTroca, string> = { aberta: 'Aberta', atendida: 'Atendida', recusada: 'Recusada' }
const SELO_PEDIDO: Record<StatusPedidoUniforme, 'cinza' | 'ambar' | 'azul' | 'verde'> = { rascunho: 'cinza', orcamento: 'ambar', pedido: 'azul', recebido: 'verde' }
const nomeStatusPedido = (s: StatusPedidoUniforme) => STATUS_PEDIDO_UNIFORME.find((x) => x.valor === s)!.nome
// Item pedido na troca → peça do pedido de compra.
const PECA_DA_TROCA: Record<string, string> = { Camiseta: 'Camiseta', Calça: 'Calça', Sapato: 'Sapato', Avental: 'Avental', 'Boné / touca': 'Boné' }

export const tamanhosDe = (p: Funcionario) =>
  [p.tamCamiseta && `camiseta ${p.tamCamiseta}`, p.tamCalca && `calça ${p.tamCalca}`, p.tamCalcado && `calçado ${p.tamCalcado}`].filter(Boolean).join(' · ') || 'tamanhos não cadastrados'

// Compras: pedidos de compra aos fornecedores, entregas da semana e uniformes.
// Abas com endereço próprio (#/compras/<aba>), para o menu lateral e o "Ir para" (Heitor, 12/10).
export const ABAS_COMPRAS = [
  { id: '', nome: 'Pedidos de compra' },
  { id: 'semana', nome: 'Entregas da semana' },
  { id: 'uniformes', nome: 'Uniformes' },
]
export default function Compras({ sub }: { sub?: string }) {
  const { eu } = useApp()
  // Produção (13/10) só vê as entregas da semana, para marcar o que chegou.
  if (!operaEstoque(eu.nivel)) return <div className="space-y-4"><Titulo>Entregas da semana</Titulo><SemanaCompras /></div>
  const area = sub === 'semana' || sub === 'uniformes' ? sub : 'pedidos'
  return (
    <div className="space-y-4">
      <Titulo>Compras</Titulo>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-200 p-1 text-sm font-semibold print:hidden">
        {ABAS_COMPRAS.map((a) => (
          <button key={a.id} onClick={() => ir('compras' + (a.id ? '/' + a.id : ''))} className={`rounded-lg px-2 py-2 ${area === (a.id || 'pedidos') ? 'bg-white shadow-sm' : 'text-stone-600'}`}>{a.nome}</button>
        ))}
      </div>
      {area === 'pedidos' ? <PedidosCompra /> : area === 'semana' ? <SemanaCompras /> : <Uniformes />}
    </div>
  )
}

function Uniformes() {
  const [aba, setAba] = useState<'trocas' | 'estoque' | 'pedidos' | 'valores'>('trocas')
  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-stone-100 p-1 text-sm font-semibold">
        {([['trocas', 'Trocas'], ['estoque', 'Estoque'], ['pedidos', 'Pedidos'], ['valores', 'Valores']] as const).map(([a, nome]) => (
          <button key={a} onClick={() => setAba(a)} className={`flex-1 rounded-lg px-3 py-1.5 ${aba === a ? 'bg-white shadow-sm' : 'text-stone-600'}`}>
            {nome}
          </button>
        ))}
      </div>
      {aba === 'trocas' ? <Trocas /> : aba === 'estoque' ? <EstoqueUniformes /> : aba === 'pedidos' ? <Pedidos /> : <ValoresUniforme />}
    </div>
  )
}

// ---------- Relatório de pedidos de troca ----------

function Trocas() {
  const { store, equipe, unidades, nomeDe, avisar } = useApp()
  const [lista, setLista] = useState<SolicitacaoUniforme[] | null>(null)
  const [filtro, setFiltro] = useState<'aberta' | 'todas'>('aberta')
  const [loja, setLoja] = useState('')
  const [respondendo, setRespondendo] = useState<SolicitacaoUniforme | null>(null)
  const carregar = useCallback(() => store.solicitacoesUniforme().then(setLista), [store])
  useEffect(() => {
    carregar()
  }, [carregar])
  if (!lista) return <p className="text-stone-400">Carregando…</p>
  const pessoa = (id: string) => equipe.find((f) => f.id === id)
  const filtradas = lista.filter((s) => (filtro === 'todas' || s.status === 'aberta') && (!loja || pessoa(s.funcionarioId)?.unidadeId === loja))
  const abertas = lista.filter((s) => s.status === 'aberta').length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-white p-1 ring-1 ring-stone-300">
          {(['aberta', 'todas'] as const).map((f) => (
            <button key={f} onClick={() => setFiltro(f)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${filtro === f ? 'bg-carvao text-white' : 'text-stone-600'}`}>
              {f === 'aberta' ? `Abertas (${abertas})` : `Todas (${lista.length})`}
            </button>
          ))}
        </div>
        <select className={`${estiloEntrada} w-auto! py-2!`} value={loja} onChange={(e) => setLoja(e.target.value)} aria-label="Loja das trocas">
          <option value="">Todas as lojas</option>
          {unidades.map((u) => <option key={u.id} value={u.id}>{apelidoUnidade(u.nome)}</option>)}
        </select>
      </div>
      {filtradas.length === 0 ? (
        <Vazio>{filtro === 'aberta' ? 'Nenhum pedido de troca em aberto.' : 'Nenhum pedido de troca ainda.'}</Vazio>
      ) : (
        <ul className="space-y-2">
          {filtradas.map((s) => {
            const p = pessoa(s.funcionarioId)
            return (
              <li key={s.id} className="rounded-2xl bg-white p-3.5 ring-1 ring-stone-200">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <button onClick={() => ir('rh/equipe/' + s.funcionarioId)} className="min-w-0 text-left">
                    <span className="block font-semibold hover:underline">{p?.nome ?? nomeDe(s.funcionarioId)}</span>
                    <span className="block text-xs text-stone-500">
                      {p ? `${apelidoUnidade(unidades.find((u) => u.id === p.unidadeId)?.nome ?? '')} · ${p.cargo} · ${tamanhosDe(p)}` : ''}
                    </span>
                  </button>
                  <Selo cor={SELO_TROCA[s.status]}>{NOME_TROCA[s.status]}</Selo>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.itens.map((i) => <Selo key={i} cor="azul">{i}</Selo>)}
                </div>
                <p className="mt-1.5 text-sm text-stone-700">{s.motivo}</p>
                <div className="mt-1 text-xs text-stone-500">
                  Pedido em {dataLonga(s.criadoEm.slice(0, 10))}
                  {s.respondidoPor && ` · ${NOME_TROCA[s.status].toLowerCase()} por ${nomeDe(s.respondidoPor)}`}
                  {s.resposta && ` · "${s.resposta}"`}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {s.foto && <FotoTroca s={s} />}
                  <Botao variante="secundario" onClick={() => setRespondendo(s)}>{s.status === 'aberta' ? 'Responder' : 'Alterar'}</Botao>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {respondendo && (
        <Responder
          s={respondendo}
          aoFechar={() => setRespondendo(null)}
          aoSalvar={async (msg) => {
            setRespondendo(null)
            await carregar()
            avisar(msg)
          }}
        />
      )}
    </div>
  )
}

export function FotoTroca({ s }: { s: SolicitacaoUniforme }) {
  const { store, avisar } = useApp()
  const [url, setUrl] = useState<string | null>(null)
  if (url) return <img src={url} alt="Foto do uniforme" className="max-h-48 w-full rounded-xl object-cover" />
  return (
    <Botao variante="secundario" onClick={async () => {
      const u = await store.fotoSolicitacao(s)
      if (u) setUrl(u)
      else avisar('Foto de exemplo: na versão real ela abre aqui.')
    }}>
      Ver foto
    </Botao>
  )
}

function Responder({ s, aoFechar, aoSalvar }: { s: SolicitacaoUniforme; aoFechar: () => void; aoSalvar: (msg: string) => void }) {
  const { store, nomeDe } = useApp()
  const [resposta, setResposta] = useState(s.resposta ?? '')
  const [erro, setErro] = useState('')
  const responder = async (status: StatusTroca) => {
    if (status === 'recusada' && !resposta.trim()) return setErro('Diga o motivo da recusa.')
    try {
      await store.responderTrocaUniforme(s.id, status, resposta)
      aoSalvar(status === 'atendida' ? 'Troca marcada como atendida' : status === 'recusada' ? 'Troca recusada' : 'Troca reaberta')
    } catch (e) {
      setErro((e as Error).message)
    }
  }
  return (
    <Modal titulo={`Troca de uniforme · ${nomeDe(s.funcionarioId).split(' ')[0]}`} aberto aoFechar={aoFechar}>
      <div className="space-y-4">
        <p className="text-sm"><b>{s.itens.join(', ')}</b>: {s.motivo}</p>
        <Campo rotulo="Resposta (a pessoa vê no cadastro dela)">
          <textarea className={estiloEntrada} rows={2} value={resposta} onChange={(e) => setResposta(e.target.value)} placeholder="Ex.: entregue sapato 40 em 10/10; vai na próxima leva…" />
        </Campo>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <div className="flex flex-wrap gap-2">
          <Botao onClick={() => responder('atendida')}>Atendida</Botao>
          <Botao variante="secundario" onClick={() => responder('recusada')}>Recusar</Botao>
          {s.status !== 'aberta' && <Botao variante="fantasma" onClick={() => responder('aberta')}>Reabrir</Botao>}
        </div>
      </div>
    </Modal>
  )
}

// ---------- Pedidos de compra por leva ----------


// Uma linha com valor, fechamento e entrega (avisa quando a previsão já passou e não chegou).
function resumoPedido(p: PedidoUniforme) {
  const partes = [`Criado em ${dataLonga(p.criadoEm.slice(0, 10))}`]
  if (p.fornecedor) partes.push(p.fornecedor)
  if (p.valorTotal != null) partes.push(reais(p.valorTotal))
  if (p.fechadoEm) partes.push(`fechado em ${dataLonga(p.fechadoEm)}`)
  if (p.previsaoEntrega && p.status !== 'recebido')
    partes.push(p.previsaoEntrega < hoje() ? `entrega atrasada (previsão ${dataLonga(p.previsaoEntrega)})` : `entrega prevista ${dataLonga(p.previsaoEntrega)}`)
  return partes.join(' · ')
}

function Pedidos() {
  const { store, avisar } = useApp()
  const [pedidos, setPedidos] = useState<PedidoUniforme[] | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  const [novo, setNovo] = useState(false)
  const carregar = useCallback(() => store.pedidosUniforme().then(setPedidos), [store])
  useEffect(() => {
    carregar()
  }, [carregar])
  if (!pedidos) return <p className="text-stone-400">Carregando…</p>
  const atual = pedidos.find((p) => p.id === aberto)
  if (atual) return <DetalhePedido pedido={atual} aoVoltar={() => setAberto(null)} aoMudar={carregar} />

  return (
    <div className="space-y-3">
      <Botao onClick={() => setNovo(true)}>+ Novo pedido de uniformes</Botao>
      {pedidos.length === 0 ? (
        <Vazio>Nenhum pedido ainda. Monte uma leva com as pessoas que vão receber uniforme e gere o relatório para o orçamento.</Vazio>
      ) : (
        <ul className="space-y-2">
          {pedidos.map((p) => (
            <li key={p.id}>
              <button onClick={() => setAberto(p.id)} className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left ring-1 ring-stone-200 hover:ring-carvao">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">#{p.numero} · {p.titulo}</span>
                  <span className="block text-xs text-stone-500">
                    {resumoPedido(p)}
                  </span>
                </span>
                <Selo cor={SELO_PEDIDO[p.status]}>{nomeStatusPedido(p.status)}</Selo>
                <span className="text-xl text-stone-300">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {novo && (
        <DadosPedido
          aoFechar={() => setNovo(false)}
          aoSalvar={async (p) => {
            setNovo(false)
            await carregar()
            setAberto(p.id)
            avisar('Pedido criado: agora adicione as pessoas')
          }}
        />
      )}
    </div>
  )
}

function DadosPedido({ pedido, aoFechar, aoSalvar }: { pedido?: PedidoUniforme; aoFechar: () => void; aoSalvar: (p: PedidoUniforme) => void }) {
  const { store } = useApp()
  const mes = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const [titulo, setTitulo] = useState(pedido?.titulo ?? `Uniformes ${mes}`)
  const [status, setStatus] = useState<StatusPedidoUniforme>(pedido?.status ?? 'rascunho')
  const [fornecedor, setFornecedor] = useState(pedido?.fornecedor ?? '')
  const [observacao, setObservacao] = useState(pedido?.observacao ?? '')
  const [valorTotal, setValorTotal] = useState(pedido?.valorTotal != null ? String(pedido.valorTotal).replace('.', ',') : '')
  const [fechadoEm, setFechadoEm] = useState(pedido?.fechadoEm ?? '')
  const [previsao, setPrevisao] = useState(pedido?.previsaoEntrega ?? '')
  const [erro, setErro] = useState('')
  // Ao marcar "Pedido feito", a data de fechamento já vem com hoje.
  const mudarStatus = (s: StatusPedidoUniforme) => {
    setStatus(s)
    if ((s === 'pedido' || s === 'recebido') && !fechadoEm) setFechadoEm(hoje())
  }
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    const valor = valorTotal.trim() ? Number(valorTotal.replace(/\./g, '').replace(',', '.')) : null
    if (valor !== null && !(valor >= 0)) return setErro('Valor total inválido.')
    try {
      aoSalvar(await store.salvarPedidoUniforme({ id: pedido?.id, titulo, status, fornecedor, observacao, valorTotal: valor, fechadoEm: fechadoEm || null, previsaoEntrega: previsao || null }))
    } catch (err) {
      setErro((err as Error).message)
    }
  }
  return (
    <Modal titulo={pedido ? 'Dados do pedido' : 'Novo pedido de uniformes'} aberto aoFechar={aoFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <Campo rotulo="Nome da leva">
          <input className={estiloEntrada} value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Situação">
            <select className={estiloEntrada} value={status} onChange={(e) => mudarStatus(e.target.value as StatusPedidoUniforme)}>
              {STATUS_PEDIDO_UNIFORME.map((s) => <option key={s.valor} value={s.valor}>{s.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Fornecedor">
            <input className={estiloEntrada} value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Campo rotulo="Valor total (R$)">
            <input className={estiloEntrada} inputMode="decimal" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} placeholder="0,00" />
          </Campo>
          <Campo rotulo="Fechado em">
            <input className={estiloEntrada} type="date" value={fechadoEm} onChange={(e) => setFechadoEm(e.target.value)} />
          </Campo>
          <Campo rotulo="Previsão de entrega">
            <input className={estiloEntrada} type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
          </Campo>
        </div>
        <Campo rotulo="Observação (sai no relatório)">
          <textarea className={estiloEntrada} rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: bordado do logo no peito esquerdo" />
        </Campo>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full">Salvar</Botao>
      </form>
    </Modal>
  )
}

function DetalhePedido({ pedido, aoVoltar, aoMudar }: { pedido: PedidoUniforme; aoVoltar: () => void; aoMudar: () => Promise<unknown> }) {
  const { store, equipe, unidades, nomeDe, avisar } = useApp()
  const [itens, setItens] = useState<ItemPedidoUniforme[]>([])
  const [editando, setEditando] = useState<Funcionario | null>(null)
  const [adicionar, setAdicionar] = useState('')
  const [dados, setDados] = useState(false)
  const [relatorio, setRelatorio] = useState(false)
  const [apagar, setApagar] = useState(false)
  const [entrada, setEntrada] = useState<string | null>(null)
  const [confirmarEntrada, setConfirmarEntrada] = useState(false)
  const carregar = useCallback(async () => {
    setItens(await store.itensPedidoUniforme(pedido.id))
    setEntrada((await store.movimentosUniforme()).find((m) => m.referencia === `pedido:${pedido.id}`)?.data ?? null)
  }, [store, pedido.id])
  useEffect(() => {
    carregar()
  }, [carregar])
  const semTamanho = itens.filter((i) => !i.tamanho && !['Avental', 'Boné'].includes(i.item)).reduce((s, i) => s + i.quantidade, 0)
  // Pedido que chegou: as peças entram no estoque de uma vez (e dá para desfazer pelo histórico do estoque).
  const darEntrada = async () => {
    const linhas = consolidado(itens)
      .filter((c) => c.tamanho || ['Avental', 'Boné'].includes(c.item))
      .map((c) => ({
        item: c.item, cor: c.cor, modelagem: c.modelagem, tamanho: c.tamanho || 'Único', tipo: 'entrada' as const, quantidade: c.quantidade,
        referencia: `pedido:${pedido.id}`, observacao: `Pedido #${pedido.numero} · ${pedido.titulo}`, data: hoje(),
      }))
    try {
      await store.movimentarUniformes(linhas)
      if (pedido.status !== 'recebido') await store.salvarPedidoUniforme({ ...pedido, status: 'recebido' })
      setConfirmarEntrada(false)
      await carregar()
      await aoMudar()
      avisar(`${linhas.reduce((s, l) => s + l.quantidade, 0)} peças entraram no estoque`)
    } catch (e) {
      avisar((e as Error).message)
    }
  }

  const pessoas = [...new Set(itens.map((i) => i.funcionarioId).filter((x): x is string => !!x))]
    .map((id) => equipe.find((f) => f.id === id))
    .filter((p): p is Funcionario => !!p)
    .sort((a, b) => a.nome.localeCompare(b.nome))
  const fora = equipe.filter((f) => f.status === 'ativo' && f.nivel !== 'proprietario' && !pessoas.some((p) => p.id === f.id)).sort((a, b) => a.nome.localeCompare(b.nome))
  const total = itens.reduce((s, i) => s + i.quantidade, 0)
  const loja = (id: string) => apelidoUnidade(unidades.find((u) => u.id === id)?.nome ?? id)

  // Quem pediu troca e ainda não está no pedido entra com 1 de cada peça pedida.
  const trazerTrocas = async () => {
    const abertas = (await store.solicitacoesUniforme()).filter((s) => s.status === 'aberta' && !pessoas.some((p) => p.id === s.funcionarioId))
    let n = 0
    for (const s of abertas) {
      const p = equipe.find((f) => f.id === s.funcionarioId)
      if (!p) continue
      const linhas = PECAS.filter((pc) => s.itens.some((i) => PECA_DA_TROCA[i] === pc.item)).map((pc) => ({
        item: pc.item, cor: pc.cor ? corCamiseta(p) : null, modelagem: pc.modelagem ? modelagemDe(p) : null, tamanho: pc.tamanho(p), quantidade: 1,
      }))
      if (!linhas.length) continue
      await store.definirItensPedido(pedido.id, p.id, linhas)
      n++
    }
    await carregar()
    avisar(n ? `${n} pessoa${n > 1 ? 's' : ''} com troca em aberto adicionada${n > 1 ? 's' : ''}` : 'Nenhuma troca em aberto para adicionar')
  }

  return (
    <div className="space-y-4">
      <button onClick={aoVoltar} className="text-sm font-semibold text-stone-500">‹ Pedidos</button>
      <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">#{pedido.numero} · {pedido.titulo}</h2>
            <p className="text-sm text-stone-500">
              {pessoas.length} pessoa{pessoas.length === 1 ? '' : 's'} · {total} peça{total === 1 ? '' : 's'}
            </p>
            <p className="text-sm text-stone-500">{resumoPedido(pedido)}</p>
          </div>
          <Selo cor={SELO_PEDIDO[pedido.status]}>{nomeStatusPedido(pedido.status)}</Selo>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Botao disabled={!total} onClick={() => setRelatorio(true)}>Relatório para orçamento</Botao>
          <Botao variante="secundario" onClick={() => setDados(true)}>Editar dados</Botao>
          <Botao variante="secundario" onClick={trazerTrocas}>Trazer quem pediu troca</Botao>
        </div>
        {total > 0 && (pedido.status === 'pedido' || pedido.status === 'recebido') && (
          <div className="mt-3 rounded-xl bg-stone-50 p-3 text-sm">
            {entrada ? (
              <span className="text-stone-600">✓ Entrada no estoque feita em {dataLonga(entrada)}.</span>
            ) : confirmarEntrada ? (
              <div className="space-y-2">
                <p>Entram no estoque: {consolidado(itens).map((c) => `${c.quantidade}x ${descricaoPeca(c)}`).join(' · ')}</p>
                {semTamanho > 0 && <p className="text-red-600">{semTamanho} peça{semTamanho > 1 ? 's' : ''} sem tamanho fica{semTamanho > 1 ? 'm' : ''} de fora.</p>}
                <div className="flex gap-2">
                  <Botao onClick={darEntrada}>Confirmar entrada</Botao>
                  <Botao variante="secundario" onClick={() => setConfirmarEntrada(false)}>Cancelar</Botao>
                </div>
              </div>
            ) : (
              <button className="font-semibold underline decoration-ozzy-500 decoration-2 underline-offset-4" onClick={() => setConfirmarEntrada(true)}>
                Chegou? Dar entrada destas peças no estoque
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select className={`${estiloEntrada} w-auto! min-w-0 flex-1 py-2!`} value={adicionar} onChange={(e) => setAdicionar(e.target.value)} aria-label="Pessoa para adicionar">
          <option value="">Adicionar pessoa…</option>
          {fora.map((p) => <option key={p.id} value={p.id}>{p.nome} · {loja(p.unidadeId)}</option>)}
        </select>
        <Botao variante="secundario" disabled={!adicionar} onClick={() => setEditando(equipe.find((f) => f.id === adicionar) ?? null)}>Adicionar</Botao>
      </div>

      {pessoas.length === 0 ? (
        <Vazio>Ninguém no pedido ainda.</Vazio>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
          {pessoas.map((p) => (
            <li key={p.id}>
              <button onClick={() => setEditando(p)} className="flex w-full items-center gap-3 p-3.5 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{p.nome}</span>
                  <span className="block text-xs text-stone-500">{loja(p.unidadeId)} · {p.cargo}</span>
                  <span className="mt-0.5 block text-sm text-stone-700">
                    {itens.filter((i) => i.funcionarioId === p.id).map((i) => `${i.quantidade}x ${descricaoPeca(i)}`).join(' · ')}
                  </span>
                </span>
                <span className="text-xl text-stone-300">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div>
        {apagar ? (
          <Botao variante="perigo" onClick={async () => { await store.excluirPedidoUniforme(pedido.id); await aoMudar(); aoVoltar(); avisar('Pedido apagado') }}>
            Confirmar: apagar o pedido inteiro
          </Botao>
        ) : (
          <Botao variante="fantasma" onClick={() => setApagar(true)}>Apagar pedido</Botao>
        )}
      </div>

      {editando && (
        <PecasPessoa
          pessoa={editando}
          atuais={itens.filter((i) => i.funcionarioId === editando.id)}
          aoFechar={() => { setEditando(null); setAdicionar('') }}
          aoSalvar={async (linhas) => {
            await store.definirItensPedido(pedido.id, editando.id, linhas)
            setEditando(null)
            setAdicionar('')
            await carregar()
            avisar(linhas.length ? `Peças de ${editando.nome.split(' ')[0]} salvas` : `${editando.nome.split(' ')[0]} saiu do pedido`)
          }}
        />
      )}
      {dados && (
        <DadosPedido pedido={pedido} aoFechar={() => setDados(false)} aoSalvar={async () => { setDados(false); await aoMudar(); avisar('Pedido atualizado') }} />
      )}
      {relatorio && <Relatorio pedido={pedido} itens={itens} pessoas={pessoas} nomeDe={nomeDe} loja={loja} aoFechar={() => setRelatorio(false)} />}
    </div>
  )
}

type Linha = Omit<ItemPedidoUniforme, 'id' | 'pedidoId' | 'funcionarioId'>

function PecasPessoa({ pessoa: p, atuais, aoFechar, aoSalvar }: { pessoa: Funcionario; atuais: ItemPedidoUniforme[]; aoFechar: () => void; aoSalvar: (l: Linha[]) => Promise<void> }) {
  const novo = atuais.length === 0
  // Pessoa nova no pedido: já vem com 2 camisetas e 2 calças (o caso mais comum).
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    PECAS.map((pc) => {
      const a = atuais.find((i) => i.item === pc.item)
      return {
        item: pc.item,
        cor: a?.cor ?? (pc.cor ? corCamiseta(p) : null),
        modelagem: a?.modelagem ?? (pc.modelagem ? modelagemDe(p) : null),
        tamanho: a?.tamanho ?? pc.tamanho(p),
        quantidade: a?.quantidade ?? (novo && (pc.item === 'Camiseta' || pc.item === 'Calça') ? 2 : 0),
      }
    }),
  )
  const [salvando, setSalvando] = useState(false)
  const mudar = (i: number, m: Partial<Linha>) => setLinhas(linhas.map((l, j) => (j === i ? { ...l, ...m } : l)))
  const semTamanho = linhas.some((l) => l.quantidade > 0 && !l.tamanho)

  return (
    <Modal titulo={p.nome} aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        <p className="text-xs text-stone-500">
          {p.cargo} · {p.sexo === 'feminino' ? 'feminino' : p.sexo === 'masculino' ? 'masculino' : 'sexo não informado'} · {tamanhosDe(p)}
        </p>
        {linhas.map((l, i) => {
          const pc = PECAS[i]
          return (
            <div key={l.item} className={`rounded-xl p-3 ring-1 ${l.quantidade > 0 ? 'bg-ozzy-50 ring-ozzy-300' : 'bg-white ring-stone-200'}`}>
              <div className="flex items-center gap-3">
                <span className="flex-1 font-semibold">{l.item}</span>
                <button type="button" aria-label={`Menos ${l.item}`} className="h-9 w-9 rounded-lg bg-stone-100 text-lg font-bold" onClick={() => mudar(i, { quantidade: Math.max(0, l.quantidade - 1) })}>−</button>
                <span className="w-6 text-center text-lg font-bold tabular-nums" aria-label={`Quantidade de ${l.item}`}>{l.quantidade}</span>
                <button type="button" aria-label={`Mais ${l.item}`} className="h-9 w-9 rounded-lg bg-stone-100 text-lg font-bold" onClick={() => mudar(i, { quantidade: Math.min(99, l.quantidade + 1) })}>+</button>
              </div>
              {l.quantidade > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {pc.cor && (
                    <select className={`${estiloEntrada} w-auto! py-1.5!`} value={l.cor ?? ''} onChange={(e) => mudar(i, { cor: e.target.value })} aria-label={`Cor ${l.item}`}>
                      {CORES_CAMISETA.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  )}
                  {pc.modelagem && (
                    <select className={`${estiloEntrada} w-auto! py-1.5!`} value={l.modelagem ?? 'unissex'} onChange={(e) => mudar(i, { modelagem: e.target.value as Modelagem })} aria-label={`Modelagem ${l.item}`}>
                      <option value="feminina">Feminina</option>
                      <option value="masculina">Masculina</option>
                      <option value="unissex">Unissex</option>
                    </select>
                  )}
                  <input className={`${estiloEntrada} w-24! py-1.5!`} value={l.tamanho ?? ''} onChange={(e) => mudar(i, { tamanho: e.target.value || null })} placeholder="Tamanho" aria-label={`Tamanho ${l.item}`} />
                </div>
              )}
            </div>
          )
        })}
        {semTamanho && <p className="text-sm text-ozzy-800">Falta tamanho em alguma peça. Preencha aqui ou no cadastro da pessoa.</p>}
        <Botao className="w-full" disabled={salvando} onClick={async () => { setSalvando(true); await aoSalvar(linhas.filter((l) => l.quantidade > 0)) }}>
          Salvar
        </Botao>
        {!novo && (
          <Botao variante="fantasma" className="w-full" disabled={salvando} onClick={async () => { setSalvando(true); await aoSalvar([]) }}>
            Tirar do pedido
          </Botao>
        )}
      </div>
    </Modal>
  )
}

function Relatorio({ pedido, itens, pessoas, loja, aoFechar }: {
  pedido: PedidoUniforme
  itens: ItemPedidoUniforme[]
  pessoas: Funcionario[]
  nomeDe: (id: string) => string
  loja: (id: string) => string
  aoFechar: () => void
}) {
  const { avisar } = useApp()
  const resumo = consolidado(itens)
  const total = itens.reduce((s, i) => s + i.quantidade, 0)
  const texto = () =>
    [
      `*Pedido de uniformes The Ozzy · ${pedido.titulo}*`,
      pedido.observacao ? `Obs.: ${pedido.observacao}` : '',
      '',
      '*Totais*',
      ...resumo.map((r) => `• ${r.quantidade}x ${descricaoPeca(r)}`),
      '',
      '*Por pessoa*',
      ...pessoas.map((p) => `• ${p.nome}: ${itens.filter((i) => i.funcionarioId === p.id).map((i) => `${i.quantidade}x ${descricaoPeca(i)}`).join(', ')}`),
    ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n')
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto())
      avisar('Copiado! É só colar no WhatsApp ou e-mail do fornecedor.')
    } catch {
      avisar('Não deu para copiar neste aparelho')
    }
  }
  return (
    <Impressao titulo="Pedido de uniformes" aoFechar={aoFechar}>
      <div className="nao-imprimir mb-4">
        <Botao variante="secundario" onClick={copiar}>Copiar texto</Botao>
      </div>
      <div className="flex items-center gap-4 border-b border-black pb-3">
        <img src={logo} alt="The Ozzy" className="h-16 w-16 shrink-0" />
        <div>
          <h1 className="text-lg font-bold">Pedido de uniformes · {pedido.titulo}</h1>
          <p className="text-xs">Pedido nº {pedido.numero} · emitido em {dataLonga(hoje())}{pedido.fornecedor && ` · ${pedido.fornecedor}`}</p>
          {(pedido.fechadoEm || pedido.previsaoEntrega) && (
            <p className="text-xs">
              {pedido.fechadoEm && `Fechado em ${dataLonga(pedido.fechadoEm)}`}
              {pedido.fechadoEm && pedido.previsaoEntrega && ' · '}
              {pedido.previsaoEntrega && `Entrega prevista para ${dataLonga(pedido.previsaoEntrega)}`}
            </p>
          )}
        </div>
      </div>
      {pedido.observacao && <p className="mt-3 text-sm"><b>Observação:</b> {pedido.observacao}</p>}
      <h2 className="mt-4 mb-1 font-bold">Totais ({total} peças{pedido.valorTotal != null ? ` · ${reais(pedido.valorTotal)}` : ''})</h2>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-1">Peça</th><th>Cor</th><th>Modelagem</th><th>Tamanho</th><th className="text-right">Qtd.</th>
          </tr>
        </thead>
        <tbody>
          {resumo.map((r) => (
            <tr key={[r.item, r.cor, r.modelagem, r.tamanho].join('|')} className="border-b border-stone-300">
              <td className="py-1">{r.item}</td><td>{r.cor ?? '—'}</td><td>{r.modelagem ?? '—'}</td><td>{r.tamanho ?? '—'}</td>
              <td className="text-right font-semibold tabular-nums">{r.quantidade}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="mt-5 mb-1 font-bold">Por pessoa</h2>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black text-left"><th className="py-1">Nome</th><th>Loja</th><th>Peças</th></tr>
        </thead>
        <tbody>
          {pessoas.map((p) => (
            <tr key={p.id} className="border-b border-stone-300 align-top">
              <td className="py-1 pr-2">{p.nome}</td>
              <td className="pr-2">{loja(p.unidadeId)}</td>
              <td>{itens.filter((i) => i.funcionarioId === p.id).map((i) => `${i.quantidade}x ${descricaoPeca(i)}`).join('; ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Impressao>
  )
}

// Tabela de valores (reunião de RH de 08/10): quanto se desconta de cada peça não devolvida no desligamento.
function ValoresUniforme() {
  const { store, avisar } = useApp()
  const [linhas, setLinhas] = useState<{ item: string; valor: string; original?: string }[]>([])
  const [salvando, setSalvando] = useState(false)
  const carregar = useCallback(
    () =>
      store.valoresUniforme().then((t) => {
        const itens = [...new Set([...PECAS.map((p) => p.item), ...Object.keys(t)])]
        setLinhas(itens.map((item) => ({ item, original: item in t ? item : undefined, valor: item in t ? String(t[item]).replace('.', ',') : '' })))
      }),
    [store],
  )
  useEffect(() => {
    carregar()
  }, [carregar])
  const numero = (s: string) => lerNumero(s) ?? 0
  const salvar = async () => {
    setSalvando(true)
    try {
      const mudancas: Record<string, number | null> = {}
      for (const l of linhas) {
        const nome = l.item.trim()
        if (l.original && l.original !== nome) mudancas[l.original] = null
        if (!nome) continue
        mudancas[nome] = l.valor.trim() && numero(l.valor) >= 0 ? numero(l.valor) : null
      }
      await store.salvarValoresUniforme(mudancas)
      await carregar()
      avisar('Tabela de valores salva')
    } catch (e) {
      avisar((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }
  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <p className="text-sm text-stone-600">
        Valor de cada peça, descontado na rescisão se a pessoa não devolver. Entra sozinho na conferência da devolução (perfil › Uniformes).
      </p>
      {linhas.map((l, i) => (
        <div key={i} className="grid grid-cols-[1fr_8rem] gap-2">
          <input className={estiloEntrada} value={l.item} onChange={(e) => setLinhas(linhas.map((x, k) => (k === i ? { ...x, item: e.target.value } : x)))} aria-label="Peça" />
          <input className={estiloEntrada} inputMode="decimal" placeholder="R$ 0,00" value={l.valor} onChange={(e) => setLinhas(linhas.map((x, k) => (k === i ? { ...x, valor: e.target.value } : x)))} aria-label={`Valor de ${l.item}`} />
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Botao variante="secundario" onClick={() => setLinhas([...linhas, { item: '', valor: '' }])}>+ Peça</Botao>
        <Botao disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar tabela'}</Botao>
      </div>
    </section>
  )
}
