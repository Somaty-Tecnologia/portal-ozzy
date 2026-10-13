import { useEffect, useMemo, useState } from 'react'
import { Botao, Modal, estiloEntrada } from './ui'
import ProducaoEvento from './ProducaoEvento'
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
  // Material sem código da Eclética (veio da planilha dos eventos): o saldo das lojas e da Central fica no da Eclética.
  semCodigo: boolean
  final: number | null
  pedir: number // final, ou o providenciar quando o final está em branco
  custo: number | null
  preco: number | null
}

// v2 (13/10): o padrão passou a ser a Central de Produção (Heitor).
const CHAVE_ESTOQUE = 'insumos-evento-estoque-v2'
const numTexto = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n).replace('.', ','))

export default function InsumosEvento({ cat, eventoId, linhas, saldoBase, nomeEvento, aoMudar, inicioEvento }: {
  inicioEvento?: string
  aoMudar?: () => Promise<void>
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
        : ativos.find((c) => /central/i.test(c.nome))?.id ?? ativos[0]?.id ?? ''))
    }, () => setCentros([]))
  }, [store])
  useEffect(() => {
    if (!estoqueDe) return
    try { localStorage.setItem(CHAVE_ESTOQUE, estoqueDe) } catch { /* sem armazenamento */ }
    // Chaves 'i:<insumo>' e (só na base de eventos) 'r:<pré-preparo>'.
    if (estoqueDe === 'base') { setSaldos(new Map([...saldoBase].map(([k, b]) => [k, b.saldo]))); return }
    store.saldosEstoque(estoqueDe).then((r) => setSaldos(new Map(r.map((x) => [`i:${x.insumoId}`, x.quantidade]))), () => setSaldos(new Map()))
  }, [store, estoqueDe, saldoBase])
  const [juntando, setJuntando] = useState<Linha | null>(null)
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
        nEmbalagens: por ? Math.ceil(pedir / por - 1e-9) : null, estoque: saldos ? estoqueChave(chave) : null, semCodigo: !!ins && !ins.ecleticaCodigo, final, pedir,
        custo: preco !== null && preco !== undefined ? pedir * preco : null, preco: preco ?? null,
      })
    }
    return r
  }, [nec, cat, fornecedores, embs, saldos, finais])

  const { ordenada, cabecalho } = useOrdem(lista, {
    nome: (x) => x.nome, categoria: (x) => x.categoria, fornecedor: (x) => x.fornecedor,
    precisa: (x) => x.precisa, embalagens: (x) => x.nEmbalagens, estoque: (x) => x.estoque, providenciar: (x) => x.providenciar, final: (x) => x.final, custo: (x) => x.custo,
  }, { col: 'nome' })

  const faltaFicha = semFicha(cat, linhas.filter((l) => l.quantidade > 0).map((l) => l.receitaId))
  // Pré-preparos sem ficha não abrem nos ingredientes.
  const preparosSemFicha = lista.filter((x) => x.preparo && !x.temFicha && x.providenciar > 0).map((x) => ({ nome: x.nome, q: x.providenciar }))
  const total = lista.reduce((s, x) => s + (x.custo ?? 0), 0)
  const semPreco = lista.filter((x) => x.custo === null && x.pedir > 0).length
  // Heitor (13/10): o que é pré-preparo vai numa lista à parte para a produção; o resto é compra.
  const ehPreparo = (x: Linha) => x.preparo || !!cat.insumos.get(x.id)?.prePreparo || /pr[eé].?preparo/i.test(x.categoria)
  const aProvidenciar = ordenada.filter((x) => x.pedir > 0)
  const paraProduzir = aProvidenciar.filter(ehPreparo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const comFinal = lista.filter((x) => x.final !== null).length
  const semCodigo = lista.filter((x) => x.semCodigo).length
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
    for (const x of aProvidenciar.filter((y) => !ehPreparo(y))) grupos.set(x.categoria || 'Sem categoria', [...(grupos.get(x.categoria || 'Sem categoria') ?? []), x])
    const partes = [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).map(([g, xs]) =>
      `*${g}*\n` + [...xs].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((x) => `- ${x.nome}: ${textoEmb(x) ?? `${qtd(x.pedir)} ${x.unidade}`}`).join('\n'))
    return `*Insumos a providenciar · ${nomeEvento}*\n\n${partes.join('\n\n')}`
  }

  // Planilha para mexer à vontade (Heitor, 13/10): Providenciar e Custo são fórmulas, então mudar a quantidade,
  // o que tem na base ou o preço já refaz a conta.
  // Planilha de compras (Heitor, 13/10): quem recebe só precisa saber o que comprar e onde, do jeito que a
  // tela mostra (ex.: "4 fardos de 12 un"). Sem pré-preparos (vão para a produção) e sem o que não precisa pedir.
  const planilha = () => {
    // Heitor (13/10): também o que não precisa comprar, com o estoque, para quem compra conferir.
    const xs = lista.filter((x) => !ehPreparo(x))
      .sort((a, b) => (a.fornecedor || '~').localeCompare(b.fornecedor || '~', 'pt-BR') || (a.categoria || '~').localeCompare(b.categoria || '~', 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'))
    const rows: Celula[][] = [['Fornecedor', 'Categoria', 'Insumo', 'Unidade', 'Precisa', 'Em estoque', 'Comprar', 'Comprado'].map((v) => ({ v, s: 'cabecalho' as const }))]
    for (const x of xs)
      rows.push([
        x.fornecedor || 'Sem fornecedor', x.categoria || 'Sem categoria', x.nome, x.unidade, x.precisa, Math.max(0, x.estoque ?? 0),
        x.pedir > 0 ? textoEmb(x) ?? `${qtd(x.pedir)} ${x.unidade}` : 'Não precisa', '',
      ])
    baixarXlsx(`Compras ${nomeEvento}`.replace(/[\\/:*?"<>|]/g, ' ').trim(), 'Compras', rows, [26, 20, 34, 9, 10, 11, 22, 11])
  }

  if (!linhas.some((l) => l.quantidade > 0)) return null

  return (
    <section className="space-y-2" id="insumos-evento">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold">Insumos a providenciar</h3>
        <span className="text-sm text-stone-500">previsão × fichas, com os pré-preparos abertos até os insumos</span>
        <div className="flex gap-2 sm:ml-auto">
          <Botao variante="secundario" className="py-1.5!" disabled={!aProvidenciar.some((x) => !ehPreparo(x))}
            onClick={() => navigator.clipboard.writeText(texto()).then(() => avisar('Lista copiada para o WhatsApp'), () => avisar('Não deu para copiar neste aparelho'))}>
            Copiar compras p/ WhatsApp
          </Botao>
          <Botao variante="secundario" className="py-1.5!" disabled={!lista.length} onClick={planilha}>Baixar lista de compras</Botao>
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
      {semCodigo > 0 && estoqueDe !== 'base' && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {semCodigo === 1 ? '1 item veio' : `${semCodigo} itens vieram`} da planilha dos eventos e não {semCodigo === 1 ? 'é o material' : 'são os materiais'} do estoque, por isso o estoque atual fica 0.
          Toque em "juntar com o material" embaixo do nome para ligar ao material da Eclética (as fichas passam a usar ele).
        </p>
      )}
      {inicioEvento && (
        <ProducaoEvento cat={cat} eventoId={eventoId} nomeEvento={nomeEvento} inicioEvento={inicioEvento}
          automaticos={paraProduzir.map((x) => ({ chave: x.id.startsWith('r:') ? x.id : 'i:' + x.id, quantidade: x.pedir }))}
          necessidades={new Map(lista.map((x) => [x.id.startsWith('r:') ? x.id : 'i:' + x.id, x.precisa]))} />
      )}
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
                  <td className="px-3 py-1.5 font-semibold">
                    {x.nome}
                    {x.semCodigo && (
                      <button className="block text-xs font-normal text-amber-700 underline" title="Este item veio da planilha dos eventos e não é o material do estoque. Junte com o material certo para puxar o saldo." onClick={() => setJuntando(x)}>
                        fora do estoque · juntar com o material
                      </button>
                    )}
                  </td>
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
      {juntando && (
        <JuntarMaterial
          cat={cat} linha={juntando} aoFechar={() => setJuntando(null)}
          aoJuntar={async (destino) => {
            await store.juntarInsumos(juntando.id, destino.id)
            avisar(`${juntando.nome} juntado com ${destino.nome}`)
            setJuntando(null)
            await aoMudar?.()
          }}
        />
      )}
    </section>
  )
}

// Juntar o insumo da planilha dos eventos com o material da Eclética (Heitor, 13/10: o saldo da Central não aparecia).
const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
function JuntarMaterial({ cat, linha, aoFechar, aoJuntar }: { cat: Catalogo; linha: Linha; aoFechar: () => void; aoJuntar: (destino: Insumo) => Promise<void> }) {
  const [busca, setBusca] = useState(linha.nome.split(/[\s-]+/)[0])
  const [escolhido, setEscolhido] = useState<Insumo | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const termos = semAcento(busca).split(/\s+/).filter(Boolean)
  const opcoes = [...cat.insumos.values()]
    .filter((i) => i.id !== linha.id && i.ecleticaCodigo && termos.every((t) => semAcento(i.nome).includes(t)))
    .sort((a, b) => Number(b.unidade === linha.unidade) - Number(a.unidade === linha.unidade) || a.nome.localeCompare(b.nome))
    .slice(0, 30)
  return (
    <Modal titulo={`Juntar ${linha.nome}`} aberto aoFechar={aoFechar}>
      <p className="text-sm text-stone-600">
        Escolha o material do estoque que é o mesmo item. As fichas, contagens e pedidos de <b>{linha.nome}</b> passam para ele, e {linha.nome} sai do cadastro.
      </p>
      <input className={`${estiloEntrada} mt-3`} autoFocus placeholder="Buscar material" value={busca} onChange={(e) => { setBusca(e.target.value); setEscolhido(null) }} aria-label="Buscar material" />
      <ul className="mt-2 max-h-72 divide-y divide-stone-100 overflow-y-auto rounded-xl ring-1 ring-stone-200">
        {opcoes.length === 0 && <li className="px-3 py-3 text-sm text-stone-500">Nenhum material com esse nome.</li>}
        {opcoes.map((i) => (
          <li key={i.id}>
            <button className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${escolhido?.id === i.id ? 'bg-ozzy-400/30' : 'hover:bg-stone-50'}`} onClick={() => setEscolhido(i)}>
              <span>{i.nome} <span className="text-xs text-stone-400">cód. {i.ecleticaCodigo}</span></span>
              <span className={`text-xs ${i.unidade === linha.unidade ? 'text-stone-500' : 'text-red-600'}`}>{i.unidade}</span>
            </button>
          </li>
        ))}
      </ul>
      {escolhido && escolhido.unidade !== linha.unidade && (
        <p className="mt-2 text-sm text-red-700">{escolhido.nome} está em {escolhido.unidade} e {linha.nome} em {linha.unidade}. Acerte a unidade no cadastro antes de juntar.</p>
      )}
      {erro && <p className="mt-2 text-sm text-red-700">{erro}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
        <Botao disabled={!escolhido || escolhido.unidade !== linha.unidade || salvando} onClick={async () => {
          setSalvando(true); setErro('')
          try { await aoJuntar(escolhido!) } catch (e) { setErro((e as Error).message); setSalvando(false) }
        }}>{salvando ? 'Juntando…' : escolhido ? `Juntar com ${escolhido.nome}` : 'Escolha o material'}</Botao>
      </div>
    </Modal>
  )
}
