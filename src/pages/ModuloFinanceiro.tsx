import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Botao, Campo, Cartao, Modal, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useOrdem } from '../components/Ordenar'
import { useApp } from '../lib/contexto'
import { addMeses, dataCurta, diaSemana, hoje, mesDe, nomeMesAno } from '../lib/datas'
import { ir } from '../lib/rota'
import {
  lerValor, mostrarValor, nomeCentro, nomeConta, nomeForma, r2, reais, situacao, type SituacaoConta,
} from '../lib/financeiro'
import { FORMAS_PAGAMENTO, type ContaContabil, type ContaPagar, type FormaPagamento, type Fornecedor } from '../lib/types'
import Financeiro from './Financeiro'
import Conciliacao from './Conciliacao'
import Insumos from './Insumos'
import Recorrentes from './Recorrentes'
import { EditarConta, ImportarLote, type Dados } from './LancarContas'

const ABAS = [
  { id: '', nome: 'Contas a pagar' },
  { id: 'recorrentes', nome: 'Recorrentes' },
  { id: 'conciliacao', nome: 'Conciliação bancária' },
  { id: 'despesas', nome: 'Despesas' },
  { id: 'fornecedores', nome: 'Fornecedores' },
  { id: 'resultado', nome: 'Resultado (Lucro Fácil)' },
  { id: 'plano', nome: 'Plano de contas' },
]

