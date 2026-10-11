import { useEffect, useMemo, useState } from 'react'
import { Selo, Vazio, estiloEntrada } from '../components/ui'
import { useOrdem } from '../components/Ordenar'
import { useApp } from '../lib/contexto'
import { cmv, custoFicha, reais, type Catalogo } from '../lib/custos'
import { ir } from '../lib/rota'
import type { ProdutoVenda, Receita } from '../lib/types'

// Análise de CMV (Heitor, 11/10): custo pela ficha × preço do produto de venda, por tabela (Burger ou Pizza).
// Salão tira os itens marcados "só delivery" (embalagem); delivery conta tudo.
const LIMITE = 35
const pct = (n: number | null) => (n === null ? '—' : `${n.toFixed(1).replace('.', ',')}%`)

export default function AnaliseCmv({ cat, receitas }: { cat: Catalogo; receitas: Receita[] }) {
  const { store } = useApp()
  const [produtos, setProdutos] = useState<ProdutoVenda[] | null>(null)
  const [erro, setErro] = useState('')
  const [tabela, setTabela] = useState<'burger' | 'pizza'>('burger')
  const [canal, setCanal] = useState<'salao' | 'delivery'>('salao')
  const [grupo, setGrupo] = useState('')
  const [busca, setBusca] = useState('')
  useEffect(() => {
    store.produtosVenda().then(setProdutos, (e) => setErro((e as Error).message))
  }, [store])

  const linhas = useMemo(() => {
    if (!produtos) return []
    return produtos.filter((p) => p.ativo && p.receitaId).flatMap((p) => {
      const r = receitas.find((x) => x.id === p.receitaId)
      const v = cat.atual.get(p.receitaId!)
      const c = custoFicha(cat, p.receitaId!)
      if (!r || !v || !c) return []
      const delivery = c.itens.filter((i) => i.item.soDelivery).reduce((s, i) => s + (i.custo ?? 0), 0) / (v.rendimento || 1)
      const custo = canal === 'salao' ? c.porUnidade - delivery : c.porUnidade
      const preco = tabela === 'burger' ? p.preco : p.precoPizza
      if (preco === null) return []
      return [{ p, r, custo, preco, cmv: cmv(custo, preco), margem: preco - custo, grupo: p.subgrupo || p.grupo || 'Outros', incompleto: c.semPreco.length > 0 }]
    })
  }, [produtos, receitas, cat, tabela, canal])
  const grupos = [...new Set(linhas.map((l) => l.grupo))].sort()
  const termo = busca.trim().toLowerCase()
  const lista = linhas.filter((l) => (!grupo || l.grupo === grupo) && (!termo || l.p.nome.toLowerCase().includes(termo) || l.p.ecleticaCodigo === termo))
  const { ordenada, cabecalho } = useOrdem(lista, {
    nome: (l) => l.p.nome, grupo: (l) => l.grupo, custo: (l) => l.custo, preco: (l) => l.preco, cmv: (l) => l.cmv, margem: (l) => l.margem,
  }, { col: 'cmv', desc: true })

  if (erro) return <p className="text-red-600">{erro}</p>
  if (!produtos) return <p className="text-stone-400">Carregando…</p>
  const semFicha = produtos.filter((p) => p.ativo && p.tipo === 'normal' && !p.receitaId && (tabela === 'burger' ? p.preco : p.precoPizza) !== null).length
  const media = lista.length ? lista.reduce((s, l) => s + (l.cmv ?? 0), 0) / lista.length : null
  const acima = lista.filter((l) => (l.cmv ?? 0) > LIMITE).length
  const margemMedia = lista.length ? lista.reduce((s, l) => s + l.margem, 0) / lista.length : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${estiloEntrada} basis-full py-2! sm:basis-0 sm:flex-1`} placeholder="Buscar produto ou código" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar produto" />
        <select className={`${estiloEntrada} w-auto! py-2!`} value={grupo} onChange={(e) => setGrupo(e.target.value)} aria-label="Grupo">
          <option value="">Todos os grupos</option>
          {grupos.map((g) => <option key={g}>{g}</option>)}
        </select>
        <select className={`${estiloEntrada} w-auto! py-2!`} value={tabela} onChange={(e) => setTabela(e.target.value as 'burger' | 'pizza')} aria-label="Tabela de preço">
          <option value="burger">Preço The Ozzy Burger</option>
          <option value="pizza">Preço The Ozzy Pizza</option>
        </select>
        <select className={`${estiloEntrada} w-auto! py-2!`} value={canal} onChange={(e) => setCanal(e.target.value as 'salao' | 'delivery')} aria-label="Custo">
          <option value="salao">Custo no salão</option>
          <option value="delivery">Custo no delivery (com embalagem)</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Numero rotulo="Produtos" valor={String(lista.length)} />
        <Numero rotulo="CMV médio" valor={pct(media)} alerta={media !== null && media > LIMITE} />
        <Numero rotulo={`Acima de ${LIMITE}%`} valor={String(acima)} alerta={acima > 0} />
        <Numero rotulo="Margem média" valor={margemMedia === null ? '—' : reais(margemMedia)} />
      </div>
      {lista.length === 0 ? <Vazio>Nenhum produto com ficha e preço nesta tabela.</Vazio> : (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs text-stone-500">
              <tr>
                {cabecalho('nome', 'Produto')}
                {cabecalho('grupo', 'Grupo', 'hidden sm:table-cell')}
                {cabecalho('custo', 'Custo', 'text-right', true)}
                {cabecalho('preco', 'Preço', 'text-right', true)}
                {cabecalho('cmv', 'CMV', 'text-right', true)}
                {cabecalho('margem', 'Margem', 'text-right hidden sm:table-cell', true)}
              </tr>
            </thead>
            <tbody>
              {ordenada.map((l) => (
                <tr key={l.p.id} onClick={() => ir('fichas/' + l.r.id)} className="cursor-pointer border-t border-stone-100 hover:bg-stone-50">
                  <td className="px-3 py-2">
                    <div className="font-semibold">{l.p.nome}</div>
                    <div className="text-xs text-stone-500">
                      <span className="sm:hidden">{l.grupo} · </span>
                      {l.p.ecleticaCodigo && `cód. ${l.p.ecleticaCodigo}`}
                      {l.incompleto && <> <Selo cor="ambar">custo incompleto</Selo></>}
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 text-stone-600 sm:table-cell">{l.grupo}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{reais(l.custo)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{reais(l.preco)}</td>
                  <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${(l.cmv ?? 0) > LIMITE ? 'text-red-700' : ''}`}>{pct(l.cmv)}</td>
                  <td className="hidden px-3 py-2 text-right whitespace-nowrap sm:table-cell">{reais(l.margem)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-stone-500">
        Custo pela versão atual da ficha com o preço atual dos insumos. CMV = custo ÷ preço de venda; em vermelho acima de {LIMITE}%. Margem = preço − custo, sem taxas de aplicativo e impostos.
        {semFicha > 0 && <> {semFicha} produto{semFicha === 1 ? '' : 's'} com preço nesta tabela ainda {semFicha === 1 ? 'está' : 'estão'} sem ficha (Cadastros › Produtos de venda).</>}
      </p>
    </div>
  )
}

function Numero({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
      <div className="text-xs text-stone-500">{rotulo}</div>
      <div className={`text-lg font-bold ${alerta ? 'text-red-700' : ''}`}>{valor}</div>
    </div>
  )
}
