import { useEffect, useMemo, useState } from 'react'
import { Botao, Modal, estiloEntrada } from './ui'
import { useApp } from '../lib/contexto'
import { lerValor } from '../lib/financeiro'
import type { Insumo, ItemReceita, ProdutoVenda, Receita, VersaoReceita } from '../lib/types'

// Ficha rápida para um produto vendido sem ficha (Heitor, 15/10): usar a ficha de outro produto parecido
// ("Croc Brownie Nutella retirada" = "Croc Brownie Nutella"), montar a ficha (do zero ou copiando outra) ou dizer
// que é só observação do PDV (sem picles, para viagem) e não precisa de ficha.

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const palavras = (s: string) => new Set(sem(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3))
interface Linha { chave: string; tipo: 'i' | 'r'; id: string; qtd: string }
let seq = 0

export default function FichaRapida({ codigo, nome, aoFechar, aoSalvar }: { codigo: string; nome: string; aoFechar: () => void; aoSalvar: (msg: string) => void }) {
  const { store } = useApp()
  const [d, setD] = useState<{ produtos: ProdutoVenda[]; receitas: Receita[]; versoes: VersaoReceita[]; insumos: Insumo[] } | null>(null)
  const [modo, setModo] = useState<'escolher' | 'montar'>('escolher')
  const [busca, setBusca] = useState('')
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [buscaItem, setBuscaItem] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  useEffect(() => {
    Promise.all([store.produtosVenda(), store.receitas(), store.versoesReceitas(), store.insumos()])
      .then(([produtos, receitas, versoes, insumos]) => setD({ produtos, receitas, versoes, insumos }), (e) => setErro((e as Error).message))
  }, [store])

  const fichas = useMemo(() => (d?.receitas ?? []).filter((r) => r.tipo === 'produto' && r.ativo && r.versaoAtual > 0), [d])
  const preparos = useMemo(() => (d?.receitas ?? []).filter((r) => r.tipo === 'preparo' && r.ativo), [d])
  // Parecidas pelo nome: mais palavras em comum primeiro.
  const parecidas = useMemo(() => {
    const p = palavras(nome)
    return fichas.map((r) => ({ r, n: [...palavras(r.nome)].filter((w) => p.has(w)).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 6).map((x) => x.r)
  }, [fichas, nome])
  const termo = sem(busca.trim())
  const achadas = termo.length >= 2 ? fichas.filter((r) => sem(r.nome).includes(termo)).slice(0, 12) : []

  // Liga o produto (cadastra se não estiver nos produtos de venda) à ficha.
  const ligar = async (receitaId: string | null, tipo?: ProdutoVenda['tipo']) => {
    const p = d!.produtos.find((x) => x.ecleticaCodigo === codigo)
    await store.salvarProdutoVenda(p
      ? { ...p, receitaId: receitaId ?? p.receitaId, tipo: tipo ?? p.tipo }
      : { ecleticaCodigo: codigo, nome, grupo: null, subgrupo: null, tipo: tipo ?? 'normal', unidade: 'un', preco: null, precoPizza: null, receitaId, ativo: true })
  }
  const usar = async (r: Receita) => {
    setSalvando(true)
    try {
      await ligar(r.id)
      aoSalvar(`${nome} agora usa a ficha de ${r.nome}`)
    } catch (e) { setErro((e as Error).message); setSalvando(false) }
  }
  const observacao = async () => {
    setSalvando(true)
    try {
      await ligar(null, 'vinculo')
      aoSalvar(`${nome} marcado como observação do PDV (sem ficha)`)
    } catch (e) { setErro((e as Error).message); setSalvando(false) }
  }
  const copiar = (r: Receita) => {
    const v = d!.versoes.find((x) => x.receitaId === r.id && x.numero === r.versaoAtual)
    setLinhas((v?.itens ?? []).map((i) => ({ chave: 'l' + seq++, tipo: i.subReceitaId ? 'r' : 'i', id: (i.subReceitaId ?? i.insumoId)!, qtd: String(i.quantidade).replace('.', ',') })))
    setModo('montar')
  }
  const criar = async () => {
    const itens: ItemReceita[] = linhas.map((l) => ({ insumoId: l.tipo === 'i' ? l.id : null, subReceitaId: l.tipo === 'r' ? l.id : null, quantidade: lerValor(l.qtd) ?? 0, aproveitamento: 1 }))
    if (!itens.length || itens.some((i) => !(i.quantidade > 0))) return setErro('Coloque a quantidade de cada item (por 1 unidade vendida).')
    setSalvando(true)
    try {
      const r = await store.salvarReceita({
        nome: nome.replace(/^./, (c) => c.toUpperCase()), tipo: 'produto', linha: null, operacaoId: null, origem: 'propria', unidade: 'un', precoVenda: null,
        tempoPreparoMin: null, tempoFinalizacaoMin: null, capacidadeHora: null, equipamentos: null, conservacao: null, validadeDias: null, modoPreparo: null,
        ativo: true, area: 'lojas', ecleticaCodigo: codigo,
      } as Parameters<typeof store.salvarReceita>[0])
      await store.salvarVersaoReceita(r.id, 1, null, 'Criada pelas vendas (ficha rápida)', itens)
      await ligar(r.id)
      aoSalvar(`Ficha de ${nome} criada`)
    } catch (e) { setErro((e as Error).message); setSalvando(false) }
  }

  const t = sem(buscaItem.trim())
  const opcoes = t.length >= 2 ? [
    ...preparos.filter((r) => sem(r.nome).includes(t)).slice(0, 5).map((r) => ({ tipo: 'r' as const, id: r.id, nome: r.nome, un: r.unidade, extra: 'pré-preparo' })),
    ...(d?.insumos ?? []).filter((i) => i.ativo && sem(i.nome).includes(t)).slice(0, 8).map((i) => ({ tipo: 'i' as const, id: i.id, nome: i.nome, un: i.unidade, extra: i.categoria ?? '' })),
  ] : []
  const nomeDe = (l: Linha) => (l.tipo === 'r' ? d?.receitas.find((r) => r.id === l.id) : d?.insumos.find((i) => i.id === l.id))
  const chip = 'rounded-full bg-white px-3 py-1 text-sm ring-1 ring-stone-300 hover:bg-stone-100'

  return (
    <Modal titulo={`Ficha de ${nome}`} aberto aoFechar={aoFechar}>
      {!d ? <p className="text-stone-400">{erro || 'Carregando…'}</p> : modo === 'escolher' ? (
        <div className="space-y-4 text-sm">
          <section className="space-y-2">
            <p className="font-semibold">É igual a outro produto? Use a ficha dele</p>
            {parecidas.length > 0 && <div className="flex flex-wrap gap-1.5">{parecidas.map((r) => <button key={r.id} disabled={salvando} className={chip} onClick={() => usar(r)}>{r.nome}</button>)}</div>}
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar outra ficha" aria-label="Procurar ficha" className={estiloEntrada} />
            {achadas.length > 0 && <div className="flex flex-wrap gap-1.5">{achadas.map((r) => <button key={r.id} disabled={salvando} className={chip} onClick={() => usar(r)}>{r.nome}</button>)}</div>}
          </section>
          <section className="space-y-2">
            <p className="font-semibold">Ou monte a ficha</p>
            <div className="flex flex-wrap gap-2">
              <Botao variante="secundario" onClick={() => { setLinhas([]); setModo('montar') }}>Do zero</Botao>
              {parecidas.slice(0, 3).map((r) => <Botao key={r.id} variante="secundario" onClick={() => copiar(r)}>Copiando {r.nome}</Botao>)}
            </div>
          </section>
          <section className="space-y-1">
            <p className="font-semibold">Ou não precisa de ficha</p>
            <p className="text-stone-600">Observação do PDV (sem picles, para viagem, ponto da carne): sai da lista de vendidos sem ficha.</p>
            <Botao variante="fantasma" disabled={salvando} onClick={observacao}>É só observação</Botao>
          </section>
          {erro && <p className="text-red-700">{erro}</p>}
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-stone-600">O que vai em <b>1 unidade vendida</b>. Dá para ajustar depois em Fichas técnicas.</p>
          <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
            {linhas.length === 0 && <p className="p-3 text-stone-500">Nenhum item ainda.</p>}
            {linhas.map((l) => {
              const x = nomeDe(l)
              return (
                <div key={l.chave} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="min-w-0 flex-1">{x?.nome ?? '?'}{l.tipo === 'r' && <span className="text-xs text-stone-500"> · pré-preparo</span>}</span>
                  <input value={l.qtd} inputMode="decimal" onChange={(e) => setLinhas((ls) => ls.map((y) => (y.chave === l.chave ? { ...y, qtd: e.target.value } : y)))}
                    className={`${estiloEntrada} w-20! text-center`} aria-label={`Quantidade de ${x?.nome}`} />
                  <span className="w-8 text-stone-500">{x?.unidade}</span>
                  <button className="px-1 text-stone-400 hover:text-red-600" onClick={() => setLinhas((ls) => ls.filter((y) => y.chave !== l.chave))} aria-label="Tirar">✕</button>
                </div>
              )
            })}
          </div>
          <input value={buscaItem} onChange={(e) => setBuscaItem(e.target.value)} placeholder="Adicionar material ou pré-preparo" aria-label="Adicionar item" className={estiloEntrada} />
          {opcoes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {opcoes.map((o) => (
                <button key={o.tipo + o.id} className={chip} onClick={() => { setLinhas((ls) => [...ls, { chave: 'l' + seq++, tipo: o.tipo, id: o.id, qtd: o.un === 'un' ? '1' : '' }]); setBuscaItem('') }}>
                  + {o.nome} <span className="text-stone-500">{o.un}{o.extra ? ` · ${o.extra}` : ''}</span>
                </button>
              ))}
            </div>
          )}
          {erro && <p className="text-red-700">{erro}</p>}
          <div className="flex gap-2">
            <Botao disabled={salvando || !linhas.length} onClick={criar}>{salvando ? 'Salvando…' : 'Criar a ficha'}</Botao>
            <Botao variante="fantasma" onClick={() => setModo('escolher')}>Voltar</Botao>
          </div>
          {linhas.length > 0 && <p className="text-xs text-stone-500">{linhas.length} {linhas.length === 1 ? 'item' : 'itens'}{linhas.some((l) => !lerValor(l.qtd)) ? ' · falta quantidade' : ''}</p>}
        </div>
      )}
    </Modal>
  )
}
