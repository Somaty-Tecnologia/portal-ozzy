import { useEffect, useMemo, useState } from 'react'
import { Botao, Vazio, estiloEntrada } from '../components/ui'
import { useOrdem } from '../components/Ordenar'
import { useApp } from '../lib/contexto'
import { addDias, dataCurta, diaSemana, hoje, inicioDaSemana } from '../lib/datas'
import { mostrarQtd, reais } from '../lib/financeiro'
import { ir } from '../lib/rota'
import { montarCatalogo } from '../lib/custos'
import { arredondarIdeal, consumo, coberturaVendas, ligarProdutos, linhasDe } from '../lib/consumoVendas'
import AvisoCobertura from '../components/AvisoCobertura'
import type { CategoriaCompra, Fornecedor, Insumo, MediaVenda, PedidoCompra, ProdutoVenda, Receita, UltimoFornecedor, VersaoReceita } from '../lib/types'

// Sugestão de compra da semana pelas vendas (Heitor, 15/10): média por dia da semana do que as três lojas
// venderam × fichas (abrindo os pré-preparos até o material comprado), mais a margem, menos o estoque e o que já
// foi pedido e não chegou. Agrupada pelo fornecedor do material (ou o da última compra); vira rascunho de pedido.

const CENTROS = ['central', 'burger-psd', 'burger-va', 'pizza']

interface Dados {
  medias: MediaVenda[]
  produtos: ProdutoVenda[]
  insumos: Insumo[]
  receitas: Receita[]
  versoes: VersaoReceita[]
  fornecedores: Fornecedor[]
  ultimos: UltimoFornecedor[]
  estoque: Map<string, number>
  pedidos: PedidoCompra[]
}

interface Linha {
  ins: Insumo
  semana: number
  precisa: number
  estoque: number
  caminho: number
  comprar: number
  preco: number | null
}

const arredondarCompra = (q: number, ins: Insumo) => {
  if (q <= 0) return 0
  const emb = ins.embalagemQtd && ins.embalagemQtd > 0 && ins.embalagemQtd !== 1 ? ins.embalagemQtd : null
  return emb ? Math.ceil(q / emb - 0.02) * emb : arredondarIdeal(q, ins.unidade)
}

