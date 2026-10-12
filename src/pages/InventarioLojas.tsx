import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Botao, Campo, Cartao, Vazio, estiloEntrada } from '../components/ui'
import { agruparPorCategoria } from '../lib/categorias'
import { useApp } from '../lib/contexto'
import { addDias, dataCurta, diaSemana, hoje } from '../lib/datas'
import { lerValor, mostrarQtd, nomeCentro, reais } from '../lib/financeiro'
import { podeGerenciar } from '../lib/permissoes'
import type { CentroCusto, Insumo, InventarioEstoque, ItemContagem } from '../lib/types'
import { criarReconhecedor, lerContagem } from '../lib/voz'

// Inventário semanal (Heitor, 12/10): toda segunda cada loja conta todos os materiais ativos, pode ser falando.
// Material escondido na Eclética fica inativo no portal e não aparece. O que ficar em branco não mexe no estoque;
// o que for contado vira ajuste (contado − sistema) no estoque daquela loja. Enviar de novo no mesmo dia substitui.

const numTexto = (n: number | null) => (n === null ? '' : String(n).replace('.', ','))
// Segunda-feira desta semana (ou hoje, se for segunda).
const segundaDaSemana = () => {
  const d = new Date(hoje() + 'T12:00:00')
  return addDias(hoje(), -((d.getDay() + 6) % 7))
}
const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
// Só material ativo e marcado "Controla estoque" em Cadastros › Materiais (Heitor, 12/10).
const entraNoInventario = (i: Insumo) => i.ativo && i.controlaEstoque !== false && i.categoria !== 'Observações do PDV'

