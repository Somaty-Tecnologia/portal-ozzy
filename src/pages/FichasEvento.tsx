import { useCallback, useEffect, useMemo, useState } from 'react'
import { Botao, Campo, Cartao, Modal, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import ImprimirFichas from '../components/FichaImpressa'
import { useOrdem } from '../components/Ordenar'
import AnaliseCmv from './AnaliseCmv'
import { cmv, custoFicha, custoItens, montarCatalogo, nomeUnidade, qtd, qtdLegivel, reais, usadoEm, type Catalogo } from '../lib/custos'
import { dataLonga } from '../lib/datas'
import { lerNumero } from '../lib/financeiro'
import { ir } from '../lib/rota'
import { ORIGEM_PRODUTO, type Insumo, type ItemReceita, type Operacao, type OrigemProduto, type Receita, type TipoReceita, type UnidadeMedida, type VersaoReceita, type AreaFicha } from '../lib/types'

const numero = lerNumero
const doNumero = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n).replace('.', ','))
const inteiro = (s: string) => (s.trim() === '' ? null : Math.max(0, Math.round(Number(s.replace(',', '.')))))

// As mesmas telas servem a Fichas técnicas (lojas, #/fichas) e a Eventos › Fichas (#/eventos/fichas).
const baseFichas = () => (location.hash.startsWith('#/fichas') ? 'fichas' : 'eventos/fichas')

interface Dados {
  area: AreaFicha
  insumos: Insumo[]
  receitas: Receita[]
  versoes: VersaoReceita[]
  operacoes: Operacao[]
  cat: Catalogo
}

// Fichas técnicas de eventos: produtos vendidos e pré-preparos, com versões e custo calculado.
export default function FichasEvento({ id, area = 'eventos' }: { id?: string; area?: AreaFicha }) {
  const { store } = useApp()
  const [d, setD] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const carregar = useCallback(async () => {
    try {
      const [insumos, receitas, versoes, operacoes] = await Promise.all([store.insumos(), store.receitas(), store.versoesReceitas(), store.operacoes()])
      setD({ area, insumos, receitas, versoes, operacoes, cat: montarCatalogo(insumos, receitas, versoes) })
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [store, area])
  useEffect(() => {
    carregar()
  }, [carregar])

  if (erro) return <p className="text-red-600">{erro}</p>
  if (!d) return <p className="text-stone-400">Carregando…</p>
  if (id) {
    const r = d.receitas.find((x) => x.id === id)
    if (!r) return <Vazio>Ficha não encontrada. <button className="font-semibold underline" onClick={() => ir(baseFichas())}>Voltar</button></Vazio>
    return <PaginaFicha r={r} d={d} aoMudar={carregar} />
  }
  return <ListaFichas d={d} aoMudar={carregar} />
}

function ListaFichas({ d, aoMudar }: { d: Dados; aoMudar: () => Promise<void> }) {
  const { avisar } = useApp()
  const [tipo, setTipo] = useState<TipoReceita | 'cmv'>('produto')
  const [linha, setLinha] = useState('')
  const [busca, setBusca] = useState('')
  const [inativas, setInativas] = useState(false)
  const [nova, setNova] = useState(false)
  const [imprimir, setImprimir] = useState<Receita[] | null>(null)
  const [lote, setLote] = useState(false)
  // Produto é de uma área (lojas ou eventos); pré-preparo serve para todos.
  const daArea = (r: Receita) => r.tipo === 'preparo' || (r.area ?? 'eventos') === d.area
  const linhas = [...new Set(d.receitas.filter((r) => daArea(r) && r.tipo === tipo).map((r) => r.linha).filter(Boolean) as string[])].sort()
  const termo = busca.trim().toLowerCase()
  const lista = useMemo(() => d.receitas
    .filter((r) => r.tipo === tipo && daArea(r) && (inativas || r.ativo) && (!linha || r.linha === linha) && (!termo || r.nome.toLowerCase().includes(termo) || r.ecleticaCodigo === termo))
    .map((r) => {
      const c = custoFicha(d.cat, r.id)
      return { r, c, pct: c ? cmv(c.porUnidade, r.precoVenda) : null }
    }), [d, tipo, inativas, linha, termo])
  const { ordenada, cabecalho } = useOrdem(lista, {
    nome: (x) => x.r.nome, linha: (x) => x.r.linha, custo: (x) => x.c?.porUnidade, preco: (x) => x.r.precoVenda, cmv: (x) => x.pct,
  }, { col: 'nome' })
  const conta = (t: TipoReceita) => d.receitas.filter((r) => r.tipo === t && daArea(r) && (inativas || r.ativo)).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['produto', 'preparo'] as const).map((t) => (
          <button key={t} onClick={() => setTipo(t)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tipo === t ? 'bg-carvao text-white' : 'text-stone-600 hover:bg-stone-200'}`}>
            {t === 'produto' ? 'Produtos' : 'Pré-preparos'} <span className="opacity-60">{conta(t)}</span>
          </button>
        ))}
        {d.area === 'lojas' && (
          <button onClick={() => setTipo('cmv')} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tipo === 'cmv' ? 'bg-carvao text-white' : 'text-stone-600 hover:bg-stone-200'}`}>Análise de CMV</button>
        )}
        {tipo !== 'cmv' && <div className="ml-auto flex gap-2">
          {tipo === 'preparo' && (
            <Botao variante="secundario" disabled={!lista.some(({ r }) => r.versaoAtual > 0)} onClick={() => setImprimir(lista.map(({ r }) => r).filter((r) => r.versaoAtual > 0))}>
              Imprimir {lista.filter(({ r }) => r.versaoAtual > 0).length === 1 ? 'a ficha' : `as ${lista.filter(({ r }) => r.versaoAtual > 0).length} fichas`}
            </Botao>
          )}
          <Botao variante="secundario" onClick={() => setLote(true)}>Trocar ingrediente em lote</Botao>
          <Botao onClick={() => setNova(true)}>+ Nova ficha</Botao>
        </div>}
      </div>
      {tipo === 'cmv' ? <AnaliseCmv cat={d.cat} receitas={d.receitas} /> : <>
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${estiloEntrada} basis-full py-2! sm:basis-0 sm:flex-1`} placeholder={d.area === 'lojas' ? 'Buscar por nome ou código' : 'Buscar ficha'} value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar ficha" />
        <select className={`${estiloEntrada} w-auto! py-2!`} value={linha} onChange={(e) => setLinha(e.target.value)} aria-label="Linha">
          <option value="">{d.area === 'lojas' && tipo === 'produto' ? 'Todos os grupos' : 'Todas as linhas'}</option>
          {linhas.map((l) => <option key={l}>{l}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input type="checkbox" className="accent-carvao" checked={inativas} onChange={(e) => setInativas(e.target.checked)} /> Mostrar inativas
        </label>
      </div>

      {lista.length === 0 ? (
        <Vazio>Nenhuma ficha {tipo === 'produto' ? 'de produto' : 'de pré-preparo'} neste filtro.</Vazio>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs text-stone-500">
              <tr>
                {cabecalho('nome', 'Ficha')}
                {cabecalho('linha', d.area === 'lojas' && tipo === 'produto' ? 'Grupo' : 'Linha', 'hidden sm:table-cell')}
                {cabecalho('custo', 'Custo', 'text-right', true)}
                {tipo === 'produto' && cabecalho('preco', 'Preço', 'text-right', true)}
                {tipo === 'produto' && cabecalho('cmv', 'CMV', 'text-right', true)}
              </tr>
            </thead>
            <tbody>
              {ordenada.map(({ r, c, pct }) => {
                return (
                  <tr key={r.id} onClick={() => ir(baseFichas() + '/' + r.id)} className="cursor-pointer border-t border-stone-100 hover:bg-stone-50">
                    <td className="px-3 py-2">
                      <div className="font-semibold">{r.nome} {!r.ativo && <Selo>Inativa</Selo>}</div>
                      <div className="text-xs text-stone-500">
                        {r.linha && <span className="sm:hidden">{r.linha} · </span>}
                        {[r.ecleticaCodigo && `cód. ${r.ecleticaCodigo}`, r.tipo === 'produto' && d.area === 'eventos' ? ORIGEM_PRODUTO[r.origem] : null, r.versaoAtual ? `versão ${r.versaoAtual}` : 'sem composição']
                          .filter(Boolean).join(' · ')}
                        {c && c.semPreco.length > 0 && <span className="font-semibold text-amber-700"> · {c.semPreco.length} sem preço</span>}
                      </div>
                    </td>
                    <td className="hidden px-3 py-2 text-stone-600 sm:table-cell">{r.linha ?? '—'}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{c ? `${reais(c.porUnidade)}/${nomeUnidade(r.unidade)}` : '—'}</td>
                    {tipo === 'produto' && <td className="px-3 py-2 text-right whitespace-nowrap">{r.precoVenda !== null ? reais(r.precoVenda) : '—'}</td>}
                    {tipo === 'produto' && (
                      <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${pct !== null && pct > 35 ? 'text-red-700' : ''}`}>{pct !== null ? `${pct.toFixed(1).replace('.', ',')}%` : '—'}</td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-stone-500">O custo usa o preço atual de cada insumo e o aproveitamento de cada item. O CMV fica em vermelho acima de 35%.</p>
      </>}

      {lote && <TrocarEmLote d={d} aoFechar={() => setLote(false)} aoSalvar={async (n) => { setLote(false); await aoMudar(); avisar(`Trocado em ${n} ${n === 1 ? 'ficha' : 'fichas'}`) }} />}
      {imprimir && <ImprimirFichas fichas={imprimir} cat={d.cat} aoFechar={() => setImprimir(null)} />}
      {nova && (
        <EditarDadosFicha
          r={null}
          area={d.area}
          tipoInicial={tipo === 'cmv' ? 'produto' : tipo}
          operacoes={d.operacoes}
          linhas={linhas}
          aoFechar={() => setNova(false)}
          aoSalvar={async (salva) => {
            setNova(false)
            await aoMudar()
            avisar('Ficha criada. Agora monte a composição.')
            ir(baseFichas() + '/' + salva.id)
          }}
        />
      )}
    </div>
  )
}

