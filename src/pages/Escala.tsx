import { useCallback, useEffect, useState } from 'react'
import Impressao from '../components/Impressao'
import { Botao, Titulo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { addDias, addMeses, dataLonga, diaSemana, hoje, indiceSemana, mesDe, nomeMesAno, primeiroDia, ultimoDia } from '../lib/datas'
import { podeGerenciar } from '../lib/permissoes'
import { apelidoUnidade, type Folga, type Funcionario, type TipoFolga, type Turno } from '../lib/types'

// Produção e Escritório não são lojas, mas aparecem como opção no filtro (Heitor, 09/10).
const AREAS = [{ id: 'producao', nome: 'Produção' }, { id: 'escritorio', nome: 'Escritório' }]
const daArea = (p: Pick<Funcionario, 'unidadeId' | 'setor'>, filtro: string) =>
  !filtro || (AREAS.some((a) => a.id === filtro) ? p.setor === filtro : p.unidadeId === filtro && !AREAS.some((a) => a.id === p.setor))
const nomeFiltro = (filtro: string, nomeUnidade: (id: string) => string) => AREAS.find((a) => a.id === filtro)?.nome ?? apelidoUnidade(nomeUnidade(filtro))
function OpcoesLocal() {
  const { unidades } = useApp()
  return (
    <>
      <option value="">Todas as unidades</option>
      {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
      {AREAS.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
    </>
  )
}

// Quem aparece nas folgas: a equipe do contexto, ou (manutencista) só nome/loja/setor vindos de folgas_da_equipe.
type PessoaFolga = Pick<Funcionario, 'id' | 'nome' | 'unidadeId' | 'setor' | 'status'> & { cargo?: string }
// Primeiro nome + o seguinte ("Kauã de Oliveira", não "Kauã de").
const curto = (nome: string) => {
  const ps = nome.split(' ')
  return ps.slice(0, /^(de|da|do|dos|das|e)$/i.test(ps[1] ?? '') ? 3 : 2).join(' ')
}
const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export default function Escala() {
  const { eu, store, equipe, avisar } = useApp()
  const gestao = podeGerenciar(eu.nivel)
  // O manutencista faz a comida da equipe e vê as folgas de todos (Heitor, 13/10).
  const verTodos = !gestao && eu.nivel === 'manutencao'
  // Abre no mês, para a gerente definir as folgas do mês inteiro (Heitor, 13/10); a semana saiu.
  const [visao, setVisao] = useState<'mes' | '30'>('mes')
  const [mes, setMes] = useState(mesDe(hoje()))
  const [folgas, setFolgas] = useState<Folga[]>([])
  const [daEquipe, setDaEquipe] = useState<PessoaFolga[]>([])
  const [unidade, setUnidade] = useState(gestao || verTodos ? '' : eu.unidadeId)
  const ini = primeiroDia(mes)
  const fim = ultimoDia(mes)
  const dias = Array.from({ length: Number(fim.slice(8, 10)) }, (_, i) => addDias(ini, i))

  const lerFolgas = useCallback(async (de: string, ate: string, comTrabalha?: boolean): Promise<{ folgas: Folga[]; pessoas: PessoaFolga[] }> => {
    if (!verTodos) return { folgas: await store.folgas(de, ate, { comTrabalha }), pessoas: [] }
    const r = await store.folgasDaEquipe(de, ate)
    const pessoas = new Map<string, PessoaFolga>()
    for (const g of r) pessoas.set(g.funcionarioId, { id: g.funcionarioId, nome: g.nome, unidadeId: g.unidadeId, setor: g.setor, status: 'ativo' })
    return { folgas: r, pessoas: [...pessoas.values()] }
  }, [store, verTodos])
  const carregar = useCallback(() => lerFolgas(ini, fim, true).then((r) => { setFolgas(r.folgas); setDaEquipe(r.pessoas) }), [lerFolgas, ini, fim])
  const [turnos, setTurnos] = useState<Turno[]>([])
  useEffect(() => {
    store.turnos().then(setTurnos).catch(() => setTurnos([]))
  }, [store])
  const turnoFechado = (fid: string, d: string) => {
    const t = turnos.find((x) => x.id === equipe.find((f) => f.id === fid)?.turnoId)
    return !!t && t.dias.some(Boolean) && !t.dias[indiceSemana(d)]
  }
  useEffect(() => {
    carregar()
  }, [carregar])

  const base: PessoaFolga[] = verTodos ? [...daEquipe, ...equipe.filter((f) => !daEquipe.some((p) => p.id === f.id))] : equipe
  const pessoas = base
    .filter((f) => f.status === 'ativo' && daArea(f, unidade))
    .sort((a, b) => (a.id === eu.id ? -1 : b.id === eu.id ? 1 : a.nome.localeCompare(b.nome)))

  const registro = (fid: string, d: string) => folgas.find((g) => g.funcionarioId === fid && g.data === d)
  const folgaDe = (fid: string, d: string) => {
    const g = registro(fid, d)
    return g && g.tipo !== 'trabalha' ? g.tipo : null
  }

  // Cada toque passa para o próximo: sem folga → folga → folga de feriado → sem folga.
  // No dia fechado do turno: folga do turno → feriado → vazio (vai trabalhar) → folga do turno.
  // Só aparecem folga e feriado (Heitor, 13/10): vazio é dia de trabalho.
  const alternar = async (fid: string, d: string) => {
    if (!gestao) return
    const g = registro(fid, d)
    let proximo: TipoFolga | null
    if (turnoFechado(fid, d)) {
      proximo = g?.tipo === 'feriado' ? 'trabalha' : g?.tipo === 'trabalha' ? null : 'feriado'
    } else {
      const atual = folgaDe(fid, d)
      proximo = atual === null ? 'normal' : atual === 'normal' ? 'feriado' : null
    }
    await store.definirFolga(fid, d, proximo)
    await carregar()
    avisar(
      proximo === 'normal' ? 'Folga marcada' : proximo === 'feriado' ? 'Folga de feriado marcada' : proximo === 'trabalha' ? 'Folga removida: trabalha neste dia'
        : g?.tipo === 'trabalha' ? 'Folga marcada' : 'Folga removida',
    )
  }
  const folgasNoMes = (fid: string) => dias.filter((d) => folgaDe(fid, d)).length

  return (
    <div>
      <Titulo
        acao={
          (
            <div className="flex rounded-xl bg-stone-200 p-1 text-sm font-semibold">
              {(['mes', '30'] as const).map((v) => (
                <button key={v} onClick={() => setVisao(v)} className={`rounded-lg px-3 py-1.5 ${visao === v ? 'bg-white shadow-sm' : 'text-stone-600'}`}>
                  {v === 'mes' ? 'Mês' : 'Próximos 30 dias'}
                </button>
              ))}
            </div>
          )
        }
      >
        Folgas
      </Titulo>
      {visao === '30' ? (
        <Proximos30 unidade={unidade} setUnidade={setUnidade} lerFolgas={lerFolgas} />
      ) : (
      <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Botao variante="secundario" onClick={() => setMes(addMeses(mes, -1))} aria-label="Mês anterior">
          ‹
        </Botao>
        <span className="min-w-40 text-center text-sm font-semibold">{nomeMesAno(mes).replace(/^./, (c) => c.toUpperCase())}</span>
        <Botao variante="secundario" onClick={() => setMes(addMeses(mes, 1))} aria-label="Próximo mês">
          ›
        </Botao>
        {mes !== mesDe(hoje()) && <Botao variante="secundario" onClick={() => setMes(mesDe(hoje()))}>Este mês</Botao>}
        {(gestao || verTodos) && (
          <select className={`${estiloEntrada} w-auto! py-2!`} value={unidade} onChange={(e) => setUnidade(e.target.value)} aria-label="Unidade">
            <OpcoesLocal />
          </select>
        )}
      </div>
      <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-500">
        {gestao && <span>Toque num dia para trocar:</span>}
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-ozzy-500" /> folga</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-sky-600" /> folga de feriado</span>
        <span>vazio = trabalha</span>
      </p>

      {pessoas.length === 0 ? (
        <Vazio>Ninguém nesta unidade.</Vazio>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-stone-500">
                <th className="sticky left-0 z-10 min-w-36 bg-white px-3 py-2 text-left font-semibold">Pessoa</th>
                {dias.map((d) => {
                  const fds = [0, 6].includes(new Date(d + 'T12:00:00').getDay())
                  return (
                    <th key={d} className={`px-0.5 py-1.5 text-center font-semibold ${d === hoje() ? 'rounded-t-lg bg-carvao text-white' : fds ? 'bg-stone-50' : ''}`}>
                      <div className="text-[10px] font-normal">{diaSemana(d).slice(0, 3)}</div>
                      <div>{Number(d.slice(8, 10))}</div>
                    </th>
                  )
                })}
                <th className="px-2 py-1.5 text-center text-xs font-semibold" title="Folgas no mês">Folgas</th>
              </tr>
            </thead>
            <tbody>
              {pessoas.map((p) => (
                <tr key={p.id} className={`border-b border-stone-100 last:border-0 ${p.id === eu.id ? 'bg-ozzy-50' : ''}`}>
                  <td className={`sticky left-0 z-10 px-3 py-1.5 ${p.id === eu.id ? 'bg-ozzy-50' : 'bg-white'}`}>
                    <div className="whitespace-nowrap font-semibold">{p.id === eu.id ? 'Você' : curto(p.nome)}</div>
                    {p.cargo && <div className="text-xs text-stone-500">{p.cargo}</div>}
                  </td>
                  {dias.map((d) => {
                    const folga = folgaDe(p.id, d)
                    const auto = !!registro(p.id, d)?.automatica
                    return (
                      <td key={d} className={`px-0.5 py-1 text-center ${d === hoje() ? 'bg-stone-300' : ''}`}>
                        <button
                          disabled={!gestao}
                          onClick={() => alternar(p.id, d)}
                          title={`${dataLonga(d)}: ${folga === 'feriado' ? 'folga de feriado' : folga ? (auto ? 'folga (dia sem horário no turno)' : 'folga') : 'trabalha'}`}
                          className={`h-8 w-8 rounded-md text-[10px] font-bold transition ${
                            folga === 'feriado' ? 'bg-sky-600 text-white' : folga ? 'bg-ozzy-500 text-carvao' : 'bg-stone-50 text-stone-300'
                          } ${gestao ? 'hover:ring-2 hover:ring-carvao' : 'cursor-default'}`}
                        >
                          {folga === 'feriado' ? 'FER' : folga ? 'F' : ''}
                        </button>
                      </td>
                    )
                  })}
                  <td className="px-2 text-center text-sm font-semibold text-stone-600">{folgasNoMes(p.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>
      )}
    </div>
  )
}

const MESES = MES_CURTO
const diaMes = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

// Calendário dos próximos 30 dias (todos veem; a gestão manda no grupo).
function Proximos30({ unidade, setUnidade, lerFolgas }: { unidade: string; setUnidade: (u: string) => void; lerFolgas: (de: string, ate: string) => Promise<{ folgas: Folga[]; pessoas: PessoaFolga[] }> }) {
  const { equipe: daCasa, nomeUnidade, avisar } = useApp()
  const [daEquipe, setDaEquipe] = useState<PessoaFolga[]>([])
  const equipe: PessoaFolga[] = [...daEquipe, ...daCasa.filter((f) => !daEquipe.some((p) => p.id === f.id))]
  const [folgas, setFolgas] = useState<Folga[] | null>(null)
  const [imprimir, setImprimir] = useState(false)
  const ini = hoje()
  const fim = addDias(ini, 29)
  const dias = Array.from({ length: 30 }, (_, i) => addDias(ini, i))

  useEffect(() => {
    lerFolgas(ini, fim).then((r) => { setFolgas(r.folgas); setDaEquipe(r.pessoas) })
  }, [lerFolgas, ini, fim])
  if (!folgas) return <p className="text-stone-400">Carregando…</p>

  const pessoa = (id: string) => equipe.find((p) => p.id === id)
  const doDia = (d: string) =>
    folgas
      .filter((g) => g.data === d)
      .map((g) => ({ g, p: pessoa(g.funcionarioId) }))
      .filter((x) => x.p && x.p.status === 'ativo' && daArea(x.p, unidade))
      .sort((a, b) => a.p!.nome.localeCompare(b.p!.nome))
  const comLoja = (id: string) => (unidade ? '' : ` (${apelidoUnidade(nomeUnidade(pessoa(id)!.unidadeId))})`)

  const texto = () => {
    const linhas = [`*Folgas de ${diaMes(ini)} a ${diaMes(fim)}*${unidade ? ` · ${nomeFiltro(unidade, nomeUnidade)}` : ''}`, '']
    for (const d of dias) {
      const xs = doDia(d)
      if (!xs.length) continue
      linhas.push(`*${diaSemana(d)} ${diaMes(d)}*`)
      for (const { g, p } of xs) linhas.push(`• ${curto(p!.nome)}${comLoja(p!.id)}${g.tipo === 'feriado' ? ' 🎉 feriado' : ''}`)
      linhas.push('')
    }
    return linhas.join('\n').trim()
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto())
      avisar('Copiado! É só colar no grupo.')
    } catch {
      avisar('Não deu para copiar neste aparelho')
    }
  }

  const lista = (
    <div className="grid gap-2 sm:grid-cols-2 print:grid-cols-3 print:gap-1">
      {dias.map((d) => {
        const xs = doDia(d)
        return (
          <div key={d} className={`rounded-xl p-3 ring-1 ring-stone-200 print:break-inside-avoid print:rounded-none print:p-1.5 ${d === hoje() ? 'bg-ozzy-50' : 'bg-white'}`}>
            <div className="mb-1 text-sm font-bold">
              {diaSemana(d)} {Number(d.slice(8, 10))} {MESES[Number(d.slice(5, 7)) - 1]}
            </div>
            {xs.length === 0 ? (
              <div className="text-xs text-stone-400">Ninguém de folga</div>
            ) : (
              <ul className="space-y-0.5 text-sm">
                {xs.map(({ g, p }) => (
                  <li key={g.id} className="flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${g.tipo === 'feriado' ? 'bg-sky-600' : 'bg-ozzy-500'}`} />
                    <span className="truncate">{curto(p!.nome)}<span className="text-stone-500">{comLoja(p!.id)}</span></span>
                    {g.tipo === 'feriado' && <span className="text-xs font-semibold text-sky-700">feriado</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${estiloEntrada} w-auto! py-2!`} value={unidade} onChange={(e) => setUnidade(e.target.value)} aria-label="Unidade">
          <OpcoesLocal />
        </select>
        <Botao onClick={copiar}>Copiar para o WhatsApp</Botao>
        <Botao variante="secundario" onClick={() => setImprimir(true)}>Imprimir</Botao>
      </div>
      <p className="flex flex-wrap items-center gap-x-3 text-sm text-stone-500">
        <span>De {dataLonga(ini)} a {dataLonga(fim)}.</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-ozzy-500" /> folga</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-sky-600" /> folga de feriado</span>
      </p>
      {lista}
      {imprimir && (
        <Impressao titulo="Folgas dos próximos 30 dias" aoFechar={() => setImprimir(false)}>
          <h1 className="mb-1 text-lg font-bold">Folgas de {dataLonga(ini)} a {dataLonga(fim)}</h1>
          <p className="mb-3 text-xs">{unidade ? nomeFiltro(unidade, nomeUnidade) : 'Todas as unidades'} · amarelo = folga, azul = folga de feriado</p>
          {lista}
        </Impressao>
      )}
    </div>
  )
}
