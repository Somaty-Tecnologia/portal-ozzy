import { useState } from 'react'
import { Botao, Cartao } from './ui'
import { useApp } from '../lib/contexto'
import { dataCurta, diaSemana, hoje } from '../lib/datas'
import { reais } from '../lib/financeiro'
import { lerImagem, lerPrintVendas, normalizar, produtoParecido, type VendaLida } from '../lib/printVendas'

// Importar o print das vendas do DPEN (Heitor, 13/10): lê a imagem no próprio aparelho, acha o produto
// de cada linha e preenche as quantidades do dia; ele confere e salva como sempre.
const diaCurto = (d: string) => `${diaSemana(d).slice(0, 3)} ${dataCurta(d)}`
const inteiro = (n: number) => Math.round(n).toLocaleString('pt-BR')
type Linha = VendaLida & { receitaId: string }
const CHAVE_NOMES = 'vendas-print-nomes'
const lerNomes = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(CHAVE_NOMES) ?? '{}') } catch { return {} } }

export default function ImportarPrintVendas({ dias, candidatos, aoUsar, aoFechar }: {
  dias: string[]
  candidatos: { id: string; nome: string; nomes: string[] }[]
  aoUsar: (dia: string, linhas: { receitaId: string; quantidade: number; total: number | null }[]) => void
  aoFechar: () => void
}) {
  const { avisar } = useApp()
  const [dia, setDia] = useState(() => [...dias].reverse().find((x) => x <= hoje()) ?? dias[0])
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [lendo, setLendo] = useState<string | null>(null)

  const ler = async (arquivos: FileList | null) => {
    if (!arquivos?.length) return
    const aprendidos = lerNomes()
    const novas: Linha[] = [...linhas]
    try {
      for (const [i, a] of [...arquivos].entries()) {
        setLendo(`Lendo ${arquivos.length > 1 ? `imagem ${i + 1} de ${arquivos.length}` : 'a imagem'}…`)
        const lidas = lerPrintVendas(await lerImagem(a, (p) => setLendo(`Lendo ${arquivos.length > 1 ? `imagem ${i + 1} de ${arquivos.length}` : 'a imagem'}… ${Math.round(p * 100)}%`)))
        // Prints que se sobrepõem (rolou a tela) repetem linhas: fica a primeira.
        for (const v of lidas)
          if (!novas.some((n) => normalizar(n.nome) === normalizar(v.nome)))
            novas.push({ ...v, receitaId: aprendidos[normalizar(v.nome)] ?? produtoParecido(v.nome, candidatos) ?? '' })
      }
      if (novas.length === linhas.length) avisar('Não achei linhas de venda nesta imagem. Mande o print da tabela de produtos.')
      setLinhas(novas)
    } catch (err) {
      avisar('Não consegui ler a imagem: ' + (err as Error).message)
    }
    setLendo(null)
  }
  const mudar = (i: number, m: Partial<Linha>) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, ...m } : l)))
  const usar = () => {
    const nomes = lerNomes()
    for (const l of linhas) if (l.receitaId) nomes[normalizar(l.nome)] = l.receitaId
    try { localStorage.setItem(CHAVE_NOMES, JSON.stringify(nomes)) } catch { /* sem armazenamento */ }
    aoUsar(dia, linhas.filter((l) => l.receitaId && l.quantidade).map((l) => ({ receitaId: l.receitaId, quantidade: l.quantidade!, total: l.confere ? l.total : null })))
  }
  const semProduto = linhas.filter((l) => !l.receitaId).length
  const semQtd = linhas.filter((l) => l.receitaId && !l.quantidade).length

  return (
    <Cartao>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold">Importar print das vendas</h3>
        <label className="text-sm sm:ml-auto">
          <span className="mr-2 font-semibold">Vendas do dia</span>
          <select className="rounded-lg border border-stone-200 px-2 py-1.5" value={dia} onChange={(e) => setDia(e.target.value)}>
            {dias.map((x, i) => <option key={x} value={x}>Dia {i + 1}: {diaCurto(x)}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-1 text-sm text-stone-600">Mande o print (ou vários, se a lista não coube numa tela) da tabela de produtos do DPEN. O portal lê produto e quantidade; você confere antes de salvar.</p>
      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-carvao px-4 py-2 font-semibold text-white">
        {linhas.length ? '+ Outro print' : 'Escolher print'}
        <input type="file" accept="image/*" multiple className="hidden" disabled={!!lendo} onChange={(e) => { ler(e.target.files); e.target.value = '' }} />
      </label>
      {lendo && <p className="mt-2 text-sm text-stone-600">{lendo}</p>}

      {linhas.length > 0 && (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-stone-500">
                <tr><th className="py-1 pr-2">No print</th><th className="px-1 py-1 text-right">Qtd</th><th className="px-1 py-1 text-right">Total</th><th className="px-1 py-1">Produto no portal</th></tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={i} className="border-t border-stone-100">
                    <td className="py-1 pr-2">{l.nome}{!l.confere && <span className="ml-1 text-xs font-semibold text-amber-700" title="Preço × quantidade não bateu com o total, ou a linha estava cortada">conferir</span>}</td>
                    <td className="px-1 py-1 text-right">
                      <input className="w-16 rounded-lg border border-stone-200 px-1.5 py-1 text-right" inputMode="numeric" aria-label={`Quantidade de ${l.nome}`}
                        value={l.quantidade ?? ''} onChange={(e) => mudar(i, { quantidade: e.target.value.trim() ? Math.max(0, Math.round(Number(e.target.value.replace(',', '.')) || 0)) : null, confere: false })} />
                    </td>
                    <td className="px-1 py-1 text-right whitespace-nowrap text-stone-500">{l.total !== null ? reais(l.total) : '—'}</td>
                    <td className="px-1 py-1">
                      <select className={`w-full rounded-lg border px-1.5 py-1 ${l.receitaId ? 'border-stone-200' : 'border-amber-400 bg-amber-50'}`} value={l.receitaId} onChange={(e) => mudar(i, { receitaId: e.target.value })} aria-label={`Produto de ${l.nome}`}>
                        <option value="">— não lançar —</option>
                        {candidatos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-sm text-stone-600">
            {inteiro(linhas.reduce((s, l) => s + (l.receitaId ? l.quantidade ?? 0 : 0), 0))} itens · {reais(linhas.reduce((s, l) => s + (l.receitaId ? l.total ?? 0 : 0), 0))}
            {semProduto > 0 && <span className="ml-2 font-semibold text-amber-700">{semProduto} sem produto (não entram)</span>}
            {semQtd > 0 && <span className="ml-2 font-semibold text-amber-700">{semQtd} sem quantidade</span>}
          </p>
        </>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
        <Botao disabled={!linhas.some((l) => l.receitaId && l.quantidade)} onClick={usar}>Usar no dia {dias.indexOf(dia) + 1}</Botao>
      </div>
    </Cartao>
  )
}