// Financeiro (09/10): contas a pagar, despesas por conta contábil e loja (base da DRE), resultado do Lucro Fácil e plano de contas.
export default function ModuloFinanceiro({ sub }: { sub?: string }) {
  const aba = ABAS.some((a) => a.id && a.id === sub) ? sub! : ''
  return (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => ir(a.id ? 'financeiro/' + a.id : 'financeiro')}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold ${aba === a.id ? 'bg-carvao text-white' : 'text-stone-600 hover:bg-stone-200'}`}
          >
            {a.nome}
          </button>
        ))}
      </div>
      {aba === 'resultado' ? <Financeiro />
        : aba === 'conciliacao' ? <Conciliacao />
        : aba === 'recorrentes' ? <Recorrentes />
        : aba === 'despesas' ? <Despesas />
        : aba === 'plano' ? <PlanoContas />
        : aba === 'fornecedores' ? <Insumos aba="fornecedores" />
        : <ContasPagar />}
    </div>
  )
}

function useDados() {
  const { store } = useApp()
  const [d, setD] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const atualizou = useRef(false)
  const carregar = useCallback(
    // Na primeira vez, lança o que vem sozinho (recorrentes até o mês que vem, salários liberados, diárias de freelancer).
    async () => (atualizou.current ? undefined : ((atualizou.current = true), store.atualizarContasAutomaticas(addMeses(mesDe(hoje()), 1)).catch(() => {}))),
    [store],
  )
  const ler = useCallback(
    () => carregar().then(() => Promise.all([store.contasPagar(), store.centrosCusto(), store.planoContas(), store.fornecedores()]).then(
      ([contas, centros, plano, fornecedores]) => setD({ contas, centros, plano, fornecedores }),
      (e) => setErro(e.message),
    )),
    [store, carregar],
  )
  useEffect(() => {
    ler()
  }, [ler])
  return { d, erro, carregar: ler }
}

const favorecidoDe = (c: ContaPagar, fornecedores: Fornecedor[]) => fornecedores.find((f) => f.id === c.fornecedorId)?.nome ?? c.favorecido ?? ''

const FILTROS: { id: 'abertas' | 'vencidas' | 'semana' | 'pagas' | 'todas'; nome: string }[] = [
  { id: 'abertas', nome: 'A pagar' },
  { id: 'vencidas', nome: 'Vencidas' },
  { id: 'semana', nome: 'Próximos 7 dias' },
  { id: 'pagas', nome: 'Pagas' },
  { id: 'todas', nome: 'Todas' },
]
const COR_SITUACAO: Record<SituacaoConta, 'vermelho' | 'ambar' | 'cinza' | 'verde' | 'azul'> = { vencida: 'vermelho', hoje: 'ambar', semana: 'azul', depois: 'cinza', paga: 'verde' }

function ContasPagar() {
  const { d, erro, carregar } = useDados()
  const { store } = useApp()
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]['id']>('abertas')
  const [loja, setLoja] = useState('')
  const [conta, setConta] = useState('')
  const [mes, setMes] = useState('')
  const [busca, setBusca] = useState('')
  const [editar, setEditar] = useState<ContaPagar | 'nova' | null>(null)
  const [lote, setLote] = useState(false)
  const [pagar, setPagar] = useState<ContaPagar | null>(null)
  const [aviso, setAviso] = useState('')

  if (erro) return <Vazio>{erro}</Vazio>
  if (!d) return <p className="text-stone-400">Carregando…</p>

  const h = hoje()
  const abertas = d.contas.filter((c) => !c.pagoEm)
  const soma = (l: ContaPagar[]) => l.reduce((s, c) => s + c.valor, 0)
  const vencidas = abertas.filter((c) => c.vencimento < h)
  const deHoje = abertas.filter((c) => c.vencimento === h)
  const semana = abertas.filter((c) => situacao(c) === 'semana')
  const pagasMes = d.contas.filter((c) => c.pagoEm && mesDe(c.pagoEm) === mesDe(h))
  const semConta = abertas.filter((c) => !c.contaId).length

  const meses = [...new Set(d.contas.map((c) => mesDe(c.vencimento)))].sort()
  const lista = d.contas
    .filter((c) => {
      const s = situacao(c)
      if (filtro === 'abertas' && s === 'paga') return false
      if (filtro === 'vencidas' && s !== 'vencida') return false
      if (filtro === 'semana' && s !== 'semana' && s !== 'hoje') return false
      if (filtro === 'pagas' && s !== 'paga') return false
      if (loja && c.centroCustoId !== loja) return false
      if (conta === 'sem' ? c.contaId : conta && c.contaId !== conta) return false
      if (mes && mesDe(c.vencimento) !== mes) return false
      if (busca) {
        const t = `${c.descricao} ${favorecidoDe(c, d.fornecedores)} ${c.documento ?? ''}`.toLowerCase()
        if (!t.includes(busca.toLowerCase())) return false
      }
      return true
    })
    .sort((a, b) => (filtro === 'pagas' ? (b.pagoEm ?? '').localeCompare(a.pagoEm ?? '') : a.vencimento.localeCompare(b.vencimento)))

  // Agrupa por dia de vencimento (ou de pagamento, nas pagas).
  const grupos: { dia: string; itens: ContaPagar[] }[] = []
  for (const c of lista) {
    const dia = filtro === 'pagas' ? c.pagoEm! : c.vencimento
    const g = grupos[grupos.length - 1]
    if (g && g.dia === dia) g.itens.push(c)
    else grupos.push({ dia, itens: [c] })
  }
  const contasUsadas = d.plano.filter((p) => d.contas.some((c) => c.contaId === p.id))

  async function desfazer(c: ContaPagar) {
    if (!confirm('Desfazer o pagamento? A conta volta para "a pagar".')) return
    try {
      await store.pagarConta(c.id, null)
      carregar()
    } catch (e) {
      setAviso((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Contas a pagar</h1>
          <p className="text-sm text-stone-500">As notas lançadas entram aqui sozinhas. Só Proprietário e Administrativo veem esta tela.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Botao variante="secundario" onClick={() => setLote(true)}>Importar em lote</Botao>
          <Botao onClick={() => setEditar('nova')}>+ Conta a pagar</Botao>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi nome="Vencidas" valor={soma(vencidas)} n={vencidas.length} cor={vencidas.length ? 'text-red-700' : ''} aoClicar={() => setFiltro('vencidas')} />
        <Kpi nome="Vencem hoje" valor={soma(deHoje)} n={deHoje.length} cor={deHoje.length ? 'text-amber-700' : ''} aoClicar={() => setFiltro('semana')} />
        <Kpi nome="Próximos 7 dias" valor={soma(semana)} n={semana.length} aoClicar={() => setFiltro('semana')} />
        <Kpi nome={`Pagas em ${nomeMesAno(mesDe(h)).split(' ')[0]}`} valor={pagasMes.reduce((s, c) => s + (c.valorPago ?? c.valor), 0)} n={pagasMes.length} aoClicar={() => setFiltro('pagas')} />
      </div>
      {semConta > 0 && (
        <button className="text-sm font-semibold text-amber-800 underline" onClick={() => { setConta('sem'); setFiltro('abertas') }}>
          {semConta} {semConta === 1 ? 'conta está' : 'contas estão'} sem conta contábil (não entram certo na DRE)
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button key={f.id} onClick={() => setFiltro(f.id)}
            className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${filtro === f.id ? 'bg-carvao text-white ring-carvao' : 'bg-white text-stone-600 ring-stone-300'}`}>
            {f.nome}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select className={estiloEntrada} value={loja} onChange={(e) => setLoja(e.target.value)} aria-label="Loja">
          <option value="">Todas as lojas</option>
          {d.centros.map((x) => <option key={x.id} value={x.id}>{nomeCentro(x)}</option>)}
        </select>
        <select className={estiloEntrada} value={conta} onChange={(e) => setConta(e.target.value)} aria-label="Conta contábil">
          <option value="">Todas as contas</option>
          <option value="sem">Sem conta contábil</option>
          {contasUsadas.map((x) => <option key={x.id} value={x.id}>{x.codigo} {x.nome}</option>)}
        </select>
        <select className={estiloEntrada} value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mês do vencimento">
          <option value="">Qualquer mês</option>
          {meses.map((m) => <option key={m} value={m}>{nomeMesAno(m)}</option>)}
        </select>
        <input className={estiloEntrada} placeholder="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      {aviso && <p className="text-sm text-red-700">{aviso}</p>}

      {lista.length === 0 ? (
        <Vazio>{d.contas.length ? 'Nenhuma conta neste filtro.' : 'Nenhuma conta ainda. Lance uma nota fiscal ou clique em "+ Conta a pagar".'}</Vazio>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-stone-500">{lista.length} {lista.length === 1 ? 'conta' : 'contas'} · {reais(soma(lista))}</p>
          {grupos.map((g) => (
            <div key={g.dia}>
              <h3 className="mb-1 text-xs font-semibold text-stone-500">
                {g.dia === h ? 'Hoje' : `${diaSemana(g.dia)}, ${dataCurta(g.dia)}`}
                {filtro !== 'pagas' && g.dia < h && ' · vencida'}
                <span className="font-normal"> · {reais(soma(g.itens))}</span>
              </h3>
              <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
              {g.itens.map((c) => {
                const s = situacao(c)
                return (
                  <div key={c.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                    <button className="min-w-0 flex-1 text-left" onClick={() => setEditar(c)}>
                      <p className="truncate text-sm font-semibold">{c.descricao}{c.parcelas ? ` (${c.parcela}/${c.parcelas})` : ''}</p>
                      <p className={`truncate text-xs ${c.contaId ? 'text-stone-500' : 'font-semibold text-amber-700'}`}>
                        {[favorecidoDe(c, d.fornecedores), nomeCentro(d.centros.find((x) => x.id === c.centroCustoId)), nomeForma(c.forma)].filter(Boolean).join(' · ')}
                        {' · '}{nomeConta(d.plano, c.contaId)}
                        {c.recorrenteId && <span className="ml-2 font-semibold text-stone-500">↻ recorrente</span>}
                        {c.origem && !c.recorrenteId && <span className="ml-2 font-semibold text-stone-500">vem do DP</span>}
                        {c.lote?.startsWith('cartao:') && <span className="ml-2 font-semibold text-stone-500">fatura do cartão</span>}
                      </p>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm font-semibold">{reais(c.valorPago ?? c.valor)}</p>
                        {s === 'paga' ? <Selo cor="verde">Paga {dataCurta(c.pagoEm!)}{c.conciliado ? ' · banco ✓' : ''}</Selo> : s !== 'depois' && <Selo cor={COR_SITUACAO[s]}>{s === 'vencida' ? 'Vencida' : s === 'hoje' ? 'Hoje' : 'Esta semana'}</Selo>}
                      </div>
                      {c.pagoEm ? (
                        <Botao variante="fantasma" className="px-2! py-1! text-xs!" onClick={() => desfazer(c)}>Desfazer</Botao>
                      ) : (
                        <Botao variante="secundario" className="px-2.5! py-1! text-xs!" onClick={() => setPagar(c)}>Pagar</Botao>
                      )}
                    </div>
                  </div>
                )
              })}
              </div>
            </div>
          ))}
        </div>
      )}

      {editar && <EditarConta d={d} conta={editar === 'nova' ? null : editar} aoFechar={() => setEditar(null)} aoSalvar={() => { setEditar(null); carregar() }} />}
      {lote && <ImportarLote d={d} aoFechar={() => setLote(false)} aoSalvar={() => { setLote(false); carregar() }} />}
      {pagar && <PagarConta conta={pagar} aoFechar={() => setPagar(null)} aoSalvar={() => { setPagar(null); carregar() }} />}
    </div>
  )
}

