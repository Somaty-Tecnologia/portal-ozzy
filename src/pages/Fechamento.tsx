import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Botao, Cartao, Campo, Vazio, estiloEntrada } from '../components/ui'
import { agruparPorCategoria } from '../lib/categorias'
import { useApp } from '../lib/contexto'
import { addDias, dataCurta, diaSemana, hoje } from '../lib/datas'
import { lerValor, mostrarQtd } from '../lib/financeiro'
import { podeGerenciar } from '../lib/permissoes'
import { LOJAS_FECHAMENTO, type Fechamento as FechamentoT, type ItemContagem, type ItemFechamento, type SetorFechamento } from '../lib/types'
import { criarReconhecedor, lerContagem } from '../lib/voz'
import { esc, imprimirTermica } from '../lib/termica'
import Caixa from '../components/Caixa'

// Fechamento e pedido (Heitor, 09/10). No fim do turno a cozinha e o atendimento da PSD e da Vila contam o
// estoque (pode ser falando, lendo o papel), o portal sugere o pedido pelo estoque ideal do dia seguinte e a
// pessoa confirma ou ajusta. O pedido vai para a Central de Produção.

const NOME_LOJA: Record<string, string> = { 'burger-psd': 'Parque São Domingos', 'burger-va': 'Vila Anastácio' }
const SETORES: { valor: SetorFechamento; nome: string }[] = [{ valor: 'cozinha', nome: 'Cozinha' }, { valor: 'atendimento', nome: 'Atendimento' }]

// Depois da meia-noite o fechamento ainda é do dia anterior.
const dataPadrao = () => (new Date().getHours() < 5 ? addDias(hoje(), -1) : hoje())
const fracionado = (un: string) => /^(kg|lts?|l)$/i.test(un)
// Sugestão = ideal do dia seguinte menos o que tem, arredondada para cima (0,1 em kg e litro; inteiro no resto).
export const sugestaoPedido = (ideal: number | null, contagem: number | null, un: string) => {
  if (ideal === null || contagem === null) return null
  const falta = Math.max(0, ideal - contagem)
  return fracionado(un) ? Math.ceil(Math.round(falta * 1000) / 100) / 10 : Math.ceil(Math.round(falta * 1000) / 1000)
}
const numTexto = (n: number | null) => (n === null ? '' : String(n).replace('.', ','))
const unidadeVoz = (un: string): ItemContagem['unidade'] => (/^kg$/i.test(un) ? 'kg' : /^(lts?|l)$/i.test(un) ? 'l' : 'un')

