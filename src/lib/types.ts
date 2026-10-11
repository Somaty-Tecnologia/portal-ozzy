export type Nivel = 'funcionario' | 'supervisor' | 'gerente' | 'administrativo' | 'proprietario' | 'manutencao'

export type Status = 'ativo' | 'inativo'

export interface Unidade {
  id: string
  nome: string
}

export interface Funcionario {
  id: string
  nome: string
  celular: string
  cargo: string
  unidadeId: string
  nivel: Nivel
  status: Status
  dataAdmissao: string
  dataDesligamento?: string | null
  respondePara?: string | null
  // Setor, usado na caixinha (grupos de bônus). 'geral' = gerente que atende as duas lojas.
  setor?: Setor | null
  // Turno-padrão em que a pessoa trabalha (Departamento Pessoal › Turnos).
  turnoId?: string | null
  // Chave Pix para pagamentos (só a própria pessoa e a gestão veem).
  pix?: string | null
  // Optou pelo vale-transporte (desconto de até 6% do salário).
  optaVt?: boolean
  // Só números. Sai nos documentos impressos.
  cpf?: string | null
  // Saem no contrato de experiência e na guia de exame admissional.
  rg?: string | null
  ctps?: string | null
  endereco?: string | null
  // Feminino: no desligamento, o portal gera os termos de exame de gravidez.
  sexo?: 'feminino' | 'masculino' | null
  // Para a mensagem de aniversário.
  dataNascimento?: string | null
  // Tamanhos para pedir uniforme.
  tamCamiseta?: string | null
  tamCalca?: string | null
  tamCalcado?: number | null
  // Contrato de experiência: dias do 1º e do 2º período a partir da admissão (padrão 10 + 80). Nulo = sem contrato.
  experienciaDias1?: number | null
  experienciaDias2?: number | null
  // Foto de perfil: caminho no armazenamento e endereço temporário para mostrar.
  foto?: string | null
  fotoUrl?: string | null
}

export type Setor = 'cozinha' | 'atendimento' | 'producao' | 'unidade' | 'geral' | 'manutencao' | 'escritorio' | 'pizzaria'
export const SETORES: { valor: Setor; nome: string }[] = [
  { valor: 'cozinha', nome: 'Cozinha' },
  { valor: 'atendimento', nome: 'Atendimento' },
  { valor: 'pizzaria', nome: 'Pizzaria' },
  { valor: 'producao', nome: 'Produção' },
  { valor: 'unidade', nome: 'Unidade toda' },
  { valor: 'geral', nome: 'Geral (todas as lojas)' },
  { valor: 'manutencao', nome: 'Manutenção' },
  { valor: 'escritorio', nome: 'Escritório' },
]

export type TipoDocumento =
  | 'atestado' | 'contrato' | 'documento_pessoal' | 'exame' | 'outro' | 'termo_gravidez'
  // Saúde ocupacional (NR-7 e Portaria CVS 3/2026 para manipuladores de alimentos).
  | 'aso_admissional' | 'aso_periodico' | 'aso_retorno' | 'aso_mudanca_funcao' | 'aso_demissional'
  | 'coprocultura' | 'coproparasitologico' | 'curso_manipulador'

export interface Documento {
  id: string
  funcionarioId: string
  tipo: TipoDocumento
  nomeArquivo: string
  observacao?: string | null
  // Atestado: período de afastamento.
  inicio?: string | null
  fim?: string | null
  // Exames e cursos: quando foi feito e quando vence.
  realizadoEm?: string | null
  vence?: string | null
  enviadoPor: string
  criadoEm: string
}

export type TipoOcorrencia = 'falta' | 'atraso' | 'advertencia' | 'suspensao' | 'orientacao' | 'elogio' | 'outro'

export interface Ocorrencia {
  id: string
  funcionarioId: string
  tipo: TipoOcorrencia
  data: string
  descricao: string
  registradoPor: string
  criadoEm: string
  // Advertência e suspensão: motivo (natureza) e, na suspensão, a partir de quando e por quantos dias.
  natureza?: string | null
  suspensaoInicio?: string | null
  suspensaoDias?: number | null
}

export interface Comunicado {
  id: string
  titulo: string
  corpo: string
  // null = todas as unidades
  unidadeId: string | null
  // Público: setores (null = todos) ou pessoas escolhidas (quando houver, só elas).
  setores?: Setor[] | null
  destinatarios?: string[] | null
  autorId: string
  criadoEm: string
  lidoPor: string[]
}

// 'trabalha': a pessoa trabalha num dia em que o turno dela é fechado (desfaz a folga automática).
export type TipoFolga = 'normal' | 'feriado' | 'trabalha'
export interface Folga {
  id: string
  funcionarioId: string
  data: string
  tipo: TipoFolga
  // Folga que vem do turno (dia sem horário, ex.: segunda), sem ninguém precisar marcar.
  automatica?: boolean
}

export const NIVEIS: { valor: Nivel; nome: string }[] = [
  { valor: 'funcionario', nome: 'Funcionário' },
  { valor: 'supervisor', nome: 'Supervisor' },
  { valor: 'gerente', nome: 'Gerente' },
  { valor: 'administrativo', nome: 'Administrativo' },
  { valor: 'proprietario', nome: 'Proprietário' },
  // Acesso do manutencista (07/10): vê e atende os chamados de todas as lojas.
  { valor: 'manutencao', nome: 'Manutenção' },
]

// validadeMeses: sugestão de vencimento a partir da data do exame (dá para mudar no envio).
// A periodicidade final é a que o médico do PCMSO definir.
export const TIPOS_DOCUMENTO: { valor: TipoDocumento; nome: string; grupo: 'geral' | 'saude'; validadeMeses?: number }[] = [
  { valor: 'atestado', nome: 'Atestado', grupo: 'geral' },
  { valor: 'documento_pessoal', nome: 'Documento pessoal', grupo: 'geral' },
  { valor: 'contrato', nome: 'Contrato', grupo: 'geral' },
  { valor: 'termo_gravidez', nome: 'Termo de exame de gravidez (desligamento)', grupo: 'geral' },
  { valor: 'outro', nome: 'Outro', grupo: 'geral' },
  { valor: 'aso_admissional', nome: 'ASO admissional', grupo: 'saude', validadeMeses: 12 },
  { valor: 'aso_periodico', nome: 'ASO periódico', grupo: 'saude', validadeMeses: 12 },
  { valor: 'aso_retorno', nome: 'ASO retorno ao trabalho', grupo: 'saude', validadeMeses: 12 },
  { valor: 'aso_mudanca_funcao', nome: 'ASO mudança de função', grupo: 'saude', validadeMeses: 12 },
  { valor: 'aso_demissional', nome: 'ASO demissional', grupo: 'saude' },
  { valor: 'coprocultura', nome: 'Coprocultura', grupo: 'saude', validadeMeses: 12 },
  { valor: 'coproparasitologico', nome: 'Coproparasitológico (fezes)', grupo: 'saude', validadeMeses: 12 },
  { valor: 'curso_manipulador', nome: 'Curso de boas práticas (manipulador)', grupo: 'saude', validadeMeses: 12 },
  { valor: 'exame', nome: 'Outro exame', grupo: 'saude' },
]

