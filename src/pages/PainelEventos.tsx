import { useEffect, useMemo, useState } from 'react'
import { Cartao, Vazio } from '../components/ui'
import { useOrdem } from '../components/Ordenar'
import { useApp } from '../lib/contexto'
import { montarCatalogo, reais, type Catalogo } from '../lib/custos'
import { addDias, dataCurta, hoje } from '../lib/datas'
import { montarPainel, posicaoEventos, type PosicaoEvento, type ResumoProduto } from '../lib/painelEventos'
import { ir } from '../lib/rota'
import type { Evento, VendaEvento } from '../lib/types'

const inteiro = (n: number) => Math.round(n).toLocaleString('pt-BR')
const porcento = (n: number) => `${n.toFixed(1).replace('.', ',')}%`
const curto = (n: number) => (n >= 10000 ? `R$ ${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil` : reais(n, 0))

interface Barra {
  chave: string
  rotulo: string
  sub?: string
  valor: number
  texto: string
  aoClicar?: () => void
}

// Barras horizontais de uma cor só; o valor vai sempre escrito ao lado.
function Barras({ itens }: { itens: Barra[] }) {
  const max = Math.max(...itens.map((i) => i.valor), 1)
  return (
    <div className="space-y-1.5">
      {itens.map((i) => (
        <div
          key={i.chave}
          title={`${i.rotulo}: ${i.texto}`}
          onClick={i.aoClicar}
          className={`grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-0.5 text-sm sm:grid-cols-[minmax(0,13rem)_1fr_auto] ${i.aoClicar ? 'cursor-pointer rounded-lg hover:bg-stone-50' : ''}`}
        >
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <div className="truncate font-semibold">{i.rotulo}</div>
            {i.sub && <div className="truncate text-xs text-stone-500">{i.sub}</div>}
          </div>
          <div className="h-3 rounded-full bg-stone-100">
            <div className="h-3 rounded-full bg-stone-700" style={{ width: `${Math.max((i.valor / max) * 100, 1)}%` }} />
          </div>
          <div className="text-right font-semibold whitespace-nowrap">{i.texto}</div>
        </div>
      ))}
    </div>
  )
}

