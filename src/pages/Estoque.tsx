import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Botao, Campo, Cartao, Modal, Selo, Vazio, estiloEntrada } from '../components/ui'
import EscolherConta from '../components/EscolherConta'
import { useOrdem } from '../components/Ordenar'
import { useApp } from '../lib/contexto'
import { addDias, addMeses, dataCurta, hoje, mesDe, nomeMesAno, primeiroDia, ultimoDia } from '../lib/datas'
import { ir } from '../lib/rota'
import { vejoResultado } from '../lib/permissoes'
import { formaDoTPag, formatarCnpj, lerXmlNfe } from '../lib/nfe'
import { dividir, lerValor, mostrarQtd, mostrarValor, nomeCentro, nomeForma, r2, reais, somarMeses } from '../lib/financeiro'
import {
  FORMAS_PAGAMENTO,
  type CentroCusto, type ContaContabil, type ContaPagar, type FormaPagamento, type Fornecedor, type Insumo, type MovimentoEstoque, type NotaFiscal, type SaldoEstoque,
} from '../lib/types'

const ABAS = [
  { id: '', nome: 'Notas fiscais' },
  { id: 'saldo', nome: 'Saldo por loja' },
  { id: 'movimentos', nome: 'Movimentos' },
]

// Módulo Estoque (09/10): tudo começa pela nota fiscal. #/estoque, #/estoque/nota/<id>, #/estoque/saldo, #/estoque/movimentos.
export default function Estoque({ sub, param }: { sub?: string; param?: string }) {
  const aba = sub === 'nota' ? '' : ABAS.some((a) => a.id && a.id === sub) ? sub! : ''
  return (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => ir(a.id ? 'estoque/' + a.id : 'estoque')}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold ${aba === a.id ? 'bg-carvao text-white' : 'text-stone-600 hover:bg-stone-200'}`}
          >
            {a.nome}
          </button>
        ))}
      </div>
      {sub === 'nota' && param ? <DetalheNota id={param} />
        : aba === 'saldo' ? <Saldo />
        : aba === 'movimentos' ? <Movimentos />
        : <Notas />}
    </div>
  )
}

// Cadastros que as telas usam juntos.
function useCadastros() {
  const { store } = useApp()
  const [c, setC] = useState<{ centros: CentroCusto[]; plano: ContaContabil[]; fornecedores: Fornecedor[]; insumos: Insumo[] } | null>(null)
  const [erro, setErro] = useState('')
  useEffect(() => {
    Promise.all([store.centrosCusto(), store.planoContas(), store.fornecedores(), store.insumos()]).then(
      ([centros, plano, fornecedores, insumos]) => setC({ centros, plano, fornecedores, insumos }),
      (e) => setErro(e.message),
    )
  }, [store])
  return { c, erro }
}

const nomeFornecedor = (n: Pick<NotaFiscal, 'fornecedorId' | 'emitenteNome'>, fornecedores: Fornecedor[]) =>
  fornecedores.find((f) => f.id === n.fornecedorId)?.nome ?? n.emitenteNome ?? 'Fornecedor não informado'

function Notas() {
  const { store } = useApp()
  const { c, erro: erroCad } = useCadastros()
  const [notas, setNotas] = useState<NotaFiscal[] | null>(null)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState<'conferir' | 'lancada' | ''>('')
  const [loja, setLoja] = useState('')
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState<{ arquivo: string; ok: boolean; texto: string; id?: string }[] | null>(null)
  const [manual, setManual] = useState(false)
  const arquivo = useRef<HTMLInputElement>(null)

  const carregar = useCallback(() => store.notasFiscais().then(setNotas, (e) => setErro(e.message)), [store])
  useEffect(() => {
    carregar()
  }, [carregar])

  async function importar(files: FileList | null) {
    if (!files?.length) return
    setImportando(true)
    const r: NonNullable<typeof resultado> = []
    for (const f of Array.from(files)) {
      try {
        const nota = lerXmlNfe(await f.text())
        const id = await store.importarNota(nota)
        r.push({ arquivo: f.name, ok: true, texto: `NF ${nota.numero} · ${nota.emitente.fantasia || nota.emitente.nome} · ${reais(nota.totais.total)}`, id })
      } catch (e) {
        r.push({ arquivo: f.name, ok: false, texto: (e as Error).message })
      }
    }
    setImportando(false)
    if (arquivo.current) arquivo.current.value = ''
    await carregar()
    const certas = r.filter((x) => x.ok)
    if (r.length === 1 && certas.length === 1) ir('estoque/nota/' + certas[0].id)
    else setResultado(r)
  }

  if (erro || erroCad) return <Vazio>{erro || erroCad}</Vazio>
  if (!notas || !c) return <p className="text-stone-400">Carregando…</p>
  const lista = notas.filter((n) => (!filtro || n.status === filtro) && (!loja || n.centroCustoId === loja))
  const aConferir = notas.filter((n) => n.status === 'conferir').length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Notas fiscais de compra</h1>
          <p className="text-sm text-stone-500">Importe o XML: os itens viram entrada no estoque e os boletos viram contas a pagar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={arquivo} type="file" accept=".xml,text/xml,application/xml" multiple className="hidden" onChange={(e) => importar(e.target.files)} />
          <Botao onClick={() => arquivo.current?.click()} disabled={importando}>{importando ? 'Lendo…' : 'Importar XML'}</Botao>
          <Botao variante="secundario" onClick={() => setManual(true)}>Nota sem XML</Botao>
        </div>
      </div>

      {resultado && (
        <Cartao className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{resultado.filter((x) => x.ok).length} de {resultado.length} notas importadas</h2>
            <button className="text-sm text-stone-500 hover:underline" onClick={() => setResultado(null)}>Fechar</button>
          </div>
          <ul className="space-y-1 text-sm">
            {resultado.map((x, i) => (
              <li key={i} className={x.ok ? 'text-stone-700' : 'text-red-700'}>
                {x.ok ? '✓' : '✗'} <span className="text-stone-500">{x.arquivo}:</span> {x.texto}
                {x.id && <button className="ml-2 font-semibold underline" onClick={() => ir('estoque/nota/' + x.id)}>Conferir</button>}
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      <div className="flex flex-wrap gap-2">
        {([['', 'Todas'], ['conferir', `A conferir${aConferir ? ` (${aConferir})` : ''}`], ['lancada', 'Lançadas']] as const).map(([v, nome]) => (
          <button key={v} onClick={() => setFiltro(v)}
            className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${filtro === v ? 'bg-carvao text-white ring-carvao' : 'bg-white text-stone-600 ring-stone-300'}`}>
            {nome}
          </button>
        ))}
        <select className={`${estiloEntrada} w-auto! py-1!`} value={loja} onChange={(e) => setLoja(e.target.value)}>
          <option value="">Todas as lojas</option>
          {c.centros.map((x) => <option key={x.id} value={x.id}>{nomeCentro(x)}</option>)}
        </select>
      </div>

      {lista.length === 0 ? (
        <Vazio>{notas.length ? 'Nenhuma nota neste filtro.' : 'Nenhuma nota ainda. Importe o XML que o fornecedor manda por e-mail.'}</Vazio>
      ) : (
        <div className="space-y-2">
          {lista.map((n) => (
            <Cartao key={n.id} onClick={() => ir('estoque/nota/' + n.id)} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold break-words">{nomeFornecedor(n, c.fornecedores)}</p>
                <p className="text-sm text-stone-500">
                  NF {n.numero ?? 's/n'} · {dataCurta(n.emissao)} · {n.centroCustoId ? nomeCentro(c.centros.find((x) => x.id === n.centroCustoId)) : 'loja a definir'}
                  {!n.chave && ' · sem XML'}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold">{reais(n.valorTotal)}</p>
                {n.status === 'conferir' ? <Selo cor="ambar">A conferir</Selo> : <Selo cor="verde">Lançada</Selo>}
              </div>
            </Cartao>
          ))}
        </div>
      )}

      <NotaManual aberto={manual} aoFechar={() => setManual(false)} c={c} aoCriar={(id) => ir('estoque/nota/' + id)} />
    </div>
  )
}