export default function Fechamento() {
  const { eu } = useApp()
  const gestao = podeGerenciar(eu.nivel)
  const minhaLoja = LOJAS_FECHAMENTO.includes(eu.unidadeId as never) ? eu.unidadeId! : 'burger-psd'
  const [loja, setLoja] = useState(minhaLoja)
  const [setor, setSetor] = useState<SetorFechamento>(eu.setor === 'atendimento' ? 'atendimento' : 'cozinha')
  const [data, setData] = useState(dataPadrao)
  // Heitor (13/10): o caixa da loja fica junto do fechamento.
  const [aba, setAba] = useState<'pedido' | 'caixa'>('pedido')
  // Heitor (13/10): pedido para o dia seguinte (padrão) ou para o mesmo dia.
  const [hoje_, setHoje] = useState(false)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Fechamento e pedido</h1>
        <p className="text-sm text-stone-500">Conte o estoque no fim do turno. O portal sugere o pedido para a Central pelo estoque ideal de amanhã; confira e envie.</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {gestao && (
          <div className="flex rounded-xl bg-white p-1 ring-1 ring-stone-200">
            {LOJAS_FECHAMENTO.map((l) => (
              <button key={l} onClick={() => setLoja(l)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${loja === l ? 'bg-carvao text-white' : 'text-stone-600'}`}>{NOME_LOJA[l]}</button>
            ))}
          </div>
        )}
        <div className="flex rounded-xl bg-white p-1 ring-1 ring-stone-200">
          {([['pedido', 'Contagem e pedido'], ['caixa', 'Caixa']] as const).map(([a, nome]) => (
            <button key={a} onClick={() => setAba(a)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${aba === a ? 'bg-carvao text-white' : 'text-stone-600'}`}>{nome}</button>
          ))}
        </div>
        {aba === 'pedido' && <div className="flex rounded-xl bg-white p-1 ring-1 ring-stone-200">
          {SETORES.map((s) => (
            <button key={s.valor} onClick={() => setSetor(s.valor)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${setor === s.valor ? 'bg-carvao text-white' : 'text-stone-600'}`}>{s.nome}</button>
          ))}
        </div>}
        <label className="flex items-center gap-2 text-sm text-stone-600">
          Dia do fechamento
          <input type="date" value={data} max={addDias(hoje(), 1)} onChange={(e) => e.target.value && setData(e.target.value)} className={`${estiloEntrada} w-40!`} />
        </label>
      </div>
      {aba === 'pedido' && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-stone-600">Pedido para</span>
          <div className="flex rounded-xl bg-white p-1 ring-1 ring-stone-200">
            {([[false, `amanhã (${diaSemana(addDias(data, 1)).slice(0, 3).toLowerCase()} ${dataCurta(addDias(data, 1))})`], [true, `hoje (${diaSemana(data).slice(0, 3).toLowerCase()} ${dataCurta(data)})`]] as const).map(([h, nome]) => (
              <button key={String(h)} onClick={() => setHoje(h)} className={`rounded-lg px-3 py-1.5 font-semibold ${hoje_ === h ? 'bg-carvao text-white' : 'text-stone-600'}`}>{nome}</button>
            ))}
          </div>
        </div>
      )}
      {aba === 'caixa' ? <Caixa loja={loja} data={data} /> : <TelaFechamento key={`${loja}|${setor}|${data}|${hoje_}`} loja={loja} setor={setor} data={data} para={hoje_ ? data : addDias(data, 1)} />}
    </div>
  )
}

function TelaFechamento({ loja, setor, data, para }: { loja: string; setor: SetorFechamento; data: string; para: string }) {
  const { store, eu, avisar, nomeDe } = useApp()
  const [itens, setItens] = useState<ItemFechamento[] | null>(null)
  const [enviado, setEnviado] = useState<FechamentoT | null>(null)
  const [erro, setErro] = useState('')
  const [cont, setCont] = useState<Record<string, string>>({})
  const [ped, setPed] = useState<Record<string, string>>({})
  const [editado, setEditado] = useState<Set<string>>(new Set())
  const [responsavel, setResponsavel] = useState(eu.nome.split(' ')[0])
  const [obs, setObs] = useState('')
  const [busca, setBusca] = useState('')
  const [soFalta, setSoFalta] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [fala, setFala] = useState('')
  const [parcial, setParcial] = useState('')
  const [ouvindo, setOuvindo] = useState(false)
  const [naoEntendi, setNaoEntendi] = useState<string[]>([])
  const [destaque, setDestaque] = useState<Set<string>>(new Set())
  // Itens que alguém pediu para tirar da lista (esperando a gestão).
  const [paraTirar, setParaTirar] = useState<Map<string, string | null>>(new Map())
  const [paraIncluir, setParaIncluir] = useState<string[]>([])
  const rec = useRef<ReturnType<typeof criarReconhecedor>>(null)
  const suportaVoz = typeof window !== 'undefined' && !!((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition)

  const carregar = useCallback(async () => {
    try {
      const [lista, fechs, tirar] = await Promise.all([store.listaFechamento(loja, setor, data, para), store.fechamentos(data, data), store.pedidosTirarFechamento().catch(() => [])])
      setParaTirar(new Map(tirar.filter((x) => x.setor === setor && x.tipo === 'tirar' && x.insumoId).map((x) => [x.insumoId!, x.motivo])))
      setParaIncluir(tirar.filter((x) => x.setor === setor && x.tipo === 'incluir').map((x) => x.nome))
      const f = fechs.find((x) => x.unidadeId === loja && x.setor === setor && x.para === para) ?? null
      setItens(lista)
      setEnviado(f)
      setCont(Object.fromEntries(lista.filter((i) => i.contagem !== null).map((i) => [i.itemId, numTexto(i.contagem)])))
      setPed(Object.fromEntries(lista.filter((i) => i.pedido !== null).map((i) => [i.itemId, numTexto(i.pedido)])))
      // O que já foi enviado conta como conferido (não muda sozinho ao mexer na contagem).
      setEditado(new Set(f ? lista.map((i) => i.itemId) : []))
      if (f) {
        setResponsavel(f.responsavel ?? '')
        setObs(f.observacao ?? '')
        setFala(f.fala ?? '')
      }
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [store, loja, setor, data, para])
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => () => rec.current?.stop(), [])

  const porId = useMemo(() => new Map((itens ?? []).map((i) => [i.itemId, i])), [itens])
  const sugestao = (i: ItemFechamento, c = cont[i.itemId]) => sugestaoPedido(i.ideal, lerValor(c ?? ''), i.unidadeContagem)

  const mudarContagem = (valores: Record<string, string>) => {
    setCont((v) => ({ ...v, ...valores }))
    setPed((p) => {
      const n = { ...p }
      for (const [id, c] of Object.entries(valores)) {
        const i = porId.get(id)
        if (!i || editado.has(id)) continue
        const s = sugestao(i, c)
        n[id] = s ? numTexto(s) : ''
      }
      return n
    })
  }

  const itensVoz: ItemContagem[] = useMemo(() => (itens ?? []).map((i) => ({ chave: i.itemId, nome: i.nome, categoria: null, unidade: unidadeVoz(i.unidadeContagem), embalagem: null, embalagemQtd: null })), [itens])
  const ler = (texto: string) => {
    const r = lerContagem(texto, itensVoz)
    if (r.lidos.length) {
      mudarContagem(Object.fromEntries(r.lidos.map((l) => [l.chave, numTexto(l.quantidade)])))
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
  if (!itens) return <p className="text-stone-400">Carregando…</p>
  if (!itens.length) return <Vazio>Esta loja ainda não tem lista de {setor}. A gestão monta em Produção › Listas.</Vazio>

  const pedirTirar = async (i: ItemFechamento) => {
    const motivo = prompt(`Pedir para tirar "${i.nome}" da lista? A gestão aprova ou nega.\nPor quê? (ex.: não usamos mais)`)
    if (motivo === null) return
    try {
      await store.pedirTirarFechamento({ unidadeId: loja, setor, insumoId: i.insumoId, motivo })
      setParaTirar((m) => new Map(m).set(i.insumoId, motivo.trim() || null))
      avisar('Pedido enviado para a gestão')
    } catch (e) { avisar((e as Error).message) }
  }
  const pedirIncluir = async () => {
    const nome = prompt('Qual item falta na lista? A gestão aprova ou nega.')?.trim()
    if (!nome) return
    const motivo = prompt(`Por que incluir "${nome}"? (opcional)`) ?? ''
    try {
      await store.pedirIncluirFechamento({ unidadeId: loja, setor, nome, motivo })
      setParaIncluir((l) => [...l, nome])
      avisar('Pedido enviado para a gestão')
    } catch (e) { avisar((e as Error).message) }
  }
  const titulo = `${setor === 'cozinha' ? 'Cozinha' : 'Atendimento'} · ${NOME_LOJA[loja]}`
  // Lista em branco para contar no papel, sempre com os itens de hoje (Heitor, 13/10).
  const imprimirLista = () => imprimirTermica(`Fechamento ${titulo}`,
    `<h1>Fechamento ${esc(titulo)}</h1><div class="sub">${esc(diaSemana(data))} ${dataCurta(data)} · pedido para ${esc(diaSemana(para).toLowerCase())}</div><div class="sub">Quem contou: ____________________</div>`
    + agruparPorCategoria(itens.filter((i) => !paraTirar.has(i.insumoId))).map(([cat, l]) => `<div class="cat">${esc(cat)}</div>`
      + l.map((i) => `<div class="l"><span class="n">${esc(i.nome)} <span class="u">(${esc(i.unidadeContagem)})</span></span><span class="campo">tem ______</span></div>`).join('')).join(''))
  const imprimirPedido = () => imprimirTermica(`Pedido ${titulo}`,
    `<h1>Pedido ${esc(titulo)}</h1><div class="sub">Para ${esc(diaSemana(para).toLowerCase())} ${dataCurta(para)}${responsavel ? ` · ${esc(responsavel)}` : ''}</div>`
    + agruparPorCategoria(pedidos).map(([cat, l]) => `<div class="cat">${esc(cat)}</div>`
      + l.map((i) => `<div class="l"><span class="n">${esc(i.nome)}</span><span class="q">${esc(ped[i.itemId] ?? '')} ${esc(i.unidadeContagem)}</span></div>`).join('')).join('')
    + (obs ? `<div class="fim">Obs.: ${esc(obs)}</div>` : ''))

  const contados = itens.filter((i) => lerValor(cont[i.itemId] ?? '') !== null)
  const pedidos = itens.filter((i) => (lerValor(ped[i.itemId] ?? '') ?? 0) > 0)
  const termo = busca.trim().toLowerCase()
  const visiveis = itens.filter((i) => (!termo || i.nome.toLowerCase().includes(termo)) && (!soFalta || lerValor(cont[i.itemId] ?? '') === null))

  const textoWhats = () => [
    `*Pedido ${setor === 'cozinha' ? 'Cozinha' : 'Atendimento'} ${NOME_LOJA[loja]}* para ${diaSemana(para).toLowerCase()} ${dataCurta(para)}`,
    responsavel ? `Responsável: ${responsavel}` : '',
    '',
    ...pedidos.map((i) => `${i.nome}: ${ped[i.itemId]} ${i.unidadeContagem}`),
    obs ? `\nObs.: ${obs}` : '',
  ].filter((l, k) => l !== '' || k === 2).join('\n')

  const enviar = async () => {
    const faltam = itens.filter((i) => !paraTirar.has(i.insumoId)).length - contados.filter((i) => !paraTirar.has(i.insumoId)).length
    if (faltam > 0 && !confirm(`${faltam} ${faltam === 1 ? 'item ficou' : 'itens ficaram'} sem contagem. Enviar assim?`)) return
    // Heitor (13/10): um botão só: envia para a produção e já abre o WhatsApp com o pedido (por enquanto vai no grupo também).
    // A janela abre no clique (senão o celular bloqueia) e recebe o endereço depois que salvou.
    const zap = pedidos.length ? window.open('', '_blank') : null
    setSalvando(true)
    try {
      await store.enviarFechamento({
        unidadeId: loja, setor, data, para, responsavel, observacao: obs, fala,
        itens: itens.filter((i) => lerValor(cont[i.itemId] ?? '') !== null || (lerValor(ped[i.itemId] ?? '') ?? 0) > 0).map((i) => ({
          itemId: i.itemId, contagem: lerValor(cont[i.itemId] ?? ''), sugestao: sugestao(i), pedido: Math.max(0, lerValor(ped[i.itemId] ?? '') ?? 0) || null,
        })),
      })
      avisar(enviado ? 'Fechamento atualizado' : 'Fechamento enviado para a produção')
      if (zap) zap.location.href = `https://wa.me/?text=${encodeURIComponent(textoWhats())}`
      await carregar()
    } catch (e) {
      zap?.close()
      avisar((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl px-4 py-3 text-sm ${enviado ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'}`}>
        Pedido para <b>{diaSemana(para).toLowerCase()}, {dataCurta(para)}</b>.{' '}
        {enviado
          ? <>Enviado {new Date(enviado.enviadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}{enviado.enviadoPor ? ` por ${nomeDe(enviado.enviadoPor)}` : ''}. Se mudar algo, envie de novo.</>
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
            <p className="text-sm text-stone-500">Este navegador não reconhece fala. Digite abaixo ou use o Chrome (Android) ou o Safari (iPhone).</p>
          )}
          <p className="text-sm text-stone-600">Leia o papel: <i>“maionese verde 1 quilo e meio, alface 4, bacon 3, pão australiano 40”</i>.</p>
        </div>
        {(fala || parcial) && (
          <div className="mt-3 rounded-xl bg-stone-50 p-3 text-sm">
            <p className="text-stone-700">{fala}{parcial && <span className="text-stone-400"> {parcial}</span>}</p>
            {naoEntendi.length > 0 && <p className="mt-1 text-amber-800">Não entendi: {naoEntendi.join(', ')}. Confira na lista.</p>}
            <button className="mt-1 text-xs font-semibold text-stone-500 underline" onClick={() => { setFala(''); setNaoEntendi([]); setDestaque(new Set()) }}>Limpar o texto</button>
          </div>
        )}
      </Cartao>

      <div className="flex flex-wrap items-center gap-3">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar item" className={`${estiloEntrada} max-w-xs`} />
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input type="checkbox" checked={soFalta} onChange={(e) => setSoFalta(e.target.checked)} /> Só o que falta contar
        </label>
        <span className="text-sm text-stone-500">{contados.length} de {itens.length} contados</span>
        <Botao variante="secundario" className="py-1.5! sm:ml-auto" onClick={imprimirLista}>🖨 Imprimir lista para contar</Botao>
      </div>

      <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-stone-500">
          <span className="flex-1">Item</span><span className="w-20 text-center">Tem</span><span className="w-20 text-center">Pedir</span>
        </div>
        {agruparPorCategoria(visiveis).map(([cat, lista]) => (
          <div key={cat} className="divide-y divide-stone-100">
            <div className="bg-stone-50 px-3 py-1.5 text-xs font-bold tracking-wide text-stone-600 uppercase">{cat}</div>
            {lista.map((i) => {
              const s = sugestao(i)
              const p = lerValor(ped[i.itemId] ?? '')
              return (
                <div key={i.itemId} className={`flex items-center gap-2 px-3 py-2 ${destaque.has(i.itemId) ? 'bg-ozzy-50' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{i.nome}</div>
                    <div className="truncate text-xs text-stone-500">
                      {i.unidadeContagem}{i.ideal !== null ? ` · ideal ${mostrarQtd(i.ideal)}` : ' · sem ideal'}
                      {s !== null && p !== s ? ` · sugestão ${mostrarQtd(s)}` : ''}
                      {paraTirar.has(i.insumoId)
                        ? <span className="font-semibold text-amber-700"> · pedido para tirar, esperando a gestão</span>
                        : <> · <button className="underline hover:text-red-700" onClick={() => pedirTirar(i)}>pedir para tirar</button></>}
                    </div>
                  </div>
                  <input inputMode="decimal" aria-label={`Quanto tem de ${i.nome}`} value={cont[i.itemId] ?? ''} onChange={(e) => mudarContagem({ [i.itemId]: e.target.value })}
                    className={`${estiloEntrada} w-20! text-center`} />
                  <input inputMode="decimal" aria-label={`Quanto pedir de ${i.nome}`} value={ped[i.itemId] ?? ''}
                    onChange={(e) => { setPed((v) => ({ ...v, [i.itemId]: e.target.value })); setEditado((x) => new Set(x).add(i.itemId)) }}
                    className={`${estiloEntrada} w-20! text-center ${(p ?? 0) > 0 ? 'font-bold ring-2 ring-carvao/40' : ''}`} />
                </div>
              )
            })}
          </div>
        ))}
        {visiveis.length === 0 && <p className="px-3 py-4 text-sm text-stone-500">Nada aqui.</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Botao variante="secundario" className="py-1.5!" onClick={pedirIncluir}>+ Pedir para incluir item</Botao>
        {paraIncluir.length > 0 && <span className="text-amber-700">Esperando a gestão: {paraIncluir.join(', ')}</span>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Quem contou">
          <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={estiloEntrada} />
        </Campo>
        <Campo rotulo="Observação para a produção">
          <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" className={estiloEntrada} />
        </Campo>
      </div>

      <div className="sticky bottom-2 z-10 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-stone-300">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex-1 text-sm text-stone-600"><b>{pedidos.length}</b> {pedidos.length === 1 ? 'item' : 'itens'} no pedido</span>
          <Botao variante="secundario" disabled={!pedidos.length} onClick={async () => {
            try { await navigator.clipboard.writeText(textoWhats()); avisar('Pedido copiado') } catch { avisar('Não consegui copiar') }
          }}>Copiar</Botao>
          <Botao variante="secundario" disabled={!pedidos.length} onClick={imprimirPedido}>Imprimir</Botao>
          <Botao onClick={enviar} disabled={salvando}>{salvando ? 'Enviando…' : enviado ? 'Enviar de novo' : 'Enviar pedido'}{pedidos.length > 0 && ' + WhatsApp'}</Botao>
        </div>
      </div>
    </div>
  )
}
