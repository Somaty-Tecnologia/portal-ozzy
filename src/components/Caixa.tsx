import { useCallback, useEffect, useState } from 'react'
import { Botao, Campo, Cartao, estiloEntrada } from './ui'
import { useApp } from '../lib/contexto'
import { addDias, dataCurta, diaSemana } from '../lib/datas'
import { lerValor, reais } from '../lib/financeiro'
import { podeGerenciar } from '../lib/permissoes'
import type { CaixaTurno } from '../lib/types'

// Caixa da loja (Heitor, 13/10): um turno por dia. Abre com o dinheiro do início, lança as sangrias do dia,
// e no fim quem fecha põe o valor contado, o que foi enviado ao escritório e uma observação.
const texto = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n).replace('.', ','))
const valor = (t: string) => { const v = lerValor(t); return v === null ? null : Math.round(v * 100) / 100 }

export default function Caixa({ loja, data }: { loja: string; data: string }) {
  const { store, eu, avisar, nomeDe } = useApp()
  const gestao = podeGerenciar(eu.nivel)
  const [turnos, setTurnos] = useState<CaixaTurno[] | null>(null)
  const [pessoas, setPessoas] = useState<{ id: string; nome: string }[]>([])
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({ inicial: '', final: '', enviado: '', obs: '', responsavel: eu.id })
  const [sangria, setSangria] = useState({ valor: '', descricao: '' })
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const l = await store.caixaTurnos(loja, addDias(data, -14), data)
      setTurnos(l)
      const t = l.find((x) => x.data === data)
      const ant = l.find((x) => x.data < data && x.valorFinal !== null)
      setForm({
        // Abre com o que ficou no caixa no último fechamento (contado − enviado ao escritório).
        inicial: texto(t ? t.valorInicial : ant ? Math.round(((ant.valorFinal ?? 0) - (ant.valorEnviado ?? 0)) * 100) / 100 : null),
        final: texto(t?.valorFinal), enviado: texto(t?.valorEnviado), obs: t?.observacao ?? '', responsavel: t?.responsavelId ?? eu.id,
      })
    } catch (e) { setErro((e as Error).message) }
  }, [store, loja, data, eu.id])
  useEffect(() => { setTurnos(null); carregar() }, [carregar])
  useEffect(() => { store.pessoasAtivas().then((p) => setPessoas(p.sort((a, b) => a.nome.localeCompare(b.nome))), () => undefined) }, [store])

  if (erro) return <p className="text-red-700">{erro}</p>
  if (!turnos) return <p className="text-stone-400">Carregando…</p>
  const t = turnos.find((x) => x.data === data) ?? null
  const fechado = !!t?.fechadoEm
  const travado = fechado && !gestao
  const totalSangria = t?.sangrias.reduce((s, x) => s + x.valor, 0) ?? 0
  const final = valor(form.final)
  const enviado = valor(form.enviado) ?? 0
  const fica = final !== null ? final - enviado : null

  const executar = async (f: () => Promise<void>, msg: string) => {
    setSalvando(true)
    try { await f(); avisar(msg); await carregar() } catch (e) { avisar((e as Error).message) } finally { setSalvando(false) }
  }
  const abrir = () => {
    const v = valor(form.inicial)
    if (v === null) return avisar('Informe o valor inicial do caixa.')
    executar(() => store.abrirCaixa({ unidadeId: loja, data, valorInicial: v, responsavelId: form.responsavel || null }), 'Caixa aberto')
  }
  const salvar = (fechar: boolean) => {
    if (!t) return
    if (fechar && final === null) return avisar('Informe o valor final contado no caixa.')
    if (fechar && !form.responsavel) return avisar('Escolha o responsável pelo fechamento.')
    executar(() => store.salvarCaixa(t.id, {
      valorInicial: valor(form.inicial) ?? t.valorInicial, valorFinal: final, valorEnviado: valor(form.enviado), observacao: form.obs, responsavelId: form.responsavel || null, fechar,
    }), fechar ? 'Caixa fechado' : 'Caixa salvo')
  }
  const lancarSangria = () => {
    const v = valor(sangria.valor)
    if (!t || !v || v <= 0) return avisar('Informe o valor da sangria.')
    if (!sangria.descricao.trim()) return avisar('Diga para que foi a sangria.')
    executar(async () => { await store.lancarSangria(t.id, v, sangria.descricao); setSangria({ valor: '', descricao: '' }) }, 'Sangria lançada')
  }
  const entrada = (k: keyof typeof form, rotulo: string, dica?: string) => (
    <Campo rotulo={rotulo} dica={dica}>
      <input inputMode="decimal" className={estiloEntrada} placeholder="R$ 0,00" value={form[k]} disabled={travado} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
    </Campo>
  )
  const historico = turnos.filter((x) => x.data !== data)

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl px-4 py-3 text-sm ${!t ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200' : fechado ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200' : 'bg-sky-50 text-sky-900 ring-1 ring-sky-200'}`}>
        Caixa de <b>{diaSemana(data).toLowerCase()}, {dataCurta(data)}</b>.{' '}
        {!t ? 'Ainda não aberto.' : fechado
          ? <>Fechado {new Date(t.fechadoEm!).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}{t.fechadoPor ? ` por ${nomeDe(t.fechadoPor)}` : ''}.{gestao ? ' A gestão ainda pode corrigir.' : ''}</>
          : <>Aberto {new Date(t.abertoEm).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}{t.abertoPor ? ` por ${nomeDe(t.abertoPor)}` : ''}.</>}
      </div>

      <Cartao>
        <div className="grid gap-3 sm:grid-cols-2">
          {entrada('inicial', 'Valor inicial (dinheiro no caixa)', !t ? 'Vem com o que ficou no último fechamento.' : undefined)}
          <Campo rotulo="Responsável pelo caixa">
            <select className={estiloEntrada} value={form.responsavel} disabled={travado} onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))}>
              <option value="">Escolha</option>
              {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </Campo>
        </div>
        {!t && <div className="mt-3"><Botao onClick={abrir} disabled={salvando}>Abrir caixa</Botao></div>}
      </Cartao>

      {t && (
        <>
          <Cartao>
            <h3 className="font-bold">Sangrias</h3>
            <p className="text-sm text-stone-500">Dinheiro que saiu do caixa durante o dia (ex.: comprar gelo no mercado).</p>
            {t.sangrias.length > 0 && (
              <ul className="mt-2 divide-y divide-stone-100 text-sm">
                {t.sangrias.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 py-1.5">
                    <span className="flex-1">{s.descricao} <span className="text-xs text-stone-400">· {new Date(s.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}{s.criadoPor ? ` · ${nomeDe(s.criadoPor)}` : ''}</span></span>
                    <span className="font-semibold">{reais(s.valor)}</span>
                    {!travado && <button className="text-stone-400 hover:text-red-600" title="Apagar" onClick={() => confirm('Apagar esta sangria?') && executar(() => store.apagarSangria(s.id), 'Sangria apagada')}>✕</button>}
                  </li>
                ))}
                <li className="flex justify-between py-1.5 font-bold"><span>Total</span><span>{reais(totalSangria)}</span></li>
              </ul>
            )}
            {!travado && (
              <div className="mt-2 flex flex-wrap gap-2">
                <input inputMode="decimal" className={`${estiloEntrada} w-32!`} placeholder="R$ 0,00" aria-label="Valor da sangria" value={sangria.valor} onChange={(e) => setSangria((s) => ({ ...s, valor: e.target.value }))} />
                <input className={`${estiloEntrada} min-w-48 flex-1`} placeholder="Para que foi (ex.: gelo)" aria-label="Para que foi a sangria" value={sangria.descricao}
                  onChange={(e) => setSangria((s) => ({ ...s, descricao: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && lancarSangria()} />
                <Botao variante="secundario" onClick={lancarSangria} disabled={salvando}>+ Sangria</Botao>
              </div>
            )}
          </Cartao>

          <Cartao>
            <h3 className="font-bold">Fechamento do caixa</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {entrada('final', 'Valor final (contado no caixa)')}
              {entrada('enviado', 'Valor enviado ao escritório', 'Dinheiro que sai do caixa para o escritório.')}
            </div>
            <Campo rotulo="Observação">
              <textarea rows={2} className={estiloEntrada} placeholder="Opcional" value={form.obs} disabled={travado} onChange={(e) => setForm((f) => ({ ...f, obs: e.target.value }))} />
            </Campo>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              <div><dt className="text-stone-500">Inicial</dt><dd className="font-semibold">{reais(valor(form.inicial) ?? t.valorInicial)}</dd></div>
              <div><dt className="text-stone-500">Sangrias</dt><dd className="font-semibold">{reais(totalSangria)}</dd></div>
              <div><dt className="text-stone-500">Enviado</dt><dd className="font-semibold">{reais(enviado)}</dd></div>
              <div><dt className="text-stone-500">Fica para amanhã</dt><dd className="font-semibold">{fica === null ? '—' : reais(fica)}</dd></div>
            </dl>
            {!travado && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Botao variante="secundario" onClick={() => salvar(false)} disabled={salvando}>Salvar</Botao>
                <Botao onClick={() => salvar(true)} disabled={salvando}>{fechado ? 'Salvar correção' : 'Fechar caixa'}</Botao>
                {fechado && gestao && <Botao variante="secundario" onClick={() => executar(() => store.salvarCaixa(t.id, { reabrir: true }), 'Caixa reaberto')}>Reabrir</Botao>}
              </div>
            )}
          </Cartao>
        </>
      )}

      {historico.length > 0 && (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs text-stone-500">
              <tr><th className="px-3 py-2">Dia</th><th className="px-2 py-2 text-right">Inicial</th><th className="px-2 py-2 text-right">Sangrias</th><th className="px-2 py-2 text-right">Final</th><th className="px-2 py-2 text-right">Enviado</th><th className="px-2 py-2">Responsável</th></tr>
            </thead>
            <tbody>
              {historico.map((x) => (
                <tr key={x.id} className="border-t border-stone-100">
                  <td className="px-3 py-1.5 whitespace-nowrap">{diaSemana(x.data).slice(0, 3)} {dataCurta(x.data)}{!x.fechadoEm && <span className="ml-1 text-xs font-semibold text-amber-700">aberto</span>}</td>
                  <td className="px-2 py-1.5 text-right">{reais(x.valorInicial)}</td>
                  <td className="px-2 py-1.5 text-right">{reais(x.sangrias.reduce((s, y) => s + y.valor, 0))}</td>
                  <td className="px-2 py-1.5 text-right">{x.valorFinal === null ? '—' : reais(x.valorFinal)}</td>
                  <td className="px-2 py-1.5 text-right">{x.valorEnviado === null ? '—' : reais(x.valorEnviado)}</td>
                  <td className="px-2 py-1.5">{x.responsavelId ? nomeDe(x.responsavelId) : '—'}{x.observacao && <span className="block text-xs text-stone-500">{x.observacao}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