function Opcoes<T extends string>({ valor, opcoes, aoMudar }: { valor: T; opcoes: [T, string][]; aoMudar: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {opcoes.map(([v, nome]) => (
        <button key={v} onClick={() => aoMudar(v)} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${valor === v ? 'bg-carvao text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
          {nome}
        </button>
      ))}
    </div>
  )
}

type Periodo = 'tudo' | '12m' | string
type OrdemProduto = 'fat' | 'itens' | 'porDia' | 'margem'

// Painel de eventos (pedido de 08/10): o que faturou mais, gastronomias, dias da semana, ano a ano e produtos.
export default function PainelEventos() {
  const { store, avisar } = useApp()
  const [dados, setDados] = useState<{ eventos: Evento[]; vendas: VendaEvento[]; cat: Catalogo | null } | null>(null)
  const [erro, setErro] = useState('')
  const [periodo, setPeriodo] = useState<Periodo>('tudo')
  const [gastro, setGastro] = useState('')
  const [eventoPor, setEventoPor] = useState<'fat' | 'porDia'>('fat')
  const [ordemProd, setOrdemProd] = useState<OrdemProduto>('fat')
  const [todosProdutos, setTodosProdutos] = useState(false)
  const [escolher, setEscolher] = useState(false)

  useEffect(() => {
    Promise.all([store.eventos(), store.vendasEventos(), store.insumos(), store.receitas(), store.versoesReceitas()])
      .then(([eventos, vendas, insumos, receitas, versoes]) => setDados({ eventos, vendas, cat: montarCatalogo(insumos, receitas, versoes) }))
      .catch((e) => setErro((e as Error).message))
  }, [store])

  const anos = useMemo(() => [...new Set((dados?.vendas ?? []).map((v) => v.data.slice(0, 4)))].sort(), [dados])
  const comVendas = useMemo(() => new Set((dados?.vendas ?? []).map((v) => v.eventoId)), [dados])
  const gastronomias = useMemo(
    () => [...new Set((dados?.eventos ?? []).filter((e) => comVendas.has(e.id)).map((e) => e.gastronomia).filter(Boolean))].sort() as string[],
    [dados, comVendas],
  )
  const posicao = useMemo(() => (dados ? posicaoEventos(dados.eventos, dados.vendas) : new Map<string, PosicaoEvento>()), [dados])
  const painel = useMemo(() => {
    if (!dados) return null
    const desde = addDias(hoje(), -365)
    const vendas = dados.vendas.filter((v) => (periodo === 'tudo' ? true : periodo === '12m' ? v.data >= desde : v.data.startsWith(periodo)))
    // Eventos marcados como fora da média não entram em nenhuma conta do painel.
    const eventos = dados.eventos.filter((e) => !e.foraDaMedia && (!gastro || e.gastronomia === gastro))
    return montarPainel(eventos, vendas, dados.cat)
  }, [dados, periodo, gastro])

  // A escolha fica salva no evento: vale para o painel e para a sugestão da previsão dos próximos eventos.
  const alternar = async (e: Evento) => {
    const fora = !e.foraDaMedia
    setDados((d) => d && { ...d, eventos: d.eventos.map((x) => (x.id === e.id ? { ...x, foraDaMedia: fora } : x)) })
    try {
      await store.marcarForaDaMedia(e.id, fora)
    } catch (err) {
      setDados((d) => d && { ...d, eventos: d.eventos.map((x) => (x.id === e.id ? { ...x, foraDaMedia: !fora } : x)) })
      avisar((err as Error).message)
    }
  }

  if (erro) return <p className="text-red-600">{erro}</p>
  if (!dados || !painel) return <p className="text-stone-400">Carregando…</p>
  if (!comVendas.size) return <Vazio>Nenhum evento com vendas ainda. As vendas entram na aba Vendas de cada evento.</Vazio>

  const p = painel
  const eventosOrd = [...p.eventos].sort((a, b) => (eventoPor === 'fat' ? b.fat - a.fat : b.porDia - a.porDia)).slice(0, 10)
  const ordenar: Record<OrdemProduto, (x: ResumoProduto) => number> = { fat: (x) => x.fat, itens: (x) => x.itens, porDia: (x) => x.porDia, margem: (x) => x.margem ?? -Infinity }
  const produtos = [...p.produtos].sort((a, b) => ordenar[ordemProd](b) - ordenar[ordemProd](a))
  const semCusto = p.produtos.filter((x) => x.custoUnit === null)
  const fatSemCusto = semCusto.reduce((s, x) => s + x.fat, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Opcoes valor={periodo} aoMudar={setPeriodo} opcoes={[['tudo', 'Tudo'], ...anos.map((a) => [a, a] as [string, string]), ['12m', 'Últimos 12 meses']]} />
        <Opcoes valor={gastro} aoMudar={setGastro} opcoes={[['', 'Todas as gastronomias'], ...gastronomias.map((g) => [g, g] as [string, string])]} />
      </div>

      <EventosNaConta
        eventos={dados.eventos.filter((e) => comVendas.has(e.id))}
        posicao={posicao}
        aberto={escolher}
        aoAbrir={() => setEscolher((x) => !x)}
        aoAlternar={alternar}
      />

      {!p.eventos.length ? (
        <Vazio>Nenhum evento com vendas nesse filtro.</Vazio>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Faturamento', curto(p.fat), `${inteiro(p.itens)} itens vendidos`],
              ['Eventos', String(p.eventos.length), `${p.dias} dias de venda`],
              ['Média por evento', curto(p.fat / p.eventos.length), null],
              ['Média por dia', curto(p.fat / p.dias), null],
            ].map(([t, v, s]) => (
              <Cartao key={t}>
                <div className="text-xs text-stone-500">{t}</div>
                <div className="text-xl font-bold">{v}</div>
                {s && <div className="text-xs text-stone-500">{s}</div>}
              </Cartao>
            ))}
          </div>

          {p.destaques.length > 0 && (
            <Cartao>
              <h2 className="mb-2 font-bold">O que os números mostram</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-stone-700">
                {p.destaques.map((d) => <li key={d}>{d}</li>)}
              </ul>
            </Cartao>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Cartao>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold">Eventos que mais faturaram</h2>
                <Opcoes valor={eventoPor} aoMudar={setEventoPor} opcoes={[['fat', 'Total'], ['porDia', 'Por dia']]} />
              </div>
              <Barras
                itens={eventosOrd.map((r) => ({
                  chave: r.e.id, rotulo: r.e.nome,
                  sub: [r.e.dias[0] && dataCurta(r.e.dias[0].data), `${r.dias} ${r.dias === 1 ? 'dia' : 'dias'}`, r.e.barracas && `${String(r.e.barracas).replace('.', ',')} ${r.e.barracas === 1 ? 'barraca' : 'barracas'}`].filter(Boolean).join(' · '),
                  valor: eventoPor === 'fat' ? r.fat : r.porDia, texto: curto(eventoPor === 'fat' ? r.fat : r.porDia),
                  aoClicar: () => ir(`eventos/${r.e.id}/vendas`),
                }))}
              />
              {p.eventos.length > 10 && <p className="mt-2 text-xs text-stone-500">Os 10 primeiros de {p.eventos.length}. A lista completa está em Comparativo.</p>}
            </Cartao>

            <Cartao>
              <h2 className="mb-3 font-bold">Faturamento médio por dia, por gastronomia</h2>
              <Barras
                itens={p.gastronomias.map((g) => ({
                  chave: g.nome, rotulo: g.nome,
                  sub: `${g.eventos} ${g.eventos === 1 ? 'evento' : 'eventos'}${g.porDiaBarraca ? ` · ${curto(g.porDiaBarraca)} por barraca` : ''}`,
                  valor: g.porDia, texto: curto(g.porDia),
                }))}
              />
            </Cartao>

            <Cartao>
              <h2 className="mb-3 font-bold">Faturamento médio por dia da semana</h2>
              <Barras itens={p.diasSemana.map((d) => ({ chave: d.nome, rotulo: d.nome, sub: `${d.dias} ${d.dias === 1 ? 'dia' : 'dias'} de evento`, valor: d.porDia, texto: curto(d.porDia) }))} />
            </Cartao>

            <Cartao>
              <h2 className="mb-1 font-bold">Mesmo evento, ano a ano</h2>
              <p className="mb-3 text-xs text-stone-500">Faturamento por dia da edição mais recente contra a anterior.</p>
              {!p.anoAno.length ? (
                <p className="text-sm text-stone-500">Nenhum evento repetido em anos diferentes nesse filtro.</p>
              ) : (
                <div className="divide-y divide-stone-100">
                  {p.anoAno.map((a) => (
                    <div key={a.nome} className="flex items-center gap-3 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{a.nome}</div>
                        <div className="text-xs text-stone-500">
                          {a.antes.ano}: {curto(a.antes.porDia)} por dia{a.antes.e.barracas ? ` (${String(a.antes.e.barracas).replace('.', ',')} barr.)` : ''} · {a.depois.ano}: {curto(a.depois.porDia)} por dia{a.depois.e.barracas ? ` (${String(a.depois.e.barracas).replace('.', ',')} barr.)` : ''}
                        </div>
                      </div>
                      <span className={`shrink-0 font-bold ${a.variacao >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {a.variacao >= 0 ? '▲' : '▼'} {Math.abs(Math.round(a.variacao))}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Cartao>

            <Cartao>
              <h2 className="mb-3 font-bold">Faturamento por linha</h2>
              <Barras itens={p.linhas.map((l) => ({ chave: l.nome, rotulo: l.nome, sub: `${inteiro(l.itens)} itens`, valor: l.fat, texto: `${curto(l.fat)} · ${porcento((l.fat / p.fat) * 100)}` }))} />
            </Cartao>

            {p.anos.length > 1 && (
              <Cartao>
                <h2 className="mb-3 font-bold">Por ano</h2>
                <Barras
                  itens={p.anos.map((a) => ({
                    chave: a.nome, rotulo: a.nome, sub: `${a.eventos} eventos · ${curto(a.fat / a.eventos)} por evento`, valor: a.fat, texto: curto(a.fat),
                  }))}
                />
              </Cartao>
            )}
          </div>

          <Cartao>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold">Produtos</h2>
              <Opcoes
                valor={ordemProd}
                aoMudar={setOrdemProd}
                opcoes={[['fat', 'Mais faturam'], ['itens', 'Mais vendidos'], ['porDia', 'Mais saem por dia'], ['margem', 'Maior margem']]}
              />
            </div>
            {/* Trocar a opção acima recomeça a tabela nessa ordem. */}
            <TabelaProdutos key={ordemProd} produtos={produtos} todos={todosProdutos} inicial={ordemProd} fatTotal={p.fat} />
            {produtos.length > 15 && (
              <button className="mt-2 text-sm font-semibold text-sky-700" onClick={() => setTodosProdutos(!todosProdutos)}>
                {todosProdutos ? 'Mostrar só os 15 primeiros' : `Ver todos os ${produtos.length} produtos`}
              </button>
            )}
            <p className="mt-2 text-xs text-stone-500">
              CMV e margem usam o custo da ficha de hoje com os preços atuais dos insumos, sobre o faturamento bruto (sem a taxa do organizador e sem impostos).
              {semCusto.length > 0 && ` ${semCusto.length} ${semCusto.length === 1 ? 'produto ainda não tem' : 'produtos ainda não têm'} ficha com custo (${porcento((fatSemCusto / p.fat) * 100)} do faturamento).`}
            </p>
          </Cartao>
        </>
      )}
    </div>
  )
}

function TabelaProdutos({ produtos, todos, inicial, fatTotal }: { produtos: ResumoProduto[]; todos: boolean; inicial: OrdemProduto; fatTotal: number }) {
  const { ordenada, cabecalho } = useOrdem(produtos, {
    nome: (x) => x.nome, itens: (x) => x.itens, fat: (x) => x.fat, pct: (x) => x.fat, porDia: (x) => x.porDia, preco: (x) => x.precoMedio,
    cmv: (x) => x.cmvPct, margem: (x) => x.margem, eventos: (x) => x.eventos,
  }, { col: inicial, desc: true })
  const num = 'px-2! py-1! text-right'
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-stone-500">
          <tr>
            {cabecalho('nome', 'Produto', 'pl-0! pr-2! py-1!')}
            {cabecalho('itens', 'Itens', num, true)}
            {cabecalho('fat', 'Faturamento', num, true)}
            {cabecalho('pct', '% do total', num, true)}
            {cabecalho('porDia', <span title="Itens por dia, contando só os dias dos eventos que tiveram o produto">Por dia</span>, num, true)}
            {cabecalho('preco', 'Preço médio', num, true)}
            {cabecalho('cmv', <span title="Custo da ficha de hoje ÷ preço médio vendido">CMV</span>, num, true)}
            {cabecalho('margem', <span title="Faturamento − custo da ficha × itens (sem taxa do organizador e impostos)">Margem</span>, num, true)}
            {cabecalho('eventos', 'Eventos', num, true)}
          </tr>
        </thead>
        <tbody>
          {(todos ? ordenada : ordenada.slice(0, 15)).map((x) => (
            <tr key={x.chave} className="border-t border-stone-100">
              <td className="py-1 pr-2">
                <span className="font-semibold">{x.nome}</span>
                <span className="block text-xs text-stone-500">{x.linha}</span>
              </td>
              <td className="px-2 py-1 text-right">{inteiro(x.itens)}</td>
              <td className="px-2 py-1 text-right whitespace-nowrap">{reais(x.fat, 0)}</td>
              <td className="px-2 py-1 text-right">{porcento((x.fat / fatTotal) * 100)}</td>
              <td className="px-2 py-1 text-right">{inteiro(x.porDia)}</td>
              <td className="px-2 py-1 text-right whitespace-nowrap">{reais(x.precoMedio)}</td>
              <td className="px-2 py-1 text-right">{x.cmvPct === null ? <span className="text-stone-400">sem ficha</span> : porcento(x.cmvPct)}</td>
              <td className="px-2 py-1 text-right whitespace-nowrap">{x.margem === null ? '—' : reais(x.margem, 0)}</td>
              <td className="px-2 py-1 text-right">{x.eventos}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Quais eventos entram nas médias. Marca sozinho nada: só avisa os que estão muito longe do normal da gastronomia.
function EventosNaConta({ eventos, posicao, aberto, aoAbrir, aoAlternar }: {
  eventos: Evento[]
  posicao: Map<string, PosicaoEvento>
  aberto: boolean
  aoAbrir: () => void
  aoAlternar: (e: Evento) => void
}) {
  const fora = eventos.filter((e) => e.foraDaMedia)
  const avisos = eventos.filter((e) => !e.foraDaMedia && posicao.get(e.id)?.aviso)
  const ordenados = [...eventos].sort((a, b) => (b.dias[0]?.data ?? '').localeCompare(a.dias[0]?.data ?? ''))
  return (
    <Cartao>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">{eventos.length - fora.length} de {eventos.length} eventos na conta</span>
          {fora.length > 0 && <span className="text-stone-500"> · fora da média: {fora.map((e) => e.nome).join(', ')}</span>}
          {avisos.length > 0 && !aberto && <span className="block text-xs text-amber-800">{avisos.length} {avisos.length === 1 ? 'evento está' : 'eventos estão'} bem longe do normal da gastronomia.</span>}
        </div>
        <button onClick={aoAbrir} className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-semibold text-stone-700 hover:bg-stone-200">
          {aberto ? 'Fechar' : 'Escolher eventos'}
        </button>
      </div>
      {aberto && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-stone-500">
            Desmarque os eventos fora da média. A escolha fica salva e vale para todo o painel e para a sugestão da previsão dos próximos eventos (lá ainda dá para marcar de novo na hora).
          </p>
          <div className="divide-y divide-stone-100 rounded-xl ring-1 ring-stone-200">
            {ordenados.map((e) => {
              const pos = posicao.get(e.id)
              return (
                <label key={e.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-stone-50">
                  <input type="checkbox" className="size-4" checked={!e.foraDaMedia} onChange={() => aoAlternar(e)} aria-label={`Incluir ${e.nome} na média`} />
                  <div className="min-w-0 flex-1">
                    <div className={`font-semibold ${e.foraDaMedia ? 'text-stone-400 line-through' : ''}`}>{e.nome}</div>
                    <div className="text-xs text-stone-500">
                      {[e.dias[0] && dataCurta(e.dias[0].data), e.gastronomia, pos && `${curto(pos.porDia)} por dia`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {pos?.aviso && (
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${pos.aviso === 'acima' ? 'bg-sky-50 text-sky-800' : 'bg-amber-50 text-amber-800'}`}
                      title={`Faturamento por dia ${pos.relacao!.toFixed(1).replace('.', ',')} vezes o normal de ${e.gastronomia}`}>
                      {pos.aviso === 'acima' ? '▲ muito acima' : '▼ muito abaixo'} do normal
                    </span>
                  )}
                </label>
              )
            })}
          </div>
        </div>
      )}
    </Cartao>
  )
}
