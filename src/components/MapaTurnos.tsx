import { useEffect, useState } from 'react'
import { Botao } from './ui'
import { useApp } from '../lib/contexto'
import { addDias, dataCurta, hoje, inicioDaSemana } from '../lib/datas'
import { podeGerenciar } from '../lib/permissoes'
import { DIAS_SEMANA, setorDaFuncao, turnoDoFreela } from '../lib/turnos'
import { nomeCurto, type Folga, type Funcionario, type Turno, type TurnoFreela } from '../lib/types'

// Freela que mandou a diária (pendente ou já aprovada) entra no turno em que trabalhou (Heitor, 13/10).
interface FreelaNoTurno { chave: string; nome: string; data: string; turno: TurnoFreela; unidadeId: string; funcao: string; checkin: boolean }

// Mapa da semana (pedido de 08/10): para cada turno, quem trabalha em cada dia. Sai do turno-padrão de cada
// pessoa, tirando quem está de folga naquela data (aba Folgas).
export default function MapaTurnos({ turnos, nomeLocal }: { turnos: Turno[]; nomeLocal: (id: string) => string }) {
  const { store, equipe, eu } = useApp()
  const [inicio, setInicio] = useState(inicioDaSemana(hoje()))
  const [folgas, setFolgas] = useState<Folga[]>([])
  // No celular a tabela não cabe: mostra um dia por vez.
  const [diaCel, setDiaCel] = useState((new Date().getDay() + 6) % 7)
  const dias = Array.from({ length: 7 }, (_, i) => addDias(inicio, i))

  useEffect(() => {
    store.folgas(inicio, addDias(inicio, 6)).then(setFolgas).catch(() => setFolgas([]))
  }, [store, inicio])
  const [freelas, setFreelas] = useState<FreelaNoTurno[]>([])
  const gestao = podeGerenciar(eu.nivel)
  useEffect(() => {
    if (!gestao) return
    const fim = addDias(inicio, 6)
    Promise.all([store.diariasFreela(inicio, fim), store.enviosFreela('pendente'), store.freelancers()])
      .then(([diarias, pendentes, cadastro]) => {
        const lista: FreelaNoTurno[] = []
        const visto = new Set<string>()
        const por = (nome: string, d: { data: string; turno: TurnoFreela; unidadeId: string; funcao: string }, checkin: boolean) => {
          const chave = `${nome.toLowerCase()}|${d.data}|${d.turno}|${d.unidadeId}`
          // Entregador não entra: não é posto de turno.
          if (!nome || visto.has(chave) || /entreg|motob/i.test(d.funcao)) return
          visto.add(chave)
          lista.push({ chave, nome, data: d.data, turno: d.turno, unidadeId: d.unidadeId, funcao: d.funcao, checkin })
        }
        for (const e of pendentes) if (e.data >= inicio && e.data <= fim) por(e.nome, e, e.naLoja)
        for (const d of diarias) por(cadastro.find((c) => c.id === d.freelancerId)?.nome ?? '', d, false)
        setFreelas(lista)
      })
      .catch(() => setFreelas([]))
  }, [store, inicio, gestao])

  const ativos = equipe.filter((f) => f.status === 'ativo').sort((a, b) => a.nome.localeCompare(b.nome))
  const deFolga = (f: Funcionario, d: string) => folgas.some((g) => g.funcionarioId === f.id && g.data === d)
  const locais = [...new Set(turnos.map((t) => t.local))]
  // Setor do turno = o da maioria de quem está nele; sem ninguém, pelo nome do turno.
  const setorDoTurno = (t: Turno) => {
    const conta: Record<string, number> = {}
    for (const f of ativos) if (f.turnoId === t.id && f.setor) conta[f.setor] = (conta[f.setor] ?? 0) + 1
    return Object.entries(conta).sort((a, b) => b[1] - a[1])[0]?.[0] ?? setorDaFuncao(t.nome)
  }
  const turnoDe = new Map(freelas.map((f) => [f.chave, turnoDoFreela(f, turnos, setorDoTurno)?.id ?? null]))
  const freelasDo = (t: Turno, d: string) => freelas.filter((f) => f.data === d && turnoDe.get(f.chave) === t.id)
  const nomeFreela = (f: FreelaNoTurno) => `${nomeCurto(f.nome)}${f.checkin ? ' ✓' : ''}`
  const dicaFreela = (f: FreelaNoTurno) => `${f.nome} · freela · ${f.funcao}${f.checkin ? ' · check-in na loja' : ''}`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Botao variante="secundario" onClick={() => setInicio(addDias(inicio, -7))} aria-label="Semana anterior">‹</Botao>
        <div className="text-center text-sm font-semibold">
          Semana de {dataCurta(dias[0])} a {dataCurta(dias[6])}
          {inicio !== inicioDaSemana(hoje()) && (
            <button className="ml-2 text-sky-700" onClick={() => setInicio(inicioDaSemana(hoje()))}>
              voltar para esta
            </button>
          )}
        </div>
        <Botao variante="secundario" onClick={() => setInicio(addDias(inicio, 7))} aria-label="Próxima semana">›</Botao>
      </div>

      {gestao && freelas.length > 0 && (
        <p className="text-xs text-stone-500"><span className="font-semibold text-violet-700">Roxo</span> = freela que mandou a diária, no turno da loja, período e função dele. ✓ = fez check-in na loja.</p>
      )}

      <div className="grid grid-cols-7 gap-1 sm:hidden">
        {dias.map((d, i) => (
          <button
            key={d}
            onClick={() => setDiaCel(i)}
            className={`rounded-lg py-1.5 text-xs font-semibold ${diaCel === i ? 'bg-carvao text-white' : d === hoje() ? 'bg-ozzy-400/40' : 'bg-white ring-1 ring-stone-200'}`}
          >
            {DIAS_SEMANA[i]}
            <span className="block font-normal">{dataCurta(d).slice(0, 2)}</span>
          </button>
        ))}
      </div>

      {locais.map((l) => {
        const ts = turnos.filter((t) => t.local === l)
        return (
          <section key={l} className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
            <h2 className="bg-carvao px-4 py-2 font-bold text-white">{nomeLocal(l)}</h2>
            <ul className="divide-y divide-stone-100 sm:hidden">
              {ts.map((t) => {
                const h = t.dias[diaCel]
                const doTurno = ativos.filter((f) => f.turnoId === t.id)
                const trabalham = doTurno.filter((f) => !deFolga(f, dias[diaCel]))
                const folgam = doTurno.filter((f) => deFolga(f, dias[diaCel]))
                const fr = freelasDo(t, dias[diaCel])
                return (
                  <li key={t.id} className="px-4 py-2.5 text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{t.nome}</span>
                      <span className="text-xs text-stone-500 tabular-nums">{h ? `${h.inicio}–${h.fim}` : 'Fechado'}</span>
                    </div>
                    {h &&
                      (trabalham.length || fr.length ? (
                        <p className="mt-0.5 text-stone-700">
                          {trabalham.map((f) => nomeCurto(f.nome)).join(', ')}
                          {fr.length > 0 && <span className="text-violet-700">{trabalham.length ? ', ' : ''}{fr.map((f) => `${nomeFreela(f)} (freela)`).join(', ')}</span>}
                        </p>
                      ) : (
                        <p className="mt-0.5 font-semibold text-red-700">Ninguém</p>
                      ))}
                    {h && folgam.length > 0 && <p className="text-xs text-sky-700">Folga: {folgam.map((f) => nomeCurto(f.nome)).join(', ')}</p>}
                  </li>
                )
              })}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[760px] table-fixed border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-100 text-stone-600">
                    <th className="w-28 px-2 py-1.5 text-left font-semibold">Turno</th>
                    {dias.map((d, i) => (
                      <th key={d} className={`px-1.5 py-1.5 text-left font-semibold ${d === hoje() ? 'bg-ozzy-400/40 text-carvao' : ''}`}>
                        {DIAS_SEMANA[i]} <span className="font-normal">{dataCurta(d)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ts.map((t) => {
                    const doTurno = ativos.filter((f) => f.turnoId === t.id)
                    return (
                      <tr key={t.id} className="border-t border-stone-100 align-top">
                        <th className="px-2 py-2 text-left font-semibold">
                          {t.nome}
                          <span className="block font-normal text-stone-500">{doTurno.length} {doTurno.length === 1 ? 'pessoa' : 'pessoas'}</span>
                        </th>
                        {dias.map((d, i) => {
                          const h = t.dias[i]
                          if (!h) return <td key={d} className="bg-stone-50 px-1.5 py-2 text-stone-400">Fechado</td>
                          const trabalham = doTurno.filter((f) => !deFolga(f, d))
                          const folgam = doTurno.filter((f) => deFolga(f, d))
                          const fr = freelasDo(t, d)
                          return (
                            <td key={d} className={`px-1.5 py-2 ${d === hoje() ? 'bg-ozzy-400/10' : ''}`}>
                              <div className="mb-1 text-[10px] text-stone-500 tabular-nums">{h.inicio}–{h.fim}</div>
                              {trabalham.length === 0 && fr.length === 0 ? (
                                <div className="font-semibold text-red-700">Ninguém</div>
                              ) : (
                                <ul className="space-y-0.5">
                                  {trabalham.map((f) => (
                                    <li key={f.id} className={`truncate ${f.id === eu.id ? 'font-bold' : ''}`} title={f.nome}>{nomeCurto(f.nome)}</li>
                                  ))}
                                  {fr.map((f) => (
                                    <li key={f.chave} className="truncate text-violet-700" title={dicaFreela(f)}>{nomeFreela(f)} <span className="text-[10px]">freela</span></li>
                                  ))}
                                </ul>
                              )}
                              {folgam.length > 0 && (
                                <div className="mt-1 truncate text-[10px] text-sky-700" title={folgam.map((f) => f.nome).join(', ')}>
                                  Folga: {folgam.map((f) => f.nome.split(' ')[0]).join(', ')}
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}
