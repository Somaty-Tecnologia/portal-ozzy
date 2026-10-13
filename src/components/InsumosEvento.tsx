import { useEffect, useMemo, useState } from 'react'
import { Botao, estiloEntrada } from './ui'
import { useOrdem } from './Ordenar'
import { useApp } from '../lib/contexto'
import { custoFicha, precoDoInsumo, qtd, reais, type Catalogo } from '../lib/custos'
import { arredondarPara, necessidadeLiquida, semFicha, type SaldoBase } from '../lib/logistica'
import { lerValor } from '../lib/financeiro'
import type { CentroCusto, Fornecedor, Insumo } from '../lib/types'
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
  // Pré-preparo: produz em vez de comprar; o que falta dele já foi aberto nos ingredientes.
  preparo: boolean
  temFicha: boolean
  categoria: string
  fornecedor: string
  unidade: string
  precisa: number
  providenciar: number
  // Embalagem do cadastro (fardo de 12…) e quantas comprar, arredondado para cima (Heitor, 13/10).
  embalagem: string | null
  porEmbalagem: number | null
  nEmbalagens: number | null
  // Estoque atual no local escolhido (Central por padrão) e o "Pedir (final)" que o Heitor decide (13/10).
  estoque: number | null
  final: number | null
  pedir: number // final, ou o providenciar quando o final está em branco
  custo: number | null
  preco: number | null
}

const CHAVE_ESTOQUE = 'insumos-evento-estoque'
const numTexto = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n).replace('.', ','))

