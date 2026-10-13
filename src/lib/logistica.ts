import type { Catalogo } from './custos'
import { chaveDe, type ChaveItem, type EnvioEvento, type Evento, type Inventario, type ItemReceita, type QtdDiaProduto, type VendaEvento } from './types'

// Logística de eventos (08/10). Contas usadas pela previsão, pela separação e pelas sobras.
// Os itens são insumos ("i:<id>") ou pré-preparos feitos na base ("r:<id>"): na separação o pré-preparo vai pronto,
// então ele não é aberto nos insumos dele (isso fica para a lista de compras).
// - necessidade = vendas (previstas ou reais) × ficha técnica;
// - consumo real do dia = sobra da véspera + o que chegou para o dia − sobra contada no fim do dia;
// - quanto levar = necessidade prevista × ajuste pelo consumo real × (1 + margem) − sobra da véspera.

// Quanto de cada item é preciso para produzir as quantidades de produtos pedidas (já com o aproveitamento).
// abrirPreparos = true abre os pré-preparos até os insumos (compras); false para no pré-preparo (separação).
export function necessidade(cat: Catalogo, linhas: { receitaId: string; quantidade: number }[], abrirPreparos = false) {
  const total = new Map<ChaveItem, number>()
  const abrir = (itens: ItemReceita[], rendimento: number, unidades: number, pilha: string[]) => {
    const fator = unidades / (rendimento || 1)
    for (const i of itens) {
      const bruto = (i.quantidade / (i.aproveitamento || 1)) * fator
      // Material de estoque que é pré-preparo (tem ficha) também abre, para as compras.
      const sub = i.subReceitaId ?? (abrirPreparos && i.insumoId ? cat.fichaDoInsumo.get(i.insumoId) : undefined)
      const v = sub ? cat.atual.get(sub) : undefined
      if (sub && abrirPreparos && v && !pilha.includes(sub)) abrir(v.itens, v.rendimento, bruto, [...pilha, sub])
      else somar(total, chaveDe({ insumoId: i.insumoId, receitaId: i.subReceitaId })!, bruto)
    }
  }
  for (const l of linhas) {
    const v = cat.atual.get(l.receitaId)
    if (v && l.quantidade > 0) abrir(v.itens, v.rendimento, l.quantidade, [l.receitaId])
  }
  return total
}

function somar(m: Map<string, number>, k: string, q: number) {
  m.set(k, (m.get(k) ?? 0) + q)
}

// Produtos sem ficha (não dá para calcular os insumos deles).
export const semFicha = (cat: Catalogo, receitaIds: string[]) => [...new Set(receitaIds)].filter((id) => !cat.atual.has(id))

// Sexta, sábado e domingo vendem diferente; os outros dias entram juntos.
const tipoDia = (data: string) => {
  const d = new Date(data + 'T12:00:00').getDay()
  return d === 5 ? 'sexta' : d === 6 ? 'sabado' : d === 0 ? 'domingo' : 'semana'
}
export const NOME_TIPO_DIA: Record<string, string> = { sexta: 'sexta-feira', sabado: 'sábado', domingo: 'domingo', semana: 'dia de semana' }

// Eventos parecidos para servir de base: finalizados, com vendas, que não estão marcados como fora da média,
// da mesma gastronomia (se houver), mais recentes primeiro.
export function referenciasPadrao(alvo: Evento, eventos: Evento[], vendas: VendaEvento[]) {
  const comVenda = new Set(vendas.map((v) => v.eventoId))
  const fim = eventos.filter((e) => e.id !== alvo.id && e.status === 'finalizado' && !e.foraDaMedia && comVenda.has(e.id))
  const mesma = alvo.gastronomia ? fim.filter((e) => e.gastronomia === alvo.gastronomia) : []
  return (mesma.length ? mesma : fim).sort((a, b) => (b.dias[0]?.data ?? '').localeCompare(a.dias[0]?.data ?? '')).slice(0, 5)
}

