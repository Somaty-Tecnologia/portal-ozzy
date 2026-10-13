import { useCallback, useEffect, useMemo, useState } from 'react'
import { Botao, Campo, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { naHoraDeComprar, quantidadeSugerida, ritmo } from '../lib/compras'
import { addDias, dataCurta, diaSemana, diasEntre, hoje, inicioDaSemana } from '../lib/datas'
import { lerValor, mostrarQtd, nomeCentro, reais } from '../lib/financeiro'
import {
  CATEGORIAS_COMPRA, STATUS_COMPRA,
  type CategoriaCompra, type CompraFornecedor, type CentroCusto, type Fornecedor, type Insumo, type ItemCompra, type NovoPedidoCompra, type PedidoCompra, type PrecoFornecedor, type StatusCompra,
} from '../lib/types'

// Compras (Heitor, 09/10): pedido de compra ao fornecedor (itens, preço, previsão de entrega) e o relatório
// da semana por dia de entrega, para a equipe saber o que chega e quando. Compra-se às segundas; embalagem
// costuma levar mais tempo, então o prazo do fornecedor sugere a previsão.

const SELO_STATUS: Record<StatusCompra, 'cinza' | 'ambar' | 'verde' | 'azul'> = { rascunho: 'cinza', pedido: 'azul', recebido: 'verde', cancelado: 'cinza' }
const nomeStatus = (s: StatusCompra) => STATUS_COMPRA.find((x) => x.valor === s)!.nome
const nomeCategoria = (c: CategoriaCompra) => CATEGORIAS_COMPRA.find((x) => x.valor === c)!.nome
const prazoPadrao = (c: CategoriaCompra) => (c === 'embalagens' ? 15 : 2)
const numTexto = (n: number | null) => (n === null ? '' : String(n).replace('.', ','))

interface Dados { pedidos: PedidoCompra[]; fornecedores: Fornecedor[]; insumos: Insumo[]; centros: CentroCusto[] }

function useDados() {
  const { store } = useApp()
  const [d, setD] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const carregar = useCallback(
    () => Promise.all([store.pedidosCompra(), store.fornecedores(), store.insumos(), store.centrosCusto()])
      .then(([pedidos, fornecedores, insumos, centros]) => setD({ pedidos, fornecedores, insumos, centros }), (e) => setErro(e.message)),
    [store],
  )
  useEffect(() => { carregar() }, [carregar])
  return { d, erro, carregar }
}

// "2 fardos (24 un) Coca-Cola" quando foi pedido em embalagem; senão "24 un Coca-Cola".
const plural = (n: number, s: string) => (n > 1 && /[aeiou]$/i.test(s) ? s + 's' : s)
export const qtdItem = (i: { quantidade: number; unidade: string; embalagem?: string | null; fator?: number | null }) =>
  i.fator && i.fator > 0 && i.fator !== 1 && i.embalagem
    ? `${mostrarQtd(Math.round((i.quantidade / i.fator) * 1000) / 1000)} ${plural(i.quantidade / i.fator, i.embalagem)} (${mostrarQtd(i.quantidade)} ${i.unidade})`
    : `${mostrarQtd(i.quantidade)} ${i.unidade}`
const linhaItem = (d: Dados, i: ItemCompra) => `${qtdItem(i)} ${d.insumos.find((x) => x.id === i.insumoId)?.nome ?? 'item'}`

// ——— Lista de pedidos ———

// Situação de uma compra a receber (Heitor, 09/10): passou do dia previsto sem chegar = atrasada.
type Situacao = 'atrasada' | 'hoje' | 'prazo' | 'rascunho' | 'fechada'
function situacao(p: PedidoCompra): Situacao {
  if (p.status === 'rascunho') return 'rascunho'
  if (p.status !== 'pedido') return 'fechada'
  return p.previsaoEntrega < hoje() ? 'atrasada' : p.previsaoEntrega === hoje() ? 'hoje' : 'prazo'
}
const SECOES: { s: Situacao; titulo: string; cor: string }[] = [
  { s: 'atrasada', titulo: 'Atrasadas', cor: 'text-red-700' },
  { s: 'hoje', titulo: 'Chegam hoje', cor: 'text-amber-800' },
  { s: 'prazo', titulo: 'No prazo', cor: 'text-stone-700' },
  { s: 'rascunho', titulo: 'Rascunhos (ainda não pedidos)', cor: 'text-stone-500' },
]
const quandoChega = (p: PedidoCompra) => {
  const dias = diasEntre(hoje(), p.previsaoEntrega)
  const data = `${diaSemana(p.previsaoEntrega).toLowerCase()} ${dataCurta(p.previsaoEntrega)}`
  if (p.status === 'recebido') return `chegou${p.recebidoEm ? ' ' + dataCurta(p.recebidoEm) : ''}`
  if (p.status === 'cancelado') return 'cancelado'
  if (p.status === 'rascunho') return `previsto ${data}`
  if (dias < 0) return `atrasada há ${-dias} ${dias === -1 ? 'dia' : 'dias'} (era ${data})`
  if (dias === 0) return 'chega hoje'
  return `chega ${data} · em ${dias} ${dias === 1 ? 'dia' : 'dias'}`
}

export function PedidosCompra() {
  const { store, avisar } = useApp()
  const { d, erro, carregar } = useDados()
  const [editando, setEditando] = useState<PedidoCompra | 'novo' | null>(null)
  const [filtro, setFiltro] = useState<'abertos' | 'todos'>('abertos')
  const [busca, setBusca] = useState('')

  if (erro) return <p className="text-red-700">{erro}</p>
  if (!d) return <p className="text-stone-400">Carregando…</p>
  if (editando) return <FormPedido d={d} pedido={editando === 'novo' ? null : editando} aoFechar={async (mudou) => { setEditando(null); if (mudou) await carregar() }} />

  const fornecedor = (id: string) => d.fornecedores.find((f) => f.id === id)
  const termo = busca.trim().toLowerCase()
  const lista = d.pedidos
    .filter((p) => (filtro === 'todos' || p.status === 'rascunho' || p.status === 'pedido'))
    .filter((p) => !termo || (fornecedor(p.fornecedorId)?.nome ?? '').toLowerCase().includes(termo) || p.itens.some((i) => (d.insumos.find((x) => x.id === i.insumoId)?.nome ?? '').toLowerCase().includes(termo)))
    .sort((a, b) => a.previsaoEntrega.localeCompare(b.previsaoEntrega) * (filtro === 'abertos' ? 1 : -1))
  const abertos = d.pedidos.filter((p) => p.status === 'pedido' || p.status === 'rascunho')
  const conta = (s: Situacao) => abertos.filter((p) => situacao(p) === s).length

  const linha = (p: PedidoCompra) => {
    const sit = situacao(p)
    return (
      <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-stone-50">
        <button onClick={() => setEditando(p)} className="min-w-0 flex-1 text-left">
          <div className="truncate text-sm font-semibold">{fornecedor(p.fornecedorId)?.nome ?? 'Fornecedor'} <span className="font-normal text-stone-500">#{p.numero}</span></div>
          <div className="truncate text-xs text-stone-500">
            {p.itens.slice(0, 3).map((i) => linhaItem(d, i)).join(', ')}{p.itens.length > 3 ? ` e mais ${p.itens.length - 3}` : ''} · para {nomeCentro(d.centros.find((c) => c.id === p.centroCustoId))}
          </div>
          <div className={`text-xs font-semibold ${sit === 'atrasada' ? 'text-red-700' : sit === 'hoje' ? 'text-amber-800' : 'text-stone-600'}`}>{quandoChega(p)}</div>
        </button>
        {p.status === 'pedido' ? (
          <Botao variante="secundario" className="shrink-0 px-3! py-1.5!" onClick={async () => {
            try { await store.receberPedidoCompra(p.id, true); avisar('Marcado como recebido'); await carregar() } catch (e) { avisar((e as Error).message) }
          }}>Chegou</Botao>
        ) : <Selo cor={SELO_STATUS[p.status]}>{nomeStatus(p.status)}</Selo>}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Botao onClick={() => setEditando('novo')}>+ Novo pedido de compra</Botao>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value as 'abertos' | 'todos')} className={`${estiloEntrada} w-auto!`} aria-label="Mostrar">
          <option value="abertos">A receber</option><option value="todos">Todos</option>
        </select>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Fornecedor ou item" className={`${estiloEntrada} max-w-xs`} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {SECOES.slice(0, 3).map(({ s, titulo, cor }) => (
          <div key={s} className={`rounded-2xl bg-white p-3 text-center ring-1 ${s === 'atrasada' && conta(s) ? 'ring-red-300' : 'ring-stone-200'}`}>
            <div className={`text-2xl font-bold ${conta(s) ? cor : 'text-stone-300'}`}>{conta(s)}</div>
            <div className="text-xs text-stone-500">{titulo}</div>
          </div>
        ))}
      </div>

      {lista.length === 0 ? <Vazio>{filtro === 'abertos' ? 'Nenhuma compra a receber.' : 'Nenhum pedido de compra ainda.'}</Vazio> : filtro === 'abertos' ? (
        SECOES.map(({ s, titulo, cor }) => {
          const daqui = lista.filter((p) => situacao(p) === s)
          if (!daqui.length) return null
          return (
            <section key={s} className="space-y-1">
              <h3 className={`text-sm font-bold ${cor}`}>{titulo} ({daqui.length})</h3>
              <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">{daqui.map(linha)}</div>
            </section>
          )
        })
      ) : (
        <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">{lista.map(linha)}</div>
      )}
    </div>
  )
}