export default function InventarioLojas() {
  const { store, eu } = useApp()
  const [centros, setCentros] = useState<CentroCusto[] | null>(null)
  const [centro, setCentro] = useState('')
  const [data, setData] = useState(segundaDaSemana)
  useEffect(() => {
    store.centrosCusto().then((cs) => {
      // Inventário das lojas e da Central; Eventos tem a contagem própria (Eventos › Estoque da base).
      const lista = cs.filter((c) => c.id !== 'eventos')
      setCentros(lista)
      setCentro((atual) => atual || (lista.some((c) => c.id === eu.unidadeId) ? eu.unidadeId! : lista[0]?.id ?? ''))
    })
  }, [store, eu.unidadeId])
  if (!centros) return <p className="text-stone-400">Carregando…</p>

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500">Toda segunda, conte tudo o que tem na loja. Pode falar a contagem. Item em branco não muda o estoque; o que for contado corrige o saldo do sistema.</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-wrap rounded-xl bg-white p-1 ring-1 ring-stone-200">
          {centros.map((c) => (
            <button key={c.id} onClick={() => setCentro(c.id)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${centro === c.id ? 'bg-carvao text-white' : 'text-stone-600'}`}>{nomeCentro(c)}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-stone-600">
          Dia da contagem
          <input type="date" value={data} max={hoje()} onChange={(e) => e.target.value && setData(e.target.value)} className={`${estiloEntrada} w-40!`} />
        </label>
      </div>
      {centro && <TelaInventario key={`${centro}|${data}`} centro={centro} nomeLoja={nomeCentro(centros.find((c) => c.id === centro))} data={data} aoTrocarData={setData} />}
    </div>
  )
}

function TelaInventario({ centro, nomeLoja, data, aoTrocarData }: { centro: string; nomeLoja: string; data: string; aoTrocarData: (d: string) => void }) {
  const { store, eu, avisar, nomeDe } = useApp()
  const gestao = podeGerenciar(eu.nivel)
  const [insumos, setInsumos] = useState<Insumo[] | null>(null)
  const [saldos, setSaldos] = useState<Map<string, number> | null>(null)
  const [historico, setHistorico] = useState<InventarioEstoque[]>([])
  const [erro, setErro] = useState('')
  const [cont, setCont] = useState<Record<string, string>>({})
  const [responsavel, setResponsavel] = useState(eu.nome.split(' ')[0])
  const [obs, setObs] = useState('')
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [soFalta, setSoFalta] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [fala, setFala] = useState('')
  const [parcial, setParcial] = useState('')
  const [ouvindo, setOuvindo] = useState(false)
  const [naoEntendi, setNaoEntendi] = useState<string[]>([])
  const [destaque, setDestaque] = useState<Set<string>>(new Set())
  const rec = useRef<ReturnType<typeof criarReconhecedor>>(null)
  const suportaVoz = typeof window !== 'undefined' && !!((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition)

  const carregar = useCallback(async () => {
    try {
      const [ins, hist] = await Promise.all([store.insumos(), store.inventariosEstoque(centro)])
      setInsumos(ins.filter(entraNoInventario).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
      setHistorico(hist)
      const feito = hist.find((h) => h.data === data)
      if (feito) {
        setCont(Object.fromEntries(feito.itens.map((i) => [i.insumoId, numTexto(i.quantidade)])))
        setResponsavel(feito.responsavel ?? '')
        setObs(feito.observacao ?? '')
        setFala(feito.fala ?? '')
      }
      // O saldo do sistema só a gestão vê (o estoque é dela); quem conta não precisa saber para não "puxar" o número.
      if (gestao) setSaldos(new Map((await store.saldosEstoque(centro)).map((s) => [s.insumoId, s.quantidade])))
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [store, centro, data, gestao])
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => () => rec.current?.stop(), [])

  const feito = historico.find((h) => h.data === data) ?? null
  // Depois de enviado, o saldo atual já tem o ajuste: a diferença certa é contra o que o sistema tinha na hora.
  const sistema = (id: string) => {
    const antes = feito?.itens.find((i) => i.insumoId === id)
    if (antes) return antes.saldoSistema
    return saldos ? saldos.get(id) ?? 0 : null
  }

  const itensVoz: ItemContagem[] = useMemo(() => (insumos ?? []).map((i) => ({ chave: i.id, nome: i.nome, categoria: i.categoria, unidade: i.unidade, embalagem: i.embalagem, embalagemQtd: i.embalagemQtd })), [insumos])
  const ler = (texto: string) => {
    const r = lerContagem(texto, itensVoz)
    if (r.lidos.length) {
      setCont((v) => ({ ...v, ...Object.fromEntries(r.lidos.map((l) => [l.chave, numTexto(l.quantidade)])) }))
      setDestaque(new Set(r.lidos.map((l) => l.chave)))
    }
    setNaoEntendi(r.naoEntendi)
  }
  const ouvir = () => {
    if (ouvindo) return rec.current?.stop()
    const r = criarReconhecedor()
    if (!r) return
    rec.current = r
    let acumulado = fala ? fala + ', ' : ''
    r.onresult = (ev) => {
      let interino = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i]
        if (res.isFinal) {
          acumulado += res[0].transcript.trim() + ', '
          setFala(acumulado.replace(/, $/, ''))
          ler(acumulado)
        } else interino += res[0].transcript
      }
      setParcial(interino)
    }
    r.onerror = (ev) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') avisar('O navegador não deixou usar o microfone. Libere o microfone para este site ou digite.')
      else if (ev.error !== 'no-speech' && ev.error !== 'aborted') avisar('Não consegui ouvir: ' + ev.error)
    }
    r.onend = () => {
      setOuvindo(false)
      setParcial('')
    }
    r.start()
    setOuvindo(true)
  }

  if (erro) return <p className="text-red-700">{erro}</p>
  if (!insumos) return <p className="text-stone-400">Carregando…</p>
  if (!insumos.length) return <Vazio>Nenhum material ativo no cadastro.</Vazio>

  const contados = insumos.filter((i) => lerValor(cont[i.id] ?? '') !== null)
  const termo = busca.trim().toLowerCase()
  const categorias = [...new Set(insumos.map((i) => i.categoria || 'Outros'))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const visiveis = insumos.filter((i) => (!termo || i.nome.toLowerCase().includes(termo) || i.ecleticaCodigo === termo) && (!categoria || (i.categoria || 'Outros') === categoria) && (!soFalta || lerValor(cont[i.id] ?? '') === null))
  const diferenca = (i: Insumo) => {
    const c = lerValor(cont[i.id] ?? '')
    const s = sistema(i.id)
    return c === null || s === null ? null : Math.round((c - s) * 1000) / 1000
  }
  const valorDif = contados.reduce((t, i) => t + (diferenca(i) ?? 0) * (i.preco ?? 0), 0)

  const enviar = async () => {
    if (!contados.length) return avisar('Conte pelo menos um item.')
    const faltam = insumos.length - contados.length
    if (faltam > 0 && !confirm(`${faltam} ${faltam === 1 ? 'item ficou' : 'itens ficaram'} em branco e não ${faltam === 1 ? 'muda' : 'mudam'} o estoque. Enviar assim?`)) return
    setSalvando(true)
    try {
      await store.enviarInventario({
        centroCustoId: centro, data, responsavel, observacao: obs, fala,
        itens: contados.map((i) => ({ insumoId: i.id, quantidade: Math.max(0, lerValor(cont[i.id] ?? '') ?? 0) })),
      })
      avisar(feito ? 'Inventário atualizado' : 'Inventário enviado')
      await carregar()
    } catch (e) {
      avisar((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  const imprimir = () => {
    const w = window.open('', '_blank')
    if (!w) return avisar('O navegador bloqueou a janela de impressão.')
    const linhas = agruparPorCategoria(insumos).map(([cat, l]) => `<tr><th colspan="3">${esc(cat)}</th></tr>` + l.map((i) => `<tr><td>${esc(i.nome)}</td><td>${i.unidade}</td><td class="q"></td></tr>`).join('')).join('')
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Inventário ${esc(nomeLoja)} ${dataCurta(data)}</title><style>body{font:12px system-ui;margin:16px}h1{font-size:15px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #999;padding:3px 4px;text-align:left}th{padding-top:10px;border-bottom:2px solid #000}.q{width:90px}</style><h1>Inventário ${esc(nomeLoja)} · ${diaSemana(data).toLowerCase()} ${dataCurta(data)}</h1><table>${linhas}</table>`)
    w.document.close()
    w.print()
  }

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl px-4 py-3 text-sm ${feito ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'}`}>
        Inventário de <b>{diaSemana(data).toLowerCase()}, {dataCurta(data)}</b>.{' '}
        {feito
          ? <>Enviado {new Date(feito.enviadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}{feito.enviadoPor ? ` por ${nomeDe(feito.enviadoPor)}` : ''}. Se corrigir algo, envie de novo: substitui o anterior.</>
          : 'Ainda não enviado.'}
      </div>

      <Cartao>
        <div className="flex flex-wrap items-center gap-3">
          {suportaVoz ? (
            <button onClick={ouvir} aria-label={ouvindo ? 'Parar de ouvir' : 'Contar falando'}
              className={`flex h-14 items-center gap-2 rounded-full px-5 font-bold text-white ${ouvindo ? 'animate-pulse bg-red-600' : 'bg-carvao'}`}>
              <span aria-hidden className="text-xl">🎤</span> {ouvindo ? 'Ouvindo… toque para parar' : 'Contar falando'}
            </button>
          ) : (
            <p className="text-sm text-stone-500">Este navegador não reconhece fala (o Firefox não tem). Digite abaixo ou use o Chrome (Android ou computador) ou o Safari (iPhone).</p>
          )}
          <p className="text-sm text-stone-600">Fale item e quantidade: <i>“bacon 3 quilos e meio, pão australiano 40, coca lata 2 fardos”</i>.</p>
        </div>
        {(fala || parcial) && (
          <div className="mt-3 rounded-xl bg-stone-50 p-3 text-sm">
            <p className="text-stone-700">{fala}{parcial && <span className="text-stone-400"> {parcial}</span>}</p>
            {naoEntendi.length > 0 && <p className="mt-1 text-amber-800">Não entendi: {naoEntendi.join(', ')}. Confira na lista.</p>}
            <button className="mt-1 text-xs font-semibold text-stone-500 underline" onClick={() => { setFala(''); setNaoEntendi([]); setDestaque(new Set()) }}>Limpar o texto</button>
          </div>
        )}
      </Cartao>

      <div className="flex flex-wrap items-center gap-2">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar item ou código" className={`${estiloEntrada} max-w-xs py-2!`} />
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={`${estiloEntrada} w-auto! py-2!`} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {categorias.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input type="checkbox" checked={soFalta} onChange={(e) => setSoFalta(e.target.checked)} /> Só o que falta contar
        </label>
        <span className="text-sm text-stone-500">{contados.length} de {insumos.length} contados</span>
        <button onClick={imprimir} className="ml-auto text-sm font-semibold text-stone-600 underline">Imprimir folha de contagem</button>
      </div>

      <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-stone-500">
          <span className="flex-1">Item</span>
          {gestao && <span className="hidden w-20 text-right sm:block">Sistema</span>}
          <span className="w-24 text-center">Contado</span>
          {gestao && <span className="w-20 text-right">Diferença</span>}
        </div>
        {agruparPorCategoria(visiveis).map(([cat, lista]) => (
          <div key={cat} className="divide-y divide-stone-100">
            <div className="bg-stone-50 px-3 py-1.5 text-xs font-bold tracking-wide text-stone-600 uppercase">{cat}</div>
            {lista.map((i) => {
              const s = sistema(i.id)
              const d = diferenca(i)
              return (
                <div key={i.id} className={`flex items-center gap-2 px-3 py-2 ${destaque.has(i.id) ? 'bg-ozzy-50' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{i.nome}</div>
                    <div className="truncate text-xs text-stone-500">{i.unidade}{i.ecleticaCodigo ? ` · cód. ${i.ecleticaCodigo}` : ''}{gestao && s !== null ? <span className="sm:hidden"> · sistema {mostrarQtd(s)}</span> : ''}</div>
                  </div>
                  {gestao && <span className="hidden w-20 text-right text-sm text-stone-500 sm:block">{s === null ? '' : mostrarQtd(s)}</span>}
                  <input inputMode="decimal" aria-label={`Quanto tem de ${i.nome}`} value={cont[i.id] ?? ''} onChange={(e) => setCont((v) => ({ ...v, [i.id]: e.target.value }))}
                    className={`${estiloEntrada} w-24! text-center`} />
                  {gestao && (
                    <span className={`w-20 text-right text-sm font-semibold ${d === null || d === 0 ? 'text-stone-400' : d < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                      {d === null ? '' : d === 0 ? 'ok' : `${d > 0 ? '+' : ''}${mostrarQtd(d)}`}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
        {visiveis.length === 0 && <p className="px-3 py-4 text-sm text-stone-500">Nada aqui.</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Quem contou"><input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={estiloEntrada} /></Campo>
        <Campo rotulo="Observação"><input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" className={estiloEntrada} /></Campo>
      </div>

      {historico.length > 0 && (
        <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
          <h3 className="mb-2 text-sm font-bold">Inventários anteriores · {nomeLoja}</h3>
          <div className="divide-y divide-stone-100 text-sm">
            {historico.map((h) => {
              const valor = h.itens.reduce((t, i) => t + (i.quantidade - i.saldoSistema) * (i.custoUnit ?? 0), 0)
              return (
                <button key={h.id} onClick={() => aoTrocarData(h.data)} className={`flex w-full items-center gap-2 py-1.5 text-left hover:bg-stone-50 ${h.data === data ? 'font-semibold' : ''}`}>
                  <span className="flex-1">{diaSemana(h.data)}, {dataCurta(h.data)}{h.responsavel ? ` · ${h.responsavel}` : ''}</span>
                  <span className="text-stone-500">{h.itens.length} itens</span>
                  {gestao && <span className={`w-28 text-right ${valor < 0 ? 'text-red-700' : 'text-stone-600'}`}>{reais(valor)}</span>}
                </button>
              )
            })}
          </div>
          {gestao && <p className="mt-2 text-xs text-stone-500">Valor = diferença entre o contado e o sistema, pelo preço do cadastro. Negativo = faltou mercadoria.</p>}
        </div>
      )}

      <div className="sticky bottom-2 z-10 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-stone-300">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex-1 text-sm text-stone-600">
            <b>{contados.length}</b> {contados.length === 1 ? 'item contado' : 'itens contados'}
            {gestao && contados.length > 0 && <> · diferença <b className={valorDif < 0 ? 'text-red-700' : ''}>{reais(valorDif)}</b></>}
          </span>
          <Botao onClick={enviar} disabled={salvando}>{salvando ? 'Enviando…' : feito ? 'Enviar de novo' : 'Enviar inventário'}</Botao>
        </div>
      </div>
    </div>
  )
}