export interface Sugestao {
  linhas: QtdDiaProduto[]
  // Como cada dia foi calculado (para mostrar na tela).
  base: Record<string, string>
}

// Média de vendas por dia de cada produto nos eventos de referência, no mesmo tipo de dia (sexta, sábado, domingo)
// quando houver; senão a média de todos os dias. Ajuste em % (ex.: 120 = 20% a mais).
export function sugerirVendas(dias: string[], produtos: string[], refs: string[], vendas: VendaEvento[], ajustePct: number): Sugestao {
  const v = vendas.filter((x) => refs.includes(x.eventoId))
  const diasRef = new Map<string, Set<string>>() // tipo de dia -> dias (evento|data)
  const todosDias = new Set<string>()
  for (const x of v) {
    const k = `${x.eventoId}|${x.data}`
    todosDias.add(k)
    const t = tipoDia(x.data)
    if (!diasRef.has(t)) diasRef.set(t, new Set())
    diasRef.get(t)!.add(k)
  }
  const soma = (filtro: (x: VendaEvento) => boolean, receitaId: string) => v.filter((x) => x.receitaId === receitaId && filtro(x)).reduce((s, x) => s + x.quantidade, 0)
  const linhas: QtdDiaProduto[] = []
  const base: Record<string, string> = {}
  for (const data of dias) {
    const t = tipoDia(data)
    const mesmos = diasRef.get(t)
    const usar = mesmos && mesmos.size ? { n: mesmos.size, f: (x: VendaEvento) => tipoDia(x.data) === t } : { n: todosDias.size, f: () => true }
    base[data] = usar.n
      ? mesmos && mesmos.size ? `média de ${usar.n} ${usar.n === 1 ? NOME_TIPO_DIA[t] : 'dias do mesmo tipo (' + NOME_TIPO_DIA[t] + ')'}` : `média de ${usar.n} dias`
      : 'sem histórico'
    for (const r of produtos) {
      const q = usar.n ? (soma(usar.f, r) / usar.n) * (ajustePct / 100) : 0
      if (q > 0) linhas.push({ data, receitaId: r, quantidade: Math.round(q) })
    }
  }
  return { linhas, base }
}

// O que chegou ao evento para cada dia (insumos e pré-preparos conferidos na saída; os não conferidos ainda não saíram).
export function entradasPorDia(envios: EnvioEvento[]) {
  const r = new Map<string, Map<string, number>>()
  for (const e of envios)
    for (const i of e.itens)
      if (chaveDe(i) && i.conferido) {
        if (!r.has(e.data)) r.set(e.data, new Map())
        somar(r.get(e.data)!, chaveDe(i)!, i.quantidade ?? i.previsto ?? 0)
      }
  return r
}

export const sobraPorDia = (inventarios: Inventario[]) =>
  new Map(inventarios.filter((i) => i.local === 'evento').map((i) => [i.data, new Map(i.itens.map((x) => [x.chave, x.quantidade]))]))

export interface LinhaConsumo {
  chave: ChaveItem
  porDia: Record<string, { entrou: number; sobrou: number | null; real: number | null; teorico: number | null }>
  // Consumo real ÷ teórico nos dias com os dois (perda, porção maior…). Fica entre 0,8 e 1,5.
  ajuste: number | null
}