export default function InsumosEvento({ cat, eventoId, linhas, saldoBase, nomeEvento }: {
  cat: Catalogo
  eventoId: string
  linhas: { receitaId: string; quantidade: number }[]
  saldoBase: Map<string, SaldoBase>
  nomeEvento: string
}) {
  const { store, avisar } = useApp()
  // Embalagem definida aqui vale na hora, sem esperar o catálogo recarregar.
  const [embs, setEmbs] = useState<Map<string, Pick<Insumo, 'embalagem' | 'embalagemQtd'>>>(new Map())
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [descontar, setDescontar] = useState(true)
  useEffect(() => { store.fornecedores().then(setFornecedores, () => setFornecedores([])) }, [store])
  const [centros, setCentros] = useState<CentroCusto[]>([])
  const [estoqueDe, setEstoqueDe] = useState(() => { try { return localStorage.getItem(CHAVE_ESTOQUE) ?? '' } catch { return '' } })
  const [saldos, setSaldos] = useState<Map<string, number> | null>(null)
  useEffect(() => {
    store.centrosCusto().then((cs) => {
      const ativos = cs.filter((c) => c.ativo)
      setCentros(ativos)
      setEstoqueDe((x) => (x === 'base' || ativos.some((c) => c.id === x) ? x
        : ativos.find((c) => /evento/i.test(c.nome))?.id ?? ativos.find((c) => /central/i.test(c.nome))?.id ?? ativos[0]?.id ?? ''))
    }, () => setCentros([]))
  }, [store])
  useEffect(() => {
    if (!estoqueDe) return
    try { localStorage.setItem(CHAVE_ESTOQUE, estoqueDe) } catch { /* sem armazenamento */ }
    // Chaves 'i:<insumo>' e (só na base de eventos) 'r:<pré-preparo>'.
    if (estoqueDe === 'base') { setSaldos(new Map([...saldoBase].map(([k, b]) => [k, b.saldo]))); return }
    store.saldosEstoque(estoqueDe).then((r) => setSaldos(new Map(r.map((x) => [`i:${x.insumoId}`, x.quantidade]))), () => setSaldos(new Map()))
  }, [store, estoqueDe, saldoBase])
  // Pedir (final): texto digitado por insumo; salva sozinho ao sair do campo.
  const [finais, setFinais] = useState<Record<string, string>>({})
  useEffect(() => {
    store.pedidoInsumosEvento(eventoId).then((r) => setFinais(Object.fromEntries(Object.entries(r).map(([k, q]) => [k, numTexto(q)]))), () => setFinais({}))
  }, [store, eventoId])
  const salvarFinais = async (valores: Record<string, number | null>) => {
    try { await store.salvarPedidoInsumosEvento(eventoId, valores) } catch (e) { avisar((e as Error).message) }
  }

  // Estoque de um item: material pelo id; pré-preparo pelo material ligado à ficha (ou pela contagem da base).
  const estoqueChave = (k: string) => {
    if (!saldos) return 0
    if (k.startsWith('i:')) return saldos.get(k) ?? 0
    const ins = cat.receitas.get(k.slice(2))?.insumoId
    return (ins ? saldos.get('i:' + ins) : undefined) ?? saldos.get(k) ?? 0
  }
  const nec = useMemo(() => necessidadeLiquida(cat, linhas, descontar ? estoqueChave : () => 0), [cat, linhas, descontar, saldos])

  const lista = useMemo<Linha[]>(() => {
    const nomeForn = new Map(fornecedores.map((f) => [f.id, f.nome]))
    const r: Linha[] = []
    for (const [chave, n] of nec) {
      const rec = chave.startsWith('r:') ? cat.receitas.get(chave.slice(2)) : undefined
      const ins = chave.startsWith('i:') ? cat.insumos.get(chave.slice(2)) : rec?.insumoId ? cat.insumos.get(rec.insumoId) : undefined
      if (!ins && !rec) continue
      const unidade = ins?.unidade ?? rec!.unidade
      const precisa = arredondarPara(unidade, n.precisa)
      const providenciar = Math.max(0, arredondarPara(unidade, n.falta)) || 0
      const preco = rec ? custoFicha(cat, rec.id)?.porUnidade ?? (ins ? precoDoInsumo(cat, ins) : null) : precoDoInsumo(cat, ins!)
      const e = ins ? embs.get(ins.id) ?? ins : null
      const por = e?.embalagem && e.embalagemQtd && e.embalagemQtd > 0 ? e.embalagemQtd : null
      const id = ins?.id ?? chave
      const final = ins && finais[id]?.trim() ? lerValor(finais[id]) : null
      const pedir = final ?? providenciar
      r.push({
        id, nome: rec?.nome ?? ins!.nome, preparo: !!rec, temFicha: rec ? cat.atual.has(rec.id) : true,
        categoria: rec ? 'Pré-preparos (produzir)' : ins!.categoria ?? '',
        fornecedor: rec ? '' : ins!.fornecedorId ? nomeForn.get(ins!.fornecedorId) ?? '' : '',
        unidade, precisa, providenciar, embalagem: por ? e!.embalagem : null, porEmbalagem: por,
        nEmbalagens: por ? Math.ceil(pedir / por - 1e-9) : null, estoque: saldos ? estoqueChave(chave) : null, final, pedir,
        custo: preco !== null && preco !== undefined ? pedir * preco : null, preco: preco ?? null,
      })
    }
    return r
  }, [nec, cat, fornecedores, embs, saldos, finais])

  const { ordenada, cabecalho } = useOrdem(lista, {
    nome: (x) => x.nome, categoria: (x) => x.categoria, fornecedor: (x) => x.fornecedor,
    precisa: (x) => x.precisa, embalagens: (x) => x.nEmbalagens, estoque: (x) => x.estoque, providenciar: (x) => x.providenciar, final: (x) => x.final, custo: (x) => x.custo,
  }, { col: 'categoria' })

  const faltaFicha = semFicha(cat, linhas.filter((l) => l.quantidade > 0).map((l) => l.receitaId))
  // Pré-preparos sem ficha não abrem nos ingredientes.
  const preparosSemFicha = lista.filter((x) => x.preparo && !x.temFicha && x.providenciar > 0).map((x) => ({ nome: x.nome, q: x.providenciar }))
  const total = lista.reduce((s, x) => s + (x.custo ?? 0), 0)
  const semPreco = lista.filter((x) => x.custo === null && x.pedir > 0).length
  const aProvidenciar = ordenada.filter((x) => x.pedir > 0)
  const comFinal = lista.filter((x) => x.final !== null).length
  const copiarDoProvidenciar = () => {
    if (comFinal && !confirm(`${comFinal} ${comFinal === 1 ? 'item já tem' : 'itens já têm'} Pedir (final). Substituir tudo pelo Providenciar?`)) return
    const novos: Record<string, number | null> = {}
    for (const x of lista) if (!x.id.startsWith('r:')) novos[x.id] = x.providenciar > 0 ? x.providenciar : null
    setFinais(Object.fromEntries(Object.entries(novos).filter(([, q]) => q !== null).map(([k, q]) => [k, numTexto(q)])))
    salvarFinais(novos).then(() => avisar('Pedir (final) preenchido com o Providenciar'))
  }
  const limparFinais = () => {
    if (!confirm('Apagar todo o Pedir (final) deste evento?')) return
    salvarFinais(Object.fromEntries(lista.filter((x) => !x.id.startsWith('r:')).map((x) => [x.id, null])))
    setFinais({})
  }
  const nomeEstoque = estoqueDe === 'base' ? 'base de eventos' : centros.find((c) => c.id === estoqueDe)?.nome ?? 'estoque'

  const textoEmb = (x: Linha) => (x.nEmbalagens && x.embalagem && x.pedir > 0
    ? `${x.nEmbalagens} ${x.nEmbalagens === 1 ? x.embalagem : plural(x.embalagem)} de ${qtd(x.porEmbalagem!)} ${x.unidade}` : null)
  const definirEmbalagem = async (x: Linha) => {
    const ins = cat.insumos.get(x.id)
    if (!ins) return
    const nome = prompt(`${x.nome}: como vem do fornecedor? (fardo, caixa, pacote…)`, x.embalagem ?? 'fardo')?.trim().toLowerCase()
    if (!nome) return
    const n = lerValor(prompt(`Quantos ${x.unidade} vêm em 1 ${nome}?`, x.porEmbalagem ? String(x.porEmbalagem).replace('.', ',') : '') ?? '')
    if (!n || n <= 0) return avisar(`Coloque quantos ${x.unidade} vêm na embalagem (ex.: 12, 1 ou 0,330 para 330 g).`)
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
      `*${g}*\n` + [...xs].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((x) => `- ${x.nome}: ${textoEmb(x) ?? `${qtd(x.pedir)} ${x.unidade}`}`).join('\n'))
    return `*Insumos a providenciar · ${nomeEvento}*\n\n${partes.join('\n\n')}`
  }

  // Planilha para mexer à vontade (Heitor, 13/10): Providenciar e Custo são fórmulas, então mudar a quantidade,
  // o que tem na base ou o preço já refaz a conta.
  const planilha = () => {
    const xs = [...lista].sort((a, b) => (a.categoria || '~').localeCompare(b.categoria || '~', 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'))
    const cab = ['Categoria', 'Insumo', 'Fornecedor', 'Unidade', 'Precisa', `Estoque (${nomeEstoque})`, 'Providenciar', 'Pedir (final)', 'Embalagem', 'Qtd na embalagem', 'Nº de embalagens', 'Preço unit.', 'Custo']
    const rows: Celula[][] = [cab.map((v) => ({ v, s: 'cabecalho' as const }))]
    xs.forEach((x, i) => {
      const r = i + 2
      // Pedir (final) em branco = usa o Providenciar.
      const pedir = `IF(H${r}="",G${r},H${r})`
      rows.push([
        x.categoria || 'Sem categoria', x.nome, x.fornecedor, x.unidade, x.precisa, Math.max(0, x.estoque ?? 0),
        { f: descontar ? `MAX(0,E${r}-F${r})` : `E${r}`, s: 'numero' }, x.final, x.embalagem ?? '', x.porEmbalagem,
        { f: `IF(N(J${r})>0,ROUNDUP(${pedir}/J${r},0),"")`, s: 'numero' },
        { v: x.preco, s: 'reais' }, { f: `${pedir}*L${r}`, s: 'reais' },
      ])
    })
    const n = xs.length + 1
    rows.push([{ v: 'Total', s: 'total' }, null, null, null, null, null, null, null, null, null, null, null, { f: `SUM(M2:M${n})`, s: 'totalReais' }])
    baixarXlsx(`Insumos ${nomeEvento}`.replace(/[\\/:*?"<>|]/g, ' ').trim(), 'Insumos', rows, [18, 34, 24, 9, 11, 14, 13, 13, 12, 10, 12, 13, 14])
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={descontar} onChange={(e) => setDescontar(e.target.checked)} />
          Descontar o estoque de
        </label>
        <select className={`${estiloEntrada} w-auto! py-1!`} value={estoqueDe} onChange={(e) => setEstoqueDe(e.target.value)} aria-label="Estoque">
          {centros.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          <option value="base">Base de eventos (contagem)</option>
        </select>
        <div className="flex gap-2 sm:ml-auto">
          <Botao variante="secundario" className="py-1.5!" disabled={!lista.some((x) => x.providenciar > 0)} onClick={copiarDoProvidenciar}>Copiar do Providenciar</Botao>
          {comFinal > 0 && <Botao variante="secundario" className="py-1.5!" onClick={limparFinais}>Limpar final</Botao>}
        </div>
      </div>
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
                {cabecalho('estoque', 'Estoque atual', 'text-right', true)}
                {cabecalho('providenciar', 'Providenciar', 'text-right', true)}
                {cabecalho('final', 'Pedir (final)', 'text-right', true)}
                {cabecalho('embalagens', 'Embalagens', 'text-right', true)}
                {cabecalho('custo', 'Custo', 'text-right', true)}
              </tr>
            </thead>
            <tbody>
              {ordenada.map((x) => (
                <tr key={x.id} className={`border-t border-stone-100 ${x.pedir > 0 ? '' : 'text-stone-400'}`}>
                  <td className="px-3 py-1.5 font-semibold">{x.nome}</td>
                  <td className="px-3 py-1.5 text-stone-600">{x.categoria || '—'}</td>
                  <td className="px-3 py-1.5 text-stone-600">{x.fornecedor || '—'}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">{qtd(x.precisa)} {x.unidade}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">{x.estoque === null ? '…' : `${qtd(Math.round(x.estoque * 1000) / 1000)} ${x.unidade}`}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap font-semibold">
                    {x.providenciar > 0 ? `${qtd(x.providenciar)} ${x.unidade}` : 'tem no estoque'}
                  </td>
                  <td className="px-2 py-1 text-right whitespace-nowrap">
                    {x.id.startsWith('r:') ? <span className="text-xs text-stone-400" title="Ligue a ficha a um material para poder pedir">—</span> : <input
                      className={`${estiloEntrada} w-24! py-1! text-right ${x.final !== null && x.final !== x.providenciar ? 'font-semibold text-sky-800' : ''}`}
                      inputMode="decimal" placeholder="—" aria-label={`Pedir (final) de ${x.nome}`}
                      value={finais[x.id] ?? ''}
                      onChange={(e) => setFinais((f) => ({ ...f, [x.id]: e.target.value }))}
                      onBlur={(e) => {
                        const t = e.target.value.trim()
                        const v = t ? lerValor(t) : null
                        if (t && (v === null || v < 0)) return avisar('Confira o número.')
                        salvarFinais({ [x.id]: v })
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    />}
                  </td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                    {x.porEmbalagem ? (
                      <button className="text-right hover:underline" title="Mudar a embalagem" onClick={() => definirEmbalagem(x)}>
                        {x.pedir > 0 && <span className="font-semibold">{x.nEmbalagens} {x.nEmbalagens === 1 ? x.embalagem : plural(x.embalagem!)}</span>}
                        <span className="block text-xs text-stone-500">{x.embalagem} de {qtd(x.porEmbalagem)} {x.unidade}</span>
                      </button>
                    ) : x.id.startsWith('r:') ? null : (
                      <button className="text-xs text-sky-700 hover:underline" onClick={() => definirEmbalagem(x)}>definir fardo/caixa</button>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">{x.pedir === 0 ? '—' : x.custo === null ? <span className="text-xs text-amber-700">sem preço</span> : reais(x.custo)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-stone-200 bg-stone-50 text-xs">
              <tr>
                <td className="px-3 py-1.5 font-semibold" colSpan={8}>
                  {aProvidenciar.length} {aProvidenciar.length === 1 ? 'insumo' : 'insumos'} a pedir{comFinal > 0 ? ` · ${comFinal} com Pedir (final)` : ''}{semPreco > 0 && ` · ${semPreco} sem preço (fora do total)`}
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
