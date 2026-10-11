import logo from '../assets/logo.png'
import { qtdLegivel, type Catalogo } from '../lib/custos'
import { dataLonga } from '../lib/datas'
import type { Receita } from '../lib/types'
import Impressao from './Impressao'

// Ficha de preparo para imprimir e deixar na produção (Heitor, 10/10). Sai da mesma ficha que calcula o custo:
// mudou a ficha no portal, é só imprimir de novo. As colunas multiplicam a receita (1 a 4 receitas, ou as
// quantidades escolhidas na ficha) e o peso de cada item já vem bruto (com o aproveitamento).
// Econômica na tinta (Heitor, 11/10): sem fundos pintados, só texto e linhas finas.
export default function ImprimirFichas({ fichas, cat, aoFechar }: { fichas: Receita[]; cat: Catalogo; aoFechar: () => void }) {
  const titulo = fichas.length === 1 ? `Ficha · ${fichas[0].nome}` : `${fichas.length} fichas de preparo`
  return (
    <Impressao titulo={titulo} aoFechar={aoFechar}>
      {fichas.map((r, i) => (
        <div key={r.id} className={i > 0 ? 'mt-12 border-t-2 border-dashed border-stone-300 pt-12 print:mt-0 print:break-before-page print:border-0 print:pt-0' : ''}>
          <FichaImpressa r={r} cat={cat} />
        </div>
      ))}
    </Impressao>
  )
}

