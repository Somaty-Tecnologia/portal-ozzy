import { addDias, diasEntre, indiceSemana, inicioDaSemana } from './datas'
import type { Admissao, Desligamento, Documento, EntregaUniforme, Folga, Funcionario, Turno } from './types'


// ---------- Aniversário ----------

// Aniversário deste ano (29/02 cai em 28/02 nos anos que não são bissextos).
export function aniversarioNoAno(nascimento: string, ano: number) {
  const md = nascimento.slice(5)
  const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0
  return `${ano}-${md === '02-29' && !bissexto ? '02-28' : md}`
}

// 'hoje' no dia; 'semana' de segunda a domingo da semana do aniversário.
export function situacaoAniversario(nascimento: string | null | undefined, hoje: string): 'hoje' | 'semana' | null {
  if (!nascimento) return null
  const dia = aniversarioNoAno(nascimento, Number(hoje.slice(0, 4)))
  if (dia === hoje) return 'hoje'
  return inicioDaSemana(dia) === inicioDaSemana(hoje) ? 'semana' : null
}

export const idadeEm = (nascimento: string, data: string) =>
  Number(data.slice(0, 4)) - Number(nascimento.slice(0, 4)) - (data.slice(5) < nascimento.slice(5) ? 1 : 0)

// Ativos que fazem aniversário nesta semana (segunda a domingo), em ordem de data.
export function aniversariantesDaSemana(equipe: Funcionario[], hoje: string) {
  return equipe
    .filter((f) => f.status === 'ativo' && situacaoAniversario(f.dataNascimento, hoje))
    .map((f) => ({ pessoa: f, dia: aniversarioNoAno(f.dataNascimento!, Number(hoje.slice(0, 4))) }))
    .sort((a, b) => a.dia.localeCompare(b.dia))
}

// ---------- Contrato de experiência ----------

export const EXPERIENCIA_PADRAO: [number, number] = [10, 80]
// Aviso para a gestão quando faltam até tantos dias para um vencimento.
export const AVISO_EXPERIENCIA_DIAS = 7

export interface Experiencia {
  vence1: string
  vence2: string | null
  // Dia do contrato contando a admissão como dia 1.
  dia: number
  total: number
  fase: 'periodo1' | 'periodo2' | 'encerrado'
  // Próximo vencimento e quantos dias faltam (0 = vence hoje).
  proximo: string | null
  faltam: number | null
}

// A admissão conta como o 1º dia: 10 dias a partir de 01/10 vencem em 10/10.
export function experienciaDe(f: Pick<Funcionario, 'dataAdmissao' | 'experienciaDias1' | 'experienciaDias2'>, hoje: string): Experiencia | null {
  if (!f.experienciaDias1 || !f.dataAdmissao) return null
  const d2 = f.experienciaDias2 ?? 0
  const vence1 = addDias(f.dataAdmissao, f.experienciaDias1 - 1)
  const vence2 = d2 > 0 ? addDias(vence1, d2) : null
  const fim = vence2 ?? vence1
  const fase = hoje <= vence1 ? 'periodo1' : hoje <= fim ? 'periodo2' : 'encerrado'
  const proximo = fase === 'periodo1' ? vence1 : fase === 'periodo2' ? vence2 : null
  return {
    vence1, vence2, fase, proximo,
    dia: diasEntre(f.dataAdmissao, hoje) + 1,
    total: f.experienciaDias1 + d2,
    faltam: proximo ? diasEntre(hoje, proximo) : null,
  }
}

// Admitido há menos de 90 dias (ou com admissão futura): o cadastro pergunta pelo contrato de experiência.
export const recemAdmitido = (admissao: string | undefined, hoje: string) => !!admissao && diasEntre(admissao, hoje) < 90

export function alertasExperiencia(equipe: Funcionario[], hoje: string) {
  return equipe
    .filter((f) => f.status === 'ativo')
    .map((f) => ({ pessoa: f, exp: experienciaDe(f, hoje) }))
    .filter((x): x is { pessoa: Funcionario; exp: Experiencia } => !!x.exp && x.exp.faltam !== null && x.exp.faltam <= AVISO_EXPERIENCIA_DIAS)
    .sort((a, b) => a.exp.faltam! - b.exp.faltam!)
}

// ---------- Afastamento (INSS) ----------

// CLT/INSS: a empresa paga os primeiros 15 dias de afastamento. Atestados que somam mais de 15 dias
// dentro de 60 dias (pela mesma doença) vão para o INSS a partir do 16º dia.
export const JANELA_AFASTAMENTO = 60
export const LIMITE_AFASTAMENTO = 15

export function diasDeAtestado(atestados: Documento[], hoje: string) {
  const desde = addDias(hoje, -(JANELA_AFASTAMENTO - 1))
  let dias = 0
  for (const a of atestados) {
    if (a.tipo !== 'atestado' || !a.inicio) continue
    const ini = a.inicio < desde ? desde : a.inicio
    const fim = a.fim && a.fim >= a.inicio ? a.fim : a.inicio
    if (fim < desde) continue
    dias += diasEntre(ini, fim) + 1
  }
  return dias
}