export const ehSaude = (t: TipoDocumento) => TIPOS_DOCUMENTO.find((x) => x.valor === t)?.grupo === 'saude'

// O que todo funcionário ativo precisa ter em dia. Todos aqui manipulam alimentos.
// manipulador: só para quem mexe com alimento (o Escritório não precisa, pedido de 07/10).
export const EXIGENCIAS: { id: string; nome: string; tipos: TipoDocumento[]; base: string; manipulador?: boolean }[] = [
  { id: 'aso', nome: 'ASO (exame clínico)', tipos: ['aso_admissional', 'aso_periodico', 'aso_retorno', 'aso_mudanca_funcao'], base: 'NR-7 (PCMSO)' },
  { id: 'coprocultura', nome: 'Coprocultura', tipos: ['coprocultura'], base: 'Portaria CVS 3/2026', manipulador: true },
  { id: 'coproparasitologico', nome: 'Coproparasitológico', tipos: ['coproparasitologico'], base: 'Portaria CVS 3/2026', manipulador: true },
]

// Entrega de uniforme com termo assinado na tela.
export interface ItemUniforme {
  item: string
  tamanho?: string
  quantidade: number
}

export interface EntregaUniforme {
  id: string
  funcionarioId: string
  data: string
  itens: ItemUniforme[]
  observacao?: string | null
  entreguePor: string
  // Imagem da assinatura (PNG em base64). Nulo enquanto a pessoa não assina.
  assinatura: string | null
  assinadoEm: string | null
  // 'presencial': assinou no aparelho de quem entregou; 'portal': assinou no próprio login.
  assinadoVia: 'presencial' | 'portal' | null
  criadoEm: string
}

export const ITENS_UNIFORME = ['Camiseta', 'Calça', 'Sapato', 'Avental', 'Boné', 'Dólmã', 'Touca', 'Jaqueta', 'Bota de segurança (EPI)', 'Luva térmica (EPI)']
export const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG', 'Único']

// Termos registrados a partir daqui levam a cláusula do desconto (reunião de RH de 08/10). Os já assinados
// continuam mostrando o texto que a pessoa assinou.
export const TERMO_UNIFORME_V2 = '2026-10-08T15:30:00Z'
export const termoUniforme = (nome: string, data: string, itens: ItemUniforme[], criadoEm?: string) =>
  `Eu, ${nome}, declaro que recebi da empresa, gratuitamente, em ${data.split('-').reverse().join('/')}, os itens de uniforme e equipamentos listados abaixo, ` +
  `em bom estado: ${itens.map((i) => `${i.quantidade}x ${i.item}${i.tamanho ? ` (${i.tamanho})` : ''}`).join('; ')}. ` +
  `Comprometo-me a usá-los somente durante o trabalho, a conservá-los e a devolvê-los quando for desligado(a) ou quando forem substituídos.` +
  (!criadoEm || criadoEm >= TERMO_UNIFORME_V2
    ? ` Se não devolver alguma peça, ou devolver danificada por mau uso, autorizo o desconto do valor dela, conforme a tabela da empresa, no salário ou na rescisão.`
    : '')

// Conferência da devolução de uniforme (no desligamento): o que foi entregue, o que voltou e quanto desconta.
export interface ItemDevolucao {
  item: string
  tamanho?: string
  entregue: number
  devolvido: number
  valor: number
}
export interface DevolucaoUniforme {
  id: string
  funcionarioId: string
  data: string
  itens: ItemDevolucao[]
  totalDesconto: number
  observacao: string | null
  conferidoPor: string
  criadoEm: string
}

// Pedido de ajuste do ponto (Control iD), feito pela própria pessoa.
export type TipoAjustePonto = 'esqueci_entrada' | 'esqueci_saida' | 'horario_errado' | 'equipamento' | 'outro'
export const TIPOS_AJUSTE_PONTO: { valor: TipoAjustePonto; nome: string }[] = [
  { valor: 'esqueci_entrada', nome: 'Esqueci de bater a entrada' },
  { valor: 'esqueci_saida', nome: 'Esqueci de bater a saída' },
  { valor: 'horario_errado', nome: 'Horário saiu errado' },
  { valor: 'equipamento', nome: 'O relógio não registrou (falha)' },
  { valor: 'outro', nome: 'Outro' },
]
export interface AjustePonto {
  id: string
  funcionarioId: string
  data: string
  tipo: TipoAjustePonto
  // Horário certo (HH:MM), quando a pessoa sabe.
  horario: string | null
  motivo: string | null
  status: 'pendente' | 'feito' | 'recusado'
  resposta: string | null
  criadoEm: string
  resolvidoPor: string | null
  resolvidoEm: string | null
}

export const TIPOS_OCORRENCIA: { valor: TipoOcorrencia; nome: string }[] = [
  { valor: 'falta', nome: 'Falta' },
  { valor: 'atraso', nome: 'Atraso' },
  { valor: 'advertencia', nome: 'Advertência' },
  { valor: 'suspensao', nome: 'Suspensão' },
  { valor: 'orientacao', nome: 'Orientação' },
  { valor: 'elogio', nome: 'Elogio' },
  { valor: 'outro', nome: 'Outro' },
]

export const nomeNivel = (n: Nivel) => NIVEIS.find((x) => x.valor === n)?.nome ?? n
export const nomeTipoDocumento = (t: TipoDocumento) => TIPOS_DOCUMENTO.find((x) => x.valor === t)?.nome ?? t
export const nomeTipoOcorrencia = (t: TipoOcorrencia) => TIPOS_OCORRENCIA.find((x) => x.valor === t)?.nome ?? t

// Nome curto da loja, para selos e gráficos: "Parque São Domingos", "Vila Anastácio", "Pizza".
export const apelidoUnidade = (nome: string) => nome.replace(/^The Ozzy Burger /, '').replace(/^The Ozzy /, '')

// Vendas por dia, loja e canal. Vão vir do PDV / iFood / 99Food; por enquanto, exemplo.
export type Canal = 'salao' | 'ifood' | 'proprio' | '99food'

// A ordem é fixa: é ela que define a cor de cada canal nos gráficos.
export const CANAIS: { valor: Canal; nome: string; cor: string }[] = [
  { valor: 'salao', nome: 'Salão', cor: '#2a78d6' },
  { valor: 'ifood', nome: 'iFood', cor: '#eb6834' },
  { valor: 'proprio', nome: 'Delivery próprio', cor: '#1baf7a' },
  { valor: '99food', nome: '99Food', cor: '#eda100' },
]

export interface VendaDia {
  unidadeId: string
  data: string
  canal: Canal
  pedidos: number
  faturamento: number
}

export type Plataforma = 'ifood' | '99food'

export interface Avaliacao {
  unidadeId: string
  plataforma: Plataforma
  nota: number
  totalAvaliacoes: number
  notaHa30Dias: number | null
  atualizadoEm: string
}

