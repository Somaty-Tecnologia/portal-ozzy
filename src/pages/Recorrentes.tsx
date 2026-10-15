import { useCallback, useEffect, useState } from 'react'
import { Botao, Campo, Modal, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { addMeses, hoje, mesDe, nomeMesAno } from '../lib/datas'
import { lerValor, mostrarValor, nomeCentro, nomeConta, nomeForma, reais } from '../lib/financeiro'
import { FORMAS_PAGAMENTO, type ContaRecorrente, type FormaPagamento, type SituacaoRecorrente } from '../lib/types'
import { garantirFornecedor, lojaPadrao, type Dados } from './LancarContas'
import EscolherConta from '../components/EscolherConta'

interface D extends Dados { recs: ContaRecorrente[] }

const NOME_SITUACAO: Record<SituacaoRecorrente, string> = { a_confirmar: 'A confirmar', ativa: 'Ativa', pausada: 'Pausada', encerrada: 'Encerrada' }

// Próximo mês em que a conta vence: este mês se o dia ainda não passou, senão o seguinte.
const proximoMes = (dia: number) => {
  const h = hoje()
  return Number(h.slice(8, 10)) <= dia ? mesDe(h) : addMeses(mesDe(h), 1)
}

// Pagamentos recorrentes (09/10): aluguel, sistemas, energia, cartão... Confirmados, viram contas a pagar todo mês sozinhos.
export default function Recorrentes() {
  const { store } = useApp()
  const [d, setD] = useState<D | null>(null)
  const [erro, setErro] = useState('')
  const [editar, setEditar] = useState<ContaRecorrente | 'nova' | null>(null)
  const [aviso, setAviso] = useState('')

  const carregar = useCallback(
    () => Promise.all([store.contasRecorrentes(), store.contasPagar(), store.centrosCusto(), store.planoContas(), store.fornecedores()]).then(
      ([recs, contas, centros, plano, fornecedores]) => setD({ recs, contas, centros, plano, fornecedores }),
      (e) => setErro(e.message),
    ),
    [store],
  )
  useEffect(() => {
    carregar()
  }, [carregar])

  if (erro) return <Vazio>{erro}</Vazio>
  if (!d) return <p className="text-stone-400">Carregando…</p>

  const grupo = (s: SituacaoRecorrente[]) => d.recs.filter((r) => s.includes(r.situacao)).sort((a, b) => a.dia - b.dia || a.descricao.localeCompare(b.descricao))
  const aConfirmar = grupo(['a_confirmar'])
  const ativas = grupo(['ativa'])
  const paradas = grupo(['pausada', 'encerrada'])
  const totalMes = ativas.reduce((s, r) => s + r.valor, 0)

  async function naoE(r: ContaRecorrente) {
    try {
      await store.salvarRecorrente({ ...r, situacao: 'encerrada' })
      setAviso(`"${r.descricao}" saiu dos recorrentes.`)
    } catch (e) {
      setAviso((e as Error).message)
    }
    carregar()
  }

  const linha = (r: ContaRecorrente) => (
    <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
      <button className="min-w-0 flex-1 text-left" onClick={() => setEditar(r)}>
        <p className="truncate text-sm font-semibold">{r.descricao}</p>
        <p className="truncate text-xs text-stone-500">
          {[r.fornecedorNome, nomeCentro(d.centros.find((x) => x.id === r.centroCustoId)), nomeForma(r.forma), `todo dia ${r.dia}`].filter(Boolean).join(' · ')}
          {' · '}{nomeConta(d.plano, r.contaId)}
          {r.fim ? ` · até ${nomeMesAno(r.fim)}` : ''}
          {r.observacao ? ` · ${r.observacao}` : ''}
        </p>
      </button>
      <div className="flex shrink-0 items-center gap-2">
        <div className="text-right">
          <p className="text-sm font-semibold">{reais(r.valor)}</p>
          {r.variavel && <Selo cor="azul">Valor muda</Selo>}
          {r.situacao !== 'a_confirmar' && r.situacao !== 'ativa' && <Selo>{NOME_SITUACAO[r.situacao]}</Selo>}
        </div>
        {r.situacao === 'a_confirmar' && (
          <>
            <Botao className="px-2.5! py-1! text-xs!" onClick={() => setEditar({ ...r, situacao: 'ativa', inicio: r.inicio > proximoMes(r.dia) ? r.inicio : proximoMes(r.dia) })}>Confirmar</Botao>
            <Botao variante="fantasma" className="px-2! py-1! text-xs!" onClick={() => naoE(r)}>Não é</Botao>
          </>
        )}
      </div>
    </div>
  )
  const caixa = (xs: ContaRecorrente[]) => <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">{xs.map(linha)}</div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Pagamentos recorrentes</h1>
          <p className="text-sm text-stone-500">O que se paga todo mês. Os ativos viram contas a pagar sozinhos (este mês e o próximo) e já ficam esperando o extrato.</p>
        </div>
        <Botao onClick={() => setEditar('nova')}>+ Recorrente</Botao>
      </div>
      {aviso && <p className="rounded-xl bg-stone-100 p-3 text-sm">{aviso}</p>}

      {aConfirmar.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">A confirmar ({aConfirmar.length})</h2>
          <p className="text-sm text-stone-500">
            Achei estes no que foi pago de julho a setembro. Confira o dia do vencimento e o valor, e confirme. Se não for recorrente, clique em "Não é". Os de cartão vencem com a fatura (dia 15).
          </p>
          {caixa(aConfirmar)}
        </section>
      )}
      <section className="space-y-2">
        <h2 className="font-semibold">Ativos ({ativas.length}) · {reais(totalMes)} por mês</h2>
        {ativas.length ? caixa(ativas) : <Vazio>Nenhum ativo ainda. Confirme os da lista acima.</Vazio>}
      </section>
      {paradas.length > 0 && (
        <details>
          <summary className="cursor-pointer font-semibold">Pausados e encerrados ({paradas.length})</summary>
          <div className="mt-2">{caixa(paradas)}</div>
        </details>
      )}

      {editar && <EditarRecorrente d={d} r={editar === 'nova' ? null : editar} aoFechar={() => setEditar(null)} aoSalvar={() => { setEditar(null); carregar() }} />}
    </div>
  )
}