export function alertasAfastamento(equipe: Funcionario[], docs: Documento[], hoje: string) {
  return equipe
    .filter((f) => f.status === 'ativo')
    .map((f) => ({ pessoa: f, dias: diasDeAtestado(docs.filter((d) => d.funcionarioId === f.id), hoje) }))
    .filter((x) => x.dias > LIMITE_AFASTAMENTO)
    .sort((a, b) => b.dias - a.dias)
}

// ---------- Desligamento ----------

// Prazo legal para pagar a rescisão: 10 dias corridos após o término do contrato (CLT art. 477, § 6º).
export const prazoRescisao = (d: Pick<Desligamento, 'data'>) => addDias(d.data, 10)

export interface EtapaDesligamento {
  chave: string
  nome: string
  detalhe?: string
}

// Lista padrão (a validar com o escritório). Algumas etapas só aparecem quando se aplicam.
export function etapasDesligamento(d: Pick<Desligamento, 'data' | 'tipo'>, pessoa: Pick<Funcionario, 'sexo'>): EtapaDesligamento[] {
  const prazo = prazoRescisao(d).split('-').reverse().join('/')
  const seguro = d.tipo === 'sem_justa_causa' || d.tipo === 'acordo'
  const lista: (EtapaDesligamento | false)[] = [
    { chave: 'aviso', nome: d.tipo === 'pedido' ? 'Carta de pedido de demissão assinada' : 'Aviso de desligamento assinado', detalhe: 'Com a data e se o aviso prévio é trabalhado ou indenizado.' },
    pessoa.sexo === 'feminino' && { chave: 'gravidez', nome: 'Termos de exame de gravidez (oferta ou recusa)', detalhe: 'Gerados pelo portal; anexar assinado no cadastro.' },
    { chave: 'aso', nome: 'Exame demissional (ASO)', detalhe: 'Dispensado se o último exame for de menos de 90 dias.' },
    { chave: 'uniforme', nome: 'Devolução de uniformes e EPIs', detalhe: 'Confira em Uniformes, no perfil: o portal soma o que foi entregue e calcula o desconto do que faltar.' },
    { chave: 'chaves', nome: 'Devolução de chaves, armário e crachá' },
    { chave: 'acessos', nome: 'Tirar acessos', detalhe: 'Ponto (Control iD), grupos de WhatsApp, PDV e sistemas.' },
    { chave: 'pendencias', nome: 'Fechar caixinha, freelas, faltas e descontos do mês' },
    { chave: 'contabilidade', nome: 'Enviar para a contabilidade calcular a rescisão' },
    { chave: 'pagamento', nome: `Pagar a rescisão até ${prazo}`, detalhe: 'Prazo de 10 dias corridos depois do último dia (CLT art. 477).' },
    { chave: 'trct', nome: 'TRCT assinado e anexado no cadastro' },
    { chave: 'ctps', nome: 'Baixa na carteira digital / eSocial', detalhe: 'Feita pela contabilidade.' },
    seguro && { chave: 'guias', nome: 'Entregar guias de FGTS e seguro-desemprego' },
  ]
  return lista.filter((x): x is EtapaDesligamento => !!x)
}

export function progressoDesligamento(d: Desligamento, pessoa: Pick<Funcionario, 'sexo'>) {
  const etapas = etapasDesligamento(d, pessoa)
  const feitas = etapas.filter((e) => d.itens[e.chave]).length
  return { feitas, total: etapas.length, pagamentoFeito: !!d.itens.pagamento }
}

// ---------- Admissão (passo a passo pedido em 08/10) ----------
// Etapas na ordem em que acontecem (reunião de RH de 08/10). "auto" = o portal sabe sozinho se está feito;
// as outras a gestão marca. acao: o botão que resolve a etapa ali mesmo.
export interface EtapaAdmissao {
  chave: string
  nome: string
  detalhe?: string
  auto?: boolean
  acao?: 'editar' | 'guia' | 'contrato' | 'uniforme' | 'turno' | 'documento'
}

export interface ContextoAdmissao {
  docs: Pick<Documento, 'tipo'>[]
  entregas: Pick<EntregaUniforme, 'assinatura'>[]
  assinouRegulamento: boolean
}

// Admissão "aberta" para mostrar o passo a passo: quem entrou há até 120 dias e ainda não concluiu. Só conta
// quem entrou a partir de 08/10/2026 (quando o passo a passo começou), para o time antigo não aparecer como pendente.
export const DIAS_ADMISSAO = 120
export const ADMISSAO_DESDE = '2026-10-08'
export const emAdmissao = (p: Pick<Funcionario, 'status' | 'nivel' | 'dataAdmissao'>, hojeIso: string) =>
  p.status === 'ativo' && p.nivel !== 'proprietario' && p.dataAdmissao >= ADMISSAO_DESDE && p.dataAdmissao >= addDias(hojeIso, -DIAS_ADMISSAO)