// Turnos: horário-padrão de cada posto, da segunda (0) ao domingo (6). null = folga.
// Quem está em cada turno fica em Funcionario.turnoId (a gestão escolhe).
export interface DiaTurno {
  inicio: string // 'HH:MM'
  fim: string // 'HH:MM'; menor que o início = termina depois da meia-noite
  pausaMin: number
}

export interface Turno {
  id: string
  // Loja (id da unidade) ou 'producao' / 'escritorio', que não são lojas.
  local: string
  nome: string
  dias: (DiaTurno | null)[]
}

// Regulamento interno: cada versão publicada e quem assinou cada uma.
export interface VersaoRegulamento {
  id: string
  numero: number
  texto: string
  // Resumo do que mudou, escrito por quem publicou.
  nota: string | null
  publicadoEm: string
  publicadoPor: string | null
  // SHA-256 do texto: prova qual versão exata foi assinada.
  hash: string
}

export interface LeituraRegulamento {
  funcionarioId: string
  versaoId: string
  assinatura: string
  assinadoEm: string
  hash: string
  // Registro para auditoria: navegador/aparelho e IP de onde assinou.
  dispositivo: string | null
  ip: string | null
}

// Primeiro e último nome: "Queli Souza", "Julia Bernardo" (separa as duas Júlias).
export const nomeCurto = (nome: string) => {
  const p = nome.split(' ').filter(Boolean)
  return p.length > 1 ? `${p[0]} ${p[p.length - 1]}` : nome
}

// Chamados de manutenção (07/10): qualquer pessoa abre; o manutencista e a gestão atendem.
export type Gravidade = 'urgente' | 'importante' | 'simples'
export const GRAVIDADES: { valor: Gravidade; nome: string; dica: string }[] = [
  { valor: 'urgente', nome: 'Urgente', dica: 'Parou a operação ou é risco (gás, choque, vazamento grande)' },
  { valor: 'importante', nome: 'Importante', dica: 'Atrapalha o trabalho, resolver nos próximos dias' },
  { valor: 'simples', nome: 'Pode esperar', dica: 'Melhoria ou ajuste sem pressa' },
]

export type CategoriaChamado =
  | 'equipamento' | 'refrigeracao' | 'eletrica' | 'hidraulica' | 'gas' | 'reforma'
  | 'computador' | 'internet' | 'moveis' | 'outro'
export const CATEGORIAS_CHAMADO: { valor: CategoriaChamado; nome: string; exemplos: string }[] = [
  { valor: 'equipamento', nome: 'Equipamento e maquinário', exemplos: 'chapa, fritadeira, forno, coifa, máquinas' },
  { valor: 'refrigeracao', nome: 'Refrigeração', exemplos: 'geladeira, freezer, câmara fria, ar-condicionado' },
  { valor: 'eletrica', nome: 'Elétrica', exemplos: 'tomada, disjuntor, iluminação' },
  { valor: 'hidraulica', nome: 'Hidráulica', exemplos: 'pia, vazamento, esgoto, caixa de gordura' },
  { valor: 'gas', nome: 'Gás', exemplos: 'cheiro de gás, registro, botijão' },
  { valor: 'reforma', nome: 'Reforma e estrutura', exemplos: 'parede, piso, porta, telhado, pintura' },
  { valor: 'computador', nome: 'Computador e sistemas', exemplos: 'PDV Eclética, impressora, tablet, computador' },
  { valor: 'internet', nome: 'Internet e telefone', exemplos: 'Wi-Fi, roteador, telefone' },
  { valor: 'moveis', nome: 'Móveis e utensílios', exemplos: 'mesa, cadeira, prateleira, utensílios' },
  { valor: 'outro', nome: 'Outro', exemplos: '' },
]

export type StatusChamado = 'aberto' | 'andamento' | 'aguardando' | 'resolvido' | 'cancelado'
export const STATUS_CHAMADO: { valor: StatusChamado; nome: string }[] = [
  { valor: 'aberto', nome: 'Aberto' },
  { valor: 'andamento', nome: 'Em andamento' },
  { valor: 'aguardando', nome: 'Aguardando peça ou terceiro' },
  { valor: 'resolvido', nome: 'Resolvido' },
  { valor: 'cancelado', nome: 'Cancelado' },
]
export const chamadoEmAberto = (s: StatusChamado) => s !== 'resolvido' && s !== 'cancelado'

export interface EventoChamado {
  id: string
  autorId: string
  em: string
  texto: string | null
  // Preenchido quando o evento mudou o status.
  status: StatusChamado | null
}

export interface Chamado {
  id: string
  numero: number
  unidadeId: string
  categoria: CategoriaChamado
  gravidade: Gravidade
  titulo: string
  descricao: string
  // Local dentro da loja (ex.: cozinha, salão, banheiro). Opcional.
  local: string | null
  foto: string | null
  status: StatusChamado
  abertoPor: string
  abertoEm: string
  responsavelId: string | null
  fechadoEm: string | null
  // Quem a manutenção está esperando para seguir (0057): aparece na página inicial dessa pessoa.
  aguardandoId?: string | null
  aguardandoDesde?: string | null
  aguardandoMotivo?: string | null
  eventos: EventoChamado[]
}

// Dados copiados do Lucro Fácil (fichas técnicas e resultado do mês).
export interface ItemFicha {
  nome: string
  unidade: string
  qtd: number
  // Pizzas por tamanho: broto, media, grande, familia.
  tamanho: string | null
  // Quando o item é outro preparo (molho, base), o id da ficha dele.
  preparoId: number | null
}

export interface Ficha {
  produtoId: number
  nome: string
  categoria: string | null
  preparo: boolean
  itens: ItemFicha[]
  // Só chega para a gestão.
  custo?: { total: number; preco: number; itens: { custoUnit: number; total: number }[] }
}

export interface ResultadoMes {
  unidadeId: string
  mes: string
  pedidos: number
  faturamento: number
  cmv: number
  impostos: number
  comissoes: number
  taxasPagamento: number
  custosOperacionais: number
  lucroOperacional: number
  ticketMedio: number
}

// Freelancers: cadastro e diárias. Semana de segunda a domingo, paga na segunda seguinte.
// Motoboys (0056): não são da equipe, recebem toda segunda pela semana lançada no domingo.
export interface Motoboy {
  id: string
  nome: string
  unidadeId: string | null
  pix: string | null
  telefone: string | null
  cpf: string | null
  observacao: string | null
  ativo: boolean
}
export interface ExtraMotoboy { descricao: string; valor: number }
export interface SemanaMotoboy {
  id: string
  motoboyId: string
  unidadeId: string
  pagamento: string // a segunda do pagamento
  diarias: number
  entregas: number
  extras: ExtraMotoboy[]
  total: number
  pagoEm: string | null
  conciliado: boolean
}
export interface LinhaSemanaMotoboy { motoboyId: string; diarias: number; entregas: number; extras: ExtraMotoboy[]; jaPago: boolean }

export interface Freelancer {
  id: string
  nome: string
  // Opcional quando é um funcionário fazendo diária na folga.
  cpf: string | null
  pix: string
  celular: string | null
  ativo: boolean
  funcionarioId: string | null
}

export type TurnoFreela = 'manha' | 'noite'