// modelo: valores iniciais de um recorrente novo (ex.: vindo de uma conta da conciliação).
export function EditarRecorrente({ d, r, modelo, aoFechar, aoSalvar }: {
  d: Dados; r: ContaRecorrente | null; modelo?: Omit<ContaRecorrente, 'id'>; aoFechar: () => void; aoSalvar: () => void
}) {
  const { store } = useApp()
  const base = r ?? modelo
  const [v, setV] = useState(() => ({
    descricao: base?.descricao ?? '',
    fornecedor: base?.fornecedorNome ?? d.fornecedores.find((f) => f.id === base?.fornecedorId)?.nome ?? '',
    centroCustoId: base?.centroCustoId ?? lojaPadrao(d.centros),
    contaId: base?.contaId ?? '',
    valor: base ? mostrarValor(base.valor) : '',
    variavel: base?.variavel ?? false,
    dia: String(base?.dia ?? 10),
    forma: base?.forma ?? ('boleto' as FormaPagamento),
    inicio: base?.inicio ?? proximoMes(10),
    fim: base?.fim ?? '',
    situacao: base?.situacao === 'a_confirmar' ? 'ativa' : (base?.situacao ?? 'ativa') as SituacaoRecorrente,
    observacao: base?.observacao ?? '',
  }))
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const set = (x: Partial<typeof v>) => setV({ ...v, ...x })

  async function salvar() {
    const valor = lerValor(v.valor)
    const dia = Number(v.dia)
    if (!v.descricao.trim()) return setErro('Escreva a descrição.')
    if (!v.fornecedor.trim()) return setErro('Escolha o fornecedor.')
    if (!v.contaId) return setErro('Escolha a conta contábil.')
    if (!valor || valor <= 0) return setErro('Coloque o valor.')
    if (!(dia >= 1 && dia <= 31)) return setErro('Dia do vencimento entre 1 e 31.')
    if (v.fim && v.fim < v.inicio) return setErro('O fim é antes do início.')
    setSalvando(true)
    try {
      const f = await garantirFornecedor(store, d.fornecedores, v.fornecedor)
      await store.salvarRecorrente({
        id: r?.id, descricao: v.descricao.trim(), fornecedorId: f.id, fornecedorNome: f.nome, centroCustoId: v.centroCustoId, contaId: v.contaId,
        valor, variavel: v.variavel, dia, forma: v.forma, inicio: v.inicio, fim: v.fim || null, situacao: v.situacao, observacao: v.observacao.trim() || null,
      })
      if (v.situacao === 'ativa') await store.atualizarContasAutomaticas(addMeses(mesDe(hoje()), 1)).catch(() => {})
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
      setSalvando(false)
    }
  }

  async function excluir() {
    if (!r || !confirm('Excluir este recorrente? As contas futuras que ele lançou e ainda não foram pagas saem junto.')) return
    try {
      await store.excluirRecorrente(r.id)
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  return (
    <Modal titulo={r ? 'Pagamento recorrente' : 'Novo pagamento recorrente'} aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        <Campo rotulo="Descrição"><input className={estiloEntrada} value={v.descricao} onChange={(e) => set({ descricao: e.target.value })} autoFocus /></Campo>
        <Campo rotulo="Fornecedor">
          <input className={estiloEntrada} list="rec-fornecedores" value={v.fornecedor} onChange={(e) => set({ fornecedor: e.target.value })} />
          <datalist id="rec-fornecedores">{d.fornecedores.filter((f) => f.ativo).map((f) => <option key={f.id} value={f.nome} />)}</datalist>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Loja">
            <select className={estiloEntrada} value={v.centroCustoId} onChange={(e) => set({ centroCustoId: e.target.value })}>
              {d.centros.map((x) => <option key={x.id} value={x.id}>{nomeCentro(x)}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Conta contábil">
            <EscolherConta plano={d.plano} valor={v.contaId} aoMudar={(id) => set({ contaId: id })} />
          </Campo>
          <Campo rotulo={v.variavel ? 'Valor médio' : 'Valor'}><input className={estiloEntrada} inputMode="decimal" value={v.valor} onChange={(e) => set({ valor: e.target.value })} /></Campo>
          <Campo rotulo="Vence todo dia"><input className={estiloEntrada} inputMode="numeric" value={v.dia} onChange={(e) => set({ dia: e.target.value })} /></Campo>
          <Campo rotulo="Forma">
            <select className={estiloEntrada} value={v.forma} onChange={(e) => set({ forma: e.target.value as FormaPagamento })}>
              {FORMAS_PAGAMENTO.map((x) => <option key={x.valor} value={x.valor}>{x.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Situação">
            <select className={estiloEntrada} value={v.situacao} onChange={(e) => set({ situacao: e.target.value as SituacaoRecorrente })}>
              {(['ativa', 'pausada', 'encerrada'] as const).map((x) => <option key={x} value={x}>{NOME_SITUACAO[x]}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Começa em"><input type="month" className={estiloEntrada} value={v.inicio} onChange={(e) => set({ inicio: e.target.value })} /></Campo>
          <Campo rotulo="Até quando repete">
            <div className="flex flex-wrap gap-2">
              <select className={`${estiloEntrada} w-auto!`} value={v.fim ? 'ate' : ''} aria-label="Até quando repete" onChange={(e) => set({ fim: e.target.value ? addMeses(v.inicio || mesDe(hoje()), 11) : '' })}>
                <option value="">Indefinido (sem fim)</option>
                <option value="ate">Até um mês</option>
              </select>
              {v.fim && <input type="month" className={`${estiloEntrada} w-auto!`} value={v.fim} onChange={(e) => e.target.value && set({ fim: e.target.value })} aria-label="Termina em" />}
            </div>
          </Campo>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.variavel} onChange={(e) => set({ variavel: e.target.checked })} />
          O valor muda todo mês (energia, água, imposto): lança com o valor médio e você acerta quando chegar a conta
        </label>
        {v.forma === 'cartao_credito' && <p className="text-xs text-stone-500">No cartão, use o dia de vencimento da fatura. As contas do mesmo cartão e dia se juntam para conciliar com o débito da fatura.</p>}
        <Campo rotulo="Observação"><input className={estiloEntrada} value={v.observacao} onChange={(e) => set({ observacao: e.target.value })} /></Campo>
        {erro && <p className="text-sm text-red-700">{erro}</p>}
        <div className="flex flex-wrap justify-between gap-2">
          {r ? <Botao variante="fantasma" onClick={excluir}>Excluir</Botao> : <span />}
          <span className="flex gap-2">
            <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
            <Botao onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
          </span>
        </div>
      </div>
    </Modal>
  )
}
