import { useEffect, useMemo, useState } from 'react'
import { Botao } from './ui'
import { useOrdem } from './Ordenar'
import { useApp } from '../lib/contexto'
import { precoDoInsumo, qtd, reais, type Catalogo } from '../lib/custos'
import { arredondarPara, necessidade, semFicha, type SaldoBase } from '../lib/logistica'
import { lerValor } from '../lib/financeiro'
import type { Fornecedor, Insumo } from '../lib/types'
import { baixarXlsx, type Celula } from '../lib/xlsx'

// Insumos a providenciar para o evento (Heitor, 12/10): previsão de vendas × fichas técnicas, com os pré-preparos
// abertos até os insumos (o que precisa comprar ou separar). Desconta o que já está na base (última contagem).
// Plural em português: embalagem → embalagens, saco → sacos, barril → barris, caixão → caixões, display → displays.
const plural = (p: string) => {
  const w = p.trim()
  if (/m$/i.test(w)) return w.slice(0, -1) + 'ns'
  if (/ão$/i.test(w)) return w.slice(0, -2) + 'ões'
  if (/[aeo]l$/i.test(w)) return w.slice(0, -1) + 'is'
  if (/il$/i.test(w)) return w.slice(0, -1) + 's'
  if (/[rzs]$/i.test(w)) return w + 'es'
  return w + 's'
}

interface Linha {
  id: string
  nome: string
  categoria: string
  fornecedor: string
  unidade: string
  precisa: number
  naBase: number | null
  providenciar: number
  // Embalagem do cadastro (fardo de 12…) e quantas comprar, arredondado para cima (Heitor, 13/10).
  embalagem: string | null
  porEmbalagem: number | null
  nEmbalagens: number | null
  custo: number | null
  preco: number | null
}