export interface DiariaFreela {
  id: string
  freelancerId: string
  data: string
  turno: TurnoFreela
  unidadeId: string
  funcao: string
  valor: number
  observacao: string | null
  lancadoPor: string | null
}

// Diária que o próprio freelancer (pelo link da loja) ou o funcionário (pelo login) mandou. Vira DiariaFreela
// quando a gestão aprova e põe o valor.
export type StatusEnvioFreela = 'pendente' | 'aprovado' | 'recusado'
export interface EnvioFreela {
  id: string
  cpf: string | null
  celular: string | null
  nome: string
  pix: string
  freelancerId: string | null
  funcionarioId: string | null
  data: string
  turno: TurnoFreela
  unidadeId: string
  funcao: string
  observacao: string | null
  status: StatusEnvioFreela
  motivo: string | null
  enviadoEm: string
  // Mandada de dentro da loja, no próprio dia: vale como presença (pedido de 08/10).
  naLoja: boolean
  distanciaLojaM: number | null // null = sem localização (negou ou a loja não tem local marcado)
}

// Localização do celular na hora do envio.
export interface LocalEnvio {
  lat: number
  lng: number
  precisao: number | null
}

// Onde fica cada loja, para conferir a presença do freela.
export interface LocalLoja {
  id: string
  nome: string
  latitude: number | null
  longitude: number | null
}

export interface DiaEnviado {
  data: string
  turno: TurnoFreela
  observacao?: string
}

// O que a página do link sabe de quem digitou CPF e celular (nada além do primeiro nome e do fim do Pix).
export type QuemSouFreela =
  | { tipo: 'invalido' | 'novo' | 'celular_errado' }
  | { tipo: 'freelancer' | 'funcionario'; nome: string; pixFinal: string }

export interface PagamentoFreela {
  freelancerId: string
  // Segunda-feira que abre a semana trabalhada.
  semana: string
  valor: number
  pagoEm: string
  pagoPor: string | null
}

// Pagamento do mês de referência ('AAAA-MM'), com os valores que a contabilidade manda.
// Adiantamento sai no dia 20; salário no dia 05 do mês seguinte. A pessoa só vê depois de liberado.
export type TipoPagamento = 'adiantamento' | 'salario'
// Conta da empresa que paga os salários e as diárias pelo banco.
export interface ContaPagamento {
  id: string
  nome: string
  banco: string
  empresaCnpj: string
  empresaNome: string
  agencia: string
  conta: string
  dac: string
  endereco: string | null
  numero: string | null
  cidade: string | null
  cep: string | null
  estado: string | null
  padrao: boolean
}

// Arquivo (ou envio por API) de pagamento já gerado.
export interface RemessaPagamento {
  id: string
  numero: number
  contaId: string
  tipo: 'salario' | 'adiantamento' | 'freelancer'
  referencia: string
  dataPagamento: string
  quantidade: number
  valorTotal: number
  via: 'arquivo' | 'api'
  arquivo: string | null
  criadoEm: string
}

export interface RubricaHolerite {
  descricao: string
  valor: number
  tipo: 'credito' | 'desconto'
}

export interface Salario {
  funcionarioId: string
  mes: string
  tipo: TipoPagamento
  descAdiantamento: number
  salario: number
  caixinha: number
  bonusCaixinha: number
  bonusConclui: number
  descFaltas: number
  descAtrasos: number
  inss: number
  descVt: number
  // Rubricas do holerite sem campo próprio (adicional noturno, auxílio uniforme, consignado…).
  outrosCreditos: number
  outrosDescontos: number
  rubricas?: RubricaHolerite[] | null
  observacao: string | null
  liberado: boolean
  // PDF do holerite enviado pela contabilidade (caminho no armazenamento).
  holerite?: string | null
}

// Período anterior de quem saiu e voltou (readmissão).
export interface VinculoAnterior {
  id: string
  funcionarioId: string
  admissao: string
  desligamento: string
  tipoDesligamento: string | null
  cargo: string | null
  observacao: string | null
}

// Férias gozadas, ligadas ao período aquisitivo (que começa no aniversário da admissão).
export interface Ferias {
  id: string
  funcionarioId: string
  aquisitivoInicio: string
  inicio: string
  dias: number
  abonoDias: number
  observacao: string | null
}

// Parcela do 13º paga (a 1ª pode ser adiantada).
export interface DecimoTerceiro {
  id: string
  funcionarioId: string
  ano: number
  parcela: 1 | 2
  valor: number
  pagoEm: string
  observacao: string | null
}

// Motivos mais comuns de advertência e suspensão (o documento cita a natureza).
export const NATUREZAS = [
  'Atraso',
  'Falta injustificada',
  'Uso de celular durante o trabalho',
  'Uniforme incompleto ou fora do padrão',
  'Higiene e manipulação de alimentos',
  'Descumprimento de procedimento',
  'Saída sem autorização',
  'Desrespeito a colega ou cliente',
  'Insubordinação',
]

// Desligamento em andamento: a gestão marca cada etapa do checklist até concluir.
export type TipoDesligamento = 'sem_justa_causa' | 'justa_causa' | 'pedido' | 'acordo' | 'fim_experiencia' | 'antecipacao_experiencia'
export const TIPOS_DESLIGAMENTO: { valor: TipoDesligamento; nome: string }[] = [
  { valor: 'sem_justa_causa', nome: 'Dispensa sem justa causa' },
  { valor: 'justa_causa', nome: 'Dispensa por justa causa' },
  { valor: 'pedido', nome: 'Pedido de demissão' },
  { valor: 'acordo', nome: 'Acordo (art. 484-A)' },
  { valor: 'fim_experiencia', nome: 'Fim do contrato de experiência' },
  { valor: 'antecipacao_experiencia', nome: 'Rescisão antecipada da experiência' },
]
export interface Desligamento {
  id: string
  funcionarioId: string
  data: string
  tipo: TipoDesligamento
  // Etapas feitas: chave da etapa → quem marcou e quando.
  itens: Record<string, { por: string; em: string }>
  observacao: string | null
  concluido: boolean
}

// Admissão (passo a passo pedido em 08/10): etapas marcadas à mão, com quem marcou e quando.
export interface Admissao {
  funcionarioId: string
  dataAdmissao: string
  itens: Record<string, { por: string; em: string }>
  concluido: boolean
}

// Equipamentos mais caros de cada loja, com histórico de manutenções (inventário).
export interface Equipamento {
  id: string
  unidadeId: string
  nome: string
  marcaModelo: string | null
  numeroSerie: string | null
  local: string | null
  dataCompra: string | null
  valorCompra: number | null
  valorAtual: number | null
  foto: string | null
  observacao: string | null
  ativo: boolean
}
export type TipoManutencao = 'corretiva' | 'preventiva'
export interface ManutencaoEquipamento {
  id: string
  equipamentoId: string
  data: string
  tipo: TipoManutencao
  descricao: string
  prestador: string | null
  custo: number | null
  chamadoId: string | null
  registradoPor: string | null
}
// Item de manutenção preventiva: o que verificar e a cada quantos dias. unidadeId nulo = todas as lojas.
export interface Preventiva {
  id: string
  unidadeId: string | null
  equipamentoId: string | null
  titulo: string
  descricao: string | null
  frequenciaDias: number
  primeiraEm: string
  ativo: boolean
}
export interface ExecucaoPreventiva {
  id: string
  preventivaId: string
  unidadeId: string | null
  feitoEm: string
  observacao: string | null
  feitoPor: string | null
}

