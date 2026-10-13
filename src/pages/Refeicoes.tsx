import { useCallback, useEffect, useMemo, useState } from 'react'
import { Botao, Campo, CampoNumero, Modal, Selo, Titulo, Vazio, estiloEntrada } from '../components/ui'
import { useOrdem } from '../components/Ordenar'
import { useApp } from '../lib/contexto'
import { addDias, dataCurta, diaSemana, hoje } from '../lib/datas'
import { mostrarQtd, reais } from '../lib/financeiro'
import { podeGerenciar } from '../lib/permissoes'
import { ir } from '../lib/rota'
import { FaleComCozinha, OrcamentoRefeicoes, Recados, VotacaoCozinha, VotacaoDaSemana } from './RefeicoesVotacao'
import type { Funcionario, Insumo, ModeloRefeicao, QuemCome, Refeicao, TipoModeloRefeicao, VotosRefeicao } from '../lib/types'

// Refeição do dia (Heitor, 13/10). O manutencista cuida da comida da equipe:
// - todos veem a refeição do dia e dão joinha nas da semana (anônimo: ninguém vê quem votou);
// - quem cozinha e a gestão montam o prato com os insumos (baixa no estoque do local), veem o custo por refeição,
//   quem trabalha no dia (equipe no turno + motoboys da escala; freelancer não conta) e o que a equipe mais gosta.

export const souCozinha = (eu: Pick<Funcionario, 'nivel'>) => podeGerenciar(eu.nivel) || eu.nivel === 'manutencao'

export const ABAS_REFEICOES = [
  { id: '', nome: 'Refeição do dia' },
  { id: 'montar', nome: 'Montar o prato', cozinha: true },
  { id: 'historico', nome: 'Histórico e custo', cozinha: true },
  { id: 'votacao', nome: 'Votação do cardápio', cozinha: true },
  { id: 'recados', nome: 'Recados da equipe', cozinha: true },
  { id: 'avaliacoes', nome: 'O que a equipe gosta', cozinha: true },
  { id: 'pratos', nome: 'Pratos salvos', cozinha: true },
]

const LOCAIS: [string, string][] = [['burger-psd', 'PSD'], ['burger-va', 'Vila'], ['pizza', 'Pizza'], ['central', 'Central']]
const nomeLocal = (id: string) => LOCAIS.find(([x]) => x === id)?.[1] ?? (id === 'producao' ? 'Produção' : id === 'escritorio' ? 'Escritório' : id)
// Lugares que comem juntos: Vila e Pizza ficam no mesmo endereço.
const juntos = (local: string) => (local === 'burger-va' ? ['burger-va', 'pizza'] : [local])
const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const diaLongo = (d: string) => `${diaSemana(d)}, ${dataCurta(d)}`
// Porção por pessoa em gramas, pelo peso total da comida pronta.
const porcaoG = (pesoKg?: number | null, pessoas?: number | null) => (pesoKg && pessoas ? Math.round((pesoKg * 1000) / pessoas) : null)
const pct = (p: number, n: number) => (p + n ? Math.round((p / (p + n)) * 100) : null)

export default function Refeicoes({ sub, param }: { sub?: string; param?: string }) {
  const { eu } = useApp()
  const cozinha = souCozinha(eu)
  const abas = ABAS_REFEICOES.filter((a) => cozinha || !a.cozinha)
  const aba = abas.some((a) => a.id && a.id === sub) ? sub! : ''
  return (
    <div className="space-y-4">
      <Titulo>Refeição do dia</Titulo>
      {abas.length > 1 && (
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-stone-200 p-1 text-sm font-semibold">
          {abas.map((a) => (
            <button key={a.id} onClick={() => ir('refeicoes' + (a.id ? '/' + a.id : ''))}
              className={`shrink-0 flex-1 rounded-lg px-3 py-2 whitespace-nowrap ${aba === a.id ? 'bg-white shadow-sm' : 'text-stone-600'}`}>{a.nome}</button>
          ))}
        </div>
      )}
      {aba === 'montar' ? <Montar inicial={param} />
        : aba === 'historico' ? <Historico />
        : aba === 'avaliacoes' ? <Avaliacoes />
        : aba === 'pratos' ? <Pratos />
        : aba === 'votacao' ? <VotacaoCozinha />
        : aba === 'recados' ? <Recados />
        : (
          <>
            <RefeicoesDaSemana completo />
            <VotacaoDaSemana />
            <details className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
              <summary className="cursor-pointer font-bold">💬 Fale com a cozinha <span className="font-normal text-stone-500">(anônimo)</span></summary>
              <div className="mt-2"><FaleComCozinha /></div>
            </details>
          </>
        )}
    </div>
  )
}

// ——— Para todos: refeição de hoje e joinhas da semana (também aparece na Início) ———