function FichaImpressa({ r, cat }: { r: Receita; cat: Catalogo }) {
  const v = cat.atual.get(r.id)
  if (!v) return <p>{r.nome}: ficha sem composição.</p>
  const lotes = r.lotes?.length ? r.lotes : [1, 2, 3, 4].map((k) => k * v.rendimento)
  const padrao = !r.lotes?.length
  const itens = v.itens.map((it) => {
    const sub = it.subReceitaId ? cat.receitas.get(it.subReceitaId) : undefined
    const ins = it.insumoId ? cat.insumos.get(it.insumoId) : undefined
    return { nome: sub?.nome ?? ins?.nome ?? '—', unidade: sub?.unidade ?? ins?.unidade ?? '', bruto: it.quantidade / (it.aproveitamento || 1), sub: !!sub, delivery: !!it.soDelivery }
  })
  // Modo de preparo: um passo por linha; linha terminando em ":" é o título de uma etapa.
  const passos = (r.modoPreparo ?? '').split('\n').map((l) => l.trim().replace(/^\d+[.)-]\s*/, '')).filter(Boolean)
  let n = 0
  const info: [string, string][] = [
    ['Rende', `${qtdLegivel(v.rendimento, r.unidade)} por receita`],
    ...(r.porcaoNome && r.porcaoQtd ? [['Porção', `${r.porcaoNome} de ${qtdLegivel(r.porcaoQtd, r.unidade)}`] as [string, string]] : []),
    ...(r.validadeDias !== null ? [['Validade', `${r.validadeDias} dia${r.validadeDias === 1 ? '' : 's'}`] as [string, string]] : []),
    ...(r.conservacao ? [['Armazenamento', r.conservacao] as [string, string]] : []),
    ...(r.tempoPreparoMin ? [['Tempo', `${r.tempoPreparoMin} min`] as [string, string]] : []),
    ...(r.equipamentos ? [['Equipamentos', r.equipamentos] as [string, string]] : []),
  ]

  return (
    <article className="text-[12.5px] leading-snug text-black">
      <header className="flex items-center gap-4 border-b-2 border-black pb-2">
        <img src={logo} alt="" className="size-10 shrink-0 grayscale" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold tracking-[0.2em] text-stone-600 uppercase">Ficha de preparo</div>
          <h1 className="text-[22px] leading-tight font-bold tracking-tight uppercase">{r.nome}</h1>
        </div>
        <div className="shrink-0 text-right text-[10.5px] leading-relaxed text-stone-600">
          {r.ecleticaCodigo && <div>Cód. <b className="text-black">{r.ecleticaCodigo}</b></div>}
          <div>Versão <b className="text-black">{v.numero}</b></div>
          <div>{dataLonga(v.criadaEm)}</div>
        </div>
      </header>

      <div className="mt-3 flex flex-wrap gap-2">
        {info.map(([k, t]) => (
          <div key={k} className="rounded-lg border border-stone-300 px-2.5 py-1">
            <span className="text-[9.5px] font-semibold tracking-wide text-stone-500 uppercase">{k}</span> <span className="font-semibold">{t}</span>
          </div>
        ))}
      </div>

      <h2 className="mt-4 mb-1.5 text-[11px] font-bold tracking-[0.2em] uppercase">Ingredientes</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="w-7 px-2 py-1.5 text-center">#</th>
            <th className="px-2 py-1.5">Item</th>
            {lotes.map((l, k) => (
              <th key={k} className="px-2 py-1.5 text-right whitespace-nowrap">
                {padrao ? `${k + 1} receita${k ? 's' : ''}` : qtdLegivel(l, r.unidade)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {itens.map((it, k) => (
            <tr key={k} className="border-b border-stone-300">
              <td className="px-2 py-1.5 text-center text-stone-500">{k + 1}</td>
              <td className="px-2 py-1.5 font-semibold">
                {it.nome}
                {it.sub && <span className="ml-1 text-[10px] font-normal text-stone-500">(preparo)</span>}
                {it.delivery && <span className="ml-1 text-[10px] font-normal text-stone-500">(só delivery)</span>}
              </td>
              {lotes.map((l, j) => (
                <td key={j} className={`px-2 py-1.5 text-right whitespace-nowrap tabular-nums ${j === 0 ? 'font-bold' : ''}`}>{qtdLegivel((it.bruto * l) / v.rendimento, it.unidade)}</td>
              ))}
            </tr>
          ))}
          <tr className="border-t-2 border-black font-bold">
            <td />
            <td className="px-2 py-1.5">Rende</td>
            {lotes.map((l, j) => <td key={j} className="px-2 py-1.5 text-right whitespace-nowrap">{qtdLegivel(l, r.unidade)}</td>)}
          </tr>
          {r.porcaoNome && r.porcaoQtd ? (
            <tr className="font-semibold text-stone-700">
              <td />
              <td className="px-2 py-1 capitalize">{r.porcaoNome}</td>
              {lotes.map((l, j) => <td key={j} className="px-2 py-1 text-right">≈ {Math.floor(l / r.porcaoQtd! + 1e-6)}</td>)}
            </tr>
          ) : null}
        </tbody>
      </table>

      {passos.length > 0 && (
        <>
          <h2 className="mt-5 mb-1.5 text-[11px] font-bold tracking-[0.2em] uppercase">Modo de preparo</h2>
          <ol className="space-y-1.5">
            {passos.map((p, k) =>
              p.endsWith(':') ? (
                <li key={k} className="pt-1.5 text-[11px] font-bold tracking-wide text-stone-600 uppercase">{p.slice(0, -1)}</li>
              ) : (
                <li key={k} className="flex gap-2.5 break-inside-avoid">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-black text-[11px] font-bold">{++n}</span>
                  <span className="pt-0.5">{p}</span>
                </li>
              ),
            )}
          </ol>
        </>
      )}

      {r.observacoes && (
        <div className="mt-4 rounded-lg border border-black px-3 py-2 break-inside-avoid">
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase">Atenção</div>
          <p className="whitespace-pre-line">{r.observacoes}</p>
        </div>
      )}

      <footer className="mt-5 flex justify-between gap-3 border-t border-stone-300 pt-2 text-[9.5px] text-stone-500">
        <span>{r.responsavel ? `Responsável: ${r.responsavel}` : 'Portal do Time The Ozzy'}</span>
        <span>Mudou algo? Atualize a ficha no portal e imprima de novo. Não corrija à mão.</span>
      </footer>
    </article>
  )
}