// Tamanhos do cadastro.
export const TAMANHOS_CAMISETA = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG']
export const TAMANHOS_CALCA = ['34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54']
export const TAMANHOS_CALCADO = Array.from({ length: 13 }, (_, i) => 34 + i)

// Pedido de troca de uniforme feito pelo próprio funcionário.
export const ITENS_TROCA = ['Camiseta', 'Calça', 'Sapato', 'Avental', 'Boné / touca', 'Outro']
export type StatusTroca = 'aberta' | 'atendida' | 'recusada'
export interface SolicitacaoUniforme {
  id: string
  funcionarioId: string
  itens: string[]
  motivo: string
  foto: string | null
  status: StatusTroca
  resposta: string | null
  respondidoPor: string | null
  respondidoEm: string | null
  criadoEm: string
}

// Pedido de compra de uniformes (por leva), para orçamento com o fornecedor.
export type StatusPedidoUniforme = 'rascunho' | 'orcamento' | 'pedido' | 'recebido'
export const STATUS_PEDIDO_UNIFORME: { valor: StatusPedidoUniforme; nome: string }[] = [
  { valor: 'rascunho', nome: 'Montando' },
  { valor: 'orcamento', nome: 'Em orçamento' },
  { valor: 'pedido', nome: 'Pedido feito' },
  { valor: 'recebido', nome: 'Recebido' },
]
export type Modelagem = 'feminina' | 'masculina' | 'unissex'
export interface PedidoUniforme {
  id: string
  numero: number
  titulo: string
  status: StatusPedidoUniforme
  fornecedor: string | null
  observacao: string | null
  // Valor combinado com o fornecedor, quando o pedido foi fechado e quando deve chegar.
  valorTotal?: number | null
  fechadoEm?: string | null
  previsaoEntrega?: string | null
  criadoEm: string
}
export interface ItemPedidoUniforme {
  id: string
  pedidoId: string
  funcionarioId: string | null
  item: string
  cor: string | null
  modelagem: Modelagem | null
  tamanho: string | null
  quantidade: number
}

// Estoque de uniformes (09/10): cada movimento muda o saldo de uma peça (item + cor + modelagem + tamanho).
export type TipoMovUniforme = 'contagem' | 'entrada' | 'entrega' | 'devolucao' | 'baixa'
export interface VarianteUniforme {
  item: string
  cor: string | null
  modelagem: Modelagem | null
  tamanho: string
}
export interface MovimentoUniforme extends VarianteUniforme {
  id: string
  data: string
  tipo: TipoMovUniforme
  // Contagem: quanto tem. Entrada e devolução: positivo. Entrega e baixa: negativo.
  quantidade: number
  referencia: string
  observacao: string | null
  criadoPor: string | null
  criadoEm: string
}
export type NovoMovimentoUniforme = VarianteUniforme & Pick<MovimentoUniforme, 'tipo' | 'quantidade' | 'referencia'> & { data?: string; observacao?: string | null }

// Eventos (Entrega 1, 08/10): cadastro do evento. Produtos, previsão, insumos e simulador vêm nas próximas entregas.
export type StatusEvento = 'negociacao' | 'planejamento' | 'aprovado' | 'preparacao' | 'execucao' | 'finalizado' | 'cancelado'
export const STATUS_EVENTO: { valor: StatusEvento; nome: string; cor: 'cinza' | 'ambar' | 'verde' | 'vermelho' | 'azul' }[] = [
  { valor: 'negociacao', nome: 'Em negociação', cor: 'cinza' },
  { valor: 'planejamento', nome: 'Em planejamento', cor: 'azul' },
  { valor: 'aprovado', nome: 'Aprovado', cor: 'verde' },
  { valor: 'preparacao', nome: 'Em preparação', cor: 'ambar' },
  { valor: 'execucao', nome: 'Em execução', cor: 'ambar' },
  { valor: 'finalizado', nome: 'Finalizado', cor: 'verde' },
  { valor: 'cancelado', nome: 'Cancelado', cor: 'vermelho' },
]
export const nomeStatusEvento = (s: StatusEvento) => STATUS_EVENTO.find((x) => x.valor === s)?.nome ?? s
export interface Operacao {
  id: string
  nome: string
  ativa: boolean
}
export interface DiaEvento {
  data: string
  abre: string | null
  fecha: string | null
}
export interface ResponsavelEvento {
  funcionarioId: string
  papel: string | null
}
export interface Evento {
  id: string
  numero: number
  nome: string
  status: StatusEvento
  statusMotivo: string | null
  tipo: string | null
  organizador: string | null
  organizadorContato: string | null
  local: string | null
  endereco: string | null
  publicoEstimado: number | null
  // 'AAAA-MM-DDTHH:MM', horário de São Paulo.
  montagemInicio: string | null
  montagemFim: string | null
  desmontagemInicio: string | null
  desmontagemFim: string | null
  // Taxa do organizador (descontada antes do repasse). Não é imposto.
  taxaOrganizadorPct: number | null
  valorFixo: number | null
  condicoes: string | null
  quemRecebe: 'organizador' | 'the_ozzy' | null
  repassePrazoDias: number | null
  repasseObs: string | null
  infraestrutura: string | null
  observacao: string | null
  cidade: string | null
  // Italiano, Árabe, Coreano, Junina, Geral… (para comparar com eventos parecidos)
  gastronomia: string | null
  barracas: number | null
  // Folga que a sugestão de "quanto levar" põe em cima da previsão (%).
  margemSegurancaPct: number
  // Valor padrão da diária de freelancer neste evento.
  diariaFreela: number | null
  // Fica fora das médias do painel e da sugestão da previsão (a gestão escolhe).
  foraDaMedia: boolean
  // Nome de cada quadrado da barraca 3x3, por barraca: { '1': { '0': 'Caixa' } }.
  layoutBarracas: Record<string, Record<string, string>>
  // Local do evento, para a diária mandada de lá valer como presença.
  latitude: number | null
  longitude: number | null
  dias: DiaEvento[]
  operacoes: string[]
  responsaveis: ResponsavelEvento[]
  criadoPor: string | null
  criadoEm: string
  atualizadoPor: string | null
  // Serve também para perceber quando outra pessoa salvou o evento enquanto eu editava.
  atualizadoEm: string
}
export type NovoEvento = Omit<Evento, 'id' | 'numero' | 'criadoPor' | 'criadoEm' | 'atualizadoPor' | 'atualizadoEm'> & { id?: string; atualizadoEm?: string }
export interface HistoricoEvento {
  id: string
  eventoId: string
  em: string
  por: string | null
  tipo: 'criado' | 'status' | 'dados'
  de: string | null
  para: string | null
  campos: string[] | null
  motivo: string | null
}

