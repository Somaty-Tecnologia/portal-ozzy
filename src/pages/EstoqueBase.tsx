import { useCallback, useEffect, useMemo, useState } from 'react'
import { Botao, Cartao, Modal, Vazio, estiloEntrada, Campo } from '../components/ui'
import { useOrdem } from '../components/Ordenar'
import { useApp } from '../lib/contexto'
import { nomeUnidade, qtd } from '../lib/custos'
import { hoje, tempoDesde } from '../lib/datas'
import { estoqueBase, type SaldoBase } from '../lib/logistica'
import type { EnvioEvento, Inventario, ItemContagem, ItemModeloChecklist, Operacao } from '../lib/types'
import { Contagem } from './EventoLogistica'

interface Dados {
  itens: ItemContagem[]
  contagens: Inventario[]
  envios: EnvioEvento[]
  modelo: ItemModeloChecklist[]
  operacoes: Operacao[]
}

// Estoque da base (Central) e itens fixos do checklist de eventos.
export default function EstoqueBase() {
  const { store, avisar, nomeDe } = useApp()
  const [d, setD] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const [contando, setContando] = useState(false)
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<ItemModeloChecklist | 'novo' | null>(null)
  const [filtroOp, setFiltroOp] = useState('')
  const carregar = useCallback(async () => {
    try {
      const [itens, contagens, envios, modelo, operacoes] = await Promise.all([store.itensContagem(), store.inventarios({ local: 'base' }), store.envios(), store.modeloChecklist(), store.operacoes()])
      setD({ itens, contagens, envios, modelo, operacoes })
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [store])
  useEffect(() => {
    carregar()
  }, [carregar])
  const saldo = useMemo(() => (d ? estoqueBase(d.contagens, d.envios) : new Map()), [d])

  if (erro) return <p className="text-red-600">{erro}</p>
  if (!d) return <p className="text-stone-400">Carregando…</p>
  if (contando)
    return (
      <Contagem
        titulo="Contagem do estoque da base"
        itens={d.itens}
        primeiro={[...saldo.keys()]}
        aoCancelar={() => setContando(false)}
        aoSalvar={async (itens, fala, obs) => {
          await store.salvarInventario('base', null, hoje(), itens, fala, obs)
          await carregar()
          setContando(false)
          avisar('Contagem da base salva')
        }}
      />
    )

  const linhas = d.itens
    .filter((i) => saldo.has(i.chave))
    .filter((i) => !busca || i.nome.toLowerCase().includes(busca.toLowerCase()))
  const categorias = [...new Set(d.modelo.map((m) => m.categoria))]
  const nomeOp = (id: string | null) => (id ? d.operacoes.find((o) => o.id === id)?.nome ?? id : 'Todas as operações')
  const doFiltro = (m: ItemModeloChecklist) => !filtroOp || (filtroOp === '-' ? !m.operacaoId : m.operacaoId === filtroOp)

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <h2 className="text-lg font-bold">Estoque da base</h2>
            <p className="text-sm text-stone-600">Última contagem de cada item menos o que saiu para eventos depois dela (conferido na separação). Conte de novo quando a carga voltar.</p>
          </div>
          <Botao className="sm:ml-auto" onClick={() => setContando(true)}>Contar estoque</Botao>
        </div>
        {saldo.size === 0 ? (
          <Vazio>Nenhuma contagem da base ainda. Faça a primeira (pode ser falando): a separação passa a avisar quando faltar item.</Vazio>
        ) : (
          <>
            <input className={`${estiloEntrada} sm:w-72!`} placeholder="Buscar item" value={busca} onChange={(ev) => setBusca(ev.target.value)} aria-label="Buscar item no estoque" />
            <TabelaSaldo linhas={linhas} saldo={saldo} />
          </>
        )}
        {d.contagens.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-stone-600">Contagens anteriores ({d.contagens.length})</summary>
            <ul className="mt-2 space-y-1">
              {d.contagens.map((c) => (
                <li key={c.id} className="text-stone-600">
                  {new Date(c.contadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {nomeDe(c.contadoPor)} · {c.itens.length} itens
                  {c.observacao && ` · ${c.observacao}`}
                  {c.fala && <span className="block text-xs text-stone-400">Falado: “{c.fala}”</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <h2 className="text-lg font-bold">Itens fixos do checklist</h2>
            <p className="text-sm text-stone-600">
              Vão na primeira separação do evento (equipamentos, utensílios, embalagens, limpeza…). Cada item é de uma operação: o evento só leva os itens das operações que vão para ele, mais os de todas as operações. Alimentos e bebidas não entram aqui: saem da previsão × fichas.
            </p>
          </div>
          <Botao variante="secundario" className="sm:ml-auto" onClick={() => setEditando('novo')}>+ Item</Botao>
        </div>
        <div className="flex flex-wrap gap-1">
          {[['', 'Tudo'], ...d.operacoes.filter((o) => o.ativa).map((o) => [o.id, o.nome]), ['-', 'Todas as operações']].map(([id, nome]) => (
            <button key={id} onClick={() => setFiltroOp(id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${filtroOp === id ? 'bg-carvao text-white' : 'text-stone-600 hover:bg-stone-200'}`}>
              {nome} <span className="opacity-60">{d.modelo.filter((m) => (!id ? true : id === '-' ? !m.operacaoId : m.operacaoId === id)).length}</span>
            </button>
          ))}
        </div>
        {categorias.filter((c) => d.modelo.some((m) => m.categoria === c && doFiltro(m))).map((c) => (
          <Cartao key={c}>
            <h3 className="mb-1 text-xs font-bold tracking-wide text-stone-500 uppercase">{c}</h3>
            <ul className="divide-y divide-stone-100 text-sm">
              {d.modelo.filter((m) => m.categoria === c && doFiltro(m)).map((m) => (
                <li key={m.id} className={`flex items-center gap-2 py-1.5 ${m.ativo ? '' : 'opacity-50'}`}>
                  <span className="flex-1">
                    <b>{m.item}</b>
                    <span className={`ml-1.5 rounded px-1.5 text-xs ${m.operacaoId ? 'bg-ozzy-100 text-stone-800' : 'bg-stone-100 text-stone-600'}`}>{nomeOp(m.operacaoId)}</span>
                    {m.operacao && <span className="ml-1 rounded bg-stone-100 px-1.5 text-xs text-stone-600">{m.operacao}</span>}
                    {!m.ativo && <span className="ml-1.5 text-xs">(não vai)</span>}
                  </span>
                  <span className="text-stone-600">{m.quantidade}</span>
                  <button className="text-xs font-semibold text-stone-500 hover:text-carvao" onClick={() => setEditando(m)}>Editar</button>
                </li>
              ))}
            </ul>
          </Cartao>
        ))}
      </section>

      {editando && (
        <EditarItemModelo
          m={editando === 'novo' ? null : editando}
          categorias={categorias}
          operacoes={d.operacoes}
          proximaOrdem={Math.max(0, ...d.modelo.map((m) => m.ordem)) + 1}
          aoFechar={() => setEditando(null)}
          aoSalvar={async () => {
            setEditando(null)
            await carregar()
            avisar('Item salvo')
          }}
        />
      )}
    </div>
  )
}

function TabelaSaldo({ linhas, saldo }: { linhas: ItemContagem[]; saldo: Map<string, SaldoBase> }) {
  const posicao = new Map(linhas.map((i, k) => [i.chave, k]))
  const { ordenada, cabecalho } = useOrdem(linhas, {
    ordem: (i) => posicao.get(i.chave), nome: (i) => i.nome, contado: (i) => saldo.get(i.chave)?.contado, saiu: (i) => saldo.get(i.chave)?.saiu || null,
    saldo: (i) => saldo.get(i.chave)?.saldo, contadoEm: (i) => saldo.get(i.chave)?.contadoEm,
  }, { col: 'ordem' })
  const num = 'px-2! text-right'
  return (
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
      <table className="w-full text-sm">
        <thead className="bg-stone-50 text-left text-xs text-stone-500">
          <tr>
            {cabecalho('nome', 'Item')}
            {cabecalho('contado', 'Contado', num, true)}
            {cabecalho('saiu', 'Saiu depois', num, true)}
            {cabecalho('saldo', 'Saldo', num, true)}
            {cabecalho('contadoEm', 'Contado', 'px-2!', true)}
          </tr>
        </thead>
        <tbody>
          {ordenada.map((i) => {
            const s = saldo.get(i.chave)!
            return (
              <tr key={i.chave} className="border-t border-stone-100">
                <td className="px-3 py-1.5 font-semibold">{i.nome} <span className="font-normal text-stone-400">{nomeUnidade(i.unidade)}</span></td>
                <td className="px-2 py-1.5 text-right">{qtd(s.contado)}</td>
                <td className="px-2 py-1.5 text-right text-stone-600">{s.saiu ? qtd(Math.round(s.saiu * 100) / 100) : '—'}</td>
                <td className={`px-2 py-1.5 text-right font-bold ${s.saldo <= 0 ? 'text-red-600' : ''}`}>{qtd(Math.round(s.saldo * 100) / 100)}</td>
                <td className="px-2 py-1.5 text-xs text-stone-500">{tempoDesde(s.contadoEm)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EditarItemModelo({ m, categorias, operacoes, proximaOrdem, aoFechar, aoSalvar }: {
  m: ItemModeloChecklist | null
  categorias: string[]
  operacoes: Operacao[]
  proximaOrdem: number
  aoFechar: () => void
  aoSalvar: () => void
}) {
  const { store } = useApp()
  const [f, setF] = useState({ categoria: m?.categoria ?? '', item: m?.item ?? '', operacao: m?.operacao ?? '', operacaoId: m?.operacaoId ?? '', quantidade: m?.quantidade ?? '', ativo: m?.ativo ?? true })
  const [erro, setErro] = useState('')
  const salvar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!f.item.trim() || !f.categoria.trim()) return setErro('Preencha o item e a categoria.')
    try {
      await store.salvarItemModelo({ id: m?.id, categoria: f.categoria, item: f.item, operacao: f.operacao || null, operacaoId: f.operacaoId || null, quantidade: f.quantidade || null, ordem: m?.ordem ?? proximaOrdem, ativo: f.ativo })
      aoSalvar()
    } catch (err) {
      setErro((err as Error).message)
    }
  }
  return (
    <Modal titulo={m ? 'Editar item fixo' : 'Novo item fixo'} aberto aoFechar={aoFechar}>
      <form onSubmit={salvar} className="space-y-3">
        <Campo rotulo="Item">
          <input className={estiloEntrada} value={f.item} onChange={(ev) => setF({ ...f, item: ev.target.value })} required />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Categoria">
            <input className={estiloEntrada} list="cats-modelo" value={f.categoria} onChange={(ev) => setF({ ...f, categoria: ev.target.value })} required />
            <datalist id="cats-modelo">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
          </Campo>
          <Campo rotulo="Praça" dica="Foca, Pizza, Romana… Vazio = todas">
            <input className={estiloEntrada} list="pracas" value={f.operacao} onChange={(ev) => setF({ ...f, operacao: ev.target.value })} />
            <datalist id="pracas">{['Foca', 'Pizza', 'Romana'].map((c) => <option key={c} value={c} />)}</datalist>
          </Campo>
        </div>
        <Campo rotulo="Operação" dica="O evento só leva os itens das operações que vão para ele.">
          <select className={estiloEntrada} value={f.operacaoId} onChange={(ev) => setF({ ...f, operacaoId: ev.target.value })}>
            <option value="">Todas as operações (vai sempre)</option>
            {operacoes.filter((o) => o.ativa || o.id === f.operacaoId).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Quantidade" dica="Livre: 2, 3 caixas, Todas">
          <input className={estiloEntrada} value={f.quantidade} onChange={(ev) => setF({ ...f, quantidade: ev.target.value })} />
        </Campo>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.ativo} onChange={(ev) => setF({ ...f, ativo: ev.target.checked })} /> Vai em todo evento
        </label>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full">Salvar</Botao>
      </form>
    </Modal>
  )
}
