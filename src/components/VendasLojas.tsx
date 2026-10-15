import { useCallback, useEffect, useState } from 'react'
import { Botao, Vazio } from './ui'
import { useApp } from '../lib/contexto'
import { dataCurta, hoje, nomeMes } from '../lib/datas'
import { mostrarQtd, reais } from '../lib/financeiro'
import { ir } from '../lib/rota'
import { ligarProdutos, produtosSemFicha } from '../lib/consumoVendas'
import { lerVendasEcletica, type VendasLidas } from '../lib/vendasEcletica'
import type { ResumoVendas } from '../lib/types'

// Produção › Vendas das lojas (Heitor, 15/10): importar a exportação "Vendas por cupons" da Eclética, enquanto não
// há integração. O arquivo é lido no aparelho; vai para o banco só a soma por loja, dia, produto e canal.

const NOME_LOJA: Record<string, string> = { 'burger-psd': 'Parque São Domingos', 'burger-va': 'Vila Anastácio', pizza: 'The Ozzy Pizza' }

export default function VendasLojas() {
  const { store, avisar } = useApp()
  const [resumo, setResumo] = useState<ResumoVendas[] | null>(null)
  const [semFicha, setSemFicha] = useState<{ codigo: string; nome: string; porSemana: number }[]>([])
  const [lidas, setLidas] = useState<VendasLidas | null>(null)
  const [progresso, setProgresso] = useState<{ etapa: string; f: number } | null>(null)
  const [erro, setErro] = useState('')
  const carregar = useCallback(async () => {
    try {
      const [r, medias, produtos, insumos] = await Promise.all([store.vendasResumo(), store.vendasMedias(hoje(), 8), store.produtosVenda(), store.insumos()])
      setResumo(r)
      setSemFicha(produtosSemFicha(medias, ligarProdutos(produtos, insumos)))
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [store])
  useEffect(() => { carregar() }, [carregar])

  const ler = async (arq: File) => {
    setErro('')
    setLidas(null)
    setProgresso({ etapa: 'Lendo a planilha', f: 0 })
    try {
      setLidas(await lerVendasEcletica(arq, (f) => setProgresso({ etapa: 'Lendo a planilha', f })))
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setProgresso(null)
    }
  }
  const importar = async () => {
    if (!lidas) return
    setProgresso({ etapa: 'Enviando', f: 0 })
    try {
      await store.importarVendas(lidas.linhas, (f) => setProgresso({ etapa: 'Enviando', f }))
      avisar(`Vendas de ${dataCurta(lidas.de)} a ${dataCurta(lidas.ate)} importadas`)
      setLidas(null)
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setProgresso(null)
    }
  }

  const lojas = [...new Set((resumo ?? []).map((r) => r.unidadeId))]
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
        <h2 className="font-bold">Importar vendas da Eclética</h2>
        <p className="mt-1 text-sm text-stone-600">
          Na Eclética, exporte o relatório <b>Vendas por cupons</b> de todas as lojas em Excel (.xlsx), do período que quiser. Os dias que vierem no
          arquivo substituem os que já estavam, então pode mandar de novo o mesmo mês sem duplicar. Com as vendas e as fichas, o portal calcula o
          estoque ideal do fechamento (Produção › Listas) e a sugestão de compra da semana (Compras).
        </p>
        <input type="file" accept=".xlsx" className="mt-3 block text-sm" aria-label="Planilha de vendas" disabled={!!progresso}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) ler(f) }} />
        {progresso && (
          <div className="mt-3">
            <div className="text-sm text-stone-600">{progresso.etapa}… {Math.round(progresso.f * 100)}%</div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-200"><div className="h-full bg-carvao transition-all" style={{ width: `${progresso.f * 100}%` }} /></div>
          </div>
        )}
        {erro && <p className="mt-2 text-sm text-red-700">{erro}</p>}
        {lidas && !progresso && (
          <div className="mt-3 space-y-2">
            <p className="text-sm">De <b>{dataCurta(lidas.de)}</b> a <b>{dataCurta(lidas.ate)}</b>:</p>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-stone-500"><th className="py-1">Loja</th><th className="py-1 text-right">Dias</th><th className="py-1 text-right">Cupons</th><th className="py-1 text-right">Itens</th><th className="py-1 text-right">Valor</th></tr></thead>
              <tbody className="divide-y divide-stone-100">
                {Object.entries(lidas.porLoja).map(([u, p]) => (
                  <tr key={u}><td className="py-1">{NOME_LOJA[u] ?? u}</td><td className="py-1 text-right">{p.dias}</td><td className="py-1 text-right">{p.cupons.toLocaleString('pt-BR')}</td><td className="py-1 text-right">{Math.round(p.quantidade).toLocaleString('pt-BR')}</td><td className="py-1 text-right">{reais(p.valor)}</td></tr>
                ))}
              </tbody>
            </table>
            {lidas.lojasSemNome.length > 0 && <p className="text-sm text-amber-800">Lojas que não reconheci (ficaram de fora): {lidas.lojasSemNome.join(', ')}</p>}
            <div className="flex gap-2">
              <Botao onClick={importar}>Importar</Botao>
              <Botao variante="fantasma" onClick={() => setLidas(null)}>Cancelar</Botao>
            </div>
          </div>
        )}
      </div>

      <section className="space-y-2">
        <h2 className="font-bold">Já importado</h2>
        {!resumo ? <p className="text-stone-400">Carregando…</p> : !resumo.length ? <Vazio>Nenhuma venda importada ainda.</Vazio> : (
          <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-stone-500"><th className="px-3 py-2">Mês</th>{lojas.map((u) => <th key={u} className="px-3 py-2 text-right">{NOME_LOJA[u] ?? u}</th>)}</tr></thead>
              <tbody className="divide-y divide-stone-100">
                {[...new Set(resumo.map((r) => r.mes))].sort().reverse().map((m) => (
                  <tr key={m}>
                    <td className="px-3 py-1.5">{nomeMes(m.slice(0, 7))} {m.slice(0, 4)}</td>
                    {lojas.map((u) => {
                      const r = resumo.find((x) => x.mes === m && x.unidadeId === u)
                      return <td key={u} className="px-3 py-1.5 text-right">{r ? <>{r.dias} dias · {Math.round(r.quantidade).toLocaleString('pt-BR')} itens<div className="text-xs text-stone-500">até {dataCurta(r.ultimo)}</div></> : '—'}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {semFicha.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold">Vendidos sem ficha (fora da conta)</h2>
          <p className="text-sm text-stone-600">
            Nas últimas 8 semanas. Produto sem ficha não entra no ideal nem nas compras: ligue a ficha em Cadastros › Produtos de venda.
            Observações (sem picles, para viagem…) podem ficar assim. O “SMASH (100G)” não entra porque a ficha do burger já tem a carne, e o
            “Refrigerante do combo” da ficha do combo também não, porque o refrigerante escolhido sai numa linha própria do cupom.
          </p>
          <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
            {semFicha.slice(0, 40).map((p) => (
              <div key={p.codigo} className="flex justify-between gap-2 px-3 py-1.5 text-sm">
                <span>{p.nome} <span className="text-xs text-stone-500">cód. {p.codigo}</span></span>
                <span className="text-stone-600">{mostrarQtd(Math.round(p.porSemana))} por semana</span>
              </div>
            ))}
          </div>
          <Botao variante="secundario" onClick={() => ir('cadastros/produtos')}>Ir para Produtos de venda</Botao>
        </section>
      )}
    </div>
  )
}