// Eventos, Entregas 2 e 3 (08/10): cadastro único de fornecedores, insumos e fichas (com versões).
export type UnidadeMedida = 'kg' | 'l' | 'un'
export interface Fornecedor {
  id: string
  nome: string
  contato: string | null
  telefone: string | null
  observacao: string | null
  ativo: boolean
  // Preenchidos pela importação de nota (0044).
  cnpj?: string | null
  contaPadraoId?: string | null
  // Como aparece no banco e nas notas, quando é diferente do nome fantasia (0055).
  razaoSocial?: string | null
  // Dias entre o pedido e a entrega (sugere a previsão no pedido de compra; 0061).
  prazoEntregaDias?: number | null
}
export interface Insumo {
  id: string
  nome: string
  categoria: string | null
  // Unidade da ficha e do preço (preço é por 1 unidade desta).
  unidade: UnidadeMedida
  embalagem: string | null
  embalagemQtd: number | null
  preco: number | null
  precoEm: string | null
  fornecedorId: string | null
  observacao: string | null
  ativo: boolean
  // Cadastro da Eclética (09/10): código, para onde vai, conta contábil e estoque mínimo.
  ecleticaCodigo?: string | null
  setorEnvio?: SetorEnvio | null
  contaId?: string | null
  estoqueMinimo?: number | null
  // Feito na Central (pré-preparo): é o que pode ser lançado em Produção.
  prePreparo?: boolean
  // Preço que a gestão conferiu na Conferência de preços ("está certo"); enquanto for o atual, não é apontado.
  precoConferido?: number | null
}
// Dados do banco para a conferência de preços: preço anterior e custo da última entrada no estoque.
export interface ReferenciaPreco {
  insumoId: string
  precoAnterior: number | null
  anteriorEm: string | null
  custoEntrada: number | null
  entradaEm: string | null
}
export type SetorEnvio = 'cozinha' | 'atendimento' | 'eventos'
export const SETORES_ENVIO: Record<SetorEnvio, string> = { cozinha: 'Cozinha das lojas', atendimento: 'Atendimento das lojas', eventos: 'Eventos' }
export interface PrecoInsumo {
  id: string
  insumoId: string
  preco: number | null
  em: string
  por: string | null
  origem: string | null
}
export type TipoReceita = 'produto' | 'preparo'
export type OrigemProduto = 'propria' | 'revenda' | 'terceirizada'
export const ORIGEM_PRODUTO: Record<OrigemProduto, string> = { propria: 'Fabricação própria', revenda: 'Compra pronta', terceirizada: 'Produção terceirizada' }
export interface Receita {
  id: string
  nome: string
  tipo: TipoReceita
  linha: string | null
  operacaoId: string | null
  origem: OrigemProduto
  unidade: UnidadeMedida
  precoVenda: number | null
  tempoPreparoMin: number | null
  tempoFinalizacaoMin: number | null
  capacidadeHora: number | null
  equipamentos: string | null
  conservacao: string | null
  validadeDias: number | null
  // Passo a passo da produção (das fichas de preparo).
  modoPreparo: string | null
  ativo: boolean
  versaoAtual: number
  // Item de estoque que a produção deste preparo alimenta (0058).
  insumoId?: string | null
  // Fichas num lugar só (0069): de quem é a ficha de produto; os pré-preparos servem para todos.
  area?: AreaFicha
  ecleticaCodigo?: string | null
  // Ficha impressa da produção.
  observacoes?: string | null
  responsavel?: string | null
  porcaoNome?: string | null // potinhos, seringas…
  porcaoQtd?: number | null // quanto vai em cada porção, na unidade da ficha
  lotes?: number[] | null // quanto imprimir em cada coluna; vazio = 1 a 4 receitas
}
export type AreaFicha = 'eventos' | 'lojas'
export interface ItemReceita {
  insumoId: string | null
  subReceitaId: string | null
  quantidade: number
  aproveitamento: number
  soDelivery?: boolean // embalagem que só vai no delivery (* na Eclética)
}
export interface VersaoReceita {
  id: string
  receitaId: string
  numero: number
  rendimento: number
  // Custo calculado no dia em que a versão foi salva.
  custoTotal: number | null
  nota: string | null
  criadaEm: string
  criadaPor: string | null
  itens: ItemReceita[]
}

// Eventos, Entrega 4 e logística (08/10): cardápio, previsão, vendas, separação, inventário e estoque da base.
export interface ProdutoEvento {
  receitaId: string
  preco: number | null
  ordem: number
}
// Quantidade por dia e produto (previsão ou venda real).
export interface QtdDiaProduto {
  data: string
  receitaId: string
  quantidade: number
}
export interface VendaEvento extends QtdDiaProduto {
  eventoId: string
  produto: string
  total: number | null
  origem: string
}
export interface ItemModeloChecklist {
  id: string
  categoria: string
  item: string
  // Praça que usa o item (Foca, Pizza, Romana…); null = todas.
  operacao: string | null
  // Operação dona do item (The Ozzy Pizza, Foca…): o evento só leva os itens das operações que vão. null = vai sempre.
  operacaoId: string | null
  quantidade: string | null // livre: "2", "3 caixas", "Todas"
  ordem: number
  ativo: boolean
}
// Item da logística: insumo ("i:<id>") ou pré-preparo feito na base ("r:<id>").
export type ChaveItem = string
export const chaveDe = (x: { insumoId?: string | null; receitaId?: string | null }): ChaveItem | null =>
  x.insumoId ? 'i:' + x.insumoId : x.receitaId ? 'r:' + x.receitaId : null
export const daChave = (c: ChaveItem) => (c.startsWith('i:') ? { insumoId: c.slice(2), receitaId: null } : { insumoId: null, receitaId: c.slice(2) })
export interface ItemEnvio {
  id: string
  ordem: number
  categoria: string | null
  operacao: string | null
  insumoId: string | null
  receitaId: string | null
  item: string | null
  previsto: number | null
  quantidade: number | null
  quantidadeTexto: string | null
  unidade: string | null
  // Conferência de saída e de retorno.
  conferido: boolean
  conferidoPor: string | null
  conferidoEm: string | null
  retornou: boolean
  retornoPor: string | null
  retornoEm: string | null
}
export interface EnvioEvento {
  id: string
  eventoId: string
  data: string
  tipo: 'separacao' | 'reposicao'
  observacao: string | null
  criadoPor: string | null
  criadoEm: string
  itens: ItemEnvio[]
}
export type NovoItemEnvio = Pick<ItemEnvio, 'categoria' | 'operacao' | 'insumoId' | 'receitaId' | 'item' | 'previsto' | 'quantidade' | 'quantidadeTexto' | 'unidade'>
export interface Inventario {
  id: string
  local: 'base' | 'evento'
  eventoId: string | null
  data: string
  contadoPor: string | null
  contadoEm: string
  observacao: string | null
  fala: string | null
  itens: { chave: ChaveItem; quantidade: number }[]
}
// O que se conta (insumo ou pré-preparo), sem preço.
export interface ItemContagem {
  chave: ChaveItem
  nome: string
  categoria: string | null
  unidade: UnidadeMedida
  embalagem: string | null
  embalagemQtd: number | null
}
export interface EventoEscalado {
  id: string
  nome: string
  status: StatusEvento
  papel: string | null
  dias: DiaEvento[]
}