// ——— Formulário do pedido ———

// qtd e preço na unidade escolhida: a do estoque (fator 1) ou a embalagem do material (fardo com 12 → fator 12).
interface LinhaForm { chave: string; insumoId: string; qtd: string; unidade: string; preco: string; fator: number; embalagem: string | null }
const arred = (n: number) => Math.round(n * 10000) / 10000
// Preço da embalagem em centavos; o da unidade com até 4 casas.
const precoNa = (n: number, fator: number) => (fator !== 1 ? Math.round(n * 100) / 100 : arred(n))
let seq = 0

function FormPedido({ d, pedido, aoFechar }: { d: Dados; pedido: PedidoCompra | null; aoFechar: (mudou: boolean) => void }) {
  const { store, avisar } = useApp()
  const [fornecedores, setFornecedores] = useState(d.fornecedores)
  const [insumos, setInsumos] = useState(d.insumos)
  const [v, setV] = useState({
    fornecedorId: pedido?.fornecedorId ?? '', centroCustoId: pedido?.centroCustoId ?? 'central', categoria: pedido?.categoria ?? ('insumos' as CategoriaCompra),
    dataPedido: pedido?.dataPedido ?? hoje(), previsaoEntrega: pedido?.previsaoEntrega ?? addDias(hoje(), 2),
    formaPagamento: pedido?.formaPagamento ?? '', observacao: pedido?.observacao ?? '',
  })
  const [previsaoMexida, setPrevisaoMexida] = useState(!!pedido)
  const [linhas, setLinhas] = useState<LinhaForm[]>(() => (pedido?.itens ?? []).map((i) => {
    const f = i.fator && i.fator > 0 && i.fator !== 1 ? i.fator : 1
    return { chave: 'l' + seq++, insumoId: i.insumoId, qtd: numTexto(arred(i.quantidade / f)), unidade: i.unidade, preco: numTexto(i.preco === null ? null : precoNa(i.preco * f, f)), fator: f, embalagem: f !== 1 ? i.embalagem ?? null : null }
  }))
  const [precos, setPrecos] = useState<PrecoFornecedor[]>([])
  const [historico, setHistorico] = useState<CompraFornecedor[]>([])
  const [busca, setBusca] = useState('')
  const [novoFornecedor, setNovoFornecedor] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const fornecedor = fornecedores.find((f) => f.id === v.fornecedorId)
  const editavel = !pedido || pedido.status === 'rascunho' || pedido.status === 'pedido'

  useEffect(() => {
    setPrecos([])
    setHistorico([])
    if (!v.fornecedorId) return
    // Trocou de fornecedor antes de chegar a resposta: a do anterior é descartada.
    let vale = true
    store.precosFornecedor(v.fornecedorId).then((p) => vale && setPrecos(p), () => undefined)
    store.comprasDoFornecedor(v.fornecedorId).then((h) => vale && setHistorico(h), () => undefined)
    return () => { vale = false }
  }, [store, v.fornecedorId])

  // Previsão pelo prazo do fornecedor (ou o padrão da categoria), até a pessoa mexer nela.
  useEffect(() => {
    if (previsaoMexida) return
    setV((x) => ({ ...x, previsaoEntrega: addDias(x.dataPedido, fornecedor?.prazoEntregaDias ?? prazoPadrao(x.categoria)) }))
  }, [fornecedor, v.dataPedido, v.categoria, previsaoMexida])

  const ultimo = (insumoId: string) => precos.find((p) => p.insumoId === insumoId)
  // Forma de pagamento: a do último pedido com este fornecedor (pedido de 09/10), se ainda estiver em branco.
  // Troca de fornecedor substitui o que veio sozinho, nunca o que a pessoa digitou.
  const [formaAuto, setFormaAuto] = useState('')
  useEffect(() => {
    if (pedido) return
    const anterior = d.pedidos.filter((p) => p.fornecedorId === v.fornecedorId && p.formaPagamento).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0]
    const nova = anterior?.formaPagamento ?? ''
    setV((x) => (x.formaPagamento.trim() && x.formaPagamento !== formaAuto ? x : { ...x, formaPagamento: nova }))
    setFormaAuto(nova)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.pedidos, pedido, v.fornecedorId])

  // Trocou de fornecedor: preço em branco vira o último desse fornecedor.
  useEffect(() => {
    if (!precos.length) return
    setLinhas((ls) => ls.map((l) => { const u = ultimo(l.insumoId)?.preco; return l.preco.trim() || u === undefined ? l : { ...l, preco: numTexto(precoNa(u * l.fator, l.fator)) } }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precos])

  const adicionar = (ins: Insumo, qtd: number | null = null) => {
    if (linhas.some((l) => l.insumoId === ins.id)) return avisar('Este item já está no pedido.')
    // Material com embalagem (fardo com 12…): já entra pedido em fardo.
    const f = ins.embalagem && ins.embalagemQtd && ins.embalagemQtd > 0 && ins.embalagemQtd !== 1 ? ins.embalagemQtd : 1
    const u = ultimo(ins.id)?.preco
    setLinhas((ls) => [...ls, { chave: 'l' + seq++, insumoId: ins.id, qtd: numTexto(qtd === null ? null : arred(qtd / f)), unidade: ins.unidade, preco: numTexto(u === undefined ? null : precoNa(u * f, f)), fator: f, embalagem: f !== 1 ? ins.embalagem : null }])
    setBusca('')
  }
  const mudar = (chave: string, m: Partial<LinhaForm>) => setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...m } : l)))
  // Troca entre a unidade do estoque e a embalagem, convertendo o que já foi digitado. "Fardo, caixa…" grava a
  // embalagem no cadastro do material, para os próximos pedidos já virem nela.
  const trocarUnidade = async (l: LinhaForm, ins: Insumo | undefined, op: string) => {
    let f = 1
    let emb: string | null = null
    if (op === 'emb' && ins) {
      f = l.fator !== 1 ? l.fator : ins.embalagemQtd ?? 1
      emb = l.fator !== 1 ? l.embalagem : ins.embalagem
    } else if (op === 'nova' && ins) {
      const nome = prompt('Como vem do fornecedor? (fardo, caixa, pacote…)', ins.embalagem ?? 'fardo')?.trim().toLowerCase()
      if (!nome) return
      const n = lerValor(prompt(`Quantos ${ins.unidade} vêm em 1 ${nome}?`, ins.embalagemQtd ? numTexto(ins.embalagemQtd) : '') ?? '')
      if (!n || n <= 0) return avisar(`Coloque quantos ${ins.unidade} vêm na embalagem (ex.: 12, 1 ou 0,330 para 330 g).`)
      try {
        const salvo = await store.salvarInsumo({ ...ins, embalagem: nome, embalagemQtd: n })
        setInsumos((is) => is.map((x) => (x.id === ins.id ? salvo : x)))
      } catch (e) {
        return avisar((e as Error).message)
      }
      f = n
      emb = nome
    }
    const q = lerValor(l.qtd)
    const pr = lerValor(l.preco)
    mudar(l.chave, { fator: f, embalagem: emb, qtd: q === null ? l.qtd : numTexto(arred((q * l.fator) / f)), preco: pr === null ? l.preco : numTexto(precoNa((pr / l.fator) * f, f)) })
  }

  const termo = busca.trim().toLowerCase()
  const achados = termo.length >= 2 ? insumos.filter((i) => i.nome.toLowerCase().includes(termo)).sort((a, b) => Number(b.ativo) - Number(a.ativo)).slice(0, 8) : []
  // Sugestões pelo histórico deste fornecedor (o que costuma comprar e quanto); depois os outros já comprados dele.
  const sugeridos = historico
    .map((c) => ({ c, ins: insumos.find((i) => i.id === c.insumoId) }))
    .filter((x): x is { c: CompraFornecedor; ins: Insumo } => !!x.ins && x.ins.ativo && !linhas.some((l) => l.insumoId === x.c.insumoId))
    .map((x) => ({ ...x, qtd: quantidadeSugerida(x.c, x.ins), hora: naHoraDeComprar(x.c, v.previsaoEntrega) }))
  const daVez = sugeridos.filter((x) => x.hora && x.c.compras > 0)
  const jaComprados = precos.map((p) => insumos.find((i) => i.id === p.insumoId)).filter((i): i is Insumo => !!i && !linhas.some((l) => l.insumoId === i.id) && !historico.some((c) => c.insumoId === i.id))
  const total = linhas.reduce((t, l) => t + (lerValor(l.qtd) ?? 0) * (lerValor(l.preco) ?? 0), 0)

  const textoFornecedor = () => [
    `*Pedido de compra The Ozzy #${pedido?.numero ?? 'novo'}*`,
    `Entrega: ${diaSemana(v.previsaoEntrega).toLowerCase()} ${dataCurta(v.previsaoEntrega)} · ${nomeCentro(d.centros.find((c) => c.id === v.centroCustoId))}`,
    '',
    ...linhas.filter((l) => (lerValor(l.qtd) ?? 0) > 0).map((l) => `${qtdItem({ quantidade: arred((lerValor(l.qtd) ?? 0) * l.fator), unidade: l.unidade, embalagem: l.embalagem, fator: l.fator })} ${insumos.find((i) => i.id === l.insumoId)?.nome ?? ''}`),
    v.observacao ? `\nObs.: ${v.observacao}` : '',
  ].join('\n').trim()

  const salvar = async (status: StatusCompra) => {
    setErro('')
    if (!v.fornecedorId) return setErro('Escolha o fornecedor.')
    const itens = linhas.map((l) => {
      const preco = lerValor(l.preco)
      return { insumoId: l.insumoId, quantidade: arred((lerValor(l.qtd) ?? 0) * l.fator), unidade: l.unidade.trim() || 'un', preco: preco === null ? null : arred(preco / l.fator), embalagem: l.fator !== 1 ? l.embalagem : null, fator: l.fator !== 1 ? l.fator : null }
    })
    if (status !== 'cancelado' && !itens.some((i) => i.quantidade > 0)) return setErro('Coloque a quantidade de pelo menos um item.')
    if (v.previsaoEntrega < v.dataPedido) return setErro('A entrega não pode ser antes do pedido.')
    setSalvando(true)
    try {
      const p: NovoPedidoCompra = { ...v, id: pedido?.id, status, itens, formaPagamento: v.formaPagamento || null, observacao: v.observacao || null }
      await store.salvarPedidoCompra(p)
      // Comprou um material inativo (Heitor, 12/10): ele volta a ficar ativo.
      const inativos = status === 'cancelado' || status === 'rascunho' ? [] : itens.filter((i) => i.quantidade > 0 && insumos.find((x) => x.id === i.insumoId)?.ativo === false).map((i) => i.insumoId)
      if (inativos.length) await store.ativarInsumos(inativos, true)
      // Primeiro pedido com este fornecedor: o prazo vira o padrão dele.
      if (fornecedor && fornecedor.prazoEntregaDias == null && status === 'pedido') {
        await store.salvarFornecedor({ ...fornecedor, prazoEntregaDias: diasEntre(v.dataPedido, v.previsaoEntrega) }).catch(() => undefined)
      }
      avisar(status === 'cancelado' ? 'Pedido cancelado' : status === 'rascunho' ? 'Rascunho salvo' : 'Pedido de compra salvo')
      aoFechar(true)
    } catch (e) {
      setErro((e as Error).message)
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={() => aoFechar(false)} className="text-sm font-semibold text-stone-500 hover:text-carvao">← Voltar</button>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold">{pedido ? `Pedido de compra #${pedido.numero}` : 'Novo pedido de compra'}</h2>
        {pedido && <Selo cor={SELO_STATUS[pedido.status]}>{nomeStatus(pedido.status)}{pedido.recebidoEm ? ` em ${dataCurta(pedido.recebidoEm)}` : ''}</Selo>}
      </div>

      <div className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200 sm:grid-cols-2">
        <Campo rotulo="Fornecedor">
          {novoFornecedor === null ? (
            <div className="flex gap-2">
              <select value={v.fornecedorId} disabled={!editavel} onChange={(e) => setV({ ...v, fornecedorId: e.target.value })} className={estiloEntrada} aria-label="Fornecedor">
                <option value="">Escolha…</option>
                {fornecedores.filter((f) => f.ativo || f.id === v.fornecedorId).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
              {editavel && <Botao variante="secundario" onClick={() => setNovoFornecedor('')}>Novo</Botao>}
            </div>
          ) : (
            <div className="flex gap-2">
              <input autoFocus value={novoFornecedor} onChange={(e) => setNovoFornecedor(e.target.value)} placeholder="Nome do fornecedor" className={estiloEntrada} />
              <Botao variante="secundario" disabled={!novoFornecedor.trim()} onClick={async () => {
                try {
                  const f = await store.salvarFornecedor({ nome: novoFornecedor, contato: null, telefone: null, observacao: null, ativo: true })
                  setFornecedores((l) => [...l, f].sort((a, b) => a.nome.localeCompare(b.nome)))
                  setV((x) => ({ ...x, fornecedorId: f.id }))
                  setNovoFornecedor(null)
                } catch (e) { setErro((e as Error).message) }
              }}>Cadastrar</Botao>
            </div>
          )}
        </Campo>
        <Campo rotulo="O que é">
          <select value={v.categoria} disabled={!editavel} onChange={(e) => setV({ ...v, categoria: e.target.value as CategoriaCompra })} className={estiloEntrada}>
            {CATEGORIAS_COMPRA.map((c) => <option key={c.valor} value={c.valor}>{c.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Para onde vai">
          <select value={v.centroCustoId} disabled={!editavel} onChange={(e) => setV({ ...v, centroCustoId: e.target.value })} className={estiloEntrada}>
            {d.centros.map((c) => <option key={c.id} value={c.id}>{nomeCentro(c)}</option>)}
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-2">
          <Campo rotulo="Pedido em">
            <input type="date" value={v.dataPedido} disabled={!editavel} onChange={(e) => e.target.value && setV({ ...v, dataPedido: e.target.value })} className={estiloEntrada} />
          </Campo>
          <Campo rotulo="Previsão de entrega" dica={fornecedor?.prazoEntregaDias != null ? `Prazo do fornecedor: ${fornecedor.prazoEntregaDias} ${fornecedor.prazoEntregaDias === 1 ? "dia" : "dias"}` : undefined}>
            <input type="date" value={v.previsaoEntrega} disabled={!editavel} onChange={(e) => { if (e.target.value) { setV({ ...v, previsaoEntrega: e.target.value }); setPrevisaoMexida(true) } }} className={estiloEntrada} aria-label="Previsão de entrega" />
          </Campo>
        </div>
      </div>

      <div className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
        <h3 className="font-bold">Itens</h3>
        {linhas.length === 0 && <p className="text-sm text-stone-500">Procure abaixo o que vai comprar.</p>}
        {linhas.map((l) => {
          const ins = insumos.find((i) => i.id === l.insumoId)
          const u = ultimo(l.insumoId)
          const p = lerValor(l.preco)
          return (
            <div key={l.chave} className="rounded-xl bg-stone-50 p-2">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{ins?.nome ?? 'Item'}{ins && !ins.ativo && <span className="font-normal text-amber-700"> · inativo, volta a ficar ativo ao fazer o pedido</span>}</span>
                {editavel && <button className="text-xs font-semibold text-stone-500 underline hover:text-red-700" onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}>Tirar</button>}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <input inputMode="decimal" value={l.qtd} disabled={!editavel} onChange={(e) => mudar(l.chave, { qtd: e.target.value })} placeholder="Qtd." aria-label={`Quantidade de ${ins?.nome}`} className={`${estiloEntrada} w-20! text-center`} />
                <select value={l.fator !== 1 ? 'emb' : 'base'} disabled={!editavel} onChange={(e) => trocarUnidade(l, ins, e.target.value)} aria-label={`Unidade de ${ins?.nome}`} className={`${estiloEntrada} w-auto! py-1.5! pr-7!`}>
                  <option value="base">{l.unidade}</option>
                  {(l.fator !== 1 || (ins?.embalagem && ![0, 1].includes(ins.embalagemQtd ?? 0))) && (
                    <option value="emb">{l.fator !== 1 ? l.embalagem : ins!.embalagem} c/ {mostrarQtd(l.fator !== 1 ? l.fator : ins!.embalagemQtd!)} {l.unidade}</option>
                  )}
                  {ins && <option value="nova">{ins.embalagem && ![0, 1].includes(ins.embalagemQtd ?? 0) ? 'Mudar embalagem…' : 'Fardo, caixa…'}</option>}
                </select>
                <span className="text-sm text-stone-500">×</span>
                <input inputMode="decimal" value={l.preco} disabled={!editavel} onChange={(e) => mudar(l.chave, { preco: e.target.value })} placeholder="Preço" aria-label={`Preço de ${ins?.nome}`} className={`${estiloEntrada} w-24! text-right`} />
                <span className="ml-auto text-sm font-semibold">{reais((lerValor(l.qtd) ?? 0) * (p ?? 0))}</span>
              </div>
              {l.fator !== 1 && (lerValor(l.qtd) ?? 0) > 0 && (
                <p className="mt-1 text-xs text-stone-500">
                  = {mostrarQtd(arred((lerValor(l.qtd) ?? 0) * l.fator))} {l.unidade} no estoque{p !== null ? ` · ${reais(p / l.fator)}/${l.unidade}` : ''}
                </p>
              )}
              {u && (
                <p className={`mt-1 text-xs ${p !== null && Math.abs(p / l.fator - u.preco) > 0.0001 ? 'text-amber-800' : 'text-stone-500'}`}>
                  Último preço com este fornecedor: {reais(u.preco * l.fator)}{l.fator !== 1 ? ` o ${l.embalagem}` : ''} em {dataCurta(u.em)} ({u.origem === 'nota' ? 'nota fiscal' : u.origem === 'historico' ? 'Eclética' : 'pedido'}){p !== null && Math.abs(p / l.fator - u.preco) > 0.0001 ? ` · ${p / l.fator > u.preco ? 'subiu' : 'baixou'} ${Math.abs(Math.round(((p / l.fator - u.preco) / u.preco) * 1000) / 10).toLocaleString('pt-BR')}%` : ''}
                </p>
              )}
            </div>
          )
        })}

        {editavel && (
          <div className="space-y-2 pt-1">
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar item para adicionar" aria-label="Procurar item" className={estiloEntrada} />
            {achados.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {achados.map((i) => <button key={i.id} onClick={() => adicionar(i)} className="rounded-full bg-stone-100 px-3 py-1 text-sm hover:bg-stone-200">+ {i.nome}{!i.ativo && <span className="text-stone-400"> (inativo)</span>}</button>)}
              </div>
            )}
            {termo.length >= 2 && !insumos.some((i) => i.nome.toLowerCase() === termo) && (
              <button className="text-sm font-semibold text-stone-600 underline" onClick={async () => {
                try {
                  const novo = await store.salvarInsumo({
                    nome: busca.trim(), categoria: v.categoria === 'embalagens' ? 'Embalagens' : v.categoria === 'limpeza' ? 'Limpeza' : null, unidade: 'un',
                    embalagem: null, embalagemQtd: null, preco: null, fornecedorId: v.fornecedorId || null, observacao: 'Cadastrado no pedido de compra.', ativo: true,
                  })
                  setInsumos((l) => [...l, novo])
                  adicionar(novo)
                } catch (e) { setErro((e as Error).message) }
              }}>Cadastrar “{busca.trim()}” como item novo</button>
            )}
            {sugeridos.length > 0 && !termo && (
              <div className="rounded-xl bg-ozzy-50 p-3 ring-1 ring-ozzy-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold">Sugestão pelo que você costuma comprar daqui</p>
                  {daVez.length > 0 && <Botao variante="secundario" onClick={() => daVez.forEach((x) => adicionar(x.ins, x.qtd))}>Adicionar os {daVez.length} da vez</Botao>}
                </div>
                <p className="mt-0.5 text-xs text-stone-600">Média das últimas 12 semanas (histórico da Eclética e pedidos daqui). Ainda não desconta o que tem em estoque: confira antes de mandar.</p>
                <ul className="mt-2 divide-y divide-ozzy-100">
                  {sugeridos.slice(0, 40).map(({ c, ins, qtd, hora }) => (
                    <li key={c.insumoId} className="flex items-center gap-2 py-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{ins.nome} {hora && <Selo cor="ambar">da vez</Selo>}</div>
                        <div className="truncate text-xs text-stone-600">
                          {ritmo(c)} · última {dataCurta(c.ultima)}: {mostrarQtd(c.ultimaQtd)} {ins.unidade}{c.compras > 1 ? ` · média ${mostrarQtd(Math.round((c.intervaloDias !== null && c.intervaloDias >= 10 ? c.porCompra ?? 0 : c.porSemana) * 10) / 10)} ${ins.unidade}${c.intervaloDias !== null && c.intervaloDias >= 10 ? ' por compra' : '/semana'}` : ''}
                        </div>
                      </div>
                      <button onClick={() => adicionar(ins, qtd)} className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-semibold ring-1 ring-stone-300 hover:ring-carvao" aria-label={`Adicionar ${ins.nome}`}>
                        + {qtd !== null ? qtdItem({ quantidade: qtd, unidade: ins.unidade, embalagem: ins.embalagem, fator: ins.embalagemQtd }) : 'Adicionar'}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {jaComprados.length > 0 && !termo && (
              <div>
                <p className="text-xs font-semibold text-stone-500">Já comprados deste fornecedor</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {jaComprados.slice(0, 30).map((i) => <button key={i.id} onClick={() => adicionar(i)} className="rounded-full bg-stone-100 px-3 py-1 text-sm hover:bg-stone-200">+ {i.nome}</button>)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Forma de pagamento">
          <input value={v.formaPagamento} disabled={!editavel} onChange={(e) => setV({ ...v, formaPagamento: e.target.value })} placeholder="Ex.: boleto 14 dias" className={estiloEntrada} />
        </Campo>
        <Campo rotulo="Observação">
          <input value={v.observacao} disabled={!editavel} onChange={(e) => setV({ ...v, observacao: e.target.value })} placeholder="Ex.: entregar até 11h" className={estiloEntrada} />
        </Campo>
      </div>

      {erro && <p className="text-sm text-red-700">{erro}</p>}
      <div className="sticky bottom-2 z-10 flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-stone-300">
        <span className="flex-1 text-sm">Total <b>{reais(total)}</b></span>
        <Botao variante="secundario" disabled={!linhas.length} onClick={async () => {
          try { await navigator.clipboard.writeText(textoFornecedor()); avisar('Pedido copiado para mandar ao fornecedor') } catch { avisar('Não consegui copiar') }
        }}>Copiar</Botao>
        {editavel ? (
          <>
            {pedido && <Botao variante="perigo" disabled={salvando} onClick={() => confirm('Cancelar este pedido de compra?') && salvar('cancelado')}>Cancelar pedido</Botao>}
            {(!pedido || pedido.status === 'rascunho') && <Botao variante="secundario" disabled={salvando} onClick={() => salvar('rascunho')}>Rascunho</Botao>}
            {pedido?.status === 'pedido' && <Botao variante="secundario" disabled={salvando} onClick={async () => { await store.receberPedidoCompra(pedido.id, true); avisar('Marcado como recebido'); aoFechar(true) }}>Chegou</Botao>}
            <Botao disabled={salvando} onClick={() => salvar('pedido')}>{salvando ? 'Salvando…' : 'Salvar pedido'}</Botao>
          </>
        ) : pedido?.status === 'recebido' ? (
          <Botao variante="secundario" onClick={async () => { await store.receberPedidoCompra(pedido.id, false); avisar('Voltou para a receber'); aoFechar(true) }}>Ainda não chegou</Botao>
        ) : null}
      </div>
    </div>
  )
}

// ——— Entregas da semana ———

export function SemanaCompras() {
  const { store, avisar } = useApp()
  const { d, erro, carregar } = useDados()
  const [seg, setSeg] = useState(inicioDaSemana(hoje()))
  const [comPreco, setComPreco] = useState(false)
  const dias = useMemo(() => Array.from({ length: 7 }, (_, k) => addDias(seg, k)), [seg])

  if (erro) return <p className="text-red-700">{erro}</p>
  if (!d) return <p className="text-stone-400">Carregando…</p>
  const fim = addDias(seg, 6)
  const validos = d.pedidos.filter((p) => p.status === 'pedido' || p.status === 'recebido')
  const daSemana = validos.filter((p) => p.previsaoEntrega >= seg && p.previsaoEntrega <= fim)
  const depois = validos.filter((p) => p.status === 'pedido' && p.previsaoEntrega > fim).sort((a, b) => a.previsaoEntrega.localeCompare(b.previsaoEntrega))
  const atrasados = validos.filter((p) => p.status === 'pedido' && p.previsaoEntrega < seg && seg <= hoje())
  const nomeF = (id: string) => d.fornecedores.find((f) => f.id === id)?.nome ?? 'Fornecedor'
  const destino = (p: PedidoCompra) => nomeCentro(d.centros.find((c) => c.id === p.centroCustoId))
  const totalSemana = daSemana.reduce((t, p) => t + p.total, 0)

  const texto = () => {
    const l = [`*Entregas da semana ${dataCurta(seg)} a ${dataCurta(fim)}*`]
    for (const dia of dias) {
      const ps = daSemana.filter((p) => p.previsaoEntrega === dia)
      if (!ps.length) continue
      l.push('', `*${diaSemana(dia)} ${dataCurta(dia)}*`)
      for (const p of ps) l.push(`• ${nomeF(p.fornecedorId)} (${destino(p)}): ${p.itens.map((i) => linhaItem(d, i)).join(', ')}`)
    }
    if (depois.length) {
      l.push('', '*Chegam depois*')
      for (const p of depois) l.push(`• ${dataCurta(p.previsaoEntrega)} ${nomeF(p.fornecedorId)}: ${p.itens.map((i) => linhaItem(d, i)).join(', ')}`)
    }
    return l.join('\n')
  }

  const Cartao = ({ p }: { p: PedidoCompra }) => (
    <div className="rounded-xl bg-white p-3 ring-1 ring-stone-200">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{nomeF(p.fornecedorId)}</span>
        <span className="text-xs text-stone-500">#{p.numero} · {nomeCategoria(p.categoria)} · para {destino(p)}</span>
        {comPreco && <span className="ml-auto text-sm font-semibold">{reais(p.total)}</span>}
      </div>
      <ul className="mt-1 text-sm text-stone-700">
        {p.itens.map((i) => <li key={i.insumoId}>{linhaItem(d, i)}{comPreco && i.preco ? <span className="text-stone-500"> · {reais(i.preco)}</span> : ''}</li>)}
      </ul>
      {p.observacao && <p className="mt-1 text-xs text-stone-500">Obs.: {p.observacao}</p>}
      <div className="mt-2 print:hidden">
        {p.status === 'recebido' ? (
          <span className="text-xs font-semibold text-emerald-700">Chegou{p.recebidoEm ? ` em ${dataCurta(p.recebidoEm)}` : ''}</span>
        ) : (
          <button className="text-xs font-semibold text-stone-600 underline" onClick={async () => {
            try { await store.receberPedidoCompra(p.id, true); avisar('Marcado como recebido'); await carregar() } catch (e) { avisar((e as Error).message) }
          }}>Marcar que chegou</button>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Botao variante="secundario" onClick={() => setSeg(addDias(seg, -7))} aria-label="Semana anterior">‹</Botao>
        <span className="min-w-40 text-center font-semibold">{dataCurta(seg)} a {dataCurta(fim)}</span>
        <Botao variante="secundario" onClick={() => setSeg(addDias(seg, 7))} aria-label="Semana seguinte">›</Botao>
        <label className="ml-2 flex items-center gap-2 text-sm text-stone-600"><input type="checkbox" checked={comPreco} onChange={(e) => setComPreco(e.target.checked)} /> Mostrar valores</label>
        <div className="ml-auto flex gap-2">
          <Botao variante="secundario" onClick={async () => { try { await navigator.clipboard.writeText(texto()); avisar('Copiado para mandar à equipe') } catch { avisar('Não consegui copiar') } }}>Copiar para o WhatsApp</Botao>
          <Botao variante="secundario" onClick={() => window.print()}>Imprimir</Botao>
        </div>
      </div>
      <h2 className="hidden text-lg font-bold print:block">Entregas da semana {dataCurta(seg)} a {dataCurta(fim)}</h2>
      {comPreco && <p className="text-sm text-stone-600">Total da semana: <b>{reais(totalSemana)}</b></p>}

      {atrasados.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-bold text-red-700">Atrasados</h3>
          {atrasados.map((p) => <Cartao key={p.id} p={p} />)}
        </section>
      )}
      {daSemana.length === 0 ? <Vazio>Nenhuma entrega prevista nesta semana.</Vazio> : dias.map((dia) => {
        const ps = daSemana.filter((p) => p.previsaoEntrega === dia)
        if (!ps.length) return null
        return (
          <section key={dia} className="space-y-2">
            <h3 className={`font-bold ${dia === hoje() ? 'text-carvao' : 'text-stone-700'}`}>{diaSemana(dia)}, {dataCurta(dia)}{dia === hoje() ? ' · hoje' : ''}</h3>
            {ps.map((p) => <Cartao key={p.id} p={p} />)}
          </section>
        )
      })}
      {depois.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-bold text-stone-700">Chegam depois desta semana</h3>
          <p className="text-xs text-stone-500">Embalagens e pedidos com prazo maior.</p>
          {depois.map((p) => (
            <div key={p.id} className="text-sm"><b>{dataCurta(p.previsaoEntrega)}</b> · {nomeF(p.fornecedorId)}: {p.itens.map((i) => linhaItem(d, i)).join(', ')}</div>
          ))}
        </section>
      )}
    </div>
  )
}
