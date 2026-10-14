import { useCallback, useEffect, useMemo, useState } from 'react'
import { Botao, Campo, CampoNumero, Modal, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { addDias, dataCurta, diaSemana, hoje } from '../lib/datas'
import { mostrarQtd, reais } from '../lib/financeiro'
import { MaterialDoCadastro } from './Refeicoes'
import FichasProntas, { type FichaResolvida } from '../components/FichasProntasRefeicao'
import { podeGerenciar } from '../lib/permissoes'
import { ir } from '../lib/rota'
import type { Insumo, PreparoRefeicao, Producao } from '../lib/types'

// Pré-preparo das refeições (Heitor, 13/10): feijão, arroz e afins são feitos à parte com os ingredientes deles.
// Lançar "Fiz agora" tira os ingredientes do estoque da Central e põe o preparo pronto lá, com o custo do dia;
// em "Montar o prato" o preparo pronto entra como ingrediente ("Feijão (refeição)").

type Item = { insumoId: string; quantidade: number | null }

// Rascunho do cadastro (Heitor, 13/10): sair para cadastrar um material novo não perde o que já foi digitado.
interface Rascunho { id: string | null; nome: string; unidade: string; rendimento: number | null; itens: Item[]; modo: string; ativo: boolean }
const CHAVE_RASCUNHO = 'preparo-refeicao-rascunho'
const lerRascunho = (): Rascunho | null => { try { return JSON.parse(localStorage.getItem(CHAVE_RASCUNHO) ?? 'null') } catch { return null } }
const gravarRascunho = (r: Rascunho | null) => { try { if (r) localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(r)); else localStorage.removeItem(CHAVE_RASCUNHO) } catch { /* sem armazenamento */ } }