// Freelancers de eventos (08/10): base separada da das lojas. Diária por dia de evento (sem turno).
export interface FreelaEvento {
  id: string
  nome: string
  cpf: string
  pix: string
  celular: string | null
  funcao: string | null
  // Valor próprio da diária; vazio = usa o do evento.
  valorDiaria: number | null
  observacao: string | null
  ativo: boolean
}
export type StatusDiariaEvento = 'pendente' | 'aprovado' | 'recusado'
export interface DiariaFreelaEvento {
  id: string
  eventoId: string
  freelaId: string | null
  cpf: string
  data: string
  funcao: string
  valor: number | null
  observacao: string | null
  // O que a pessoa mandou pelo link.
  nome: string | null
  pix: string | null
  celular: string | null
  origem: 'link' | 'gestao'
  status: StatusDiariaEvento
  motivo: string | null
  distanciaM: number | null
  noLocal: boolean
  enviadoEm: string
  pagoEm: string | null
}
export interface EventoAberto {
  id: string
  nome: string
  dias: string[]
}

// Equipe do evento: quem trabalha e onde fica na barraca (grade 3x3, posição 0 a 8; linha de cima = frente).
export interface MembroEquipeEvento {
  id: string
  eventoId: string
  funcionarioId: string | null
  freelaId: string | null
  nome: string | null // só para quem não tem cadastro
  funcao: string | null
  barraca: number
  posicao: number | null
  observacao: string | null
  ordem: number
}

// ——— Financeiro e estoque (09/10) ———
// Centro de custo: as três lojas, a Central de Produção e a The Ozzy Eventos.
export interface CentroCusto {
  id: string
  nome: string
  cnpj: string | null
  ativo: boolean
}
// Conta contábil do plano de contas (mesma árvore do Lucro Fácil). pai = código da conta-mãe.
export interface ContaContabil {
  id: string
  codigo: string
  nome: string
  paiCodigo: string | null
  operacional: boolean
  ordem: number
  ativo: boolean
}
export type FormaPagamento = 'boleto' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'transferencia' | 'debito_automatico' | 'outro'
export const FORMAS_PAGAMENTO: { valor: FormaPagamento; nome: string }[] = [
  { valor: 'boleto', nome: 'Boleto' },
  { valor: 'pix', nome: 'Pix' },
  { valor: 'cartao_credito', nome: 'Cartão de crédito' },
  { valor: 'cartao_debito', nome: 'Cartão de débito' },
  { valor: 'transferencia', nome: 'Transferência' },
  { valor: 'debito_automatico', nome: 'Débito automático' },
  { valor: 'dinheiro', nome: 'Dinheiro' },
  { valor: 'outro', nome: 'Outro' },
]
export interface DuplicataNota {
  numero: string | null
  vencimento: string
  valor: number
}
export interface ItemNota {
  id: string
  ordem: number
  codigo: string | null
  ean: string | null
  descricao: string
  ncm: string | null
  cfop: string | null
  unidade: string | null
  quantidade: number
  valorUnit: number | null
  valorTotal: number
  insumoId: string | null
  fator: number | null
  foraEstoque: boolean
}
export interface NotaFiscal {
  id: string
  chave: string | null
  numero: string | null
  serie: string | null
  emissao: string
  fornecedorId: string | null
  emitenteCnpj: string | null
  emitenteNome: string | null
  destinatarioCnpj: string | null
  centroCustoId: string | null
  valorProdutos: number | null
  frete: number | null
  desconto: number | null
  valorTotal: number
  // tPag da NF-e: 01 dinheiro, 03 crédito, 04 débito, 15 boleto, 17 Pix, 90 sem pagamento…
  pagamentoXml: { tPag: string; valor: number }[]
  duplicatas: DuplicataNota[]
  arquivo: string | null
  observacao: string | null
  status: 'conferir' | 'lancada'
  lancadaEm: string | null
  criadoEm: string
  itens?: ItemNota[]
  // Débito do extrato que pagou esta nota (veio da conciliação): ao lançar, já fica paga e conciliada.
  extratoMovimentoId?: string | null
}
// Item digitado num recibo ou nota sem XML.
export interface ItemRecibo { descricao: string; unidade: string | null; quantidade: number; valorTotal: number; insumoId: string | null }
// O que sai do XML da NF-e (lido no navegador) para importar.
export interface NotaImportada {
  chave: string
  numero: string
  serie: string
  emissao: string
  emitente: { cnpj: string; nome: string; fantasia: string | null }
  destinatarioCnpj: string | null
  totais: { produtos: number; frete: number; desconto: number; outras: number; total: number }
  pagamento: { tPag: string; valor: number }[]
  duplicatas: DuplicataNota[]
  xml: string
  itens: { codigo: string; ean: string | null; descricao: string; ncm: string | null; cfop: string | null; unidade: string; quantidade: number; valorUnit: number; valorTotal: number }[]
}
export interface LancamentoNota {
  centroCustoId: string
  contaId: string | null
  competencia: string | null
  itens: { id: string; insumoId: string | null; fator: number | null; foraEstoque: boolean }[]
  parcelas: { vencimento: string; valor: number; forma: FormaPagamento; documento?: string | null }[]
  atualizarPreco: boolean
}
export interface ContaPagar {
  id: string
  centroCustoId: string
  contaId: string | null
  fornecedorId: string | null
  // Pagamento para um funcionário (salário, vale, reembolso): aparece no perfil dele.
  funcionarioId?: string | null
  // Pagamento da semana de um motoboy (0056).
  motoboyId?: string | null
  favorecido: string | null
  descricao: string
  competencia: string // AAAA-MM-01
  vencimento: string
  valor: number
  forma: FormaPagamento
  parcela: number | null
  parcelas: number | null
  documento: string | null
  notaId: string | null
  observacao: string | null
  pagoEm: string | null
  valorPago: number | null
  conciliado: boolean
  // De onde veio (0047): recorrente, salário, diárias. Lote = contas que saem num débito só (fatura do cartão, Pix em lote).
  recorrenteId?: string | null
  origem?: string | null
  lote?: string | null
  extratoMovimentoId?: string | null
}
// pagoEm/valorPago: conta que já entra paga (importação do histórico).
export type NovaContaPagar = Omit<ContaPagar, 'id' | 'pagoEm' | 'valorPago' | 'conciliado'> & { id?: string; pagoEm?: string | null; valorPago?: number | null }
export type SituacaoRecorrente = 'a_confirmar' | 'ativa' | 'pausada' | 'encerrada'
// Conta que se repete todo mês (aluguel, sistema…). Ativa = lança a conta de cada mês sozinha.
export interface ContaRecorrente {
  id: string
  descricao: string
  fornecedorId: string | null
  fornecedorNome: string | null
  centroCustoId: string
  contaId: string | null
  valor: number
  variavel: boolean
  dia: number
  forma: FormaPagamento
  inicio: string // AAAA-MM
  fim: string | null
  situacao: SituacaoRecorrente
  observacao: string | null
}
// Saldo de um item numa loja (soma dos movimentos, no banco). custo = o da última entrada.
export interface SaldoEstoque {
  insumoId: string
  quantidade: number
  custo: number | null
  ultima: string
}
export interface MovimentoEstoque {
  id: string
  centroCustoId: string
  insumoId: string
  data: string
  tipo: 'entrada_nf' | 'entrada' | 'saida' | 'perda' | 'ajuste' | 'transferencia'
  quantidade: number
  custoUnit: number | null
  notaItemId: string | null
  observacao: string | null
  criadoEm: string
  // Movimento de uma produção de preparo (0058).
  producaoId?: string | null
}
// Produção de pré-preparo (0058): entra o preparo, saem os ingredientes da ficha.
export interface Producao {
  id: string
  centroCustoId: string
  data: string
  receitaId: string | null
  versao: number | null
  insumoId: string
  quantidade: number
  custoTotal: number | null
  observacao: string | null
  criadoEm: string
  criadoPor: string | null
}
export interface NovaProducao {
  centroCustoId: string
  data: string
  receitaId: string | null
  insumoId: string | null
  quantidade: number
  saidas: { insumoId: string; quantidade: number }[]
  observacao: string
}