export function faltaNoCadastro(p: Funcionario) {
  return [
    !p.cpf && 'CPF', !p.rg && 'RG', !p.ctps && 'carteira de trabalho', !p.endereco && 'endereço', !p.dataNascimento && 'nascimento',
    !p.sexo && 'sexo', !p.setor && 'setor', !p.pix && 'Pix', !(p.tamCamiseta && p.tamCalca && p.tamCalcado) && 'tamanhos do uniforme',
  ].filter((x): x is string => !!x)
}

export function etapasAdmissao(p: Funcionario, c: ContextoAdmissao): EtapaAdmissao[] {
  const falta = faltaNoCadastro(p)
  const tem = (t: Documento['tipo']) => c.docs.some((d) => d.tipo === t)
  return [
    { chave: 'dados', nome: 'Dados do cadastro completos', auto: falta.length === 0, detalhe: falta.length ? `Falta: ${falta.join(', ')}.` : undefined, acao: 'editar' },
    { chave: 'documentos', nome: 'Documentos recolhidos e enviados à contabilidade', detalhe: 'A Josie recolhe e manda para a Ana Paula antes da pessoa começar.' },
    { chave: 'guia', nome: 'Encaminhamento para o exame gerado e enviado', detalhe: 'Marca sozinho quando a guia é gerada aqui.', acao: 'guia' },
    { chave: 'aso', nome: 'Exame admissional feito (ASO anexado)', auto: tem('aso_admissional'), detalhe: 'Anexe o ASO em Documentos, como "ASO admissional".', acao: 'documento' },
    { chave: 'registro', nome: 'Registro feito pela contabilidade', detalhe: 'A pessoa só começa depois do registro e do exame.' },
    { chave: 'contrato', nome: 'Contrato de experiência gerado', detalhe: 'Marca sozinho quando o contrato é gerado aqui.', acao: 'contrato' },
    { chave: 'contrato_assinado', nome: 'Contrato assinado e anexado', auto: tem('contrato'), detalhe: 'Anexe em Documentos, como "Contrato".', acao: 'documento' },
    { chave: 'uniforme', nome: 'Uniforme entregue e termo assinado', auto: c.entregas.some((e) => e.assinatura), acao: 'uniforme' },
    { chave: 'turno', nome: 'Colocado(a) no turno', auto: !!p.turnoId, acao: 'turno' },
    { chave: 'ponto', nome: 'Orientado(a) a bater o ponto pelo portal' },
    { chave: 'acesso', nome: 'Recebeu o acesso ao portal', detalhe: 'Login = celular; passe a senha para a pessoa.' },
    { chave: 'regulamento', nome: 'Regulamento interno assinado no portal', auto: c.assinouRegulamento, detalhe: 'A pessoa assina pelo próprio login, em Regras e processos.' },
    { chave: 'apresentacao', nome: 'Regras da empresa apresentadas', detalhe: 'Feito pela Josie.' },
    { chave: 'treinamento', nome: 'Treinamento no setor', detalhe: 'Com a Josie ou o supervisor do setor.' },
  ]
}

export const etapaFeita = (e: EtapaAdmissao, a: Pick<Admissao, 'itens'> | null) => !!e.auto || !!a?.itens[e.chave]

export function progressoAdmissao(p: Funcionario, c: ContextoAdmissao, a: Pick<Admissao, 'itens'> | null) {
  const etapas = etapasAdmissao(p, c)
  const feitas = etapas.filter((e) => etapaFeita(e, a)).length
  return { feitas, total: etapas.length, proxima: etapas.find((e) => !etapaFeita(e, a)) ?? null }
}

// Folgas do turno (Heitor, 09/10): o dia em que o turno da pessoa não tem horário (ex.: segunda) já é folga,
// sem marcar. O que foi marcado à mão vale por cima: feriado, folga normal ou 'trabalha' (vai trabalhar nesse dia).
export function comFolgasDoTurno(
  marcadas: Folga[],
  pessoas: Pick<Funcionario, 'id' | 'turnoId' | 'status' | 'dataAdmissao'>[],
  turnos: Pick<Turno, 'id' | 'dias'>[],
  inicio: string,
  fim: string,
  comTrabalha = false,
): Folga[] {
  const marcada = new Set(marcadas.map((g) => `${g.funcionarioId}|${g.data}`))
  const autos: Folga[] = []
  for (const p of pessoas) {
    const t = p.turnoId ? turnos.find((x) => x.id === p.turnoId) : undefined
    if (!t || p.status !== 'ativo') continue
    // Turno sem nenhum dia de trabalho (ainda não montado) não vira folga.
    if (!t.dias.some(Boolean)) continue
    for (let d = inicio; d <= fim; d = addDias(d, 1)) {
      if (t.dias[indiceSemana(d)] || (p.dataAdmissao && d < p.dataAdmissao) || marcada.has(`${p.id}|${d}`)) continue
      autos.push({ id: `turno:${p.id}:${d}`, funcionarioId: p.id, data: d, tipo: 'normal', automatica: true })
    }
  }
  return [...marcadas.filter((g) => comTrabalha || g.tipo !== 'trabalha'), ...autos]
}