// Consumo real × teórico por insumo e dia. Teórico usa as vendas reais do dia; sem elas, a previsão.
export function consumoEvento(cat: Catalogo, dias: string[], envios: EnvioEvento[], inventarios: Inventario[], vendas: QtdDiaProduto[], previsao: QtdDiaProduto[]) {
  const entra = entradasPorDia(envios)
  const sobra = sobraPorDia(inventarios)
  const teorico = new Map<string, Map<string, number>>()
  for (const d of dias) {
    const vd = vendas.filter((v) => v.data === d)
    teorico.set(d, necessidade(cat, vd.length ? vd : previsao.filter((p) => p.data === d)))
  }
  const ids = new Set<string>()
  for (const m of [...entra.values(), ...sobra.values()]) for (const k of m.keys()) ids.add(k)
  const linhas: LinhaConsumo[] = []
  for (const id of ids) {
    const porDia: LinhaConsumo['porDia'] = {}
    let anterior = 0
    let somaReal = 0
    let somaTeo = 0
    for (const d of dias) {
      const entrou = entra.get(d)?.get(id) ?? 0
      const contou = sobra.get(d)
      const sobrou = contou ? contou.get(id) ?? 0 : null
      const real = sobrou === null ? null : anterior + entrou - sobrou
      const teo = teorico.get(d)?.get(id) ?? null
      porDia[d] = { entrou, sobrou, real, teorico: teo }
      if (real !== null && teo && vendas.some((v) => v.data === d)) {
        somaReal += real
        somaTeo += teo
      }
      if (sobrou !== null) anterior = sobrou
      else anterior += entrou
    }
    linhas.push({ chave: id, porDia, ajuste: somaTeo > 0 ? Math.min(1.5, Math.max(0.8, somaReal / somaTeo)) : null })
  }
  return linhas
}

export interface LinhaLevar {
  chave: ChaveItem
  previsto: number // necessidade pela previsão de vendas do dia
  ajuste: number | null
  sobra: number // contada no fim do dia anterior (ou o que já está lá)
  jaEnviado: number
  levar: number
}

// Quanto separar para um dia do evento.
export function quantoLevar(cat: Catalogo, evento: Evento, data: string, previsao: QtdDiaProduto[], consumo: LinhaConsumo[], envios: EnvioEvento[], inventarios: Inventario[], arredondar: (chave: ChaveItem, q: number) => number) {
  const precisa = necessidade(cat, previsao.filter((p) => p.data === data))
  const dias = evento.dias.map((d) => d.data)
  const anteriores = dias.filter((d) => d < data)
  const sobra = sobraPorDia(inventarios)
  const entra = entradasPorDia(envios)
  // O que deve estar no evento antes do dia: última sobra contada + o que chegou depois dela.
  const noLocal = new Map<string, number>()
  const ultimaContada = [...anteriores].reverse().find((d) => sobra.has(d))
  if (ultimaContada) for (const [k, q] of sobra.get(ultimaContada)!) noLocal.set(k, q)
  for (const d of anteriores) if (!ultimaContada || d > ultimaContada) for (const [k, q] of entra.get(d) ?? []) somar(noLocal, k, q)
  const jaEnviado = new Map<string, number>()
  for (const e of envios) if (e.data === data) for (const i of e.itens) if (chaveDe(i)) somar(jaEnviado, chaveDe(i)!, i.quantidade ?? i.previsto ?? 0)
  const margem = 1 + evento.margemSegurancaPct / 100
  const ids = new Set([...precisa.keys()])
  const r: LinhaLevar[] = []
  for (const id of ids) {
    const aj = consumo.find((c) => c.chave === id)?.ajuste ?? null
    const previsto = precisa.get(id) ?? 0
    const s = noLocal.get(id) ?? 0
    const j = jaEnviado.get(id) ?? 0
    const bruto = previsto * (aj ?? 1) * margem - s - j
    r.push({ chave: id, previsto, ajuste: aj, sobra: s, jaEnviado: j, levar: bruto > 0 ? arredondar(id, bruto) : 0 })
  }
  return r
}

export interface SaldoBase {
  contado: number
  contadoEm: string
  saiu: number
  saldo: number
}

