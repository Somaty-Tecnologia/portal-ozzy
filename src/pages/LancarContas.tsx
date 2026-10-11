import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Botao, Campo, Modal, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { dataCurta, hoje, mesDe } from '../lib/datas'
import { contasLancaveis, dividir, lerValor, mostrarValor, nomeCentro, r2, reais, somarMeses } from '../lib/financeiro'
import { ir } from '../lib/rota'
import { soDigitos, type Store } from '../lib/store'
import { FORMAS_PAGAMENTO, type CentroCusto, type ContaContabil, type ContaPagar, type FormaPagamento, type Fornecedor, type NovaContaPagar } from '../lib/types'
import EscolherConta from '../components/EscolherConta'
import { useOrdem } from '../components/Ordenar'

export interface Dados { contas: ContaPagar[]; centros: CentroCusto[]; plano: ContaContabil[]; fornecedores: Fornecedor[] }

// Loja padrão de toda conta nova (Heitor, 09/10): Central de Produção.
export const lojaPadrao = (centros: CentroCusto[]) => (centros.some((c) => c.id === 'central') ? 'central' : centros[0]?.id ?? '')
const competenciaDe = (vencimento: string) => mesDe(vencimento) + '-01'
const simples = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

// Fornecedor pelo nome digitado (ou CNPJ). Se não existe, cadastra na hora.
export async function garantirFornecedor(store: Store, lista: Fornecedor[], texto: string, cnpj?: string | null): Promise<Fornecedor> {
  const t = simples(texto)
  const dig = soDigitos(cnpj ?? '') || (/^[\d./-]+$/.test(texto.trim()) ? soDigitos(texto) : '')
  const achado = (dig && lista.find((f) => f.cnpj && soDigitos(f.cnpj) === dig)) || lista.find((f) => simples(f.nome) === t)
  if (achado) return achado
  if (!t || (dig && t === dig)) throw new Error(`Fornecedor "${texto}" não está cadastrado. Coloque o nome.`)
  const novo = await store.salvarFornecedor({ nome: texto.trim(), contato: null, telefone: null, observacao: null, ativo: true, cnpj: dig || null })
  lista.push(novo)
  return novo
}

interface Parcela { vencimento: string; valor: string }
type Repeticao = 'unica' | 'parcelada' | 'mensal'

function gerarParcelas(rep: Repeticao, valor: number, vezes: number, venc: string): Parcela[] {
  if (rep === 'parcelada') return dividir(valor, vezes).map((x, i) => ({ vencimento: somarMeses(venc, i), valor: mostrarValor(x) }))
  return Array.from({ length: vezes }, (_, i) => ({ vencimento: somarMeses(venc, i), valor: mostrarValor(valor) }))
}

const vazio = (d: Dados, manter?: { centroCustoId: string; forma: FormaPagamento }) => ({
  centroCustoId: manter?.centroCustoId ?? lojaPadrao(d.centros),
  fornecedor: '',
  descricao: '',
  contaId: '',
  valor: '',
  vencimento: hoje(),
  forma: manter?.forma ?? ('boleto' as FormaPagamento),
  documento: '',
  repeticao: 'unica' as Repeticao,
  vezes: '2',
})

