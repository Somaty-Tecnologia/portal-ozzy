import type { ExecucaoChecklist, ItemChecklist, ModeloChecklist, RespostaChecklist } from './types'

// Checklists (15/10, no lugar do Konclui). As mesmas contas do banco (0111), para a demonstração e as telas.

export type SituacaoChecklist = 'nao_iniciado' | 'iniciado' | 'atrasado' | 'nao_executado' | 'finalizado'
export const SITUACOES: Record<SituacaoChecklist, { nome: string; cor: 'cinza' | 'azul' | 'ambar' | 'vermelho' | 'verde' }> = {
  nao_iniciado: { nome: 'Não iniciado', cor: 'cinza' },
  iniciado: { nome: 'Iniciado', cor: 'azul' },
  atrasado: { nome: 'Atrasado', cor: 'ambar' },
  nao_executado: { nome: 'Não executado', cor: 'vermelho' },
  finalizado: { nome: 'Finalizado', cor: 'verde' },
}
// Bônus do mês (Heitor, 15/10): quem fecha o mês acima de 90% de efetividade ganha R$ 100.
export const META_BONUS = 90
export const VALOR_BONUS = 100

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
export const nomeDias = (d: number[]) =>
  d.length === 7 ? 'Todos os dias' : d.length === 6 && !d.includes(0) ? 'Ter a dom' : [...d].sort().map((x) => DIAS[x]).join(', ')
export { DIAS as DIAS_SEMANA }

// 0 = segunda … 6 = domingo
const diaDaSemana = (data: string) => (new Date(data + 'T12:00:00').getDay() + 6) % 7

export function noDia(m: Pick<ModeloChecklist, 'frequencia' | 'diasSemana' | 'diaMes'>, data: string) {
  if (m.frequencia === 'mensal') {
    const [a, mes] = data.split('-').map(Number)
    const ultimo = new Date(a, mes, 0).getDate()
    return Number(data.slice(8, 10)) === Math.min(m.diaMes ?? 1, ultimo)
  }
  return m.diasSemana.includes(diaDaSemana(data))
}

// Prazo em horário de São Paulo (UTC−3).
export const prazoDe = (data: string, horario: string) => new Date(`${data}T${horario}:00-03:00`).toISOString()
const diaSP = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10)

export function situacao(e: Pick<ExecucaoChecklist, 'data' | 'prazo' | 'iniciadoEm' | 'finalizadoEm'>, agora = new Date()): SituacaoChecklist {
  if (e.finalizadoEm) return 'finalizado'
  if (e.data < diaSP(agora.toISOString())) return 'nao_executado'
  if (agora.getTime() > new Date(e.prazo).getTime()) return 'atrasado'
  return e.iniciadoEm ? 'iniciado' : 'nao_iniciado'
}

// Conforme? check: ok/nok (n/a não conta); número: dentro da faixa.
export function conformeDe(i: Pick<ItemChecklist, 'tipo' | 'minimo' | 'maximo'>, valor: string | null): boolean | null {
  if (!valor) return null
  if (i.tipo === 'check') return valor === 'ok' ? true : valor === 'nok' ? false : null
  if (i.tipo === 'numero') {
    const n = Number(valor.replace(',', '.'))
    if (Number.isNaN(n)) return null
    return (i.minimo === null || n >= i.minimo) && (i.maximo === null || n <= i.maximo)
  }
  return null
}

export const respondido = (i: ItemChecklist, r: RespostaChecklist | undefined) =>
  !!r && (!!r.valor || (i.tipo === 'texto' && !!r.foto)) && (!i.exigeFoto || !!r.foto)

// Pontuação de uma execução, igual a finalizar_checklist():
// esforço = obrigatórios respondidos; qualidade = conformes entre os avaliados; pontualidade = 100 até o prazo + tolerância,
// depois −2 por minuto; score = média das três (sem item avaliável, qualidade = esforço).
export function pontuar(m: ModeloChecklist, respostas: RespostaChecklist[], prazo: string, fim: Date) {
  const por = new Map(respostas.map((r) => [r.itemId, r]))
  const itens = m.itens.filter((i) => i.ativo || por.has(i.id!))
  const obrig = itens.filter((i) => i.obrigatorio)
  const resp = obrig.filter((i) => respondido(i, por.get(i.id!))).length
  const aval = respostas.filter((r) => r.conforme !== null)
  const atraso = Math.max(0, (fim.getTime() - new Date(prazo).getTime()) / 60000 - m.toleranciaMin)
  const pontualidade = Math.max(0, 100 - 2 * atraso)
  const esforco = obrig.length ? (100 * resp) / obrig.length : 100
  const qualidade = aval.length ? (100 * aval.filter((r) => r.conforme).length) / aval.length : null
  const r1 = (n: number) => Math.round(n * 10) / 10
  return {
    totalItens: obrig.length, respondidos: resp, pontualidade: r1(pontualidade), esforco: r1(esforco), qualidade: qualidade === null ? null : r1(qualidade),
    score: r1((pontualidade + esforco + (qualidade ?? esforco)) / 3),
  }
}

// Efetividade (como o ranking do Konclui): média do score das execuções que já venceram ou foram finalizadas;
// não executado (o dia passou sem finalizar) conta 0. As de hoje ainda abertas não entram.
export function efetividade(execs: ExecucaoChecklist[], agora = new Date()) {
  const contam = execs.filter((e) => e.finalizadoEm || situacao(e, agora) === 'nao_executado')
  if (!contam.length) return null
  const soma = contam.reduce((t, e) => t + (e.finalizadoEm ? (e.score ?? 0) : 0), 0)
  const media = (campo: 'pontualidade' | 'esforco' | 'qualidade') => {
    const v = contam.map((e) => (e.finalizadoEm ? e[campo] : 0)).filter((x): x is number => x !== null)
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
  }
  return {
    score: soma / contam.length, contam: contam.length, finalizados: contam.filter((e) => e.finalizadoEm).length,
    pontualidade: media('pontualidade'), esforco: media('esforco'), qualidade: media('qualidade'),
  }
}

export const pct = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${Math.round(n)}%`)