// Conciliação bancária (0045): movimentos do extrato OFX e a memória de classificação pelo texto.
export interface MovimentoExtrato {
  id: string
  banco: string
  agencia: string
  conta: string
  fitid: string
  data: string
  valor: number // saída é negativa
  descricao: string
  documento: string | null
  tipo: string | null
  status: 'pendente' | 'conciliado' | 'ignorado'
  contaPagarId: string | null
  observacao: string | null
  importadoEm: string
}
export interface RegraExtrato {
  chave: string
  centroCustoId: string | null
  contaId: string | null
  favorecido: string | null
  fornecedorId?: string | null
  funcionarioId?: string | null
  motoboyId?: string | null
  ignorar: boolean
}
export interface SaldoExtrato {
  banco: string
  agencia: string
  conta: string
  data: string
  saldo: number
}
export interface ExtratoOfx {
  banco: string
  agencia: string
  conta: string
  inicio: string | null
  fim: string | null
  saldo: { data: string; valor: number } | null
  movimentos: { fitid: string; data: string; valor: number; descricao: string; documento: string | null; tipo: string | null }[]
}

// O que um funcionário já recebeu (perfil › Salário, só a gestão).
export interface PagamentoPessoa {
  id: string
  descricao: string
  vencimento: string
  pagoEm: string | null
  valor: number
  forma: string
  conta: string | null
  conciliado: boolean
}

// Fechamento das lojas e pedido para a Central (09/10).
export type SetorFechamento = 'cozinha' | 'atendimento'
export const LOJAS_FECHAMENTO = ['burger-psd', 'burger-va'] as const
// Item da lista de um dia: o ideal é o do dia seguinte (o do pedido).
export interface ItemFechamento {
  itemId: string
  insumoId: string
  nome: string
  categoria?: string | null
  unidadeContagem: string
  ordem: number
  prePreparo: boolean
  ideal: number | null
  contagem: number | null
  sugestao: number | null
  pedido: number | null
}
export interface Fechamento {
  id: string
  unidadeId: string
  setor: SetorFechamento
  data: string
  para: string
  responsavel: string | null
  observacao: string | null
  fala: string | null
  enviadoEm: string
  enviadoPor: string | null
}
export interface EnvioFechamento {
  unidadeId: string
  setor: SetorFechamento
  data: string
  responsavel: string
  observacao: string
  fala: string
  itens: { itemId: string; contagem: number | null; sugestao: number | null; pedido: number | null }[]
}
export interface PedidoProducao {
  insumoId: string
  nome: string
  setor: SetorFechamento
  unidadeContagem: string
  unidade: UnidadeMedida
  prePreparo: boolean
  psd: number | null
  va: number | null
  total: number
  central: number
}
// Cadastro da lista (gestão): ideal de segunda (0) a domingo (6).
export interface ItemListaFechamento {
  id: string
  unidadeId: string
  setor: SetorFechamento
  insumoId: string
  nome: string
  categoria?: string | null
  unidadeContagem: string
  ordem: number
  ideal: (number | null)[]
  prePreparo: boolean
  ativo: boolean
}

// Compras (09/10): pedido de compra ao fornecedor com previsão de entrega.
export type CategoriaCompra = 'insumos' | 'embalagens' | 'limpeza' | 'outros'
export const CATEGORIAS_COMPRA: { valor: CategoriaCompra; nome: string }[] = [
  { valor: 'insumos', nome: 'Insumos e produtos' }, { valor: 'embalagens', nome: 'Embalagens' }, { valor: 'limpeza', nome: 'Limpeza' }, { valor: 'outros', nome: 'Outros' },
]
export type StatusCompra = 'rascunho' | 'pedido' | 'recebido' | 'cancelado'
export const STATUS_COMPRA: { valor: StatusCompra; nome: string }[] = [
  { valor: 'rascunho', nome: 'Rascunho' }, { valor: 'pedido', nome: 'Pedido feito' }, { valor: 'recebido', nome: 'Recebido' }, { valor: 'cancelado', nome: 'Cancelado' },
]
export interface ItemCompra {
  insumoId: string
  quantidade: number
  unidade: string
  preco: number | null
}
export interface PedidoCompra {
  id: string
  numero: number
  fornecedorId: string
  centroCustoId: string
  categoria: CategoriaCompra
  status: StatusCompra
  dataPedido: string
  previsaoEntrega: string
  itens: ItemCompra[]
  total: number
  formaPagamento: string | null
  observacao: string | null
  recebidoEm: string | null
  criadoEm: string
  criadoPor: string | null
}
export type NovoPedidoCompra = Omit<PedidoCompra, 'id' | 'numero' | 'total' | 'criadoEm' | 'criadoPor' | 'recebidoEm'> & { id?: string }
export interface PrecoFornecedor {
  insumoId: string
  preco: number
  em: string
  origem: 'pedido' | 'nota' | 'historico'
}
// O que costuma ser comprado de um fornecedor (histórico da Eclética + pedidos do portal, últimas 12 semanas).
export interface CompraFornecedor {
  insumoId: string
  compras: number
  quantidade: number | null
  porSemana: number
  porCompra: number | null
  intervaloDias: number | null
  ultima: string
  ultimaQtd: number
}
// Cardápio da Eclética. preco = tabela padrão (Burger), precoPizza = tabela The Ozzy Pizza.
export type TipoProdutoVenda = 'normal' | 'escondido' | 'vinculo'
export const TIPOS_PRODUTO_VENDA: Record<TipoProdutoVenda, string> = { normal: 'No PDV', escondido: 'Escondido', vinculo: 'Vínculo (combo ou pergunta)' }
export interface ProdutoVenda {
  id: string
  ecleticaCodigo: string | null
  nome: string
  grupo: string | null
  subgrupo: string | null
  tipo: TipoProdutoVenda
  unidade: UnidadeMedida
  preco: number | null
  precoPizza: number | null
  receitaId: string | null
  ativo: boolean
}