// Lançar ou editar uma conta a pagar. Feito para lançar muitas seguidas: Enter salva, "Salvar e lançar outra" mantém loja e forma.
export function EditarConta({ d, conta, aoFechar, aoSalvar }: { d: Dados; conta: ContaPagar | null; aoFechar: () => void; aoSalvar: () => void }) {
  const { store } = useApp()
  const nomeFornecedor = (id: string | null) => d.fornecedores.find((f) => f.id === id)?.nome ?? ''
  const [v, setV] = useState(() =>
    conta
      ? {
          centroCustoId: conta.centroCustoId, fornecedor: nomeFornecedor(conta.fornecedorId) || conta.favorecido || '', descricao: conta.descricao,
          contaId: conta.contaId ?? '', valor: mostrarValor(conta.valor), vencimento: conta.vencimento, forma: conta.forma,
          documento: conta.documento ?? '', repeticao: 'unica' as Repeticao, vezes: '2',
        }
      : vazio(d),
  )
  const [parcelas, setParcelas] = useState<Parcela[]>([])
  const [erro, setErro] = useState('')
  const [feitas, setFeitas] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)
  const descricaoRef = useRef<HTMLInputElement>(null)
  const vezes = Math.max(2, Math.min(60, Number(v.vezes) || 2))
  const total = lerValor(v.valor) ?? 0
  const repetindo = !conta && v.repeticao !== 'unica'

  // Refaz as parcelas quando muda o total, o número de vezes ou o 1º vencimento (as edições à mão se perdem nesse caso).
  useEffect(() => {
    if (repetindo) setParcelas(gerarParcelas(v.repeticao, total, vezes, v.vencimento))
  }, [repetindo, v.repeticao, total, vezes, v.vencimento])

  function mudarParcela(i: number, campo: keyof Parcela, valor: string) {
    const novas = parcelas.map((p, j) => (j === i ? { ...p, [campo]: valor } : p))
    // Parcelada: mexeu numa parcela do meio, a última fecha o total; mexeu na última, o total acompanha.
    if (campo === 'valor' && v.repeticao === 'parcelada' && novas.length > 1) {
      if (i < novas.length - 1) {
        const outras = novas.slice(0, -1).reduce((s, p) => s + (lerValor(p.valor) ?? 0), 0)
        novas[novas.length - 1] = { ...novas[novas.length - 1], valor: mostrarValor(r2(total - outras)) }
      } else {
        setParcelas(novas)
        setV((x) => ({ ...x, valor: mostrarValor(r2(novas.reduce((s, p) => s + (lerValor(p.valor) ?? 0), 0))) }))
        return
      }
    }
    setParcelas(novas)
  }

  async function salvar(outra = false) {
    if (salvando) return
    const valor = lerValor(v.valor)
    if (!v.descricao.trim()) return setErro('Coloque uma descrição.')
    if (!v.fornecedor.trim()) return setErro('Coloque o fornecedor.')
    if (!v.contaId) return setErro('Escolha a conta contábil.')
    if (!valor || valor <= 0) return setErro('Coloque o valor.')
    if (!v.vencimento) return setErro('Coloque o vencimento.')
    if (!v.centroCustoId) return setErro('Escolha a loja.')
    if (repetindo) {
      if (parcelas.some((p) => !p.vencimento || !(lerValor(p.valor)! > 0))) return setErro('Confira o vencimento e o valor de cada parcela.')
      const soma = r2(parcelas.reduce((s, p) => s + (lerValor(p.valor) ?? 0), 0))
      if (v.repeticao === 'parcelada' && Math.abs(soma - valor) >= 0.01) return setErro(`As parcelas somam ${reais(soma)} e o total é ${reais(valor)}.`)
    }
    setSalvando(true)
    setErro('')
    try {
      const forn = await garantirFornecedor(store, d.fornecedores, v.fornecedor)
      const base: NovaContaPagar = {
        id: conta?.id, centroCustoId: v.centroCustoId, contaId: v.contaId, fornecedorId: forn.id, favorecido: null,
        descricao: v.descricao.trim(), competencia: competenciaDe(v.vencimento), vencimento: v.vencimento, valor, forma: v.forma,
        parcela: conta?.parcela ?? null, parcelas: conta?.parcelas ?? null, documento: v.documento.trim() || null,
        notaId: conta?.notaId ?? null, observacao: conta?.observacao ?? null,
      }
      const lista: NovaContaPagar[] = repetindo
        ? parcelas.map((p, i) => ({
            ...base, vencimento: p.vencimento, competencia: competenciaDe(p.vencimento), valor: lerValor(p.valor)!,
            ...(v.repeticao === 'parcelada' ? { parcela: i + 1, parcelas: parcelas.length } : {}),
          }))
        : [base]
      // Fornecedor sem conta de sempre: guarda esta para a próxima.
      if (!forn.contaPadraoId) {
        await store.salvarFornecedor({ ...forn, contaPadraoId: v.contaId }).catch(() => {})
        forn.contaPadraoId = v.contaId
      }
      await store.salvarContasPagar(lista)
      if (outra) {
        setFeitas((f) => [`${v.descricao.trim()} · ${reais(valor)}`, ...f])
        setV(vazio(d, { centroCustoId: v.centroCustoId, forma: v.forma }))
        setParcelas([])
        descricaoRef.current?.focus()
      } else aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }
  async function excluir() {
    if (!conta || !confirm('Excluir esta conta a pagar?')) return
    try {
      await store.excluirContaPagar(conta.id)
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }
  function fechar() {
    if (feitas.length) aoSalvar()
    else aoFechar()
  }

  // Enter salva (menos no campo do fornecedor, onde o Enter escolhe da lista); Ctrl+Enter salva de qualquer campo.
  function teclas(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter') return
    const alvo = e.target as HTMLElement
    const ctrl = e.ctrlKey || e.metaKey
    if (ctrl || (alvo.tagName === 'INPUT' && !alvo.getAttribute('list'))) {
      e.preventDefault()
      salvar(!conta && (ctrl ? e.shiftKey : false))
    }
  }

  const escolherFornecedor = (texto: string) => {
    const f = d.fornecedores.find((x) => simples(x.nome) === simples(texto))
    setV((x) => ({ ...x, fornecedor: texto, contaId: x.contaId || f?.contaPadraoId || '' }))
  }
  const somaParcelas = r2(parcelas.reduce((s, p) => s + (lerValor(p.valor) ?? 0), 0))

  return (
    <Modal titulo={conta ? 'Conta a pagar' : 'Nova conta a pagar'} aberto aoFechar={fechar}>
      <div className="space-y-3" onKeyDown={teclas}>
        {conta?.notaId && (
          <p className="rounded-xl bg-stone-100 p-2 text-sm">
            Veio de uma nota fiscal. <button className="font-semibold underline" onClick={() => ir('estoque/nota/' + conta.notaId)}>Abrir a nota</button>
          </p>
        )}
        {feitas.length > 0 && (
          <p className="rounded-xl bg-green-50 p-2 text-sm text-green-800">
            ✓ {feitas.length} {feitas.length === 1 ? 'lançada' : 'lançadas'}: {feitas[0]}
          </p>
        )}
        <Campo rotulo="Descrição">
          <input ref={descricaoRef} autoFocus className={estiloEntrada} value={v.descricao} placeholder="Ex.: Aluguel de outubro" onChange={(e) => setV({ ...v, descricao: e.target.value })} />
        </Campo>
        <Campo rotulo="Fornecedor" dica={v.fornecedor.trim() && !d.fornecedores.some((f) => simples(f.nome) === simples(v.fornecedor)) ? 'Novo: vai ser cadastrado ao salvar.' : undefined}>
          <input list="fornecedores-conta" className={estiloEntrada} value={v.fornecedor} placeholder="Comece a digitar" onChange={(e) => escolherFornecedor(e.target.value)} />
          <datalist id="fornecedores-conta">
            {d.fornecedores.filter((f) => f.ativo).map((f) => <option key={f.id} value={f.nome} />)}
          </datalist>
        </Campo>
        <Campo rotulo="Conta contábil">
          <EscolherConta plano={d.plano} valor={v.contaId} aoMudar={(id) => setV({ ...v, contaId: id })} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo={v.repeticao === 'parcelada' && !conta ? 'Valor total (R$)' : 'Valor (R$)'}>
            <input inputMode="decimal" className={estiloEntrada} value={v.valor} placeholder="0,00" onChange={(e) => setV({ ...v, valor: e.target.value })} />
          </Campo>
          <Campo rotulo={repetindo ? '1º vencimento' : 'Vencimento'}>
            <input type="date" className={estiloEntrada} value={v.vencimento} onChange={(e) => setV({ ...v, vencimento: e.target.value })} />
          </Campo>
          <Campo rotulo="Forma de pagamento">
            <select className={estiloEntrada} value={v.forma} onChange={(e) => setV({ ...v, forma: e.target.value as FormaPagamento })}>
              {FORMAS_PAGAMENTO.map((f) => <option key={f.valor} value={f.valor}>{f.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Loja">
            <select className={estiloEntrada} value={v.centroCustoId} onChange={(e) => setV({ ...v, centroCustoId: e.target.value })}>
              {d.centros.map((x) => <option key={x.id} value={x.id}>{nomeCentro(x)}</option>)}
            </select>
          </Campo>
        </div>
        <Campo rotulo="Documento (opcional)">
          <input className={estiloEntrada} value={v.documento} placeholder="NF, boleto, chave Pix ou observação" onChange={(e) => setV({ ...v, documento: e.target.value })} />
        </Campo>
        {!conta && (
          <div className="space-y-2 rounded-xl bg-stone-50 p-3">
            <div className="flex flex-wrap gap-1">
              {([['unica', 'Uma vez'], ['parcelada', 'Parcelada'], ['mensal', 'Repete todo mês']] as const).map(([id, nome]) => (
                <button key={id} type="button" onClick={() => setV({ ...v, repeticao: id })}
                  className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${v.repeticao === id ? 'bg-carvao text-white ring-carvao' : 'bg-white text-stone-600 ring-stone-300'}`}>
                  {nome}
                </button>
              ))}
            </div>
            {repetindo && (
              <>
                <label className="flex items-center gap-2 text-sm">
                  {v.repeticao === 'parcelada' ? 'Em' : 'Por'}
                  <input inputMode="numeric" className={`${estiloEntrada} w-16! py-1!`} value={v.vezes} onChange={(e) => setV({ ...v, vezes: e.target.value })} />
                  {v.repeticao === 'parcelada' ? 'parcelas. Dá para mudar o valor e a data de cada uma.' : 'meses (aluguel, internet, sistema…)'}
                </label>
                <div className="space-y-1">
                  {parcelas.map((p, i) => (
                    <div key={i} className="grid grid-cols-[2rem_1fr_7rem] items-center gap-2">
                      <span className="text-sm text-stone-500">{i + 1}ª</span>
                      <input type="date" aria-label={`Vencimento da parcela ${i + 1}`} className={`${estiloEntrada} py-1!`} value={p.vencimento} onChange={(e) => mudarParcela(i, 'vencimento', e.target.value)} />
                      <input inputMode="decimal" aria-label={`Valor da parcela ${i + 1}`} className={`${estiloEntrada} py-1! text-right`} value={p.valor} onChange={(e) => mudarParcela(i, 'valor', e.target.value)} />
                    </div>
                  ))}
                </div>
                <p className={`text-right text-sm ${v.repeticao === 'parcelada' && Math.abs(somaParcelas - total) >= 0.01 ? 'font-semibold text-red-700' : 'text-stone-500'}`}>
                  Soma {reais(somaParcelas)}{v.repeticao === 'parcelada' && Math.abs(somaParcelas - total) >= 0.01 ? ` (total ${reais(total)})` : ''}
                </p>
              </>
            )}
          </div>
        )}
        {conta?.pagoEm && <p className="text-sm text-green-700">Paga em {dataCurta(conta.pagoEm)} ({reais(conta.valorPago ?? conta.valor)}).</p>}
        {erro && <p className="text-sm text-red-700">{erro}</p>}
        <div className="flex flex-wrap justify-between gap-2">
          {conta && !conta.notaId ? <Botao variante="perigo" onClick={excluir}>Excluir</Botao> : <span />}
          <div className="flex flex-wrap justify-end gap-2">
            <Botao variante="secundario" onClick={fechar}>{feitas.length ? 'Fechar' : 'Cancelar'}</Botao>
            {!conta && <Botao variante="secundario" onClick={() => salvar(true)} disabled={salvando}>Salvar e lançar outra</Botao>}
            <Botao onClick={() => salvar()} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
          </div>
        </div>
        <p className="hidden text-xs text-stone-400 sm:block">
          Enter salva{!conta && ' · Ctrl+Shift+Enter salva e abre outra'} · Esc fecha
        </p>
        {conta?.notaId && <p className="text-xs text-stone-500">Para tirar uma conta que veio da nota, desfaça o lançamento da nota.</p>}
      </div>
    </Modal>
  )
}

// ---------- Importar em lote ----------

export const COLUNAS_LOTE = ['Descrição', 'Fornecedor', 'Loja', 'Conta contábil', 'Valor', 'Vencimento', 'Forma', 'Documento', 'Pago em', 'Pessoa', 'Código'] as const

const APELIDOS_LOJA: Record<string, string> = {
  psd: 'burger-psd', 'parque sao domingos': 'burger-psd', un1: 'burger-psd',
  va: 'burger-va', 'vila anastacio': 'burger-va', un2: 'burger-va',
  pizza: 'pizza', 'the ozzy pizza': 'pizza', pizzaria: 'pizza',
  central: 'central', 'central de producao': 'central', producao: 'central',
  eventos: 'eventos', 'the ozzy eventos': 'eventos', evento: 'eventos',
}

function lerData(s: string) {
  const t = s.trim()
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (m) {
    const ano = m[3].length === 2 ? '20' + m[3] : m[3]
    const iso = `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    return Number.isNaN(Date.parse(iso)) ? null : iso
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? t : null
}

// Separa o texto colado do Excel (tabulação) ou um CSV (ponto e vírgula), respeitando aspas.
export function lerTabela(texto: string): string[][] {
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim())
  if (!linhas.length) return []
  const sep = linhas[0].includes('\t') ? '\t' : linhas[0].includes(';') ? ';' : ','
  return linhas.map((l) => {
    const cel: string[] = []
    let atual = ''
    let aspas = false
    for (let i = 0; i < l.length; i++) {
      const c = l[i]
      if (c === '"') {
        if (aspas && l[i + 1] === '"') { atual += '"'; i++ } else aspas = !aspas
      } else if (c === sep && !aspas) { cel.push(atual.trim()); atual = '' } else atual += c
    }
    cel.push(atual.trim())
    return cel
  })
}

interface LinhaLote {
  n: number
  descricao: string
  fornecedor: string
  centroCustoId: string
  contaId: string
  valor: number
  vencimento: string
  forma: FormaPagamento
  documento: string | null
  pagoEm: string | null
  pessoa: string
  codigo: string
  erros: string[]
}

function validarLote(tabela: string[][], d: Dados): LinhaLote[] {
  const temCabecalho = tabela.length && /descri/i.test(tabela[0][0] ?? '')
  const lanc = contasLancaveis(d.plano)
  return tabela.slice(temCabecalho ? 1 : 0).map((c, i) => {
    const [desc = '', forn = '', loja = '', conta = '', valor = '', venc = '', forma = '', doc = '', pago = '', pessoa = '', codigo = ''] = c
    const erros: string[] = []
    const lojaS = simples(loja)
    const centro = !lojaS ? lojaPadrao(d.centros)
      : APELIDOS_LOJA[lojaS] ?? d.centros.find((x) => x.id === lojaS || simples(x.nome) === lojaS || simples(nomeCentro(x)) === lojaS)?.id ?? ''
    if (!centro) erros.push(`loja "${loja}" não existe`)
    const contaS = simples(conta)
    const parecidas = contaS ? lanc.filter((x) => simples(x.nome).includes(contaS) || contaS.includes(simples(x.nome))) : []
    const cc = lanc.find((x) => x.codigo === conta.trim()) ?? lanc.find((x) => simples(x.nome) === contaS) ?? (parecidas.length === 1 ? parecidas[0] : undefined)
    if (!conta.trim()) erros.push('falta a conta contábil')
    else if (!cc) erros.push(`conta "${conta}" não existe (use o código, ex.: 4.1)`)
    const v = lerValor(valor.replace(/R\$\s*/i, ''))
    if (!v || v <= 0) erros.push('valor inválido')
    const vencimento = lerData(venc)
    if (!vencimento) erros.push('vencimento inválido (dd/mm/aaaa)')
    const formaS = simples(forma)
    const fp = !formaS ? 'boleto' : FORMAS_PAGAMENTO.find((f) => simples(f.nome) === formaS || f.valor === formaS || simples(f.nome).startsWith(formaS))?.valor
    if (!fp) erros.push(`forma "${forma}" não existe`)
    if (!desc.trim()) erros.push('falta a descrição')
    if (!forn.trim() && !pessoa.trim()) erros.push('falta o fornecedor')
    const pagoEm = pago.trim() ? lerData(pago) : null
    if (pago.trim() && !pagoEm) erros.push('data do pagamento inválida (dd/mm/aaaa)')
    return {
      n: i + 1 + (temCabecalho ? 1 : 0), descricao: desc.trim(), fornecedor: forn.trim(), centroCustoId: centro, contaId: cc?.id ?? '',
      valor: v ?? 0, vencimento: vencimento ?? '', forma: fp ?? 'boleto', documento: doc.trim() || null,
      pagoEm, pessoa: pessoa.trim(), codigo: codigo.trim(), erros,
    }
  })
}

export function baixarModeloLote() {
  const exemplo = ['Aluguel outubro', 'Imobiliária Exemplo', 'Central', '4.1', '3500,00', '10/11/2026', 'Boleto', '']
  const csv = '﻿' + [COLUNAS_LOTE.join(';'), exemplo.join(';')].join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = 'modelo-contas-a-pagar.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}

export function ImportarLote({ d, aoFechar, aoSalvar }: { d: Dados; aoFechar: () => void; aoSalvar: () => void }) {
  const { store } = useApp()
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const linhas = texto.trim() ? validarLote(lerTabela(texto), d) : []
  const boas = linhas.filter((l) => !l.erros.length)
  const pagas = boas.filter((l) => l.pagoEm).length
  const novos = [...new Set(boas.map((l) => l.fornecedor).filter((f) => f && !d.fornecedores.some((x) => simples(x.nome) === simples(f) || (x.cnpj && soDigitos(f) && soDigitos(x.cnpj) === soDigitos(f)))))]
  const { ordenada, cabecalho } = useOrdem(linhas, {
    n: (l) => l.n, conta: (l) => l.descricao, valor: (l) => l.valor || null, vence: (l) => l.vencimento,
  }, { col: 'n' })

  async function abrirArquivo(f: File | undefined) {
    if (!f) return
    const bytes = new Uint8Array(await f.arrayBuffer())
    let t = new TextDecoder('utf-8').decode(bytes)
    if (t.includes('�')) t = new TextDecoder('windows-1252').decode(bytes)
    setTexto(t)
  }

  async function importar() {
    if (!boas.length) return
    setSalvando(true)
    setErro('')
    try {
      const lista: NovaContaPagar[] = []
      for (const l of boas) {
        // Pessoa (funcionário, motoboy) não vira fornecedor: fica só o nome em "para quem".
        const forn = l.fornecedor ? await garantirFornecedor(store, d.fornecedores, l.fornecedor) : null
        lista.push({
          centroCustoId: l.centroCustoId, contaId: l.contaId, fornecedorId: forn?.id ?? null, favorecido: forn ? null : l.pessoa, descricao: l.descricao,
          competencia: competenciaDe(l.vencimento), vencimento: l.vencimento, valor: l.valor, forma: l.forma, parcela: null, parcelas: null,
          documento: l.documento, notaId: null, observacao: 'Importada em lote', pagoEm: l.pagoEm, valorPago: l.pagoEm ? l.valor : null,
          origem: l.codigo ? 'imp:' + l.codigo : null,
        })
      }
      await store.salvarContasPagar(lista)
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal titulo="Importar contas em lote" aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        <p className="text-sm text-stone-600">
          Copie as linhas da planilha (com ou sem o cabeçalho) e cole aqui, ou abra um arquivo CSV. Colunas, nesta ordem:
        </p>
        <p className="rounded-xl bg-stone-100 p-2 text-xs">
          <b>{COLUNAS_LOTE.join(' · ')}</b>
          <br />
          Loja: PSD, VA, Pizza, Central ou Eventos (vazio = Central). Conta: o código (ex.: 5.22) ou o nome. Vencimento: dd/mm/aaaa.
          Forma vazia = Boleto. Documento é opcional. Fornecedor novo é cadastrado sozinho.
          Opcionais: Pago em (a conta já entra paga), Pessoa (funcionário ou motoboy: deixe o fornecedor vazio) e Código (importar o mesmo código de novo não duplica).
        </p>
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-stone-600">Ver os códigos das contas</summary>
          <p className="mt-1 columns-2 gap-4 text-stone-600">
            {contasLancaveis(d.plano).map((x) => <span key={x.id} className="block">{x.codigo} {x.nome}</span>)}
          </p>
        </details>
        <div className="flex flex-wrap gap-2">
          <Botao variante="secundario" onClick={baixarModeloLote}>Baixar planilha modelo</Botao>
          <label className="cursor-pointer rounded-xl bg-white px-4 py-2 text-sm font-semibold ring-1 ring-stone-300 hover:bg-stone-50">
            Abrir CSV
            <input type="file" accept=".csv,.txt,text/csv" className="hidden" onChange={(e) => abrirArquivo(e.target.files?.[0])} />
          </label>
        </div>
        <textarea className={`${estiloEntrada} h-32 font-mono text-xs`} placeholder="Cole aqui (Ctrl+V)" value={texto} onChange={(e) => setTexto(e.target.value)} />
        {linhas.length > 0 && (
          <div className="max-h-64 overflow-auto rounded-xl ring-1 ring-stone-200">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-stone-100 text-left text-stone-500">
                <tr>{cabecalho('n', '#', 'px-2! py-1!')}{cabecalho('conta', 'Conta', 'px-2! py-1!')}{cabecalho('valor', 'Valor', 'px-2! py-1! text-right', true)}{cabecalho('vence', 'Vence', 'px-2! py-1!', true)}</tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {ordenada.map((l) => (
                  <tr key={l.n} className={l.erros.length ? 'bg-red-50' : ''}>
                    <td className="px-2 py-1 align-top text-stone-400">{l.n}</td>
                    <td className="px-2 py-1">
                      <p className="font-semibold">{l.descricao || '—'}</p>
                      <p className="text-stone-500">{[l.fornecedor || l.pessoa, nomeCentro(d.centros.find((x) => x.id === l.centroCustoId)), d.plano.find((x) => x.id === l.contaId)?.nome].filter(Boolean).join(' · ')}</p>
                      {l.erros.length > 0 && <p className="font-semibold text-red-700">{l.erros.join('; ')}</p>}
                    </td>
                    <td className="px-2 py-1 text-right align-top whitespace-nowrap">{l.valor ? reais(l.valor) : ''}</td>
                    <td className="px-2 py-1 align-top whitespace-nowrap">{l.vencimento ? dataCurta(l.vencimento) : ''}{l.pagoEm ? <span className="block text-green-700">paga {dataCurta(l.pagoEm)}</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {linhas.length > 0 && (
          <p className="text-sm">
            {boas.length} de {linhas.length} {linhas.length === 1 ? 'linha pronta' : 'linhas prontas'} · {reais(boas.reduce((s, l) => s + l.valor, 0))}
            {boas.length < linhas.length && <span className="text-red-700"> · as linhas em vermelho ficam de fora</span>}
            {pagas > 0 && <span className="text-stone-500"> · {pagas} já {pagas === 1 ? 'paga' : 'pagas'}</span>}
            {novos.length > 0 && <span className="text-stone-500"> · {novos.length} {novos.length === 1 ? 'fornecedor novo' : 'fornecedores novos'}</span>}
          </p>
        )}
        {erro && <p className="text-sm text-red-700">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao onClick={importar} disabled={salvando || !boas.length}>{salvando ? 'Lançando…' : `Lançar ${boas.length || ''} ${boas.length === 1 ? 'conta' : 'contas'}`}</Botao>
        </div>
      </div>
    </Modal>
  )
}