// Estoque da base: última contagem de cada item − o que foi conferido para eventos depois dela.
export function estoqueBase(contagens: Inventario[], envios: EnvioEvento[]) {
  const r = new Map<string, SaldoBase>()
  const ordenadas = [...contagens].filter((c) => c.local === 'base').sort((a, b) => b.contadoEm.localeCompare(a.contadoEm))
  for (const c of ordenadas)
    for (const i of c.itens) if (!r.has(i.chave)) r.set(i.chave, { contado: i.quantidade, contadoEm: c.contadoEm, saiu: 0, saldo: i.quantidade })
  for (const e of envios)
    for (const i of e.itens) {
      const k = chaveDe(i)
      const s = k ? r.get(k) : undefined
      if (s && i.conferido && (i.conferidoEm ?? e.criadoEm) > s.contadoEm) {
        s.saiu += i.quantidade ?? i.previsto ?? 0
        s.saldo = s.contado - s.saiu
      }
    }
  return r
}

// Arredonda para cima: unidade inteira; kg e litro em 0,1.
export const arredondarPara = (unidade: string, q: number) => (unidade === 'un' ? Math.ceil(q - 1e-9) : Math.ceil(q * 10 - 1e-9) / 10)

// Necessidade líquida (Heitor, 13/10): pré-preparo que já tem em estoque não abre nos ingredientes.
// Ex.: mix de cogumelos trufados em estoque → não precisa comprar cogumelo Paris, shimeji, tomilho e miso para ele.
// Cada pré-preparo junta toda a demanda (de todos os produtos e sub-fichas), desconta o estoque e só o que
// falta é aberto nos ingredientes. Processa por nível (o mais alto primeiro) para somar tudo antes de descontar.
// Chaves: 'i:<insumo>' (material comprado) e 'r:<ficha>' (pré-preparo, inclusive material que tem ficha).
export interface LinhaNecessidade { precisa: number; estoque: number; falta: number }
export function necessidadeLiquida(cat: Catalogo, linhas: { receitaId: string; quantidade: number }[], estoqueDe: (chave: string) => number) {
  const chaveItem = (i: ItemReceita) => {
    const sub = i.subReceitaId ?? (i.insumoId ? cat.fichaDoInsumo.get(i.insumoId) : undefined)
    return sub ? 'r:' + sub : 'i:' + i.insumoId
  }
  const nivel = new Map<string, number>()
  const visitar = (rid: string, n: number, pilha: string[]) => {
    for (const i of cat.atual.get(rid)?.itens ?? []) {
      const k = chaveItem(i)
      if (!k.startsWith('r:')) continue
      const sub = k.slice(2)
      if (pilha.includes(sub) || (nivel.get(sub) ?? -1) >= n) continue
      nivel.set(sub, n)
      visitar(sub, n + 1, [...pilha, sub])
    }
  }
  for (const l of linhas) if (l.quantidade > 0) visitar(l.receitaId, 1, [l.receitaId])
  const bruto = new Map<string, number>()
  const explodir = (rid: string, unidades: number) => {
    const v = cat.atual.get(rid)
    if (!v) return
    const f = unidades / (v.rendimento || 1)
    for (const i of v.itens) somar(bruto, chaveItem(i), (i.quantidade / (i.aproveitamento || 1)) * f)
  }
  for (const l of linhas) if (l.quantidade > 0) explodir(l.receitaId, l.quantidade)
  const out = new Map<string, LinhaNecessidade>()
  for (const n of [...new Set(nivel.values())].sort((a, b) => a - b)) {
    for (const [sub, nv] of nivel) {
      if (nv !== n) continue
      const k = 'r:' + sub
      const q = bruto.get(k) ?? 0
      if (q <= 0) continue
      const tem = Math.max(0, estoqueDe(k))
      const falta = Math.max(0, q - tem)
      out.set(k, { precisa: q, estoque: tem, falta })
      if (falta > 0) explodir(sub, falta)
    }
  }
  for (const [k, q] of bruto) {
    if (out.has(k) || q <= 0) continue
    const tem = Math.max(0, estoqueDe(k))
    out.set(k, { precisa: q, estoque: tem, falta: Math.max(0, q - tem) })
  }
  return out
}