export function RefeicoesDaSemana({ completo = false }: { completo?: boolean }) {
  const { store, eu, avisar } = useApp()
  const [lista, setLista] = useState<Refeicao[] | null>(null)
  const [votos, setVotos] = useState<VotosRefeicao[]>([])
  const [comentar, setComentar] = useState<{ id: string; critica: boolean } | null>(null)
  const de = addDias(hoje(), -7)
  const carregar = useCallback(async () => {
    try {
      const [r, v] = await Promise.all([store.refeicoes(de, hoje()), store.votosRefeicoes(de, hoje()).catch(() => [])])
      setLista(r)
      setVotos(v)
    } catch (e) {
      setLista([])
      if (completo) avisar((e as Error).message)
    }
  }, [store, de, completo, avisar])
  useEffect(() => { carregar() }, [carregar])
  if (!lista) return completo ? <p className="text-stone-400">Carregando…</p> : null
  const deHoje = lista.filter((r) => r.data === hoje())
  const minhaLoja = juntos(eu.unidadeId)
  const hojeOrd = [...deHoje].sort((a, b) => Number(!minhaLoja.includes(a.centroCustoId)) - Number(!minhaLoja.includes(b.centroCustoId)))
  const anteriores = lista.filter((r) => r.data < hoje()).reverse()
  if (!completo && !hojeOrd.length) return null
  const votar = async (r: Refeicao, voto: -1 | 1) => {
    const atual = votos.find((v) => v.refeicaoId === r.id)?.meuVoto ?? 0
    const novo = atual === voto ? 0 : voto
    setVotos((vs) => [...vs.filter((v) => v.refeicaoId !== r.id), { ...(vs.find((v) => v.refeicaoId === r.id) ?? { refeicaoId: r.id, positivos: null, negativos: null }), meuVoto: novo || null }])
    // Não gostou: já abre o recado para contar o porquê (opcional e anônimo).
    if (novo === -1) setComentar({ id: r.id, critica: true })
    try {
      await store.votarRefeicao(r.id, novo as -1 | 0 | 1)
      if (souCozinha(eu)) setVotos(await store.votosRefeicoes(de, hoje()))
    } catch (e) {
      avisar((e as Error).message)
      carregar()
    }
  }
  const linha = (r: Refeicao, grande: boolean) => {
    const v = votos.find((x) => x.refeicaoId === r.id)
    return (
      <div key={r.id} className={grande ? 'rounded-2xl bg-white p-4 ring-1 ring-stone-200' : 'px-3 py-2.5'}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {grande && <div className="text-xs font-semibold tracking-wide text-stone-500 uppercase">Hoje{deHoje.length > 1 ? ` · ${nomeLocal(r.centroCustoId)}` : ''}</div>}
          <div className={grande ? 'text-lg font-bold' : 'font-semibold'}>{r.prato}</div>
          {r.acompanhamentos && <div className="text-sm text-stone-600">{r.acompanhamentos}</div>}
          {grande && porcaoG(r.pesoKg, r.pessoas) && <div className="text-sm font-semibold text-stone-700">Porção: cerca de {porcaoG(r.pesoKg, r.pessoas)} g por pessoa</div>}
          {grande && r.observacao && <div className="text-sm text-stone-500">{r.observacao}</div>}
          {!grande && <div className="text-xs text-stone-500">{diaLongo(r.data)}{lista.some((x) => x.data === r.data && x.id !== r.id) ? ` · ${nomeLocal(r.centroCustoId)}` : ''}</div>}
          {v?.positivos !== null && v?.positivos !== undefined && (
            <div className="text-xs text-stone-500">{v.positivos} 👍 · {v.negativos} 👎</div>
          )}
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => votar(r, 1)} aria-label={`Gostei de ${r.prato}`} aria-pressed={v?.meuVoto === 1}
            className={`grid size-11 place-items-center rounded-full text-xl ring-1 transition ${v?.meuVoto === 1 ? 'bg-emerald-500 ring-emerald-600' : 'bg-white ring-stone-300 grayscale hover:grayscale-0'}`}>👍</button>
          <button onClick={() => votar(r, -1)} aria-label={`Não gostei de ${r.prato}`} aria-pressed={v?.meuVoto === -1}
            className={`grid size-11 place-items-center rounded-full text-xl ring-1 transition ${v?.meuVoto === -1 ? 'bg-red-500 ring-red-600' : 'bg-white ring-stone-300 grayscale hover:grayscale-0'}`}>👎</button>
          <button onClick={() => setComentar(comentar?.id === r.id ? null : { id: r.id, critica: false })} aria-label={`Comentar ${r.prato}`} aria-expanded={comentar?.id === r.id}
            className={`grid size-11 place-items-center rounded-full text-xl ring-1 transition ${comentar?.id === r.id ? 'bg-ozzy-100 ring-carvao' : 'bg-white ring-stone-300 grayscale hover:grayscale-0'}`}>💬</button>
        </div>
      </div>
      {comentar?.id === r.id && (
        <div className="mt-2">
          <FaleComCozinha key={r.id + String(comentar.critica)} refeicao={r} tipoInicial={comentar.critica ? 'critica' : 'elogio'}
            titulo={comentar.critica ? `Quer contar o que não estava legal em ${r.prato}?` : undefined} aoEnviar={() => setComentar(null)} />
        </div>
      )}
      </div>
    )
  }
  return (
    <section className="space-y-2">
      {!completo && <h2 className="font-bold">Refeição do dia</h2>}
      {hojeOrd.length ? hojeOrd.map((r) => linha(r, true)) : completo && <Vazio>A refeição de hoje ainda não foi lançada.</Vazio>}
      {completo && anteriores.length > 0 && (
        <>
          <h3 className="pt-2 text-sm font-bold">Avalie as refeições da semana</h3>
          <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">{anteriores.map((r) => linha(r, false))}</div>
        </>
      )}
      {(completo || hojeOrd.length > 0) && <p className="text-xs text-stone-500">Seu voto e seus recados são anônimos: ninguém, nem quem cozinha, vê quem mandou. Toque de novo para tirar o voto.</p>}
    </section>
  )
}

