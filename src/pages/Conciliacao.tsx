import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Botao, Campo, Cartao, Modal, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { dataCurta, diaSemana } from '../lib/datas'
import { type GrupoLote, type TipoQuem, LIMITE_DIARIA, aprendidosDe, candidatas, pedidoParecido, quemParece, sugestaoPessoal, gruposLote, lotesPara, nomeLote, sugestoes, sugestoesLote } from '../lib/conciliacao'
import { nomeCentro, nomeConta, reais } from '../lib/financeiro'
import { chaveExtrato, lerArquivoOfx, partesExtrato, repetidosNoExtrato } from '../lib/ofx'

const simplesBusca = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
import { garantirFornecedor } from './LancarContas'
import { EditarRecorrente } from './Recorrentes'
import EscolherConta from '../components/EscolherConta'
import type { NotaFiscal, FormaPagamento } from '../lib/types'
import { FORMAS_PAGAMENTO } from '../lib/types'
import { addMeses, mesDe } from '../lib/datas'
import { ir } from '../lib/rota'
import type { PedidoCompra, Funcionario, Motoboy, CentroCusto, ContaContabil, ContaPagar, Fornecedor, MovimentoExtrato, RegraExtrato, SaldoExtrato } from '../lib/types'

interface Dados {
  movs: MovimentoExtrato[]; contas: ContaPagar[]; centros: CentroCusto[]; plano: ContaContabil[]; fornecedores: Fornecedor[]
  regras: RegraExtrato[]; saldos: SaldoExtrato[]; notas: NotaFiscal[]; motoboys: Motoboy[]; pedidos: PedidoCompra[]
}

const FILTROS = [
  { id: 'pendentes', nome: 'Saídas a conciliar' },
  { id: 'entradas', nome: 'Entradas' },
  { id: 'conciliados', nome: 'Conciliados' },
  { id: 'ignorados', nome: 'Ignorados' },
] as const
type Filtro = (typeof FILTROS)[number]['id']

// O Itaú põe a agência (1633) na frente da conta e não manda a agência separada: 1633354285 → 35428-5.
const contaBancaria = (c: string) => {
  const n = c.replace(/^1633/, '')
  return /^\d{6}$/.test(n) ? `${n.slice(0, 5)}-${n.slice(5)}` : c
}
const MOTIVOS = ['Transferência entre contas da empresa', 'Aplicação ou resgate', 'Pagamento já lançado em outra conta', 'Outro']

