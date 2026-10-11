import { Fragment, useEffect, useState } from 'react'
import { Avatar, Cartao, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useOrdem } from '../components/Ordenar'
import { useApp } from '../lib/contexto'
import { isentoDeRotinas } from '../lib/permissoes'
import { ir } from '../lib/rota'
import { EXIGENCIAS, apelidoUnidade, type Documento, type Funcionario } from '../lib/types'
import { AVISO_DIAS, corSituacao, exigenciasDe, iconeSituacao, pendencias, textoSituacao, type Situacao } from '../lib/vencimentos'

// Controle de exames da equipe (só a gestão: são dados de saúde).
export default function Vencimentos() {
  const { store, equipe, unidades } = useApp()
  const [docs, setDocs] = useState<Documento[] | null>(null)
  const [unidade, setUnidade] = useState('')
  const [verTodos, setVerTodos] = useState(false)

  useEffect(() => {
    store.documentosTodos().then(setDocs)
  }, [store])

  if (!docs) return <p className="text-sm text-stone-500">Carregando…</p>
  const pessoas = equipe.filter((p) => p.status === 'ativo' && !isentoDeRotinas(p.nivel) && (!unidade || p.unidadeId === unidade)).sort((a, b) => a.nome.localeCompare(b.nome))
  const lista = pendencias(pessoas, docs)
  const conta = (s: Situacao) => lista.filter((x) => x.item.situacao === s).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Exames da equipe</h1>
          <p className="text-sm text-stone-500">ASO, coprocultura e coproparasitológico de quem está ativo. Aviso começa {AVISO_DIAS} dias antes de vencer.</p>
        </div>
        <select className={`${estiloEntrada} w-full! sm:w-auto!`} value={unidade} onChange={(e) => setUnidade(e.target.value)} aria-label="Loja">
          <option value="">Todas as lojas</option>
          {unidades.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
      </div>

      <ResumoNumeros vencidos={conta('vencido')} faltando={conta('faltando')} vencendo={conta('vence_logo')} />

      <div className="flex gap-1 rounded-xl bg-stone-200 p-1 text-sm font-semibold">
        <button onClick={() => setVerTodos(false)} className={`flex-1 rounded-lg py-2 ${!verTodos ? 'bg-white shadow-sm' : 'text-stone-600'}`}>
          Com pendência ({new Set(lista.map((x) => x.pessoa.id)).size})
        </button>
        <button onClick={() => setVerTodos(true)} className={`flex-1 rounded-lg py-2 ${verTodos ? 'bg-white shadow-sm' : 'text-stone-600'}`}>
          Todos ({pessoas.length})
        </button>
      </div>

      {!verTodos ? (
        lista.length === 0 ? (
          <Vazio>Tudo em dia.</Vazio>
        ) : (
          <div className="space-y-2">
            {[...new Set(lista.map((x) => x.pessoa.id))].map((id) => {
              const itens = lista.filter((x) => x.pessoa.id === id)
              const pessoa = itens[0].pessoa
              return (
                <Cartao key={id} onClick={() => ir('rh/equipe/' + id)}>
                  <div className="flex items-start gap-3">
                    <Avatar nome={pessoa.nome} foto={pessoa.fotoUrl} tamanho={36} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{pessoa.nome}</div>
                      <div className="truncate text-xs text-stone-500">
                        {pessoa.cargo} · {apelidoUnidade(unidades.find((u) => u.id === pessoa.unidadeId)?.nome ?? '')}
                      </div>
                      <ul className="mt-2 space-y-1">
                        {itens.map(({ item }) => (
                          <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-sm">
                            <span>{item.nome}</span>
                            <Selo cor={corSituacao[item.situacao]}>
                              {iconeSituacao[item.situacao]} {textoSituacao(item)}
                            </Selo>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Cartao>
              )
            })}
          </div>
        )
      ) : (
        <TabelaExames pessoas={pessoas} docs={docs} />
      )}
    </div>
  )
}

// Exame: o que falta primeiro, depois o que vence antes.
function TabelaExames({ pessoas, docs }: { pessoas: Funcionario[]; docs: Documento[] }) {
  const itensDe = (p: Funcionario) => exigenciasDe(docs.filter((d) => d.funcionarioId === p.id), p)
  const { ordenada, cabecalho } = useOrdem(pessoas, {
    nome: (p) => p.nome,
    ...Object.fromEntries(EXIGENCIAS.map((e) => [e.id, (p: Funcionario) => {
      const i = itensDe(p).find((x) => x.id === e.id)
      return !i ? null : i.situacao === 'faltando' ? '0000' : i.vence ?? '9999'
    }])),
  }, { col: 'nome' })
  return (
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-left text-stone-500">
            {cabecalho('nome', 'Funcionário')}
            {EXIGENCIAS.map((e) => <Fragment key={e.id}>{cabecalho(e.id, e.nome)}</Fragment>)}
          </tr>
        </thead>
        <tbody>
          {ordenada.map((p) => (
            <tr key={p.id} className="border-b border-stone-100 last:border-0">
              <td className="px-3 py-2">
                <button onClick={() => ir('rh/equipe/' + p.id)} className="text-left font-semibold hover:underline">
                  {p.nome}
                </button>
                <div className="text-xs text-stone-500">{p.cargo}</div>
              </td>
              {itensDe(p).map((i) => (
                <td key={i.id} className="px-3 py-2">
                  <Selo cor={corSituacao[i.situacao]}>
                    {iconeSituacao[i.situacao]} {textoSituacao(i)}
                  </Selo>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ResumoNumeros({ vencidos, faltando, vencendo, aoClicar }: { vencidos: number; faltando: number; vencendo: number; aoClicar?: () => void }) {
  const caixa = 'rounded-2xl p-3 text-left ring-1'
  const C = aoClicar ? 'button' : 'div'
  return (
    <div className="grid grid-cols-3 gap-2">
      <C onClick={aoClicar} className={`${caixa} ${vencidos ? 'bg-red-50 ring-red-200' : 'bg-stone-50 ring-stone-200'}`}>
        <div className="text-xs text-stone-600 sm:text-sm">✕ Vencidos</div>
        <div className={`mt-1 text-2xl font-bold sm:text-3xl ${vencidos ? 'text-red-700' : ''}`}>{vencidos}</div>
      </C>
      <C onClick={aoClicar} className={`${caixa} ${faltando ? 'bg-red-50 ring-red-200' : 'bg-stone-50 ring-stone-200'}`}>
        <div className="text-xs text-stone-600 sm:text-sm">✕ Não enviados</div>
        <div className={`mt-1 text-2xl font-bold sm:text-3xl ${faltando ? 'text-red-700' : ''}`}>{faltando}</div>
      </C>
      <C onClick={aoClicar} className={`${caixa} ${vencendo ? 'bg-ozzy-100 ring-ozzy-600/40' : 'bg-stone-50 ring-stone-200'}`}>
        <div className="text-xs text-stone-600 sm:text-sm">! Vencem em {AVISO_DIAS} dias</div>
        <div className="mt-1 text-2xl font-bold sm:text-3xl">{vencendo}</div>
      </C>
    </div>
  )
}