export default function InsumosEvento({ cat, linhas, saldoBase, nomeEvento }: {
  cat: Catalogo
  linhas: { receitaId: string; quantidade: number }[]
  saldoBase: Map<string, SaldoBase>
  nomeEvento: string
}) {
  const { store, avisar } = useApp()
  // Embalagem definida aqui vale na hora, sem esperar o catálogo recarregar.
  const [embs, setEmbs] = useState<Map<string, Pick<Insumo, 'embalagem' | 'embalagemQtd'>>>(new Map())
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
      const e = embs.get(ins.id) ?? ins
      const por = e.embalagem && e.embalagemQtd && e.embalagemQtd > 0 && e.embalagemQtd !== 1 ? e.embalagemQtd : null
      r.push({
        id: ins.id, nome: ins.nome, categoria: ins.categoria ?? '', fornecedor: ins.fornecedorId ? nomeForn.get(ins.fornecedorId) ?? '' : '',
        unidade: ins.unidade, precisa, naBase, providenciar, embalagem: por ? e.embalagem : null, porEmbalagem: por,
        nEmbalagens: por ? Math.ceil(providenciar / por - 1e-9) : null, custo: preco !== null ? providenciar * preco : null, preco,
      })
    }
    return r
  }, [cat, linhas, saldoBase, descontarBase, fornecedores, embs])

  const { ordenada, cabecalho } = useOrdem(lista, {
    nome: (x) => x.nome, categoria: (x) => x.categoria, fornecedor: (x) => x.fornecedor,
    precisa: (x) => x.precisa, embalagens: (x) => x.nEmbalagens, base: (x) => x.naBase, providenciar: (x) => x.providenciar, custo: (x) => x.custo,
  }, { col: 'categoria' })

  const faltaFicha = semFicha(cat, linhas.filter((l) => l.quantidade > 0).map((l) => l.receitaId))
  // Pré-preparos sem ficha não abrem: aparecem à parte para não sumirem da conta.
  const preparosSemFicha = [...necessidade(cat, linhas, true).entries()]
    .filter(([k, q]) => k.startsWith('r:') && q > 0)
    .map(([k, q]) => ({ nome: cat.receitas.get(k.slice(2))?.nome ?? '—', q }))
  const total = lista.reduce((s, x) => s + (x.custo ?? 0), 0)
  const semPreco = lista.filter((x) => x.custo === null && x.providenciar > 0).length
  const aProvidenciar = ordenada.filter((x) => x.providenciar > 0)

  const textoEmb = (x: Linha) => (x.nEmbalagens && x.embalagem && x.providenciar > 0
    ? `${x.nEmbalagens} ${x.nEmbalagens === 1 ? x.embalagem : plural(x.embalagem)} de ${qtd(x.porEmbalagem!)} ${x.unidade}` : null)
  const definirEmbalagem = async (x: Linha) => {
    const ins = cat.insumos.get(x.id)
    if (!ins) return
    const nome = prompt(`${x.nome}: como vem do fornecedor? (fardo, caixa, pacote…)`, x.embalagem ?? 'fardo')?.trim().toLowerCase()
    if (!nome) return
    const n = lerValor(prompt(`Quantos ${x.unidade} vêm em 1 ${nome}?`, x.porEmbalagem ? String(x.porEmbalagem).replace('.', ',') : '') ?? '')
    if (!n || n <= 0 || n === 1) return avisar(`Coloque quantos ${x.unidade} vêm na embalagem (ex.: 12, ou 0,330 para 330 g).`)
    try {
      await store.salvarInsumo({ ...ins, ...embs.get(ins.id), embalagem: nome, embalagemQtd: n })
      setEmbs((m) => new Map(m).set(ins.id, { embalagem: nome, embalagemQtd: n }))
      avisar(`${x.nome}: ${nome} de ${qtd(n)} ${x.unidade} salvo no cadastro`)
    } catch (e) {
      avisar((e as Error).message)
    }
  }

  const texto = () => {
    const grupos = new Map<string, Linha[]>()
    for (const x of aProvidenciar) grupos.set(x.categoria || 'Sem categoria', [...(grupos.get(x.categoria || 'Sem categoria') ?? []), x])
    const partes = [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).map(([g, xs]) =>
      `*${g}*\n` + [...xs].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((x) => `- ${x.nome}: ${textoEmb(x) ?? `${qtd(x.providenciar)} ${x.unidade}`}`).join('\n'))
    return `*Insumos a providenciar · ${nomeEvento}*\n\n${partes.join('\n\n')}`
  }

  // Planilha para mexer à vontade (Heitor, 13/10): Providenciar e Custo são fórmulas, então mudar a quantidade,
  // o que tem na base ou o preço já refaz a conta.
  const planilha = () => {
    const xs = [...lista].sort((a, b) => (a.categoria || '~').localeCompare(b.categoria || '~', 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'))
    const cab = ['Categoria', 'Insumo', 'Fornecedor', 'Unidade', 'Precisa', 'Na base', 'Providenciar', 'Embalagem', 'Qtd na embalagem', 'Nº de embalagens', 'Preço unit.', 'Custo']
    const rows: Celula[][] = [cab.map((v) => ({ v, s: 'cabecalho' as const }))]
    xs.forEach((x, i) => {
      const r = i + 2
      rows.push([
        x.categoria || 'Sem categoria', x.nome, x.fornecedor, x.unidade, x.precisa, descontarBase ? x.naBase ?? 0 : 0,
        { f: `MAX(0,E${r}-F${r})`, s: 'numero' }, x.embalagem ?? '', x.porEmbalagem,
        { f: `IF(N(I${r})>0,ROUNDUP(G${r}/I${r},0),"")`, s: 'numero' },
        { v: x.preco, s: 'reais' }, { f: `G${r}*K${r}`, s: 'reais' },
      ])
    })
    const n = xs.length + 1
    rows.push([{ v: 'Total', s: 'total' }, null, null, null, null, null, null, null, null, null, null, { f: `SUM(L2:L${n})`, s: 'totalReais' }])
    baixarXlsx(`Insumos ${nomeEvento}`.replace(/[\\/:*?"<>|]/g, ' ').trim(), 'Insumos', rows, [18, 34, 24, 9, 11, 11, 13, 12, 10, 12, 13, 14])
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
          <Botao variante="secundario" className="py-1.5!" disabled={!lista.length} onClick={planilha}>Baixar planilha</Botao>
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
                {cabecalho('embalagens', 'Embalagens', 'text-right', true)}
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
                  </td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                    {x.porEmbalagem ? (
                      <button className="text-right hover:underline" title="Mudar a embalagem" onClick={() => definirEmbalagem(x)}>
                        {x.providenciar > 0 && <span className="font-semibold">{x.nEmbalagens} {x.nEmbalagens === 1 ? x.embalagem : plural(x.embalagem!)}</span>}
                        <span className="block text-xs text-stone-500">{x.embalagem} de {qtd(x.porEmbalagem)} {x.unidade}</span>
                      </button>
                    ) : (
                      <button className="text-xs text-sky-700 hover:underline" onClick={() => definirEmbalagem(x)}>definir fardo/caixa</button>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">{x.providenciar === 0 ? '—' : x.custo === null ? <span className="text-xs text-amber-700">sem preço</span> : reais(x.custo)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-stone-200 bg-stone-50 text-xs">
              <tr>
                <td className="px-3 py-1.5 font-semibold" colSpan={descontarBase ? 7 : 6}>
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