function Kpi({ nome, valor, n, cor = '', aoClicar }: { nome: string; valor: number; n: number; cor?: string; aoClicar: () => void }) {
  return (
    <Cartao className="p-2.5!" onClick={aoClicar}>
      <p className="text-sm text-stone-500">{nome}</p>
      <p className={`text-lg font-bold ${cor}`}>{reais(valor)}</p>
      <p className="text-xs text-stone-400">{n} {n === 1 ? 'conta' : 'contas'}</p>
    </Cartao>
  )
}

function PagarConta({ conta, aoFechar, aoSalvar }: { conta: ContaPagar; aoFechar: () => void; aoSalvar: () => void }) {
  const { store } = useApp()
  const [v, setV] = useState({ data: hoje(), valor: mostrarValor(conta.valor), forma: conta.forma })
  const [erro, setErro] = useState('')
  async function salvar() {
    const valor = lerValor(v.valor)
    if (!valor || valor <= 0) return setErro('Coloque o valor pago.')
    try {
      await store.pagarConta(conta.id, { pagoEm: v.data, valorPago: valor, forma: v.forma })
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }
  const dif = r2((lerValor(v.valor) ?? 0) - conta.valor)
  return (
    <Modal titulo="Registrar pagamento" aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        <p className="text-sm">{conta.descricao} · vence {dataCurta(conta.vencimento)} · {reais(conta.valor)}</p>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Pago em"><input type="date" className={estiloEntrada} value={v.data} onChange={(e) => setV({ ...v, data: e.target.value })} /></Campo>
          <Campo rotulo="Valor pago (R$)" dica={dif > 0 ? `${reais(dif)} de juros/multa` : dif < 0 ? `${reais(-dif)} de desconto` : undefined}>
            <input inputMode="decimal" className={estiloEntrada} value={v.valor} onChange={(e) => setV({ ...v, valor: e.target.value })} />
          </Campo>
        </div>
        <Campo rotulo="Forma">
          <select className={estiloEntrada} value={v.forma} onChange={(e) => setV({ ...v, forma: e.target.value as FormaPagamento })}>
            {FORMAS_PAGAMENTO.map((f) => <option key={f.valor} value={f.valor}>{f.nome}</option>)}
          </select>
        </Campo>
        {erro && <p className="text-sm text-red-700">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao onClick={salvar}>Marcar como paga</Botao>
        </div>
      </div>
    </Modal>
  )
}

// DRE simples das despesas: por conta contábil (agrupada pela conta-mãe) ou por fornecedor, e por loja,
// no mês do vencimento (Heitor, 09/10: a despesa é do mês em que vence) ou no mês do pagamento.
function Despesas() {
  const { d, erro } = useDados()
  const [base, setBase] = useState<'vencimento' | 'caixa'>('vencimento')
  const [por, setPor] = useState<'conta' | 'fornecedor'>('conta')
  const [mes, setMes] = useState(mesDe(hoje()))
  if (erro) return <Vazio>{erro}</Vazio>
  if (!d) return <p className="text-stone-400">Carregando…</p>

  const mesDaConta = (c: ContaPagar) => (base === 'vencimento' ? mesDe(c.vencimento) : c.pagoEm ? mesDe(c.pagoEm) : null)
  const valorDe = (c: ContaPagar) => (base === 'caixa' ? c.valorPago ?? c.valor : c.valor)
  const meses = [...new Set([mesDe(hoje()), ...d.contas.map(mesDaConta).filter((m): m is string => !!m)])].sort().reverse()
  const doMes = d.contas.filter((c) => mesDaConta(c) === mes)
  const centros = d.centros.filter((x) => doMes.some((c) => c.centroCustoId === x.id))
  const porCodigo = new Map(d.plano.map((p) => [p.codigo, p]))
  const maeDe = (contaId: string | null) => {
    const p = d.plano.find((x) => x.id === contaId)
    if (!p) return null
    return p.paiCodigo ? porCodigo.get(p.paiCodigo) ?? p : p
  }
  const total = (l: ContaPagar[], centro?: string) => l.filter((c) => !centro || c.centroCustoId === centro).reduce((s, c) => s + valorDe(c), 0)

  const maes = d.plano.filter((p) => !p.paiCodigo).sort((a, b) => a.ordem - b.ordem)
  const blocos = maes
    .map((m) => {
      const contas = doMes.filter((c) => maeDe(c.contaId)?.id === m.id)
      const filhas = d.plano
        .filter((p) => p.id === m.id || p.paiCodigo === m.codigo)
        .map((p) => ({ p, contas: contas.filter((c) => c.contaId === p.id) }))
        .filter((x) => x.contas.length)
      return { m, contas, filhas }
    })
    .filter((b) => b.contas.length)
  const semConta = doMes.filter((c) => !maeDe(c.contaId))
  const operacionais = blocos.filter((b) => b.m.operacional)
  const abaixo = blocos.filter((b) => !b.m.operacional)
  const totalOperacional = operacionais.reduce((s, b) => s + total(b.contas), 0) + total(semConta)

  const totalMes = total(doMes)
  const porFornecedor = [...doMes.reduce((m, c) => {
    const nome = favorecidoDe(c, d.fornecedores) || 'Sem fornecedor'
    m.set(nome, [...(m.get(nome) ?? []), c])
    return m
  }, new Map<string, ContaPagar[]>())].map(([nome, contas]) => ({ nome, contas })).sort((a, b) => total(b.contas) - total(a.contas))

  const Linha = ({ nome, l, forte = false, recuo = false }: { nome: string; l: ContaPagar[]; forte?: boolean; recuo?: boolean }) => (
    <tr className={forte ? 'bg-stone-50 font-semibold' : ''}>
      <td className={`px-3 py-1.5 ${recuo ? 'pl-6 text-stone-600' : ''}`}>{nome}</td>
      {centros.length > 1 && centros.map((x) => <td key={x.id} className="px-3 py-1.5 text-right whitespace-nowrap">{total(l, x.id) ? reais(total(l, x.id)) : '—'}</td>)}
      <td className="px-3 py-1.5 text-right whitespace-nowrap">{reais(total(l))}</td>
    </tr>
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Despesas</h1>
        <p className="text-sm text-stone-500">Soma do contas a pagar por conta contábil ou fornecedor, e por loja. É a parte de despesas da DRE.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <select className={`${estiloEntrada} w-auto!`} value={mes} onChange={(e) => setMes(e.target.value)}>
          {meses.map((m) => <option key={m} value={m}>{nomeMesAno(m)}</option>)}
        </select>
        {([['vencimento', 'Mês do vencimento'], ['caixa', 'Mês do pagamento']] as const).map(([id, nome]) => (
          <button key={id} onClick={() => setBase(id)}
            className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${base === id ? 'bg-carvao text-white ring-carvao' : 'bg-white text-stone-600 ring-stone-300'}`}>
            {nome}
          </button>
        ))}
        <span className="mx-1 self-center text-stone-300">|</span>
        {([['conta', 'Por conta'], ['fornecedor', 'Por fornecedor']] as const).map(([id, nome]) => (
          <button key={id} onClick={() => setPor(id)}
            className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${por === id ? 'bg-carvao text-white ring-carvao' : 'bg-white text-stone-600 ring-stone-300'}`}>
            {nome}
          </button>
        ))}
      </div>
      {doMes.length === 0 ? <Vazio>Nenhuma despesa {base === 'caixa' ? 'paga' : 'vencendo'} em {nomeMesAno(mes)}.</Vazio> : por === 'fornecedor' ? (
        <TabelaFornecedores grupos={porFornecedor} centros={centros} total={total} totalMes={totalMes} doMes={doMes} />
      ) : (
        <Cartao className="overflow-x-auto p-0!">
          <table className="w-full text-sm">
            <thead className="bg-stone-100 text-left text-stone-500">
              <tr>
                <th className="px-3 py-2">Conta</th>
                {centros.length > 1 && centros.map((x) => <th key={x.id} className="px-3 py-2 text-right">{nomeCentro(x)}</th>)}
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {operacionais.map((b) => [
                <Linha key={b.m.id} nome={`${b.m.codigo} ${b.m.nome}`} l={b.contas} forte />,
                ...b.filhas.filter((f) => f.p.id !== b.m.id).map((f) => <Linha key={f.p.id} nome={`${f.p.codigo} ${f.p.nome}`} l={f.contas} recuo />),
              ])}
              {semConta.length > 0 && <Linha nome="Sem conta contábil" l={semConta} forte />}
              <tr className="bg-carvao font-bold text-white">
                <td className="px-3 py-2">Despesas operacionais</td>
                {centros.length > 1 && centros.map((x) => (
                  <td key={x.id} className="px-3 py-2 text-right whitespace-nowrap">
                    {reais(operacionais.reduce((s, b) => s + total(b.contas, x.id), 0) + total(semConta, x.id))}
                  </td>
                ))}
                <td className="px-3 py-2 text-right whitespace-nowrap">{reais(totalOperacional)}</td>
              </tr>
              {abaixo.map((b) => [
                <Linha key={b.m.id} nome={`${b.m.codigo} ${b.m.nome}`} l={b.contas} forte />,
                ...b.filhas.filter((f) => f.p.id !== b.m.id).map((f) => <Linha key={f.p.id} nome={`${f.p.codigo} ${f.p.nome}`} l={f.contas} recuo />),
              ])}
            </tbody>
          </table>
        </Cartao>
      )}
      <p className="text-xs text-stone-500">
        Empréstimos, investimentos e distribuição de lucros ficam abaixo do resultado operacional. A receita continua vindo do Lucro Fácil (aba Resultado).
      </p>
    </div>
  )
}

type Centro = Dados['centros'][number]
function TabelaFornecedores({ grupos, centros, total, totalMes, doMes }: {
  grupos: { nome: string; contas: ContaPagar[] }[]; centros: Centro[]; total: (l: ContaPagar[], centro?: string) => number; totalMes: number; doMes: ContaPagar[]
}) {
  const { ordenada, cabecalho } = useOrdem(grupos, {
    nome: (g) => g.nome, total: (g) => total(g.contas), pct: (g) => total(g.contas),
    ...Object.fromEntries(centros.map((x) => [`c:${x.id}`, (g: { contas: ContaPagar[] }) => total(g.contas, x.id)])),
  }, { col: 'total', desc: true })
  return (
    <Cartao className="overflow-x-auto p-0!">
      <table className="w-full text-sm">
        <thead className="bg-stone-100 text-left text-stone-500">
          <tr>
            {cabecalho('nome', 'Fornecedor')}
            {centros.length > 1 && centros.map((x) => <Fragment key={x.id}>{cabecalho(`c:${x.id}`, nomeCentro(x), 'text-right', true)}</Fragment>)}
            {cabecalho('total', 'Total', 'text-right', true)}
            {cabecalho('pct', '%', 'text-right', true)}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {ordenada.map((g) => (
            <tr key={g.nome}>
              <td className="px-3 py-1.5">{g.nome} <span className="text-xs text-stone-400">({g.contas.length})</span></td>
              {centros.length > 1 && centros.map((x) => <td key={x.id} className="px-3 py-1.5 text-right whitespace-nowrap">{total(g.contas, x.id) ? reais(total(g.contas, x.id)) : '—'}</td>)}
              <td className="px-3 py-1.5 text-right font-semibold whitespace-nowrap">{reais(total(g.contas))}</td>
              <td className="px-3 py-1.5 text-right text-stone-500">{(totalMes ? total(g.contas) / totalMes : 0).toLocaleString('pt-BR', { style: 'percent', maximumFractionDigits: 1 })}</td>
            </tr>
          ))}
          <tr className="bg-carvao font-bold text-white">
            <td className="px-3 py-2">Total</td>
            {centros.length > 1 && centros.map((x) => <td key={x.id} className="px-3 py-2 text-right whitespace-nowrap">{reais(total(doMes, x.id))}</td>)}
            <td className="px-3 py-2 text-right whitespace-nowrap">{reais(totalMes)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </Cartao>
  )
}

function PlanoContas() {
  const { store } = useApp()
  const [plano, setPlano] = useState<ContaContabil[] | null>(null)
  const [erro, setErro] = useState('')
  const [editar, setEditar] = useState<Partial<ContaContabil> | null>(null)
  const carregar = useCallback(() => store.planoContas().then(setPlano, (e) => setErro(e.message)), [store])
  useEffect(() => {
    carregar()
  }, [carregar])
  if (erro) return <Vazio>{erro}</Vazio>
  if (!plano) return <p className="text-stone-400">Carregando…</p>
  const maes = plano.filter((p) => !p.paiCodigo).sort((a, b) => a.ordem - b.ordem)
  const filhas = (m: ContaContabil) => plano.filter((p) => p.paiCodigo === m.codigo).sort((a, b) => a.ordem - b.ordem)
  function novaFilha(m: ContaContabil) {
    const f = filhas(m)
    const ultimo = Math.max(0, ...f.map((x) => Number(x.codigo.split('.')[1]) || 0))
    setEditar({ codigo: `${m.codigo}.${ultimo + 1}`, nome: '', paiCodigo: m.codigo, operacional: m.operacional, ordem: m.ordem + ultimo + 1, ativo: true })
  }
  function novaMae() {
    const ultimo = Math.max(0, ...maes.map((x) => Number(x.codigo) || 0))
    setEditar({ codigo: String(ultimo + 1), nome: '', paiCodigo: null, operacional: true, ordem: (ultimo + 1) * 100, ativo: true })
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Plano de contas</h1>
          <p className="text-sm text-stone-500">Começou igual às categorias de despesa do Lucro Fácil, para a DRE bater com a de lá.</p>
        </div>
        <Botao variante="secundario" onClick={novaMae}>+ Grupo</Botao>
      </div>
      {maes.map((m) => (
        <Cartao key={m.id} className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <button className="text-left font-semibold hover:underline" onClick={() => setEditar(m)}>
              {m.codigo} {m.nome} {!m.ativo && <Selo>Desativada</Selo>} {!m.operacional && <Selo cor="azul">Fora do operacional</Selo>}
            </button>
            <button className="shrink-0 text-sm font-semibold underline" onClick={() => novaFilha(m)}>+ Conta</button>
          </div>
          <ul className="text-sm">
            {filhas(m).map((f) => (
              <li key={f.id}>
                <button className={`py-0.5 pl-4 text-left hover:underline ${f.ativo ? 'text-stone-700' : 'text-stone-400 line-through'}`} onClick={() => setEditar(f)}>
                  {f.codigo} {f.nome}
                </button>
              </li>
            ))}
          </ul>
        </Cartao>
      ))}
      {editar && (
        <EditarContaContabil c={editar} aoFechar={() => setEditar(null)} aoSalvar={() => { setEditar(null); carregar() }} />
      )}
    </div>
  )
}

function EditarContaContabil({ c, aoFechar, aoSalvar }: { c: Partial<ContaContabil>; aoFechar: () => void; aoSalvar: () => void }) {
  const { store } = useApp()
  const [v, setV] = useState({ codigo: c.codigo ?? '', nome: c.nome ?? '', operacional: c.operacional ?? true, ativo: c.ativo ?? true })
  const [erro, setErro] = useState('')
  async function salvar() {
    if (!v.codigo.trim() || !v.nome.trim()) return setErro('Coloque o código e o nome.')
    try {
      await store.salvarContaContabil({
        id: c.id, codigo: v.codigo, nome: v.nome, paiCodigo: c.paiCodigo ?? null, operacional: v.operacional, ordem: c.ordem ?? 0, ativo: v.ativo,
      })
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }
  return (
    <Modal titulo={c.id ? 'Conta contábil' : 'Nova conta contábil'} aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        <div className="grid grid-cols-[6rem_1fr] gap-3">
          <Campo rotulo="Código"><input className={estiloEntrada} value={v.codigo} disabled={!!c.id} onChange={(e) => setV({ ...v, codigo: e.target.value })} /></Campo>
          <Campo rotulo="Nome"><input className={estiloEntrada} value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} /></Campo>
        </div>
        {!c.paiCodigo && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.operacional} onChange={(e) => setV({ ...v, operacional: e.target.checked })} />
            Entra no resultado operacional (desmarque para empréstimos, investimentos, distribuição)
          </label>
        )}
        {c.id && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.ativo} onChange={(e) => setV({ ...v, ativo: e.target.checked })} />
            Ativa (desativada some das listas, mas o histórico fica)
          </label>
        )}
        {erro && <p className="text-sm text-red-700">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao onClick={salvar}>Salvar</Botao>
        </div>
      </div>
    </Modal>
  )
}