export default function SugestaoCompras() {
  const { store } = useApp()
  const [semanas, setSemanas] = useState(8)
  const [margem, setMargem] = useState(10)
  const [descontar, setDescontar] = useState(true)
  const [tudo, setTudo] = useState(false)
  const [busca, setBusca] = useState('')
  const [entrega, setEntrega] = useState(addDias(inicioDaSemana(hoje()), 7))
  const [d, setD] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const [criados, setCriados] = useState<Record<string, number>>({})

  useEffect(() => {
    let vivo = true
    setD(null)
    Promise.all([
      store.vendasMedias(hoje(), semanas), store.produtosVenda(), store.insumos(), store.receitas(), store.versoesReceitas(), store.fornecedores(),
      store.ultimoFornecedorInsumos(), Promise.all(CENTROS.map((c) => store.saldosEstoque(c).catch(() => []))), store.pedidosCompra(),
    ]).then(([medias, produtos, insumos, receitas, versoes, fornecedores, ultimos, saldos, pedidos]) => {
      if (!vivo) return
      const estoque = new Map<string, number>()
      // Saldo negativo (entrada que não foi lançada) conta como zero.
      for (const s of saldos.flat()) estoque.set(s.insumoId, (estoque.get(s.insumoId) ?? 0) + Math.max(0, s.quantidade))
      setD({ medias, produtos, insumos, receitas, versoes, fornecedores, ultimos, estoque, pedidos })
    }, (e) => vivo && setErro((e as Error).message))
    return () => { vivo = false }
  }, [store, semanas])

  const calc = useMemo(() => {
    if (!d) return null
    const cat = montarCatalogo(d.insumos, d.receitas, d.versoes)
    const semana = consumo(cat, linhasDe(d.medias, ligarProdutos(d.produtos, d.insumos)))
    const caminho = new Map<string, number>()
    for (const p of d.pedidos) if (p.status === 'pedido') for (const i of p.itens) caminho.set(i.insumoId, (caminho.get(i.insumoId) ?? 0) + i.quantidade)
    const ultimo = new Map(d.ultimos.map((u) => [u.insumoId, u]))
    const porFornecedor = new Map<string, Linha[]>()
    for (const [id, q] of semana) {
      const ins = cat.insumos.get(id)
      if (!ins || q <= 0) continue
      const precisa = q * (1 + margem / 100)
      const estoque = descontar ? d.estoque.get(id) ?? 0 : 0
      const cam = descontar ? caminho.get(id) ?? 0 : 0
      const u = ultimo.get(id)
      const forn = ins.fornecedorId ?? u?.fornecedorId ?? ''
      const linha: Linha = { ins, semana: q, precisa, estoque, caminho: cam, comprar: arredondarCompra(precisa - estoque - cam, ins), preco: u && u.fornecedorId === forn && u.preco ? u.preco : ins.preco }
      porFornecedor.set(forn, [...(porFornecedor.get(forn) ?? []), linha])
    }
    return { porFornecedor, cobertura: coberturaVendas(d.medias, ligarProdutos(d.produtos, d.insumos), d.produtos) }
  }, [d, margem, descontar])

  if (erro) return <p className="text-red-700">{erro}</p>
  const dias = d ? Math.max(0, ...d.medias.map((m) => m.dias)) : 0
  const termo = busca.trim().toLowerCase()
  const grupos = [...(calc?.porFornecedor ?? new Map<string, Linha[]>()).entries()]
    .map(([f, ls]) => ({ f, nome: d?.fornecedores.find((x) => x.id === f)?.nome ?? 'Sem fornecedor', linhas: ls.filter((l) => (tudo || l.comprar > 0) && (!termo || l.ins.nome.toLowerCase().includes(termo))) }))
    .filter((g) => g.linhas.length)
    .sort((a, b) => (a.f === '' ? 1 : b.f === '' ? -1 : a.nome.localeCompare(b.nome, 'pt-BR')))

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600">
        Quanto as lojas gastam por semana pelas vendas da Eclética e pelas fichas, com os pré-preparos abertos até o material comprado. Precisa das vendas
        importadas em <button className="font-semibold underline" onClick={() => ir('producao/vendas')}>Produção › Vendas das lojas</button>. Eventos ficam de fora (use os Insumos a providenciar do evento).
      </p>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label>Entrega{' '}<input type="date" value={entrega} onChange={(e) => e.target.value && setEntrega(e.target.value)} className={`${estiloEntrada} w-auto!`} aria-label="Entrega" /></label>
        <label>Média de{' '}
          <select value={semanas} onChange={(e) => setSemanas(Number(e.target.value))} className={`${estiloEntrada} w-auto!`} aria-label="Semanas">
            {[4, 8, 12].map((n) => <option key={n} value={n}>{n} semanas</option>)}
          </select>
        </label>
        <label>Margem{' '}
          <select value={margem} onChange={(e) => setMargem(Number(e.target.value))} className={`${estiloEntrada} w-auto!`} aria-label="Margem">
            {[0, 10, 20, 30].map((n) => <option key={n} value={n}>{n}%</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={descontar} onChange={(e) => setDescontar(e.target.checked)} /> Descontar estoque e o que está a caminho</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={tudo} onChange={(e) => setTudo(e.target.checked)} /> Mostrar o que não precisa comprar</label>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar item" aria-label="Procurar item" className={`${estiloEntrada} max-w-48`} />
      </div>
      {!d ? <p className="text-stone-400">Calculando…</p> : !dias ? (
        <Vazio>Nenhuma venda nas últimas {semanas} semanas. Importe a planilha da Eclética em Produção › Vendas das lojas.</Vazio>
      ) : (
        <>
        {calc && <AvisoCobertura porcento={calc.cobertura.porcento} semFicha={calc.cobertura.semFicha} />}
        {!grupos.length ? <Vazio>Nada a comprar pelas vendas.</Vazio> : grupos.map((g) => (
          <GrupoFornecedor key={g.f || 'sem'} fornecedorId={g.f} nome={g.nome} linhas={g.linhas} entrega={entrega} criado={criados[g.f]}
            aoCriar={(n) => setCriados((c) => ({ ...c, [g.f]: n }))} />
        ))}
        </>
      )}
    </div>
  )
}

function GrupoFornecedor({ fornecedorId, nome, linhas, entrega, criado, aoCriar }: {
  fornecedorId: string
  nome: string
  linhas: Linha[]
  entrega: string
  criado?: number
  aoCriar: (numero: number) => void
}) {
  const { store, avisar } = useApp()
  const [criando, setCriando] = useState(false)
  const { ordenada, cabecalho } = useOrdem(linhas, {
    item: (l) => l.ins.nome, categoria: (l) => l.ins.categoria, semana: (l) => l.semana, estoque: (l) => l.estoque, caminho: (l) => l.caminho,
    comprar: (l) => l.comprar, preco: (l) => l.preco, total: (l) => (l.preco === null ? null : l.preco * l.comprar),
  }, { col: 'item' })
  const aComprar = linhas.filter((l) => l.comprar > 0)
  const total = aComprar.reduce((t, l) => t + l.comprar * (l.preco ?? 0), 0)
  const qtd = (n: number, l: Linha) => `${mostrarQtd(n >= 10 ? Math.round(n) : Math.round(n * 10) / 10)} ${l.ins.unidade}`

  const criar = async () => {
    if (!fornecedorId) return
    setCriando(true)
    try {
      const embalagem = aComprar.every((l) => /embalag/i.test(l.ins.categoria ?? ''))
      const p = await store.salvarPedidoCompra({
        fornecedorId, centroCustoId: 'central', categoria: (embalagem ? 'embalagens' : 'insumos') as CategoriaCompra, status: 'rascunho', dataPedido: hoje(), previsaoEntrega: entrega,
        formaPagamento: null, observacao: 'Sugestão pelas vendas',
        itens: aComprar.map((l) => {
          const f = l.ins.embalagem && l.ins.embalagemQtd && l.ins.embalagemQtd > 0 && l.ins.embalagemQtd !== 1 ? l.ins.embalagemQtd : null
          return { insumoId: l.ins.id, quantidade: l.comprar, unidade: l.ins.unidade, preco: l.preco, embalagem: f ? l.ins.embalagem : null, fator: f }
        }),
      })
      aoCriar(p.numero)
      avisar(`Rascunho #${p.numero} criado em Pedidos de compra`)
    } catch (e) {
      avisar((e as Error).message)
    } finally {
      setCriando(false)
    }
  }

  return (
    <section className="space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">{nome} <span className="text-sm font-normal text-stone-500">{aComprar.length} {aComprar.length === 1 ? 'item' : 'itens'}{total ? ` · ${reais(total)}` : ''}</span></h3>
        {fornecedorId && aComprar.length > 0 && (criado
          ? <span className="text-sm font-semibold text-emerald-700">Rascunho #{criado} criado · entrega {diaSemana(entrega).toLowerCase()} {dataCurta(entrega)}</span>
          : <Botao variante="secundario" className="py-1.5!" disabled={criando} onClick={criar}>{criando ? 'Criando…' : 'Criar rascunho do pedido'}</Botao>)}
      </div>
      {!fornecedorId && <p className="text-xs text-stone-500">Materiais sem fornecedor no cadastro e sem compra registrada: defina o fornecedor em Cadastros › Materiais.</p>}
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-stone-500">
            {cabecalho('item', 'Item')}{cabecalho('categoria', 'Categoria')}{cabecalho('semana', 'Gasto/semana', 'text-right', true)}{cabecalho('estoque', 'Estoque', 'text-right', true)}
            {cabecalho('caminho', 'A caminho', 'text-right', true)}{cabecalho('comprar', 'Comprar', 'text-right', true)}{cabecalho('preco', 'Preço', 'text-right', true)}{cabecalho('total', 'Total', 'text-right', true)}
          </tr></thead>
          <tbody className="divide-y divide-stone-100">
            {ordenada.map((l) => (
              <tr key={l.ins.id} className={l.comprar > 0 ? '' : 'text-stone-400'}>
                <td className="px-3 py-1.5">{l.ins.nome}</td>
                <td className="px-3 py-1.5 text-xs text-stone-500">{l.ins.categoria ?? ''}</td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap">{qtd(l.semana, l)}</td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap">{l.estoque ? qtd(l.estoque, l) : '—'}</td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap">{l.caminho ? qtd(l.caminho, l) : '—'}</td>
                <td className="px-3 py-1.5 text-right font-semibold whitespace-nowrap">
                  {l.comprar > 0 ? qtd(l.comprar, l) : 'não precisa'}
                  {l.comprar > 0 && l.ins.embalagem && l.ins.embalagemQtd && l.ins.embalagemQtd !== 1 && <div className="text-xs font-normal text-stone-500">{mostrarQtd(Math.round(l.comprar / l.ins.embalagemQtd))} {l.ins.embalagem}</div>}
                </td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap">{l.preco === null ? '—' : reais(l.preco)}</td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap">{l.preco === null || !l.comprar ? '—' : reais(l.preco * l.comprar)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