// Conciliação bancária (09/10): extrato OFX do Itaú × contas a pagar.
export default function Conciliacao() {
  const { store } = useApp()
  const [d, setD] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('pendentes')
  const [busca, setBusca] = useState('')
  const [contaBanco, setContaBanco] = useState('')
  const [lendo, setLendo] = useState(false)
  const [achar, setAchar] = useState<MovimentoExtrato | null>(null)
  const [lancar, setLancar] = useState<MovimentoExtrato | null>(null)
  const [lancarPedido, setLancarPedido] = useState<PedidoCompra | null>(null)
  const [ignorar, setIgnorar] = useState<MovimentoExtrato | null>(null)
  const [recorrenteDe, setRecorrenteDe] = useState<ContaPagar | null>(null)
  const [verRepetidos, setVerRepetidos] = useState(false)
  const arquivo = useRef<HTMLInputElement>(null)

  const carregar = useCallback(
    () => Promise.all([store.extrato(), store.contasPagar(), store.centrosCusto(), store.planoContas(), store.fornecedores(), store.regrasExtrato(), store.saldosExtrato(), store.notasFiscais(), store.motoboys(), store.pedidosCompra().catch(() => [])])
      .then(([movs, contas, centros, plano, fornecedores, regras, saldos, notas, motoboys, pedidos]) => setD({ movs, contas, centros, plano, fornecedores, regras, saldos, notas, motoboys, pedidos }), (e) => setErro(e.message)),
    [store],
  )
  useEffect(() => {
    carregar()
  }, [carregar])

  const sug = useMemo(() => (d ? sugestoes(d.movs, d.contas, d.fornecedores) : new Map<string, ContaPagar>()), [d])
  const sugLote = useMemo(() => {
    if (!d) return new Map<string, GrupoLote>()
    const livres = d.movs.filter((m) => !sug.has(m.id))
    return sugestoesLote(livres, d.contas, new Set([...sug.values()].map((c) => c.id)))
  }, [d, sug])

  async function importar(files: FileList | null) {
    if (!files?.length) return
    setLendo(true)
    setAviso('')
    const lidos: { nome: string; texto: string; chaves?: Set<string> }[] = []
    for (const f of Array.from(files)) {
      try {
        const e = await lerArquivoOfx(f)
        const r = await store.importarExtrato(e)
        lidos.push({ nome: f.name, texto: `conta ${contaBancaria(e.conta)}, ${e.movimentos.length} lançamentos de ${e.inicio ? dataCurta(e.inicio) : '?'} a ${e.fim ? dataCurta(e.fim) : '?'}: ${r.novos} novos${r.repetidos ? `, ${r.repetidos} já estavam` : ''}`, chaves: new Set(e.movimentos.map((m) => `${e.banco}|${e.agencia}|${e.conta}|${m.fitid}`)) })
      } catch (e) {
        lidos.push({ nome: f.name, texto: (e as Error).message })
      }
    }
    // Diz em que pé está o que veio no arquivo (Heitor, 12/10: "importei 3 e só apareceu uma"): o que já estava
    // costuma estar conciliado, ignorado ou ser entrada, e por isso não aparece em "A conciliar".
    const todos = await store.extrato().catch(() => [] as MovimentoExtrato[])
    const partes = lidos.map((l) => {
      if (!l.chaves) return `${l.nome}: ${l.texto}`
      const doArquivo = todos.filter((m) => l.chaves!.has(`${m.banco}|${m.agencia}|${m.conta}|${m.fitid}`))
      const conta = (f: (m: MovimentoExtrato) => boolean) => doArquivo.filter(f).length
      const pe = [
        [conta((m) => m.status === 'pendente' && m.valor < 0), 'a conciliar'], [conta((m) => m.status === 'pendente' && m.valor > 0), 'entradas'],
        [conta((m) => m.status === 'conciliado'), 'já conciliados'], [conta((m) => m.status === 'ignorado'), 'ignorados'],
      ].filter(([n]) => n).map(([n, t]) => `${n} ${t}`).join(', ')
      return `${l.nome}: ${l.texto}${pe ? ` (${pe})` : ''}`
    })
    if (arquivo.current) arquivo.current.value = ''
    setLendo(false)
    setAviso(partes.join(' · '))
    carregar()
  }

  async function acao(f: () => Promise<void>) {
    try {
      await f()
    } catch (e) {
      setAviso((e as Error).message)
    }
    carregar()
  }

  if (erro) return <Vazio>{erro}</Vazio>
  if (!d) return <p className="text-stone-400">Carregando…</p>

  const contasBanco = [...new Map(d.movs.map((m) => [`${m.banco}|${m.agencia}|${m.conta}`, m])).values()]
  const daConta = (m: MovimentoExtrato) => !contaBanco || `${m.banco}|${m.agencia}|${m.conta}` === contaBanco
  const movs = d.movs.filter(daConta)
  const repetidos = repetidosNoExtrato(movs)
  const pendentes = movs.filter((m) => m.status === 'pendente' && m.valor < 0)
  const comSugestao = pendentes.filter((m) => sug.has(m.id) || sugLote.has(m.id))
  const regraDe = (m: MovimentoExtrato) => d.regras.find((r) => r.chave === chaveExtrato(m.descricao))
  // Pedido de compra que parece ser este débito (fornecedor do extrato e valor do pedido).
  const aprendidosTodos = d.pedidos.length ? aprendidosDe(d.movs, d.contas) : null
  const pedidoCache = new Map<string, PedidoCompra | null>()
  const pedidoDe = (m: MovimentoExtrato) => {
    if (!aprendidosTodos) return null
    if (!pedidoCache.has(m.id)) {
      const q = quemParece(m.descricao, { fornecedores: d.fornecedores, pessoas: [], motoboys: [] }, aprendidosTodos)
      pedidoCache.set(m.id, pedidoParecido(m, d.pedidos, d.contas, q?.tipo === 'fornecedor' ? q.id : null))
    }
    return pedidoCache.get(m.id)!
  }
  const favorecido = (c: ContaPagar) => d.fornecedores.find((f) => f.id === c.fornecedorId)?.nome ?? c.favorecido ?? ''
  // Busca (Heitor, 09/10): pelo texto do extrato, valor ("312,45"), data ("09/10") ou a conta ligada.
  const termos = simplesBusca(busca).split(/\s+/).filter(Boolean)
  const textoBusca = (m: MovimentoExtrato) => {
    const c = m.contaPagarId ? d.contas.find((x) => x.id === m.contaPagarId) : undefined
    const lote = d.contas.filter((x) => x.extratoMovimentoId === m.id)
    return simplesBusca([
      m.descricao, reais(m.valor), reais(Math.abs(m.valor)), Math.abs(m.valor).toFixed(2).replace('.', ','), dataCurta(m.data), m.documento ?? '',
      ...[c, ...lote].filter(Boolean).flatMap((x) => [x!.descricao, favorecido(x!)]),
    ].join(' '))
  }
  const lista = movs.filter((m) =>
    (termos.length
      ? termos.every((t) => textoBusca(m).includes(t)) && (filtro === 'entradas' ? m.valor > 0 : filtro === 'conciliados' ? m.status === 'conciliado' : filtro === 'ignorados' ? m.status === 'ignorado' : m.valor < 0)
      : filtro === 'pendentes' ? m.status === 'pendente' && m.valor < 0
      : filtro === 'entradas' ? m.status === 'pendente' && m.valor > 0
      : filtro === 'conciliados' ? m.status === 'conciliado'
      : m.status === 'ignorado'))
  const contaPorId = new Map(d.contas.map((c) => [c.id, c]))
  const notaDe = (m: MovimentoExtrato) => d.notas.find((n) => n.extratoMovimentoId === m.id && n.status === 'conferir')
  const saldo = [...d.saldos].sort((a, b) => b.data.localeCompare(a.data)).find((s) => !contaBanco || `${s.banco}|${s.agencia}|${s.conta}` === contaBanco)

  async function confirmarTodas() {
    if (!confirm(`Confirmar as ${comSugestao.length} sugestões? Cada saída fica ligada à conta indicada, que vira paga e conciliada.`)) return
    for (const m of comSugestao) {
      try {
        const g = sugLote.get(m.id)
        if (g) await store.conciliarLote(m.id, g.contas.map((c) => c.id), null)
        else await store.conciliarMovimento(m.id, sug.get(m.id)!.id)
      } catch (e) {
        setAviso((e as Error).message)
      }
    }
    carregar()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Conciliação bancária</h1>
          <p className="text-sm text-stone-500">Importe o extrato OFX do Itaú. O portal liga cada saída a uma conta a pagar e mostra o que ninguém lançou.</p>
        </div>
        <div>
          <input ref={arquivo} type="file" accept=".ofx,.OFX" multiple className="hidden" onChange={(e) => importar(e.target.files)} />
          <Botao onClick={() => arquivo.current?.click()} disabled={lendo}>{lendo ? 'Lendo…' : 'Importar extrato OFX'}</Botao>
        </div>
      </div>
      {aviso && <p className="rounded-xl bg-stone-100 p-3 text-sm">{aviso}</p>}

      {d.movs.length === 0 ? (
        <Vazio>
          Nenhum extrato ainda. No internet banking do Itaú: Extrato › escolha o período › Exportar › formato OFX (Money). Depois clique em "Importar extrato OFX".
        </Vazio>
      ) : (
        <>
          {contasBanco.length > 1 && (
            <select className={`${estiloEntrada} w-auto!`} value={contaBanco} onChange={(e) => setContaBanco(e.target.value)}>
              <option value="">Todas as contas</option>
              {contasBanco.map((m) => <option key={m.id} value={`${m.banco}|${m.agencia}|${m.conta}`}>Conta {contaBancaria(m.conta)}</option>)}
            </select>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Cartao className="p-2.5!" onClick={() => setFiltro('pendentes')}>
              <p className="text-sm text-stone-500">Saídas a conciliar</p>
              <p className={`text-lg font-bold ${pendentes.length ? 'text-amber-700' : ''}`}>{pendentes.length}</p>
              <p className="text-xs text-stone-400">{reais(-pendentes.reduce((s, m) => s + m.valor, 0))}</p>
            </Cartao>
            <Cartao className="p-2.5!" onClick={() => setFiltro('pendentes')}>
              <p className="text-sm text-stone-500">Com sugestão pronta</p>
              <p className="text-lg font-bold">{comSugestao.length}</p>
              <p className="text-xs text-stone-400">mesmo valor e data perto{sugLote.size ? ` · ${sugLote.size} em lote` : ''}</p>
            </Cartao>
            <Cartao className="p-2.5!" onClick={() => setFiltro('conciliados')}>
              <p className="text-sm text-stone-500">Conciliados</p>
              <p className="text-lg font-bold">{movs.filter((m) => m.status === 'conciliado').length}</p>
              <p className="text-xs text-stone-400">de {movs.filter((m) => m.valor < 0).length} saídas</p>
            </Cartao>
            <Cartao className="p-2.5!">
              <p className="text-sm text-stone-500">Saldo no banco</p>
              <p className="text-lg font-bold">{saldo ? reais(saldo.saldo) : '—'}</p>
              <p className="text-xs text-stone-400">{saldo ? `em ${dataCurta(saldo.data)}` : 'o OFX não trouxe'}</p>
            </Cartao>
          </div>
          {repetidos.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
              <span><b>{repetidos.length} lançamento{repetidos.length === 1 ? '' : 's'} entr{repetidos.length === 1 ? 'ou' : 'aram'} duas vezes</b> (mesmo dia e valor, vindos de outro OFX).</span>
              <Botao className="px-3! py-1.5! text-sm!" onClick={() => setVerRepetidos(true)}>Ver e remover</Botao>
            </div>
          )}
          {comSugestao.length > 0 && filtro === 'pendentes' && (
            <Botao variante="secundario" onClick={confirmarTodas}>Confirmar as {comSugestao.length} sugestões</Botao>
          )}

          <div className="flex flex-wrap gap-2">
            {FILTROS.map((f) => (
              <button key={f.id} onClick={() => setFiltro(f.id)}
                className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${filtro === f.id ? 'bg-carvao text-white ring-carvao' : 'bg-white text-stone-600 ring-stone-300'}`}>
                {f.nome}
              </button>
            ))}
          </div>
          <input className={estiloEntrada} type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, valor (ex.: 312,45), data (09/10) ou título" aria-label="Buscar no extrato" />
          {busca.trim() && <p className="text-xs text-stone-500">{lista.length} resultado{lista.length === 1 ? '' : 's'} em {FILTROS.find((f) => f.id === filtro)!.nome.toLowerCase()}, de qualquer situação.</p>}
          {filtro === 'entradas' && (
            <p className="text-sm text-stone-500">As entradas (cartões, iFood, Pix de clientes) vão ser conferidas com as vendas quando ligarmos a Eclética. Por enquanto, dá para ignorar as que não interessam.</p>
          )}

          {lista.length === 0 ? <Vazio>Nada aqui.</Vazio> : (
            <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
              {lista.map((m) => {
                const s = sug.get(m.id)
                const sl = sugLote.get(m.id)
                const doLote = d.contas.filter((c) => c.extratoMovimentoId === m.id)
                const regra = m.status === 'pendente' ? regraDe(m) : undefined
                const ligada = m.contaPagarId ? contaPorId.get(m.contaPagarId) : undefined
                return (
                  <div key={m.id} className="space-y-1 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-baseline gap-2">
                        <span className="w-16 shrink-0 text-xs text-stone-500">{diaSemana(m.data)} {dataCurta(m.data)}</span>
                        {(() => {
                          const { tipo, nome, documento } = partesExtrato(m.descricao || 'Sem descrição')
                          return (
                            <p className="min-w-0 break-words text-sm">
                              <span className="font-semibold">{nome}</span>
                              {tipo && <span className="ml-2 inline-block rounded-md bg-stone-100 px-1.5 py-0.5 align-middle text-[11px] font-medium text-stone-500" title={m.descricao}>{tipo}</span>}
                              {documento && <span className="ml-1 inline-block rounded-md bg-stone-100 px-1.5 py-0.5 align-middle text-[11px] text-stone-400">{documento.replace(/\D/g, '').length === 14 ? 'CNPJ' : 'CPF'} {documento}</span>}
                            </p>
                          )
                        })()}
                      </div>
                      <p className={`shrink-0 text-sm font-bold ${m.valor < 0 ? '' : 'text-green-700'}`}>{reais(m.valor)}</p>
                    </div>

                    {m.status === 'conciliado' && (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span><Selo cor="verde">Conciliado</Selo> {ligada ? `${ligada.descricao} · ${nomeCentro(d.centros.find((x) => x.id === ligada.centroCustoId))} · ${nomeConta(d.plano, ligada.contaId)}` : ''}
                          {ligada && !ligada.recorrenteId && !ligada.origem && (
                            <button className="ml-2 text-stone-500 underline" onClick={() => setRecorrenteDe(ligada)}>Repete todo mês?</button>
                          )}
                          {!ligada && doLote.length > 0 && <>
                            {` ${doLote.length} contas juntas`}
                            <details className="mt-1"><summary className="cursor-pointer text-stone-500">Ver as contas</summary>
                              <ul className="mt-1 space-y-0.5">{doLote.map((c) => <li key={c.id}>{[c.descricao, favorecido(c), reais(c.valorPago ?? c.valor)].filter(Boolean).join(' · ')}</li>)}</ul>
                            </details>
                          </>}
                        </span>
                        <button className="font-semibold underline" onClick={() => acao(() => store.desconciliarMovimento(m.id))}>Desfazer</button>
                      </div>
                    )}
                    {m.status === 'ignorado' && (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span><Selo>Ignorado</Selo> {m.observacao}</span>
                        <button className="font-semibold underline" onClick={() => acao(() => store.desconciliarMovimento(m.id))}>Voltar para conciliar</button>
                      </div>
                    )}
                    {m.status === 'pendente' && m.valor < 0 && (
                      <>
                        {notaDe(m) ? (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-blue-50 px-2 py-1 text-xs">
                            <span>Ligado à nota {notaDe(m)!.numero ? `NF ${notaDe(m)!.numero}` : 'sem número'} · {notaDe(m)!.emitenteNome ?? ''}: fica conciliado quando a nota for lançada.</span>
                            <Botao className="px-2.5! py-1! text-xs!" onClick={() => ir('estoque/nota/' + notaDe(m)!.id)}>Abrir a nota</Botao>
                          </div>
                        ) : sl ? (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-green-50 px-2 py-1 text-xs">
                            <span>
                              É <b>{nomeLote(sl.lote)}</b>: {sl.contas.length} contas que somam {reais(sl.total)}
                              <details><summary className="cursor-pointer text-stone-500">Ver as contas</summary>
                                <ul className="mt-1 space-y-0.5">{sl.contas.map((c) => <li key={c.id}>{[c.descricao, favorecido(c), reais(c.valorPago ?? c.valor)].filter(Boolean).join(' · ')}</li>)}</ul>
                              </details>
                            </span>
                            <span className="flex gap-2">
                              <Botao className="px-2.5! py-1! text-xs!" onClick={() => acao(() => store.conciliarLote(m.id, sl.contas.map((c) => c.id), null))}>Confirmar</Botao>
                              <Botao variante="fantasma" className="px-2.5! py-1! text-xs!" onClick={() => setAchar(m)}>Outra</Botao>
                            </span>
                          </div>
                        ) : s ? (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-green-50 px-2 py-1 text-xs">
                            <span>
                              É <b>{s.descricao}</b>{s.parcelas ? ` (${s.parcela}/${s.parcelas})` : ''} · {favorecido(s)} · vence {dataCurta(s.vencimento)}{s.pagoEm ? ` · paga ${dataCurta(s.pagoEm)}` : ''}
                            </span>
                            <span className="flex gap-2">
                              <Botao className="px-2.5! py-1! text-xs!" onClick={() => acao(() => store.conciliarMovimento(m.id, s.id))}>Confirmar</Botao>
                              <Botao variante="fantasma" className="px-2.5! py-1! text-xs!" onClick={() => setAchar(m)}>Outra</Botao>
                            </span>
                          </div>
                        ) : regra?.ignorar ? (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-stone-100 px-2 py-1 text-xs">
                            <span>Da última vez foi ignorado: {regra.favorecido}</span>
                            <Botao className="px-2.5! py-1! text-xs!" onClick={() => acao(() => store.ignorarMovimento(m.id, regra.favorecido ?? 'Ignorado', null))}>Ignorar de novo</Botao>
                          </div>
                        ) : regra && regra.centroCustoId ? (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-blue-50 px-2 py-1 text-xs">
                            <span>Da última vez: {nomeCentro(d.centros.find((x) => x.id === regra.centroCustoId))} · {nomeConta(d.plano, regra.contaId)}{regra.favorecido ? ` · ${regra.favorecido}` : ''}</span>
                            <Botao className="px-2.5! py-1! text-xs!" onClick={() => acao(() => store.registrarMovimento(m.id, {
                              centroCustoId: regra.centroCustoId!, contaId: regra.contaId, favorecido: regra.favorecido, fornecedorId: regra.fornecedorId ?? null, funcionarioId: regra.funcionarioId ?? null, motoboyId: regra.motoboyId ?? null, descricao: m.descricao, chave: chaveExtrato(m.descricao),
                            }))}>Lançar assim</Botao>
                          </div>
                        ) : pedidoDe(m) ? (() => {
                          const pc = pedidoDe(m)!
                          return (
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-blue-50 px-2 py-1 text-xs">
                              <span>Parece o <b>pedido de compra #{pc.numero}</b> · {d.fornecedores.find((f) => f.id === pc.fornecedorId)?.nome ?? ''} · {reais(pc.total)} · {pc.status === 'recebido' ? 'chegou' : 'entrega'} {dataCurta(pc.recebidoEm ?? pc.previsaoEntrega)}</span>
                              <Botao className="px-2.5! py-1! text-xs!" onClick={() => { setLancarPedido(pc); setLancar(m) }}>Lançar com este pedido</Botao>
                            </div>
                          )
                        })() : (
                          <p className="text-xs font-semibold text-amber-700">Não identificado: nenhuma conta a pagar com este valor.</p>
                        )}
                        <div className="flex flex-wrap gap-3 text-xs">
                          <button className="font-semibold underline" onClick={() => setAchar(m)}>Achar a conta</button>
                          <button className="font-semibold underline" onClick={() => setLancar(m)}>Lançar como despesa</button>
                          <button className="font-semibold underline" onClick={() => setIgnorar(m)}>Ignorar</button>
                        </div>
                      </>
                    )}
                    {m.status === 'pendente' && m.valor > 0 && (
                      <button className="text-xs font-semibold underline" onClick={() => setIgnorar(m)}>Ignorar</button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {achar && <AcharConta d={d} m={achar} aoFechar={() => setAchar(null)} aoEscolher={(c) => { setAchar(null); acao(() => store.conciliarMovimento(achar.id, c.id)) }}
        aoEscolherLote={(ids, dif) => { setAchar(null); acao(() => store.conciliarLote(achar.id, ids, dif)) }} />}
      {lancar && <LancarDespesa d={d} m={lancar} pedido={lancarPedido} aoFechar={() => { setLancar(null); setLancarPedido(null) }} aoSalvar={() => { setLancar(null); setLancarPedido(null); carregar() }} />}
      {recorrenteDe && (
        <EditarRecorrente
          d={d} r={null}
          modelo={{
            descricao: recorrenteDe.descricao, fornecedorId: recorrenteDe.fornecedorId, fornecedorNome: favorecido(recorrenteDe) || null,
            centroCustoId: recorrenteDe.centroCustoId, contaId: recorrenteDe.contaId, valor: recorrenteDe.valorPago ?? recorrenteDe.valor, variavel: false,
            dia: Number(recorrenteDe.vencimento.slice(8, 10)), forma: recorrenteDe.forma, inicio: addMeses(mesDe(recorrenteDe.vencimento), 1), fim: null,
            situacao: 'ativa', observacao: 'Cadastrada na conciliação',
          }}
          aoFechar={() => setRecorrenteDe(null)}
          aoSalvar={() => { setRecorrenteDe(null); setAviso('Recorrente cadastrado. Aparece em Financeiro › Recorrentes.') }}
        />
      )}
      {verRepetidos && <RemoverRepetidos d={d} repetidos={repetidos} aoFechar={() => setVerRepetidos(false)} aoSalvar={(msg) => { setVerRepetidos(false); setAviso(msg); carregar() }} />}
      {ignorar && <Ignorar m={ignorar} aoFechar={() => setIgnorar(null)} aoSalvar={() => { setIgnorar(null); carregar() }} />}
    </div>
  )
}

// As três listas onde procurar quem recebeu (fornecedor, funcionário, motoboy), com CPF/CNPJ.
function listasQuem(d: Dados, equipe: Funcionario[]) {
  return {
    fornecedores: d.fornecedores,
    pessoas: equipe.map((p) => ({ id: p.id, nome: p.nome, cnpj: p.cpf ?? null, ativo: true })),
    motoboys: d.motoboys.map((x) => ({ id: x.id, nome: x.nome, cnpj: x.cpf, ativo: true })),
  }
}

function AcharConta({ d, m, aoFechar, aoEscolher, aoEscolherLote }: {
  d: Dados; m: MovimentoExtrato; aoFechar: () => void; aoEscolher: (c: ContaPagar) => void; aoEscolherLote: (ids: string[], contaDiferenca: string | null) => void
}) {
  const [busca, setBusca] = useState('')
  const taxas = d.plano.find((c) => c.codigo === '5.22') ?? d.plano.find((c) => /taxas? banc/i.test(c.nome))
  const [contaDif, setContaDif] = useState(taxas?.id ?? '')
  const usadas = new Set(d.movs.map((x) => x.contaPagarId).filter((x): x is string => !!x))
  const perto = candidatas(m, d.contas, d.fornecedores, usadas)
  const lotes = lotesPara(m, gruposLote(d.contas, usadas))
  const nome = (c: ContaPagar) => d.fornecedores.find((f) => f.id === c.fornecedorId)?.nome ?? c.favorecido ?? ''
  const { equipe } = useApp()
  const parecido = quemParece(m.descricao, listasQuem(d, equipe), aprendidosDe(d.movs, d.contas))
  const campo = { fornecedor: 'fornecedorId', funcionario: 'funcionarioId', motoboy: 'motoboyId' } as const
  const dele = parecido ? d.contas.filter((c) => !c.conciliado && !usadas.has(c.id) && c[campo[parecido.tipo]] === parecido.id) : []
  const todas = busca
    ? d.contas.filter((c) => !c.conciliado && !usadas.has(c.id) && `${c.descricao} ${nome(c)}`.toLowerCase().includes(busca.toLowerCase()))
    : perto.map((x) => x.conta)
  return (
    <Modal titulo="Qual conta é esta saída?" aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        <p className="text-sm">{m.descricao} · {dataCurta(m.data)} · <b>{reais(m.valor)}</b></p>
        <input className={estiloEntrada} placeholder="Buscar por descrição ou fornecedor" value={busca} onChange={(e) => setBusca(e.target.value)} />
        {parecido && !busca && (
          <p className="rounded-xl bg-ozzy-100 p-2 text-sm">
            Parece ser <b>{parecido.nome}</b>.{' '}
            {dele.length > 0
              ? <button className="font-semibold underline" onClick={() => setBusca(parecido.nome)}>Ver as {dele.length} conta{dele.length > 1 ? 's' : ''} em aberto dele</button>
              : 'Não tem conta em aberto dele: use "Lançar como despesa".'}
          </p>
        )}
        {!busca && lotes.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Pagamentos em lote</p>
            {lotes.map(({ grupo: g, diferenca }) => (
              <div key={g.lote} className="space-y-2 rounded-xl bg-stone-50 p-2 text-sm">
                <p><b>{nomeLote(g.lote)}</b>: {g.contas.length} contas, {reais(g.total)}{diferenca > 0 ? <> · <span className="text-amber-700">faltam {reais(diferenca)}</span></> : ' · bate certinho'}</p>
                {diferenca > 0 && (
                  <Campo rotulo="Lançar a diferença em (juros, tarifa, item que faltou)">
                    <EscolherConta plano={d.plano} valor={contaDif} aoMudar={setContaDif} />
                  </Campo>
                )}
                <Botao className="py-1.5!" disabled={diferenca > 0 && !contaDif} onClick={() => aoEscolherLote(g.contas.map((c) => c.id), diferenca > 0 ? contaDif : null)}>
                  Conciliar o lote
                </Botao>
              </div>
            ))}
            <p className="text-sm font-semibold">Ou uma conta só</p>
          </div>
        )}
        {!busca && <p className="text-xs text-stone-500">Mostrando as contas com valor parecido (até 10% de diferença, por juros ou desconto) e data perto.</p>}
        {todas.length === 0 ? <Vazio>Nenhuma conta parecida em aberto. Use "Lançar como despesa".</Vazio> : (
          <ul className="max-h-80 divide-y divide-stone-100 overflow-y-auto">
            {todas.slice(0, 40).map((c) => (
              <li key={c.id}>
                <button className="flex w-full items-center justify-between gap-2 py-2 text-left hover:bg-stone-50" onClick={() => aoEscolher(c)}>
                  <span className="min-w-0 text-sm">
                    <span className="font-semibold break-words">{c.descricao}{c.parcelas ? ` (${c.parcela}/${c.parcelas})` : ''}</span>
                    <span className="block text-stone-500">{nome(c)} · {nomeCentro(d.centros.find((x) => x.id === c.centroCustoId))} · vence {dataCurta(c.vencimento)}{c.pagoEm ? ' · já paga' : ''}</span>
                  </span>
                  <span className="shrink-0 font-semibold">{reais(c.valorPago ?? c.valor)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}

type Comprovante = 'nao' | 'nota' | 'recibo'

// Lançar uma saída do extrato (09/10): só a despesa, ou ligada a uma nota/recibo (entra no estoque e atualiza o preço do insumo).
// Se repete todo mês, já cadastra o recorrente.
function LancarDespesa({ d, m, pedido, aoFechar, aoSalvar }: { d: Dados; m: MovimentoExtrato; pedido?: PedidoCompra | null; aoFechar: () => void; aoSalvar: () => void }) {
  const { store } = useApp()
  const valor = Math.abs(m.valor)
  // Já começa com quem parece ser o do extrato, procurando em fornecedores, equipe e motoboys juntos.
  const aprendidos = useMemo(() => aprendidosDe(d.movs, d.contas), [d.movs, d.contas])
  const { equipe } = useApp()
  const pessoas = useMemo(() => [...equipe].sort((a, b) => Number(b.status === 'ativo') - Number(a.status === 'ativo') || a.nome.localeCompare(b.nome)), [equipe])
  const sugerido = useMemo(() => quemParece(m.descricao, listasQuem(d, equipe), aprendidos), [m.descricao, d, equipe, aprendidos])
  // Veio de um pedido de compra: o fornecedor e a loja são os do pedido.
  const doPedido = pedido ? d.fornecedores.find((f) => f.id === pedido.fornecedorId) ?? null : null
  const parecido = doPedido ?? (sugerido?.tipo === 'fornecedor' ? d.fornecedores.find((f) => f.id === sugerido.id) ?? null : null)
  const pessoaParecida = sugerido?.tipo === 'funcionario' ? sugerido : null
  const motoParecido = sugerido?.tipo === 'motoboy' ? d.motoboys.find((x) => x.id === sugerido.id) ?? null : null
  const [quem, setQuem] = useState<TipoQuem>(pedido ? 'fornecedor' : sugerido?.tipo ?? 'fornecedor')
  const [funcionario, setFuncionario] = useState(pessoaParecida?.id ?? '')
  const [motoboy, setMotoboy] = useState(motoParecido?.id ?? '')
  const motoboysLista = useMemo(() => [...d.motoboys].sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome)), [d.motoboys])
  const contaMotoboys = d.plano.find((c) => c.codigo === '3.1')?.id ?? ''
  // Regra da casa (Heitor, 09/10): salário cai dia 5 e adiantamento dia 20; freela recebe na segunda, valores baixos.
  const diaMes = Number(m.data.slice(8, 10))
  const segunda = new Date(m.data + 'T12:00:00').getDay() === 1
  const pareceSer = valor <= LIMITE_DIARIA ? 'Diária' : diaMes >= 3 && diaMes <= 8 ? 'Salário' : diaMes >= 18 && diaMes <= 23 ? 'Adiantamento' : segunda ? 'Diária' : null
  // Conta e loja sugeridas pela pessoa: diária de freela (valor baixo) ou salário do setor dela.
  const sugPessoa = (id: string) => {
    const p = equipe.find((x) => x.id === id)
    return p ? sugestaoPessoal(p, valor, d.plano, d.centros) : null
  }
  const inicialPessoa = pessoaParecida ? sugPessoa(pessoaParecida.id) : null
  const centroMoto = (id: string) => {
    const u = d.motoboys.find((x) => x.id === id)?.unidadeId
    return u && d.centros.some((x) => x.id === u) ? u : ''
  }
  const [v, setV] = useState({
    centro: pedido?.centroCustoId || inicialPessoa?.centro || (motoParecido ? centroMoto(motoParecido.id) : '') || (d.centros.some((x) => x.id === 'central') ? 'central' : ''),
    conta: (pedido ? '' : inicialPessoa?.conta || (motoParecido ? contaMotoboys : '')) || (parecido?.contaPadraoId ?? ''), fornecedor: parecido?.nome ?? '',
    descricao: pedido ? `Pedido de compra #${pedido.numero} · ${parecido?.nome ?? ''}` : m.descricao,
  })
  function escolherFuncionario(id: string) {
    setFuncionario(id)
    const s = sugPessoa(id)
    if (s) setV((x) => ({ ...x, conta: s.conta || x.conta, centro: s.centro || x.centro }))
  }
  // Motoboy: conta 3.1 Motoboys e a loja do cadastro.
  function escolherMotoboy(id: string) {
    setMotoboy(id)
    setV((x) => ({ ...x, conta: contaMotoboys || x.conta, centro: centroMoto(id) || x.centro }))
  }
  const [comp, setComp] = useState<Comprovante>('nao')
  const [numero, setNumero] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [rec, setRec] = useState({ ligado: false, dia: String(Number(m.data.slice(8, 10))), forma: 'debito_automatico' as FormaPagamento, variavel: false, fim: '' })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const ativos = d.fornecedores.filter((f) => f.ativo)
  // Notas importadas esperando lançamento, das mais parecidas com o valor para as menos.
  const notasLivres = d.notas
    .filter((n) => n.status === 'conferir' && !n.extratoMovimentoId)
    .sort((a, b) => Math.abs(a.valorTotal - valor) - Math.abs(b.valorTotal - valor))
    .slice(0, 12)
  const nomeNota = (n: NotaFiscal) => d.fornecedores.find((f) => f.id === n.fornecedorId)?.nome ?? n.emitenteNome ?? 'Fornecedor'
  // Escolheu um fornecedor conhecido: já traz a conta de sempre dele.
  function mudarFornecedor(texto: string) {
    const f = ativos.find((x) => x.nome.toLowerCase() === texto.trim().toLowerCase())
    setV({ ...v, fornecedor: texto, conta: v.conta || f?.contaPadraoId || '' })
  }

  async function recorrente(f: Fornecedor) {
    if (!rec.ligado) return
    await store.salvarRecorrente({
      descricao: v.descricao.trim() || f.nome, fornecedorId: f.id, fornecedorNome: f.nome, centroCustoId: v.centro, contaId: v.conta || null, valor,
      variavel: rec.variavel, dia: Number(rec.dia), forma: rec.forma, inicio: addMeses(mesDe(m.data), 1), fim: rec.fim || null, situacao: 'ativa',
      observacao: 'Cadastrada na conciliação',
    })
  }

  async function salvar() {
    setErro('')
    if (quem === 'motoboy') {
      const mb = d.motoboys.find((x) => x.id === motoboy)
      if (!mb) return setErro('Escolha o motoboy.')
      if (!v.centro) return setErro('Escolha a loja.')
      if (!v.conta) return setErro('Escolha a conta contábil.')
      setSalvando(true)
      try {
        await store.registrarMovimento(m.id, { centroCustoId: v.centro, contaId: v.conta, favorecido: mb.nome, motoboyId: mb.id, descricao: v.descricao, chave: chaveExtrato(m.descricao) })
        return aoSalvar()
      } catch (e) {
        setErro((e as Error).message)
        return setSalvando(false)
      }
    }
    if (quem === 'funcionario') {
      const p = equipe.find((x) => x.id === funcionario)
      if (!p) return setErro('Escolha o funcionário.')
      if (!v.centro) return setErro('Escolha a loja.')
      if (!v.conta) return setErro('Escolha a conta contábil (ex.: salários, vale, adiantamento).')
      setSalvando(true)
      try {
        await store.registrarMovimento(m.id, { centroCustoId: v.centro, contaId: v.conta, favorecido: p.nome, funcionarioId: p.id, descricao: v.descricao, chave: chaveExtrato(m.descricao) })
        return aoSalvar()
      } catch (e) {
        setErro((e as Error).message)
        return setSalvando(false)
      }
    }
    if (!v.fornecedor.trim()) return setErro('Escolha o fornecedor.')
    if (!v.centro) return setErro('Escolha a loja.')
    if (comp === 'nao' && !v.conta) return setErro('Escolha a conta contábil.')
    if (rec.ligado && !(Number(rec.dia) >= 1 && Number(rec.dia) <= 31)) return setErro('Dia do vencimento entre 1 e 31.')
    if (rec.ligado && !v.conta) return setErro('Para o recorrente, escolha a conta contábil.')
    setSalvando(true)
    try {
      const f = await garantirFornecedor(store, d.fornecedores, v.fornecedor)
      if (comp === 'recibo') {
        const id = await store.criarNotaManual({
          numero: numero || null, emissao: m.data, fornecedorId: f.id, emitenteNome: null, centroCustoId: v.centro, valorTotal: valor,
          observacao: v.descricao !== m.descricao ? v.descricao : null, arquivo, extratoMovimentoId: m.id,
        })
        await recorrente(f)
        return ir('estoque/nota/' + id)
      }
      await store.registrarMovimento(m.id, { centroCustoId: v.centro, contaId: v.conta || null, favorecido: f.nome, fornecedorId: f.id, descricao: v.descricao, chave: chaveExtrato(m.descricao) })
      await recorrente(f)
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
      setSalvando(false)
    }
  }

  async function ligarNota(n: NotaFiscal) {
    try {
      await store.ligarNotaExtrato(n.id, m.id)
      ir('estoque/nota/' + n.id)
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  return (
    <Modal titulo="Lançar como despesa" aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        <p className="text-sm">{dataCurta(m.data)} · <b>{reais(m.valor)}</b> · {m.descricao}</p>
        <div className="space-y-1">
          <p className="text-sm font-medium text-stone-700">Para quem foi?</p>
          <div className="flex flex-wrap gap-2">
            {([['fornecedor', 'Fornecedor'], ['funcionario', 'Funcionário'], ['motoboy', 'Motoboy']] as const).map(([id, nome]) => (
              <button key={id} onClick={() => { setQuem(id); if (id !== 'fornecedor') setComp('nao') }}
                className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${quem === id ? 'bg-carvao text-white ring-carvao' : 'bg-white text-stone-600 ring-stone-300'}`}>
                {nome}
              </button>
            ))}
          </div>
        </div>
        {quem === 'fornecedor' && <div className="space-y-1">
          <p className="text-sm font-medium text-stone-700">Tem nota fiscal ou recibo?</p>
          <div className="flex flex-wrap gap-2">
            {([['nao', 'Não, só a despesa'], ['nota', 'Nota já importada'], ['recibo', 'Recibo ou nota de papel']] as const).map(([id, nome]) => (
              <button key={id} onClick={() => setComp(id)}
                className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${comp === id ? 'bg-carvao text-white ring-carvao' : 'bg-white text-stone-600 ring-stone-300'}`}>
                {nome}
              </button>
            ))}
          </div>
        </div>}

        {comp === 'nota' ? (
          <div className="space-y-2">
            <p className="text-sm text-stone-500">Notas importadas (XML) que ainda não foram lançadas, das de valor mais perto. Escolha e confira os itens: ao lançar, ela já fica paga por este débito.</p>
            {notasLivres.length === 0 ? <Vazio>Nenhuma nota esperando. Importe o XML em Estoque › Notas fiscais, ou use "Recibo ou nota de papel".</Vazio> : (
              <ul className="max-h-72 divide-y divide-stone-100 overflow-y-auto">
                {notasLivres.map((n) => (
                  <li key={n.id}>
                    <button className="flex w-full items-center justify-between gap-2 py-2 text-left hover:bg-stone-50" onClick={() => ligarNota(n)}>
                      <span className="min-w-0 text-sm">
                        <span className="font-semibold break-words">{nomeNota(n)}</span>
                        <span className="block text-stone-500">NF {n.numero ?? 's/n'} · {dataCurta(n.emissao)}</span>
                      </span>
                      <span className={`shrink-0 font-semibold ${Math.abs(n.valorTotal - valor) < 0.01 ? 'text-green-700' : ''}`}>{reais(n.valorTotal)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <>
            {quem === 'motoboy' ? (
              <>
                <Campo rotulo="Motoboy">
                  <select className={estiloEntrada} value={motoboy} onChange={(e) => escolherMotoboy(e.target.value)} aria-label="Motoboy">
                    <option value="">Escolher</option>
                    {motoboysLista.map((x) => <option key={x.id} value={x.id}>{x.nome}{!x.ativo ? ' (inativo)' : ''}</option>)}
                  </select>
                </Campo>
                {motoParecido && motoboy === motoParecido.id && <p className="text-xs text-stone-500">{sugerido?.aprendido ? 'Foi o usado da última vez para este nome.' : 'Sugerido pelo texto do extrato.'} Se não for, é só trocar.</p>}
                {d.motoboys.length === 0 && <p className="text-xs text-stone-500">Nenhum motoboy cadastrado ainda: cadastre no menu Motoboys.</p>}
                <p className="text-xs text-stone-500">Se a semana dele foi lançada, o pagamento já aparece em "Achar conta" (ou no lote da segunda).</p>
              </>
            ) : quem === 'funcionario' ? (
              <>
                <Campo rotulo="Funcionário">
                  <select className={estiloEntrada} value={funcionario} onChange={(e) => escolherFuncionario(e.target.value)} aria-label="Funcionário">
                    <option value="">Escolher</option>
                    {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.status !== 'ativo' ? ' (desligado)' : ''}</option>)}
                  </select>
                </Campo>
                {pessoaParecida && funcionario === pessoaParecida.id && <p className="text-xs text-stone-500">{pessoaParecida.aprendido ? 'Foi o usado da última vez para este nome.' : 'Sugerido pelo texto do extrato.'} Se não for, é só trocar.</p>}
                {pareceSer && funcionario && (
                  <p className="text-xs text-stone-600">
                    Pela data e valor, parece <b>{pareceSer === 'Diária' ? 'diária de freela' : pareceSer === 'Salário' ? 'salário do dia 5' : 'adiantamento do dia 20'}</b>: a conta contábil e a loja já vieram {pareceSer === 'Diária' ? 'como freelancer' : 'como salário'} do setor da pessoa.{' '}
                    <button className="font-semibold underline" onClick={() => setV({ ...v, descricao: `${pareceSer} · ${equipe.find((x) => x.id === funcionario)?.nome ?? ''}` })}>Usar na descrição</button>
                  </p>
                )}
                <p className="text-xs text-stone-500">Fica no perfil da pessoa (aba Salário), que só a gestão vê.</p>
              </>
            ) : (
              <>
                <Campo rotulo="Fornecedor">
                  <input className={estiloEntrada} list="despesa-fornecedores" placeholder="Comece a digitar" value={v.fornecedor} onChange={(e) => mudarFornecedor(e.target.value)} autoFocus />
                  <datalist id="despesa-fornecedores">{ativos.map((f) => <option key={f.id} value={f.nome} />)}</datalist>
                </Campo>
                {parecido && v.fornecedor === parecido.nome && (
                  <p className="text-xs text-stone-500">
                    {sugerido?.aprendido ? 'Foi o usado da última vez para este nome.' : 'Sugerido pelo texto do extrato.'} Se não for, é só trocar: da próxima vez ele lembra.
                  </p>
                )}
                {v.fornecedor.trim() && !ativos.some((x) => x.nome.toLowerCase() === v.fornecedor.trim().toLowerCase()) && (
                  <p className="text-xs text-stone-500">Fornecedor novo: vai ser cadastrado com esse nome.</p>
                )}
              </>
            )}
            <Campo rotulo="Descrição"><input className={estiloEntrada} value={v.descricao} onChange={(e) => setV({ ...v, descricao: e.target.value })} /></Campo>
            <Campo rotulo="Loja">
              <select className={estiloEntrada} value={v.centro} onChange={(e) => setV({ ...v, centro: e.target.value })}>
                <option value="">Escolher</option>
                {d.centros.map((x) => <option key={x.id} value={x.id}>{nomeCentro(x)}</option>)}
              </select>
            </Campo>
            <Campo rotulo={comp === 'recibo' ? 'Conta contábil (pode escolher na próxima tela)' : 'Conta contábil'}>
              <EscolherConta plano={d.plano} valor={v.conta} aoMudar={(id) => setV({ ...v, conta: id })} />
            </Campo>
            {comp === 'recibo' && (
              <div className="space-y-3 rounded-xl bg-stone-50 p-3">
                <p className="text-sm text-stone-600">Na próxima tela você coloca os itens: os insumos entram no estoque e o preço deles é atualizado.</p>
                <div className="grid grid-cols-2 gap-3">
                  <Campo rotulo="Número (se tiver)"><input className={estiloEntrada} value={numero} onChange={(e) => setNumero(e.target.value)} /></Campo>
                  <Campo rotulo="Foto ou PDF"><input type="file" accept="application/pdf,image/*" capture="environment" className="text-sm" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} /></Campo>
                </div>
              </div>
            )}
            {quem === 'fornecedor' && <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={rec.ligado} onChange={(e) => setRec({ ...rec, ligado: e.target.checked })} />
              Repete todo mês: cadastrar como pagamento recorrente
            </label>}
            {quem === 'fornecedor' && rec.ligado && (
              <div className="space-y-2 rounded-xl bg-stone-50 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <Campo rotulo="Vence todo dia"><input className={estiloEntrada} inputMode="numeric" value={rec.dia} onChange={(e) => setRec({ ...rec, dia: e.target.value })} /></Campo>
                  <Campo rotulo="Forma">
                    <select className={estiloEntrada} value={rec.forma} onChange={(e) => setRec({ ...rec, forma: e.target.value as FormaPagamento })}>
                      {FORMAS_PAGAMENTO.map((x) => <option key={x.valor} value={x.valor}>{x.nome}</option>)}
                    </select>
                  </Campo>
                </div>
                <Campo rotulo="Até quando repete">
                  <div className="flex flex-wrap items-center gap-2">
                    <select className={`${estiloEntrada} w-auto!`} value={rec.fim ? 'ate' : ''} aria-label="Até quando repete"
                      onChange={(e) => setRec({ ...rec, fim: e.target.value ? addMeses(mesDe(m.data), 12) : '' })}>
                      <option value="">Indefinido (sem fim)</option>
                      <option value="ate">Até um mês</option>
                    </select>
                    {rec.fim && <input type="month" className={`${estiloEntrada} w-auto!`} min={addMeses(mesDe(m.data), 1)} value={rec.fim} onChange={(e) => e.target.value && setRec({ ...rec, fim: e.target.value })} aria-label="Última parcela" />}
                    {rec.fim && <span className="text-sm text-stone-600">{Math.max(0, (Number(rec.fim.slice(0, 4)) - Number(m.data.slice(0, 4))) * 12 + Number(rec.fim.slice(5, 7)) - Number(m.data.slice(5, 7)))} parcela(s) depois desta</span>}
                  </div>
                </Campo>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={rec.variavel} onChange={(e) => setRec({ ...rec, variavel: e.target.checked })} />
                  O valor muda todo mês (lança {reais(valor)} como previsão)
                </label>
                <p className="text-xs text-stone-500">
                  Começa em {addMeses(mesDe(m.data), 1).split('-').reverse().join('/')}{rec.fim ? ` e vai até ${rec.fim.split('-').reverse().join('/')}` : ', sem data para acabar'}; este mês já é este débito.
                </p>
              </div>
            )}
          </>
        )}
        {erro && <p className="text-sm text-red-700">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          {comp !== 'nota' && (
            <Botao onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : comp === 'recibo' ? 'Continuar para os itens' : 'Lançar'}</Botao>
          )}
        </div>
      </div>
    </Modal>
  )
}

// Lançamentos que entraram duas vezes (Heitor, 15/10): mostra cada repetido ao lado do que fica.
function RemoverRepetidos({ d, repetidos, aoFechar, aoSalvar }: { d: Dados; repetidos: MovimentoExtrato[]; aoFechar: () => void; aoSalvar: (msg: string) => void }) {
  const { store } = useApp()
  const [marcados, setMarcados] = useState(() => new Set(repetidos.map((m) => m.id)))
  const [salvando, setSalvando] = useState(false)
  const fora = new Set(repetidos.map((m) => m.id))
  const conta = (m: MovimentoExtrato) => (m.contaPagarId ? d.contas.find((c) => c.id === m.contaPagarId) : undefined)
  const situacao = (m: MovimentoExtrato) => {
    if (m.status === 'ignorado') return `Ignorado${m.observacao ? `: ${m.observacao}` : ''}`
    if (m.status !== 'conciliado') return 'A conciliar'
    const c = conta(m)
    const lote = d.contas.filter((x) => x.extratoMovimentoId === m.id).length
    return c ? `Conciliado: ${c.descricao} · ${nomeCentro(d.centros.find((x) => x.id === c.centroCustoId))}` : lote ? `Conciliado com ${lote} contas` : 'Conciliado'
  }
  const ficam = (m: MovimentoExtrato) => d.movs.filter((x) => !fora.has(x.id) && x.banco === m.banco && x.agencia === m.agencia && x.conta === m.conta && x.data === m.data && x.valor === m.valor)
  async function remover() {
    setSalvando(true)
    let n = 0
    let falha = ''
    for (const m of repetidos.filter((x) => marcados.has(x.id))) {
      try {
        await store.excluirMovimentoRepetido(m.id)
        n++
      } catch (e) {
        falha = (e as Error).message
      }
    }
    setSalvando(false)
    aoSalvar(`${n} lançamento${n === 1 ? '' : 's'} repetido${n === 1 ? '' : 's'} removido${n === 1 ? '' : 's'}.${falha ? ` Algum não saiu: ${falha}` : ''}`)
  }
  return (
    <Modal titulo="Lançamentos repetidos" aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        <p className="text-sm text-stone-600">
          O Itaú mudou o texto de alguns lançamentos de um OFX para outro, e eles entraram de novo. Cada um abaixo tem um igual que fica.
          Se o repetido foi conciliado, a conciliação é desfeita e a despesa que ela criou é apagada.
        </p>
        <div className="max-h-[55vh] divide-y divide-stone-100 overflow-y-auto rounded-xl ring-1 ring-stone-200">
          {repetidos.map((m) => (
            <label key={m.id} className="flex cursor-pointer items-start gap-2 px-3 py-2 text-sm">
              <input type="checkbox" className="mt-1" checked={marcados.has(m.id)}
                onChange={(e) => setMarcados((s) => { const n = new Set(s); if (e.target.checked) n.add(m.id); else n.delete(m.id); return n })} />
              <span className="min-w-0 flex-1">
                <span className="flex justify-between gap-2"><b className="min-w-0 break-words">{dataCurta(m.data)} · {partesExtrato(m.descricao).nome}</b><b className="shrink-0">{reais(m.valor)}</b></span>
                <span className="block text-xs text-red-700">Sai: {situacao(m)}</span>
                {ficam(m).slice(0, 1).map((x) => <span key={x.id} className="block text-xs text-green-700">Fica: {partesExtrato(x.descricao).nome} · {situacao(x)}</span>)}
              </span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao onClick={remover} disabled={salvando || !marcados.size}>{salvando ? 'Removendo…' : `Remover ${marcados.size} repetido${marcados.size === 1 ? '' : 's'}`}</Botao>
        </div>
      </div>
    </Modal>
  )
}

function Ignorar({ m, aoFechar, aoSalvar }: { m: MovimentoExtrato; aoFechar: () => void; aoSalvar: () => void }) {
  const { store } = useApp()
  const [motivo, setMotivo] = useState(MOTIVOS[0])
  const [outro, setOutro] = useState('')
  const [sempre, setSempre] = useState(false)
  const [erro, setErro] = useState('')
  async function salvar() {
    const texto = motivo === 'Outro' ? outro.trim() : motivo
    if (!texto) return setErro('Diga o motivo.')
    try {
      await store.ignorarMovimento(m.id, texto, sempre ? chaveExtrato(m.descricao) : null)
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }
  return (
    <Modal titulo="Ignorar movimento" aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        <p className="text-sm">{m.descricao} · {dataCurta(m.data)} · <b>{reais(m.valor)}</b></p>
        <Campo rotulo="Motivo">
          <select className={estiloEntrada} value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            {MOTIVOS.map((x) => <option key={x}>{x}</option>)}
          </select>
        </Campo>
        {motivo === 'Outro' && <input className={estiloEntrada} value={outro} onChange={(e) => setOutro(e.target.value)} placeholder="Qual?" />}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sempre} onChange={(e) => setSempre(e.target.checked)} />
          Sugerir ignorar sempre que aparecer "{chaveExtrato(m.descricao)}"
        </label>
        {erro && <p className="text-sm text-red-700">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao onClick={salvar}>Ignorar</Botao>
        </div>
      </div>
    </Modal>
  )
}