export default function PreparosRefeicao() {
  const { store, avisar } = useApp()
  const [preparos, setPreparos] = useState<PreparoRefeicao[] | null>(null)
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [lotes, setLotes] = useState<Producao[]>([])
  const [editando, setEditando] = useState<PreparoRefeicao | 'novo' | null>(null)
  const [fazendo, setFazendo] = useState<PreparoRefeicao | null>(null)
  const carregar = useCallback(async () => {
    try {
      const [p, i, l] = await Promise.all([store.preparosRefeicao(), store.insumos(), store.lotesPreparoRefeicao(addDias(hoje(), -30), hoje())])
      setPreparos(p)
      setInsumos(i)
      setLotes(l)
    } catch (e) {
      avisar((e as Error).message)
    }
  }, [store, avisar])
  useEffect(() => { carregar() }, [carregar])
  // Voltou com rascunho guardado: reabre o cadastro onde parou.
  useEffect(() => {
    const r = lerRascunho()
    if (!r || !preparos || editando) return
    setEditando(r.id ? preparos.find((p) => p.id === r.id) ?? 'novo' : 'novo')
  }, [preparos]) // eslint-disable-line react-hooks/exhaustive-deps
  const porId = useMemo(() => new Map(insumos.map((i) => [i.id, i])), [insumos])
  const custoReceita = (p: { itens: { insumoId: string; quantidade: number | null }[] }) => p.itens.reduce((t, i) => t + (i.quantidade ?? 0) * (porId.get(i.insumoId)?.preco ?? 0), 0)
  if (!preparos) return <p className="text-stone-400">Carregando…</p>
  const desfazer = async (l: Producao) => {
    if (!confirm('Desfazer este lançamento? Os ingredientes voltam para o estoque e o preparo sai.')) return
    try {
      await store.desfazerPreparoRefeicao(l.id)
      await carregar()
    } catch (e) {
      avisar((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm text-stone-600">Feijão, arroz e o que mais for feito à parte. Cadastre os ingredientes e quanto rende; cada vez que fizer, toque em “Fiz agora”. O pronto entra no estoque da Central e aparece em “Montar o prato” como ingrediente, já com o custo.</p>
        <Botao onClick={() => setEditando('novo')}>+ Pré-preparo</Botao>
      </div>
      {preparos.length === 0 ? <Vazio>Nenhum pré-preparo cadastrado.</Vazio> : (
        <div className="grid gap-2 sm:grid-cols-2">
          {preparos.map((p) => {
            const custo = custoReceita(p)
            return (
              <div key={p.id} className={`space-y-2 rounded-2xl bg-white p-3 ring-1 ring-stone-200 ${p.ativo ? '' : 'opacity-50'}`}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{p.nome}{!p.ativo && ' (inativo)'}</div>
                    <div className="text-xs text-stone-500">{p.itens.map((i) => `${porId.get(i.insumoId)?.nome ?? '?'} ${mostrarQtd(i.quantidade)} ${porId.get(i.insumoId)?.unidade ?? ''}`).join(' · ')}</div>
                    <div className="text-sm text-stone-600">Rende {mostrarQtd(p.rendimento)} {p.unidade}{custo > 0 && <> · ≈ <b>{reais(custo / p.rendimento)}</b>/{p.unidade}</>}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {p.ativo && <Botao className="py-1.5!" onClick={() => setFazendo(p)}>Fiz agora</Botao>}
                  <Botao variante="secundario" className="py-1.5!" onClick={() => setEditando(p)}>Editar</Botao>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <section className="space-y-2">
        <h3 className="font-bold">Feitos nos últimos 30 dias</h3>
        {lotes.length === 0 ? <Vazio>Nenhum pré-preparo lançado.</Vazio> : (
          <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs text-stone-500">
                <tr><th className="px-3 py-1.5">Dia</th><th className="px-3 py-1.5">Preparo</th><th className="px-3 py-1.5 text-right">Ficou pronto</th><th className="px-3 py-1.5 text-right">Custo</th><th className="px-3 py-1.5 text-right">Por unidade</th><th /></tr>
              </thead>
              <tbody>
                {lotes.map((l) => {
                  const p = preparos.find((x) => x.id === l.refeicaoPreparoId)
                  return (
                    <tr key={l.id} className="border-t border-stone-100">
                      <td className="px-3 py-1.5 whitespace-nowrap">{diaSemana(l.data)} {dataCurta(l.data)}</td>
                      <td className="px-3 py-1.5 font-semibold">{p?.nome ?? porId.get(l.insumoId)?.nome}{l.observacao && <span className="block text-xs font-normal text-stone-500">{l.observacao}</span>}</td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">{mostrarQtd(l.quantidade)} {p?.unidade ?? ''}</td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">{l.custoTotal != null ? reais(l.custoTotal) : '—'}</td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">{l.custoTotal ? reais(l.custoTotal / l.quantidade) : '—'}</td>
                      <td className="px-3 py-1.5 text-right"><button className="text-xs font-semibold text-stone-500 underline" onClick={() => desfazer(l)}>Desfazer</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editando && <EditarPreparo preparo={editando === 'novo' ? null : editando} insumos={insumos} aoFechar={() => setEditando(null)} aoSalvar={async () => { setEditando(null); await carregar() }} />}
      {fazendo && <FizAgora preparo={fazendo} porId={porId} aoFechar={() => setFazendo(null)} aoSalvar={async () => { setFazendo(null); await carregar() }} />}
    </div>
  )
}

function FizAgora({ preparo, porId, aoFechar, aoSalvar }: { preparo: PreparoRefeicao; porId: Map<string, Insumo>; aoFechar: () => void; aoSalvar: () => void }) {
  const { store, avisar } = useApp()
  const [vezes, setVezes] = useState<number | null>(1)
  const [itens, setItens] = useState<Item[]>(preparo.itens.map((i) => ({ ...i })))
  const [pronto, setPronto] = useState<number | null>(preparo.rendimento)
  const [data, setData] = useState(hoje())
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)
  // Mais de uma receita: multiplica os ingredientes e o rendimento (dá para ajustar depois).
  const multiplicar = (n: number | null) => {
    setVezes(n)
    if (!n || n <= 0) return
    setItens(preparo.itens.map((i) => ({ insumoId: i.insumoId, quantidade: Math.round(i.quantidade * n * 1000) / 1000 })))
    setPronto(Math.round(preparo.rendimento * n * 1000) / 1000)
  }
  const custo = itens.reduce((t, i) => t + (i.quantidade ?? 0) * (porId.get(i.insumoId)?.preco ?? 0), 0)
  const salvar = async () => {
    if (!pronto) return avisar('Diga quanto ficou pronto.')
    setSalvando(true)
    try {
      await store.lancarPreparoRefeicao({ preparoId: preparo.id, data, quantidade: pronto, saidas: itens.filter((i) => i.quantidade).map((i) => ({ insumoId: i.insumoId, quantidade: i.quantidade! })), observacao: obs })
      avisar(`${preparo.nome} lançado: ${mostrarQtd(pronto)} ${preparo.unidade} na Central`)
      aoSalvar()
    } catch (e) {
      avisar((e as Error).message)
      setSalvando(false)
    }
  }
  return (
    <Modal titulo={`Fiz ${preparo.nome.toLowerCase()}`} aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Quantas receitas"><CampoNumero className={estiloEntrada} valor={vezes} aoMudar={multiplicar} inputMode="decimal" aria-label="Quantas receitas" /></Campo>
          <Campo rotulo="Dia"><input type="date" className={estiloEntrada} value={data} max={hoje()} onChange={(e) => e.target.value && setData(e.target.value)} /></Campo>
        </div>
        <div>
          <div className="mb-1 text-sm font-medium text-stone-700">Ingredientes usados (saem da Central)</div>
          <div className="space-y-1.5">
            {itens.map((i, k) => (
              <div key={i.insumoId} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{porId.get(i.insumoId)?.nome ?? '?'}</span>
                <CampoNumero className={`${estiloEntrada} w-24! py-1.5! text-right`} valor={i.quantidade} aoMudar={(n) => setItens((is) => is.map((x, j) => (j === k ? { ...x, quantidade: n } : x)))} inputMode="decimal" aria-label={`Quantidade de ${porId.get(i.insumoId)?.nome}`} />
                <span className="w-8 text-stone-500">{porId.get(i.insumoId)?.unidade}</span>
              </div>
            ))}
          </div>
        </div>
        <Campo rotulo={`Quanto ficou pronto (${preparo.unidade})`}>
          <CampoNumero className={estiloEntrada} valor={pronto} aoMudar={setPronto} inputMode="decimal" aria-label="Quanto ficou pronto" />
        </Campo>
        <p className="text-sm text-stone-600">Custo {reais(custo)}{pronto ? <> · <b>{reais(custo / pronto)}</b> por {preparo.unidade}</> : ''}</p>
        <Campo rotulo="Observação (opcional)"><input className={estiloEntrada} value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
        {preparo.modoPreparo && <p className="rounded-xl bg-ozzy-50 p-3 text-sm ring-1 ring-ozzy-400/40"><b>Modo de preparo:</b> {preparo.modoPreparo}</p>}
        <Botao className="w-full" disabled={salvando} onClick={salvar}>{salvando ? 'Lançando…' : 'Lançar'}</Botao>
      </div>
    </Modal>
  )
}

function EditarPreparo({ preparo, insumos, aoFechar, aoSalvar }: { preparo: PreparoRefeicao | null; insumos: Insumo[]; aoFechar: () => void; aoSalvar: () => void }) {
  const { store, eu, avisar } = useApp()
  const ativos = insumos.filter((i) => i.ativo && i.id !== preparo?.insumoId)
  const [salvo] = useState(() => { const r = lerRascunho(); return r && r.id === (preparo?.id ?? null) ? r : null })
  const [nome, setNome] = useState(salvo?.nome ?? preparo?.nome ?? '')
  const [unidade, setUnidade] = useState(salvo?.unidade ?? preparo?.unidade ?? 'kg')
  const [rendimento, setRendimento] = useState<number | null>(salvo ? salvo.rendimento : preparo?.rendimento ?? null)
  const [itens, setItens] = useState<Item[]>(salvo?.itens ?? (preparo?.itens.length ? preparo.itens.map((i) => ({ ...i })) : [{ insumoId: '', quantidade: null }]))
  const [modo, setModo] = useState(salvo?.modo ?? preparo?.modoPreparo ?? '')
  const [ativo, setAtivo] = useState(salvo?.ativo ?? preparo?.ativo ?? true)
  const [salvando, setSalvando] = useState(false)
  // Começar de uma ficha pronta (Heitor, 14/10): ingredientes já ligados ao cadastro, para N porções.
  const [fichas, setFichas] = useState(false)
  const [porcoes, setPorcoes] = useState<number | null>(20)
  const usarFicha = (f: FichaResolvida) => {
    const n = porcoes || 1
    setFichas(false)
    setMexeu(true)
    if (!nome.trim()) setNome(f.nome)
    if (!modo.trim()) setModo(f.modo)
    setItens((is) => [...is.filter((i) => i.insumoId), ...f.itens.filter((i) => i.insumo).map((i) => ({ insumoId: i.insumo!.id, quantidade: Math.round(i.quantidade * n * 1000) / 1000 }))])
    if (f.faltam.length) avisar(`Falta no cadastro: ${f.faltam.join(', ')}. Peça ao administrativo.`)
  }
  // Cada mudança fica guardada até salvar ou descartar.
  const [mexeu, setMexeu] = useState(!!salvo)
  useEffect(() => {
    if (mexeu) gravarRascunho({ id: preparo?.id ?? null, nome, unidade, rendimento, itens, modo, ativo })
  }, [mexeu, preparo, nome, unidade, rendimento, itens, modo, ativo])
  const descartar = () => { gravarRascunho(null); aoFechar() }
  const mudar = (k: number, x: Partial<Item>) => { setMexeu(true); setItens((is) => is.map((i, j) => (j === k ? { ...i, ...x } : i))) }
  const salvar = async () => {
    setSalvando(true)
    try {
      await store.salvarPreparoRefeicao({ id: preparo?.id, nome, unidade, rendimento: rendimento ?? 0, modoPreparo: modo, ativo,
        itens: itens.filter((i) => i.insumoId && i.quantidade).map((i) => ({ insumoId: i.insumoId, quantidade: i.quantidade! })) })
      gravarRascunho(null)
      avisar('Pré-preparo salvo')
      aoSalvar()
    } catch (e) {
      avisar((e as Error).message)
      setSalvando(false)
    }
  }
  return (
    <Modal titulo={preparo ? preparo.nome : 'Novo pré-preparo'} aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        {salvo && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-ozzy-50 px-3 py-2 text-sm ring-1 ring-ozzy-400/60">
            <span className="flex-1">Continuando o rascunho que você deixou.</span>
            <button className="font-semibold text-stone-600 underline" onClick={descartar}>Descartar rascunho</button>
          </div>
        )}
        {!preparo && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 text-sm ring-1 ring-stone-200">
            <span>Começar de uma ficha pronta, para</span>
            <CampoNumero className={`${estiloEntrada} w-16! py-1! text-right`} valor={porcoes} aoMudar={setPorcoes} inputMode="numeric" aria-label="Porções" />
            <span>porções</span>
            <Botao variante="secundario" className="py-1.5!" onClick={() => setFichas(true)}>📖 Fichas prontas</Botao>
          </div>
        )}
        {fichas && <FichasProntas insumos={insumos} vezes={porcoes || 1} rotulo="porções" aoUsar={usarFicha} aoFechar={() => setFichas(false)} />}
        <Campo rotulo="Nome (ex.: Feijão, Arroz, Vinagrete)"><input className={estiloEntrada} value={nome} onChange={(e) => { setMexeu(true); setNome(e.target.value) }} /></Campo>
        <div>
          <div className="mb-1 text-sm font-medium text-stone-700">Ingredientes de uma receita</div>
          <datalist id="materiais-preparo">{ativos.map((x) => <option key={x.id} value={x.nome} />)}</datalist>
          <div className="space-y-1.5">
            {itens.map((i, k) => (
              <div key={k} className="flex items-center gap-2">
                <MaterialDoCadastro insumos={ativos} lista="materiais-preparo" insumoId={i.insumoId} aoEscolher={(x) => mudar(k, { insumoId: x.id })} />
                <CampoNumero className={`${estiloEntrada} w-20! py-1.5! text-right`} valor={i.quantidade} aoMudar={(n) => mudar(k, { quantidade: n })} inputMode="decimal" aria-label="Quantidade" />
                <span className="w-8 text-sm text-stone-500">{insumos.find((x) => x.id === i.insumoId)?.unidade ?? ''}</span>
                <button className="px-1 text-stone-400 hover:text-red-600" onClick={() => { setMexeu(true); setItens((is) => is.filter((_, j) => j !== k)) }} aria-label="Tirar ingrediente">✕</button>
              </div>
            ))}
          </div>
          <Botao variante="secundario" className="mt-2 py-1.5!" onClick={() => { setMexeu(true); setItens((is) => [...is, { insumoId: '', quantidade: null }]) }}>+ Ingrediente</Botao>
          <p className="mt-1 text-xs text-stone-500">
            Só materiais do cadastro. Faltou algum? {podeGerenciar(eu.nivel)
              ? <button className="font-semibold underline" onClick={() => { setMexeu(true); gravarRascunho({ id: preparo?.id ?? null, nome, unidade, rendimento, itens, modo, ativo }); ir('cadastros') }}>Cadastrar material novo</button>
              : 'Peça ao administrativo.'} O que você já preencheu fica guardado como rascunho.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Uma receita rende" dica={!rendimento ? 'Pese depois de pronto e coloque aqui.' : undefined}><CampoNumero className={estiloEntrada} valor={rendimento} aoMudar={(n) => { setMexeu(true); setRendimento(n) }} inputMode="decimal" aria-label="Rendimento" /></Campo>
          <Campo rotulo="Unidade">
            <select className={estiloEntrada} value={unidade} onChange={(e) => { setMexeu(true); setUnidade(e.target.value) }}>
              <option value="kg">kg</option><option value="l">litro</option><option value="un">unidade</option>
            </select>
          </Campo>
        </div>
        <Campo rotulo="Modo de preparo (opcional)"><textarea className={`${estiloEntrada} min-h-24`} value={modo} onChange={(e) => { setMexeu(true); setModo(e.target.value) }} /></Campo>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ativo} onChange={(e) => { setMexeu(true); setAtivo(e.target.checked) }} /> Ativo</label>
        <Botao className="w-full" disabled={salvando || !nome.trim()} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
      </div>
    </Modal>
  )
}
