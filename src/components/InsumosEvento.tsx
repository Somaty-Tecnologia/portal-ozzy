import { useEffect, useMemo, useState } from 'react'
import { Botao } from './ui'
import { useOrdem } from './Ordenar'
import { useApp } from '../lib/contexto'
import { precoDoInsumo, qtd, reais, type Catalogo } from '../lib/custos'
import { arredondarPara, necessidade, semFicha, type SaldoBase } from '../lib/logistica'
import type { Fornecedor } from '../lib/types'

// Insumos a providenciar para o evento (Heitor, 12/10): previsão de vendas × fichas técnicas, com os pré-preparos
// abertos até os insumos (o que precisa comprar ou separar). Desconta o que já está na base (última contagem).
interface Linha {
  id: string
  nome: string
  categoria: string
  fornecedor: string
  unidade: string
  precisa: number
  naBase: number | null
  providenciar: number
  embalagens: string
  custo: number | null
}

export default function InsumosEvento({ cat, linhas, saldoBase, nomeEvento }: {
  cat: Catalogo
  linhas: { receitaId: string; quantidade: number }[]
  saldoBase: Map<string, SaldoBase>
  nomeEvento: string
}) {
  const { store, avisar } = useApp()
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [descontarBase, setDescontarBase] = useState(true)
  useEffect(() => { store.fornecedores().then(setFornecedores, () => setFornecedores([])) }, [store])

  const lista = useMemo<Linha[]>(() => {
    const nomeForn = new Map(fornecedores.map((f) => [f.id, f.nome]))
    const r: Linha[] = []
    for (const [chave, q] of necessidade(cat, linhas, true)) {
      if (!chave.startsWith('i:') || q <= 0) continue
      const ins = cat.insumos.get(chave.slice(2))
      if (!ins) continue
      const precisa = arredondarPara(ins.unidade, q)
      const base = saldoBase.get(chave)
      const naBase = base ? Math.max(0, base.saldo) : null
      const providenciar = Math.max(0, descontarBase ? arredondarPara(ins.unidade, q - (naBase ?? 0)) : precisa) || 0
      const preco = precoDoInsumo(cat, ins)
      const emb = ins.embalagem && ins.embalagemQtd && providenciar > 0
        ? `${qtd(Math.ceil((providenciar / ins.embalagemQtd) * 10) / 10)} ${ins.embalagem}${providenciar / ins.embalagemQtd > 1 ? 's' : ''}` : ''
      r.push({
        id: ins.id, nome: ins.nome, categoria: ins.categoria ?? '', fornecedor: ins.fornecedorId ? nomeForn.get(ins.fornecedorId) ?? '' : '',
        unidade: ins.unidade, precisa, naBase, providenciar, embalagens: emb, custo: preco !== null ? providenciar * preco : null,
      })
    }
    return r
  }, [cat, linhas, saldoBase, descontarBase, fornecedores])

  const { ordenada, cabecalho } = useOrdem(lista, {
    nome: (x) => x.nome, categoria: (x) => x.categoria, fornecedor: (x) => x.fornecedor,
    precisa: (x) => x.precisa, base: (x) => x.naBase, providenciar: (x) => x.providenciar, custo: (x) => x.custo,
  }, { col: 'categoria' })

  const faltaFicha = semFicha(cat, linhas.filter((l) => l.quantidade > 0).map((l) => l.receitaId))
  // Pré-preparos sem ficha não abrem: aparecem à parte para não sumirem da conta.
  const preparosSemFicha = [...necessidade(cat, linhas, true).entries()]
    .filter(([k, q]) => k.startsWith('r:') && q > 0)
    .map(([k, q]) => ({ nome: cat.receitas.get(k.slice(2))?.nome ?? '—', q }))
  const total = lista.reduce((s, x) => s + (x.custo ?? 0), 0)
  const semPreco = lista.filter((x) => x.custo === null && x.providenciar > 0).length
  const aProvidenciar = ordenada.filter((x) => x.providenciar > 0)

  const texto = () => {
    const grupos = new Map<string, Linha[]>()
    for (const x of aProvidenciar) grupos.set(x.categoria || 'Sem categoria', [...(grupos.get(x.categoria || 'Sem categoria') ?? []), x])
    const partes = [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).map(([g, xs]) =>
      `*${g}*\n` + [...xs].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((x) => `- ${x.nome}: ${qtd(x.providenciar)} ${x.unidade}${x.embalagens ? ` (${x.embalagens})` : ''}`).join('\n'))
    return `*Insumos a providenciar · ${nomeEvento}*\n\n${partes.join('\n\n')}`
  }

  if (!linhas.some((l) => l.quantidade > 0)) return null

  return (
    <section className="space-y-2" id="insumos-evento">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold">Insumos a providenciar</h3>
        <span className="text-sm text-stone-500">previsão × fichas, com os pré-preparos abertos até os insumos</span>
        <div className="flex gap-2 sm:ml-auto">
          <Botao variante="secundario" className="py-1.5!" disabled={!aProvidenciar.length}
            onClick={() => navigator.clipboard.writeText(texto()).then(() => avisar('Lista copiada para o WhatsApp'), () => avisar('Não deu para copiar neste aparelho'))}>
            Copiar p/ WhatsApp
          </Botao>
          <Botao variante="secundario" className="py-1.5!" onClick={() => window.print()}>Imprimir</Botao>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={descontarBase} onChange={(e) => setDescontarBase(e.target.checked)} />
        Descontar o que já está na base (última contagem − o que já saiu)
      </label>
      {lista.length === 0 ? (
        <p className="text-sm text-stone-500">As fichas dos produtos da previsão não têm insumos.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs text-stone-500">
              <tr>
                {cabecalho('nome', 'Insumo')}
                {cabecalho('categoria', 'Categoria')}
                {cabecalho('fornecedor', 'Fornecedor')}
                {cabecalho('precisa', 'Precisa', 'text-right', true)}
                {descontarBase && cabecalho('base', 'Na base', 'text-right', true)}
                {cabecalho('providenciar', 'Providenciar', 'text-right', true)}
                {cabecalho('custo', 'Custo', 'text-right', true)}
              </tr>
            </thead>
            <tbody>
              {ordenada.map((x) => (
                <tr key={x.id} className={`border-t border-stone-100 ${x.providenciar > 0 ? '' : 'text-stone-400'}`}>
                  <td className="px-3 py-1.5 font-semibold">{x.nome}</td>
                  <td className="px-3 py-1.5 text-stone-600">{x.categoria || '—'}</td>
                  <td className="px-3 py-1.5 text-stone-600">{x.fornecedor || '—'}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">{qtd(x.precisa)} {x.unidade}</td>
                  {descontarBase && <td className="px-3 py-1.5 text-right whitespace-nowrap">{x.naBase === null ? '—' : `${qtd(x.naBase)} ${x.unidade}`}</td>}
                  <td className="px-3 py-1.5 text-right whitespace-nowrap font-semibold">
                    {x.providenciar > 0 ? `${qtd(x.providenciar)} ${x.unidade}` : 'tem na base'}
                    {x.embalagens && <span className="block text-xs font-normal text-stone-500">≈ {x.embalagens}</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">{x.providenciar === 0 ? '—' : x.custo === null ? <span className="text-xs text-amber-700">sem preço</span> : reais(x.custo)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-stone-200 bg-stone-50 text-xs">
              <tr>
                <td className="px-3 py-1.5 font-semibold" colSpan={descontarBase ? 6 : 5}>
                  {aProvidenciar.length} {aProvidenciar.length === 1 ? 'insumo' : 'insumos'} a providenciar{semPreco > 0 && ` · ${semPreco} sem preço (fora do total)`}
                </td>
                <td className="px-3 py-1.5 text-right font-semibold">{reais(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {preparosSemFicha.length > 0 && (
        <p className="text-sm text-amber-800">
          Pré-preparo sem ficha (não deu para abrir nos insumos): {preparosSemFicha.map((p) => `${p.nome} ${qtd(Math.round(p.q * 1000) / 1000)}`).join(', ')}.
        </p>
      )}
      {faltaFicha.length > 0 && (
        <p className="text-sm text-amber-800">
          Fora da lista por não ter ficha técnica: {faltaFicha.map((id) => cat.receitas.get(id)?.nome ?? '—').join(', ')}.
        </p>
      )}
    </section>
  )
}