function PaginaFicha({ r, d, aoMudar }: { r: Receita; d: Dados; aoMudar: () => Promise<void> }) {
  const { nomeDe, avisar } = useApp()
  const [editandoDados, setEditandoDados] = useState(false)
  const [editandoComposicao, setEditandoComposicao] = useState(false)
  const [verVersao, setVerVersao] = useState<VersaoReceita | null>(null)
  const [imprimindo, setImprimindo] = useState(false)
  const versoes = d.versoes.filter((v) => v.receitaId === r.id).sort((a, b) => b.numero - a.numero)
  const atual = d.cat.atual.get(r.id) ?? null
  const c = custoFicha(d.cat, r.id)
  const pct = c ? cmv(c.porUnidade, r.precoVenda) : null
  const usos = usadoEm(d.cat, { receitaId: r.id })
  const nomeOp = (id: string | null) => d.operacoes.find((o) => o.id === id)?.nome

  return (
    <div className="space-y-4">
      <button onClick={() => ir(baseFichas())} className="text-sm font-semibold text-stone-500 hover:text-carvao">← Fichas</button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-stone-400">
            {r.tipo === 'produto' ? 'Produto' : 'Pré-preparo'}
            {r.linha && ` · ${r.linha}`}{r.ecleticaCodigo && ` · cód. Eclética ${r.ecleticaCodigo}`} · versão {r.versaoAtual}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{r.nome}</h1>
          {!r.ativo && <Selo>Inativa</Selo>}
        </div>
        <div className="flex flex-wrap gap-2">
          {atual && <Botao variante="secundario" onClick={() => setImprimindo(true)}>Imprimir ficha</Botao>}
          <Botao variante="secundario" onClick={() => setEditandoDados(true)}>Editar dados</Botao>
          <Botao onClick={() => setEditandoComposicao(true)}>{atual ? 'Alterar composição' : 'Montar composição'}</Botao>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Numero rotulo={`Custo por ${nomeUnidade(r.unidade)}`} valor={c ? reais(c.porUnidade) : '—'} />
        {r.tipo === 'produto' ? (
          <>
            <Numero rotulo="Preço de venda padrão" valor={r.precoVenda !== null ? reais(r.precoVenda) : '—'} />
            <Numero rotulo="CMV" valor={pct !== null ? `${pct.toFixed(1).replace('.', ',')}%` : '—'} alerta={pct !== null && pct > 35} />
            <Numero rotulo="Margem por unidade" valor={c && r.precoVenda !== null ? reais(r.precoVenda - c.porUnidade) : '—'} />
          </>
        ) : (
          <>
            <Numero rotulo="Rende por receita" valor={atual ? `${qtd(atual.rendimento)} ${nomeUnidade(r.unidade)}` : '—'} />
            <Numero rotulo="Custo da receita" valor={c ? reais(c.total) : '—'} />
            <Numero rotulo="Usado em" valor={`${usos.length} ficha${usos.length === 1 ? '' : 's'}`} />
          </>
        )}
      </div>

      {c && c.semPreco.length > 0 && (
        <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <b>Custo incompleto:</b> sem preço em {c.semPreco.join(', ')}. Cadastre o preço em Insumos.
        </div>
      )}

      <Cartao>
        <h2 className="mb-2 font-bold">Composição {atual && <span className="text-sm font-normal text-stone-500">(versão {atual.numero}, rende {qtd(atual.rendimento)} {nomeUnidade(r.unidade)})</span>}</h2>
        {!atual || !c ? (
          <p className="text-sm text-stone-500">Ainda sem composição. Use “Montar composição”.</p>
        ) : (
          <TabelaItens c={c} />
        )}
      </Cartao>

      <div className="grid gap-3 md:grid-cols-2">
        <Cartao>
          <h2 className="mb-2 font-bold">Dados</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {r.tipo === 'produto' && (<><dt className="text-stone-500">Origem</dt><dd>{ORIGEM_PRODUTO[r.origem]}</dd></>)}
            {(r.area ?? 'eventos') === 'eventos' && (<><dt className="text-stone-500">Operação</dt><dd>{nomeOp(r.operacaoId) ?? '—'}</dd></>)}
            <dt className="text-stone-500">Preparo</dt><dd>{r.tempoPreparoMin !== null ? `${r.tempoPreparoMin} min` : '—'}</dd>
            <dt className="text-stone-500">Finalização</dt><dd>{r.tempoFinalizacaoMin !== null ? `${r.tempoFinalizacaoMin} min` : '—'}</dd>
            <dt className="text-stone-500">Capacidade</dt><dd>{r.capacidadeHora !== null ? `${r.capacidadeHora} por hora` : '—'}</dd>
            <dt className="text-stone-500">Equipamentos</dt><dd>{r.equipamentos ?? '—'}</dd>
            <dt className="text-stone-500">Conservação</dt><dd>{r.conservacao ?? '—'}</dd>
            <dt className="text-stone-500">Validade</dt><dd>{r.validadeDias !== null ? `${r.validadeDias} dias` : '—'}</dd>
            {r.porcaoNome && r.porcaoQtd && (<><dt className="text-stone-500">Porção</dt><dd>{r.porcaoNome} de {qtdLegivel(r.porcaoQtd, r.unidade)}</dd></>)}
            {r.responsavel && (<><dt className="text-stone-500">Responsável</dt><dd>{r.responsavel}</dd></>)}
          </dl>
          {r.observacoes && (
            <>
              <h3 className="mt-3 mb-1 text-sm font-bold">Observações</h3>
              <p className="text-sm whitespace-pre-line text-stone-700">{r.observacoes}</p>
            </>
          )}
          {r.modoPreparo && (
            <>
              <h3 className="mt-3 mb-1 text-sm font-bold">Modo de preparo</h3>
              <p className="text-sm whitespace-pre-line text-stone-700">{r.modoPreparo}</p>
            </>
          )}
        </Cartao>
        <Cartao>
          <h2 className="mb-2 font-bold">Versões</h2>
          {versoes.length === 0 && <p className="text-sm text-stone-500">Nenhuma ainda.</p>}
          <ul className="space-y-2 text-sm">
            {versoes.map((v) => (
              <li key={v.id}>
                <button className="text-left hover:underline" onClick={() => setVerVersao(v)}>
                  <b>Versão {v.numero}</b>
                  {v.numero === r.versaoAtual && <span className="ml-1 text-xs text-emerald-700">em uso</span>}
                  <span className="text-stone-500"> · {dataLonga(v.criadaEm)}{v.criadaPor && ` · ${nomeDe(v.criadaPor)}`}</span>
                  {v.custoTotal !== null && <span className="text-stone-500"> · custo na época {reais(v.custoTotal / v.rendimento)}</span>}
                </button>
                {v.nota && <div className="text-stone-600">{v.nota}</div>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-stone-500">Alterar a composição cria uma versão nova. As anteriores ficam como estavam, para os eventos que já usaram.</p>
        </Cartao>
      </div>

      {usos.length > 0 && (
        <Cartao>
          <h2 className="mb-2 font-bold">Usado nas fichas</h2>
          <div className="flex flex-wrap gap-1.5">
            {usos.map((u) => (
              <button key={u.id} onClick={() => ir(baseFichas() + '/' + u.id)} className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold hover:bg-stone-200">{u.nome}</button>
            ))}
          </div>
        </Cartao>
      )}

      {imprimindo && <ImprimirFichas fichas={[r]} cat={d.cat} aoFechar={() => setImprimindo(false)} />}
      {editandoDados && (
        <EditarDadosFicha
          r={r}
          area={r.area ?? 'eventos'}
          tipoInicial={r.tipo}
          operacoes={d.operacoes}
          linhas={[...new Set(d.receitas.map((x) => x.linha).filter(Boolean) as string[])].sort()}
          aoFechar={() => setEditandoDados(false)}
          aoSalvar={async () => {
            setEditandoDados(false)
            await aoMudar()
            avisar('Ficha atualizada')
          }}
        />
      )}
      {editandoComposicao && (
        <EditarComposicao
          r={r}
          d={d}
          aoFechar={() => setEditandoComposicao(false)}
          aoSalvar={async (n) => {
            setEditandoComposicao(false)
            await aoMudar()
            avisar(`Versão ${n} salva e em uso`)
          }}
        />
      )}
      {verVersao && (
        <Modal titulo={`${r.nome}: versão ${verVersao.numero}`} aberto aoFechar={() => setVerVersao(null)}>
          <p className="mb-3 text-sm text-stone-600">
            Salva em {dataLonga(verVersao.criadaEm)}{verVersao.criadaPor && ` por ${nomeDe(verVersao.criadaPor)}`}. Rende {qtd(verVersao.rendimento)} {nomeUnidade(r.unidade)}.
            {verVersao.custoTotal !== null && ` Custo na época: ${reais(verVersao.custoTotal / verVersao.rendimento)} por ${nomeUnidade(r.unidade)}.`}
          </p>
          <TabelaItens c={custoItens(d.cat, verVersao.itens, verVersao.rendimento, [r.id])} legenda="Custos com os preços de hoje." />
        </Modal>
      )}
    </div>
  )
}

function Numero({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
      <div className="text-xs text-stone-500">{rotulo}</div>
      <div className={`text-lg font-bold ${alerta ? 'text-red-700' : ''}`}>{valor}</div>
    </div>
  )
}

function TabelaItens({ c, legenda }: { c: ReturnType<typeof custoItens>; legenda?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-stone-500">
          <tr>
            <th className="py-1 pr-2 font-semibold">Item</th>
            <th className="py-1 pr-2 text-right font-semibold">Qtd</th>
            <th className="py-1 pr-2 text-right font-semibold">Aprov.</th>
            <th className="hidden py-1 pr-2 text-right font-semibold sm:table-cell">Preço</th>
            <th className="py-1 text-right font-semibold">Custo</th>
          </tr>
        </thead>
        <tbody>
          {c.itens.map((l, i) => (
            <tr key={i} className="border-t border-stone-100">
              <td className="py-1.5 pr-2">
                {l.item.subReceitaId ? (
                  <button className="font-semibold underline decoration-stone-300 hover:decoration-carvao" onClick={() => ir(baseFichas() + '/' + l.item.subReceitaId)}>{l.nome}</button>
                ) : (
                  l.nome
                )}
                {l.item.subReceitaId && <span className="ml-1 text-xs text-stone-400"> ficha</span>}
                {l.item.soDelivery && <span className="ml-1 rounded bg-stone-100 px-1 text-xs text-stone-500">só delivery</span>}
                {l.precoUnit === null && <span className="ml-1 text-xs font-semibold text-amber-700 sm:hidden"> sem preço</span>}
              </td>
              <td className="py-1.5 pr-2 text-right whitespace-nowrap">{qtd(l.item.quantidade)} {nomeUnidade(l.unidade)}</td>
              <td className="py-1.5 pr-2 text-right">{l.item.aproveitamento < 1 ? `${Math.round(l.item.aproveitamento * 100)}%` : '—'}</td>
              <td className="hidden py-1.5 pr-2 text-right whitespace-nowrap sm:table-cell">{l.precoUnit !== null ? `${reais(l.precoUnit)}/${nomeUnidade(l.unidade)}` : <span className="font-semibold text-amber-700">sem preço</span>}</td>
              <td className="py-1.5 text-right whitespace-nowrap">{l.custo !== null ? reais(l.custo) : '—'}</td>
            </tr>
          ))}
          <tr className="border-t border-stone-300 font-bold">
            <td className="py-1.5" colSpan={3}>Total</td>
            <td className="hidden sm:table-cell" />
            <td className="py-1.5 text-right">{reais(c.total)}</td>
          </tr>
        </tbody>
      </table>
      {legenda && <p className="mt-1 text-xs text-stone-500">{legenda}</p>}
    </div>
  )
}

function EditarDadosFicha({ r, area, tipoInicial, operacoes, linhas, aoFechar, aoSalvar }: {
  r: Receita | null
  area: AreaFicha
  tipoInicial: TipoReceita
  operacoes: Operacao[]
  linhas: string[]
  aoFechar: () => void
  aoSalvar: (salva: Receita) => void
}) {
  const { store } = useApp()
  const [f, setF] = useState({
    nome: r?.nome ?? '', tipo: r?.tipo ?? tipoInicial, linha: r?.linha ?? '', operacaoId: r?.operacaoId ?? '', origem: r?.origem ?? 'propria',
    unidade: r?.unidade ?? (tipoInicial === 'produto' ? 'un' : 'kg'), precoVenda: doNumero(r?.precoVenda), tempoPreparoMin: doNumero(r?.tempoPreparoMin),
    tempoFinalizacaoMin: doNumero(r?.tempoFinalizacaoMin), capacidadeHora: doNumero(r?.capacidadeHora), equipamentos: r?.equipamentos ?? '',
    conservacao: r?.conservacao ?? '', validadeDias: doNumero(r?.validadeDias), modoPreparo: r?.modoPreparo ?? '',
    observacoes: r?.observacoes ?? '', responsavel: r?.responsavel ?? '', porcaoNome: r?.porcaoNome ?? '', porcaoQtd: doNumero(r?.porcaoQtd),
    lotes: (r?.lotes ?? []).map((n) => doNumero(n)).join('; '),
  })
  const [ativo, setAtivo] = useState(r?.ativo ?? true)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const mudar = (c: keyof typeof f) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [c]: ev.target.value })
  const produto = f.tipo === 'produto'

  const salvar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!f.nome.trim()) return setErro('Dê um nome à ficha.')
    const preco = numero(f.precoVenda)
    if (preco !== null && (Number.isNaN(preco) || preco < 0)) return setErro('Confira o preço de venda.')
    const porcao = numero(f.porcaoQtd)
    if (porcao !== null && !(porcao > 0)) return setErro('Confira o tamanho da porção.')
    const lotes = f.lotes.split(/[;\s]+/).filter(Boolean).map(numero)
    if (lotes.some((n) => n === null || !(n > 0))) return setErro('Confira as quantidades para imprimir (ex.: 1; 2; 5).')
    setSalvando(true)
    try {
      aoSalvar(
        await store.salvarReceita({
          id: r?.id, nome: f.nome, tipo: f.tipo as TipoReceita, linha: f.linha || null, operacaoId: f.operacaoId || null, origem: f.origem as OrigemProduto,
          unidade: (produto ? 'un' : f.unidade) as UnidadeMedida, precoVenda: produto ? preco : null, tempoPreparoMin: inteiro(f.tempoPreparoMin),
          tempoFinalizacaoMin: inteiro(f.tempoFinalizacaoMin), capacidadeHora: inteiro(f.capacidadeHora), equipamentos: f.equipamentos || null,
          conservacao: f.conservacao || null, validadeDias: inteiro(f.validadeDias), modoPreparo: f.modoPreparo.trim() || null, ativo, area: r?.area ?? area,
          observacoes: f.observacoes.trim() || null, responsavel: f.responsavel.trim() || null, porcaoNome: porcao ? f.porcaoNome.trim() || 'porções' : null,
          porcaoQtd: porcao, lotes: lotes as number[],
        }),
      )
    } catch (e) {
      setErro((e as Error).message)
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={r ? 'Editar dados da ficha' : 'Nova ficha'} aberto aoFechar={aoFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <Campo rotulo="Nome">
          <input className={estiloEntrada} value={f.nome} onChange={mudar('nome')} required />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Tipo">
            <select className={estiloEntrada} value={f.tipo} onChange={mudar('tipo')} disabled={!!r}>
              <option value="produto">Produto (vendido)</option>
              <option value="preparo">Pré-preparo</option>
            </select>
          </Campo>
          <Campo rotulo="Linha">
            <input className={estiloEntrada} list="linhas-ficha" value={f.linha} onChange={mudar('linha')} placeholder="Foca, Pizza…" />
            <datalist id="linhas-ficha">{linhas.map((l) => <option key={l} value={l} />)}</datalist>
          </Campo>
        </div>
        {produto ? (
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Origem">
              <select className={estiloEntrada} value={f.origem} onChange={mudar('origem')}>
                {Object.entries(ORIGEM_PRODUTO).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Preço de venda padrão (R$)" dica="Cada evento pode ter o seu.">
              <input className={estiloEntrada} inputMode="decimal" value={f.precoVenda} onChange={mudar('precoVenda')} placeholder="0,00" />
            </Campo>
          </div>
        ) : (
          <Campo rotulo="Unidade do que a receita rende">
            <select className={estiloEntrada} value={f.unidade} onChange={mudar('unidade')}>
              <option value="kg">kg</option>
              <option value="l">litro</option>
              <option value="un">unidade</option>
            </select>
          </Campo>
        )}
        {area === 'eventos' && (
          <Campo rotulo="Operação">
            <select className={estiloEntrada} value={f.operacaoId} onChange={mudar('operacaoId')}>
              <option value="">—</option>
              {operacoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </Campo>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Campo rotulo="Preparo (min)">
            <input className={estiloEntrada} inputMode="numeric" value={f.tempoPreparoMin} onChange={mudar('tempoPreparoMin')} />
          </Campo>
          <Campo rotulo="Finalização (min)">
            <input className={estiloEntrada} inputMode="numeric" value={f.tempoFinalizacaoMin} onChange={mudar('tempoFinalizacaoMin')} />
          </Campo>
          <Campo rotulo="Por hora">
            <input className={estiloEntrada} inputMode="numeric" value={f.capacidadeHora} onChange={mudar('capacidadeHora')} placeholder="Capacidade" />
          </Campo>
        </div>
        <Campo rotulo="Equipamentos necessários">
          <input className={estiloEntrada} value={f.equipamentos} onChange={mudar('equipamentos')} placeholder="Forno, chapa…" />
        </Campo>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Campo rotulo="Conservação">
            <input className={estiloEntrada} value={f.conservacao} onChange={mudar('conservacao')} placeholder="Refrigerado até 5 °C…" />
          </Campo>
          <Campo rotulo="Validade (dias)">
            <input className={estiloEntrada} inputMode="numeric" value={f.validadeDias} onChange={mudar('validadeDias')} />
          </Campo>
        </div>
        <Campo rotulo="Modo de preparo" dica="Um passo por linha. Linha terminando em “:” vira título de etapa (ex.: Empanamento:).">
          <textarea className={estiloEntrada} rows={6} value={f.modoPreparo} onChange={mudar('modoPreparo')} />
        </Campo>
        <Campo rotulo="Observações" dica="Sai num quadro de destaque na ficha impressa (ex.: se o molho desandar…).">
          <textarea className={estiloEntrada} rows={2} value={f.observacoes} onChange={mudar('observacoes')} />
        </Campo>
        {!produto && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Porção (nome)" dica="Potinhos, seringas, porções…">
                <input className={estiloEntrada} value={f.porcaoNome} onChange={mudar('porcaoNome')} placeholder="potinhos" />
              </Campo>
              <Campo rotulo={`Cada porção (${nomeUnidade(f.unidade)})`} dica={f.unidade === 'kg' ? '30 g = 0,03' : undefined}>
                <input className={estiloEntrada} inputMode="decimal" value={f.porcaoQtd} onChange={mudar('porcaoQtd')} />
              </Campo>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo={`Colunas da ficha impressa (${nomeUnidade(f.unidade)})`} dica="Quanto fazer em cada coluna. Vazio: 1, 2, 3 e 4 receitas.">
                <input className={estiloEntrada} value={f.lotes} onChange={mudar('lotes')} placeholder="1; 2; 5; 10" />
              </Campo>
              <Campo rotulo="Responsável pela ficha">
                <input className={estiloEntrada} value={f.responsavel} onChange={mudar('responsavel')} />
              </Campo>
            </div>
          </>
        )}
        {r && (
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="size-5 accent-carvao" checked={!ativo} onChange={(ev) => setAtivo(!ev.target.checked)} />
            Inativar (sai das listas; o histórico continua)
          </label>
        )}
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
      </form>
    </Modal>
  )
}

interface Linha {
  ref: string // 'i:<id>' insumo, 'r:<id>' pré-preparo
  quantidade: string
  aproveitamento: string // em %
  texto?: string // o que está digitado no campo (enquanto não casa com um item)
  soDelivery?: boolean
}

function EditarComposicao({ r, d, aoFechar, aoSalvar }: { r: Receita; d: Dados; aoFechar: () => void; aoSalvar: (numero: number) => void }) {
  const { store } = useApp()
  const atual = d.cat.atual.get(r.id)
  const [linhas, setLinhas] = useState<Linha[]>(
    atual?.itens.map((i) => ({ ref: i.insumoId ? 'i:' + i.insumoId : 'r:' + i.subReceitaId, quantidade: doNumero(i.quantidade), aproveitamento: doNumero(Math.round(i.aproveitamento * 1000) / 10), soDelivery: i.soDelivery })) ?? [
      { ref: '', quantidade: '', aproveitamento: '100' },
    ],
  )
  const [rendimento, setRendimento] = useState(doNumero(atual?.rendimento ?? 1))
  const [nota, setNota] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [novoRend, setNovoRend] = useState('')

  // Passar a receita para outra base (ex.: da Eclética, por 1 kg, para a receita da produção, que rende 1,7 kg):
  // multiplica tudo pela mesma conta, então o custo por kg não muda.
  const reescalar = () => {
    const alvo = numero(novoRend)
    const base = numero(rendimento)
    if (!alvo || !(alvo > 0) || !base || !(base > 0)) return setErro('Diga quanto a receita deve render.')
    const k = alvo / base
    const arred = (n: number) => Math.round(n * 10000) / 10000
    setLinhas(linhas.map((l) => (numero(l.quantidade) ? { ...l, quantidade: doNumero(arred(numero(l.quantidade)! * k)) } : l)))
    setRendimento(doNumero(alvo))
    setNovoRend('')
    setErro('')
  }

  const itens: ItemReceita[] = linhas
    .filter((l) => l.ref && (numero(l.quantidade) ?? 0) > 0)
    .map((l) => ({
      insumoId: l.ref.startsWith('i:') ? l.ref.slice(2) : null,
      subReceitaId: l.ref.startsWith('r:') ? l.ref.slice(2) : null,
      quantidade: numero(l.quantidade)!,
      aproveitamento: Math.min(1, Math.max(0.01, (numero(l.aproveitamento) ?? 100) / 100)),
      soDelivery: !!l.soDelivery,
    }))
  const rend = numero(rendimento) ?? 0
  const previa = useMemo(() => custoItens(d.cat, itens, rend || 1, [r.id]), [d.cat, JSON.stringify(itens), rend, r.id])
  const insumos = d.insumos.filter((i) => i.ativo || linhas.some((l) => l.ref === 'i:' + i.id))
  const preparos = d.receitas.filter((x) => x.tipo === 'preparo' && x.id !== r.id && (x.ativo || linhas.some((l) => l.ref === 'r:' + x.id)))
  // Busca digitando (pedido de 09/10): a lista com 40 pré-preparos em cima escondia os insumos.
  const opcoes = [
    ...insumos.map((x) => ({ ref: 'i:' + x.id, nome: x.nome })),
    ...preparos.map((p) => ({ ref: 'r:' + p.id, nome: p.nome + ' (pré-preparo)' })),
    // Combos da Eclética usam outros produtos como item.
    ...(r.tipo === 'produto' ? d.receitas.filter((x) => x.tipo === 'produto' && x.id !== r.id && (x.area ?? 'eventos') === (r.area ?? 'eventos')
      && (x.ativo || linhas.some((l) => l.ref === 'r:' + x.id))).map((p) => ({ ref: 'r:' + p.id, nome: p.nome + ' (produto)' })) : []),
  ]
  const porNome = new Map(opcoes.map((o) => [o.nome.toLowerCase(), o.ref]))
  const nomeDe = (ref: string) => opcoes.find((o) => o.ref === ref)?.nome ?? ''
  const unidadeDe = (ref: string) =>
    ref.startsWith('i:') ? nomeUnidade(d.cat.insumos.get(ref.slice(2))?.unidade ?? '') : ref.startsWith('r:') ? nomeUnidade(d.cat.receitas.get(ref.slice(2))?.unidade ?? '') : ''
  const mudar = (i: number, m: Partial<Linha>) => setLinhas(linhas.map((l, j) => (j === i ? { ...l, ...m } : l)))

  const salvar = async () => {
    if (linhas.some((l) => l.texto && !l.ref)) return setErro('Há item que não está na lista. Escolha da lista ou cadastre em Insumos.')
    if (!itens.length) return setErro('Inclua pelo menos um item com quantidade.')
    if (linhas.some((l) => l.ref && !((numero(l.quantidade) ?? 0) > 0))) return setErro('Há item sem quantidade.')
    if (!(rend > 0)) return setErro('O rendimento precisa ser maior que zero.')
    if (previa.ciclo) return setErro('Um pré-preparo desta ficha usa a própria ficha. Confira a composição.')
    setSalvando(true)
    try {
      aoSalvar(await store.salvarVersaoReceita(r.id, rend, Math.round(previa.total * 10000) / 10000, nota, itens))
    } catch (e) {
      setErro((e as Error).message)
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={`Composição: ${r.nome}`} aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        <p className="text-sm text-stone-600">Quantidade líquida por {r.tipo === 'produto' ? 'unidade vendida' : 'receita'}, na unidade do item. Aproveitamento: quanto sobra depois de limpar (cenoura 85%).</p>
        {linhas.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_5.5rem_4.5rem_auto] items-end gap-2">
            <Campo rotulo={i === 0 ? 'Item' : ' '}>
              <input
                list="itens-composicao"
                className={`${estiloEntrada} py-2!`}
                value={l.texto ?? nomeDe(l.ref)}
                placeholder="Digite o insumo ou pré-preparo"
                onChange={(e) => mudar(i, { texto: e.target.value, ref: porNome.get(e.target.value.trim().toLowerCase()) ?? '' })}
                onBlur={() => l.ref && mudar(i, { texto: undefined })}
                aria-label={`Item ${i + 1}`}
              />
            </Campo>
            <Campo rotulo={i === 0 ? 'Qtd' : ' '}>
              <div className="relative">
                <input className={`${estiloEntrada} py-2! pr-8!`} inputMode="decimal" value={l.quantidade} onChange={(e) => mudar(i, { quantidade: e.target.value })} aria-label={`Quantidade do item ${i + 1}`} />
                <span className="absolute top-1/2 right-2 -translate-y-1/2 text-xs text-stone-400">{unidadeDe(l.ref)}</span>
              </div>
            </Campo>
            <Campo rotulo={i === 0 ? 'Aprov. %' : ' '}>
              <input className={`${estiloEntrada} py-2!`} inputMode="decimal" value={l.aproveitamento} onChange={(e) => mudar(i, { aproveitamento: e.target.value })} aria-label={`Aproveitamento do item ${i + 1}`} />
            </Campo>
            <button type="button" onClick={() => setLinhas(linhas.filter((_, j) => j !== i))} className="mb-1 rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-red-600" aria-label={`Tirar item ${i + 1}`}>✕</button>
          </div>
        ))}
        <datalist id="itens-composicao">{opcoes.map((o) => <option key={o.ref} value={o.nome} />)}</datalist>
        {linhas.some((l) => l.texto && !l.ref) && <p className="text-xs text-amber-700">Algum item digitado não está cadastrado. Escolha da lista ou cadastre em Insumos.</p>}
        <Botao type="button" variante="secundario" onClick={() => setLinhas([...linhas, { ref: '', quantidade: '', aproveitamento: '100' }])}>+ Item</Botao>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo={`Rende (${nomeUnidade(r.unidade)})`} dica={r.tipo === 'produto' ? 'Normalmente 1 unidade.' : 'Quanto sai de uma receita.'}>
            <input className={estiloEntrada} inputMode="decimal" value={rendimento} onChange={(e) => setRendimento(e.target.value)} />
          </Campo>
          <div className="rounded-xl bg-stone-50 p-3 text-sm">
            <div className="text-xs text-stone-500">Custo desta versão</div>
            <div className="text-lg font-bold">{reais(previa.porUnidade)}/{nomeUnidade(r.unidade)}</div>
            {r.precoVenda && r.tipo === 'produto' && <div className="text-xs text-stone-500">CMV {cmv(previa.porUnidade, r.precoVenda)!.toFixed(1).replace('.', ',')}%</div>}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2 rounded-xl bg-stone-50 p-3">
          <Campo rotulo={`Recalcular para render (${nomeUnidade(r.unidade)})`} dica="Multiplica todos os itens. Use para passar a ficha para o tamanho da receita da produção.">
            <input className={`${estiloEntrada} w-32!`} inputMode="decimal" value={novoRend} onChange={(e) => setNovoRend(e.target.value)} aria-label="Recalcular para render" />
          </Campo>
          <Botao type="button" variante="secundario" onClick={reescalar} disabled={!novoRend.trim()}>Recalcular</Botao>
        </div>
        {previa.semPreco.length > 0 && <p className="text-xs text-amber-700">Sem preço: {previa.semPreco.join(', ')}.</p>}
        <Campo rotulo="O que mudou nesta versão">
          <input className={estiloEntrada} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: menos copa, mais crema" />
        </Campo>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : `Salvar como versão ${(r.versaoAtual ?? 0) + 1}`}</Botao>
      </div>
    </Modal>
  )
}

// Trocar em lote (Heitor, 13/10): um item (ex.: molho de tomate italiano) por outro em várias fichas de uma vez.
// Cada ficha marcada ganha uma versão nova, com a mesma quantidade (ou multiplicada, se a unidade mudar).
function TrocarEmLote({ d, aoFechar, aoSalvar }: { d: Dados; aoFechar: () => void; aoSalvar: (n: number) => void }) {
  const { store, avisar } = useApp()
  const opcoes = useMemo(() => [
    ...d.insumos.filter((x) => x.ativo).map((x) => ({ ref: 'i:' + x.id, nome: x.nome, un: nomeUnidade(x.unidade) })),
    ...d.receitas.filter((x) => x.tipo === 'preparo' && x.ativo).map((p) => ({ ref: 'r:' + p.id, nome: p.nome + ' (pré-preparo)', un: nomeUnidade(p.unidade) })),
  ].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [d])
  // O item que sai pode estar inativo: procura também entre todos os que aparecem nas fichas.
  const todas = useMemo(() => [
    ...d.insumos.map((x) => ({ ref: 'i:' + x.id, nome: x.nome, un: nomeUnidade(x.unidade) })),
    ...d.receitas.map((p) => ({ ref: 'r:' + p.id, nome: p.nome + (p.tipo === 'preparo' ? ' (pré-preparo)' : ' (produto)'), un: nomeUnidade(p.unidade) })),
  ], [d])
  const [saiTexto, setSaiTexto] = useState('')
  const [entraTexto, setEntraTexto] = useState('')
  const sai = todas.find((o) => o.nome.toLowerCase() === saiTexto.trim().toLowerCase())
  const entra = opcoes.find((o) => o.nome.toLowerCase() === entraTexto.trim().toLowerCase())
  const [fator, setFator] = useState('1')
  const [nota, setNota] = useState('')
  const [desmarcadas, setDesmarcadas] = useState<Set<string>>(new Set())
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const usa = (i: ItemReceita, ref: string) => (ref.startsWith('i:') ? i.insumoId === ref.slice(2) : i.subReceitaId === ref.slice(2))
  const fichas = useMemo(() => {
    if (!sai) return []
    return [...d.cat.atual.entries()]
      .map(([id, v]) => ({ r: d.cat.receitas.get(id)!, v, q: v.itens.filter((i) => usa(i, sai.ref)).reduce((s, i) => s + i.quantidade, 0) }))
      .filter((x) => x.r && x.v.itens.some((i) => usa(i, sai.ref)))
      .sort((a, b) => a.r.nome.localeCompare(b.r.nome, 'pt-BR'))
  }, [sai, d])
  const marcadas = fichas.filter((x) => !desmarcadas.has(x.r.id))
  const k = numero(fator)

  const novaComposicao = (v: VersaoReceita): ItemReceita[] => {
    const ref = entra!.ref
    const out: ItemReceita[] = []
    for (const i of v.itens) {
      if (!usa(i, sai!.ref)) { out.push(i); continue }
      const q = Math.round(i.quantidade * (k ?? 1) * 10000) / 10000
      const ja = out.find((x) => usa(x, ref))
      if (ja) ja.quantidade = Math.round((ja.quantidade + q) * 10000) / 10000
      else out.push({ ...i, insumoId: ref.startsWith('i:') ? ref.slice(2) : null, subReceitaId: ref.startsWith('r:') ? ref.slice(2) : null, quantidade: q })
    }
    return out
  }

  const trocar = async () => {
    if (!sai || !entra) return setErro('Escolha da lista o item que sai e o que entra.')
    if (sai.ref === entra.ref) return setErro('O item que entra é o mesmo que sai.')
    if (!k || !(k > 0)) return setErro('Confira a quantidade (multiplicar por).')
    if (!marcadas.length) return setErro('Marque pelo menos uma ficha.')
    setSalvando(true)
    setErro('')
    let feitas = 0
    const falhas: string[] = []
    for (const { r, v } of marcadas) {
      const itens = novaComposicao(v)
      const c = custoItens(d.cat, itens, v.rendimento, [r.id])
      if (c.ciclo) { falhas.push(`${r.nome} (o item novo usa esta ficha)`); continue }
      try {
        await store.salvarVersaoReceita(r.id, v.rendimento, Math.round(c.total * 10000) / 10000, nota.trim() || `Troca em lote: ${sai.nome} por ${entra.nome}`, itens)
        feitas++
      } catch (e) {
        falhas.push(`${r.nome} (${(e as Error).message})`)
      }
    }
    setSalvando(false)
    if (!feitas) return setErro(`Não deu em: ${falhas.join('; ')}.`)
    aoSalvar(feitas)
    if (falhas.length) setTimeout(() => avisar(`Não deu em: ${falhas.join('; ')}`), 1500)
  }

  return (
    <Modal titulo="Trocar ingrediente em lote" aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        <datalist id="lote-todos">{todas.map((o) => <option key={o.ref} value={o.nome} />)}</datalist>
        <datalist id="lote-entra">{opcoes.map((o) => <option key={o.ref} value={o.nome} />)}</datalist>
        <Campo rotulo="Item que sai" dica={sai ? `Está em ${fichas.length} ${fichas.length === 1 ? 'ficha' : 'fichas'}.` : 'Digite e escolha da lista.'}>
          <input list="lote-todos" className={estiloEntrada} value={saiTexto} onChange={(e) => { setSaiTexto(e.target.value); setDesmarcadas(new Set()) }} placeholder="Ex.: Molho de tomate italiano" autoFocus />
        </Campo>
        <Campo rotulo="Item que entra">
          <input list="lote-entra" className={estiloEntrada} value={entraTexto} onChange={(e) => setEntraTexto(e.target.value)} placeholder="Digite e escolha da lista" />
        </Campo>
        <div className="grid grid-cols-[8rem_1fr] items-end gap-3">
          <Campo rotulo="Multiplicar qtd por">
            <input className={estiloEntrada} inputMode="decimal" value={fator} onChange={(e) => setFator(e.target.value)} />
          </Campo>
          <p className="pb-2 text-xs text-stone-500">
            1 = mesma quantidade.
            {sai && entra && sai.un !== entra.un && <span className="font-semibold text-amber-700"> Atenção: sai em {sai.un} e entra em {entra.un}. Ajuste o número se precisar.</span>}
          </p>
        </div>
        {sai && (fichas.length === 0 ? (
          <p className="text-sm text-stone-500">Nenhuma ficha usa este item.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-xl ring-1 ring-stone-200">
            <label className="flex items-center gap-2 border-b border-stone-100 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-600">
              <input type="checkbox" className="accent-carvao" checked={marcadas.length === fichas.length}
                onChange={(e) => setDesmarcadas(e.target.checked ? new Set() : new Set(fichas.map((x) => x.r.id)))} />
              {marcadas.length} de {fichas.length} marcadas
            </label>
            {fichas.map(({ r, q }) => (
              <label key={r.id} className="flex items-center gap-2 border-b border-stone-100 px-3 py-1.5 text-sm last:border-0">
                <input type="checkbox" className="accent-carvao" checked={!desmarcadas.has(r.id)}
                  onChange={() => setDesmarcadas((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n })} />
                <span className="flex-1">{r.nome} {!r.ativo && <Selo>Inativa</Selo>}
                  <span className="text-xs text-stone-500"> · {r.tipo === 'preparo' ? 'pré-preparo' : (r.area ?? 'eventos') === 'lojas' ? 'lojas' : 'eventos'}</span>
                </span>
                <span className="text-xs whitespace-nowrap text-stone-500">{qtd(q)} {sai.un}{entra && k && k > 0 ? ` → ${qtd(Math.round(q * k * 10000) / 10000)} ${entra.un}` : ''}</span>
              </label>
            ))}
          </div>
        ))}
        <Campo rotulo="O que mudou (vai em cada versão nova)">
          <input className={estiloEntrada} value={nota} onChange={(e) => setNota(e.target.value)} placeholder={sai && entra ? `Troca em lote: ${sai.nome} por ${entra.nome}` : ''} />
        </Campo>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full" onClick={trocar} disabled={salvando || !sai || !entra || !marcadas.length}>
          {salvando ? 'Trocando…' : `Trocar em ${marcadas.length} ${marcadas.length === 1 ? 'ficha' : 'fichas'}`}
        </Botao>
        <p className="text-xs text-stone-500">Cada ficha ganha uma versão nova; as anteriores continuam no histórico.</p>
      </div>
    </Modal>
  )
}
