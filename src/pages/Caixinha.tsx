import { useEffect, useState } from 'react'
import { Avatar, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useOrdem } from '../components/Ordenar'
import { useApp } from '../lib/contexto'
import { addMeses, hoje, mesDe, nomeMesAno, primeiroDia, ultimoDia } from '../lib/datas'
import { lerNumero, reais } from '../lib/financeiro'
import { ir } from '../lib/rota'
import { MINIMO_BONUS_POR_SETOR, PESO_ADVERTENCIA, PONTOS_BONUS, PONTOS_CARGO, RETENCAO, UNIDADES_CAIXINHA, calcularCaixinha, type LinhaCaixinha } from '../lib/caixinha'
import { apelidoUnidade, type Ocorrencia } from '../lib/types'

const num = (n: number, casas = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

export default function Caixinha() {
  const { store, equipe, nomeUnidade, avisar } = useApp()
  // A caixinha é fechada no mês seguinte: abre no mês anterior.
  const [mes, setMes] = useState(addMeses(mesDe(hoje()), -1))
  const [totais, setTotais] = useState<Record<string, number>>({})
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [carregado, setCarregado] = useState(false)

  useEffect(() => {
    let vale = true
    setCarregado(false)
    Promise.all([store.caixinhaTotais(mes), store.ocorrenciasEntre(primeiroDia(mes), ultimoDia(mes))]).then(([t, o]) => {
      if (!vale) return
      setTotais(t)
      setOcorrencias(o)
      setCarregado(true)
    }, (e) => vale && avisar((e as Error).message))
    return () => { vale = false }
  }, [store, mes, avisar])

  const salvar = async (u: string, texto: string) => {
    const valor = lerNumero(texto) || 0
    setTotais({ ...totais, [u]: valor })
    await store.salvarCaixinhaTotal(mes, u, valor)
  }

  const { unidades, linhas, foraDaConta } = calcularCaixinha(equipe, ocorrencias, totais)
  const totalPago = linhas.reduce((s, l) => s + l.total, 0)
  const nome = (id: string) => equipe.find((p) => p.id === id)?.nome.split(' ')[0] ?? '?'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Caixinha</h1>
          <p className="text-sm text-stone-500">Parque São Domingos e Vila Anastácio. A Pizza não tem caixinha (só delivery).</p>
        </div>
        <div className="flex items-center rounded-xl bg-white ring-1 ring-stone-300">
          <button onClick={() => setMes(addMeses(mes, -1))} className="px-3 py-2 font-semibold text-stone-600 hover:text-carvao" aria-label="Mês anterior">
            ‹
          </button>
          <span className="min-w-36 text-center text-sm font-semibold first-letter:uppercase">{nomeMesAno(mes)}</span>
          <button onClick={() => setMes(addMeses(mes, 1))} disabled={mes >= mesDe(hoje())} className="px-3 py-2 font-semibold text-stone-600 hover:text-carvao disabled:opacity-30" aria-label="Próximo mês">
            ›
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {unidades.map((u) => (
          <div key={u.unidadeId} className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
            <div className="font-bold">{apelidoUnidade(nomeUnidade(u.unidadeId))}</div>
            <label className="mt-3 block text-sm text-stone-500" htmlFor={'cx-' + u.unidadeId}>
              Total arrecadado no mês
            </label>
            <input
              id={'cx-' + u.unidadeId}
              key={mes + u.unidadeId + carregado}
              className={`${estiloEntrada} mt-1 text-lg font-bold tabular-nums`}
              inputMode="decimal"
              defaultValue={u.total ? num(u.total, 2) : ''}
              placeholder="0,00"
              onBlur={(e) => salvar(u.unidadeId, e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-stone-500">Impostos ({RETENCAO * 100}%)</dt>
              <dd className="text-right tabular-nums">{reais(u.retido)}</dd>
              <dt className="text-stone-500">A dividir</dt>
              <dd className="text-right font-semibold tabular-nums">{reais(u.aDividir)}</dd>
              <dt className="text-stone-500">Total de pontos</dt>
              <dd className="text-right tabular-nums">{num(u.pontos)}</dd>
              <dt className="text-stone-500">Valor do ponto</dt>
              <dd className="text-right font-semibold tabular-nums">{reais(u.valorPonto)}</dd>
            </dl>
            <div className="mt-3 space-y-1.5 border-t border-stone-100 pt-3">
              {u.grupos.map((g) => (
                <div key={g.nome} className="text-sm">
                  <span className="font-semibold">{g.nome}</span> <span className="tabular-nums text-stone-500">({reais(g.valor)})</span>
                  <div className="text-stone-600">
                    {g.vencedores.length ? `${g.vencedores.map(nome).join(', ')}${g.vencedores.length > 1 ? ' dividem' : ''}` : 'Ninguém no grupo'}
                    {g.menorNota > 0 && <span className="text-stone-500"> · menor nota do grupo: {g.menorNota}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {!carregado ? (
        <p className="text-sm text-stone-500">Carregando…</p>
      ) : !unidades.some((u) => u.total) ? (
        <Vazio>Lance o total arrecadado de cada loja para ver a divisão.</Vazio>
      ) : (
        <>
          {UNIDADES_CAIXINHA.map((u) => {
            const daLoja = linhas.filter((l) => l.pessoa.unidadeId === u && l.pessoa.setor !== 'geral').sort((a, b) => b.total - a.total)
            return <Tabela key={u} titulo={apelidoUnidade(nomeUnidade(u))} linhas={daLoja} />
          })}
          <Tabela titulo="Gerência (metade em cada loja)" linhas={linhas.filter((l) => l.pessoa.setor === 'geral')} />
          <div className="flex items-center justify-between rounded-2xl bg-carvao p-4 text-white">
            <span className="text-stone-300">Total pago à equipe</span>
            <span className="text-2xl font-bold text-ozzy-400 tabular-nums">{reais(totalPago)}</span>
          </div>
        </>
      )}

      {foraDaConta.length > 0 && (
        <p className="rounded-xl bg-ozzy-100 p-3 text-sm">
          Fora da conta por cargo sem pontos: {foraDaConta.map((p) => `${p.nome} (${p.cargo})`).join(', ')}. Ajuste o cargo no cadastro.
        </p>
      )}

      <details className="rounded-2xl bg-white p-4 text-sm ring-1 ring-stone-200">
        <summary className="cursor-pointer font-semibold">Como é calculado</summary>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-stone-700">
          <li>Do total de cada loja, {RETENCAO * 100}% fica para impostos. O resto é dividido.</li>
          <li>
            Pontos por cargo: {PONTOS_CARGO.map((p) => `${p.cargo} ${num(p.pontos)}`).join(', ')}. O gerente conta metade em cada loja.
          </li>
          <li>
            Cada bônus soma {PONTOS_BONUS} pontos. Loja com menos de {MINIMO_BONUS_POR_SETOR} pessoas tem um bônus só; com mais, um da cozinha e um do atendimento.
          </li>
          <li>Valor do ponto = valor a dividir ÷ total de pontos. Cada pessoa recebe os pontos dela × valor do ponto. Falta não reduz essa parte.</li>
          <li>
            O bônus vai para quem tiver a menor nota do grupo no mês (falta = 1, advertência ou suspensão = {PESO_ADVERTENCIA}). Empate divide. Gerente não entra no bônus.
          </li>
          <li>Faltas e advertências vêm das ocorrências lançadas no Departamento Pessoal.</li>
        </ol>
      </details>
    </div>
  )
}

function Tabela({ titulo, linhas }: { titulo: string; linhas: LinhaCaixinha[] }) {
  const posicao = new Map(linhas.map((l, k) => [l.pessoa.id, k]))
  const { ordenada, cabecalho } = useOrdem(linhas, {
    ordem: (l) => posicao.get(l.pessoa.id), nome: (l) => l.pessoa.nome, pontos: (l) => l.pontos, parte: (l) => l.parte,
    faltas: (l) => l.faltas || null, advertencias: (l) => l.advertencias || null, bonus: (l) => l.bonus || null, total: (l) => l.total,
  }, { col: 'ordem' })
  if (!linhas.length) return null
  return (
    <section>
      <h2 className="mb-2 font-bold">{titulo}</h2>
      {/* Celular: um cartão por pessoa, com o total sempre visível. */}
      <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200 sm:hidden">
        {ordenada.map((l) => (
          <button key={l.pessoa.id} onClick={() => ir('rh/equipe/' + l.pessoa.id)} className="flex w-full items-center gap-3 p-3 text-left">
            <Avatar nome={l.pessoa.nome} foto={l.pessoa.fotoUrl} tamanho={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{l.pessoa.nome}</span>
              <span className="block text-xs text-stone-500 tabular-nums">
                {num(l.pontos)} pts · parte {reais(l.parte)}
                {l.faltas ? ` · ${l.faltas} falta${l.faltas > 1 ? 's' : ''}` : ''}
                {l.advertencias ? ` · ${l.advertencias} advert.` : ''}
              </span>
              {l.bonus > 0 && <span className="mt-0.5 block text-xs font-semibold text-emerald-700 tabular-nums">+ {reais(l.bonus)} de bônus</span>}
            </span>
            <span className="shrink-0 font-bold tabular-nums">{reais(l.total)}</span>
          </button>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200 sm:block">
        <table className="w-full min-w-[640px] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-stone-200 text-left text-stone-500">
              {cabecalho('nome', 'Funcionário')}
              {cabecalho('pontos', 'Pontos', 'px-2! text-right', true)}
              {cabecalho('parte', 'Parte', 'px-2! text-right', true)}
              {cabecalho('faltas', 'Faltas', 'px-2! text-right', true)}
              {cabecalho('advertencias', 'Advert.', 'px-2! text-right', true)}
              {cabecalho('bonus', 'Bônus', 'px-2! text-right', true)}
              {cabecalho('total', 'Total', 'text-right', true)}
            </tr>
          </thead>
          <tbody>
            {ordenada.map((l) => (
              <tr key={l.pessoa.id} className="border-b border-stone-100 last:border-0">
                <td className="px-3 py-2">
                  <button onClick={() => ir('rh/equipe/' + l.pessoa.id)} className="flex items-center gap-2 text-left">
                    <Avatar nome={l.pessoa.nome} foto={l.pessoa.fotoUrl} tamanho={28} />
                    <span>
                      <span className="block font-semibold hover:underline">{l.pessoa.nome}</span>
                      <span className="block text-xs text-stone-500">{l.pessoa.cargo}{l.pessoa.setor && l.pessoa.setor !== 'geral' ? ` · ${l.pessoa.setor}` : ''}</span>
                    </span>
                  </button>
                </td>
                <td className="px-2 py-2 text-right">{num(l.pontos)}</td>
                <td className="px-2 py-2 text-right">{reais(l.parte)}</td>
                <td className="px-2 py-2 text-right">{l.faltas || '—'}</td>
                <td className="px-2 py-2 text-right">{l.advertencias || '—'}</td>
                <td className="px-2 py-2 text-right">{l.bonus ? <Selo cor="verde">+ {reais(l.bonus)}</Selo> : '—'}</td>
                <td className="px-3 py-2 text-right font-bold">{reais(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