// ——— Montar o prato (quem cozinha e gestão) ———

interface Linha { chave: string; insumoId: string; texto: string; quantidade: number | null; dica?: string }
let seq = 0
const novaLinha = (x: Partial<Linha> = {}): Linha => ({ chave: 'l' + ++seq, insumoId: '', texto: '', quantidade: null, ...x })

// Material do cadastro para um ingrediente do prato salvo: o que foi ligado, senão o nome mais parecido.
function acharInsumo(insumos: Insumo[], nome: string, id?: string | null) {
  if (id) {
    const i = insumos.find((x) => x.id === id)
    if (i) return i
  }
  const n = sem(nome)
  const ativos = insumos.filter((i) => i.ativo)
  return ativos.find((i) => sem(i.nome) === n)
    ?? ativos.find((i) => sem(i.nome).startsWith(n + ' '))
    ?? ativos.find((i) => sem(i.nome).split(/\s+/).includes(n))
    ?? ativos.find((i) => sem(i.nome).includes(n))
}

function Montar({ inicial }: { inicial?: string }) {
  const { store, eu, avisar } = useApp()
  const [dIni, lIni] = (inicial ?? '').split('_')
  const [data, setData] = useState(/^\d{4}-\d{2}-\d{2}$/.test(dIni ?? '') ? dIni : hoje())
  const [local, setLocal] = useState(LOCAIS.some(([x]) => x === lIni) ? lIni : LOCAIS.some(([x]) => x === eu.unidadeId) ? eu.unidadeId : 'burger-psd')
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [modelos, setModelos] = useState<ModeloRefeicao[]>([])
  const [quem, setQuem] = useState<QuemCome | null>(null)
  const [refeicao, setRefeicao] = useState<Refeicao | null | undefined>(undefined)
  const [prato, setPrato] = useState('')
  const [acomp, setAcomp] = useState('')
  const [obs, setObs] = useState('')
  const [pessoas, setPessoas] = useState<number | null>(null)
  const [peso, setPeso] = useState<number | null>(null)
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [usados, setUsados] = useState<ModeloRefeicao[]>([])
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    Promise.all([store.insumos(), store.modelosRefeicao()]).then(([i, m]) => { setInsumos(i); setModelos(m) }, (e) => avisar((e as Error).message))
  }, [store, avisar])
  // Troca de dia ou local: carrega o que já foi lançado e quem trabalha.
  useEffect(() => {
    let vivo = true
    setRefeicao(undefined)
    Promise.all([store.refeicoesCozinha(data, data), store.quemCome(data).catch(() => null)]).then(([rs, q]) => {
      if (!vivo) return
      const r = rs.find((x) => x.centroCustoId === local) ?? null
      setRefeicao(r)
      setQuem(q)
      setPrato(r?.prato ?? '')
      setAcomp(r?.acompanhamentos ?? '')
      setObs(r?.observacao ?? '')
      setUsados([])
      const daqui = q ? q.equipe.filter((p) => juntos(local).includes(p.local)).length + q.motoboys.filter((m) => juntos(local).includes(m.local)).length : 0
      setPessoas(r?.pessoas ?? (daqui || null))
      setPeso(r?.pesoKg ?? null)
      setLinhas((r?.itens ?? []).map((i) => novaLinha({ insumoId: i.insumoId, texto: '', quantidade: i.quantidade })))
    }, (e) => avisar((e as Error).message))
    return () => { vivo = false }
  }, [store, data, local, avisar])

  const porId = useMemo(() => new Map(insumos.map((i) => [i.id, i])), [insumos])
  const ativos = useMemo(() => insumos.filter((i) => i.ativo || linhas.some((l) => l.insumoId === i.id)), [insumos, linhas])
  const custo = (l: Linha) => (l.insumoId && l.quantidade ? l.quantidade * (porId.get(l.insumoId)?.preco ?? 0) : 0)
  const total = linhas.reduce((t, l) => t + custo(l), 0)
  const semPreco = linhas.filter((l) => l.insumoId && l.quantidade && porId.get(l.insumoId)?.preco == null).length
  const mudar = (chave: string, x: Partial<Linha>) => setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...x } : l)))

  const usarModelo = (m: ModeloRefeicao) => {
    const n = pessoas ?? 1
    setLinhas((ls) => {
      const r = [...ls.filter((l) => l.insumoId || l.texto || l.quantidade)]
      for (const it of m.itens) {
        const ins = acharInsumo(insumos, it.nome, it.insumoId)
        const q = Math.round(it.quantidade * n * 1000) / 1000
        const ja = ins && r.find((l) => l.insumoId === ins.id)
        if (ja) ja.quantidade = Math.round(((ja.quantidade ?? 0) + q) * 1000) / 1000
        else r.push(novaLinha({ insumoId: ins?.id ?? '', texto: ins ? '' : it.nome, quantidade: q, dica: ins ? undefined : `${it.nome} (${mostrarQtd(q)} ${it.unidade})` }))
      }
      return r
    })
    if (m.tipo === 'prato' && !prato.trim()) setPrato(m.nome)
    else if (m.tipo !== 'prato') setAcomp((a) => (a.trim() ? `${a.trim()}, ${m.nome.toLowerCase()}` : m.nome))
    setUsados((u) => [...u.filter((x) => x.id !== m.id), m])
  }

  const salvar = async () => {
    const faltam = linhas.filter((l) => !l.insumoId && (l.texto || l.quantidade))
    if (faltam.length) return avisar(`Escolha o material do cadastro para: ${faltam.map((l) => l.texto || 'linha sem nome').join(', ')}`)
    setSalvando(true)
    try {
      await store.salvarRefeicao({
        id: refeicao?.id, data, centroCustoId: local, prato, acompanhamentos: acomp, observacao: obs, pessoas, pesoKg: peso,
        itens: linhas.filter((l) => l.insumoId && l.quantidade).map((l) => ({ insumoId: l.insumoId, quantidade: l.quantidade! })),
      })
      const rs = await store.refeicoesCozinha(data, data)
      store.modelosRefeicao().then(setModelos, () => {})
      setRefeicao(rs.find((x) => x.centroCustoId === local) ?? null)
      avisar('Refeição salva: já aparece para a equipe e saiu do estoque')
    } catch (e) {
      avisar((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }
  const excluir = async () => {
    if (!refeicao || !confirm('Excluir esta refeição? Os ingredientes voltam para o estoque.')) return
    try {
      await store.excluirRefeicao(refeicao.id)
      setRefeicao(null)
      setPrato('')
      setAcomp('')
      setObs('')
      setLinhas([])
      avisar('Refeição excluída')
    } catch (e) {
      avisar((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-stone-700">Dia</span>
          <input type="date" className={`${estiloEntrada} w-auto!`} value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
        </label>
        <div className="flex rounded-xl bg-white p-1 ring-1 ring-stone-300">
          {LOCAIS.map(([id, nome]) => (
            <button key={id} onClick={() => setLocal(id)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${local === id ? 'bg-carvao text-white' : 'text-stone-600'}`}>{nome}</button>
          ))}
        </div>
        {refeicao && <Selo cor="verde">Já lançada</Selo>}
      </div>

      <QuemComePainel quem={quem} local={local} data={data} aoUsar={setPessoas} />

      {refeicao === undefined ? <p className="text-stone-400">Carregando…</p> : (
        <div className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
          <div className="flex flex-wrap items-end gap-2">
            <select className={`${estiloEntrada} sm:w-80!`} value="" onChange={(e) => { const m = modelos.find((x) => x.id === e.target.value); if (m) usarModelo(m) }} aria-label="Repetir um prato">
              <option value="">{modelos.some((m) => m.ativo) ? '+ Repetir um prato já feito…' : 'Os pratos que você montar ficam salvos aqui'}</option>
              {(['prato', 'acompanhamento', 'salada'] as TipoModeloRefeicao[]).map((t) => (
                <optgroup key={t} label={NOME_TIPO[t]}>
                  {modelos.filter((m) => m.ativo && m.tipo === t).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </optgroup>
              ))}
            </select>
            <span className="text-xs text-stone-500">Calcula as quantidades para {pessoas ?? 1} {pessoas === 1 ? 'pessoa' : 'pessoas'}. Ao salvar, este prato fica guardado para repetir.</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <Campo rotulo="Prato do dia">
              <input className={estiloEntrada} value={prato} onChange={(e) => setPrato(e.target.value)} />
            </Campo>
            <Campo rotulo="Quantas pessoas">
              <CampoNumero className={estiloEntrada} valor={pessoas} aoMudar={setPessoas} inputMode="numeric" aria-label="Quantas pessoas" />
            </Campo>
          </div>
          <Campo rotulo="Acompanhamentos">
            <input className={estiloEntrada} value={acomp} onChange={(e) => setAcomp(e.target.value)} />
          </Campo>
          <Campo rotulo="Recado para a equipe (opcional)">
            <input className={estiloEntrada} value={obs} onChange={(e) => setObs(e.target.value)} />
          </Campo>

          <div>
            <h3 className="mb-1 font-bold">Ingredientes usados</h3>
            <p className="mb-2 text-xs text-stone-500">Saem do estoque de {nomeLocal(local)} quando salvar. Quantidade na unidade do material.</p>
            <datalist id="materiais-refeicao">
              {ativos.map((i) => <option key={i.id} value={i.nome} />)}
            </datalist>
            <p className="mb-2 text-xs text-stone-500">Só materiais do cadastro. Se faltar algum, peça ao administrativo para cadastrar.</p>
            <div className="space-y-1.5">
              {linhas.map((l) => {
                const ins = porId.get(l.insumoId)
                return (
                  <div key={l.chave} className="flex flex-wrap items-center gap-2">
                    <MaterialDoCadastro insumos={ativos} lista="materiais-refeicao" insumoId={l.insumoId} destaque={!l.insumoId && !!(l.texto || l.quantidade)}
                      aoEscolher={(i) => mudar(l.chave, { insumoId: i.id, texto: '' })} />
                    <CampoNumero className={`${estiloEntrada} w-24! py-1.5! text-right`} valor={l.quantidade} aoMudar={(n) => mudar(l.chave, { quantidade: n })} inputMode="decimal" aria-label={`Quantidade de ${ins?.nome ?? l.texto}`} />
                    <span className="w-8 text-sm text-stone-500">{ins?.unidade ?? ''}</span>
                    <span className="w-20 text-right text-sm text-stone-600">{ins ? (ins.preco == null ? 'sem preço' : reais(custo(l))) : ''}</span>
                    <button className="px-1 text-stone-400 hover:text-red-600" onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))} aria-label="Tirar ingrediente">✕</button>
                    {l.dica && !l.insumoId && <span className="basis-full text-xs text-amber-700">“{l.dica}” não está mais no cadastro: escolha outro material ou tire a linha.</span>}
                  </div>
                )
              })}
            </div>
            <Botao variante="secundario" className="mt-2 py-1.5!" onClick={() => setLinhas((ls) => [...ls, novaLinha()])}>+ Ingrediente</Botao>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-stone-700">Peso total pronto (kg)</span>
              <CampoNumero className={`${estiloEntrada} w-32!`} valor={peso} aoMudar={setPeso} inputMode="decimal" aria-label="Peso total pronto em kg" />
            </label>
            <p className="pb-2 text-sm text-stone-600">
              {porcaoG(peso, pessoas) ? <>Dá <b>{porcaoG(peso, pessoas)} g por pessoa</b> ({pessoas} pessoas)</> : 'Pese tudo depois de pronto e salve de novo: o portal mostra quanto dá por pessoa.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl bg-stone-50 px-3 py-2 text-sm">
            <span>Custo total: <b>{reais(total)}</b></span>
            <span>Por refeição: <b>{pessoas ? reais(total / pessoas) : '—'}</b></span>
            {semPreco > 0 && <span className="text-amber-700">{semPreco} sem preço no cadastro (fora da conta)</span>}
          </div>

          {usados.some((m) => m.modoPreparo) && (
            <div className="space-y-2 rounded-xl bg-ozzy-50 p-3 text-sm ring-1 ring-ozzy-400/40">
              {usados.filter((m) => m.modoPreparo).map((m) => <p key={m.id}><b>{m.nome}:</b> {m.modoPreparo}</p>)}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Botao disabled={salvando || !prato.trim()} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
            {refeicao && <Botao variante="perigo" onClick={excluir}>Excluir</Botao>}
          </div>
        </div>
      )}
    </div>
  )
}

function QuemComePainel({ quem, local, data, aoUsar }: { quem: QuemCome | null; local: string; data: string; aoUsar: (n: number) => void }) {
  if (!quem) return null
  const grupos = new Map<string, { nome: string; detalhe: string }[]>()
  for (const p of quem.equipe) grupos.set(p.local, [...(grupos.get(p.local) ?? []), { nome: p.nome, detalhe: p.horario ? `${p.horario.inicio}–${p.horario.fim}` : p.turno ? 'fora do turno' : 'sem turno cadastrado' }])
  for (const m of quem.motoboys) grupos.set(m.local, [...(grupos.get(m.local) ?? []), { nome: m.nome, detalhe: 'motoboy' }])
  const total = quem.equipe.length + quem.motoboys.length
  const daqui = juntos(local).reduce((t, l) => t + (grupos.get(l)?.length ?? 0), 0)
  return (
    <details className="rounded-2xl bg-white p-3 ring-1 ring-stone-200" open>
      <summary className="cursor-pointer">
        <span className="font-bold">Quem trabalha {data === hoje() ? 'hoje' : diaLongo(data)}: {total} {total === 1 ? 'pessoa' : 'pessoas'}</span>
        <span className="ml-2 text-sm text-stone-500">({quem.equipe.length} da equipe + {quem.motoboys.length} motoboys, sem freelancers)</span>
      </summary>
      {total === 0 ? <p className="mt-2 text-sm text-stone-500">Ninguém no turno neste dia.</p> : (
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([l, ps]) => (
            <div key={l} className={`rounded-xl p-2 ring-1 ${juntos(local).includes(l) ? 'bg-ozzy-50 ring-ozzy-400/60' : 'ring-stone-200'}`}>
              <div className="mb-1 text-sm font-bold">{nomeLocal(l)} · {ps.length}</div>
              <ul className="space-y-0.5 text-sm">
                {ps.map((p, i) => <li key={i} className="flex justify-between gap-2"><span>{p.nome}</span><span className="text-xs text-stone-500">{p.detalhe}</span></li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
      {(quem.fora?.length ?? 0) > 0 && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-stone-600">Não estão neste dia: {quem.fora!.length}</summary>
          <ul className="mt-1 grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
            {quem.fora!.map((p) => <li key={p.id} className="flex justify-between gap-2"><span>{p.nome}</span><span className="text-xs text-stone-500">{p.motivo}</span></li>)}
          </ul>
        </details>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <Botao variante="secundario" className="py-1.5!" onClick={() => aoUsar(daqui)}>Usar {daqui} ({juntos(local).map(nomeLocal).join(' + ')})</Botao>
        <Botao variante="secundario" className="py-1.5!" onClick={() => aoUsar(total)}>Usar {total} (todos)</Botao>
      </div>
    </details>
  )
}

// ——— Histórico com custo e votos ———

interface LinhaHist extends Refeicao { positivos: number; negativos: number; porRefeicao: number | null; aprovacao: number | null }

function useHistorico(dias: number) {
  const { store, avisar } = useApp()
  const [linhas, setLinhas] = useState<LinhaHist[] | null>(null)
  useEffect(() => {
    const de = addDias(hoje(), -dias)
    Promise.all([store.refeicoesCozinha(de, hoje()), store.votosRefeicoes(de, hoje())]).then(([rs, vs]) => {
      setLinhas(rs.map((r) => {
        const v = vs.find((x) => x.refeicaoId === r.id)
        const p = v?.positivos ?? 0
        const n = v?.negativos ?? 0
        return { ...r, positivos: p, negativos: n, aprovacao: pct(p, n), porRefeicao: r.pessoas && r.custoTotal != null ? r.custoTotal / r.pessoas : null }
      }))
    }, (e) => avisar((e as Error).message))
  }, [store, dias, avisar])
  return linhas
}

function Historico() {
  const [dias, setDias] = useState(30)
  const linhas = useHistorico(dias)
  const { ordenada, cabecalho } = useOrdem(linhas ?? [], {
    data: (r) => r.data, local: (r) => nomeLocal(r.centroCustoId), prato: (r) => r.prato, pessoas: (r) => r.pessoas, total: (r) => r.custoTotal,
    por: (r) => r.porRefeicao, porcao: (r) => porcaoG(r.pesoKg, r.pessoas), pos: (r) => r.positivos, neg: (r) => r.negativos, apr: (r) => r.aprovacao,
  }, { col: 'data', desc: true })
  if (!linhas) return <p className="text-stone-400">Carregando…</p>
  const total = linhas.reduce((t, r) => t + (r.custoTotal ?? 0), 0)
  const refeicoes = linhas.reduce((t, r) => t + (r.pessoas ?? 0), 0)
  return (
    <div className="space-y-3">
      <OrcamentoRefeicoes />
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${estiloEntrada} w-auto! py-2!`} value={dias} onChange={(e) => setDias(Number(e.target.value))} aria-label="Período">
          {[7, 30, 90].map((d) => <option key={d} value={d}>Últimos {d} dias</option>)}
        </select>
        <span className="text-sm text-stone-600">
          {linhas.length} {linhas.length === 1 ? 'dia' : 'dias'} · {refeicoes} refeições · {reais(total)}{refeicoes > 0 && ` · média ${reais(total / refeicoes)} por refeição`}
        </span>
      </div>
      {linhas.length === 0 ? <Vazio>Nenhuma refeição lançada no período.</Vazio> : (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs text-stone-500">
              <tr>
                {cabecalho('data', 'Dia', '', true)}
                {cabecalho('local', 'Local')}
                {cabecalho('prato', 'Prato')}
                {cabecalho('pessoas', 'Pessoas', 'text-right', true)}
                {cabecalho('total', 'Custo', 'text-right', true)}
                {cabecalho('por', 'Por refeição', 'text-right', true)}
                {cabecalho('porcao', 'Porção', 'text-right', true)}
                {cabecalho('pos', '👍', 'text-right', true)}
                {cabecalho('neg', '👎', 'text-right', true)}
                {cabecalho('apr', 'Aprovação', 'text-right', true)}
              </tr>
            </thead>
            <tbody>
              {ordenada.map((r) => (
                <tr key={r.id} className="cursor-pointer border-t border-stone-100 hover:bg-stone-50" onClick={() => ir(`refeicoes/montar/${r.data}_${r.centroCustoId}`)}>
                  <td className="px-3 py-1.5 whitespace-nowrap">{diaSemana(r.data).slice(0, 3)} {dataCurta(r.data)}</td>
                  <td className="px-3 py-1.5">{nomeLocal(r.centroCustoId)}</td>
                  <td className="px-3 py-1.5"><span className="font-semibold">{r.prato}</span>{r.acompanhamentos && <span className="block text-xs text-stone-500">{r.acompanhamentos}</span>}</td>
                  <td className="px-3 py-1.5 text-right">{r.pessoas ?? '—'}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">{r.custoTotal != null ? reais(r.custoTotal) : '—'}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap font-semibold">{r.porRefeicao != null ? reais(r.porRefeicao) : '—'}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">{porcaoG(r.pesoKg, r.pessoas) ? `${porcaoG(r.pesoKg, r.pessoas)} g` : '—'}</td>
                  <td className="px-3 py-1.5 text-right">{r.positivos}</td>
                  <td className="px-3 py-1.5 text-right">{r.negativos}</td>
                  <td className={`px-3 py-1.5 text-right font-semibold ${r.aprovacao === null ? 'text-stone-400' : r.aprovacao >= 70 ? 'text-emerald-700' : r.aprovacao < 50 ? 'text-red-700' : ''}`}>{r.aprovacao === null ? '—' : `${r.aprovacao}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ——— O que a equipe gosta: votos somados por prato ———

function Avaliacoes() {
  const [dias, setDias] = useState(90)
  const linhas = useHistorico(dias)
  const pratos = useMemo(() => {
    const m = new Map<string, { prato: string; vezes: number; positivos: number; negativos: number; custo: number; pessoas: number; ultima: string }>()
    for (const r of linhas ?? []) {
      const k = sem(r.prato)
      const x = m.get(k) ?? { prato: r.prato, vezes: 0, positivos: 0, negativos: 0, custo: 0, pessoas: 0, ultima: r.data }
      x.vezes++
      x.positivos += r.positivos
      x.negativos += r.negativos
      if (r.pessoas && r.custoTotal != null) { x.custo += r.custoTotal; x.pessoas += r.pessoas }
      if (r.data > x.ultima) x.ultima = r.data
      m.set(k, x)
    }
    return [...m.values()].map((x) => ({ ...x, aprovacao: pct(x.positivos, x.negativos), votos: x.positivos + x.negativos, porRefeicao: x.pessoas ? x.custo / x.pessoas : null }))
  }, [linhas])
  const { ordenada, cabecalho } = useOrdem(pratos, {
    prato: (x) => x.prato, vezes: (x) => x.vezes, votos: (x) => x.votos, apr: (x) => x.aprovacao, por: (x) => x.porRefeicao, ultima: (x) => x.ultima,
  }, { col: 'apr', desc: true })
  if (!linhas) return <p className="text-stone-400">Carregando…</p>
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${estiloEntrada} w-auto! py-2!`} value={dias} onChange={(e) => setDias(Number(e.target.value))} aria-label="Período">
          {[30, 90, 180, 365].map((d) => <option key={d} value={d}>Últimos {d} dias</option>)}
        </select>
        <span className="text-sm text-stone-600">Votos somados por prato. Ninguém vê quem votou.</span>
      </div>
      {pratos.length === 0 ? <Vazio>Nenhuma refeição no período.</Vazio> : (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs text-stone-500">
              <tr>
                {cabecalho('prato', 'Prato')}
                {cabecalho('vezes', 'Vezes', 'text-right', true)}
                {cabecalho('votos', 'Votos', 'text-right', true)}
                {cabecalho('apr', 'Aprovação', '', true)}
                {cabecalho('por', 'Custo por refeição', 'text-right', true)}
                {cabecalho('ultima', 'Última vez', 'text-right', true)}
              </tr>
            </thead>
            <tbody>
              {ordenada.map((x) => (
                <tr key={x.prato} className="border-t border-stone-100">
                  <td className="px-3 py-1.5 font-semibold">{x.prato}</td>
                  <td className="px-3 py-1.5 text-right">{x.vezes}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">{x.positivos} 👍 · {x.negativos} 👎</td>
                  <td className="px-3 py-1.5">
                    {x.aprovacao === null ? <span className="text-stone-400">sem votos</span> : (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-red-200"><div className="h-full bg-emerald-500" style={{ width: `${x.aprovacao}%` }} /></div>
                        <span className="font-semibold">{x.aprovacao}%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">{x.porRefeicao != null ? reais(x.porRefeicao) : '—'}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">{dataCurta(x.ultima)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ——— Pratos salvos: cada prato montado fica guardado por pessoa para repetir ———

const NOME_TIPO: Record<TipoModeloRefeicao, string> = { prato: 'Pratos', acompanhamento: 'Acompanhamentos', salada: 'Saladas' }

function Pratos() {
  const { store, avisar } = useApp()
  const [modelos, setModelos] = useState<ModeloRefeicao[] | null>(null)
  const [editando, setEditando] = useState<ModeloRefeicao | 'novo' | null>(null)
  const carregar = useCallback(() => store.modelosRefeicao().then(setModelos, (e) => avisar((e as Error).message)), [store, avisar])
  useEffect(() => { carregar() }, [carregar])
  if (!modelos) return <p className="text-stone-400">Carregando…</p>
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm text-stone-600">Cada prato montado fica salvo aqui, com os ingredientes por pessoa. Em “Montar o prato”, escolha em “Repetir um prato já feito” e o portal calcula para o número de pessoas do dia.</p>
        <Botao onClick={() => setEditando('novo')}>+ Prato</Botao>
      </div>
      {(['prato', 'acompanhamento', 'salada'] as TipoModeloRefeicao[]).map((t) => {
        const doTipo = modelos.filter((m) => m.tipo === t)
        if (!doTipo.length) return null
        return (
          <section key={t} className="space-y-1.5">
            <h3 className="text-sm font-bold">{NOME_TIPO[t]}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {doTipo.map((m) => (
                <button key={m.id} onClick={() => setEditando(m)} className={`rounded-2xl bg-white p-3 text-left ring-1 ring-stone-200 hover:ring-carvao ${m.ativo ? '' : 'opacity-50'}`}>
                  <div className="font-semibold">{m.nome}{!m.ativo && ' (inativo)'}</div>
                  <div className="text-xs text-stone-500">{m.itens.map((i) => `${i.nome} ${mostrarQtd(i.quantidade)} ${i.unidade}`).join(' · ')}</div>
                </button>
              ))}
            </div>
          </section>
        )
      })}
      {editando && <EditarModelo modelo={editando === 'novo' ? null : editando} aoFechar={() => setEditando(null)} aoSalvar={async () => { setEditando(null); await carregar() }} />}
    </div>
  )
}

function EditarModelo({ modelo, aoFechar, aoSalvar }: { modelo: ModeloRefeicao | null; aoFechar: () => void; aoSalvar: () => Promise<void> }) {
  const { store, avisar } = useApp()
  const [insumos, setInsumos] = useState<Insumo[]>([])
  useEffect(() => { store.insumos().then((is) => setInsumos(is.filter((i) => i.ativo)), () => {}) }, [store])
  const [nome, setNome] = useState(modelo?.nome ?? '')
  const [tipo, setTipo] = useState<TipoModeloRefeicao>(modelo?.tipo ?? 'prato')
  const [modo, setModo] = useState(modelo?.modoPreparo ?? '')
  const [ativo, setAtivo] = useState(modelo?.ativo ?? true)
  const [itens, setItens] = useState(modelo?.itens.length ? modelo.itens.map((i) => ({ ...i })) : [{ nome: '', quantidade: 0, unidade: 'kg' }])
  const [salvando, setSalvando] = useState(false)
  const mudar = (k: number, x: Partial<ModeloRefeicao['itens'][number]>) => setItens((is) => is.map((i, j) => (j === k ? { ...i, ...x } : i)))
  const salvar = async () => {
    setSalvando(true)
    try {
      if (itens.some((i) => !i.insumoId && (i.nome || i.quantidade))) throw new Error('Escolha cada ingrediente na lista do cadastro.')
      await store.salvarModeloRefeicao({ id: modelo?.id, nome, tipo, modoPreparo: modo, ativo, itens: itens.filter((i) => i.insumoId) })
      avisar('Prato salvo')
      await aoSalvar()
    } catch (e) {
      avisar((e as Error).message)
      setSalvando(false)
    }
  }
  return (
    <Modal titulo={modelo ? modelo.nome : 'Novo prato'} aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        <Campo rotulo="Nome"><input className={estiloEntrada} value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>
        <div className="flex flex-wrap gap-3">
          <select className={`${estiloEntrada} w-auto!`} value={tipo} onChange={(e) => setTipo(e.target.value as TipoModeloRefeicao)} aria-label="Tipo">
            <option value="prato">Prato</option>
            <option value="acompanhamento">Acompanhamento</option>
            <option value="salada">Salada</option>
          </select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Ativo</label>
        </div>
        <div>
          <div className="mb-1 text-sm font-medium text-stone-700">Ingredientes por pessoa</div>
          <div className="space-y-1.5">
            {itens.map((i, k) => (
              <div key={k} className="flex items-center gap-2">
                <MaterialDoCadastro insumos={insumos} lista="materiais-prato" insumoId={i.insumoId ?? ''} textoInicial={i.insumoId ? '' : i.nome}
                  aoEscolher={(x) => mudar(k, { nome: x.nome, unidade: x.unidade, insumoId: x.id })} />
                <CampoNumero className={`${estiloEntrada} w-20! py-1.5! text-right`} valor={i.quantidade || null} aoMudar={(n) => mudar(k, { quantidade: n ?? 0 })} inputMode="decimal" aria-label={`Quantidade de ${i.nome}`} />
                <span className="w-8 text-sm text-stone-500">{i.unidade}</span>
                <button className="px-1 text-stone-400 hover:text-red-600" onClick={() => setItens((is) => is.filter((_, j) => j !== k))} aria-label="Tirar ingrediente">✕</button>
              </div>
            ))}
          </div>
          <Botao variante="secundario" className="mt-2 py-1.5!" onClick={() => setItens((is) => [...is, { nome: '', quantidade: 0, unidade: 'kg' }])}>+ Ingrediente</Botao>
          <datalist id="materiais-prato">{insumos.map((x) => <option key={x.id} value={x.nome} />)}</datalist>
          <p className="mt-1 text-xs text-stone-500">Quantidade por pessoa, na unidade do material. Só materiais do cadastro; se faltar algum, peça ao administrativo.</p>
        </div>
        <Campo rotulo="Modo de preparo">
          <textarea className={`${estiloEntrada} min-h-28`} value={modo} onChange={(e) => setModo(e.target.value)} />
        </Campo>
        <Botao className="w-full" disabled={salvando || !nome.trim()} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
      </div>
    </Modal>
  )
}

// Campo de material: só aceita o que está no cadastro (Heitor, 13/10). O que não existe some ao sair do campo,
// com o aviso de pedir o cadastro ao administrativo, para não criar material solto.
function MaterialDoCadastro({ insumos, lista, insumoId, aoEscolher, destaque = false, textoInicial = '' }: {
  insumos: Insumo[]; lista: string; insumoId: string; aoEscolher: (i: Insumo) => void; destaque?: boolean; textoInicial?: string
}) {
  const atual = insumos.find((i) => i.id === insumoId)
  const [texto, setTexto] = useState<string | null>(null)
  const [aviso, setAviso] = useState(false)
  const achar = (v: string) => insumos.find((i) => sem(i.nome) === sem(v))
  return (
    <div className="min-w-0 flex-[3]">
      <input
        className={`${estiloEntrada} py-1.5! ${destaque || aviso ? 'ring-2! ring-amber-400!' : ''}`}
        list={lista}
        aria-label="Material"
        placeholder="Escolha o material do cadastro"
        value={texto ?? atual?.nome ?? textoInicial}
        onChange={(e) => {
          const v = e.target.value
          const i = achar(v)
          setAviso(false)
          if (i) { setTexto(null); aoEscolher(i) } else setTexto(v)
        }}
        onBlur={() => {
          if (texto === null) return
          if (texto.trim()) setAviso(true)
          setTexto(null)
        }}
      />
      {aviso && <span className="text-xs text-amber-700">Não está no cadastro. Peça ao administrativo para cadastrar.</span>}
    </div>
  )
}
