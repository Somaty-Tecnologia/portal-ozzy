import { useEffect, useMemo, useState } from 'react'
import { Botao, estiloEntrada } from './ui'
import { useApp } from '../lib/contexto'
import { nomeUnidade, qtd, type Catalogo } from '../lib/custos'
import { addDias, dataCurta, diaSemana, inicioDaSemana } from '../lib/datas'
import { lerValor } from '../lib/financeiro'

// Produção do evento por dia (Heitor, 13/10): os pré-preparos que o cálculo pede + o que ele põe à mão
// (ex.: calabresa fatiada pizza, que é só fatiar e não vira pré-preparo), divididos de segunda a domingo
// da semana anterior ao evento, para mandar à produção o que fazer em cada dia.
type Linha = { chave: string; dia: string | null; quantidade: number }
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const texto = (n: number) => String(n).replace('.', ',')

export default function ProducaoEvento({ cat, eventoId, nomeEvento, inicioEvento, automaticos }: {
  cat: Catalogo
  eventoId: string
  nomeEvento: string
  inicioEvento: string
  // Pré-preparos que faltam pelo cálculo (já descontado o estoque).
  automaticos: { chave: string; quantidade: number }[]
}) {
  const { store, avisar } = useApp()
  const [linhas, setLinhas] = useState<Linha[] | null>(null)
  const [grade, setGrade] = useState<Record<string, string>>({})
  const [busca, setBusca] = useState('')
  // Heitor (13/10): não se faz 8,7 kg; por padrão arredonda o que precisa para cima.
  const [arredondar, setArredondar] = useState(() => { try { return localStorage.getItem('producao-evento-arredondar') !== 'nao' } catch { return true } })
  const mudarArredondar = (v: boolean) => { setArredondar(v); try { localStorage.setItem('producao-evento-arredondar', v ? 'sim' : 'nao') } catch { /* sem armazenamento */ } }
  useEffect(() => {
    store.producaoEvento(eventoId).then((r) => {
      setLinhas(r)
      setGrade(Object.fromEntries(r.filter((l) => l.dia && l.quantidade > 0).map((l) => [`${l.chave}|${l.dia}`, texto(l.quantidade)])))
    }, () => setLinhas([]))
  }, [store, eventoId])

  const dias = useMemo(() => {
    const seg = addDias(inicioDaSemana(inicioEvento), -7)
    return Array.from({ length: 7 }, (_, i) => addDias(seg, i))
  }, [inicioEvento])
  const info = (chave: string) => {
    const id = chave.slice(2)
    const x = chave.startsWith('i:') ? cat.insumos.get(id) : cat.receitas.get(id)
    return x ? { nome: x.nome, unidade: nomeUnidade(x.unidade) } : null
  }
  const precisa = new Map(automaticos.map((a) => [a.chave, arredondar ? Math.ceil(a.quantidade - 1e-9) : a.quantidade]))
  const manuais = new Set((linhas ?? []).filter((l) => l.dia === null).map((l) => l.chave))
  const chaves = [...new Set([...automaticos.map((a) => a.chave), ...manuais, ...(linhas ?? []).filter((l) => l.dia).map((l) => l.chave)])]
    .filter((k) => info(k))
    .sort((a, b) => info(a)!.nome.localeCompare(info(b)!.nome, 'pt-BR'))
  const valor = (k: string, dia: string) => lerValor(grade[`${k}|${dia}`] ?? '') ?? 0
  const somaItem = (k: string) => dias.reduce((s, d) => s + valor(k, d), 0)

  const salvar = async (g: Record<string, string>, mans: Set<string>) => {
    const novas: Linha[] = [
      ...[...mans].map((chave) => ({ chave, dia: null, quantidade: 0 })),
      ...Object.entries(g).flatMap(([k, t]) => {
        const [chave, dia] = k.split('|')
        const q = lerValor(t)
        return q && q > 0 && dias.includes(dia) ? [{ chave, dia, quantidade: q }] : []
      }),
    ]
    try {
      await store.salvarProducaoEvento(eventoId, novas)
      setLinhas(novas)
    } catch (e) { avisar((e as Error).message) }
  }

  const termos = semAcento(busca).split(/\s+/).filter(Boolean)
  const opcoes = termos.length && busca.trim().length >= 2
    ? [
      ...[...cat.receitas.values()].filter((r) => r.tipo === 'preparo' && r.ativo && !r.insumoId).map((r) => ({ chave: 'r:' + r.id, nome: r.nome })),
      ...[...cat.insumos.values()].filter((i) => i.ativo).map((i) => ({ chave: 'i:' + i.id, nome: i.nome })),
    ].filter((o) => !chaves.includes(o.chave) && termos.every((t) => semAcento(o.nome).includes(t))).slice(0, 10)
    : []
  const adicionar = (chave: string) => {
    const m = new Set(manuais).add(chave)
    setBusca('')
    salvar(grade, m)
  }
  const tirar = (chave: string) => {
    const m = new Set(manuais); m.delete(chave)
    const g = Object.fromEntries(Object.entries(grade).filter(([k]) => !k.startsWith(chave + '|')))
    setGrade(g)
    salvar(g, m)
  }

  const textoDia = (dia: string) => {
    const itens = chaves.filter((k) => valor(k, dia) > 0)
    if (!itens.length) return ''
    return `*${diaSemana(dia)} ${dataCurta(dia)}*\n` + itens.map((k) => `- ${info(k)!.nome}: ${qtd(valor(k, dia))} ${info(k)!.unidade}`).join('\n')
  }
  const copiar = (t: string) => navigator.clipboard.writeText(t).then(() => avisar('Copiado para o WhatsApp'), () => avisar('Não deu para copiar neste aparelho'))
  const copiarDia = (dia: string) => copiar(`*Produção · ${nomeEvento}*\n\n${textoDia(dia)}`)
  const copiarSemana = () => {
    const partes = dias.map(textoDia).filter(Boolean)
    const semDia = chaves.filter((k) => precisa.has(k) && precisa.get(k)! - somaItem(k) > 0.0005)
    if (semDia.length) partes.push('*Sem dia definido*\n' + semDia.map((k) => `- ${info(k)!.nome}: ${qtd(Math.round((precisa.get(k)! - somaItem(k)) * 1000) / 1000)} ${info(k)!.unidade}`).join('\n'))
    copiar(`*Produção · ${nomeEvento}*\n\n${partes.join('\n\n')}`)
  }

  if (!linhas) return null
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-bold">Para a produção</h4>
        <span className="text-sm text-stone-500">semana de {dataCurta(dias[0])} a {dataCurta(dias[6])}, antes do evento</span>
        <label className="flex items-center gap-2 text-sm text-stone-600 sm:ml-auto"><input type="checkbox" checked={arredondar} onChange={(e) => mudarArredondar(e.target.checked)} /> Arredondar para cima</label>
        <Botao variante="secundario" className="py-1.5!" disabled={!chaves.length} onClick={copiarSemana}>Copiar a semana p/ WhatsApp</Botao>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-stone-500">
            <tr>
              <th className="py-1 pr-2">Item</th>
              <th className="px-1 py-1 text-right">Precisa</th>
              {dias.map((d) => (
                <th key={d} className="px-1 py-1 text-center whitespace-nowrap">
                  {diaSemana(d)} {dataCurta(d)}
                  <button className="block w-full text-[11px] font-normal text-sky-700 underline disabled:text-stone-300 disabled:no-underline" disabled={!chaves.some((k) => valor(k, d) > 0)} onClick={() => copiarDia(d)}>copiar</button>
                </th>
              ))}
              <th className="px-1 py-1 text-right">Sem dia</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {chaves.length === 0 && <tr><td colSpan={11} className="py-3 text-stone-500">Nenhum pré-preparo a fazer. Adicione itens abaixo.</td></tr>}
            {chaves.map((k) => {
              const i = info(k)!
              const p = precisa.get(k)
              const resta = p !== undefined ? Math.round((p - somaItem(k)) * 1000) / 1000 : null
              return (
                <tr key={k} className="border-t border-stone-100">
                  <td className="py-1 pr-2 font-semibold">{i.nome} <span className="font-normal text-stone-400">{i.unidade}</span></td>
                  <td className="px-1 py-1 text-right whitespace-nowrap">{p !== undefined ? qtd(p) : <span className="text-xs text-stone-400">à mão</span>}</td>
                  {dias.map((d) => (
                    <td key={d} className="px-1 py-1">
                      <input
                        className="w-16 rounded-lg border border-stone-200 px-1.5 py-1 text-right" inputMode="decimal" placeholder="—"
                        aria-label={`${i.nome} em ${diaSemana(d)} ${dataCurta(d)}`}
                        value={grade[`${k}|${d}`] ?? ''}
                        onChange={(e) => setGrade((g) => ({ ...g, [`${k}|${d}`]: e.target.value }))}
                        onBlur={() => salvar(grade, manuais)}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      />
                    </td>
                  ))}
                  <td className={`px-1 py-1 text-right whitespace-nowrap ${resta !== null && resta > 0 ? 'font-semibold text-amber-700' : 'text-stone-400'}`}>
                    {resta === null ? '—' : resta > 0 ? qtd(resta) : resta < 0 ? `+${qtd(-resta)}` : '✓'}
                  </td>
                  <td className="py-1 pl-1">{manuais.has(k) && <button className="text-stone-400 hover:text-red-600" title="Tirar da lista" onClick={() => tirar(k)}>✕</button>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2">
        <input className={`${estiloEntrada} sm:w-80!`} placeholder="+ Adicionar item (ex.: calabresa fatiada pizza)" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Adicionar item à produção" />
        {opcoes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {opcoes.map((o) => <button key={o.chave} className="rounded-full bg-stone-100 px-3 py-1 text-sm hover:bg-stone-200" onClick={() => adicionar(o.chave)}>+ {o.nome}</button>)}
          </div>
        )}
        {busca.trim().length >= 2 && !opcoes.length && <p className="mt-1 text-sm text-stone-500">Nenhum material ou pré-preparo com esse nome. Cadastre em Cadastros › Materiais.</p>}
      </div>
    </div>
  )
}
