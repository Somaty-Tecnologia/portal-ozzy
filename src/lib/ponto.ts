import type { MarcacaoPonto } from './types'

// Espelho do ponto: junta as marcações em jornadas (a da noite que passa da meia-noite fica no dia em que entrou).
// Trabalhado = soma dos pares entrada→saída (1ª→2ª, 3ª→4ª…); intervalo = da 2ª à 3ª.
export interface Jornada {
  data: string // dia da entrada, em São Paulo
  marcacoes: MarcacaoPonto[]
  trabalhadoMin: number
  intervaloMin: number | null
  incompleta: boolean
}

export const diaSP = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
export const horaSP = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
export const horas = (min: number) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`

export function jornadas(marcacoes: MarcacaoPonto[]): Jornada[] {
  const validas = marcacoes.filter((m) => !m.desconsiderada).sort((a, b) => a.momento.localeCompare(b.momento))
  const grupos: MarcacaoPonto[][] = []
  for (const m of validas) {
    const g = grupos[grupos.length - 1]
    const ult = g?.[g.length - 1]
    // "Entrada" batida por engano no meio da jornada (ex.: na volta do intervalo) não abre outra jornada:
    // só abre se a última foi saída, se passou de 16 h ou se é entrada mais de 6 h depois da última batida.
    const gap = g ? Date.parse(m.momento) - Date.parse(ult.momento) : 0
    const nova = !g || ult.tipo === 'saida' || gap > 16 * 3600_000 || (m.tipo === 'entrada' && gap > 6 * 3600_000)
    if (nova) grupos.push([m])
    else g.push(m)
  }
  return grupos.map((g) => {
    let trabalhado = 0
    for (let i = 0; i + 1 < g.length; i += 2) trabalhado += (Date.parse(g[i + 1].momento) - Date.parse(g[i].momento)) / 60000
    const intervalo = g.length >= 3 ? (Date.parse(g[2].momento) - Date.parse(g[1].momento)) / 60000 : null
    return { data: diaSP(g[0].momento), marcacoes: g, trabalhadoMin: Math.round(trabalhado), intervaloMin: intervalo === null ? null : Math.round(intervalo), incompleta: g[g.length - 1].tipo !== 'saida' }
  })
}

// Data e hora digitadas (horário de São Paulo, UTC−3) para o instante certo.
export const momentoSP = (data: string, hora: string) => new Date(`${data}T${hora}:00-03:00`).toISOString()