function NotaManual({ aberto, aoFechar, c, aoCriar }: {
  aberto: boolean; aoFechar: () => void; c: NonNullable<ReturnType<typeof useCadastros>['c']>; aoCriar: (id: string) => void
}) {
  const { store } = useApp()
  const [v, setV] = useState({ numero: '', emissao: hoje(), fornecedorId: '', emitenteNome: '', centroCustoId: '', valor: '', observacao: '' })
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  async function salvar() {
    const valor = lerValor(v.valor)
    if (!valor || valor <= 0) return setErro('Coloque o valor total da nota.')
    if (!v.fornecedorId && !v.emitenteNome.trim()) return setErro('Escolha o fornecedor ou escreva o nome.')
    setSalvando(true)
    try {
      const id = await store.criarNotaManual({
        numero: v.numero, emissao: v.emissao, fornecedorId: v.fornecedorId || null, emitenteNome: v.emitenteNome || null,
        centroCustoId: v.centroCustoId || null, valorTotal: valor, observacao: v.observacao || null, arquivo,
      })
      aoCriar(id)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }
  return (
    <Modal titulo="Nota sem XML" aberto={aberto} aoFechar={aoFechar}>
      <div className="space-y-3">
        <p className="text-sm text-stone-500">Para nota de papel, recibo ou serviço. Anexe a foto ou o PDF. Na próxima tela você coloca os itens: os insumos entram no estoque e o preço é atualizado.</p>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Número"><input className={estiloEntrada} value={v.numero} onChange={(e) => setV({ ...v, numero: e.target.value })} /></Campo>
          <Campo rotulo="Emissão"><input type="date" className={estiloEntrada} value={v.emissao} onChange={(e) => setV({ ...v, emissao: e.target.value })} /></Campo>
        </div>
        <Campo rotulo="Fornecedor">
          <select className={estiloEntrada} value={v.fornecedorId} onChange={(e) => setV({ ...v, fornecedorId: e.target.value })}>
            <option value="">Outro (escrever o nome)</option>
            {c.fornecedores.filter((f) => f.ativo).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </Campo>
        {!v.fornecedorId && (
          <Campo rotulo="Nome de quem emitiu"><input className={estiloEntrada} value={v.emitenteNome} onChange={(e) => setV({ ...v, emitenteNome: e.target.value })} /></Campo>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Loja">
            <select className={estiloEntrada} value={v.centroCustoId} onChange={(e) => setV({ ...v, centroCustoId: e.target.value })}>
              <option value="">Escolher depois</option>
              {c.centros.map((x) => <option key={x.id} value={x.id}>{nomeCentro(x)}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Valor total (R$)"><input inputMode="decimal" className={estiloEntrada} value={v.valor} onChange={(e) => setV({ ...v, valor: e.target.value })} /></Campo>
        </div>
        <Campo rotulo="Foto ou PDF da nota">
          <input type="file" accept="application/pdf,image/*" className="text-sm" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
        </Campo>
        <Campo rotulo="Observação"><input className={estiloEntrada} value={v.observacao} onChange={(e) => setV({ ...v, observacao: e.target.value })} /></Campo>
        {erro && <p className="text-sm text-red-700">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Continuar'}</Botao>
        </div>
      </div>
    </Modal>
  )
}

interface ItemEdit { id: string; insumoId: string; fator: string; foraEstoque: boolean }
interface ParcelaEdit { vencimento: string; valor: string; forma: FormaPagamento; documento: string }

interface ReciboEdit { insumoId: string; descricao: string; quantidade: string; valor: string }

function parcelasIniciais(n: NotaFiscal): ParcelaEdit[] {
  // Veio da conciliação: o débito do extrato já pagou, à vista.
  if (n.extratoMovimentoId) return [{ vencimento: n.emissao, valor: mostrarValor(n.valorTotal), forma: 'cartao_debito', documento: '' }]
  const forma = formaDoTPag(n.pagamentoXml.find((p) => p.tPag !== '90')?.tPag)
  if (n.duplicatas.length) {
    return n.duplicatas.map((d) => ({ vencimento: d.vencimento, valor: mostrarValor(d.valor), forma: forma === 'dinheiro' ? 'boleto' : forma, documento: d.numero ?? '' }))
  }
  const avista = forma === 'pix' || forma === 'dinheiro' || forma === 'cartao_debito'
  return [{ vencimento: avista ? n.emissao : addDias(n.emissao, 7) < hoje() ? hoje() : addDias(n.emissao, 7), valor: mostrarValor(n.valorTotal), forma, documento: '' }]
}

function DetalheNota({ id }: { id: string }) {
  const { store, eu } = useApp()
  const { c, erro: erroCad } = useCadastros()
  const [n, setN] = useState<NotaFiscal | null>(null)
  const [contas, setContas] = useState<ContaPagar[]>([])
  const [erro, setErro] = useState('')
  const [centro, setCentro] = useState('')
  const [conta, setConta] = useState('')
  const [itens, setItens] = useState<ItemEdit[]>([])
  const [recibo, setRecibo] = useState<ReciboEdit[]>([])
  const [parcelas, setParcelas] = useState<ParcelaEdit[]>([])
  const [atualizarPreco, setAtualizarPreco] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [link, setLink] = useState('')
  const financeiro = vejoResultado(eu.nivel)

  const carregar = useCallback(async () => {
    try {
      const nota = await store.notaFiscal(id)
      setN(nota)
      setCentro(nota.centroCustoId ?? '')
      setItens((nota.itens ?? []).map((i) => ({ id: i.id, insumoId: i.insumoId ?? '', fator: i.fator ? String(i.fator).replace('.', ',') : '', foraEstoque: i.foraEstoque })))
      setParcelas(parcelasIniciais(nota))
      if (!nota.chave) {
        setRecibo((nota.itens ?? []).map((i) => ({
          insumoId: i.insumoId ?? '', descricao: i.insumoId ? '' : i.descricao, quantidade: String(i.quantidade).replace('.', ','), valor: mostrarValor(i.valorTotal),
        })))
      }
      if (financeiro) setContas(await store.contasDaNota(id))
      if (nota.arquivo) setLink(await store.linkArquivoNota(nota.arquivo))
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [store, id, financeiro])
  useEffect(() => {
    carregar()
  }, [carregar])
  // Conta contábil sugerida: a última usada para este fornecedor.
  useEffect(() => {
    if (n && c && !conta) setConta(c.fornecedores.find((f) => f.id === n.fornecedorId)?.contaPadraoId ?? '')
  }, [n, c, conta])

  const insumoPorId = useMemo(() => new Map((c?.insumos ?? []).map((i) => [i.id, i])), [c])
  if (erro || erroCad) return <Vazio>{erro || erroCad}</Vazio>
  if (!n || !c) return <p className="text-stone-400">Carregando…</p>

  const aberta = n.status === 'conferir'
  const somaParcelas = r2(parcelas.reduce((s, p) => s + (lerValor(p.valor) ?? 0), 0))
  const diferenca = r2(n.valorTotal - somaParcelas)
  const pendentes = n.chave ? itens.filter((i) => !i.insumoId && !i.foraEstoque).length : 0
  const mudarItem = (k: number, m: Partial<ItemEdit>) => setItens(itens.map((x, i) => (i === k ? { ...x, ...m } : x)))
  const mudarParcela = (k: number, m: Partial<ParcelaEdit>) => setParcelas(parcelas.map((x, i) => (i === k ? { ...x, ...m } : x)))

  function dividirEm(qtd: number) {
    const base = parcelas[0] ?? parcelasIniciais(n!)[0]
    setParcelas(dividir(n!.valorTotal, qtd).map((v, i) => ({ ...base, valor: mostrarValor(v), vencimento: somarMeses(base.vencimento, i), documento: '' })))
  }

  async function lancar() {
    setAviso('')
    if (!centro) return setAviso('Escolha a loja que recebeu a nota.')
    if (!conta) return setAviso('Escolha a conta contábil.')
    const reciboValido = recibo.filter((x) => x.insumoId || x.descricao.trim() || x.valor.trim())
    for (const x of reciboValido) {
      if (!x.insumoId && !x.descricao.trim()) return setAviso('Escolha o insumo de cada item do recibo (ou escreva o que é).')
      if (!(lerValor(x.quantidade)! > 0) || !(lerValor(x.valor)! > 0)) return setAviso('Coloque a quantidade e o valor de cada item do recibo.')
    }
    if (pendentes) return setAviso(`${pendentes} ${pendentes === 1 ? 'item está' : 'itens estão'} sem insumo. Escolha o insumo ou marque "não controla".`)
    for (const p of parcelas) if (!p.vencimento || !(lerValor(p.valor)! > 0)) return setAviso('Confira o vencimento e o valor de cada pagamento.')
    if (Math.abs(diferenca) > 0.05) return setAviso(`Os pagamentos somam ${reais(somaParcelas)} e a nota é de ${reais(n!.valorTotal)}.`)
    setSalvando(true)
    try {
      // Recibo: salva os itens digitados (quantidade já na unidade do insumo) e lança com eles.
      const doRecibo = !n!.chave
        ? (await store.salvarItensNota(n!.id, reciboValido.map((x) => {
            const ins = x.insumoId ? insumoPorId.get(x.insumoId) : undefined
            return { descricao: ins?.nome ?? x.descricao, unidade: ins?.unidade ?? null, quantidade: lerValor(x.quantidade)!, valorTotal: lerValor(x.valor)!, insumoId: x.insumoId || null }
          }))).map((i) => ({ id: i.id, insumoId: i.insumoId, fator: 1, foraEstoque: !i.insumoId }))
        : null
      await store.lancarNota(n!.id, {
        centroCustoId: centro, contaId: conta, competencia: null, atualizarPreco,
        itens: doRecibo ?? itens.map((i) => ({ id: i.id, insumoId: i.foraEstoque ? null : i.insumoId || null, fator: lerValor(i.fator), foraEstoque: i.foraEstoque })),
        parcelas: parcelas.map((p) => ({ vencimento: p.vencimento, valor: lerValor(p.valor)!, forma: p.forma, documento: p.documento || null })),
      })
      await carregar()
    } catch (e) {
      setAviso((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }
  async function estornar() {
    if (!confirm('Desfazer o lançamento? A entrada no estoque e as contas a pagar desta nota saem, e ela volta para "a conferir".')) return
    try {
      await store.estornarNota(n!.id)
      await carregar()
    } catch (e) {
      setAviso((e as Error).message)
    }
  }
  async function excluir() {
    if (!confirm('Excluir esta nota? Dá para importar o XML de novo depois.')) return
    try {
      await store.excluirNota(n!.id)
      ir('estoque')
    } catch (e) {
      setAviso((e as Error).message)
    }
  }

  const insumosAtivos = c.insumos.filter((i) => i.ativo)
  return (
    <div className="space-y-4">
      <button className="text-sm text-stone-500 hover:underline" onClick={() => ir('estoque')}>← Notas fiscais</button>
      <Cartao className="space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-bold break-words">{nomeFornecedor(n, c.fornecedores)}</h1>
            <p className="text-sm text-stone-500">
              NF {n.numero ?? 's/n'}{n.serie ? ` série ${n.serie}` : ''} · emitida em {dataCurta(n.emissao)}/{n.emissao.slice(0, 4)}
              {n.emitenteCnpj && ` · CNPJ ${formatarCnpj(n.emitenteCnpj)}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">{reais(n.valorTotal)}</p>
            {aberta ? <Selo cor="ambar">A conferir</Selo> : <Selo cor="verde">Lançada</Selo>}
          </div>
        </div>
        {n.chave && <p className="font-mono text-xs break-all text-stone-400">Chave {n.chave}</p>}
        {(n.frete || n.desconto) ? (
          <p className="text-sm text-stone-500">
            Produtos {reais(n.valorProdutos ?? 0)}{n.frete ? ` · frete ${reais(n.frete)}` : ''}{n.desconto ? ` · desconto ${reais(n.desconto)}` : ''}
          </p>
        ) : null}
        {n.observacao && <p className="text-sm">{n.observacao}</p>}
        {link && <a href={link} target="_blank" rel="noreferrer" className="text-sm font-semibold underline">Ver arquivo da nota</a>}
      </Cartao>

      <Cartao className="space-y-3">
        <h2 className="font-semibold">Onde o custo entra</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Loja">
            <select className={estiloEntrada} value={centro} disabled={!aberta} onChange={(e) => setCentro(e.target.value)}>
              <option value="">Escolher</option>
              {c.centros.map((x) => <option key={x.id} value={x.id}>{nomeCentro(x)}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Conta contábil" dica={aberta && conta && conta === c.fornecedores.find((f) => f.id === n.fornecedorId)?.contaPadraoId ? 'A mesma da última nota deste fornecedor.' : undefined}>
            <EscolherConta plano={c.plano} valor={conta} aoMudar={setConta} desativado={!aberta} />
          </Campo>
        </div>
      </Cartao>

      {n.extratoMovimentoId && (
        <Cartao className="space-y-1 bg-blue-50!">
          <p className="text-sm">
            {aberta
              ? 'Esta nota veio da conciliação: o débito do extrato já pagou. Ao lançar, a conta já entra paga e o débito fica conciliado.'
              : 'Paga pelo débito do extrato (conciliada).'}
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <button className="font-semibold underline" onClick={() => ir('financeiro/conciliacao')}>Voltar para a conciliação</button>
            {aberta && (
              <button className="font-semibold underline" onClick={async () => { await store.ligarNotaExtrato(n.id, null); await carregar() }}>Desligar do extrato</button>
            )}
          </div>
        </Cartao>
      )}

      {!n.chave && (aberta || recibo.length > 0) && (
        <Cartao className="space-y-3">
          <h2 className="font-semibold">Itens do recibo</h2>
          <p className="text-sm text-stone-500">
            Diga o que foi comprado: os insumos entram no estoque da loja e o preço deles é atualizado. A quantidade é na unidade do insumo (kg, un…). Serviço ou algo que não se controla: deixe sem insumo e escreva o que é.
          </p>
          <div className="space-y-2">
            {recibo.map((x, k) => {
              const ins = x.insumoId ? insumoPorId.get(x.insumoId) : undefined
              const q = lerValor(x.quantidade) ?? 0
              const v = lerValor(x.valor) ?? 0
              const mudar = (m: Partial<ReciboEdit>) => setRecibo(recibo.map((y, i) => (i === k ? { ...y, ...m } : y)))
              return (
                <div key={k} className="grid grid-cols-2 gap-2 border-b border-stone-100 pb-2 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-center">
                  <div className="col-span-2 space-y-1 sm:col-span-1">
                    <select aria-label="Insumo" className={`${estiloEntrada} py-1.5!`} value={x.insumoId} disabled={!aberta} onChange={(e) => mudar({ insumoId: e.target.value })}>
                      <option value="">Sem insumo (não controla)</option>
                      {insumosAtivos.map((i) => <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>)}
                    </select>
                    {!x.insumoId && <input aria-label="O que é" placeholder="O que é (ex.: conserto, gelo)" className={`${estiloEntrada} py-1.5!`} value={x.descricao} disabled={!aberta} onChange={(e) => mudar({ descricao: e.target.value })} />}
                  </div>
                  <label className="flex items-center gap-1 text-sm text-stone-600">
                    <input aria-label="Quantidade" inputMode="decimal" placeholder="Qtd" className={`${estiloEntrada} py-1.5!`} value={x.quantidade} disabled={!aberta} onChange={(e) => mudar({ quantidade: e.target.value })} />
                    {ins?.unidade}
                  </label>
                  <input aria-label="Valor do item" inputMode="decimal" placeholder="Valor R$" className={`${estiloEntrada} py-1.5!`} value={x.valor} disabled={!aberta} onChange={(e) => mudar({ valor: e.target.value })} />
                  {aberta ? <button className="text-sm text-red-700 hover:underline" onClick={() => setRecibo(recibo.filter((_, i) => i !== k))}>Tirar</button> : <span />}
                  {ins && q > 0 && v > 0 && (
                    <p className="col-span-2 text-xs text-stone-500 sm:col-span-4">
                      {reais(v / q)}/{ins.unidade}{ins.preco ? ` (cadastro: ${reais(ins.preco)})` : ''}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
          {aberta && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <button className="font-semibold underline" onClick={() => setRecibo([...recibo, { insumoId: '', descricao: '', quantidade: '', valor: '' }])}>+ Item</button>
              {recibo.length > 0 && (
                <span className="text-stone-500">
                  Itens {reais(recibo.reduce((t, x) => t + (lerValor(x.valor) ?? 0), 0))} de {reais(n.valorTotal)}
                </span>
              )}
            </div>
          )}
        </Cartao>
      )}

      {n.chave && (n.itens?.length ?? 0) > 0 && (
        <Cartao className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Itens da nota ({n.itens!.length})</h2>
            {aberta && pendentes > 0 && (
              <button className="text-sm font-semibold underline" onClick={() => setItens(itens.map((i) => (i.insumoId ? i : { ...i, foraEstoque: true })))}>
                Marcar os {pendentes} sem insumo como "não controla"
              </button>
            )}
          </div>
          <p className="text-sm text-stone-500">
            Diga qual insumo do cadastro é cada item e quanto vem na unidade da nota. Na próxima nota deste fornecedor, o portal já lembra.
          </p>
          <div className="divide-y divide-stone-100">
            {n.itens!.map((it, k) => {
              const e = itens[k]
              const ins = e?.insumoId ? insumoPorId.get(e.insumoId) : undefined
              const fator = lerValor(e?.fator ?? '') ?? 1
              const qtd = it.quantidade * fator
              const custo = qtd > 0 ? it.valorTotal / qtd : 0
              const variacao = ins?.preco ? (custo - ins.preco) / ins.preco : null
              return (
                <div key={it.id} className="space-y-2 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium break-words">{it.descricao}</p>
                      <p className="text-xs text-stone-500">
                        {mostrarQtd(it.quantidade)} {it.unidade} × {reais(it.valorUnit ?? 0)}{it.codigo ? ` · cód. ${it.codigo}` : ''}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold">{reais(it.valorTotal)}</p>
                  </div>
                  {aberta && e ? (
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                      <select className={`${estiloEntrada} py-1.5!`} value={e.foraEstoque ? '' : e.insumoId} disabled={e.foraEstoque}
                        onChange={(ev) => mudarItem(k, { insumoId: ev.target.value })}>
                        <option value="">{e.foraEstoque ? 'Não controla no estoque' : 'Escolher o insumo…'}</option>
                        {insumosAtivos.map((i) => <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>)}
                      </select>
                      {!e.foraEstoque && ins && (
                        <label className="flex items-center gap-1 text-sm whitespace-nowrap text-stone-600">
                          1 {it.unidade || 'un'} =
                          <input inputMode="decimal" placeholder="1" className={`${estiloEntrada} w-20! py-1.5!`} value={e.fator}
                            onChange={(ev) => mudarItem(k, { fator: ev.target.value })} />
                          {ins.unidade}
                        </label>
                      )}
                      <label className="flex items-center gap-2 text-sm whitespace-nowrap text-stone-600">
                        <input type="checkbox" checked={e.foraEstoque} onChange={(ev) => mudarItem(k, { foraEstoque: ev.target.checked })} />
                        não controla
                      </label>
                    </div>
                  ) : (
                    <p className="text-sm text-stone-600">
                      {it.foraEstoque ? 'Não controla no estoque' : ins ? `${ins.nome}` : 'Sem insumo'}
                    </p>
                  )}
                  {ins && !e?.foraEstoque && (
                    <p className="text-xs text-stone-500">
                      Entra {mostrarQtd(qtd)} {ins.unidade} a {reais(custo)}/{ins.unidade}
                      {variacao !== null && Math.abs(variacao) >= 0.005 && (
                        <span className={variacao > 0.1 ? ' font-semibold text-red-700' : variacao < -0.1 ? ' font-semibold text-green-700' : ''}>
                          {' '}({variacao > 0 ? '+' : ''}{(variacao * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% do preço do cadastro, {reais(ins.preco!)})
                        </span>
                      )}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </Cartao>
      )}

      {aberta ? (
        <Cartao className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Pagamento</h2>
            <div className="flex items-center gap-2 text-sm text-stone-600">
              Dividir em
              <select className={`${estiloEntrada} w-auto! py-1!`} value="" onChange={(e) => e.target.value && dividirEm(Number(e.target.value))}>
                <option value="">…</option>
                {[1, 2, 3, 4, 5, 6, 10, 12].map((q) => <option key={q} value={q}>{q}×</option>)}
              </select>
            </div>
          </div>
          {n.duplicatas.length > 0 && <p className="text-sm text-stone-500">Os vencimentos vieram dos boletos (duplicatas) da nota.</p>}
          <div className="space-y-2">
            {parcelas.map((p, k) => (
              <div key={k} className="grid grid-cols-2 gap-2 border-b border-stone-100 pb-2 sm:border-0 sm:pb-0 sm:grid-cols-[auto_1fr_1fr_1fr_1fr_auto] sm:items-center">
                <span className="col-span-2 text-sm font-semibold text-stone-500 sm:col-span-1 sm:w-8">{parcelas.length > 1 ? `${k + 1}/${parcelas.length}` : ''}</span>
                <input type="date" aria-label="Vencimento" className={`${estiloEntrada} py-1.5!`} value={p.vencimento} onChange={(e) => mudarParcela(k, { vencimento: e.target.value })} />
                <input inputMode="decimal" aria-label="Valor" className={`${estiloEntrada} py-1.5!`} value={p.valor} onChange={(e) => mudarParcela(k, { valor: e.target.value })} />
                <select aria-label="Forma" className={`${estiloEntrada} py-1.5!`} value={p.forma} onChange={(e) => mudarParcela(k, { forma: e.target.value as FormaPagamento })}>
                  {FORMAS_PAGAMENTO.map((f) => <option key={f.valor} value={f.valor}>{f.nome}</option>)}
                </select>
                <input aria-label="Documento" placeholder="Nº do boleto / chave Pix" className={`${estiloEntrada} py-1.5!`} value={p.documento} onChange={(e) => mudarParcela(k, { documento: e.target.value })} />
                {parcelas.length > 1 ? (
                  <button className="text-sm text-red-700 hover:underline" onClick={() => setParcelas(parcelas.filter((_, i) => i !== k))}>Tirar</button>
                ) : <span />}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <button className="font-semibold underline" onClick={() => {
              const ult = parcelas[parcelas.length - 1]
              setParcelas([...parcelas, { ...ult, vencimento: somarMeses(ult.vencimento, 1), valor: diferenca > 0 ? mostrarValor(diferenca) : '', documento: '' }])
            }}>+ Pagamento</button>
            <span className={Math.abs(diferenca) > 0.05 ? 'font-semibold text-red-700' : 'text-stone-500'}>
              Soma {reais(somaParcelas)}{Math.abs(diferenca) > 0.05 ? ` · falta ${reais(diferenca)}` : ' · confere com a nota'}
            </span>
          </div>
          {((n.chave && (n.itens?.length ?? 0) > 0) || recibo.some((x) => x.insumoId)) && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={atualizarPreco} onChange={(e) => setAtualizarPreco(e.target.checked)} />
              Atualizar o preço dos insumos com o desta nota (o custo das fichas acompanha)
            </label>
          )}
          {aviso && <p className="text-sm text-red-700">{aviso}</p>}
          <div className="flex flex-wrap justify-between gap-2">
            <Botao variante="perigo" onClick={excluir}>Excluir nota</Botao>
            <Botao onClick={lancar} disabled={salvando}>{salvando ? 'Lançando…' : 'Lançar nota'}</Botao>
          </div>
        </Cartao>
      ) : (
        <Cartao className="space-y-3">
          <h2 className="font-semibold">Pagamento</h2>
          {financeiro ? (
            contas.length ? (
              <ul className="divide-y divide-stone-100 text-sm">
                {contas.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-2 py-2">
                    <span>{x.parcelas ? `${x.parcela}/${x.parcelas} · ` : ''}vence {dataCurta(x.vencimento)} · {nomeForma(x.forma)}</span>
                    <span className="text-right">
                      {reais(x.valor)} {x.pagoEm ? <Selo cor="verde">Paga {dataCurta(x.pagoEm)}</Selo> : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-stone-500">Sem contas a pagar.</p>
          ) : (
            <p className="text-sm text-stone-500">Os pagamentos foram para o contas a pagar do escritório.</p>
          )}
          {financeiro && <button className="text-sm font-semibold underline" onClick={() => ir('financeiro')}>Abrir contas a pagar</button>}
          {aviso && <p className="text-sm text-red-700">{aviso}</p>}
          <div className="flex justify-end">
            <Botao variante="secundario" onClick={estornar}>Desfazer lançamento</Botao>
          </div>
        </Cartao>
      )}
    </div>
  )
}

function Saldo() {
  const { store } = useApp()
  const { c, erro: erroCad } = useCadastros()
  const [saldos, setSaldos] = useState<SaldoEstoque[] | null>(null)
  const [erro, setErro] = useState('')
  const [centro, setCentro] = useState('burger-psd')
  const [busca, setBusca] = useState('')
  const [mov, setMov] = useState<{ insumoId: string } | null>(null)
  const carregar = useCallback(() => {
    let vale = true
    setSaldos(null)
    store.saldosEstoque(centro).then((s) => vale && setSaldos(s), (e) => vale && setErro(e.message))
    return () => { vale = false }
  }, [store, centro])
  useEffect(carregar, [carregar])
  if (erro || erroCad) return <Vazio>{erro || erroCad}</Vazio>
  if (!saldos || !c) return <p className="text-stone-400">Carregando…</p>

  const linhas = saldos
    .map((v) => {
      const ins = c.insumos.find((i) => i.id === v.insumoId)
      const custo = v.custo ?? ins?.preco ?? null
      return { id: v.insumoId, ins, qtd: v.quantidade, ultima: v.ultima, custo, valor: custo !== null ? Math.max(v.quantidade, 0) * custo : 0 }
    })
    .filter((l) => Math.abs(l.qtd) > 0.0001 && (!busca || (l.ins?.nome ?? '').toLowerCase().includes(busca.toLowerCase())))
    .sort((a, b) => (a.ins?.nome ?? '').localeCompare(b.ins?.nome ?? ''))
  const total = linhas.reduce((t, l) => t + l.valor, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Saldo por loja</h1>
          <p className="text-sm text-stone-500">Entradas das notas menos saídas, perdas e ajustes de contagem.</p>
        </div>
        <Botao onClick={() => setMov({ insumoId: '' })}>+ Movimento</Botao>
      </div>
      <div className="flex flex-wrap gap-2">
        <select className={`${estiloEntrada} w-auto!`} value={centro} onChange={(e) => setCentro(e.target.value)}>
          {c.centros.map((x) => <option key={x.id} value={x.id}>{nomeCentro(x)}</option>)}
        </select>
        <input className={`${estiloEntrada} w-auto! flex-1`} placeholder="Buscar insumo" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Cartao><p className="text-sm text-stone-500">Itens com saldo</p><p className="text-xl font-bold">{linhas.length}</p></Cartao>
        <Cartao><p className="text-sm text-stone-500">Valor em estoque</p><p className="text-xl font-bold">{reais(total)}</p></Cartao>
      </div>
      {linhas.length === 0 ? (
        <Vazio>Nada em estoque nesta loja ainda. As entradas aparecem quando as notas são lançadas.</Vazio>
      ) : (
        <TabelaSaldo linhas={linhas} aoAjustar={(id) => setMov({ insumoId: id })} />
      )}
      {mov && (
        <NovoMovimento c={c} centro={centro} insumoId={mov.insumoId} saldoDe={(id) => saldos.find((x) => x.insumoId === id)?.quantidade ?? 0}
          aoFechar={() => setMov(null)} aoSalvar={() => { setMov(null); carregar() }} />
      )}
    </div>
  )
}

type LinhaSaldo = { id: string; ins?: Insumo; qtd: number; ultima: string; custo: number | null; valor: number }
function TabelaSaldo({ linhas, aoAjustar }: { linhas: LinhaSaldo[]; aoAjustar: (id: string) => void }) {
  const { ordenada, cabecalho } = useOrdem(linhas, {
    nome: (l) => l.ins?.nome ?? '', qtd: (l) => l.qtd, custo: (l) => l.custo, valor: (l) => l.valor,
  }, { col: 'nome' })
  return (
    <Cartao className="overflow-x-auto p-0!">
      <table className="w-full text-sm">
        <thead className="bg-stone-50 text-left text-stone-500">
          <tr>{cabecalho('nome', 'Insumo')}{cabecalho('qtd', 'Saldo', 'text-right', true)}{cabecalho('custo', 'Custo', 'text-right', true)}{cabecalho('valor', 'Valor', 'text-right', true)}<th /></tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {ordenada.map((l) => (
            <tr key={l.id}>
              <td className="px-3 py-2">{l.ins?.nome ?? 'Insumo removido'}<span className="block text-xs text-stone-400">último movimento {dataCurta(l.ultima)}</span></td>
              <td className={`px-3 py-2 text-right whitespace-nowrap ${l.qtd < 0 ? 'font-semibold text-red-700' : ''}`}>{mostrarQtd(l.qtd)} {l.ins?.unidade}</td>
              <td className="px-3 py-2 text-right whitespace-nowrap">{l.custo !== null ? reais(l.custo) : '—'}</td>
              <td className="px-3 py-2 text-right whitespace-nowrap">{reais(l.valor)}</td>
              <td className="px-3 py-2 text-right"><button className="font-semibold underline" onClick={() => aoAjustar(l.id)}>Ajustar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Cartao>
  )
}

type TipoMov = 'contagem' | 'saida' | 'perda' | 'entrada' | 'transferencia'
const TIPOS_MOV: { valor: TipoMov; nome: string; dica: string }[] = [
  { valor: 'contagem', nome: 'Contagem', dica: 'Coloque quanto tem de verdade. O portal lança a diferença.' },
  { valor: 'saida', nome: 'Saída (uso)', dica: 'O que foi usado na produção.' },
  { valor: 'perda', nome: 'Perda', dica: 'Vencido, estragado, caiu no chão… diga o motivo.' },
  { valor: 'entrada', nome: 'Entrada sem nota', dica: 'Compra sem nota ou doação.' },
  { valor: 'transferencia', nome: 'Transferência', dica: 'Mandou para outra loja: sai desta e entra na outra.' },
]

function NovoMovimento({ c, centro, insumoId, saldoDe, aoFechar, aoSalvar }: {
  c: NonNullable<ReturnType<typeof useCadastros>['c']>; centro: string; insumoId: string; saldoDe: (id: string) => number; aoFechar: () => void; aoSalvar: () => void
}) {
  const { store } = useApp()
  const [v, setV] = useState({ tipo: (insumoId ? 'contagem' : 'saida') as TipoMov, insumoId, qtd: '', data: hoje(), destino: '', obs: '' })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const ins = c.insumos.find((i) => i.id === v.insumoId)
  const atual = v.insumoId ? saldoDe(v.insumoId) : 0
  async function salvar() {
    const q = lerValor(v.qtd)
    if (!v.insumoId) return setErro('Escolha o insumo.')
    if (q === null || q < 0 || (v.tipo !== 'contagem' && q === 0)) return setErro('Coloque a quantidade.')
    if (v.tipo === 'perda' && !v.obs.trim()) return setErro('Diga o motivo da perda.')
    if (v.tipo === 'transferencia' && !v.destino) return setErro('Escolha a loja que recebe.')
    setSalvando(true)
    try {
      const base = { insumoId: v.insumoId, data: v.data, observacao: v.obs || null }
      if (v.tipo === 'contagem') {
        const dif = r2(q - atual)
        if (Math.abs(dif) > 0.0001) await store.lancarMovimentoEstoque({ ...base, centroCustoId: centro, tipo: 'ajuste', quantidade: dif, observacao: v.obs || `Contagem: ${mostrarQtd(q)} ${ins?.unidade ?? ''}` })
      } else if (v.tipo === 'transferencia') {
        await store.lancarMovimentoEstoque([
          { ...base, centroCustoId: centro, tipo: 'transferencia', quantidade: -q, observacao: v.obs || `Para ${nomeCentro(c.centros.find((x) => x.id === v.destino))}` },
          { ...base, centroCustoId: v.destino, tipo: 'transferencia', quantidade: q, custoUnit: ins?.preco ?? null, observacao: v.obs || `De ${nomeCentro(c.centros.find((x) => x.id === centro))}` },
        ])
      } else {
        await store.lancarMovimentoEstoque({ ...base, centroCustoId: centro, tipo: v.tipo, quantidade: v.tipo === 'entrada' ? q : -q, custoUnit: v.tipo === 'entrada' ? ins?.preco ?? null : null })
      }
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }
  return (
    <Modal titulo={`Movimento · ${nomeCentro(c.centros.find((x) => x.id === centro))}`} aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {TIPOS_MOV.map((t) => (
            <button key={t.valor} onClick={() => setV({ ...v, tipo: t.valor })}
              className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${v.tipo === t.valor ? 'bg-carvao text-white ring-carvao' : 'bg-white text-stone-600 ring-stone-300'}`}>
              {t.nome}
            </button>
          ))}
        </div>
        <p className="text-sm text-stone-500">{TIPOS_MOV.find((t) => t.valor === v.tipo)?.dica}</p>
        <Campo rotulo="Insumo">
          <select className={estiloEntrada} value={v.insumoId} onChange={(e) => setV({ ...v, insumoId: e.target.value })}>
            <option value="">Escolher</option>
            {c.insumos.filter((i) => i.ativo).map((i) => <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>)}
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo={v.tipo === 'contagem' ? `Quanto tem (${ins?.unidade ?? ''})` : `Quantidade (${ins?.unidade ?? ''})`}
            dica={v.insumoId ? `No sistema: ${mostrarQtd(atual)} ${ins?.unidade ?? ''}` : undefined}>
            <input inputMode="decimal" className={estiloEntrada} value={v.qtd} onChange={(e) => setV({ ...v, qtd: e.target.value })} />
          </Campo>
          <Campo rotulo="Data"><input type="date" className={estiloEntrada} value={v.data} onChange={(e) => setV({ ...v, data: e.target.value })} /></Campo>
        </div>
        {v.tipo === 'transferencia' && (
          <Campo rotulo="Loja que recebe">
            <select className={estiloEntrada} value={v.destino} onChange={(e) => setV({ ...v, destino: e.target.value })}>
              <option value="">Escolher</option>
              {c.centros.filter((x) => x.id !== centro).map((x) => <option key={x.id} value={x.id}>{nomeCentro(x)}</option>)}
            </select>
          </Campo>
        )}
        <Campo rotulo={v.tipo === 'perda' ? 'Motivo' : 'Observação'}><input className={estiloEntrada} value={v.obs} onChange={(e) => setV({ ...v, obs: e.target.value })} /></Campo>
        {erro && <p className="text-sm text-red-700">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
        </div>
      </div>
    </Modal>
  )
}

const NOME_TIPO: Record<MovimentoEstoque['tipo'], string> = {
  entrada_nf: 'Nota fiscal', entrada: 'Entrada', saida: 'Saída', perda: 'Perda', ajuste: 'Contagem', transferencia: 'Transferência',
}

function Movimentos() {
  const { store } = useApp()
  const { c, erro: erroCad } = useCadastros()
  const [movs, setMovs] = useState<MovimentoEstoque[] | null>(null)
  const [erro, setErro] = useState('')
  const [centro, setCentro] = useState('')
  const [mes, setMes] = useState(mesDe(hoje()))
  // Só o mês escolhido vem do banco.
  useEffect(() => {
    let vale = true
    setMovs(null)
    store.movimentosEstoque(primeiroDia(mes), ultimoDia(mes)).then((m) => vale && setMovs(m), (e) => vale && setErro(e.message))
    return () => { vale = false }
  }, [store, mes])
  if (erro || erroCad) return <Vazio>{erro || erroCad}</Vazio>
  if (!c) return <p className="text-stone-400">Carregando…</p>
  const meses = Array.from({ length: 18 }, (_, k) => addMeses(mesDe(hoje()), -k))
  const lista = (movs ?? []).filter((m) => !centro || m.centroCustoId === centro)
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Movimentos do estoque</h1>
      <div className="flex flex-wrap gap-2">
        <select className={`${estiloEntrada} w-auto!`} value={mes} onChange={(e) => setMes(e.target.value)}>
          {meses.map((m) => <option key={m} value={m}>{nomeMesAno(m)}</option>)}
        </select>
        <select className={`${estiloEntrada} w-auto!`} value={centro} onChange={(e) => setCentro(e.target.value)}>
          <option value="">Todas as lojas</option>
          {c.centros.map((x) => <option key={x.id} value={x.id}>{nomeCentro(x)}</option>)}
        </select>
      </div>
      {lista.length === 0 ? <Vazio>Nenhum movimento neste mês.</Vazio> : (
        <TabelaMovimentos lista={lista} c={c} />
      )}
    </div>
  )
}

function TabelaMovimentos({ lista, c }: { lista: MovimentoEstoque[]; c: NonNullable<ReturnType<typeof useCadastros>['c']> }) {
  const nomeIns = (m: MovimentoEstoque) => c.insumos.find((i) => i.id === m.insumoId)?.nome ?? ''
  const { ordenada, cabecalho } = useOrdem(lista, {
    data: (m) => m.data, insumo: nomeIns, tipo: (m) => (m.producaoId ? 'Produção' : NOME_TIPO[m.tipo]), qtd: (m) => m.quantidade,
    loja: (m) => nomeCentro(c.centros.find((x) => x.id === m.centroCustoId)),
  }, { col: 'data', desc: true })
  return (
    <Cartao className="overflow-x-auto p-0!">
      <table className="w-full text-sm">
        <thead className="bg-stone-50 text-left text-stone-500">
          <tr>{cabecalho('data', 'Data', '', true)}{cabecalho('insumo', 'Insumo')}{cabecalho('tipo', 'Tipo')}{cabecalho('qtd', 'Qtd', 'text-right', true)}{cabecalho('loja', 'Loja')}</tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {ordenada.map((m) => {
            const ins = c.insumos.find((i) => i.id === m.insumoId)
            return (
              <tr key={m.id}>
                <td className="px-3 py-2 whitespace-nowrap">{dataCurta(m.data)}</td>
                <td className="px-3 py-2">{ins?.nome ?? '—'}{m.observacao && <span className="block text-xs text-stone-400">{m.observacao}</span>}</td>
                <td className="px-3 py-2 whitespace-nowrap">{m.producaoId ? 'Produção' : NOME_TIPO[m.tipo]}</td>
                <td className={`px-3 py-2 text-right whitespace-nowrap ${m.quantidade < 0 ? 'text-red-700' : 'text-green-700'}`}>
                  {m.quantidade > 0 ? '+' : ''}{mostrarQtd(m.quantidade)} {ins?.unidade}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{nomeCentro(c.centros.find((x) => x.id === m.centroCustoId))}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Cartao>
  )
}
