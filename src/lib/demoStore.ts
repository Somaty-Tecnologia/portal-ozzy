import { degrau, possoAlterar, atendeChamados, vejoResultado, podeGerenciar, podeVerPainel, podeVerDocumentosDe, podeVerFuncionario } from './permissoes'
import { EVENTO_ALTERADO, codigoAleatorio, linkDaGuia, distanciaM, nomeItem, nomeProprio, soDigitos, type Store } from './store'
import { cpfValido } from './cpf'
import { movimentosNovos } from './ofx'
import type { Refeicao, ItemRefeicao, ModeloRefeicao, EnvioMotoboy, TurnoMotoboy, EscalaMotoboy, CurvaAbc, InventarioEstoque, CompraFornecedor, ProdutoVenda, PedidoCompra, PrecoFornecedor, ItemFechamento, Fechamento, PedidoProducao, ItemListaFechamento, Producao, Motoboy, SemanaMotoboy, CentroCusto, ContaContabil, NotaFiscal, ContaPagar, ContaRecorrente, MovimentoEstoque, ItemNota, MovimentoExtrato, RegraExtrato, SaldoExtrato, MembroEquipeEvento, FreelaEvento, DiariaFreelaEvento, ItemEnvio, ProdutoEvento, QtdDiaProduto, VendaEvento, ItemModeloChecklist, EnvioEvento, Inventario, Fornecedor, Insumo, PrecoInsumo, Receita, VersaoReceita, Evento, HistoricoEvento, Operacao, Admissao, AjustePonto, DevolucaoUniforme, LocalEnvio, LocalLoja, EnvioFreela, ContaPagamento, RemessaPagamento, VinculoAnterior, SolicitacaoUniforme, PedidoUniforme, ItemPedidoUniforme, MovimentoUniforme, Equipamento, ManutencaoEquipamento, Preventiva, ExecucaoPreventiva, Desligamento, DecimoTerceiro, Ferias, Salario, DiariaFreela, Freelancer, PagamentoFreela, Chamado, Comunicado, LeituraRegulamento, VersaoRegulamento, Documento, EntregaUniforme, Folga, Funcionario, Ocorrencia, Unidade } from './types'
import { chamadoEmAberto } from './types'
import { addDias, addMeses, diasEntre, hoje, inicioDaSemana } from './datas'
import { avaliacoesDemo, vendasDemo } from './demoVendas'
import { resultadosDemo } from './demoLucro'
import { addMesesData } from './vencimentos'
import { TURNOS_PADRAO } from './turnos'
import { comFolgasDoTurno } from './pessoal'
import { sha256 } from './regulamento'
import REGULAMENTO_2025 from './regulamento-2025.md?raw'

export const SENHA_DEMO = '1234'

const unidades: Unidade[] = [
  { id: 'burger-psd', nome: 'The Ozzy Burger Parque São Domingos' },
  { id: 'burger-va', nome: 'The Ozzy Burger Vila Anastácio' },
  { id: 'pizza', nome: 'The Ozzy Pizza' },
]
// Local das lojas na demonstração (os reais, passados pelo Heitor em 08/10); Vila Anastácio e Pizza no mesmo endereço.
const locais: Record<string, { latitude: number; longitude: number } | undefined> = {
  'burger-psd': { latitude: -23.5022234, longitude: -46.7391611 },
  'burger-va': { latitude: -23.5174364, longitude: -46.7198938 },
  pizza: { latitude: -23.5174364, longitude: -46.7198938 },
}

const f = (
  id: string, nome: string, celular: string, cargo: string, unidadeId: string,
  nivel: Funcionario['nivel'], dataAdmissao: string, respondePara: string | null = null,
  status: Funcionario['status'] = 'ativo', dataDesligamento: string | null = null, setor: Funcionario['setor'] = null,
): Funcionario => ({
  id, nome, celular, cargo, unidadeId, nivel, status, dataAdmissao, respondePara, dataDesligamento, setor,
  // Na demonstração a chave Pix é o celular (fictício) e o CPF é inventado, só para dar para testar o arquivo do banco.
  pix: celular, cpf: cpfDeExemplo(celular),
})

// CPF fictício com dígito verificador certo, a partir do celular de exemplo.
function cpfDeExemplo(celular: string): string {
  const base = celular.slice(-9)
  const digito = (parte: string) => {
    const soma = [...parte].reduce((t, d, i) => t + Number(d) * (parte.length + 1 - i), 0)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }
  const d1 = digito(base)
  return base + d1 + digito(base + d1)
}

// Equipe real, da planilha de caixinha (06/10/2026). Celulares são fictícios.
// A planilha não tem data de admissão; as de desligamento são a última ocorrência de cada um.
const ADMISSAO_A_CONFIRMAR = '2026-01-05'

const funcionarios: Funcionario[] = [
  f('f1', 'Heitor', '11999990001', 'Proprietário', 'burger-psd', 'proprietario', '2019-03-01'),
  f('p-maria-costa', 'Maria Josélia de Jesus da Costa', '11999990021', 'Gerente', 'burger-psd', 'gerente', ADMISSAO_A_CONFIRMAR, 'f1', 'ativo', null, 'geral'),
  f('p-queli-souza', 'Queli da Silva Souza', '11999990022', 'Supervisor', 'burger-psd', 'supervisor', ADMISSAO_A_CONFIRMAR, 'p-maria-costa', 'ativo', null, 'cozinha'),
  f('p-arlene-santos', 'Arlene Aquino dos Santos', '11999990011', 'Supervisor', 'burger-va', 'supervisor', ADMISSAO_A_CONFIRMAR, 'p-maria-costa', 'ativo', null, 'unidade'),
  f('p-cibeli-costa', 'Cibeli Alves da Costa', '11999990012', 'Auxiliar', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-queli-souza', 'ativo', null, 'cozinha'),
  f('p-dora-ramos', 'Dora Alice Miranda Ramos', '11999990013', 'Atendente', 'burger-va', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-arlene-santos', 'ativo', null, 'atendimento'),
  f('p-gustavo-lima', 'Gustavo Almeida Lima', '11999990014', 'Auxiliar', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-queli-souza', 'ativo', null, 'cozinha'),
  f('p-julia-silva', 'Júlia Vitória Muniz da Silva', '11999990015', 'Atendente', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-maria-costa', 'ativo', null, 'atendimento'),
  f('p-kaua-silva', 'Kauã de Oliveira da Silva', '11999990016', 'Auxiliar', 'burger-va', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-arlene-santos', 'ativo', null, 'cozinha'),
  f('p-kaue-oliveira', 'Kaue Oliveira', '11999990017', 'Atendente', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-maria-costa', 'ativo', null, 'atendimento'),
  f('p-larissa-porto', 'Larissa Nunes de Oliveira Porto', '11999990018', 'Atendente', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-maria-costa', 'ativo', null, 'atendimento'),
  f('p-laura-costa', 'Laura Sofia Alves da Costa', '11999990019', 'Atendente', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-maria-costa', 'ativo', null, 'atendimento'),
  f('p-lucas-torres', 'Lucas Vidal Moreira Torres', '11999990020', 'Auxiliar', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-queli-souza', 'ativo', null, 'cozinha'),
  f('p-victor-correa', 'Victor Hugo da Silva Correa', '11999990023', 'Auxiliar', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-queli-souza', 'ativo', null, 'cozinha'),
  // Não está na planilha de caixinha. Heitor confirmou em 07/10: Produção, loja Vila Anastácio, fora da caixinha.
  f('p-julia-bernardo', 'Julia Motta Bernardo', '11999990031', 'Colaboradora de produção', 'burger-va', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-maria-costa', 'ativo', null, 'producao'),
  // Manutencista, cadastrado em 07/10. Atende as três lojas; celular fictício.
  f('p-vanderlei', 'Vanderlei Aparecido', '11999990032', 'Manutencista', 'burger-psd', 'manutencao', ADMISSAO_A_CONFIRMAR, 'f1', 'ativo', null, 'manutencao'),
  // EXEMPLO de admissão em andamento (fictício), para o passo a passo aparecer na demonstração.
  { ...f('p-novo-exemplo', 'Pedro Henrique Alves', '11999990040', 'Auxiliar de cozinha', 'burger-psd', 'funcionario', hoje() > '2026-10-08' ? addDias(hoje(), -1) : hoje(), 'p-queli-souza', 'ativo', null, 'cozinha'), cpf: '52998224725', dataNascimento: '2004-03-12', sexo: 'masculino', tamCamiseta: 'M', tamCalca: '40', tamCalcado: 41, experienciaDias1: 10, experienciaDias2: 80, turnoId: 't-psd-cozinha' },
  f('p-caciano-souza', 'Caciano Ribeiro Silva Souza', '11999990024', 'Atendente', 'burger-va', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-arlene-santos', 'inativo', '2026-07-28', 'atendimento'),
  f('p-gilson-silva', 'Gilson Bento Silva', '11999990025', 'Auxiliar', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-queli-souza', 'inativo', '2026-07-23', 'cozinha'),
  f('p-joao-costa', 'João Victor Alves da Costa', '11999990026', 'Atendente', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-maria-costa', 'inativo', '2026-07-09', 'atendimento'),
  f('p-lucas-oliveira', 'Lucas Jean de Oliveira', '11999990027', 'Auxiliar', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-queli-souza', 'inativo', '2026-06-30', 'cozinha'),
  f('p-lucilene-mathias', 'Lucilene Aparecida Mathias', '11999990028', 'Atendente', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-maria-costa', 'inativo', '2026-07-03', 'atendimento'),
  f('p-natalia-silva', 'Natália dos Santos Silva', '11999990029', 'Atendente', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-maria-costa', 'inativo', '2026-08-02', 'atendimento'),
  f('p-richard-alexandre', 'Richard Aparecido Fernandes Alexandre', '11999990030', 'Auxiliar', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-queli-souza', 'inativo', '2026-07-12', 'cozinha'),
]

// Turnos começam vazios: a gestão coloca cada pessoa (pedido do Heitor em 07/10).
const turnos = TURNOS_PADRAO.map((t) => ({ ...t }))
const leituras: LeituraRegulamento[] = []
// Versão 1 = arquivo "Regulamento_Interno_Revisado-2025.docx". O hash é calculado na primeira leitura.
const versoes: VersaoRegulamento[] = [
  { id: 'r1', numero: 1, texto: REGULAMENTO_2025, nota: 'Regulamento revisado 2025.', publicadoEm: '2026-10-07T12:00:00Z', publicadoPor: 'f1', hash: '' },
]

const agora = () => new Date().toISOString()
const haHoras = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()

// Chamados de EXEMPLO, só para a demonstração.
const chamados: Chamado[] = [
  {
    id: 'ch1', numero: 1, unidadeId: 'burger-va', categoria: 'refrigeracao', gravidade: 'urgente', titulo: 'Freezer de carnes não está gelando',
    descricao: 'O freezer horizontal está em -5 °C desde a abertura. Passei as carnes para o outro freezer, mas ele está cheio.', local: 'Cozinha',
    foto: null, status: 'aberto', abertoPor: 'p-arlene-santos', abertoEm: haHoras(2), responsavelId: null, fechadoEm: null, eventos: [],
  },
  {
    id: 'ch2', numero: 2, unidadeId: 'burger-psd', categoria: 'equipamento', gravidade: 'importante', titulo: 'Chapa esquentando só de um lado',
    descricao: 'O lado direito da chapa demora muito para esquentar. Dá para trabalhar, mas atrasa os pedidos no pico.', local: 'Cozinha',
    foto: null, status: 'andamento', abertoPor: 'p-queli-souza', abertoEm: haHoras(26), responsavelId: 'p-vanderlei', fechadoEm: null,
    eventos: [{ id: 'e1', autorId: 'p-vanderlei', em: haHoras(20), texto: 'Vou passar amanhã cedo para ver o queimador.', status: 'andamento' }],
  },
  {
    id: 'ch3', numero: 3, unidadeId: 'pizza', categoria: 'computador', gravidade: 'importante', titulo: 'Impressora de pedidos falhando',
    descricao: 'A impressora térmica para de imprimir no meio do pedido. Desligar e ligar resolve por um tempo.', local: 'Balcão',
    foto: null, status: 'aguardando', abertoPor: 'p-maria-costa', abertoEm: haHoras(70), responsavelId: 'p-vanderlei', fechadoEm: null,
    aguardandoId: 'f1', aguardandoDesde: haHoras(48), aguardandoMotivo: 'Aprovar a compra da impressora nova (R$ 890), o cabo não resolveu',
    eventos: [
      { id: 'e2', autorId: 'p-vanderlei', em: haHoras(50), texto: 'Cabo com mau contato. Pedi um cabo novo, chega quinta.', status: 'aguardando' },
      { id: 'e2b', autorId: 'p-vanderlei', em: haHoras(48), texto: 'Aguardando Heitor: Aprovar a compra da impressora nova (R$ 890), o cabo não resolveu', status: null },
    ],
  },
  {
    id: 'ch4', numero: 4, unidadeId: 'burger-psd', categoria: 'reforma', gravidade: 'simples', titulo: 'Pintura descascando no banheiro dos clientes',
    descricao: 'Parede atrás da pia com a pintura soltando.', local: 'Banheiro do salão',
    foto: null, status: 'aberto', abertoPor: 'p-larissa-porto', abertoEm: haHoras(120), responsavelId: null, fechadoEm: null, eventos: [],
  },
  {
    id: 'ch5', numero: 5, unidadeId: 'burger-va', categoria: 'hidraulica', gravidade: 'urgente', titulo: 'Pia da cozinha entupida',
    descricao: 'Água não desce na pia de lavar louça.', local: 'Cozinha',
    foto: null, status: 'resolvido', abertoPor: 'p-dora-ramos', abertoEm: haHoras(170), responsavelId: 'p-vanderlei', fechadoEm: haHoras(165),
    eventos: [{ id: 'e3', autorId: 'p-vanderlei', em: haHoras(165), texto: 'Desentupido e caixa de gordura limpa.', status: 'resolvido' }],
  },
]
let seq = 100
const novoId = (p: string) => `${p}${++seq}`

// Eventos de EXEMPLO, só para a demonstração (nomes, locais e valores inventados).
const operacoesDemo: Operacao[] = [
  { id: 'burger', nome: 'The Ozzy Burger', ativa: true },
  { id: 'pizza', nome: 'The Ozzy Pizza', ativa: true },
  { id: 'foca', nome: 'Foca', ativa: true },
]
const eventoDemo = (n: number, dias: number[], extra: Partial<Evento>): Evento => ({
  id: `ev${n}`, numero: n, nome: '', status: 'negociacao', statusMotivo: null, tipo: null, organizador: null, organizadorContato: null,
  local: null, endereco: null, publicoEstimado: null, montagemInicio: null, montagemFim: null, desmontagemInicio: null, desmontagemFim: null,
  taxaOrganizadorPct: null, valorFixo: null, condicoes: null, quemRecebe: null, repassePrazoDias: null, repasseObs: null,
  infraestrutura: null, observacao: null, operacoes: [], responsaveis: [],
  cidade: null, gastronomia: null, barracas: null, margemSegurancaPct: 10, diariaFreela: null, latitude: null, longitude: null, foraDaMedia: false, layoutBarracas: {},
  dias: dias.map((d) => ({ data: addDias(hoje(), d), abre: '12:00', fecha: '22:00' })),
  criadoPor: 'f1', criadoEm: haHoras(24 * 30), atualizadoPor: 'f1', atualizadoEm: haHoras(24 * 2), ...extra,
})
const eventosDemo: Evento[] = [
  eventoDemo(3, [40, 41], {
    nome: 'Festival de Inverno (exemplo)', tipo: 'Festival gastronômico', organizador: 'Produtora Exemplo', local: 'Praça central (exemplo)',
    publicoEstimado: 3000, taxaOrganizadorPct: 20, quemRecebe: 'organizador', repassePrazoDias: 30, operacoes: ['pizza'],
  }),
  eventoDemo(2, [10, 11, 12], {
    nome: 'Feira Gastronômica do Parque (exemplo)', status: 'aprovado', tipo: 'Feira gastronômica', organizador: 'Associação Exemplo',
    organizadorContato: '(11) 90000-0000', local: 'Parque Exemplo', endereco: 'Av. Exemplo, 100 - São Paulo', publicoEstimado: 8000,
    montagemInicio: `${addDias(hoje(), 9)}T08:00`, montagemFim: `${addDias(hoje(), 9)}T18:00`,
    desmontagemInicio: `${addDias(hoje(), 12)}T22:30`, desmontagemFim: `${addDias(hoje(), 13)}T02:00`,
    taxaOrganizadorPct: 21, valorFixo: 1500, condicoes: 'Taxa sobre o faturamento bruto das maquininhas do organizador. Cota fixa paga na assinatura.',
    quemRecebe: 'organizador', repassePrazoDias: 15, repasseObs: 'Repasse por Pix após o fechamento do último dia.',
    infraestrutura: 'Ponto de energia 220 V 32 A, água próxima, tenda 6x3 fornecida pelo organizador.',
    operacoes: ['burger', 'pizza'], responsaveis: [{ funcionarioId: 'p-maria-costa', papel: 'Responsável geral' }, { funcionarioId: 'p-queli-souza', papel: 'Cozinha' }],
  }),
  eventoDemo(1, [-20, -19], {
    nome: 'Festa Junina do Clube (exemplo)', status: 'finalizado', tipo: 'Festa', organizador: 'Clube Exemplo', local: 'Clube Exemplo',
    publicoEstimado: 1500, taxaOrganizadorPct: 15, quemRecebe: 'the_ozzy', operacoes: ['burger'], gastronomia: 'Junina', cidade: 'São Paulo', barracas: 1,
  }),
  eventoDemo(4, [-90, -89], {
    nome: 'Festival Italiano Centro (exemplo)', status: 'finalizado', tipo: 'Festival gastronômico', organizador: 'Produtora Exemplo', local: 'Praça Exemplo',
    cidade: 'São Paulo', gastronomia: 'Italiano', barracas: 2, taxaOrganizadorPct: 21, quemRecebe: 'organizador',
  }),
  eventoDemo(5, [-60, -59, -58], {
    nome: 'Festival Italiano Interior (exemplo)', status: 'finalizado', tipo: 'Festival gastronômico', organizador: 'Produtora Exemplo', local: 'Shopping Exemplo',
    cidade: 'Sorocaba', gastronomia: 'Italiano', barracas: 2, taxaOrganizadorPct: 21, quemRecebe: 'organizador',
  }),
  eventoDemo(6, [-1, 0, 1], {
    nome: 'Festival Italiano do Bairro (exemplo)', status: 'execucao', tipo: 'Festival gastronômico', organizador: 'Produtora Exemplo', local: 'Rua Exemplo',
    cidade: 'São Paulo', gastronomia: 'Italiano', barracas: 2, taxaOrganizadorPct: 21, quemRecebe: 'organizador', operacoes: ['pizza'],
    responsaveis: [{ funcionarioId: 'p-maria-costa', papel: 'Responsável geral' }, { funcionarioId: 'p-cibeli-costa', papel: 'Estoque' }],
    diariaFreela: 150, latitude: -23.5401, longitude: -46.6802,
  }),
  // Edição do ano anterior e outra gastronomia, para o painel ter comparação (EXEMPLO).
  eventoDemo(7, [-425, -424, -423], {
    nome: 'Festival Italiano Interior 2025 (exemplo)', status: 'finalizado', tipo: 'Festival gastronômico', organizador: 'Produtora Exemplo', local: 'Shopping Exemplo',
    cidade: 'Sorocaba', gastronomia: 'Italiano', barracas: 2, taxaOrganizadorPct: 21, quemRecebe: 'organizador',
  }),
  eventoDemo(9, [-300, -299], {
    nome: 'Festival Italiano Capital (exemplo)', status: 'finalizado', tipo: 'Festival gastronômico', organizador: 'Produtora Exemplo', local: 'Parque Exemplo',
    cidade: 'São Paulo', gastronomia: 'Italiano', barracas: 4, taxaOrganizadorPct: 21, quemRecebe: 'organizador', foraDaMedia: true,
  }),
  eventoDemo(8, [-150, -149], {
    nome: 'Festival Árabe (exemplo)', status: 'finalizado', tipo: 'Festival gastronômico', organizador: 'Produtora Exemplo', local: 'Praça Exemplo',
    cidade: 'São Paulo', gastronomia: 'Árabe', barracas: 1, taxaOrganizadorPct: 20, quemRecebe: 'organizador',
  }),
]
eventosDemo.find((e) => e.id === 'ev2')!.gastronomia = 'Italiano'
// Insumos e fichas de EXEMPLO (nomes e preços inventados), só para a demonstração.
const fornecedoresDemo: Fornecedor[] = [
  { id: 'fo1', nome: 'Distribuidora Exemplo', contato: 'Vendedor Exemplo', telefone: '(11) 90000-0001', observacao: null, ativo: true },
  { id: 'fo2', nome: 'Hortifruti Exemplo', contato: null, telefone: null, observacao: 'Entrega às terças', ativo: true, prazoEntregaDias: 1 },
  { id: 'fo3', nome: 'Embalagens Exemplo', contato: null, telefone: '(11) 90000-0003', observacao: null, ativo: true, prazoEntregaDias: 15 },
]
const ins = (id: string, nome: string, categoria: string, unidade: Insumo['unidade'], preco: number | null, fornecedorId: string | null, extra: Partial<Insumo> = {}): Insumo => ({
  id, nome, categoria, unidade, embalagem: null, embalagemQtd: null, preco, precoEm: haHoras(24 * 5), fornecedorId, observacao: null, ativo: true, ...extra,
})
const insumosDemo: Insumo[] = [
  ins('in1', 'Pão focaccia (forma)', 'Pães', 'un', 28, 'fo1'),
  ins('in2', 'Presunto cru', 'Frios e embutidos', 'kg', 150, 'fo1'),
  ins('in3', 'Queijo branco', 'Laticínios', 'kg', 42, 'fo1'),
  ins('in4', 'Creme de leite', 'Laticínios', 'kg', 18, 'fo1'),
  ins('in5', 'Rúcula', 'Hortifruti', 'kg', 20, 'fo2'),
  ins('in6', 'Tomate', 'Hortifruti', 'kg', 9, 'fo2'),
  ins('in7', 'Refrigerante lata', 'Bebidas', 'un', 3.2, 'fo1', { embalagem: 'fardo', embalagemQtd: 12 }),
  ins('in8', 'Azeite', 'Óleos e gorduras', 'l', null, null, { observacao: 'Sem preço: cadastre para o custo ficar completo.' }),
  ins('in9', 'Óleo de soja', 'Óleos e gorduras', 'l', 8, 'fo1'),
  ins('in10', 'Cheiro verde', 'Hortifruti', 'kg', 12, 'fo2'),
  ins('in11', 'Alho', 'Hortifruti', 'kg', 30, 'fo2'),
  // Lista de fechamento das lojas (exemplo; a real vem da Eclética).
  ins('in12', 'Maionese verde', 'Pré-preparos', 'kg', 8.8, null, { ecleticaCodigo: '100901', setorEnvio: 'cozinha' }),
  ins('in13', 'Molho especial', 'Pré-preparos', 'kg', 14, null, { ecleticaCodigo: '100902', setorEnvio: 'cozinha' }),
  ins('in14', 'Cebola caramelizada', 'Pré-preparos', 'kg', 16, null, { ecleticaCodigo: '100903', setorEnvio: 'cozinha' }),
  ins('in15', 'Alface americana', 'Hortifruti', 'un', 4, 'fo2', { ecleticaCodigo: '100904', setorEnvio: 'cozinha', embalagem: 'Caixa', embalagemQtd: 12 }),
  ins('in16', 'Blend burger 1 unidade (100g)', 'Proteínas e ovos', 'kg', 42, null, { ecleticaCodigo: '100905', setorEnvio: 'cozinha' }),
  ins('in17', 'Bacon fatiado', 'Proteínas e ovos', 'kg', 38, 'fo1', { ecleticaCodigo: '100906', setorEnvio: 'cozinha', estoqueMinimo: 5 }),
  ins('in18', 'Pão brioche mini (PCT com 12)', 'Pães', 'un', 1.1, null, { ecleticaCodigo: '100907', setorEnvio: 'cozinha', embalagem: 'Caixa', embalagemQtd: 12 }),
  ins('in19', 'Coca cola 350ml lata', 'Bebidas', 'un', 3.2, 'fo1', { ecleticaCodigo: '88', setorEnvio: 'atendimento', embalagem: 'Fardo', embalagemQtd: 12 }),
  ins('in20', 'Guardanapo sachê personalizado', 'Descartáveis e utensílios', 'un', 0.05, null, { ecleticaCodigo: '100908', setorEnvio: 'atendimento' }),
  ins('in21', 'Saco kraft P PCT C/ 100', 'Embalagens', 'un', 0.3, 'fo3', { ecleticaCodigo: '100909', setorEnvio: 'atendimento' }),
  ins('in22', 'Água sanitária 2L', 'Limpeza', 'un', 6.5, null, { ecleticaCodigo: '100619', setorEnvio: 'cozinha' }),
  // Exemplo de preço fora do padrão (preço da caixa cadastrado como unidade), para a Conferência de preços.
  ins('in23', 'Guardanapo', 'Descartáveis e utensílios', 'un', 90.34, null, { ecleticaCodigo: '299', setorEnvio: 'atendimento' }),
  // Para a refeição da equipe.
  ins('in24', 'Arroz tipo 1', 'Mercearia', 'kg', 6, null),
  ins('in25', 'Feijão carioca', 'Mercearia', 'kg', 8, null),
  ins('in26', 'Carne moída', 'Proteínas e ovos', 'kg', 32, null),
  ins('in27', 'Batata', 'Hortifruti', 'kg', 5, 'fo2'),
  ins('in28', 'Cebola', 'Hortifruti', 'kg', 5, 'fo2'),
  ins('in29', 'Peito de frango', 'Proteínas e ovos', 'kg', 19, null),
  ins('in30', 'Leite integral', 'Laticínios', 'l', 5, null),
]
const prePreparoDemo = new Set(['in12', 'in13', 'in14'])
const precosInsumoDemo: PrecoInsumo[] = insumosDemo.map((i) => ({ id: 'pi' + i.id, insumoId: i.id, preco: i.preco, em: haHoras(24 * 5), por: null, origem: 'exemplo' }))
const categoriasDemo = new Set<string>()
const rec = (id: string, nome: string, tipo: Receita['tipo'], extra: Partial<Receita> = {}): Receita => ({
  id, nome, tipo, linha: 'Foca', operacaoId: null, origem: 'propria', unidade: tipo === 'produto' ? 'un' : 'kg', precoVenda: null,
  tempoPreparoMin: null, tempoFinalizacaoMin: null, capacidadeHora: null, equipamentos: null, conservacao: null, validadeDias: null, modoPreparo: null, ativo: true, versaoAtual: 1, ...extra,
})
const receitasDemo: Receita[] = [
  rec('re1', 'Creme de queijo (exemplo)', 'preparo', { conservacao: 'Refrigerado até 5 °C', validadeDias: 3, modoPreparo: '1. Bata o queijo com o creme de leite até ficar liso.\n2. Coloque nas mangas de confeiteiro e guarde refrigerado.' }),
  rec('re2', 'Focaccia de presunto (exemplo)', 'produto', { precoVenda: 55, tempoFinalizacaoMin: 3, capacidadeHora: 60, equipamentos: 'Forno elétrico', versaoAtual: 2 }),
  rec('re3', 'Refrigerante (exemplo)', 'produto', { linha: 'Bebidas', origem: 'revenda', precoVenda: 9 }),
  rec('re4', 'Pizza margherita (exemplo)', 'produto', { linha: 'Pizza', precoVenda: 50 }),
  rec('re5', 'Cannoli (exemplo)', 'produto', { linha: 'Sobremesa', precoVenda: 25, versaoAtual: 0 }),
  rec('re6', 'Maionese verde (exemplo)', 'preparo', { linha: null, conservacao: 'Refrigerado', validadeDias: 4, insumoId: 'in12', ecleticaCodigo: '100901', responsavel: 'Victoria',
    porcaoNome: 'potinhos', porcaoQtd: 0.03, observacoes: 'Caso o molho separe, tire o líquido talhado, limpe o copo, comece de novo e use a mistura talhada no lugar do óleo.',
    modoPreparo: 'Retire todos os talos da salsinha e da cebolinha\nAdicione o óleo, o alho e as folhas aos poucos no liquidificador\nBata até emulsionar, cerca de 30 segundos\nPorcione nos potinhos e guarde refrigerado' }),
  // Fichas das lojas (vindas da Eclética).
  rec('re7', 'Molho especial (exemplo)', 'preparo', { linha: null, area: 'lojas', insumoId: 'in13', ecleticaCodigo: '100902', conservacao: 'Refrigerado', validadeDias: 3,
    modoPreparo: 'Coloque a maionese verde e o tomate no liquidificador\nBata por 1 minuto\nGuarde refrigerado em bisnagas' }),
  rec('re8', 'BURGER BACON (EXEMPLO)', 'produto', { linha: 'BURGERS', area: 'lojas', ecleticaCodigo: '11', precoVenda: 44.9 }),
  rec('re9', 'BURGER CLÁSSICO (EXEMPLO)', 'produto', { linha: 'BURGERS', area: 'lojas', ecleticaCodigo: '10', precoVenda: 39.9 }),
]
const it = (insumoId: string | null, subReceitaId: string | null, quantidade: number, aproveitamento = 1) => ({ insumoId, subReceitaId, quantidade, aproveitamento })
const versoesReceitaDemo: VersaoReceita[] = [
  { id: 've7', receitaId: 're7', numero: 1, rendimento: 1, custoTotal: null, nota: 'Fórmula da Eclética', criadaEm: haHoras(10), criadaPor: null, itens: [it(null, 're6', 0.9), it('in6', null, 0.12, 0.9)] },
  { id: 've8', receitaId: 're8', numero: 1, rendimento: 1, custoTotal: null, nota: 'Fórmula da Eclética', criadaEm: haHoras(10), criadaPor: null,
    itens: [it('in18', null, 1), it('in16', null, 0.1), it('in17', null, 0.03), it(null, 're7', 0.02), it('in15', null, 0.05), { ...it('in21', null, 1), soDelivery: true }] },
  { id: 've9', receitaId: 're9', numero: 1, rendimento: 1, custoTotal: null, nota: 'Fórmula da Eclética', criadaEm: haHoras(10), criadaPor: null,
    itens: [it('in18', null, 1), it('in16', null, 0.1), it(null, 're6', 0.02), it('in15', null, 0.05), { ...it('in21', null, 1), soDelivery: true }] },
  { id: 've6', receitaId: 're6', numero: 1, rendimento: 1, custoTotal: 8.27, nota: 'Exemplo', criadaEm: haHoras(24 * 10), criadaPor: 'f1', itens: [it('in9', null, 0.8), it('in10', null, 0.12, 0.8), it('in11', null, 0.02)] },
  { id: 've1', receitaId: 're1', numero: 1, rendimento: 1, custoTotal: 34.08, nota: 'Exemplo', criadaEm: haHoras(24 * 20), criadaPor: 'f1', itens: [it('in4', null, 0.33), it('in3', null, 0.67)] },
  { id: 've2', receitaId: 're2', numero: 1, rendimento: 1, custoTotal: 7.78, nota: 'Exemplo', criadaEm: haHoras(24 * 20), criadaPor: 'f1', itens: [it('in1', null, 0.167), it('in2', null, 0.015), it(null, 're1', 0.025)] },
  { id: 've3', receitaId: 're2', numero: 2, rendimento: 1, custoTotal: 8.28, nota: 'Mais rúcula, a pedido da cozinha', criadaEm: haHoras(24 * 3), criadaPor: 'f1', itens: [it('in1', null, 0.167), it('in2', null, 0.015), it(null, 're1', 0.025), it('in5', null, 0.02, 0.8)] },
  { id: 've4', receitaId: 're3', numero: 1, rendimento: 1, custoTotal: 3.2, nota: 'Exemplo', criadaEm: haHoras(24 * 20), criadaPor: 'f1', itens: [it('in7', null, 1)] },  { id: 've5', receitaId: 're4', numero: 1, rendimento: 1, custoTotal: 6.3, nota: 'Exemplo', criadaEm: haHoras(24 * 20), criadaPor: 'f1', itens: [it('in6', null, 0.15, 0.9), it('in3', null, 0.08), it('in1', null, 0.1)] },
]
// Vendas de EXEMPLO dos eventos finalizados e do evento em andamento (dia de ontem).
const vendaDemo = (eventoId: string, dia: number, receitaId: string, quantidade: number, preco: number): VendaEvento => ({
  eventoId, data: addDias(hoje(), dia), receitaId, produto: receitasDemo.find((r) => r.id === receitaId)!.nome, quantidade, total: quantidade * preco, origem: 'exemplo',
})
const vendasEventosDemo: VendaEvento[] = [
  ...[[-20, 120, 210], [-19, 150, 260]].flatMap(([d, a, b]) => [vendaDemo('ev1', d, 're2', a, 50), vendaDemo('ev1', d, 're3', b, 8)]),
  ...[[-90, 380, 420, 300], [-89, 450, 500, 340]].flatMap(([d, a, b, c]) => [vendaDemo('ev4', d, 're2', a, 55), vendaDemo('ev4', d, 're3', b, 9), vendaDemo('ev4', d, 're4', c, 50)]),
  ...[[-60, 180, 200, 150], [-59, 420, 470, 330], [-58, 360, 390, 280]].flatMap(([d, a, b, c]) => [vendaDemo('ev5', d, 're2', a, 55), vendaDemo('ev5', d, 're3', b, 9), vendaDemo('ev5', d, 're4', c, 50)]),
  ...[[-425, 150, 180, 120], [-424, 300, 330, 220], [-423, 260, 280, 190]].flatMap(([d, a, b, c]) => [vendaDemo('ev7', d, 're2', a, 50), vendaDemo('ev7', d, 're3', b, 8), vendaDemo('ev7', d, 're4', c, 45)]),
  ...[[-150, 140, 160, 60], [-149, 190, 220, 80]].flatMap(([d, a, b, c]) => [vendaDemo('ev8', d, 're2', a, 55), vendaDemo('ev8', d, 're3', b, 9), vendaDemo('ev8', d, 're5', c, 25)]),
  ...[[-300, 1300, 1500, 1100], [-299, 1600, 1800, 1300]].flatMap(([d, a, b, c]) => [vendaDemo('ev9', d, 're2', a, 55), vendaDemo('ev9', d, 're3', b, 9), vendaDemo('ev9', d, 're4', c, 50)]),
  vendaDemo('ev5', -59, 're5', 90, 25), vendaDemo('ev5', -58, 're5', 70, 25),
  vendaDemo('ev6', -1, 're2', 260, 55), vendaDemo('ev6', -1, 're3', 300, 9), vendaDemo('ev6', -1, 're4', 210, 50),
]
const cardapiosDemo: Record<string, ProdutoEvento[]> = {
  ev1: [{ receitaId: 're2', preco: 50, ordem: 1 }, { receitaId: 're3', preco: 8, ordem: 2 }],
  ev2: [{ receitaId: 're2', preco: 55, ordem: 1 }, { receitaId: 're4', preco: 50, ordem: 2 }, { receitaId: 're3', preco: 9, ordem: 3 }],
  ev4: [{ receitaId: 're2', preco: 55, ordem: 1 }, { receitaId: 're3', preco: 9, ordem: 2 }, { receitaId: 're4', preco: 50, ordem: 3 }],
  ev5: [{ receitaId: 're2', preco: 55, ordem: 1 }, { receitaId: 're3', preco: 9, ordem: 2 }, { receitaId: 're4', preco: 50, ordem: 3 }],
  ev6: [{ receitaId: 're2', preco: 55, ordem: 1 }, { receitaId: 're4', preco: 50, ordem: 2 }, { receitaId: 're3', preco: 9, ordem: 3 }],
}
const previsoesDemo: Record<string, QtdDiaProduto[]> = {
  ev6: [-1, 0, 1].flatMap((d, i) => [
    { data: addDias(hoje(), d), receitaId: 're2', quantidade: [250, 400, 350][i] },
    { data: addDias(hoje(), d), receitaId: 're4', quantidade: [200, 320, 280][i] },
    { data: addDias(hoje(), d), receitaId: 're3', quantidade: [280, 450, 400][i] },
  ]),
}
const modeloChecklistDemo: ItemModeloChecklist[] = [
  ['Equipamentos', 'Chapa de pão', 'Foca', '2'], ['Equipamentos', 'Extintor', null, '2'], ['Equipamentos', 'Fornos', 'Pizza', 'Grande e médio'],
  ['Utensílios', 'Cortador de pizza', 'Pizza', '4'], ['Utensílios', 'GNs', 'Foca', 'Todas'], ['Embalagens', 'Pratos pizza', 'Pizza', '1000'],
  ['Prod. Limpeza', 'Álcool gel', null, '3'], ['Decoração', 'Cardápios', null, 'Todos'],
].map(([categoria, item, operacao, quantidade], i) => ({
  id: 'mc' + i, categoria: categoria!, item: item!, operacao, operacaoId: operacao === 'Pizza' ? 'pizza' : operacao === 'Foca' ? 'foca' : null, quantidade, ordem: i, ativo: true,
}))
const itemEnvioDemo = (id: string, categoria: string, chave: string | null, item: string | null, previsto: number | null, unidade: string | null, extra: Partial<ItemEnvio> = {}): ItemEnvio => ({
  id, ordem: 0, categoria, operacao: null, insumoId: chave?.startsWith('i:') ? chave.slice(2) : null, receitaId: chave?.startsWith('r:') ? chave.slice(2) : null, item,
  previsto, quantidade: previsto, quantidadeTexto: null, unidade, conferido: true, conferidoPor: 'p-maria-costa', conferidoEm: haHoras(30),
  retornou: false, retornoPor: null, retornoEm: null, ...extra,
})
const enviosDemo: EnvioEvento[] = [
  {
    id: 'en1', eventoId: 'ev6', data: addDias(hoje(), -1), tipo: 'separacao', observacao: null, criadoPor: 'f1', criadoEm: haHoras(48),
    itens: [
      itemEnvioDemo('ei1', 'Insumos', 'i:in1', null, 50, 'un'), itemEnvioDemo('ei2', 'Insumos', 'i:in2', null, 5, 'kg'), itemEnvioDemo('ei3', 'Pré-preparos', 'r:re1', null, 8, 'kg'),
      itemEnvioDemo('ei4', 'Insumos', 'i:in3', null, 25, 'kg'), itemEnvioDemo('ei5', 'Insumos', 'i:in6', null, 40, 'kg'), itemEnvioDemo('ei6', 'Insumos', 'i:in7', null, 360, 'un'),
      itemEnvioDemo('ei7', 'Equipamentos', null, 'Chapa de pão', null, null, { operacao: 'Foca', quantidadeTexto: '2' }),
      itemEnvioDemo('ei8', 'Equipamentos', null, 'Extintor', null, null, { quantidadeTexto: '2' }),
      itemEnvioDemo('ei9', 'Utensílios', null, 'GNs', null, null, { operacao: 'Foca', quantidadeTexto: 'Todas' }),
    ].map((x, i) => ({ ...x, ordem: i + 1 })),
  },
]
// Equipe do evento em andamento (EXEMPLO).
const membroDemo = (id: string, eventoId: string, quem: Partial<MembroEquipeEvento>, funcao: string, barraca: number, posicao: number | null, ordem: number): MembroEquipeEvento => ({
  id, eventoId, funcionarioId: null, freelaId: null, nome: null, funcao, barraca, posicao, observacao: null, ordem, ...quem,
})
const equipeEventoDemo: MembroEquipeEvento[] = [
  membroDemo('eq1', 'ev6', { funcionarioId: 'p-maria-costa' }, 'Responsável', 1, 1, 1),
  membroDemo('eq2', 'ev6', { funcionarioId: 'p-cibeli-costa' }, 'Caixa', 1, 0, 2),
  membroDemo('eq3', 'ev6', { freelaId: 'fe1' }, 'Pizzaiolo', 1, 7, 3),
  membroDemo('eq4', 'ev6', { freelaId: 'fe2' }, 'Forno', 1, 8, 4),
  membroDemo('eq5', 'ev6', { nome: 'Pessoa Sem Cadastro (exemplo)' }, 'Montagem', 2, null, 5),
]
// Freelancers de eventos (EXEMPLO, nomes e CPFs fictícios).
const freelasEventoDemo: FreelaEvento[] = [
  { id: 'fe1', nome: 'Bruno Carvalho Lima', cpf: '11144477735', pix: '11977776666', celular: '11977776666', funcao: 'Pizzaiolo', valorDiaria: 180, observacao: null, ativo: true },
  { id: 'fe2', nome: 'Camila Duarte Nunes', cpf: '12345678909', pix: 'camila.nunes@email.com', celular: '11955554444', funcao: 'Atendente', valorDiaria: null, observacao: null, ativo: true },
  { id: 'fe3', nome: 'Diego Ferraz Prado', cpf: '98765432100', pix: '98765432100', celular: '11933332222', funcao: 'Auxiliar de cozinha', valorDiaria: null, observacao: 'Só fins de semana', ativo: true },
]
const diariaEv = (id: string, eventoId: string, dia: number, f: FreelaEvento | null, extra: Partial<DiariaFreelaEvento>): DiariaFreelaEvento => ({
  id, eventoId, freelaId: f?.id ?? null, cpf: f?.cpf ?? '', data: addDias(hoje(), dia), funcao: f?.funcao ?? 'Atendente', valor: null, observacao: null,
  nome: f?.nome ?? null, pix: f?.pix ?? null, celular: f?.celular ?? null, origem: 'link', status: 'pendente', motivo: null, distanciaM: null, noLocal: false,
  enviadoEm: haHoras(2), pagoEm: null, ...extra,
})
const diariasEventoDemo: DiariaFreelaEvento[] = [
  diariaEv('de1', 'ev4', -90, freelasEventoDemo[0], { status: 'aprovado', valor: 180, pagoEm: haHoras(24 * 85) }),
  diariaEv('de2', 'ev4', -89, freelasEventoDemo[0], { status: 'aprovado', valor: 180, pagoEm: haHoras(24 * 85) }),
  diariaEv('de3', 'ev4', -89, freelasEventoDemo[1], { status: 'aprovado', valor: 150, pagoEm: haHoras(24 * 85) }),
  diariaEv('de4', 'ev6', -1, freelasEventoDemo[0], { status: 'aprovado', valor: 180, noLocal: true, distanciaM: 40 }),
  diariaEv('de5', 'ev6', -1, freelasEventoDemo[1], { status: 'aprovado', valor: 150, origem: 'gestao' }),
  diariaEv('de6', 'ev6', 0, freelasEventoDemo[0], { noLocal: true, distanciaM: 35 }),
  diariaEv('de7', 'ev6', -1, freelasEventoDemo[2], { distanciaM: 5200, enviadoEm: haHoras(1) }),
  diariaEv('de8', 'ev6', 0, null, { cpf: '24681357928', nome: 'Elisa Gomes Ribeiro', pix: 'elisa.ribeiro@email.com', celular: '11922221111', funcao: 'Caixa', noLocal: true, distanciaM: 80 }),
]
const inventariosDemo: Inventario[] = [
  {
    id: 'iv1', local: 'evento', eventoId: 'ev6', data: addDias(hoje(), -1), contadoPor: 'p-maria-costa', contadoEm: haHoras(14), observacao: null,
    fala: 'focaccia 9, presunto cru 0,9 quilo, creme de queijo 1 quilo e meio, queijo branco 4 quilos, creme de leite 1 quilo, tomate 6 quilos, refrigerante 70',
    itens: [{ chave: 'i:in1', quantidade: 9 }, { chave: 'i:in2', quantidade: 0.9 }, { chave: 'r:re1', quantidade: 1.5 }, { chave: 'i:in3', quantidade: 4 }, { chave: 'i:in4', quantidade: 1 }, { chave: 'i:in6', quantidade: 6 }, { chave: 'i:in7', quantidade: 70 }],
  },
  {
    id: 'iv0', local: 'base', eventoId: null, data: addDias(hoje(), -3), contadoPor: 'f1', contadoEm: haHoras(72), observacao: 'Contagem da Central (exemplo)', fala: null,
    itens: [{ chave: 'i:in1', quantidade: 200 }, { chave: 'i:in2', quantidade: 12 }, { chave: 'r:re1', quantidade: 20 }, { chave: 'i:in3', quantidade: 60 }, { chave: 'i:in4', quantidade: 10 }, { chave: 'i:in6', quantidade: 80 }, { chave: 'i:in7', quantidade: 1200 }],
  },
]
const historicoEventosDemo: HistoricoEvento[] = [
  { id: 'he1', eventoId: 'ev2', em: haHoras(24 * 30), por: 'f1', tipo: 'criado', de: null, para: 'negociacao', campos: null, motivo: null },
  { id: 'he2', eventoId: 'ev2', em: haHoras(24 * 2), por: 'f1', tipo: 'status', de: 'negociacao', para: 'aprovado', campos: null, motivo: 'Contrato assinado' },
]

// Documentos e exames são EXEMPLO (não vieram da planilha).
const documentos: Documento[] = [
  { id: 'd1', funcionarioId: 'p-cibeli-costa', tipo: 'atestado', nomeArquivo: 'atestado.pdf', observacao: 'Exemplo', inicio: addDias(hoje(), -9), fim: addDias(hoje(), -8), enviadoPor: 'p-cibeli-costa', criadoEm: addDias(hoje(), -9) + 'T10:12:00Z' },
  { id: 'd2', funcionarioId: 'p-cibeli-costa', tipo: 'documento_pessoal', nomeArquivo: 'rg.jpg', enviadoPor: 'p-maria-costa', criadoEm: '2026-01-05T14:00:00Z' },
  // Dois atestados que somam 18 dias em 60: o portal avisa do INSS.
  { id: 'd3', funcionarioId: 'p-dora-ramos', tipo: 'atestado', nomeArquivo: 'atestado-1.pdf', observacao: 'Exemplo', inicio: addDias(hoje(), -40), fim: addDias(hoje(), -31), enviadoPor: 'p-dora-ramos', criadoEm: addDias(hoje(), -40) + 'T09:00:00Z' },
  { id: 'd4', funcionarioId: 'p-dora-ramos', tipo: 'atestado', nomeArquivo: 'atestado-2.pdf', observacao: 'Exemplo', inicio: addDias(hoje(), -12), fim: addDias(hoje(), -5), enviadoPor: 'p-dora-ramos', criadoEm: addDias(hoje(), -12) + 'T09:00:00Z' },
]

// [funcionário, dias desde o exame, faltando coprocultura?]
const situacoesExame: [string, number, boolean?][] = [
  ['f1', 120], ['p-maria-costa', 200], ['p-queli-souza', 352], ['p-arlene-santos', 90], ['p-cibeli-costa', 345],
  ['p-dora-ramos', 380], ['p-gustavo-lima', 60], ['p-julia-silva', 250, true], ['p-kaue-oliveira', 30],
  ['p-larissa-porto', 300], ['p-laura-costa', 180], ['p-lucas-torres', 400], ['p-victor-correa', 20],
]
documentos.push(
  ...situacoesExame.flatMap(([fid, dias, semCopro], i): Documento[] => {
    const feito = addDias(hoje(), -dias)
    const vence = addMesesData(feito, 12)
    const base = { funcionarioId: fid, enviadoPor: 'p-maria-costa', realizadoEm: feito, vence, criadoEm: feito + 'T15:00:00Z' }
    return [
      { ...base, id: `ds${i}a`, tipo: 'aso_periodico', nomeArquivo: `aso-${fid}.pdf`, observacao: 'Exemplo · clínica de segurança do trabalho' },
      ...(semCopro ? [] : [{ ...base, id: `ds${i}b`, tipo: 'coprocultura' as const, nomeArquivo: `coprocultura-${fid}.pdf` }]),
      { ...base, id: `ds${i}c`, tipo: 'coproparasitologico', nomeArquivo: `parasitologico-${fid}.pdf` },
    ]
  }),
)

// Assinatura de exemplo (um rabisco em SVG).
const ASSINATURA_DEMO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><path d="M10 70 C30 20 50 20 55 60 S80 90 95 50 S120 20 130 55 S160 80 175 45 S210 30 230 60 S270 70 290 40" fill="none" stroke="#0b0b0c" stroke-width="3" stroke-linecap="round"/></svg>')

// Tabela de desconto de EXEMPLO (a real a gestão preenche em Compras › Uniformes).
const valoresUniforme: Record<string, number> = { Camiseta: 35, 'Calça': 60, Sapato: 120, Avental: 30, 'Boné': 25 }
const devolucoes: DevolucaoUniforme[] = []
const guiasDemo = new Map<string, string>()
const admissoes: Admissao[] = []
const ajustesPonto: AjustePonto[] = [
  { id: 'aj1', funcionarioId: 'p-cibeli-costa', data: addDias(hoje(), -1), tipo: 'esqueci_saida', horario: '23:20', motivo: 'Saí junto com a Queli e esqueci de bater.', status: 'pendente', resposta: null, criadoEm: new Date(Date.now() - 5 * 3600_000).toISOString(), resolvidoPor: null, resolvidoEm: null },
  { id: 'aj2', funcionarioId: 'p-dora-ramos', data: addDias(hoje(), -2), tipo: 'equipamento', horario: '13:30', motivo: 'O relógio estava travado na entrada.', status: 'pendente', resposta: null, criadoEm: new Date(Date.now() - 26 * 3600_000).toISOString(), resolvidoPor: null, resolvidoEm: null },
  { id: 'aj3', funcionarioId: 'p-cibeli-costa', data: addDias(hoje(), -9), tipo: 'esqueci_entrada', horario: '13:30', motivo: null, status: 'feito', resposta: null, criadoEm: new Date(Date.now() - 9 * 86400_000).toISOString(), resolvidoPor: 'p-maria-costa', resolvidoEm: new Date(Date.now() - 8 * 86400_000).toISOString() },
]

const uniformes: EntregaUniforme[] = [
  {
    id: 'u1', funcionarioId: 'p-dora-ramos', data: '2026-01-05', entreguePor: 'p-arlene-santos', observacao: 'Exemplo', criadoEm: '2026-01-05T10:00:00Z',
    itens: [{ item: 'Camiseta', tamanho: 'M', quantidade: 2 }, { item: 'Avental', quantidade: 1 }, { item: 'Boné', quantidade: 1 }],
    assinatura: ASSINATURA_DEMO, assinadoEm: '2026-01-05T10:02:00Z', assinadoVia: 'presencial',
  },
  {
    id: 'u2', funcionarioId: 'p-cibeli-costa', data: '2026-01-05', entreguePor: 'p-queli-souza', observacao: 'Exemplo', criadoEm: '2026-01-05T10:00:00Z',
    itens: [{ item: 'Dólmã', tamanho: 'M', quantidade: 2 }, { item: 'Touca', quantidade: 2 }, { item: 'Luva térmica (EPI)', quantidade: 1 }],
    assinatura: ASSINATURA_DEMO, assinadoEm: '2026-01-05T10:05:00Z', assinadoVia: 'presencial',
  },
  {
    id: 'u3', funcionarioId: 'p-cibeli-costa', data: addDias(hoje(), -1), entreguePor: 'p-maria-costa', observacao: 'Exemplo · troca do dólmã gasto', criadoEm: addDias(hoje(), -1) + 'T16:00:00Z',
    itens: [{ item: 'Dólmã', tamanho: 'M', quantidade: 1 }, { item: 'Avental', quantidade: 1 }],
    assinatura: null, assinadoEm: null, assinadoVia: null,
  },
]
const arquivosDemo = new Map<string, string>()

// Valores reais de setembro/2026, da planilha.
// Freelancers de exemplo (nomes, CPFs e Pix fictícios), com diárias nesta semana e na anterior.
const dataCurtaDemo = (d: string) => d.slice(8, 10) + '/' + d.slice(5, 7)
// Motoboys de EXEMPLO (nomes e Pix inventados).
const motoboysDemo: Motoboy[] = [
  { id: 'mb1', nome: 'Mateus Exemplo Rocha', unidadeId: 'burger-psd', pix: '11955554444', telefone: '11955554444', cpf: null, observacao: null, ativo: true },
  { id: 'mb2', nome: 'Renan Exemplo Dias', unidadeId: 'burger-psd', pix: 'renan@email.com', telefone: null, cpf: null, observacao: 'Supervisiona os motoboys', ativo: true, responsavel: true, adicionalResponsavel: 125 },
  { id: 'mb3', nome: 'Tiago Exemplo Lima', unidadeId: 'burger-va', pix: '11944443333', telefone: '11944443333', cpf: null, observacao: null, ativo: true },
]
const semanasMotoboyDemo: SemanaMotoboy[] = []
const turnosMotoboyDemo: TurnoMotoboy[] = [
  ...[1, 2, 3, 4, 5, 6].map((dia) => ({ unidadeId: 'burger-psd', dia, inicio: '18:00', fim: dia === 4 || dia === 5 ? '23:30' : '22:30' })),
  ...[1, 2, 3, 4, 5, 6].map((dia) => ({ unidadeId: 'burger-va', dia, inicio: '18:00', fim: '23:00' })),
]
const escalaMotoboyDemo: EscalaMotoboy[] = [
  { id: 'esc1', motoboyId: 'mb1', unidadeId: 'burger-psd', data: hoje() },
  { id: 'esc2', motoboyId: 'mb3', unidadeId: 'burger-va', data: hoje() },
]
const refeicoesDemo: (Refeicao & { pessoas: number | null; itens: ItemRefeicao[]; custoTotal: number })[] = [
  { id: 'rf1', data: addDias(hoje(), -1), centroCustoId: 'burger-psd', prato: 'Escondidinho de Carne Moída', acompanhamentos: 'Arroz, feijão e salada', observacao: null, pessoas: 14, pesoKg: 7.2,
    itens: [{ insumoId: 'in26', quantidade: 2.1, custoUnit: 32 }, { insumoId: 'in27', quantidade: 3.5, custoUnit: 5 }, { insumoId: 'in24', quantidade: 1.1, custoUnit: 6 }, { insumoId: 'in25', quantidade: 0.8, custoUnit: 8 }],
    custoTotal: 2.1 * 32 + 3.5 * 5 + 1.1 * 6 + 0.8 * 8 },
  { id: 'rf2', data: addDias(hoje(), -2), centroCustoId: 'burger-psd', prato: 'Frango Grelhado', acompanhamentos: 'Arroz, feijão e legumes', observacao: null, pessoas: 12,
    itens: [{ insumoId: 'in29', quantidade: 2.2, custoUnit: 19 }, { insumoId: 'in24', quantidade: 1, custoUnit: 6 }, { insumoId: 'in25', quantidade: 0.7, custoUnit: 8 }],
    custoTotal: 2.2 * 19 + 6 + 0.7 * 8 },
]
// Votos de exemplo (sem pessoa: no demo só os totais importam); o voto de quem está logado fica à parte.
const votosDemo = new Map<string, { positivos: number; negativos: number; meus: Map<string, number> }>([
  ['rf1', { positivos: 9, negativos: 2, meus: new Map() }],
  ['rf2', { positivos: 4, negativos: 5, meus: new Map() }],
])
const modelosRefeicaoDemo: ModeloRefeicao[] = [
  { id: 'mr1', nome: 'Escondidinho de Carne Moída', tipo: 'prato', ativo: true, modoPreparo: null,
    itens: [{ nome: 'Carne moída', quantidade: 0.15, unidade: 'kg', insumoId: 'in26' }, { nome: 'Batata', quantidade: 0.25, unidade: 'kg', insumoId: 'in27' }, { nome: 'Arroz tipo 1', quantidade: 0.0786, unidade: 'kg', insumoId: 'in24' }, { nome: 'Feijão carioca', quantidade: 0.0571, unidade: 'kg', insumoId: 'in25' }] },
  { id: 'mr2', nome: 'Frango Grelhado', tipo: 'prato', ativo: true, modoPreparo: null,
    itens: [{ nome: 'Peito de frango', quantidade: 0.1833, unidade: 'kg', insumoId: 'in29' }, { nome: 'Arroz tipo 1', quantidade: 0.0833, unidade: 'kg', insumoId: 'in24' }, { nome: 'Feijão carioca', quantidade: 0.0583, unidade: 'kg', insumoId: 'in25' }] },
]
// Uma notinha de exemplo (desenho) para a conferência na demonstração.
const notinhaDemo = (n: number) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420"><rect width="300" height="420" fill="#fffef6"/><g font-family="monospace" font-size="18" fill="#222"><text x="20" y="40">THE OZZY BURGER</text><text x="20" y="80">Pedido #${4810 + n}</text><text x="20" y="120">Entrega - Rua Exemplo, ${n * 37}</text><text x="20" y="160">1x Ozzy Classic</text><text x="20" y="190">1x Batata média</text><text x="20" y="240">Total R$ ${(48 + n * 3).toFixed(2)}</text></g></svg>`)
const enviosMotoboyDemo: EnvioMotoboy[] = [
  { id: 'emb1', motoboyId: 'mb1', unidadeId: 'burger-psd', data: addDias(hoje(), -1), entregas: 13, extras: [{ descricao: 'Entrega longe (Osasco)', valor: 8 }], observacao: 'Choveu bastante',
    fotos: [1, 2, 3].map(notinhaDemo), status: 'pendente', entregasConferidas: null, motivo: null, enviadoEm: new Date().toISOString() },
]

const freelas: Freelancer[] = [
  { id: 'fl1', nome: 'Rafael Mendes Teixeira', cpf: '52998224725', pix: '11988887777', celular: '11988887777', ativo: true, funcionarioId: null },
  { id: 'fl2', nome: 'Bruna Carvalho Lopes', cpf: '11144477735', pix: 'bruna.lopes@email.com', celular: null, ativo: true, funcionarioId: null },
  { id: 'fl3', nome: 'Diego Ferreira Santos', cpf: '39053344705', pix: '39053344705', celular: '11977776666', ativo: true, funcionarioId: null },
]
const diarias: DiariaFreela[] = (() => {
  const seg = inicioDaSemana(hoje())
  const d = (dia: number, fl: string, turno: 'manha' | 'noite', unidadeId: string, funcao: string, valor: number, semana = 0): DiariaFreela => ({
    id: `dd-${semana}-${dia}-${fl}-${turno}`, freelancerId: fl, data: addDias(seg, dia + semana * 7), turno, unidadeId, funcao, valor, observacao: null, lancadoPor: 'p-maria-costa',
  })
  return [
    d(4, 'fl1', 'noite', 'burger-psd', 'Chapeiro', 130, -1), d(5, 'fl1', 'noite', 'burger-psd', 'Chapeiro', 130, -1),
    d(6, 'fl2', 'noite', 'pizza', 'Atendente', 110, -1), d(5, 'fl3', 'noite', 'burger-va', 'Entregador', 100, -1),
    d(0, 'fl1', 'noite', 'burger-psd', 'Chapeiro', 130), d(1, 'fl2', 'manha', 'burger-va', 'Atendente', 100),
  ].filter((x) => x.data <= hoje())
})()
const pagamentos: PagamentoFreela[] = []
const pedidoInsumosDemo = new Map<string, Record<string, number>>()
// Diárias mandadas pelo link (freelancer) e pelo login (funcionário), esperando a gestão aprovar.
const envios: EnvioFreela[] = (() => {
  const e = (id: string, dias: number, turno: 'manha' | 'noite', x: Partial<EnvioFreela>): EnvioFreela => ({
    id, cpf: null, celular: null, nome: '', pix: '', freelancerId: null, funcionarioId: null, data: addDias(hoje(), -dias), turno,
    unidadeId: 'burger-psd', funcao: 'Chapeiro', observacao: null, status: 'pendente', motivo: null, naLoja: false, distanciaLojaM: null,
    enviadoEm: `${addDias(hoje(), -dias)}T${turno === 'noite' ? '18:0' : '10:1'}${dias}:00-03:00`, ...x,
  })
  return [
    e('env1', 1, 'noite', { cpf: '52998224725', celular: '11988887777', nome: 'Rafael Mendes Teixeira', pix: '11988887777', freelancerId: 'fl1', naLoja: true, distanciaLojaM: 40 }),
    e('env2', 2, 'noite', { cpf: '86288366757', celular: '11966665555', nome: 'Lucas Almeida Rocha', pix: 'lucas.rocha@email.com', unidadeId: 'burger-va', funcao: 'Entregador', distanciaLojaM: 4200, enviadoEm: new Date().toISOString() }),
    e('env3', 1, 'noite', { cpf: '86288366757', celular: '11966665555', nome: 'Lucas Almeida Rocha', pix: 'lucas.rocha@email.com', unidadeId: 'burger-va', funcao: 'Entregador', observacao: 'Fiquei até 0h30', naLoja: true, distanciaLojaM: 25 }),
    e('env4', 1, 'manha', { cpf: '39053344705', celular: '11955554444', nome: 'Diego Ferreira Santos', pix: '11955554444', freelancerId: 'fl3', unidadeId: 'pizza', funcao: 'Atendente' }),
    e('env6', (new Date().getDay() + 6) % 7 + 1, 'manha', { cpf: '71428793860', celular: '11944443333', nome: 'Kelly Cristina Prado', pix: '11944443333', funcao: 'Auxiliar de cozinha', naLoja: true, distanciaLojaM: 30 }),
    e('env5', 2, 'noite', { nome: 'Cibeli Alves da Costa', pix: '11999990012', funcionarioId: 'p-cibeli-costa', unidadeId: 'burger-va', funcao: 'Auxiliar de cozinha', naLoja: true, distanciaLojaM: 60 }),
  ].filter((x) => x.data >= inicioDaSemana(addDias(hoje(), -7)))
})()

const caixinhas: Record<string, Record<string, number>> = {
  '2026-09': { 'burger-psd': 3616.18, 'burger-va': 1118.34 },
}

// Faltas e advertências reais, da aba Ocorrências da planilha (jun a set/2026).
const ocorrencias: Ocorrencia[] = ([
  ['2026-06-25', 'p-cibeli-costa', 'advertencia'],
  ['2026-06-25', 'p-dora-ramos', 'advertencia'],
  ['2026-06-25', 'p-gilson-silva', 'advertencia'],
  ['2026-06-25', 'p-gilson-silva', 'falta'],
  ['2026-06-25', 'p-joao-costa', 'advertencia'],
  ['2026-06-25', 'p-kaua-silva', 'advertencia'],
  ['2026-06-25', 'p-kaua-silva', 'falta'],
  ['2026-06-25', 'p-laura-costa', 'advertencia'],
  ['2026-06-25', 'p-lucilene-mathias', 'advertencia'],
  ['2026-06-25', 'p-lucilene-mathias', 'falta'],
  ['2026-06-25', 'p-lucilene-mathias', 'falta'],
  ['2026-06-25', 'p-lucilene-mathias', 'falta'],
  ['2026-06-25', 'p-lucilene-mathias', 'falta'],
  ['2026-06-25', 'p-lucilene-mathias', 'falta'],
  ['2026-06-25', 'p-natalia-silva', 'advertencia'],
  ['2026-06-25', 'p-natalia-silva', 'falta'],
  ['2026-06-25', 'p-richard-alexandre', 'advertencia'],
  ['2026-07-03', 'p-cibeli-costa', 'advertencia'],
  ['2026-07-03', 'p-dora-ramos', 'advertencia'],
  ['2026-07-03', 'p-gilson-silva', 'advertencia'],
  ['2026-07-03', 'p-gilson-silva', 'falta'],
  ['2026-07-03', 'p-joao-costa', 'advertencia'],
  ['2026-07-03', 'p-kaua-silva', 'advertencia'],
  ['2026-07-03', 'p-kaua-silva', 'falta'],
  ['2026-07-03', 'p-laura-costa', 'advertencia'],
  ['2026-07-03', 'p-lucilene-mathias', 'advertencia'],
  ['2026-07-03', 'p-lucilene-mathias', 'falta'],
  ['2026-07-03', 'p-lucilene-mathias', 'falta'],
  ['2026-07-03', 'p-lucilene-mathias', 'falta'],
  ['2026-07-03', 'p-lucilene-mathias', 'falta'],
  ['2026-07-03', 'p-lucilene-mathias', 'falta'],
  ['2026-07-03', 'p-natalia-silva', 'advertencia'],
  ['2026-07-03', 'p-natalia-silva', 'falta'],
  ['2026-07-03', 'p-richard-alexandre', 'advertencia'],
  ['2026-07-08', 'p-kaua-silva', 'falta'],
  ['2026-07-09', 'p-joao-costa', 'falta'],
  ['2026-07-09', 'p-kaua-silva', 'advertencia'],
  ['2026-07-12', 'p-richard-alexandre', 'falta'],
  ['2026-07-23', 'p-gilson-silva', 'falta'],
  ['2026-07-23', 'p-gilson-silva', 'falta'],
  ['2026-07-25', 'p-julia-silva', 'falta'],
  ['2026-07-26', 'p-julia-silva', 'falta'],
  ['2026-07-27', 'p-julia-silva', 'falta'],
  ['2026-07-28', 'p-caciano-souza', 'advertencia'],
  ['2026-08-02', 'p-natalia-silva', 'advertencia'],
  ['2026-08-11', 'p-cibeli-costa', 'falta'],
  ['2026-08-13', 'p-larissa-porto', 'falta'],
  ['2026-08-13', 'p-lucas-torres', 'advertencia'],
  ['2026-08-25', 'p-julia-bernardo', 'advertencia'],
  ['2026-09-09', 'p-kaua-silva', 'advertencia'],
  ['2026-09-12', 'p-larissa-porto', 'falta'],
  ['2026-09-13', 'p-gustavo-lima', 'falta'],
  ['2026-09-13', 'p-larissa-porto', 'falta'],
  ['2026-09-18', 'p-larissa-porto', 'advertencia'],
  ['2026-09-18', 'p-laura-costa', 'advertencia'],
  ['2026-09-19', 'p-victor-correa', 'falta'],
  ['2026-09-20', 'p-lucas-torres', 'falta'],
  ['2026-09-20', 'p-victor-correa', 'falta'],
  ['2026-09-21', 'p-lucas-torres', 'falta'],
  ['2026-09-21', 'p-victor-correa', 'falta'],
  ['2026-09-22', 'p-victor-correa', 'advertencia'],
  ['2026-09-22', 'p-victor-correa', 'advertencia'],
] as const).map(([data, fid, tipo], i): Ocorrencia => ({
  id: `oc${i}`, funcionarioId: fid, tipo, data,
  descricao: tipo === 'falta' ? 'Falta (importada da planilha de caixinha).' : 'Advertência (importada da planilha de caixinha).',
  registradoPor: 'p-maria-costa', criadoEm: data + 'T12:00:00Z',
}))

const comunicados: Comunicado[] = [
  { id: 'c1', titulo: 'Bem-vindos ao Portal do Time The Ozzy', corpo: 'A partir de agora, comunicados, folgas e documentos ficam aqui. Atestados devem ser enviados pelo portal no mesmo dia, com foto legível.', unidadeId: null, autorId: 'f1', criadoEm: addDias(hoje(), -2) + 'T12:00:00Z', lidoPor: ['p-maria-costa'] },
  { id: 'c2', titulo: 'Reunião de alinhamento de regras', corpo: 'Gerente e supervisoras: reunião na quinta às 15h para revisar regras e processos. Tragam as dúvidas da equipe.', unidadeId: null, autorId: 'f1', criadoEm: addDias(hoje(), -1) + 'T09:30:00Z', lidoPor: [] },
  { id: 'c3', titulo: 'Limpeza da chapa no fechamento', corpo: 'A partir de hoje a chapa é limpa no fechamento com o produto indicado no POP. A supervisora confere antes de sair.', unidadeId: 'burger-va', autorId: 'p-arlene-santos', criadoEm: addDias(hoje(), -4) + 'T16:00:00Z', lidoPor: ['p-dora-ramos'] },
]

const semana = inicioDaSemana(hoje())
const folgas: Folga[] = [
  ['p-cibeli-costa', 1], ['p-gustavo-lima', 2], ['p-julia-silva', 3], ['p-kaue-oliveira', 0], ['p-larissa-porto', 1],
  ['p-laura-costa', 2], ['p-lucas-torres', 3], ['p-victor-correa', 0], ['p-dora-ramos', 1], ['p-kaua-silva', 2], ['p-queli-souza', 0],
].flatMap(([fid, d], i) =>
  // Mesmo dia de folga por 5 semanas, para o calendário de 30 dias ter o que mostrar.
  [0, 7, 14, 21, 28].map((s): Folga => ({ id: `g${i}-${s}`, funcionarioId: fid as string, data: addDias(semana, (d as number) + s), tipo: 'normal' })),
)
// Folga de feriado (12/10, Nossa Senhora Aparecida) para mostrar a outra cor.
for (const fid of ['p-larissa-porto', 'p-dora-ramos']) folgas.push({ id: 'gf-' + fid, funcionarioId: fid, data: '2026-10-12', tipo: 'feriado' })

// Admissões de exemplo para a aba Férias mostrar períodos (as demais seguem "a confirmar").
const ADMISSOES_DEMO: Record<string, string> = {
  'p-maria-costa': '2023-03-01', 'p-queli-souza': '2024-11-18', 'p-arlene-santos': '2025-03-10', 'p-vanderlei': '2023-08-01',
}
for (const p of funcionarios) if (ADMISSOES_DEMO[p.id]) p.dataAdmissao = ADMISSOES_DEMO[p.id]
// Sexo de exemplo (no portal de verdade a gestão preenche no cadastro).
const MULHERES = ['p-maria-costa', 'p-queli-souza', 'p-arlene-santos', 'p-cibeli-costa', 'p-dora-ramos', 'p-julia-silva', 'p-larissa-porto', 'p-laura-costa', 'p-julia-bernardo', 'p-lucilene-mathias', 'p-natalia-silva']
for (const p of funcionarios) if (p.nivel !== 'proprietario') p.sexo = MULHERES.includes(p.id) ? 'feminino' : 'masculino'
// Datas de nascimento e contratos de experiência de exemplo (aniversários perto de hoje, para a demonstração mostrar).
{
  const ano = Number(hoje().slice(0, 4))
  const nasc = (fid: string, idade: number, deslocamento: number) => {
    const p = funcionarios.find((x) => x.id === fid)
    if (p) p.dataNascimento = `${ano - idade}${addDias(hoje(), deslocamento).slice(4)}`
  }
  nasc('p-cibeli-costa', 24, 0)
  nasc('p-lucas-torres', 31, 2)
  nasc('p-maria-costa', 38, 40)
  // Admitidos há pouco: um no 1º período (vence em 3 dias) e um no 2º.
  const exp = (fid: string, diasAtras: number) => {
    const p = funcionarios.find((x) => x.id === fid)
    if (p) Object.assign(p, { dataAdmissao: addDias(hoje(), -diasAtras), experienciaDias1: 10, experienciaDias2: 80 })
  }
  exp('p-victor-correa', 6)
  exp('p-kaua-silva', 85)
}
const desligamentosDemo: Desligamento[] = []

// Tamanhos de exemplo para os pedidos de uniforme.
{
  const camisetas = ['P', 'M', 'G', 'M', 'GG', 'P', 'M', 'G']
  funcionarios.filter((p) => p.nivel !== 'proprietario').forEach((p, i) => {
    const mulher = p.sexo === 'feminino'
    p.tamCamiseta = camisetas[i % camisetas.length]
    p.tamCalca = String((mulher ? 36 : 40) + (i % 3) * 2)
    p.tamCalcado = (mulher ? 35 : 39) + (i % 4)
  })
}
const solicitacoesDemo: SolicitacaoUniforme[] = [
  { id: 'su1', funcionarioId: 'p-lucas-torres', itens: ['Sapato'], motivo: 'Sapato gasto, a sola está descolando.', foto: null, status: 'aberta', resposta: null, respondidoPor: null, respondidoEm: null, criadoEm: addDias(hoje(), -2) + 'T15:20:00Z' },
  { id: 'su2', funcionarioId: 'p-dora-ramos', itens: ['Camiseta', 'Avental'], motivo: 'Camiseta manchada de óleo e avental rasgado.', foto: null, status: 'aberta', resposta: null, respondidoPor: null, respondidoEm: null, criadoEm: addDias(hoje(), -1) + 'T11:05:00Z' },
  { id: 'su3', funcionarioId: 'p-cibeli-costa', itens: ['Calça'], motivo: 'Calça ficou pequena.', foto: null, status: 'atendida', resposta: 'Entregue calça 40.', respondidoPor: 'p-maria-costa', respondidoEm: addDias(hoje(), -20) + 'T10:00:00Z', criadoEm: addDias(hoje(), -25) + 'T10:00:00Z' },
]
const pedidosUniformeDemo: PedidoUniforme[] = []
const vinculosDemo: VinculoAnterior[] = [
  { id: 'va1', funcionarioId: 'p-dora-ramos', admissao: '2023-02-01', desligamento: '2023-11-20', tipoDesligamento: 'pedido', cargo: 'Atendente', observacao: null },
]
const itensPedidoDemo: ItemPedidoUniforme[] = []
// Contagem de EXEMPLO do estoque de uniformes.
const movUniformeDemo: MovimentoUniforme[] = [
  ...([
    ['Camiseta', 'Preta', 'masculina', 'M', 6], ['Camiseta', 'Preta', 'masculina', 'G', 4], ['Camiseta', 'Preta', 'feminina', 'P', 3], ['Camiseta', 'Preta', 'feminina', 'M', 2],
    ['Camiseta', 'Branca', 'masculina', 'G', 2], ['Camiseta', 'Branca', 'feminina', 'M', 1], ['Calça', null, 'masculina', '40', 3], ['Calça', null, 'masculina', '42', 2],
    ['Calça', null, 'feminina', '38', 2], ['Sapato', null, null, '39', 1], ['Sapato', null, null, '41', 2], ['Avental', null, null, 'Único', 10], ['Boné', null, null, 'Único', 8],
  ] as const).map(([item, cor, modelagem, tamanho, q], i): MovimentoUniforme => ({
    id: `mu${i}`, data: addDias(hoje(), -5), item, cor, modelagem, tamanho, tipo: 'contagem', quantidade: q, referencia: 'manual:demo',
    observacao: 'Contagem inicial', criadoPor: 'f1', criadoEm: haHoras(24 * 5),
  })),
]
// Conta de EXEMPLO (a de verdade a gestão cadastra no portal).
const contasDemo: ContaPagamento[] = [
  {
    id: 'cp1', nome: 'Itaú · Parque São Domingos', banco: '341', empresaCnpj: '34533354000113',
    empresaNome: 'The Ozzy Burger Alimentacao Ltda', agencia: '1234', conta: '567890', dac: '1',
    endereco: 'Rua Brigadeiro Henrique Fontenelle', numero: '601', cidade: 'Sao Paulo', cep: '05125000', estado: 'SP', padrao: true,
  },
]
const remessasDemo: RemessaPagamento[] = []

// Equipamentos e preventiva de EXEMPLO (a lista real o Heitor vai passar e a manutenção preenche no portal).
const equipamentosDemo: Equipamento[] = [
  { id: 'eq1', unidadeId: 'burger-va', nome: 'Liquidificador industrial 1', marcaModelo: 'Skymsen LS-04', numeroSerie: null, local: 'Cozinha', dataCompra: '2024-03-15', valorCompra: 1290, valorAtual: 800, foto: null, observacao: null, ativo: true },
  { id: 'eq2', unidadeId: 'burger-va', nome: 'Liquidificador industrial 2', marcaModelo: 'Skymsen LS-04', numeroSerie: null, local: 'Cozinha', dataCompra: '2025-01-10', valorCompra: 1390, valorAtual: 1000, foto: null, observacao: null, ativo: true },
  { id: 'eq3', unidadeId: 'burger-psd', nome: 'Chapa a gás', marcaModelo: 'Venâncio', numeroSerie: null, local: 'Cozinha', dataCompra: '2022-06-01', valorCompra: 3200, valorAtual: 2000, foto: null, observacao: null, ativo: true },
  { id: 'eq4', unidadeId: 'burger-psd', nome: 'Freezer horizontal', marcaModelo: 'Metalfrio 500 L', numeroSerie: null, local: 'Estoque', dataCompra: '2023-02-20', valorCompra: 4100, valorAtual: 2800, foto: null, observacao: null, ativo: true },
  { id: 'eq5', unidadeId: 'pizza', nome: 'Forno de pizza', marcaModelo: null, numeroSerie: null, local: 'Cozinha', dataCompra: null, valorCompra: null, valorAtual: null, foto: null, observacao: 'Data de compra a confirmar', ativo: true },
]
const manutencoesDemo: ManutencaoEquipamento[] = [
  { id: 'me1', equipamentoId: 'eq1', data: '2025-08-12', tipo: 'corretiva', descricao: 'Troca do acoplamento (copo travando).', prestador: 'Assistência Skymsen', custo: 180, chamadoId: null, registradoPor: 'p-vanderlei' },
  { id: 'me2', equipamentoId: 'eq1', data: addDias(hoje(), -20), tipo: 'corretiva', descricao: 'Motor esquentando: troca das escovas.', prestador: 'Vanderlei', custo: 60, chamadoId: null, registradoPor: 'p-vanderlei' },
  { id: 'me3', equipamentoId: 'eq4', data: addDias(hoje(), -95), tipo: 'preventiva', descricao: 'Limpeza do condensador e troca da borracha da tampa.', prestador: 'Vanderlei', custo: 90, chamadoId: null, registradoPor: 'p-vanderlei' },
]
const preventivasDemo: Preventiva[] = [
  { id: 'pv1', unidadeId: null, equipamentoId: null, titulo: 'Limpeza da coifa e dutos', descricao: 'Exemplo. Desengordurar coifa, filtros e dutos.', frequenciaDias: 90, primeiraEm: '2026-01-01', ativo: true },
  { id: 'pv2', unidadeId: null, equipamentoId: null, titulo: "Limpeza da caixa d'água", descricao: 'Exemplo. Guardar o certificado da empresa.', frequenciaDias: 180, primeiraEm: '2026-01-01', ativo: true },
  { id: 'pv3', unidadeId: null, equipamentoId: null, titulo: 'Limpeza do ar-condicionado', descricao: 'Exemplo. Filtros e bandeja.', frequenciaDias: 30, primeiraEm: '2026-01-01', ativo: true },
  { id: 'pv4', unidadeId: 'burger-psd', equipamentoId: 'eq4', titulo: 'Condensador do freezer', descricao: 'Exemplo. Limpar e conferir a borracha.', frequenciaDias: 90, primeiraEm: '2026-01-01', ativo: true },
]
const execucoesDemo: ExecucaoPreventiva[] = [
  { id: 'ex1', preventivaId: 'pv1', unidadeId: 'burger-psd', feitoEm: addDias(hoje(), -85), observacao: null, feitoPor: 'p-vanderlei' },
  { id: 'ex2', preventivaId: 'pv1', unidadeId: 'burger-va', feitoEm: addDias(hoje(), -100), observacao: null, feitoPor: 'p-vanderlei' },
  { id: 'ex3', preventivaId: 'pv1', unidadeId: 'pizza', feitoEm: addDias(hoje(), -30), observacao: null, feitoPor: 'p-vanderlei' },
  { id: 'ex4', preventivaId: 'pv2', unidadeId: 'burger-psd', feitoEm: addDias(hoje(), -60), observacao: null, feitoPor: 'p-vanderlei' },
  { id: 'ex5', preventivaId: 'pv2', unidadeId: 'burger-va', feitoEm: addDias(hoje(), -60), observacao: null, feitoPor: 'p-vanderlei' },
  { id: 'ex6', preventivaId: 'pv2', unidadeId: 'pizza', feitoEm: addDias(hoje(), -60), observacao: null, feitoPor: 'p-vanderlei' },
  { id: 'ex7', preventivaId: 'pv3', unidadeId: 'burger-psd', feitoEm: addDias(hoje(), -10), observacao: null, feitoPor: 'p-vanderlei' },
  { id: 'ex8', preventivaId: 'pv3', unidadeId: 'burger-va', feitoEm: addDias(hoje(), -27), observacao: null, feitoPor: 'p-vanderlei' },
  { id: 'ex9', preventivaId: 'pv3', unidadeId: 'pizza', feitoEm: addDias(hoje(), -12), observacao: null, feitoPor: 'p-vanderlei' },
  { id: 'ex10', preventivaId: 'pv4', unidadeId: 'burger-psd', feitoEm: addDias(hoje(), -95), observacao: null, feitoPor: 'p-vanderlei' },
]
const feriasDemo: Ferias[] = [
  { id: 'fe1', funcionarioId: 'p-maria-costa', aquisitivoInicio: '2023-03-01', inicio: '2024-07-01', dias: 30, abonoDias: 0, observacao: null },
  { id: 'fe2', funcionarioId: 'p-maria-costa', aquisitivoInicio: '2024-03-01', inicio: '2025-09-01', dias: 20, abonoDias: 10, observacao: 'Vendeu 10 dias' },
  { id: 'fe3', funcionarioId: 'p-arlene-santos', aquisitivoInicio: '2025-03-10', inicio: '2026-07-06', dias: 15, abonoDias: 0, observacao: null },
  { id: 'fe4', funcionarioId: 'p-vanderlei', aquisitivoInicio: '2023-08-01', inicio: '2024-12-02', dias: 30, abonoDias: 0, observacao: null },
  { id: 'fe5', funcionarioId: 'p-vanderlei', aquisitivoInicio: '2024-08-01', inicio: '2026-01-12', dias: 20, abonoDias: 0, observacao: null },
]
const decimoDemo: DecimoTerceiro[] = [
  { id: 'dt1', funcionarioId: 'p-maria-costa', ano: 2026, parcela: 1, valor: 2100, pagoEm: '2026-07-10', observacao: 'Adiantada junto com as férias' },
]

// Salários de exemplo do mês passado, já liberados (valores fictícios).
const SALARIO_CARGO: Record<string, number> = { Auxiliar: 1850, Atendente: 1950, Supervisor: 2500, Gerente: 4200 }
const vazio = (funcionarioId: string, mes: string, tipo: Salario['tipo']): Salario => ({
  funcionarioId, mes, tipo, salario: 0, caixinha: 0, bonusCaixinha: 0, bonusConclui: 0, descAdiantamento: 0, descFaltas: 0, descAtrasos: 0, inss: 0, descVt: 0, outrosCreditos: 0, outrosDescontos: 0, observacao: null, liberado: false,
})
const salariosDemo: Salario[] = (() => {
  const d = new Date(hoje() + 'T12:00:00'); d.setMonth(d.getMonth() - 1)
  const mes = d.toISOString().slice(0, 7)
  return funcionarios
    .filter((p) => p.status === 'ativo' && p.nivel !== 'proprietario')
    .map((p, i) => {
      const salario = SALARIO_CARGO[p.cargo] ?? 1900
      const vt = i % 3 !== 0
      const adiantamento = Math.round(salario * 0.4)
      return [{ ...vazio(p.id, mes, 'adiantamento'), salario: adiantamento, liberado: true }, {
        funcionarioId: p.id, mes, tipo: 'salario' as const, descAdiantamento: adiantamento, salario, caixinha: 380 + (i % 4) * 45, bonusCaixinha: i % 5 === 0 ? 120 : 0, bonusConclui: i % 4 === 0 ? 100 : 0,
        descFaltas: i % 6 === 1 ? Math.round(salario / 30) : 0, descAtrasos: i % 7 === 2 ? 25 : 0,
        inss: Math.round(salario * 0.08 * 100) / 100, descVt: vt ? Math.round(salario * 0.06 * 100) / 100 : 0, outrosCreditos: 0, outrosDescontos: 0, observacao: null, liberado: true,
      }]
    }).flat()
})()
for (const s of salariosDemo.filter((x) => x.tipo === 'salario')) { const p = funcionarios.find((x) => x.id === s.funcionarioId); if (p) p.optaVt = s.descVt > 0 }


// Financeiro e estoque de EXEMPLO (notas, valores e fornecedores inventados), só para a demonstração.
const centrosDemo: CentroCusto[] = [
  { id: 'burger-psd', nome: 'The Ozzy Burger Parque São Domingos', cnpj: '34533354000113', ativo: true },
  { id: 'burger-va', nome: 'The Ozzy Burger Vila Anastácio', cnpj: '34533354000202', ativo: true },
  { id: 'pizza', nome: 'The Ozzy Pizza', cnpj: '61514304000124', ativo: true },
  { id: 'central', nome: 'Central de Produção', cnpj: null, ativo: true },
  { id: 'eventos', nome: 'The Ozzy Eventos', cnpj: null, ativo: true },
]
const PLANO: [string, string, string | null, boolean, number, boolean][] = [
  ['1', 'CMC - Custo de Mercadoria Comprada', null, true, 100, true],
  ['1.1', 'Mercado', '1', true, 101, true],
  ['1.2', 'Hortifruti', '1', true, 102, true],
  ['1.3', 'Proteínas e Ovos', '1', true, 103, true],
  ['1.4', 'Laticínios', '1', true, 104, true],
  ['1.5', 'Bebidas', '1', true, 105, true],
  ['1.6', 'Alcoólicos', '1', true, 106, false],
  ['1.7', 'Produtos para Revenda', '1', true, 107, false],
  ['1.8', 'Embalagens', '1', true, 108, true],
  ['1.9', 'Temperos', '1', true, 109, true],
  ['1.10', 'Pão', '1', true, 110, true],
  ['1.11', 'Doces e Confeitaria', '1', true, 111, true],
  ['1.12', 'Picles', '1', true, 112, true],
  ['1.13', 'Farinhas, Fermentos e Massas', '1', true, 113, true],
  ['1.14', 'Grãos, Cereais e Derivados', '1', true, 114, true],
  ['1.15', 'Molhos e Condimentos', '1', true, 115, true],
  ['1.16', 'Batata-frita', '1', true, 116, true],
  ['1.17', 'Compras Emergenciais', '1', true, 117, true],
  ['1.18', 'Compras Não Registradas', '1', true, 118, true],
  ['2', 'CMO - Custo de Mão de Obra', null, true, 200, true],
  ['2.1', 'Salários Geral', '2', true, 201, true],
  ['2.2', 'INSS', '2', true, 202, true],
  ['2.3', 'Pró-labore', '2', true, 203, true],
  ['2.4', 'Freelancers Cozinha', '2', true, 204, true],
  ['2.5', 'Refeição / Cesta', '2', true, 205, true],
  ['2.6', 'Salários Cozinha', '2', true, 206, true],
  ['2.7', 'Salários Atendimento', '2', true, 207, true],
  ['2.8', 'Salários Produção', '2', true, 208, true],
  ['2.9', 'Salários Adm', '2', true, 209, true],
  ['2.10', 'Freelancers Atendimento', '2', true, 210, true],
  ['2.11', 'Freelancers Produção', '2', true, 211, true],
  ['2.12', 'Freelancers Evento', '2', true, 212, true],
  ['2.13', 'FGTS', '2', true, 213, true],
  ['2.14', 'Rescisão', '2', true, 214, true],
  ['2.15', 'Ações Trabalhistas', '2', true, 215, true],
  ['2.16', 'Custo Admissional', '2', true, 216, true],
  ['2.17', 'Vale-transporte', '2', true, 217, true],
  ['2.18', 'Convênio Médico', '2', true, 218, true],
  ['2.19', 'Bonificações', '2', true, 219, true],
  ['2.20', 'Uniformes', '2', true, 220, true],
  ['3', 'Taxa de Entrega', null, true, 300, true],
  ['3.1', 'Motoboys', '3', true, 301, true],
  ['4', 'Despesas e Utilidades Prediais', null, true, 400, true],
  ['4.1', 'Aluguel', '4', true, 401, true],
  ['4.2', 'Água e Esgoto', '4', true, 402, true],
  ['4.3', 'Energia Elétrica', '4', true, 403, true],
  ['4.4', 'Gás', '4', true, 404, true],
  ['4.5', 'Telefone e Internet', '4', true, 405, true],
  ['4.6', 'IPTU', '4', true, 406, false],
  ['4.7', 'Telefone Fixo', '4', true, 407, false],
  ['4.8', 'Telefone Celular Empresarial', '4', true, 408, false],
  ['4.9', 'Manutenção e Conservação', '4', true, 409, true],
  ['4.10', 'Manutenção Computadores', '4', true, 410, false],
  ['4.11', 'Seguro Predial', '4', true, 411, false],
  ['4.12', 'Serviço de Limpeza', '4', true, 412, false],
  ['4.13', 'Taxa Franquia', '4', true, 413, false],
  ['4.14', 'Investimento Estrutura', '4', true, 414, false],
  ['4.15', 'Reformas', '4', true, 415, true],
  ['4.16', 'Melhorias', '4', true, 416, true],
  ['5', 'Administrativo Geral', null, true, 500, true],
  ['5.1', 'Assessorias', '5', true, 501, false],
  ['5.2', 'Brindes e Confraternizações', '5', true, 502, false],
  ['5.3', 'Transportes', '5', true, 503, true],
  ['5.4', 'Consultoria', '5', true, 504, true],
  ['5.5', 'Contador', '5', true, 505, true],
  ['5.6', 'CRM', '5', true, 506, false],
  ['5.7', 'Entregas APP', '5', true, 507, false],
  ['5.8', 'ERP', '5', true, 508, false],
  ['5.9', 'Estorno Clientes', '5', true, 509, true],
  ['5.10', 'Financeiro', '5', true, 510, false],
  ['5.11', 'Fretes', '5', true, 511, false],
  ['5.12', 'Gestão de Entregas', '5', true, 512, false],
  ['5.13', 'Gestão de Equipe', '5', true, 513, false],
  ['5.14', 'IA', '5', true, 514, false],
  ['5.15', 'Jurídico', '5', true, 515, true],
  ['5.16', 'Material Gráfico, Divulgação e Marketing', '5', true, 516, true],
  ['5.17', 'PDV', '5', true, 517, false],
  ['5.18', 'Publicidade', '5', true, 518, false],
  ['5.19', 'Sistema', '5', true, 519, true],
  ['5.20', 'Segurança', '5', true, 520, true],
  ['5.21', 'Impostos', '5', true, 521, true],
  ['5.22', 'Taxas Bancárias', '5', true, 522, true],
  ['5.23', 'Manutenção e Conservação', '5', true, 523, false],
  ['5.24', 'Nutricionista', '5', true, 524, true],
  ['5.25', 'Taxas Amex', '5', true, 525, true],
  ['5.26', 'Associações e Entidades de Classe', '5', true, 526, true],
  ['5.27', 'Adesivos', '5', true, 527, true],
  ['6', 'Material de Consumo', null, true, 600, true],
  ['6.1', 'Produtos de Limpeza', '6', true, 601, true],
  ['6.2', 'Material de Escritório', '6', true, 602, true],
  ['6.3', 'Utensílios e Descartáveis', '6', true, 603, true],
  ['6.4', 'Compra de Equipamentos e Utensílios', '6', true, 604, true],
  ['7', 'Juros', null, true, 700, true],
  ['8', 'Multas', null, true, 800, true],
  ['9', 'Empréstimos e Financiamentos', null, false, 900, true],
  ['9.1', 'Dívidas e Empréstimos', '9', false, 901, true],
  ['9.2', 'Financiamentos', '9', false, 902, true],
  ['9.3', 'Empréstimo LJ-1 Ozzy Burger', '9', false, 903, true],
  ['9.4', 'Empréstimo LJ-2 Ozzy Burger', '9', false, 904, true],
  ['10', 'Investimentos (Capex)', null, false, 1000, true],
  ['10.1', 'Instalações Gerais', '10', false, 1001, true],
  ['10.2', 'Equipamentos de Cozinha', '10', false, 1002, true],
  ['10.3', 'Mobiliário', '10', false, 1003, true],
  ['10.4', 'Outros Equipamentos', '10', false, 1004, true],
  ['10.5', 'Mão de Obra (implantação/obra)', '10', false, 1005, true],
  ['11', 'Distribuição de Resultados', null, false, 1100, true],
  ['11.1', 'Distribuição de Lucros', '11', false, 1101, true],
  ['11.2', 'Retirada de Sócios (pró-labore ou extra)', '11', false, 1102, true],
  ['11.3', 'Antecipação de Lucros', '11', false, 1103, true],
]
const planoDemo: ContaContabil[] = PLANO.map(([codigo, nome, paiCodigo, operacional, ordem, ativo]) => ({ id: 'pc' + codigo, codigo, nome, paiCodigo, operacional, ordem, ativo }))
fornecedoresDemo[0].cnpj = '11222333000181'
const mesAtual = () => hoje().slice(0, 8) + '01'
const itemNota = (id: string, ordem: number, codigo: string, descricao: string, unidade: string, quantidade: number, valorUnit: number, extra: Partial<ItemNota> = {}): ItemNota => ({
  id, ordem, codigo, ean: null, descricao, ncm: null, cfop: '5102', unidade, quantidade, valorUnit, valorTotal: Math.round(quantidade * valorUnit * 100) / 100,
  insumoId: null, fator: null, foraEstoque: false, ...extra,
})
const notaDemo = (id: string, numero: string, diasAtras: number, itens: ItemNota[], extra: Partial<NotaFiscal> = {}): NotaFiscal => {
  const total = Math.round(itens.reduce((s, i) => s + i.valorTotal, 0) * 100) / 100
  return {
    id, chave: null, numero, serie: '1', emissao: addDias(hoje(), -diasAtras), fornecedorId: 'fo1', emitenteCnpj: '11222333000181', emitenteNome: 'Distribuidora Exemplo Ltda',
    destinatarioCnpj: '34533354000113', centroCustoId: 'burger-psd', valorProdutos: total, frete: 0, desconto: 0, valorTotal: total, pagamentoXml: [{ tPag: '15', valor: total }],
    duplicatas: [], arquivo: null, observacao: null, status: 'conferir', lancadaEm: null, criadoEm: haHoras(24 * diasAtras), itens, ...extra,
  }
}
const notasDemo: NotaFiscal[] = [
  notaDemo('nf1', '10234', 1, [
    itemNota('ni1', 1, 'A100', 'QUEIJO BRANCO PECA KG', 'KG', 6, 41.5, { insumoId: 'in3', fator: 1 }),
    itemNota('ni2', 2, 'A200', 'CREME DE LEITE 1KG CX C/12', 'CX', 2, 210),
    itemNota('ni3', 3, 'A300', 'REFRIGERANTE LATA 350ML FD C/12', 'FD', 4, 37.2),
    itemNota('ni4', 4, 'L900', 'DETERGENTE 5L', 'UN', 2, 19.9, { foraEstoque: true }),
  ], { duplicatas: [] }),
  notaDemo('nf2', '10198', 9, [
    itemNota('ni5', 1, 'A100', 'QUEIJO BRANCO PECA KG', 'KG', 5, 40, { insumoId: 'in3', fator: 1 }),
    itemNota('ni6', 2, 'A400', 'PRESUNTO CRU KG', 'KG', 2, 148, { insumoId: 'in2', fator: 1 }),
  ], { status: 'lancada', lancadaEm: haHoras(24 * 8) }),
]
notasDemo[0].duplicatas = [
  { numero: '001', vencimento: addDias(hoje(), 13), valor: Math.round(notasDemo[0].valorTotal / 2 * 100) / 100 },
  { numero: '002', vencimento: addDias(hoje(), 27), valor: Math.round((notasDemo[0].valorTotal - Math.round(notasDemo[0].valorTotal / 2 * 100) / 100) * 100) / 100 },
]
const contaDemo = (id: string, extra: Partial<ContaPagar> & Pick<ContaPagar, 'descricao' | 'vencimento' | 'valor'>): ContaPagar => ({
  id, centroCustoId: 'burger-psd', contaId: null, fornecedorId: null, favorecido: null, competencia: mesAtual(), forma: 'boleto', parcela: null, parcelas: null,
  documento: null, notaId: null, observacao: null, pagoEm: null, valorPago: null, conciliado: false, recorrenteId: null, origem: null, lote: null,
  extratoMovimentoId: null, ...extra,
  // Cartão: tudo que vence no mesmo dia é a mesma fatura (igual ao gatilho do banco).
  ...((extra.forma === 'cartao_credito') ? { lote: 'cartao:' + extra.vencimento } : {}),
})
const contasPagarDemo: ContaPagar[] = [
  contaDemo('cp1', { descricao: 'NF 10198 · Distribuidora Exemplo', vencimento: addDias(hoje(), 5), valor: 251, contaId: 'pc1.1', fornecedorId: 'fo1', notaId: 'nf2', parcela: 1, parcelas: 2 }),
  contaDemo('cp2', { descricao: 'NF 10198 · Distribuidora Exemplo', vencimento: addDias(hoje(), 19), valor: 245, contaId: 'pc1.1', fornecedorId: 'fo1', notaId: 'nf2', parcela: 2, parcelas: 2 }),
  contaDemo('cp3', { descricao: 'Aluguel do mês (exemplo)', vencimento: addDias(hoje(), -2), valor: 9500, contaId: 'pc4.1', favorecido: 'Imobiliária Exemplo', forma: 'pix' }),
  contaDemo('cp4', { descricao: 'Energia elétrica (exemplo)', vencimento: hoje(), valor: 2380.4, contaId: 'pc4.3', favorecido: 'Distribuidora de energia', forma: 'debito_automatico', centroCustoId: 'burger-va' }),
  contaDemo('cp5', { descricao: 'Internet (exemplo)', vencimento: addDias(hoje(), -6), valor: 199.9, contaId: 'pc4.5', favorecido: 'Provedor Exemplo', pagoEm: addDias(hoje(), -6), valorPago: 199.9 }),
  contaDemo('cp6', { descricao: 'Hortifruti da semana (exemplo)', vencimento: addDias(hoje(), 2), valor: 640, contaId: 'pc1.2', fornecedorId: 'fo2', forma: 'pix', centroCustoId: 'pizza' }),
  contaDemo('cp7', { descricao: 'Contabilidade (exemplo)', vencimento: addDias(hoje(), 11), valor: 1800, contaId: 'pc5.5', favorecido: 'Escritório contábil exemplo', centroCustoId: 'central' }),
  contaDemo('cp8', { descricao: 'Freezer (exemplo, parcela)', vencimento: addDias(hoje(), -3), valor: 174.9, contaId: 'pc6.4', favorecido: 'Loja de exemplo', forma: 'cartao_credito', centroCustoId: 'central' }),
  contaDemo('cp9', { descricao: 'Sistema de cardápio (exemplo)', vencimento: addDias(hoje(), -3), valor: 224.93, contaId: 'pc5.19', favorecido: 'Sistema exemplo', forma: 'cartao_credito', centroCustoId: 'burger-psd' }),
  contaDemo('cp10', { descricao: 'Adiantamento · Pessoa A (exemplo)', vencimento: addDias(hoje(), -1), valor: 800, contaId: 'pc2.6', favorecido: 'Pessoa A', forma: 'pix', origem: 'sal:a', lote: 'sal:exemplo:adiantamento', observacao: 'Lançada pelo DP (salários liberados)' }),
  contaDemo('cp11', { descricao: 'Adiantamento · Pessoa B (exemplo)', vencimento: addDias(hoje(), -1), valor: 750, contaId: 'pc2.7', favorecido: 'Pessoa B', forma: 'pix', origem: 'sal:b', lote: 'sal:exemplo:adiantamento', observacao: 'Lançada pelo DP (salários liberados)' }),
]
const recorrentesDemo: ContaRecorrente[] = [
  { id: 'rc1', descricao: 'Aluguel da loja (exemplo)', fornecedorId: null, fornecedorNome: 'IMOBILIARIA EXEMPLO', centroCustoId: 'burger-psd', contaId: 'pc4.1', valor: 3600, variavel: false, dia: 5, forma: 'pix', inicio: mesAtual().slice(0, 7), fim: null, situacao: 'ativa', observacao: null },
  { id: 'rc2', descricao: 'Plataforma de checklist (exemplo)', fornecedorId: null, fornecedorNome: 'SISTEMA EXEMPLO', centroCustoId: 'central', contaId: 'pc5.19', valor: 583.33, variavel: false, dia: 15, forma: 'cartao_credito', inicio: mesAtual().slice(0, 7), fim: null, situacao: 'a_confirmar', observacao: 'Se for parcelado, diga em que mês termina.' },
  { id: 'rc3', descricao: 'Energia (exemplo)', fornecedorId: null, fornecedorNome: 'DISTRIBUIDORA DE ENERGIA', centroCustoId: 'central', contaId: 'pc4.3', valor: 2800, variavel: true, dia: 23, forma: 'boleto', inicio: mesAtual().slice(0, 7), fim: null, situacao: 'a_confirmar', observacao: 'Valor muda; média jul–set 2.831,52' },
  { id: 'rc4', descricao: 'Nutricionista (exemplo)', fornecedorId: null, fornecedorNome: 'NUTRI EXEMPLO', centroCustoId: 'burger-psd', contaId: 'pc5.24', valor: 420, variavel: false, dia: 10, forma: 'boleto', inicio: mesAtual().slice(0, 7), fim: null, situacao: 'a_confirmar', observacao: null },
]
const producoesDemo: Producao[] = []
// Pedidos de compra de exemplo: semana atual (compra na segunda) e uma embalagem que chega depois.
const segDemo = inicioDaSemana(hoje())
const pedidosCompraDemo: PedidoCompra[] = [
  { id: 'pc1', numero: 1, fornecedorId: 'fo2', centroCustoId: 'central', categoria: 'insumos', status: 'pedido', dataPedido: segDemo, previsaoEntrega: addDias(segDemo, 1),
    itens: [{ insumoId: 'in6', quantidade: 10, unidade: 'kg', preco: 9 }, { insumoId: 'in10', quantidade: 2, unidade: 'kg', preco: 12 }, { insumoId: 'in15', quantidade: 30, unidade: 'un', preco: 4 }],
    total: 234, formaPagamento: 'Boleto 7 dias', observacao: null, recebidoEm: null, criadoEm: segDemo + 'T10:00:00Z', criadoPor: 'f1' },
  { id: 'pc2', numero: 2, fornecedorId: 'fo1', centroCustoId: 'central', categoria: 'insumos', status: 'pedido', dataPedido: segDemo, previsaoEntrega: addDias(segDemo, 3),
    itens: [{ insumoId: 'in3', quantidade: 5, unidade: 'kg', preco: 41 }, { insumoId: 'in9', quantidade: 18, unidade: 'l', preco: 8 }],
    total: 349, formaPagamento: null, observacao: 'Entregar até 11h', recebidoEm: null, criadoEm: segDemo + 'T10:20:00Z', criadoPor: 'f1' },
  { id: 'pc3', numero: 3, fornecedorId: 'fo3', centroCustoId: 'central', categoria: 'embalagens', status: 'pedido', dataPedido: segDemo, previsaoEntrega: addDias(segDemo, 15),
    itens: [{ insumoId: 'in21', quantidade: 20, unidade: 'pct', preco: 30 }], total: 600, formaPagamento: null, observacao: null, recebidoEm: null, criadoEm: segDemo + 'T11:00:00Z', criadoPor: 'f1' },
]
// Histórico de compras de EXEMPLO (no real vem da Eclética): compras semanais nas últimas 12 semanas.
const historicoComprasDemo: { fornecedorId: string; insumoId: string; dia: string; quantidade: number; preco: number }[] = Array.from({ length: 12 }, (_, k) => addDias(segDemo, -7 * (k + 1))).flatMap((dia, k) => [
  { fornecedorId: 'fo2', insumoId: 'in6', dia, quantidade: 8 + (k % 3) * 2, preco: 8.5 },
  { fornecedorId: 'fo2', insumoId: 'in10', dia, quantidade: 2, preco: 11 },
  { fornecedorId: 'fo2', insumoId: 'in15', dia, quantidade: 24 + (k % 2) * 12, preco: 3.8 },
  ...(k % 2 ? [] : [{ fornecedorId: 'fo2', insumoId: 'in11', dia, quantidade: 3, preco: 28 }, { fornecedorId: 'fo2', insumoId: 'in5', dia, quantidade: 2, preco: 19 }]),
  { fornecedorId: 'fo1', insumoId: 'in17', dia, quantidade: 10 + (k % 2) * 4, preco: 37 },
  { fornecedorId: 'fo1', insumoId: 'in19', dia, quantidade: 120, preco: 3.1 },
  ...(k % 3 ? [] : [{ fornecedorId: 'fo1', insumoId: 'in9', dia, quantidade: 36, preco: 7.9 }]),
  ...(k % 4 ? [] : [{ fornecedorId: 'fo3', insumoId: 'in21', dia, quantidade: 20, preco: 29 }]),
])
// Cardápio de EXEMPLO (no real vem da Eclética).
const pv = (id: string, codigo: string, nome: string, grupo: string, subgrupo: string, preco: number | null, precoPizza: number | null, tipo: ProdutoVenda['tipo'] = 'normal'): ProdutoVenda => ({
  id, ecleticaCodigo: codigo, nome, grupo, subgrupo, tipo, unidade: 'un', preco, precoPizza, receitaId: null, ativo: true,
})
const produtosVendaDemo: ProdutoVenda[] = [
  { ...pv('pv1', '10', 'BURGER CLÁSSICO (EXEMPLO)', 'Lanches', 'BURGERS', 39.9, null), receitaId: 're9' },
  { ...pv('pv2', '11', 'BURGER BACON (EXEMPLO)', 'Lanches', 'BURGERS', 44.9, null), receitaId: 're8' },
  pv('pv3', '20', 'BATATA FRITA (EXEMPLO)', 'Acompanhamentos', 'ACOMPANHAMENTOS', 19.9, null),
  pv('pv4', '30', 'PIZZA MARGHERITA GRANDE (EXEMPLO)', 'Pizzas', 'PIZZAS GRANDES', null, 69.9),
  pv('pv5', '31', 'PIZZA CALABRESA BROTO (EXEMPLO)', 'Pizzas', 'PIZZAS BROTO', null, 39.9),
  pv('pv6', '88', 'COCA COLA 350ML LATA', 'Bebidas', 'REFRIGERANTES', 7, 7),
  pv('pv7', '2', 'EXTRA MOLHO ESPECIAL', 'Acompanhamentos', 'ADICIONAIS', 4.5, null),
  pv('pv8', '40', 'COMBO CLÁSSICO (EXEMPLO)', 'Outros', 'COMBOS', 54.9, null),
  pv('pv9', '41', 'QUAL O PONTO DA CARNE?', 'Outros', 'PERGUNTAS', 0, null, 'vinculo'),
]
// Ideal de segunda a domingo (exemplo).
const listaFechDemo: ItemListaFechamento[] = (['burger-psd', 'burger-va'] as const).flatMap((u, k) => ([
  ['cozinha', 'in15', 'Uni', [8, 8, 8, 10, 12, 12, 10]],
  ['cozinha', 'in16', 'Kg', [20, 20, 25, 30, 45, 45, 35]],
  ['cozinha', 'in17', 'Kg', [3, 3, 3, 4, 6, 6, 5]],
  ['cozinha', 'in14', 'Kg', [1, 1, 1, 1.5, 2, 2, 1.5]],
  ['cozinha', 'in12', 'Kg', [1.5, 1.5, 1.5, 2, 3, 3, 2]],
  ['cozinha', 'in13', 'Kg', [2, 2, 2, 3, 4, 4, 3]],
  ['cozinha', 'in18', 'Uni', [24, 24, 24, 36, 48, 48, 36]],
  ['cozinha', 'in22', 'GL', [2, 2, 2, 2, 2, 2, 2]],
  ['atendimento', 'in19', 'Uni', [48, 48, 48, 72, 96, 96, 72]],
  ['atendimento', 'in20', 'Uni', [300, 300, 300, 300, 500, 500, 400]],
  ['atendimento', 'in21', 'Pct', [null, null, null, null, null, null, null]],
] as const).map(([setor, insumoId, un, ideal], j): ItemListaFechamento => ({
  id: `fi${k}${j}`, unidadeId: u, setor, insumoId, nome: '', unidadeContagem: un, ordem: j + 1, ideal: ideal.map((x) => (x === null ? null : k ? x * 0.8 : x)), prePreparo: false, ativo: true,
})))
const fechamentosDemo: Fechamento[] = [{
  id: 'fc1', unidadeId: 'burger-va', setor: 'cozinha', data: addDias(hoje(), -1), para: hoje(), responsavel: 'Ana (exemplo)', observacao: null, fala: null, enviadoEm: haHoras(12), enviadoPor: null,
}]
const contagensFechDemo: { fechamentoId: string; itemId: string; contagem: number | null; sugestao: number | null; pedido: number | null }[] = [
  { fechamentoId: 'fc1', itemId: 'fi13', contagem: 1, sugestao: 3, pedido: 3 },
  { fechamentoId: 'fc1', itemId: 'fi14', contagem: 0.5, sugestao: 1.5, pedido: 2 },
  { fechamentoId: 'fc1', itemId: 'fi10', contagem: 2, sugestao: 6, pedido: 6 },
]
const invLojasDemo: InventarioEstoque[] = []
const movsInventarioDemo = new Map<string, string[]>()
const movimentosDemo: MovimentoEstoque[] = [
  { id: 'mv1', centroCustoId: 'burger-psd', insumoId: 'in3', data: addDias(hoje(), -9), tipo: 'entrada_nf', quantidade: 5, custoUnit: 40, notaItemId: 'ni5', observacao: 'NF 10198 · Distribuidora Exemplo', criadoEm: haHoras(24 * 8) },
  { id: 'mv2', centroCustoId: 'burger-psd', insumoId: 'in2', data: addDias(hoje(), -9), tipo: 'entrada_nf', quantidade: 2, custoUnit: 148, notaItemId: 'ni6', observacao: 'NF 10198 · Distribuidora Exemplo', criadoEm: haHoras(24 * 8) },
  { id: 'mv3', centroCustoId: 'burger-psd', insumoId: 'in3', data: addDias(hoje(), -3), tipo: 'saida', quantidade: -1.5, custoUnit: null, notaItemId: null, observacao: 'Uso na produção (exemplo)', criadoEm: haHoras(24 * 3) },
]
const mapaFornecedorDemo = new Map<string, { insumoId: string | null; fator: number | null; foraEstoque: boolean }>([
  ['11222333000181|A100', { insumoId: 'in3', fator: 1, foraEstoque: false }],
  ['11222333000181|L900', { insumoId: null, fator: null, foraEstoque: true }],
])


// Extrato bancário de EXEMPLO (valores e nomes inventados).
const movExtrato = (id: string, diasAtras: number, valor: number, descricao: string, extra: Partial<MovimentoExtrato> = {}): MovimentoExtrato => ({
  id, banco: '341', agencia: '0000', conta: '00000-0', fitid: id, data: addDias(hoje(), -diasAtras), valor, descricao, documento: null, tipo: valor < 0 ? 'DEBIT' : 'CREDIT',
  status: 'pendente', contaPagarId: null, observacao: null, importadoEm: haHoras(2), ...extra,
})
const extratoDemo: MovimentoExtrato[] = [
  movExtrato('ex1', 1, -9500, 'PIX ENVIADO IMOBILIARIA EXEMPLO'),
  movExtrato('ex2', 6, -199.9, 'DA PROVEDOR EXEMPLO INTERNET'),
  movExtrato('ex3', 2, -312.45, 'PIX ENVIADO MERCADO EXEMPLO 0710'),
  movExtrato('ex4', 3, -89.9, 'TAR PACOTE SERVICOS 10/2026'),
  movExtrato('ex5', 4, -5000, 'TED MESMA TITULARIDADE'),
  movExtrato('ex6', 2, 4500, 'REDE CARTAO CREDITO'),
  movExtrato('ex7', 5, 7800, 'IFOOD REPASSE'),
  movExtrato('ex8', 3, -405.83, 'FATURA CARTAO ITAU'),
  movExtrato('ex9', 1, -1550, 'SISPAG PIX LOTE 000123'),
  movExtrato('ex10', 1, -415, 'PIX ENVIADO RENAN EXEMPLO DIAS'),
  movExtrato('ex11', 2, -180, 'PIX ENVIADO CIBELI ALVES'),
  movExtrato('ex12', 0, -234, 'PIX ENVIADO HORTIFRUTI EXEMPLO LTDA'),
]
const regrasExtratoDemo: RegraExtrato[] = [{ chave: 'tar pacote servicos', centroCustoId: 'burger-psd', contaId: 'pc5.22', favorecido: 'Itaú', ignorar: false }]
const saldosExtratoDemo: SaldoExtrato[] = [{ banco: '341', agencia: '0000', conta: '00000-0', data: addDias(hoje(), -1), saldo: 18432.1 }]

const diaDoMesDemo = (mes: string, dia: number) => {
  const [a, m] = mes.split('-').map(Number)
  return `${mes}-${String(Math.min(dia, new Date(Date.UTC(a, m, 0)).getUTCDate())).padStart(2, '0')}`
}
const espera = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 80))

export function criarDemoStore(): Store & { entrarComo(id: string): Promise<Funcionario>; perfisDemo(): Funcionario[] } {
  let eu: Funcionario | null = null
  const exigeEu = () => {
    if (!eu) throw new Error('Sessão expirada')
    return eu
  }
  const exigeGestao = () => {
    const u = exigeEu()
    if (!podeGerenciar(u.nivel)) throw new Error('Seu nível de acesso não permite esta ação.')
    return u
  }  // A produção (setor Produção) lança o que preparou: vê fichas, insumos e produções (0069).
  const exigeCozinha = () => {
    const u = exigeEu()
    if (!(podeGerenciar(u.nivel) || u.nivel === 'manutencao')) throw new Error('Seu nível de acesso não permite esta ação.')
    return u
  }
  const exigeGestaoOuProducao = () => {
    const u = exigeEu()
    if (!(podeGerenciar(u.nivel) || u.setor === 'producao')) throw new Error('Seu nível de acesso não permite esta ação.')
    return u
  }

  const exigeFinanceiro = () => {
    const u = exigeEu()
    if (!vejoResultado(u.nivel)) throw new Error('Só o administrativo e o proprietário veem as contas a pagar.')
    return u
  }
  const exigePainel = () => {
    const u = exigeEu()
    if (!podeVerPainel(u.nivel)) throw new Error('Seu nível de acesso não permite ver o painel.')
    return u
  }
  const porId = (id: string) => funcionarios.find((x) => x.id === id)!
  const exigeManutencao = () => {
    const u = exigeEu()
    if (!atendeChamados(u.nivel)) throw new Error('Só a manutenção e a gestão.')
    return u
  }
  const tira = <T extends { id: string }>(lista: T[], id: string) => {
    const i = lista.findIndex((x) => x.id === id)
    if (i >= 0) lista.splice(i, 1)
  }

  const gravarEnvios = (
    dias: { data: string; turno: 'manha' | 'noite'; observacao?: string }[],
    base: Omit<EnvioFreela, 'id' | 'data' | 'turno' | 'observacao' | 'status' | 'motivo' | 'enviadoEm' | 'naLoja' | 'distanciaLojaM'>,
    local: LocalEnvio | null,
  ) => {
    const loja = locais[base.unidadeId]
    const distancia = local && loja ? Math.round(distanciaM(local.lat, local.lng, loja.latitude, loja.longitude)) : null
    if (!dias.length) throw new Error('Escolha pelo menos um dia.')
    if (!base.funcao.trim()) throw new Error('Diga a função que você fez.')
    if (!base.pix.trim()) throw new Error('Coloque a chave Pix.')
    if (dias.some((d) => d.data > hoje() || d.data < addDias(hoje(), -13))) throw new Error('Só dá para mandar diárias dos últimos 14 dias.')
    let n = 0
    for (const d of dias) {
      const quem = base.funcionarioId ?? base.cpf
      if (envios.some((x) => x.status !== 'recusado' && (x.funcionarioId ?? x.cpf) === quem && x.data === d.data && x.turno === d.turno)) continue
      envios.push({ ...base, id: novoId('env'), data: d.data, turno: d.turno, observacao: d.observacao?.trim() || null, status: 'pendente', motivo: null, enviadoEm: agora(),
        distanciaLojaM: distancia, naLoja: d.data === hoje() && distancia !== null && distancia - Math.min(local?.precisao ?? 0, 100) <= 150 })
      n++
    }
    return espera(n)
  }

  return {
    modo: 'demo',
    perfisDemo: () => funcionarios.filter((x) => x.status === 'ativo'),
    async entrarComo(id) {
      eu = porId(id)
      return espera(eu)
    },
    sessaoAtual: () => espera(eu),
    async entrar(celular, senha) {
      const alvo = funcionarios.find((x) => x.celular === soDigitos(celular) && x.status === 'ativo')
      if (!alvo || senha !== SENHA_DEMO) throw new Error('Celular ou senha incorretos.')
      eu = alvo
      return espera(eu)
    },
    async sair() {
      eu = null
    },
    async trocarSenha(atual) {
      exigeEu()
      if (atual !== SENHA_DEMO) throw new Error('A senha atual não confere.')
      // Na demonstração a senha continua a mesma para todos.
      return espera(undefined)
    },
    unidades: () => espera(unidades),
    nomes: () => espera(funcionarios.map(({ id, nome }) => ({ id, nome }))),
    async funcionarios() {
      const u = exigeEu()
      return espera(funcionarios.filter((x) => podeVerFuncionario(u, x)))
    },
    async salvarFuncionario(dados) {
      const u = exigeGestao()
      if (dados.nome !== undefined) dados = { ...dados, nome: nomeProprio(dados.nome) }
      const alvo = dados.id ? porId(dados.id) : null
      if ((alvo && !possoAlterar(u, alvo)) || degrau(dados.nivel) > degrau(u.nivel)) throw new Error('Você não pode alterar quem está acima de você')
      if (dados.id) {
        const i = funcionarios.findIndex((x) => x.id === dados.id)
        funcionarios[i] = { ...funcionarios[i], ...dados, id: dados.id }
        return espera(funcionarios[i])
      }
      const novo = { ...dados, id: novoId('f') } as Funcionario
      funcionarios.push(novo)
      return espera(novo)
    },
    async documentos(fid) {
      const u = exigeEu()
      if (!podeVerDocumentosDe(u, porId(fid))) return espera([])
      return espera(documentos.filter((d) => d.funcionarioId === fid).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)))
    },
    async enviarDocumento(d) {
      const u = exigeEu()
      if (u.id !== d.funcionarioId && !podeGerenciar(u.nivel)) throw new Error('Você só pode enviar os seus documentos.')
      const doc: Documento = {
        id: novoId('d'), funcionarioId: d.funcionarioId, tipo: d.tipo, nomeArquivo: d.arquivo.name,
        observacao: d.observacao || null, inicio: d.inicio || null, fim: d.fim || null,
        realizadoEm: d.realizadoEm || null, vence: d.vence || null, enviadoPor: u.id, criadoEm: agora(),
      }
      arquivosDemo.set(doc.id, URL.createObjectURL(d.arquivo))
      documentos.push(doc)
      return espera(doc)
    },
    async abrirDocumento(d) {
      return arquivosDemo.get(d.id) ?? null
    },
    async documentosTodos() {
      const u = exigeEu()
      return espera(documentos.filter((d) => podeVerDocumentosDe(u, porId(d.funcionarioId))))
    },
    async uniformes(fid) {
      const u = exigeEu()
      if (!podeVerFuncionario(u, porId(fid))) return espera([])
      return espera(uniformes.filter((x) => x.funcionarioId === fid).sort((a, b) => b.data.localeCompare(a.data)))
    },
    async registrarUniforme(e) {
      const u = exigeGestao()
      const nova: EntregaUniforme = {
        id: novoId('u'), funcionarioId: e.funcionarioId, data: e.data, itens: e.itens, observacao: e.observacao || null,
        entreguePor: u.id, criadoEm: agora(),
        assinatura: e.assinatura ?? null, assinadoEm: e.assinatura ? agora() : null, assinadoVia: e.assinatura ? 'presencial' : null,
      }
      uniformes.push(nova)
      return espera(nova)
    },
    async assinarUniforme(id, assinatura) {
      const u = exigeEu()
      const x = uniformes.find((y) => y.id === id)
      if (!x || x.funcionarioId !== u.id) throw new Error('Só a própria pessoa pode assinar este termo.')
      if (x.assinatura) throw new Error('Este termo já foi assinado.')
      Object.assign(x, { assinatura, assinadoEm: agora(), assinadoVia: 'portal' })
    },
    async valoresUniforme() {
      exigeEu()
      return espera({ ...valoresUniforme })
    },
    async salvarValoresUniforme(valores) {
      exigeGestao()
      for (const [item, v] of Object.entries(valores)) if (v === null) delete valoresUniforme[item]; else valoresUniforme[item] = v
    },
    async devolucoesUniforme(fid) {
      const u = exigeEu()
      if (fid !== u.id && !podeGerenciar(u.nivel)) return espera([])
      return espera(devolucoes.filter((d) => d.funcionarioId === fid).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)))
    },
    async registrarDevolucao(d) {
      const u = exigeGestao()
      const total = d.itens.reduce((t, i) => t + Math.max(0, i.entregue - i.devolvido) * i.valor, 0)
      const nova: DevolucaoUniforme = {
        id: novoId('dv'), funcionarioId: d.funcionarioId, data: d.data, itens: d.itens, totalDesconto: Math.round(total * 100) / 100,
        observacao: d.observacao?.trim() || null, conferidoPor: u.id, criadoEm: agora(),
      }
      devolucoes.push(nova)
      return espera(nova)
    },
    async excluirDevolucao(id) {
      exigeGestao()
      const i = devolucoes.findIndex((d) => d.id === id)
      if (i >= 0) devolucoes.splice(i, 1)
    },
    async ajustesPonto(filtro) {
      const u = exigeEu()
      const lista = filtro === 'meus' ? ajustesPonto.filter((a) => a.funcionarioId === u.id) : podeGerenciar(u.nivel) ? ajustesPonto.filter((a) => filtro === 'todos' || a.status === 'pendente') : []
      return espera([...lista].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)))
    },
    async pedirAjustePonto(a) {
      const u = exigeEu()
      if (a.data > hoje()) throw new Error('A data não pode ser no futuro.')
      ajustesPonto.push({ id: novoId('aj'), funcionarioId: u.id, data: a.data, tipo: a.tipo, horario: a.horario || null, motivo: a.motivo.trim() || null, status: 'pendente', resposta: null, criadoEm: agora(), resolvidoPor: null, resolvidoEm: null })
    },
    async resolverAjustePonto(id, status, resposta) {
      const u = exigeGestao()
      const a = ajustesPonto.find((x) => x.id === id)
      if (a) Object.assign(a, { status, resposta: resposta.trim() || null, resolvidoPor: u.id, resolvidoEm: agora() })
    },
    async excluirAjustePonto(id) {
      const u = exigeEu()
      const i = ajustesPonto.findIndex((x) => x.id === id && x.funcionarioId === u.id && x.status === 'pendente')
      if (i >= 0) ajustesPonto.splice(i, 1)
    },
    async ocorrencias(fid) {
      const u = exigeEu()
      if (!podeVerFuncionario(u, porId(fid))) return espera([])
      return espera(ocorrencias.filter((o) => o.funcionarioId === fid).sort((a, b) => b.data.localeCompare(a.data)))
    },
    async ocorrenciasEntre(inicio, fim) {
      const u = exigeEu()
      return espera(ocorrencias.filter((o) => o.data >= inicio && o.data <= fim && podeVerFuncionario(u, porId(o.funcionarioId))))
    },
    async atestadosEntre(inicio, fim) {
      const u = exigeEu()
      return espera(
        documentos.filter((d) => {
          const dia = d.inicio ?? d.criadoEm.slice(0, 10)
          return d.tipo === 'atestado' && dia >= inicio && dia <= fim && podeVerDocumentosDe(u, porId(d.funcionarioId))
        }),
      )
    },
    async registrarOcorrencia(o) {
      const u = exigeGestao()
      const nova = { ...o, id: novoId('o'), registradoPor: u.id, criadoEm: agora() }
      ocorrencias.push(nova)
      return espera(nova)
    },
    async comunicados() {
      const u = exigeEu()
      const visiveis = comunicados.filter((c) =>
        podeGerenciar(u.nivel) || c.autorId === u.id ||
        (c.destinatarios?.length
          ? c.destinatarios.includes(u.id)
          : (c.unidadeId === null || c.unidadeId === u.unidadeId) && (!c.setores?.length || (!!u.setor && c.setores.includes(u.setor)))))
      return espera([...visiveis].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)))
    },
    async publicarComunicado(c) {
      const u = exigeGestao()
      const novo: Comunicado = { ...c, id: novoId('c'), autorId: u.id, criadoEm: agora(), lidoPor: [u.id] }
      comunicados.push(novo)
      return espera(novo)
    },
    async marcarLido(id) {
      const u = exigeEu()
      const c = comunicados.find((x) => x.id === id)
      if (c && !c.lidoPor.includes(u.id)) c.lidoPor.push(u.id)
    },
    async folgas(inicio, fim, opcoes) {
      const u = exigeEu()
      const marcadas = folgas.filter((g) => g.data >= inicio && g.data <= fim && podeVerFuncionario(u, porId(g.funcionarioId)))
      const visiveis = funcionarios.filter((f) => podeVerFuncionario(u, f))
      return espera(comFolgasDoTurno(marcadas, visiveis, turnos, inicio, fim, opcoes?.comTrabalha))
    },
    async folgasDaEquipe(inicio, fim) {
      exigeCozinha()
      const ativos = funcionarios.filter((f) => f.status === 'ativo')
      const marcadas = folgas.filter((g) => g.data >= inicio && g.data <= fim && g.tipo !== 'trabalha')
      return espera(comFolgasDoTurno(marcadas, ativos, turnos, inicio, fim).flatMap((g) => {
        const p = porId(g.funcionarioId)
        return p && p.status === 'ativo' ? [{ ...g, nome: p.nome, unidadeId: p.unidadeId, setor: p.setor ?? null }] : []
      }))
    },
    async alternarFolga(fid, data) {
      exigeGestao()
      const i = folgas.findIndex((g) => g.funcionarioId === fid && g.data === data)
      if (i >= 0) folgas.splice(i, 1)
      else folgas.push({ id: novoId('g'), funcionarioId: fid, data, tipo: 'normal' })
    },
    async definirFolga(fid, data, tipo) {
      exigeGestao()
      const i = folgas.findIndex((g) => g.funcionarioId === fid && g.data === data)
      if (i >= 0) folgas.splice(i, 1)
      if (tipo) folgas.push({ id: novoId('g'), funcionarioId: fid, data, tipo })
    },
    async ferias(fid) {
      exigeGestao()
      return espera(feriasDemo.filter((f) => !fid || f.funcionarioId === fid).sort((a, b) => b.inicio.localeCompare(a.inicio)).map((f) => ({ ...f })))
    },
    async registrarFerias(f) {
      const u = exigeGestao()
      if (!possoAlterar(u, porId(f.funcionarioId))) throw new Error('Você não pode alterar quem está acima de você')
      feriasDemo.push({ ...f, id: novoId('fe') })
    },
    async excluirFerias(id) {
      exigeGestao()
      const i = feriasDemo.findIndex((f) => f.id === id)
      if (i >= 0) feriasDemo.splice(i, 1)
    },
    async decimoTerceiro(fid) {
      exigeGestao()
      return espera(decimoDemo.filter((d) => d.funcionarioId === fid).sort((a, b) => b.ano - a.ano || a.parcela - b.parcela).map((d) => ({ ...d })))
    },
    async registrarDecimoTerceiro(d) {
      const u = exigeGestao()
      if (!possoAlterar(u, porId(d.funcionarioId))) throw new Error('Você não pode alterar quem está acima de você')
      if (decimoDemo.some((x) => x.funcionarioId === d.funcionarioId && x.ano === d.ano && x.parcela === d.parcela)) throw new Error('Essa parcela já foi registrada')
      decimoDemo.push({ ...d, id: novoId('dt') })
    },
    async excluirDecimoTerceiro(id) {
      exigeGestao()
      const i = decimoDemo.findIndex((d) => d.id === id)
      if (i >= 0) decimoDemo.splice(i, 1)
    },
    async desligamentos(fid) {
      exigeGestao()
      return espera(desligamentosDemo.filter((d) => !fid || d.funcionarioId === fid).sort((a, b) => b.data.localeCompare(a.data)).map((d) => ({ ...d, itens: { ...d.itens } })))
    },
    async abrirDesligamento(d) {
      const u = exigeGestao()
      if (!possoAlterar(u, porId(d.funcionarioId))) throw new Error('Você não pode alterar quem está acima de você')
      const novo: Desligamento = { ...d, id: novoId('dl'), itens: {}, observacao: d.observacao?.trim() || null, concluido: false }
      desligamentosDemo.push(novo)
      return espera({ ...novo })
    },
    async excluirDesligamento(id) {
      exigeGestao()
      tira(desligamentosDemo, id)
    },
    async atualizarDesligamento(id, m) {
      const u = exigeGestao()
      const d = desligamentosDemo.find((x) => x.id === id)
      if (!d) throw new Error('Desligamento não encontrado')
      if (!possoAlterar(u, porId(d.funcionarioId))) throw new Error('Você não pode alterar quem está acima de você')
      Object.assign(d, m)
    },
    async vendasEntre(inicio, fim) {
      exigePainel()
      return espera(vendasDemo(inicio, fim))
    },
    async caixinhaTotais(mes) {
      exigeGestao()
      return espera({ ...(caixinhas[mes] ?? {}) })
    },
    async salvarCaixinhaTotal(mes, unidadeId, valor) {
      exigeGestao()
      caixinhas[mes] = { ...(caixinhas[mes] ?? {}), [unidadeId]: valor }
    },
    async salarios(mes) {
      exigeGestao()
      return espera(salariosDemo.filter((s) => s.mes === mes).map((s) => ({ ...s })))
    },
    async salariosDe(funcionarioId) {
      const gestao = eu && podeGerenciar(eu.nivel)
      if (!gestao && eu?.id !== funcionarioId) return espera([])
      return espera(salariosDemo.filter((s) => s.funcionarioId === funcionarioId && (gestao || s.liberado)).sort((a, b) => b.mes.localeCompare(a.mes)).map((s) => ({ ...s })))
    },
    async enviarHolerite(s, pdf) {
      exigeGestao()
      const x = salariosDemo.find((y) => y.funcionarioId === s.funcionarioId && y.mes === s.mes && y.tipo === s.tipo)
      const caminho = `${s.funcionarioId}/${s.mes}-${s.tipo}.pdf`
      arquivosDemo.set('holerite:' + caminho, URL.createObjectURL(pdf))
      if (x) x.holerite = caminho
    },
    async abrirHolerite(s) {
      return s.holerite ? arquivosDemo.get('holerite:' + s.holerite) ?? null : null
    },
    async vinculosAnteriores(fid) {
      exigeGestao()
      return espera(vinculosDemo.filter((v) => v.funcionarioId === fid).sort((a, b) => b.admissao.localeCompare(a.admissao)).map((v) => ({ ...v })))
    },
    async readmitir(f, novaAdmissao, tipo) {
      const u = exigeGestao()
      const p = porId(f.id)
      if (!possoAlterar(u, p)) throw new Error('Você não pode alterar quem está acima de você')
      if (p.dataDesligamento) vinculosDemo.push({ id: novoId('va'), funcionarioId: p.id, admissao: p.dataAdmissao, desligamento: p.dataDesligamento, tipoDesligamento: tipo, cargo: p.cargo, observacao: null })
      Object.assign(p, { status: 'ativo', dataAdmissao: novaAdmissao, dataDesligamento: null, experienciaDias1: null, experienciaDias2: null })
    },
    async salvarSalario(s) {
      exigeGestao()
      const i = salariosDemo.findIndex((x) => x.funcionarioId === s.funcionarioId && x.mes === s.mes && x.tipo === s.tipo)
      if (i >= 0) salariosDemo[i] = { ...s }
      else salariosDemo.push({ ...s })
    },
    async liberarSalarios(mes, tipo, liberado) {
      exigeGestao()
      salariosDemo.filter((s) => s.mes === mes && s.tipo === tipo).forEach((s) => (s.liberado = liberado))
    },
    async avaliacoes() {
      exigePainel()
      return espera(avaliacoesDemo())
    },
    turnos: () => espera(turnos),
    async atribuirTurno(fid, turnoId) {
      exigeGestao()
      porId(fid).turnoId = turnoId
    },
    async salvarTurno(t, novo) {
      exigeGestao()
      const i = turnos.findIndex((x) => x.id === t.id)
      if (novo || i < 0) turnos.push({ ...t })
      else turnos[i] = { ...t }
    },
    async excluirTurno(id) {
      exigeGestao()
      turnos.splice(turnos.findIndex((x) => x.id === id), 1)
      for (const f of funcionarios) if (f.turnoId === id) f.turnoId = null
    },
    async chamados() {
      const u = exigeEu()
      const ver = (c: Chamado) => atendeChamados(u.nivel) || c.abertoPor === u.id || c.unidadeId === u.unidadeId || c.aguardandoId === u.id
      return espera(chamados.filter(ver).map((c) => ({ ...c, eventos: [...c.eventos] })).sort((a, b) => b.abertoEm.localeCompare(a.abertoEm)))
    },
    async abrirChamado(n) {
      const u = exigeEu()
      const c: Chamado = {
        id: novoId('ch'), numero: Math.max(0, ...chamados.map((x) => x.numero)) + 1, unidadeId: n.unidadeId, categoria: n.categoria,
        gravidade: n.gravidade, titulo: n.titulo, descricao: n.descricao, local: n.local || null, foto: n.foto?.name ?? null,
        status: 'aberto', abertoPor: u.id, abertoEm: agora(), responsavelId: null, fechadoEm: null, eventos: [],
      }
      if (n.foto) arquivosDemo.set(c.id, URL.createObjectURL(n.foto))
      chamados.push(c)
      return espera(c)
    },
    async atualizarChamado(id, m) {
      const u = exigeEu()
      const c = chamados.find((x) => x.id === id)
      if (!c) throw new Error('Chamado não encontrado.')
      if (m.status && !atendeChamados(u.nivel)) throw new Error('Só a manutenção e a gestão mudam o andamento.')
      if (m.status) {
        c.status = m.status
        if (!c.responsavelId && u.nivel === 'manutencao') c.responsavelId = u.id
        c.fechadoEm = m.status === 'resolvido' || m.status === 'cancelado' ? agora() : null
        if (c.fechadoEm) Object.assign(c, { aguardandoId: null, aguardandoDesde: null, aguardandoMotivo: null })
      }
      c.eventos.push({ id: novoId('e'), autorId: u.id, em: agora(), texto: m.texto?.trim() || null, status: m.status ?? null })
    },
    async pessoasAtivas() {
      exigeEu()
      return espera(funcionarios.filter((f) => f.status === 'ativo').map((f) => ({ id: f.id, nome: f.nome, cargo: f.cargo ?? null })).sort((a, b) => a.nome.localeCompare(b.nome)))
    },
    async aguardarChamado(id, pessoaId, motivo) {
      const u = exigeEu()
      const c = chamados.find((x) => x.id === id)
      if (!c) throw new Error('Chamado não encontrado.')
      if (!chamadoEmAberto(c.status)) throw new Error('Este chamado já foi encerrado.')
      const m = motivo.trim()
      if (pessoaId) {
        if (!atendeChamados(u.nivel)) throw new Error('Só a manutenção e a gestão marcam quem estão esperando.')
        const p = funcionarios.find((x) => x.id === pessoaId)
        if (!p) throw new Error('Pessoa não encontrada.')
        Object.assign(c, { aguardandoId: p.id, aguardandoDesde: agora(), aguardandoMotivo: m || null })
        c.eventos.push({ id: novoId('e'), autorId: u.id, em: agora(), texto: `Aguardando ${p.nome}${m ? ': ' + m : ''}`, status: null })
      } else if (c.aguardandoId) {
        if (!atendeChamados(u.nivel) && c.aguardandoId !== u.id) throw new Error('Só a manutenção, a gestão ou quem está sendo esperado tiram a espera.')
        const nome = funcionarios.find((x) => x.id === c.aguardandoId)?.nome ?? ''
        const eu = c.aguardandoId === u.id
        Object.assign(c, { aguardandoId: null, aguardandoDesde: null, aguardandoMotivo: null })
        c.eventos.push({ id: novoId('e'), autorId: u.id, em: agora(), texto: `${eu ? 'Fiz a minha parte' : 'Não está mais aguardando ' + nome}${m ? ': ' + m : ''}`, status: null })
      }
      return espera(undefined)
    },
    async solicitacoesUniforme(fid) {
      const u = exigeEu()
      return espera(solicitacoesDemo.filter((x) => (fid ? x.funcionarioId === fid : true) && (x.funcionarioId === u.id || podeGerenciar(u.nivel))).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).map((x) => ({ ...x })))
    },
    async pedirTrocaUniforme(n) {
      const u = exigeEu()
      if (n.funcionarioId !== u.id) throw new Error('Cada pessoa pede a própria troca')
      const id = novoId('su')
      if (n.foto) arquivosDemo.set(id, URL.createObjectURL(n.foto))
      solicitacoesDemo.push({ id, funcionarioId: u.id, itens: n.itens, motivo: n.motivo.trim(), foto: n.foto ? 'demo' : null, status: 'aberta', resposta: null, respondidoPor: null, respondidoEm: null, criadoEm: new Date().toISOString() })
    },
    async responderTrocaUniforme(id, status, resposta) {
      const u = exigeGestao()
      const x = solicitacoesDemo.find((y) => y.id === id)
      if (x) Object.assign(x, { status, resposta: resposta.trim() || null, respondidoPor: status === 'aberta' ? null : u.id, respondidoEm: status === 'aberta' ? null : new Date().toISOString() })
    },
    async fotoSolicitacao(x) {
      return arquivosDemo.get(x.id) ?? null
    },
    async contasPagamento() {
      exigeGestao()
      return espera(contasDemo.map((c) => ({ ...c })))
    },
    async salvarContaPagamento(c) {
      exigeGestao()
      if (c.padrao) contasDemo.forEach((x) => (x.padrao = false))
      const nova: ContaPagamento = { ...c, id: c.id ?? 'cp' + (contasDemo.length + 1) }
      const i = contasDemo.findIndex((x) => x.id === nova.id)
      if (i >= 0) contasDemo[i] = nova
      else contasDemo.push(nova)
      return espera({ ...nova })
    },
    async remessasPagamento(tipo, referencia) {
      exigeGestao()
      return espera(remessasDemo.filter((r) => r.tipo === tipo && r.referencia === referencia).map((r) => ({ ...r })))
    },
    async registrarRemessa(r) {
      exigeGestao()
      const nova: RemessaPagamento = { ...r, id: 'rm' + (remessasDemo.length + 1), numero: remessasDemo.length + 1, criadoEm: new Date().toISOString() }
      remessasDemo.unshift(nova)
      return espera({ ...nova })
    },
    async pedidosUniforme() {
      exigeGestao()
      return espera([...pedidosUniformeDemo].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).map((p) => ({ ...p })))
    },
    async salvarPedidoUniforme(p) {
      exigeGestao()
      const atual = p.id ? pedidosUniformeDemo.find((x) => x.id === p.id) : undefined
      if (atual) {
        Object.assign(atual, p)
        return { ...atual }
      }
      const novo: PedidoUniforme = { ...p, id: novoId('pu'), numero: pedidosUniformeDemo.length + 1, criadoEm: new Date().toISOString() }
      pedidosUniformeDemo.push(novo)
      return { ...novo }
    },
    async excluirPedidoUniforme(id) {
      exigeGestao()
      tira(pedidosUniformeDemo, id)
      for (const i of itensPedidoDemo.filter((x) => x.pedidoId === id)) tira(itensPedidoDemo, i.id)
    },
    async itensPedidoUniforme(pid) {
      exigeGestao()
      return espera(itensPedidoDemo.filter((i) => i.pedidoId === pid).map((i) => ({ ...i })))
    },
    async definirItensPedido(pid, fid, itens) {
      exigeGestao()
      for (const i of itensPedidoDemo.filter((x) => x.pedidoId === pid && x.funcionarioId === fid)) tira(itensPedidoDemo, i.id)
      for (const i of itens) itensPedidoDemo.push({ ...i, id: novoId('ip'), pedidoId: pid, funcionarioId: fid })
    },
    async movimentosUniforme() {
      exigeGestao()
      return espera(movUniformeDemo.map((m) => ({ ...m })))
    },
    async movimentarUniformes(linhas) {
      const u = exigeGestao()
      const agora = new Date().toISOString()
      for (const l of linhas)
        movUniformeDemo.push({ ...l, id: novoId('mu'), data: l.data ?? hoje(), observacao: l.observacao ?? null, criadoPor: u.id, criadoEm: agora })
    },
    async desfazerMovimentoUniforme(ref) {
      exigeGestao()
      for (const m of movUniformeDemo.filter((x) => x.referencia === ref)) tira(movUniformeDemo, m.id)
    },
    async equipamentos() {
      exigeManutencao()
      return espera(equipamentosDemo.map((e) => ({ ...e })).sort((a, b) => a.nome.localeCompare(b.nome)))
    },
    async salvarEquipamento(e, foto) {
      exigeManutencao()
      const atual = e.id ? equipamentosDemo.find((x) => x.id === e.id) : undefined
      const salvo: Equipamento = { ...e, id: atual?.id ?? novoId('eq'), foto: atual?.foto ?? null }
      if (foto) {
        salvo.foto = 'demo'
        arquivosDemo.set(salvo.id, URL.createObjectURL(foto))
      }
      if (atual) Object.assign(atual, salvo)
      else equipamentosDemo.push(salvo)
      return espera({ ...salvo })
    },
    async fotoEquipamento(e) {
      return arquivosDemo.get(e.id) ?? null
    },
    async manutencoesEquipamento(eid) {
      exigeManutencao()
      return espera(manutencoesDemo.filter((m) => !eid || m.equipamentoId === eid).sort((a, b) => b.data.localeCompare(a.data)).map((m) => ({ ...m })))
    },
    async registrarManutencaoEquipamento(m) {
      const u = exigeManutencao()
      manutencoesDemo.push({ ...m, id: novoId('me'), registradoPor: u.id })
    },
    async excluirManutencaoEquipamento(id) {
      exigeManutencao()
      tira(manutencoesDemo, id)
    },
    async preventivas() {
      exigeManutencao()
      return espera(preventivasDemo.map((p) => ({ ...p })))
    },
    async salvarPreventiva(p) {
      exigeManutencao()
      const atual = p.id ? preventivasDemo.find((x) => x.id === p.id) : undefined
      if (atual) Object.assign(atual, p)
      else preventivasDemo.push({ ...p, id: novoId('pv') })
    },
    async excluirPreventiva(id) {
      exigeManutencao()
      tira(preventivasDemo, id)
      for (const x of execucoesDemo.filter((x) => x.preventivaId === id)) tira(execucoesDemo, x.id)
    },
    async execucoesPreventiva() {
      exigeManutencao()
      return espera(execucoesDemo.map((x) => ({ ...x })))
    },
    async registrarExecucao(x) {
      const u = exigeManutencao()
      execucoesDemo.push({ ...x, id: novoId('ex'), feitoPor: u.id })
    },
    async excluirExecucao(id) {
      exigeManutencao()
      tira(execucoesDemo, id)
    },
    async fotoChamado(c) {
      return arquivosDemo.get(c.id) ?? null
    },
    async versoesRegulamento() {
      exigeEu()
      for (const v of versoes) if (!v.hash) v.hash = await sha256(v.texto)
      return espera([...versoes].sort((a, b) => b.numero - a.numero))
    },
    async publicarRegulamento(texto, nota) {
      const u = exigeGestao()
      const v: VersaoRegulamento = {
        id: novoId('r'), numero: Math.max(...versoes.map((x) => x.numero)) + 1, texto, nota: nota || null,
        publicadoEm: agora(), publicadoPor: u.id, hash: await sha256(texto),
      }
      versoes.push(v)
      return espera(v)
    },
    async leiturasRegulamento() {
      const u = exigeEu()
      return espera(leituras.filter((l) => l.funcionarioId === u.id || podeGerenciar(u.nivel)))
    },
    async assinarRegulamento(versaoId, assinatura) {
      const u = exigeEu()
      const v = versoes.find((x) => x.id === versaoId)
      if (!v) throw new Error('Versão não encontrada.')
      if (leituras.some((l) => l.funcionarioId === u.id && l.versaoId === versaoId)) throw new Error('Você já assinou esta versão.')
      leituras.push({ funcionarioId: u.id, versaoId, assinatura, assinadoEm: agora(), hash: v.hash || (await sha256(v.texto)), dispositivo: navigator.userAgent, ip: null })
    },
    async resultados() {
      const u = exigeEu()
      if (!vejoResultado(u.nivel)) throw new Error('Só Proprietário e Administrativo veem o resultado.')
      return espera({ linhas: resultadosDemo(), atualizadoEm: agora() })
    },
    async definirFoto(fid, imagem) {
      const u = exigeEu()
      if (fid !== u.id && !podeGerenciar(u.nivel)) throw new Error('Sem permissão para trocar esta foto.')
      const p = porId(fid)
      p.foto = `${fid}/${Date.now()}.jpg`
      p.fotoUrl = URL.createObjectURL(imagem)
    },
    async motoboys() {
      exigeGestao()
      return espera([...motoboysDemo].sort((a, b) => a.nome.localeCompare(b.nome)))
    },
    async salvarMotoboy(m) {
      exigeGestao()
      if (!m.nome.trim()) throw new Error('Diga o nome.')
      const novo: Motoboy = { ...m, id: m.id ?? novoId('mb'), nome: nomeProprio(m.nome), telefone: m.telefone ? soDigitos(m.telefone) || null : null, cpf: m.cpf ? soDigitos(m.cpf) || null : null, pix: m.pix?.trim() || null, observacao: m.observacao?.trim() || null }
      const i = motoboysDemo.findIndex((x) => x.id === novo.id)
      if (i >= 0) motoboysDemo[i] = novo
      else motoboysDemo.push(novo)
      return espera(novo)
    },
    async turnosMotoboys() {
      exigeGestao()
      return espera([...turnosMotoboyDemo])
    },
    async salvarTurnoMotoboy(unidadeId, dia, horario) {
      exigeGestao()
      const i = turnosMotoboyDemo.findIndex((t) => t.unidadeId === unidadeId && t.dia === dia)
      if (i >= 0) turnosMotoboyDemo.splice(i, 1)
      if (horario) turnosMotoboyDemo.push({ unidadeId, dia, ...horario })
      return espera(undefined)
    },
    async escalaMotoboys(de, ate) {
      exigeGestao()
      return espera(escalaMotoboyDemo.filter((e) => e.data >= de && e.data <= ate))
    },
    async escalarMotoboy(motoboyId, unidadeId, data, escalado) {
      exigeGestao()
      const i = escalaMotoboyDemo.findIndex((e) => e.motoboyId === motoboyId && e.data === data)
      if (i >= 0) escalaMotoboyDemo.splice(i, 1)
      if (escalado) escalaMotoboyDemo.push({ id: novoId('esc'), motoboyId, unidadeId, data })
      return espera(undefined)
    },
    async refeicoes(de, ate) {
      exigeEu()
      return espera(refeicoesDemo.filter((x) => x.data >= de && x.data <= ate).sort((a, b) => a.data.localeCompare(b.data))
        .map(({ id, data, centroCustoId, prato, acompanhamentos, observacao, pessoas, pesoKg }) => ({ id, data, centroCustoId, prato, acompanhamentos, observacao, pessoas, pesoKg })))
    },
    async refeicoesCozinha(de, ate) {
      exigeCozinha()
      return espera(refeicoesDemo.filter((x) => x.data >= de && x.data <= ate).sort((a, b) => a.data.localeCompare(b.data)).map((x) => ({ ...x, itens: x.itens.map((i) => ({ ...i })) })))
    },
    async salvarRefeicao(r) {
      exigeCozinha()
      if (!r.prato.trim()) throw new Error('Coloque o nome do prato.')
      const itens = r.itens.filter((i) => i.quantidade > 0).map((i) => ({ insumoId: i.insumoId, quantidade: i.quantidade, custoUnit: insumosDemo.find((x) => x.id === i.insumoId)?.preco ?? null }))
      const dados = {
        data: r.data, centroCustoId: r.centroCustoId, prato: nomeItem(r.prato), acompanhamentos: r.acompanhamentos.trim() || null, observacao: r.observacao.trim() || null,
        pessoas: r.pessoas, pesoKg: r.pesoKg, itens, custoTotal: Math.round(itens.reduce((t, i) => t + i.quantidade * (i.custoUnit ?? 0), 0) * 100) / 100,
      }
      const outra = refeicoesDemo.find((x) => x.data === r.data && x.centroCustoId === r.centroCustoId && x.id !== r.id)
      if (outra) throw new Error('Já existe uma refeição neste dia e local.')
      let id = r.id
      const atual = id ? refeicoesDemo.find((x) => x.id === id) : undefined
      if (atual) Object.assign(atual, dados)
      else { id = novoId('rf'); refeicoesDemo.push({ id, ...dados }) }
      // Baixa no estoque do local (refaz quando edita).
      for (let k = movimentosDemo.length - 1; k >= 0; k--) if (movimentosDemo[k].observacao === `ref:${id}`) movimentosDemo.splice(k, 1)
      for (const i of itens) movimentosDemo.push({ id: novoId('mv'), centroCustoId: r.centroCustoId, insumoId: i.insumoId, data: r.data, tipo: 'saida', quantidade: -i.quantidade, custoUnit: i.custoUnit, notaItemId: null, observacao: `ref:${id}`, criadoEm: agora() })
      // Fica salvo para repetir, por pessoa.
      if (r.pessoas && itens.length) {
        const porPessoa = itens.map((i) => { const ins = insumosDemo.find((x) => x.id === i.insumoId)!; return { nome: ins.nome, quantidade: Math.round((i.quantidade / r.pessoas!) * 10000) / 10000, unidade: ins.unidade, insumoId: ins.id } })
        const salvo = modelosRefeicaoDemo.find((m) => m.nome.toLowerCase() === dados.prato.toLowerCase())
        if (salvo) Object.assign(salvo, { itens: porPessoa, ativo: true })
        else modelosRefeicaoDemo.push({ id: novoId('mr'), nome: dados.prato, tipo: 'prato', modoPreparo: null, ativo: true, itens: porPessoa })
      }
      return espera(id!)
    },
    async excluirRefeicao(id) {
      exigeCozinha()
      const k = refeicoesDemo.findIndex((x) => x.id === id)
      if (k >= 0) refeicoesDemo.splice(k, 1)
      for (let j = movimentosDemo.length - 1; j >= 0; j--) if (movimentosDemo[j].observacao === `ref:${id}`) movimentosDemo.splice(j, 1)
      return espera(undefined)
    },
    async votarRefeicao(id, voto) {
      const u = exigeEu()
      const r = refeicoesDemo.find((x) => x.id === id)
      if (!r || r.data < addDias(hoje(), -7) || r.data > hoje()) throw new Error('Só dá para avaliar as refeições da última semana.')
      const v = votosDemo.get(id) ?? { positivos: 0, negativos: 0, meus: new Map() }
      if (voto === 0) v.meus.delete(u.id)
      else v.meus.set(u.id, voto)
      votosDemo.set(id, v)
      return espera(undefined)
    },
    async votosRefeicoes(de, ate) {
      const u = exigeEu()
      const cozinha = podeGerenciar(u.nivel) || u.nivel === 'manutencao'
      return espera(refeicoesDemo.filter((x) => x.data >= de && x.data <= ate).map((x) => {
        const v = votosDemo.get(x.id)
        const meus = [...(v?.meus.values() ?? [])]
        return {
          refeicaoId: x.id, meuVoto: v?.meus.get(u.id) ?? null,
          positivos: cozinha ? (v?.positivos ?? 0) + meus.filter((m) => m === 1).length : null,
          negativos: cozinha ? (v?.negativos ?? 0) + meus.filter((m) => m === -1).length : null,
        }
      }))
    },
    async modelosRefeicao() {
      exigeCozinha()
      return espera(modelosRefeicaoDemo.map((m) => ({ ...m, itens: m.itens.map((i) => ({ ...i })) })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
    },
    async salvarModeloRefeicao(m) {
      exigeCozinha()
      const dados = { ...m, nome: nomeItem(m.nome), itens: m.itens.filter((i) => i.nome.trim() && i.quantidade > 0) }
      const atual = m.id ? modelosRefeicaoDemo.find((x) => x.id === m.id) : undefined
      if (atual) Object.assign(atual, dados)
      else modelosRefeicaoDemo.push({ ...dados, id: novoId('mr') })
      return espera(undefined)
    },
    async quemCome(data) {
      exigeCozinha()
      const dia = (new Date(data + 'T12:00:00').getDay() + 6) % 7
      const fora: { id: string; nome: string; local: string; motivo: string }[] = []
      const equipe = funcionarios.filter((f) => f.status === 'ativo' && f.nivel !== 'proprietario').flatMap((f) => {
        const t = turnos.find((x) => x.id === f.turnoId)
        const g = folgas.find((x) => x.funcionarioId === f.id && x.data === data)
        const motivo = f.dataAdmissao && f.dataAdmissao > data ? 'admissão depois deste dia'
          : feriasDemo.some((x) => x.funcionarioId === f.id && data >= x.inicio && data <= addDias(x.inicio, x.dias - 1)) ? 'férias'
          : g?.tipo === 'trabalha' ? null : g?.tipo === 'feriado' ? 'folga de feriado' : g ? 'folga'
          : !t || !t.dias.some(Boolean) ? null : !t.dias[dia] ? 'o turno não trabalha neste dia' : null
        const local = t?.local ?? f.unidadeId
        if (motivo) { fora.push({ id: f.id, nome: f.nome, local, motivo }); return [] }
        return [{ id: f.id, nome: f.nome, local, unidadeId: f.unidadeId, turno: t?.nome ?? null, horario: t?.dias[dia] ?? null }]
      })
      const motoboys = escalaMotoboyDemo.filter((e) => e.data === data).flatMap((e) => {
        const m = motoboysDemo.find((x) => x.id === e.motoboyId && x.ativo)
        return m ? [{ id: m.id, nome: m.nome, local: e.unidadeId }] : []
      })
      return espera({ equipe: equipe.sort((a, b) => a.local.localeCompare(b.local) || a.nome.localeCompare(b.nome, 'pt-BR')), motoboys, fora: fora.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) })
    },
    async motoboyQuemSou(celular) {
      const cel = celular.replace(/\D/g, '').slice(-11)
      if (cel.length < 10) return espera({ tipo: 'invalido' as const })
      const m = motoboysDemo.find((x) => x.ativo && (x.telefone ?? '').replace(/\D/g, '').slice(-11) === cel)
      return espera(m ? { tipo: 'motoboy' as const, nome: m.nome.split(' ')[0], unidadeId: m.unidadeId, valorDiaria: m.valorDiaria ?? 100, valorDiariaFds: m.valorDiariaFds ?? 115, entregasIncluidas: m.entregasIncluidas ?? 10, valorEntrega: m.valorEntrega ?? 4 } : { tipo: 'nao_achei' as const })
    },
    async motoboyCadastrar(c) {
      const atual = await this.motoboyQuemSou(c.celular)
      if (atual.tipo === 'motoboy') return atual
      if (nomeProprio(c.nome).split(' ').length < 2) throw new Error('Coloque o nome completo.')
      if (!cpfValido(c.cpf)) throw new Error('CPF inválido. Confira os números.')
      if (!c.pix.trim()) throw new Error('Coloque a chave Pix.')
      motoboysDemo.push({ id: novoId('mb'), nome: nomeProprio(c.nome), unidadeId: c.unidadeId || null, pix: c.pix.trim(), telefone: soDigitos(c.celular), cpf: soDigitos(c.cpf), observacao: 'Cadastro feito pelo próprio motoboy no link', ativo: true })
      return this.motoboyQuemSou(c.celular)
    },
    async enviarDiaMotoboy(e) {
      const cel = e.celular.replace(/\D/g, '').slice(-11)
      const m = motoboysDemo.find((x) => x.ativo && (x.telefone ?? '').replace(/\D/g, '').slice(-11) === cel)
      if (!m) throw new Error('Celular não encontrado no cadastro dos motoboys. Fale com a gerente.')
      const atual = enviosMotoboyDemo.find((x) => x.motoboyId === m.id && x.unidadeId === e.unidadeId && x.data === e.data && x.status !== 'recusado')
      if (atual?.status === 'aprovado') throw new Error('Esse dia já foi conferido e aprovado. Se precisar mudar, fale com a gerente.')
      const fotos = e.fotos.map((f) => URL.createObjectURL(f))
      const dados = { entregas: e.entregas, extras: e.extras.filter((x) => x.descricao.trim() && x.valor), observacao: e.observacao.trim() || null, enviadoEm: new Date().toISOString() }
      if (atual) Object.assign(atual, dados, { fotos: [...atual.fotos, ...fotos] })
      else enviosMotoboyDemo.push({ id: novoId('emb'), motoboyId: m.id, unidadeId: e.unidadeId, data: e.data, fotos, status: 'pendente', entregasConferidas: null, motivo: null, ...dados })
      return espera(undefined)
    },
    async enviosMotoboys(de, ate) {
      exigeGestao()
      return espera(enviosMotoboyDemo.filter((x) => x.data >= de && x.data <= ate).map((x) => ({ ...x })))
    },
    async fotosEnvioMotoboy(caminhos) {
      return espera(caminhos)
    },
    async resolverEnvioMotoboy(id, aprovar, entregas, motivo) {
      exigeGestao()
      const x = enviosMotoboyDemo.find((e) => e.id === id)
      if (x) Object.assign(x, { status: aprovar ? 'aprovado' : 'recusado', entregasConferidas: aprovar ? entregas : null, motivo: motivo.trim() || null })
      return espera(undefined)
    },
    async reabrirEnvioMotoboy(id) {
      exigeGestao()
      const x = enviosMotoboyDemo.find((e) => e.id === id)
      if (x) Object.assign(x, { status: 'pendente', entregasConferidas: null, motivo: null })
      return espera(undefined)
    },
    async semanasMotoboys(de, ate) {
      exigeGestao()
      return espera(semanasMotoboyDemo.filter((s) => s.pagamento >= de && s.pagamento <= ate).map((s) => {
        const c = contasPagarDemo.find((x) => x.origem === `moto:${s.motoboyId}:${s.pagamento}:${s.unidadeId}`)
        return { ...s, pagoEm: c?.pagoEm ?? null, conciliado: c?.conciliado ?? false }
      }))
    },
    async salvarSemanaMotoboys(pagamento, unidadeId, linhas) {
      exigeGestao()
      for (const l of linhas) {
        const mb = motoboysDemo.find((x) => x.id === l.motoboyId)
        if (!mb) throw new Error('Motoboy não encontrado.')
        const origem = `moto:${mb.id}:${pagamento}:${unidadeId}`
        const ci = contasPagarDemo.findIndex((x) => x.origem === origem)
        if (ci >= 0 && contasPagarDemo[ci].conciliado) continue
        const extras = l.extras.filter((e) => e.valor).map((e) => ({ descricao: e.descricao.trim(), valor: Math.round(e.valor * 100) / 100 }))
        const total = Math.round((l.diarias + l.entregas + extras.reduce((t, e) => t + e.valor, 0)) * 100) / 100
        const si = semanasMotoboyDemo.findIndex((x) => x.motoboyId === mb.id && x.unidadeId === unidadeId && x.pagamento === pagamento)
        if (total <= 0) {
          if (si >= 0) semanasMotoboyDemo.splice(si, 1)
          if (ci >= 0) contasPagarDemo.splice(ci, 1)
          continue
        }
        const semana: SemanaMotoboy = { id: si >= 0 ? semanasMotoboyDemo[si].id : novoId('ms'), motoboyId: mb.id, unidadeId, pagamento, diarias: l.diarias, entregas: l.entregas, extras, total, pagoEm: null, conciliado: false, dias: l.dias ?? {} }
        if (si >= 0) semanasMotoboyDemo[si] = semana
        else semanasMotoboyDemo.push(semana)
        const conta = contaDemo(ci >= 0 ? contasPagarDemo[ci].id : novoId('cp'), {
          centroCustoId: unidadeId, contaId: 'pc3.1', motoboyId: mb.id, favorecido: mb.nome,
          descricao: `Motoboy ${dataCurtaDemo(addDias(pagamento, -7))} a ${dataCurtaDemo(addDias(pagamento, -1))} · ${mb.nome}`,
          competencia: addDias(pagamento, -1).slice(0, 8) + '01', vencimento: pagamento, valor: total, forma: 'pix', origem, lote: 'moto:' + pagamento,
          observacao: 'Lançada pela semana dos motoboys', pagoEm: l.jaPago ? (ci >= 0 && contasPagarDemo[ci].pagoEm) || (pagamento < hoje() ? pagamento : hoje()) : null, valorPago: l.jaPago ? total : null,
        })
        if (ci >= 0) contasPagarDemo[ci] = conta
        else contasPagarDemo.push(conta)
      }
      return espera(undefined)
    },
    async freelancers() {
      exigeGestao()
      return espera([...freelas].sort((a, b) => a.nome.localeCompare(b.nome)))
    },
    async salvarFreelancer(f) {
      exigeGestao()
      const cpf = f.cpf ? soDigitos(f.cpf) : null
      if (cpf && freelas.some((x) => x.cpf === cpf && x.id !== f.id)) throw new Error('Já existe freelancer com esse CPF.')
      if (f.funcionarioId && freelas.some((x) => x.funcionarioId === f.funcionarioId && x.id !== f.id)) throw new Error('Esse funcionário já está cadastrado como freelancer.')
      const novo: Freelancer = { ...f, nome: nomeProprio(f.nome), id: f.id ?? novoId('fl'), cpf, celular: f.celular ? soDigitos(f.celular) : null }
      const i = freelas.findIndex((x) => x.id === novo.id)
      if (i >= 0) freelas[i] = novo
      else freelas.push(novo)
      return espera(novo)
    },
    async excluirFreelancer(id) {
      exigeGestao()
      if (pagamentos.some((p) => p.freelancerId === id)) throw new Error('Esse freelancer já tem pagamento marcado. Desmarque os pagamentos ou deixe o cadastro inativo.')
      for (const lista of [diarias, envios] as { freelancerId: string | null }[][])
        for (let i = lista.length - 1; i >= 0; i--) if (lista[i].freelancerId === id) lista.splice(i, 1)
      freelas.splice(freelas.findIndex((f) => f.id === id), 1)
    },
    async diariasFreela(inicio, fim) {
      exigeGestao()
      return espera(diarias.filter((d) => d.data >= inicio && d.data <= fim).map((d) => ({ ...d })))
    },
    async lancarDiaria(d) {
      const u = exigeGestao()
      if (diarias.some((x) => x.freelancerId === d.freelancerId && x.data === d.data && x.turno === d.turno))
        throw new Error('Esse freelancer já tem diária lançada nesse dia e turno.')
      const nova: DiariaFreela = { ...d, id: novoId('d'), lancadoPor: u.id }
      diarias.push(nova)
      return espera(nova)
    },
    async excluirDiaria(id) {
      exigeGestao()
      diarias.splice(diarias.findIndex((d) => d.id === id), 1)
    },
    async pagamentosFreela(semana) {
      exigeGestao()
      return espera(pagamentos.filter((p) => p.semana === semana))
    },
    async marcarPagoFreela(freelancerId, semana, valor) {
      const u = exigeGestao()
      pagamentos.push({ freelancerId, semana, valor, pagoEm: agora(), pagoPor: u.id })
    },
    async desfazerPagoFreela(freelancerId, semana) {
      exigeGestao()
      pagamentos.splice(pagamentos.findIndex((p) => p.freelancerId === freelancerId && p.semana === semana), 1)
    },
    async admissoes(fid) {
      const u = exigeEu()
      if (!podeGerenciar(u.nivel)) return espera([])
      return espera(admissoes.filter((a) => !fid || a.funcionarioId === fid).map((a) => ({ ...a, itens: { ...a.itens } })))
    },
    async salvarAdmissao(a) {
      exigeGestao()
      const i = admissoes.findIndex((x) => x.funcionarioId === a.funcionarioId && x.dataAdmissao === a.dataAdmissao)
      if (i >= 0) admissoes[i] = { ...a }
      else admissoes.push({ ...a })
    },
    async publicarGuia(_fid, arquivo) {
      exigeGestao()
      const codigo = codigoAleatorio()
      guiasDemo.set(codigo, URL.createObjectURL(arquivo))
      return linkDaGuia(codigo)
    },
    async abrirGuia(codigo) {
      return guiasDemo.get(codigo) ?? null
    },
    async lojasParaDiaria() {
      return espera(unidades.map((u) => ({ ...u })))
    },
    async freelaQuemSou(cpf, celular) {
      const c = soDigitos(cpf)
      if (!cpfValido(c)) return espera({ tipo: 'invalido' as const })
      const fu = funcionarios.find((f) => f.status === 'ativo' && f.cpf === c)
      if (fu) {
        if (soDigitos(fu.celular).slice(-11) !== soDigitos(celular).slice(-11)) return espera({ tipo: 'celular_errado' as const })
        const pixFu = freelas.find((x) => x.funcionarioId === fu.id)?.pix ?? fu.pix ?? ''
        return espera({ tipo: 'funcionario' as const, nome: fu.nome.split(' ')[0], pixFinal: pixFu.slice(-4) })
      }
      const f = freelas.find((x) => x.cpf === c)
      if (!f || (f.celular && f.celular.slice(-11) !== soDigitos(celular).slice(-11))) return espera({ tipo: 'novo' as const })
      return espera({ tipo: 'freelancer' as const, nome: f.nome.split(' ')[0], pixFinal: f.pix.slice(-4) })
    },
    async enviarDiarias(e) {
      const quem = await this.freelaQuemSou(e.cpf, e.celular)
      if (quem.tipo === 'invalido') throw new Error('CPF inválido. Confira os números.')
      if (quem.tipo === 'celular_errado') throw new Error('Esse CPF é de alguém do time, mas o celular não é o do cadastro. Use o celular cadastrado ou fale com a gerente.')
      const cpf = soDigitos(e.cpf)
      if (quem.tipo === 'funcionario') {
        const fu = funcionarios.find((x) => x.status === 'ativo' && x.cpf === cpf)!
        const fl = freelas.find((x) => x.funcionarioId === fu.id)
        return gravarEnvios(e.dias, {
          cpf, celular: soDigitos(e.celular).slice(-11), nome: fu.nome, pix: e.pix.trim() || fl?.pix || fu.pix || '',
          freelancerId: fl?.id ?? null, funcionarioId: fu.id, unidadeId: e.unidadeId, funcao: e.funcao,
        }, e.local)
      }
      const f = freelas.find((x) => x.cpf === cpf)
      const nome = nomeProprio(e.nome) || (quem.tipo === 'freelancer' ? f?.nome : '') || ''
      const pix = e.pix.trim() || (quem.tipo === 'freelancer' ? f?.pix : '') || ''
      if (nome.split(/\s+/).length < 2) throw new Error('Coloque o nome completo.')
      return gravarEnvios(e.dias, { cpf, celular: soDigitos(e.celular).slice(-11), nome, pix, freelancerId: f?.id ?? null, funcionarioId: null, unidadeId: e.unidadeId, funcao: e.funcao }, e.local)
    },
    async enviarMinhasDiarias(e) {
      const u = exigeEu()
      return gravarEnvios(e.dias, {
        cpf: u.cpf ?? null, celular: u.celular, nome: u.nome, pix: e.pix.trim() || u.pix || '', unidadeId: e.unidadeId, funcao: e.funcao,
        freelancerId: freelas.find((x) => x.funcionarioId === u.id)?.id ?? null, funcionarioId: u.id,
      }, e.local)
    },
    async locaisLojas(): Promise<LocalLoja[]> {
      return espera(unidades.map((u) => ({ ...u, latitude: locais[u.id]?.latitude ?? null, longitude: locais[u.id]?.longitude ?? null })))
    },
    async definirLocalLoja(unidadeId, lat, lng) {
      exigeGestao()
      locais[unidadeId] = { latitude: lat, longitude: lng }
    },
    async enviosFreela(status) {
      if (status === 'meus') {
        const u = exigeEu()
        return espera(envios.filter((x) => x.funcionarioId === u.id).sort((a, b) => b.data.localeCompare(a.data)).map((x) => ({ ...x })))
      }
      exigeGestao()
      return espera(envios.filter((x) => x.status === status).sort((a, b) => a.data.localeCompare(b.data)).map((x) => ({ ...x })))
    },
    async aprovarEnvioFreela(id, valor, funcao, usarPixNovo) {
      const u = exigeGestao()
      const e = envios.find((x) => x.id === id && x.status === 'pendente')
      if (!e) throw new Error('Esse envio já foi resolvido.')
      let f = freelas.find((x) => (e.freelancerId && x.id === e.freelancerId) || (e.funcionarioId && x.funcionarioId === e.funcionarioId) || (e.cpf && x.cpf === e.cpf))
      if (!f) {
        f = { id: novoId('fl'), nome: e.nome, cpf: e.cpf, pix: e.pix, celular: e.celular, ativo: true, funcionarioId: e.funcionarioId }
        freelas.push(f)
      } else {
        f.ativo = true
        if (usarPixNovo) Object.assign(f, { pix: e.pix, celular: e.celular ?? f.celular })
      }
      if (!diarias.some((x) => x.freelancerId === f.id && x.data === e.data && x.turno === e.turno))
        diarias.push({ id: novoId('d'), freelancerId: f.id, data: e.data, turno: e.turno, unidadeId: e.unidadeId, funcao: funcao.trim() || e.funcao, valor, observacao: e.observacao, lancadoPor: u.id })
      Object.assign(e, { status: 'aprovado', freelancerId: f.id })
    },
    async recusarEnvioFreela(id, motivo) {
      exigeGestao()
      const e = envios.find((x) => x.id === id && x.status === 'pendente')
      if (e) Object.assign(e, { status: 'recusado', motivo: motivo.trim() || null })
    },

    async operacoes() {
      exigeGestao()
      return operacoesDemo.map((o) => ({ ...o })).sort((a, b) => a.nome.localeCompare(b.nome))
    },
    async salvarOperacao(o) {
      exigeGestao()
      const atual = operacoesDemo.find((x) => x.id === o.id)
      if (atual) Object.assign(atual, { nome: o.nome.trim(), ativa: o.ativa })
      else operacoesDemo.push({ id: o.id, nome: o.nome.trim(), ativa: o.ativa })
    },
    async eventos() {
      exigeGestao()
      return structuredClone(eventosDemo).sort((a, b) => b.numero - a.numero)
    },
    async salvarEvento(e) {
      const u = exigeGestao()
      if (!e.nome.trim()) throw new Error('Dê um nome ao evento.')
      const quando = agora()
      const limpo = { ...e, nome: e.nome.trim(), dias: e.dias.filter((d) => d.data).sort((a, b) => a.data.localeCompare(b.data)) }
      const atual = eventosDemo.find((x) => x.id === e.id)
      if (atual) {
        if (atual.atualizadoEm !== e.atualizadoEm) throw new Error(EVENTO_ALTERADO)
        if (atual.status !== limpo.status)
          historicoEventosDemo.push({ id: novoId('he'), eventoId: atual.id, em: quando, por: u.id, tipo: 'status', de: atual.status, para: limpo.status, campos: null, motivo: limpo.statusMotivo?.trim() || null })
        const ignorar = new Set(['status', 'statusMotivo', 'dias', 'operacoes', 'responsaveis', 'atualizadoEm', 'atualizadoPor', 'criadoEm', 'criadoPor', 'numero', 'id'])
        const campos = Object.keys(limpo).filter((k) => !ignorar.has(k) && JSON.stringify((limpo as any)[k] ?? null) !== JSON.stringify((atual as any)[k] ?? null))
          // Mesmo nome de coluna que o banco grava no histórico.
          .map((k) => k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase()))
        if (campos.length) historicoEventosDemo.push({ id: novoId('he'), eventoId: atual.id, em: quando, por: u.id, tipo: 'dados', de: null, para: null, campos, motivo: null })
        Object.assign(atual, limpo, { atualizadoPor: u.id, atualizadoEm: quando })
        return structuredClone(atual)
      }
      const novo: Evento = { ...limpo, id: novoId('ev'), numero: Math.max(0, ...eventosDemo.map((x) => x.numero)) + 1, criadoPor: u.id, criadoEm: quando, atualizadoPor: u.id, atualizadoEm: quando }
      eventosDemo.push(novo)
      historicoEventosDemo.push({ id: novoId('he'), eventoId: novo.id, em: quando, por: u.id, tipo: 'criado', de: null, para: novo.status, campos: null, motivo: null })
      return structuredClone(novo)
    },
    async historicoEvento(eventoId) {
      exigeGestao()
      return historicoEventosDemo.filter((h) => h.eventoId === eventoId).sort((a, b) => b.em.localeCompare(a.em))
    },

    async fornecedores() {
      exigeGestaoOuProducao()
      return structuredClone(fornecedoresDemo).sort((a, b) => a.nome.localeCompare(b.nome))
    },
    async salvarFornecedor(f) {
      exigeGestao()
      const nome = f.nome.trim()
      if (fornecedoresDemo.some((x) => x.id !== f.id && x.nome.toLowerCase() === nome.toLowerCase())) throw new Error('Já existe um fornecedor com esse nome.')
      const atual = fornecedoresDemo.find((x) => x.id === f.id)
      if (atual) return structuredClone(Object.assign(atual, f, { nome }))
      const novo = { ...f, nome, id: novoId('fo') }
      fornecedoresDemo.push(novo)
      return structuredClone(novo)
    },
    async insumos() {
      const u = exigeEu()
      if (!(podeGerenciar(u.nivel) || u.setor === 'producao' || u.nivel === 'manutencao')) throw new Error('Seu nível de acesso não permite esta ação.')
      return structuredClone(insumosDemo).map((i) => ({ ...i, prePreparo: prePreparoDemo.has(i.id) })).sort((a, b) => a.nome.localeCompare(b.nome))
    },
    async salvarInsumo(i) {
      const u = exigeGestao()
      const nome = nomeItem(i.nome)
      if (insumosDemo.some((x) => x.id !== i.id && x.nome.toLowerCase() === nome.toLowerCase())) throw new Error('Já existe um insumo com esse nome.')
      const atual = insumosDemo.find((x) => x.id === i.id)
      const mudouPreco = !atual || atual.preco !== i.preco
      const salvo: Insumo = { ...(atual ?? { id: novoId('in') }), ...i, nome, id: atual?.id ?? novoId('in'), precoEm: mudouPreco ? agora() : atual!.precoEm }
      if (atual) Object.assign(atual, salvo)
      else insumosDemo.push(salvo)
      if (i.prePreparo !== undefined) {
        if (i.prePreparo) prePreparoDemo.add(salvo.id)
        else prePreparoDemo.delete(salvo.id)
      }
      if (mudouPreco) precosInsumoDemo.push({ id: novoId('pi'), insumoId: salvo.id, preco: salvo.preco, em: agora(), por: u.id, origem: 'manual' })
      return structuredClone(salvo)
    },
    async categoriasInsumo() {
      exigeGestaoOuProducao()
      for (const i of insumosDemo) if (i.categoria) categoriasDemo.add(i.categoria)
      return [...categoriasDemo].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    },
    async salvarCategoriaInsumo(nome, antigo) {
      exigeGestao()
      nome = nome.trim()
      if (!nome) throw new Error('Dê um nome à categoria.')
      if (nome !== antigo && categoriasDemo.has(nome)) throw new Error('duplicate key: já existe')
      if (antigo) {
        categoriasDemo.delete(antigo)
        for (const i of insumosDemo) if (i.categoria === antigo) i.categoria = nome
      }
      categoriasDemo.add(nome)
    },
    async referenciasPreco() {
      exigeGestao()
      return insumosDemo.flatMap((i) => {
        const h = precosInsumoDemo.filter((p) => p.insumoId === i.id)
        const ant = h.length > 1 ? h[h.length - 2] : null
        // Exemplo: a última entrada do guardanapo custou centavos, e o cadastro diz R$ 90 a unidade.
        const entrada = i.id === 'in23' ? 0.09 : null
        return ant || entrada ? [{ insumoId: i.id, precoAnterior: ant?.preco ?? null, anteriorEm: ant?.em ?? null, custoEntrada: entrada, entradaEm: entrada ? hoje() : null }] : []
      })
    },
    async excluirInsumos(ids) {
      exigeGestao()
      return ids.flatMap((id): { insumoId: string; nome: string; excluido: boolean; motivo: string | null }[] => {
        const i = insumosDemo.find((x) => x.id === id)
        if (!i) return []
        const fichas = receitasDemo.filter((r) => r.insumoId === id || versoesReceitaDemo.some((v) => v.receitaId === r.id && v.itens.some((it) => it.insumoId === id)))
        if (fichas.length) {
          i.ativo = false
          return [{ insumoId: id, nome: i.nome, excluido: false, motivo: 'está em ficha técnica: ' + fichas.map((r) => r.nome).join(', ') }]
        }
        insumosDemo.splice(insumosDemo.indexOf(i), 1)
        return [{ insumoId: id, nome: i.nome, excluido: true, motivo: null }]
      })
    },
    async controlarEstoque(ids, controla) {
      exigeGestao()
      for (const i of insumosDemo) if (ids.includes(i.id)) i.controlaEstoque = controla
      return espera(undefined)
    },
    async ativarInsumos(ids, ativo) {
      exigeGestao()
      for (const i of insumosDemo) if (ids.includes(i.id)) i.ativo = ativo
      return espera(undefined)
    },
    async conferirPrecoInsumo(id, preco) {
      exigeGestao()
      const i = insumosDemo.find((x) => x.id === id)
      if (i) i.precoConferido = preco
    },
    async juntarCategoriaInsumo(de, para) {
      exigeGestao()
      if (para) categoriasDemo.add(para)
      for (const i of insumosDemo) if (i.categoria === de) i.categoria = para
      categoriasDemo.delete(de)
    },
    async precosInsumo(id) {
      exigeGestao()
      return precosInsumoDemo.filter((p) => p.insumoId === id).sort((a, b) => b.em.localeCompare(a.em))
    },
    async receitas() {
      exigeGestaoOuProducao()
      return structuredClone(receitasDemo).sort((a, b) => a.nome.localeCompare(b.nome))
    },
    async versoesReceitas() {
      exigeGestaoOuProducao()
      return structuredClone(versoesReceitaDemo)
    },
    async salvarReceita(r) {
      exigeGestao()
      const nome = r.nome.trim()
      if (receitasDemo.some((x) => x.id !== r.id && x.tipo === r.tipo && x.nome.toLowerCase() === nome.toLowerCase())) throw new Error('Já existe uma ficha com esse nome.')
      const atual = receitasDemo.find((x) => x.id === r.id)
      if (atual) return structuredClone(Object.assign(atual, r, { nome }))
      const nova: Receita = { ...r, nome, id: novoId('re'), versaoAtual: 0 }
      receitasDemo.push(nova)
      return structuredClone(nova)
    },
    async salvarVersaoReceita(receitaId, rendimento, custoTotal, nota, itens) {
      const u = exigeGestao()
      const r = receitasDemo.find((x) => x.id === receitaId)
      if (!r) throw new Error('Ficha não encontrada.')
      if (itens.some((i) => i.subReceitaId === receitaId)) throw new Error('Uma ficha não pode usar ela mesma.')
      r.versaoAtual += 1
      versoesReceitaDemo.push({ id: novoId('ve'), receitaId, numero: r.versaoAtual, rendimento, custoTotal, nota: nota.trim() || null, criadaEm: agora(), criadaPor: u.id, itens: structuredClone(itens) })
      return r.versaoAtual
    },

    async cardapioEvento(eventoId) {
      exigeGestao()
      return structuredClone(cardapiosDemo[eventoId] ?? [])
    },
    async salvarCardapioEvento(eventoId, itens) {
      exigeGestao()
      cardapiosDemo[eventoId] = itens.map((i, o) => ({ ...i, ordem: o + 1 }))
    },
    async previsaoEvento(eventoId) {
      exigeGestao()
      return structuredClone(previsoesDemo[eventoId] ?? [])
    },
    async salvarPrevisaoEvento(eventoId, linhas) {
      exigeGestao()
      previsoesDemo[eventoId] = linhas.filter((l) => l.quantidade > 0)
    },
    async vendasEventos() {
      exigeGestao()
      return structuredClone(vendasEventosDemo)
    },
    async salvarVendasEvento(eventoId, linhas) {
      exigeGestao()
      for (let i = vendasEventosDemo.length - 1; i >= 0; i--) if (vendasEventosDemo[i].eventoId === eventoId) vendasEventosDemo.splice(i, 1)
      for (const l of linhas.filter((x) => x.quantidade > 0))
        vendasEventosDemo.push({ ...l, eventoId, produto: receitasDemo.find((r) => r.id === l.receitaId)?.nome ?? '?', origem: 'manual' })
    },
    async modeloChecklist() {
      exigeGestao()
      return structuredClone(modeloChecklistDemo).sort((a, b) => a.ordem - b.ordem)
    },
    async salvarItemModelo(i) {
      exigeGestao()
      if (!i.item.trim()) throw new Error('Escreva o item.')
      const atual = modeloChecklistDemo.find((x) => x.id === i.id)
      if (atual) Object.assign(atual, i)
      else modeloChecklistDemo.push({ ...i, id: novoId('mc') })
    },
    async envios(eventoId) {
      const u = exigeEu()
      const vejo = (ev: string) => podeGerenciar(u.nivel) || eventosDemo.find((e) => e.id === ev)?.responsaveis.some((r) => r.funcionarioId === u.id)
      return structuredClone(enviosDemo.filter((e) => (!eventoId || e.eventoId === eventoId) && vejo(e.eventoId))).sort((a, b) => a.data.localeCompare(b.data) || a.criadoEm.localeCompare(b.criadoEm))
    },
    async criarEnvio(eventoId, data, tipo, observacao, itens) {
      const u = exigeGestao()
      const id = novoId('en')
      enviosDemo.push({
        id, eventoId, data, tipo, observacao: observacao.trim() || null, criadoPor: u.id, criadoEm: agora(),
        itens: itens.map((i, o) => ({ ...i, id: novoId('ei'), ordem: o + 1, conferido: false, conferidoPor: null, conferidoEm: null, retornou: false, retornoPor: null, retornoEm: null })),
      })
      return id
    },
    async excluirEnvio(id) {
      exigeGestao()
      const i = enviosDemo.findIndex((e) => e.id === id)
      if (i >= 0) enviosDemo.splice(i, 1)
    },
    async adicionarItemEnvio(envioId, item) {
      exigeGestao()
      const e = enviosDemo.find((x) => x.id === envioId)
      if (!e) throw new Error('Separação não encontrada.')
      e.itens.push({ ...item, id: novoId('ei'), ordem: e.itens.length + 1, conferido: false, conferidoPor: null, conferidoEm: null, retornou: false, retornoPor: null, retornoEm: null })
    },
    async excluirItemEnvio(itemId) {
      exigeGestao()
      for (const e of enviosDemo) e.itens = e.itens.filter((i) => i.id !== itemId)
    },
    async conferirItemEnvio(itemId, etapa, quantidade, feito) {
      const u = exigeEu()
      const e = enviosDemo.find((x) => x.itens.some((i) => i.id === itemId))
      const ev = eventosDemo.find((x) => x.id === e?.eventoId)
      if (!e || !ev) throw new Error('Item não encontrado.')
      if (!podeGerenciar(u.nivel) && !ev.responsaveis.some((r) => r.funcionarioId === u.id)) throw new Error('Seu nível de acesso não permite esta ação.')
      const item = e.itens.find((i) => i.id === itemId)!
      if (etapa === 'saida') Object.assign(item, { quantidade, conferido: feito, conferidoPor: feito ? u.id : null, conferidoEm: feito ? agora() : null })
      else Object.assign(item, { retornou: feito, retornoPor: feito ? u.id : null, retornoEm: feito ? agora() : null })
    },
    async inventarios(filtro) {
      const u = exigeEu()
      if ('eventoId' in filtro) {
        const ev = eventosDemo.find((x) => x.id === filtro.eventoId)
        if (!podeGerenciar(u.nivel) && !ev?.responsaveis.some((r) => r.funcionarioId === u.id)) return []
        return structuredClone(inventariosDemo.filter((i) => i.local === 'evento' && i.eventoId === filtro.eventoId)).sort((a, b) => b.contadoEm.localeCompare(a.contadoEm))
      }
      exigeGestao()
      return structuredClone(inventariosDemo.filter((i) => i.local === 'base')).sort((a, b) => b.contadoEm.localeCompare(a.contadoEm))
    },
    async salvarInventario(local, eventoId, data, itens, fala, observacao) {
      const u = exigeEu()
      if (local === 'base') exigeGestao()
      else if (!podeGerenciar(u.nivel) && !eventosDemo.find((x) => x.id === eventoId)?.responsaveis.some((r) => r.funcionarioId === u.id))
        throw new Error('Seu nível de acesso não permite esta ação.')
      const novo: Inventario = { id: novoId('iv'), local, eventoId, data, contadoPor: u.id, contadoEm: agora(), observacao: observacao.trim() || null, fala: fala.trim() || null, itens: structuredClone(itens) }
      const i = local === 'evento' ? inventariosDemo.findIndex((x) => x.local === 'evento' && x.eventoId === eventoId && x.data === data) : -1
      if (i >= 0) inventariosDemo[i] = { ...novo, id: inventariosDemo[i].id }
      else inventariosDemo.push(novo)
    },
    async itensContagem() {
      const u = exigeEu()
      if (!podeGerenciar(u.nivel) && !eventosDemo.some((e) => e.responsaveis.some((r) => r.funcionarioId === u.id))) throw new Error('Seu nível de acesso não permite esta ação.')
      return [
        ...insumosDemo.filter((i) => i.ativo).map((i) => ({ chave: 'i:' + i.id, nome: i.nome, categoria: i.categoria, unidade: i.unidade, embalagem: i.embalagem, embalagemQtd: i.embalagemQtd })),
        ...receitasDemo.filter((r) => r.ativo && r.tipo === 'preparo').map((r) => ({ chave: 'r:' + r.id, nome: r.nome, categoria: 'Pré-preparos', unidade: r.unidade, embalagem: null, embalagemQtd: null })),
      ].sort((a, b) => a.nome.localeCompare(b.nome))
    },
    async meusEventosEscalados() {
      const u = exigeEu()
      return eventosDemo
        .filter((e) => ['aprovado', 'preparacao', 'execucao'].includes(e.status) && e.responsaveis.some((r) => r.funcionarioId === u.id))
        .map((e) => ({ id: e.id, nome: e.nome, status: e.status, papel: e.responsaveis.find((r) => r.funcionarioId === u.id)?.papel ?? null, dias: structuredClone(e.dias) }))
    },

    async freelasEvento() {
      exigeGestao()
      return espera(structuredClone(freelasEventoDemo).sort((a, b) => a.nome.localeCompare(b.nome)))
    },
    async salvarFreelaEvento(f) {
      exigeGestao()
      const cpf = soDigitos(f.cpf)
      if (freelasEventoDemo.some((x) => x.cpf === cpf && x.id !== f.id)) throw new Error('duplicate key freelas_evento_cpf_key')
      const linha: FreelaEvento = { ...f, id: f.id ?? novoId('fe'), nome: nomeProprio(f.nome), cpf, pix: f.pix.trim(), celular: f.celular ? soDigitos(f.celular).slice(-11) : null }
      const i = freelasEventoDemo.findIndex((x) => x.id === linha.id)
      if (i >= 0) freelasEventoDemo[i] = linha
      else freelasEventoDemo.push(linha)
      return espera(structuredClone(linha))
    },
    async pedidoInsumosEvento(eventoId) {
      exigeGestao()
      return espera({ ...(pedidoInsumosDemo.get(eventoId) ?? {}) })
    },
    async salvarPedidoInsumosEvento(eventoId, valores) {
      exigeGestao()
      const m = { ...(pedidoInsumosDemo.get(eventoId) ?? {}) }
      for (const [k, q] of Object.entries(valores)) { if (q === null) delete m[k]; else m[k] = q }
      pedidoInsumosDemo.set(eventoId, m)
    },
    async diariasFreelaEvento(filtro) {
      exigeGestao()
      const r = diariasEventoDemo.filter((d) => ('eventoId' in filtro ? d.eventoId === filtro.eventoId && d.status !== 'recusado' : d.status === filtro.status))
      return espera(structuredClone(r).sort((a, b) => a.data.localeCompare(b.data) || a.enviadoEm.localeCompare(b.enviadoEm)))
    },
    async lancarDiariaFreelaEvento(d) {
      exigeGestao()
      const f = freelasEventoDemo.find((x) => x.id === d.freelaId)!
      if (diariasEventoDemo.some((x) => x.eventoId === d.eventoId && x.cpf === f.cpf && x.data === d.data && x.status !== 'recusado')) throw new Error('duplicate key')
      diariasEventoDemo.push({ ...diariaEv(novoId('de'), d.eventoId, 0, f, {}), data: d.data, funcao: d.funcao.trim(), valor: d.valor, observacao: d.observacao, origem: 'gestao', status: 'aprovado', enviadoEm: agora() })
    },
    async aprovarDiariaFreelaEvento(id, valor, funcao, usarPixNovo) {
      exigeGestao()
      const d = diariasEventoDemo.find((x) => x.id === id && x.status === 'pendente')
      if (!d) throw new Error('Essa diária já foi resolvida.')
      let f = freelasEventoDemo.find((x) => x.id === d.freelaId) ?? freelasEventoDemo.find((x) => x.cpf === d.cpf)
      if (!f) {
        f = { id: novoId('fe'), nome: d.nome ?? '', cpf: d.cpf, pix: d.pix ?? '', celular: d.celular, funcao: d.funcao, valorDiaria: null, observacao: null, ativo: true }
        freelasEventoDemo.push(f)
      } else if (usarPixNovo && d.pix) Object.assign(f, { pix: d.pix, celular: d.celular ?? f.celular, ativo: true })
      Object.assign(d, { status: 'aprovado', freelaId: f.id, valor, funcao: funcao.trim() || d.funcao })
    },
    async recusarDiariaFreelaEvento(id, motivo) {
      exigeGestao()
      const d = diariasEventoDemo.find((x) => x.id === id && x.status === 'pendente')
      if (d) Object.assign(d, { status: 'recusado', motivo: motivo.trim() || null })
    },
    async excluirDiariaFreelaEvento(id) {
      exigeGestao()
      const i = diariasEventoDemo.findIndex((x) => x.id === id)
      if (i >= 0) diariasEventoDemo.splice(i, 1)
    },
    async marcarPagoFreelaEvento(eventoId, freelaId, pago) {
      exigeGestao()
      for (const d of diariasEventoDemo) if (d.eventoId === eventoId && d.freelaId === freelaId && d.status === 'aprovado') d.pagoEm = pago ? agora() : null
    },
    async definirLocalEvento(eventoId, lat, lng) {
      exigeGestao()
      Object.assign(eventosDemo.find((e) => e.id === eventoId)!, { latitude: lat, longitude: lng })
    },
    async equipeEvento(eventoId) {
      exigeGestao()
      return espera(structuredClone(equipeEventoDemo.filter((m) => m.eventoId === eventoId)).sort((a, b) => a.ordem - b.ordem))
    },
    async salvarMembroEquipe(m) {
      exigeGestao()
      const repetido = equipeEventoDemo.find((x) => x.id !== m.id && x.eventoId === m.eventoId &&
        ((m.funcionarioId && x.funcionarioId === m.funcionarioId) || (m.freelaId && x.freelaId === m.freelaId)))
      if (repetido) throw new Error('Essa pessoa já está na equipe do evento.')
      const novo: MembroEquipeEvento = { ...m, id: m.id ?? novoId('eq'), nome: m.nome?.trim() || null, funcao: m.funcao?.trim() || null }
      const i = equipeEventoDemo.findIndex((x) => x.id === novo.id)
      if (i >= 0) equipeEventoDemo[i] = novo
      else equipeEventoDemo.push(novo)
      return structuredClone(novo)
    },
    async excluirMembroEquipe(id) {
      exigeGestao()
      const i = equipeEventoDemo.findIndex((x) => x.id === id)
      if (i >= 0) equipeEventoDemo.splice(i, 1)
    },
    async salvarLayoutBarracas(eventoId, layout) {
      exigeGestao()
      eventosDemo.find((e) => e.id === eventoId)!.layoutBarracas = structuredClone(layout)
    },
    async marcarForaDaMedia(eventoId, fora) {
      exigeGestao()
      eventosDemo.find((e) => e.id === eventoId)!.foraDaMedia = fora
    },
    async eventosAbertosDiaria() {
      const ini = addDias(hoje(), -13)
      return espera(eventosDemo
        .filter((e) => e.status !== 'cancelado' && e.dias.some((d) => d.data >= ini && d.data <= hoje()))
        .map((e) => ({ id: e.id, nome: e.nome, dias: e.dias.map((d) => d.data).filter((d) => d >= ini && d <= hoje()) })))
    },
    async freelaEventoQuemSou(cpf, celular) {
      const c = soDigitos(cpf)
      if (!cpfValido(c)) return espera({ tipo: 'invalido' as const })
      const f = freelasEventoDemo.find((x) => x.cpf === c)
      if (!f || (f.celular && f.celular.slice(-11) !== soDigitos(celular).slice(-11))) return espera({ tipo: 'novo' as const })
      return espera({ tipo: 'freelancer' as const, nome: f.nome.split(' ')[0], pixFinal: f.pix.slice(-4) })
    },
    async enviarDiariasEvento(e) {
      const quem = await this.freelaEventoQuemSou(e.cpf, e.celular)
      if (quem.tipo === 'invalido') throw new Error('CPF inválido. Confira os números.')
      const cpf = soDigitos(e.cpf)
      const celular = soDigitos(e.celular).slice(-11)
      const ev = eventosDemo.find((x) => x.id === e.eventoId && x.status !== 'cancelado')
      if (!ev) throw new Error('Evento não encontrado.')
      const f = freelasEventoDemo.find((x) => x.cpf === cpf)
      const nome = nomeProprio(e.nome) || (quem.tipo === 'freelancer' ? f?.nome : '') || ''
      const pix = e.pix.trim() || (quem.tipo === 'freelancer' ? f?.pix : '') || ''
      if (nome.split(/\s+/).length < 2) throw new Error('Coloque o nome completo.')
      if (!pix) throw new Error('Coloque a chave Pix.')
      if (!e.funcao.trim()) throw new Error('Diga a função que você fez.')
      if (!e.dias.length) throw new Error('Escolha pelo menos um dia.')
      const distancia = e.local && ev.latitude !== null && ev.longitude !== null ? Math.round(distanciaM(e.local.lat, e.local.lng, ev.latitude, ev.longitude)) : null
      let n = 0
      for (const d of e.dias) {
        if (d.data > hoje() || d.data < addDias(hoje(), -13)) throw new Error('Só dá para mandar diárias dos últimos 14 dias.')
        if (!ev.dias.some((x) => x.data === d.data)) throw new Error('O evento não teve esse dia.')
        if (diariasEventoDemo.some((x) => x.eventoId === ev.id && x.cpf === cpf && x.data === d.data && x.status !== 'recusado')) continue
        diariasEventoDemo.push({
          ...diariaEv(novoId('de'), ev.id, 0, f ?? null, {}), cpf, data: d.data, funcao: e.funcao.trim(), observacao: d.observacao?.trim() || null, nome, pix, celular,
          enviadoEm: agora(), distanciaM: distancia, noLocal: d.data === hoje() && distancia !== null && distancia - Math.min(e.local?.precisao ?? 0, 100) <= 300,
        })
        n++
      }
      return espera(n)
    },

    // Financeiro e estoque.
    async centrosCusto() {
      exigeGestaoOuProducao()
      return espera(centrosDemo.map((c) => ({ ...c })))
    },
    async planoContas() {
      exigeGestao()
      return espera([...planoDemo].sort((a, b) => a.ordem - b.ordem))
    },
    async salvarContaContabil(c) {
      exigeFinanceiro()
      if (planoDemo.some((x) => x.codigo === c.codigo.trim() && x.id !== c.id)) throw new Error('Já existe uma conta com este código.')
      const i = planoDemo.findIndex((x) => x.id === c.id)
      const nova = { ...c, codigo: c.codigo.trim(), nome: c.nome.trim(), id: c.id ?? novoId('pc') }
      if (i >= 0) planoDemo[i] = nova
      else planoDemo.push(nova)
      return espera(undefined)
    },
    async notasFiscais() {
      exigeGestao()
      return espera(notasDemo.map(({ itens: _, ...n }) => ({ ...n })).sort((a, b) => b.emissao.localeCompare(a.emissao)))
    },
    async notaFiscal(id) {
      exigeGestao()
      const n = notasDemo.find((x) => x.id === id)
      if (!n) throw new Error('Nota não encontrada.')
      return espera({ ...n, itens: (n.itens ?? []).map((i) => ({ ...i })) })
    },
    async importarNota(x) {
      exigeGestao()
      if (notasDemo.some((n) => n.chave === x.chave)) throw new Error(`Esta nota já foi importada (nº ${x.numero}).`)
      const cnpj = soDigitos(x.emitente.cnpj)
      let f = fornecedoresDemo.find((y) => y.cnpj === cnpj)
      if (!f) {
        f = { id: novoId('fo'), nome: x.emitente.fantasia?.trim() || x.emitente.nome.trim(), contato: null, telefone: null, observacao: x.emitente.nome, ativo: true, cnpj, contaPadraoId: null }
        fornecedoresDemo.push(f)
      }
      const id = novoId('nf')
      notasDemo.push({
        id, chave: x.chave, numero: x.numero, serie: x.serie, emissao: x.emissao, fornecedorId: f.id, emitenteCnpj: cnpj, emitenteNome: x.emitente.nome,
        destinatarioCnpj: x.destinatarioCnpj, centroCustoId: centrosDemo.find((c) => c.cnpj && c.cnpj === x.destinatarioCnpj)?.id ?? null,
        valorProdutos: x.totais.produtos, frete: x.totais.frete, desconto: x.totais.desconto, valorTotal: x.totais.total, pagamentoXml: x.pagamento,
        duplicatas: x.duplicatas, arquivo: null, observacao: null, status: 'conferir', lancadaEm: null, criadoEm: agora(),
        itens: x.itens.map((i, k) => {
          const m = mapaFornecedorDemo.get(`${cnpj}|${i.codigo}`)
          return { ...i, id: novoId('ni'), ordem: k + 1, insumoId: m?.insumoId ?? null, fator: m?.fator ?? null, foraEstoque: m?.foraEstoque ?? false }
        }),
      })
      return espera(id)
    },
    async criarNotaManual(x) {
      exigeGestao()
      const f = fornecedoresDemo.find((y) => y.id === x.fornecedorId)
      const id = novoId('nf')
      notasDemo.push({
        id, chave: null, numero: x.numero?.trim() || null, serie: null, emissao: x.emissao, fornecedorId: x.fornecedorId, emitenteCnpj: f?.cnpj ?? null,
        emitenteNome: x.emitenteNome?.trim() || f?.nome || null, destinatarioCnpj: null, centroCustoId: x.centroCustoId, valorProdutos: null, frete: null,
        desconto: null, valorTotal: x.valorTotal, pagamentoXml: [], duplicatas: [], arquivo: x.arquivo ? URL.createObjectURL(x.arquivo) : null,
        observacao: x.observacao?.trim() || null, status: 'conferir', lancadaEm: null, criadoEm: agora(), itens: [],
        extratoMovimentoId: x.extratoMovimentoId ?? null,
      })
      return espera(id)
    },
    async salvarItensNota(notaId, itens) {
      exigeGestao()
      const n = notasDemo.find((x) => x.id === notaId)
      if (!n || n.status !== 'conferir') throw new Error('Esta nota já foi lançada.')
      n.itens = itens.map((i, k) => ({
        id: novoId('ni'), ordem: k + 1, codigo: null, ean: null, descricao: i.descricao.trim(), ncm: null, cfop: null, unidade: i.unidade,
        quantidade: i.quantidade, valorUnit: i.quantidade > 0 ? i.valorTotal / i.quantidade : null, valorTotal: i.valorTotal, insumoId: i.insumoId, fator: null, foraEstoque: false,
      }))
      return espera(n.itens.map((i) => ({ ...i })))
    },
    async ligarNotaExtrato(notaId, movimentoId) {
      exigeGestao()
      if (movimentoId && notasDemo.some((x) => x.extratoMovimentoId === movimentoId && x.id !== notaId)) throw new Error('Este débito já está ligado a outra nota.')
      const n = notasDemo.find((x) => x.id === notaId)
      if (n && n.status === 'conferir') n.extratoMovimentoId = movimentoId
      return espera(undefined)
    },
    async linkArquivoNota(caminho) {
      return espera(caminho)
    },
    async lancarNota(id, l) {
      exigeGestao()
      const n = notasDemo.find((x) => x.id === id)
      if (!n) throw new Error('Nota não encontrada.')
      if (n.status === 'lancada') throw new Error('Esta nota já foi lançada.')
      if (!centrosDemo.some((c) => c.id === l.centroCustoId)) throw new Error('Escolha a loja da nota.')
      if (!l.parcelas.length) throw new Error('Coloque pelo menos um pagamento.')
      const soma = l.parcelas.reduce((s, p) => s + p.valor, 0)
      if (Math.abs(soma - n.valorTotal) > 0.05) {
        const br = (v: number) => v.toFixed(2).replace('.', ',')
        throw new Error(`Os pagamentos somam ${br(soma)} e a nota é de ${br(n.valorTotal)}. Confira as parcelas.`)
      }
      const mov = n.extratoMovimentoId ? extratoDemo.find((x) => x.id === n.extratoMovimentoId) : undefined
      if (mov && mov.status !== 'pendente') throw new Error('O débito do extrato ligado a esta nota já foi conciliado.')
      n.centroCustoId = l.centroCustoId
      for (const it of l.itens) {
        const x = n.itens?.find((y) => y.id === it.id)
        if (!x) continue
        Object.assign(x, { insumoId: it.insumoId, fator: it.fator, foraEstoque: it.foraEstoque })
        if (n.emitenteCnpj && x.codigo) mapaFornecedorDemo.set(`${n.emitenteCnpj}|${x.codigo}`, { insumoId: x.insumoId, fator: x.fator, foraEstoque: x.foraEstoque })
        if (x.insumoId && !x.foraEstoque) {
          const qtd = x.quantidade * (x.fator ?? 1)
          movimentosDemo.push({
            id: novoId('mv'), centroCustoId: l.centroCustoId, insumoId: x.insumoId, data: n.emissao, tipo: 'entrada_nf', quantidade: qtd,
            custoUnit: qtd > 0 ? x.valorTotal / qtd : null, notaItemId: x.id, observacao: `NF ${n.numero ?? ''} · ${n.emitenteNome ?? ''}`, criadoEm: agora(),
          })
          const ins = insumosDemo.find((y) => y.id === x.insumoId)
          if (l.atualizarPreco && ins && qtd > 0) Object.assign(ins, { preco: Math.round((x.valorTotal / qtd) * 10000) / 10000, precoEm: agora() })
        }
      }
      const forn = fornecedoresDemo.find((f) => f.id === n.fornecedorId)
      let ultima = ''
      l.parcelas.forEach((p, k) => {
        ultima = novoId('cp')
        contasPagarDemo.push(contaDemo(ultima, {
          centroCustoId: l.centroCustoId, contaId: l.contaId, fornecedorId: n.fornecedorId, favorecido: n.fornecedorId ? null : n.emitenteNome,
          descricao: `NF ${n.numero ?? 's/n'} · ${forn?.nome ?? n.emitenteNome ?? 'fornecedor'}`, competencia: (l.competencia ?? n.emissao).slice(0, 8) + '01',
          vencimento: p.vencimento, valor: p.valor, forma: p.forma, parcela: l.parcelas.length > 1 ? k + 1 : null, parcelas: l.parcelas.length > 1 ? l.parcelas.length : null,
          documento: p.documento ?? null, notaId: n.id,
          ...(mov ? { pagoEm: mov.data, valorPago: p.valor, conciliado: true, extratoMovimentoId: l.parcelas.length > 1 ? mov.id : null } : {}),
        }))
      })
      if (mov) Object.assign(mov, { status: 'conciliado', contaPagarId: l.parcelas.length === 1 ? ultima : null })
      if (forn && l.contaId) forn.contaPadraoId = l.contaId
      Object.assign(n, { status: 'lancada', lancadaEm: agora() })
      return espera(undefined)
    },
    async estornarNota(id) {
      exigeGestao()
      if (contasPagarDemo.some((c) => c.notaId === id && c.pagoEm)) throw new Error('Esta nota já tem pagamento registrado. Desfaça o pagamento antes.')
      const itens = new Set((notasDemo.find((x) => x.id === id)?.itens ?? []).map((i) => i.id))
      for (let i = contasPagarDemo.length - 1; i >= 0; i--) if (contasPagarDemo[i].notaId === id) contasPagarDemo.splice(i, 1)
      for (let i = movimentosDemo.length - 1; i >= 0; i--) if (movimentosDemo[i].notaItemId && itens.has(movimentosDemo[i].notaItemId!)) movimentosDemo.splice(i, 1)
      Object.assign(notasDemo.find((x) => x.id === id)!, { status: 'conferir', lancadaEm: null })
      return espera(undefined)
    },
    async excluirNota(id) {
      exigeGestao()
      const n = notasDemo.find((x) => x.id === id)
      if (n?.status === 'conferir') tira(notasDemo, id)
      return espera(undefined)
    },
    async contasPagar() {
      exigeFinanceiro()
      return espera(contasPagarDemo.map((c) => ({ ...c })).sort((a, b) => a.vencimento.localeCompare(b.vencimento)))
    },
    async contasDaNota(notaId) {
      exigeFinanceiro()
      return espera(contasPagarDemo.filter((c) => c.notaId === notaId).map((c) => ({ ...c })))
    },
    async salvarContasPagar(contas) {
      exigeFinanceiro()
      for (const c of contas) {
        if (!c.descricao.trim()) throw new Error('Coloque a descrição.')
        if (!(c.valor > 0)) throw new Error('O valor precisa ser maior que zero.')
        const { id, ...dados } = c
        const i = id ? contasPagarDemo.findIndex((x) => x.id === id) : -1
        if (i < 0 && c.origem && contasPagarDemo.some((x) => x.origem === c.origem)) continue
        if (i >= 0) Object.assign(contasPagarDemo[i], { ...dados, descricao: c.descricao.trim() })
        else contasPagarDemo.push(contaDemo(novoId('cp'), { ...dados, descricao: c.descricao.trim(), pagoEm: c.pagoEm ?? null, valorPago: c.pagoEm ? c.valorPago ?? c.valor : null }))
      }
      return espera(undefined)
    },
    async pagarConta(id, p) {
      exigeFinanceiro()
      const c = contasPagarDemo.find((x) => x.id === id)
      if (c) Object.assign(c, p ? { pagoEm: p.pagoEm, valorPago: p.valorPago, forma: p.forma } : { pagoEm: null, valorPago: null, conciliado: false })
      return espera(undefined)
    },
    async excluirContaPagar(id) {
      exigeFinanceiro()
      tira(contasPagarDemo, id)
      return espera(undefined)
    },
    async extrato() {
      exigeFinanceiro()
      return espera([...extratoDemo].sort((a, b) => b.data.localeCompare(a.data)).map((m) => ({ ...m })))
    },
    async saldosExtrato() {
      exigeFinanceiro()
      return espera([...saldosExtratoDemo])
    },
    async regrasExtrato() {
      exigeFinanceiro()
      return espera(regrasExtratoDemo.map((r) => ({ ...r })))
    },
    async importarExtrato(e) {
      exigeFinanceiro()
      let novos = 0
      for (const m of movimentosNovos(e.movimentos, extratoDemo.filter((x) => x.banco === e.banco && x.agencia === e.agencia && x.conta === e.conta))) {
        extratoDemo.push({ ...m, id: novoId('ex'), banco: e.banco, agencia: e.agencia, conta: e.conta, status: 'pendente', contaPagarId: null, observacao: null, importadoEm: agora() })
        novos++
      }
      if (e.saldo) {
        const i = saldosExtratoDemo.findIndex((s) => s.banco === e.banco && s.agencia === e.agencia && s.conta === e.conta && s.data === e.saldo!.data)
        const linha = { banco: e.banco, agencia: e.agencia, conta: e.conta, data: e.saldo.data, saldo: e.saldo.valor }
        if (i >= 0) saldosExtratoDemo[i] = linha
        else saldosExtratoDemo.push(linha)
      }
      return espera({ novos, repetidos: e.movimentos.length - novos })
    },
    async contasRecorrentes() {
      exigeFinanceiro()
      return espera(structuredClone(recorrentesDemo).sort((a, b) => a.dia - b.dia))
    },
    async salvarRecorrente(r) {
      exigeFinanceiro()
      if (!r.descricao.trim()) throw new Error('Coloque a descrição.')
      if (!(r.valor > 0)) throw new Error('O valor precisa ser maior que zero.')
      const i = recorrentesDemo.findIndex((x) => x.id === r.id)
      const salva: ContaRecorrente = { ...r, descricao: r.descricao.trim(), id: r.id ?? novoId('rc') }
      if (i >= 0) recorrentesDemo[i] = salva
      else recorrentesDemo.push(salva)
      for (const c of contasPagarDemo.filter((x) => x.recorrenteId === salva.id && !x.pagoEm && !x.conciliado && x.vencimento >= hoje())) {
        const mes = c.vencimento.slice(0, 7)
        if (salva.situacao !== 'ativa' || (salva.fim && mes > salva.fim)) contasPagarDemo.splice(contasPagarDemo.indexOf(c), 1)
        else Object.assign(c, { descricao: salva.descricao, valor: salva.valor, contaId: salva.contaId, centroCustoId: salva.centroCustoId, forma: salva.forma,
          fornecedorId: salva.fornecedorId, favorecido: salva.fornecedorId ? null : salva.fornecedorNome, vencimento: diaDoMesDemo(mes, salva.dia) })
      }
      return espera(structuredClone(salva))
    },
    async excluirRecorrente(id) {
      exigeFinanceiro()
      for (const c of contasPagarDemo.filter((x) => x.recorrenteId === id && !x.pagoEm)) contasPagarDemo.splice(contasPagarDemo.indexOf(c), 1)
      const i = recorrentesDemo.findIndex((x) => x.id === id)
      if (i >= 0) recorrentesDemo.splice(i, 1)
      return espera(undefined)
    },
    async atualizarContasAutomaticas(ateMes) {
      exigeFinanceiro()
      for (const r of recorrentesDemo.filter((x) => x.situacao === 'ativa')) {
        for (let m = r.inicio > mesAtual().slice(0, 7) ? r.inicio : mesAtual().slice(0, 7); m <= ateMes && (!r.fim || m <= r.fim); m = addMeses(m, 1)) {
          const origem = `rec:${r.id}:${m}`
          if (contasPagarDemo.some((c) => c.origem === origem)) continue
          contasPagarDemo.push(contaDemo(novoId('cp'), {
            descricao: r.descricao, vencimento: diaDoMesDemo(m, r.dia), valor: r.valor, contaId: r.contaId, centroCustoId: r.centroCustoId, forma: r.forma,
            fornecedorId: r.fornecedorId, favorecido: r.fornecedorId ? null : r.fornecedorNome, competencia: m + '-01', recorrenteId: r.id, origem,
            observacao: r.variavel ? 'Valor previsto (muda todo mês)' : null,
          }))
        }
      }
      return espera(undefined)
    },
    async conciliarLote(movimentoId, contaIds, contaDiferencaId) {
      exigeFinanceiro()
      const m = extratoDemo.find((x) => x.id === movimentoId)
      if (!m || m.status !== 'pendente') throw new Error('Este movimento já foi resolvido.')
      const contas = contasPagarDemo.filter((c) => contaIds.includes(c.id))
      if (!contas.length) throw new Error('Escolha as contas.')
      if (contas.some((c) => c.conciliado)) throw new Error('Alguma dessas contas já foi conciliada.')
      const soma = contas.reduce((t, c) => t + (c.valorPago ?? c.valor), 0)
      const dif = Math.round((Math.abs(m.valor) - soma) * 100) / 100
      if (dif < 0) throw new Error('As contas somam mais que o débito do banco. Tire alguma conta da seleção.')
      if (dif > 0 && !contaDiferencaId) throw new Error('Escolha onde lançar a diferença.')
      for (const c of contas) Object.assign(c, { conciliado: true, extratoMovimentoId: m.id, pagoEm: c.pagoEm ?? m.data, valorPago: c.valorPago ?? c.valor })
      if (dif > 0) contasPagarDemo.push(contaDemo(novoId('cp'), {
        descricao: 'Diferença · ' + m.descricao, vencimento: m.data, valor: dif, contaId: contaDiferencaId, centroCustoId: contas[0].centroCustoId,
        forma: 'transferencia', pagoEm: m.data, valorPago: dif, conciliado: true, extratoMovimentoId: m.id, observacao: 'Diferença lançada na conciliação',
      }))
      Object.assign(m, { status: 'conciliado' })
      return espera(undefined)
    },
    async conciliarMovimento(movimentoId, contaPagarId) {
      exigeFinanceiro()
      const m = extratoDemo.find((x) => x.id === movimentoId)
      const c = contasPagarDemo.find((x) => x.id === contaPagarId)
      if (!m || !c) throw new Error('Não encontrado.')
      if (m.status === 'conciliado') throw new Error('Este movimento já foi conciliado.')
      if (extratoDemo.some((x) => x.contaPagarId === contaPagarId)) throw new Error('Esta conta já está ligada a outro movimento do extrato.')
      Object.assign(c, { conciliado: true, pagoEm: c.pagoEm ?? m.data, valorPago: c.valorPago ?? Math.abs(m.valor) })
      Object.assign(m, { status: 'conciliado', contaPagarId })
      return espera(undefined)
    },
    async desconciliarMovimento(movimentoId) {
      exigeFinanceiro()
      const m = extratoDemo.find((x) => x.id === movimentoId)
      if (!m) return espera(undefined)
      const c = contasPagarDemo.find((x) => x.id === m.contaPagarId)
      if (c) c.conciliado = false
      for (const x of contasPagarDemo.filter((y) => y.extratoMovimentoId === m.id)) {
        if (x.observacao === 'Diferença lançada na conciliação') contasPagarDemo.splice(contasPagarDemo.indexOf(x), 1)
        else Object.assign(x, { conciliado: false, extratoMovimentoId: null })
      }
      Object.assign(m, { status: 'pendente', contaPagarId: null, observacao: null })
      return espera(undefined)
    },
    async pagamentosFuncionario(fid) {
      exigeGestao()
      return espera(contasPagarDemo.filter((c) => c.funcionarioId === fid || (c.origem ?? '').startsWith(`sal:${fid}:`))
        .sort((a, b) => (b.pagoEm ?? b.vencimento).localeCompare(a.pagoEm ?? a.vencimento))
        .map((c) => ({ id: c.id, descricao: c.descricao, vencimento: c.vencimento, pagoEm: c.pagoEm, valor: c.valorPago ?? c.valor, forma: c.forma, conta: planoDemo.find((p) => p.id === c.contaId)?.nome ?? null, conciliado: c.conciliado })))
    },
    async registrarMovimento(movimentoId, r) {
      exigeFinanceiro()
      const m = extratoDemo.find((x) => x.id === movimentoId)
      if (!m || m.status !== 'pendente') throw new Error('Este movimento já foi resolvido.')
      if (m.valor >= 0) throw new Error('Só saídas viram conta a pagar.')
      if (!r.centroCustoId) throw new Error('Escolha a loja.')
      const id = novoId('cp')
      contasPagarDemo.push(contaDemo(id, {
        centroCustoId: r.centroCustoId, contaId: r.contaId, fornecedorId: r.fornecedorId ?? null, funcionarioId: r.funcionarioId ?? null, motoboyId: r.motoboyId ?? null, favorecido: r.fornecedorId ? null : r.favorecido || null, descricao: r.descricao.trim() || m.descricao,
        competencia: m.data.slice(0, 8) + '01', vencimento: m.data, valor: -m.valor, forma: 'transferencia', pagoEm: m.data, valorPago: -m.valor, conciliado: true,
        observacao: 'Lançada pela conciliação bancária',
      }))
      Object.assign(m, { status: 'conciliado', contaPagarId: id })
      if (r.chave) {
        const i = regrasExtratoDemo.findIndex((x) => x.chave === r.chave)
        const regra = { chave: r.chave, centroCustoId: r.centroCustoId, contaId: r.contaId, favorecido: r.favorecido, fornecedorId: r.fornecedorId ?? null, funcionarioId: r.funcionarioId ?? null, motoboyId: r.motoboyId ?? null, ignorar: false }
        if (i >= 0) regrasExtratoDemo[i] = regra
        else regrasExtratoDemo.push(regra)
      }
      return espera(undefined)
    },
    async ignorarMovimento(movimentoId, motivo, chaveSempre) {
      exigeFinanceiro()
      const m = extratoDemo.find((x) => x.id === movimentoId)
      if (m) Object.assign(m, { status: 'ignorado', observacao: motivo })
      if (chaveSempre) {
        const i = regrasExtratoDemo.findIndex((x) => x.chave === chaveSempre)
        const regra = { chave: chaveSempre, centroCustoId: null, contaId: null, favorecido: motivo, ignorar: true }
        if (i >= 0) regrasExtratoDemo[i] = regra
        else regrasExtratoDemo.push(regra)
      }
      return espera(undefined)
    },
    async movimentosEstoque(de, ate) {
      exigeGestao()
      return espera(movimentosDemo.filter((m) => m.data >= de && m.data <= ate).sort((a, b) => b.data.localeCompare(a.data)))
    },
    async saldosEstoque(centroCustoId) {
      exigeGestao()
      const m = new Map<string, { insumoId: string; quantidade: number; custo: number | null; ultima: string }>()
      for (const x of [...movimentosDemo].filter((x) => x.centroCustoId === centroCustoId).sort((a, b) => a.data.localeCompare(b.data) || a.criadoEm.localeCompare(b.criadoEm))) {
        const s = m.get(x.insumoId) ?? { insumoId: x.insumoId, quantidade: 0, custo: null, ultima: x.data }
        s.quantidade += x.quantidade
        if (x.quantidade > 0 && x.custoUnit !== null) s.custo = x.custoUnit
        s.ultima = x.data
        m.set(x.insumoId, s)
      }
      return espera([...m.values()])
    },
    async producoes(de, ate) {
      exigeGestaoOuProducao()
      return espera(producoesDemo.filter((p) => p.data >= de && p.data <= ate).sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm)).map((p) => ({ ...p })))
    },
    async lancarProducao(n) {
      const u = exigeGestaoOuProducao()
      if (!n.centroCustoId) throw new Error('Escolha a loja.')
      if (!(n.quantidade > 0)) throw new Error('Diga quanto foi produzido.')
      const r = n.receitaId ? receitasDemo.find((x) => x.id === n.receitaId) : undefined
      let insumoId = n.insumoId
      if (r) {
        insumoId = r.insumoId ?? insumosDemo.find((i) => i.nome.toLowerCase() === r.nome.toLowerCase())?.id ?? null
        if (!insumoId) {
          insumoId = novoId('in')
          insumosDemo.push(ins(insumoId, r.nome, 'Pré-preparos', r.unidade, null, null, { observacao: 'Produção própria (criado ao lançar a produção).' }))
        }
        r.insumoId = insumoId
      }
      if (!insumoId) throw new Error('Escolha o que foi produzido.')
      if (n.saidas.some((x) => x.insumoId === insumoId)) throw new Error('O preparo não pode ser ingrediente dele mesmo.')
      const custo = n.saidas.reduce((t, x) => t + x.quantidade * (insumosDemo.find((i) => i.id === x.insumoId)?.preco ?? 0), 0)
      const id = novoId('pr')
      producoesDemo.push({ id, centroCustoId: n.centroCustoId, data: n.data, receitaId: r?.id ?? null, versao: r?.versaoAtual ?? null, insumoId, quantidade: n.quantidade, custoTotal: Math.round(custo * 10000) / 10000, observacao: n.observacao.trim() || null, criadoEm: agora(), criadoPor: u.id })
      const nome = insumosDemo.find((i) => i.id === insumoId)?.nome ?? ''
      for (const x of n.saidas.filter((x) => x.quantidade > 0)) movimentosDemo.push({ id: novoId('mv'), centroCustoId: n.centroCustoId, insumoId: x.insumoId, data: n.data, tipo: 'saida', quantidade: -x.quantidade, custoUnit: null, notaItemId: null, observacao: 'Produção de ' + nome, criadoEm: agora(), producaoId: id })
      movimentosDemo.push({ id: novoId('mv'), centroCustoId: n.centroCustoId, insumoId, data: n.data, tipo: 'entrada', quantidade: n.quantidade, custoUnit: custo > 0 ? custo / n.quantidade : null, notaItemId: null, observacao: 'Produção' + (n.observacao.trim() ? ' · ' + n.observacao.trim() : ''), criadoEm: agora(), producaoId: id })
      const i = insumosDemo.find((x) => x.id === insumoId)
      if (i) Object.assign(i, { ativo: true, ...(custo > 0 ? { preco: Math.round((custo / n.quantidade) * 10000) / 10000, precoEm: agora() } : {}) })
      return espera(id)
    },
    async desfazerProducao(id) {
      exigeGestao()
      const k = producoesDemo.findIndex((p) => p.id === id)
      if (k >= 0) producoesDemo.splice(k, 1)
      for (let j = movimentosDemo.length - 1; j >= 0; j--) if (movimentosDemo[j].producaoId === id) movimentosDemo.splice(j, 1)
      return espera(undefined)
    },
    async pedidosCompra() {
      exigeGestaoOuProducao()
      return espera(structuredClone(pedidosCompraDemo).sort((a, b) => b.previsaoEntrega.localeCompare(a.previsaoEntrega)))
    },
    async salvarPedidoCompra(p) {
      const u = exigeGestao()
      if (!p.fornecedorId) throw new Error('Escolha o fornecedor.')
      const itens = p.itens.filter((i) => i.quantidade > 0)
      const total = Math.round(itens.reduce((t, i) => t + i.quantidade * (i.preco ?? 0), 0) * 100) / 100
      const atual = p.id ? pedidosCompraDemo.find((x) => x.id === p.id) : undefined
      if (atual) Object.assign(atual, { ...p, itens, total })
      else pedidosCompraDemo.push({ ...p, id: novoId('pc'), numero: pedidosCompraDemo.length + 1, itens, total, recebidoEm: null, criadoEm: agora(), criadoPor: u.id } as PedidoCompra)
      return espera(structuredClone(atual ?? pedidosCompraDemo[pedidosCompraDemo.length - 1]))
    },
    async receberPedidoCompra(id, recebido) {
      exigeGestaoOuProducao()
      const p = pedidosCompraDemo.find((x) => x.id === id)
      if (p) Object.assign(p, { status: recebido ? 'recebido' : 'pedido', recebidoEm: recebido ? hoje() : null })
      return espera(undefined)
    },
    async precosFornecedor(fornecedorId) {
      exigeGestao()
      const r = new Map<string, PrecoFornecedor>()
      for (const p of [...pedidosCompraDemo].filter((x) => x.fornecedorId === fornecedorId && x.status !== 'cancelado').sort((a, b) => a.dataPedido.localeCompare(b.dataPedido) || a.criadoEm.localeCompare(b.criadoEm)))
        for (const i of p.itens) if (i.preco) r.set(i.insumoId, { insumoId: i.insumoId, preco: i.preco, em: p.dataPedido, origem: 'pedido' })
      for (const h of historicoComprasDemo.filter((x) => x.fornecedorId === fornecedorId).sort((a, b) => a.dia.localeCompare(b.dia)))
        if (!r.has(h.insumoId) || r.get(h.insumoId)!.em < h.dia) r.set(h.insumoId, { insumoId: h.insumoId, preco: h.preco, em: h.dia, origem: 'historico' })
      return espera([...r.values()])
    },
    async comprasDoFornecedor(fornecedorId) {
      exigeGestao()
      // Compras por dia (histórico de exemplo + pedidos), últimas 12 semanas.
      const dias = new Map<string, Map<string, number>>()
      const somar = (insumoId: string, dia: string, q: number) => {
        const m = dias.get(insumoId) ?? new Map<string, number>()
        m.set(dia, (m.get(dia) ?? 0) + q)
        dias.set(insumoId, m)
      }
      for (const h of historicoComprasDemo) if (h.fornecedorId === fornecedorId) somar(h.insumoId, h.dia, h.quantidade)
      for (const p of pedidosCompraDemo) if (p.fornecedorId === fornecedorId && (p.status === 'pedido' || p.status === 'recebido'))
        for (const i of p.itens) if (i.quantidade > 0) somar(i.insumoId, p.recebidoEm ?? p.previsaoEntrega, i.quantidade)
      const desde = addDias(hoje(), -84)
      const r: CompraFornecedor[] = [...dias].map(([insumoId, m]) => {
        const ds = [...m.keys()].sort()
        const rec = ds.filter((d) => d >= desde)
        const q = rec.reduce((t, d) => t + m.get(d)!, 0)
        return {
          insumoId, compras: rec.length, quantidade: rec.length ? q : null, porSemana: Math.round((q / 12) * 1000) / 1000, porCompra: rec.length ? Math.round((q / rec.length) * 1000) / 1000 : null,
          intervaloDias: ds.length > 1 ? Math.round((diasEntre(ds[0], ds[ds.length - 1]) / (ds.length - 1)) * 10) / 10 : null, ultima: ds[ds.length - 1], ultimaQtd: m.get(ds[ds.length - 1])!,
        }
      })
      return espera(r.sort((a, b) => b.compras - a.compras || b.ultima.localeCompare(a.ultima)))
    },
    async produtosVenda() {
      exigeGestao()
      return espera(structuredClone(produtosVendaDemo).sort((a, b) => a.nome.localeCompare(b.nome)))
    },
    async salvarProdutoVenda(p) {
      exigeGestao()
      if (!p.nome.trim()) throw new Error('Dê um nome ao produto.')
      if (p.ecleticaCodigo && produtosVendaDemo.some((x) => x.ecleticaCodigo === p.ecleticaCodigo && x.id !== p.id)) throw new Error('duplicate key: código já usado')
      const atual = p.id ? produtosVendaDemo.find((x) => x.id === p.id) : undefined
      const novo: ProdutoVenda = { ...p, id: atual?.id ?? novoId('pv'), nome: nomeItem(p.nome) }
      if (atual) Object.assign(atual, novo)
      else produtosVendaDemo.push(novo)
      return espera(structuredClone(novo))
    },
    async listaFechamento(unidadeId, setor, data) {
      const u = exigeEu()
      if (!(podeGerenciar(u.nivel) || u.setor === 'producao' || u.unidadeId === unidadeId)) return espera([])
      const f = fechamentosDemo.find((x) => x.unidadeId === unidadeId && x.setor === setor && x.data === data)
      const dia = (new Date(addDias(data, 1) + 'T12:00:00').getDay() + 6) % 7
      return espera(listaFechDemo.filter((i) => i.unidadeId === unidadeId && i.setor === setor && i.ativo).map((i): ItemFechamento => {
        const c = f && contagensFechDemo.find((x) => x.fechamentoId === f.id && x.itemId === i.id)
        return {
          itemId: i.id, insumoId: i.insumoId, nome: insumosDemo.find((x) => x.id === i.insumoId)?.nome ?? '', categoria: insumosDemo.find((x) => x.id === i.insumoId)?.categoria ?? null, unidadeContagem: i.unidadeContagem, ordem: i.ordem,
          prePreparo: prePreparoDemo.has(i.insumoId), ideal: i.ideal[dia] ?? null, contagem: c?.contagem ?? null, sugestao: c?.sugestao ?? null, pedido: c?.pedido ?? null,
        }
      }))
    },
    async fechamentos(de, ate) {
      const u = exigeEu()
      return espera(fechamentosDemo.filter((f) => f.data >= de && f.data <= ate && (podeGerenciar(u.nivel) || u.setor === 'producao' || u.unidadeId === f.unidadeId)).map((f) => ({ ...f })))
    },
    async enviarFechamento(e) {
      const u = exigeEu()
      if (!(podeGerenciar(u.nivel) || u.unidadeId === e.unidadeId)) throw new Error('Só quem é desta loja (ou a gestão) envia o fechamento.')
      let f = fechamentosDemo.find((x) => x.unidadeId === e.unidadeId && x.setor === e.setor && x.data === e.data)
      const dados = { responsavel: e.responsavel.trim() || null, observacao: e.observacao.trim() || null, fala: e.fala.trim() || null, enviadoEm: agora(), enviadoPor: u.id }
      if (f) Object.assign(f, dados)
      else fechamentosDemo.push((f = { id: novoId('fc'), unidadeId: e.unidadeId, setor: e.setor, data: e.data, para: addDias(e.data, 1), ...dados }))
      const id = f.id
      for (let j = contagensFechDemo.length - 1; j >= 0; j--) if (contagensFechDemo[j].fechamentoId === id) contagensFechDemo.splice(j, 1)
      for (const i of e.itens) contagensFechDemo.push({ fechamentoId: id, itemId: i.itemId, contagem: i.contagem, sugestao: i.sugestao, pedido: i.pedido || null })
      return espera(id)
    },
    async inventariosEstoque(centroCustoId) {
      return espera(invLojasDemo.filter((x) => x.centroCustoId === centroCustoId).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 12))
    },
    async curvaAbc() {
      // Demo: valor comprado = preço × um volume fixo por item, só para mostrar as classes.
      const v = insumosDemo.filter((i) => i.preco).map((i, k) => ({ insumoId: i.id, valor: (i.preco ?? 0) * (40 - k) * 10 })).sort((a, b) => b.valor - a.valor)
      const total = v.reduce((t, x) => t + x.valor, 0)
      let acum = 0
      return espera(v.map((x): CurvaAbc => {
        const antes = acum
        acum += x.valor / total
        return { ...x, participacao: Math.round((x.valor / total) * 10000) / 100, classe: antes < 0.8 ? 'A' : antes < 0.95 ? 'B' : 'C' }
      }))
    },
    async enviarInventario(e) {
      const u = exigeEu()
      if (!(podeGerenciar(u.nivel) || u.setor === 'producao' || u.unidadeId === e.centroCustoId)) throw new Error('Seu nível de acesso não permite esta ação.')
      let v = invLojasDemo.find((x) => x.centroCustoId === e.centroCustoId && x.data === e.data)
      const dados = { responsavel: e.responsavel.trim() || null, observacao: e.observacao.trim() || null, fala: e.fala.trim() || null, enviadoEm: agora(), enviadoPor: u.id }
      if (v) Object.assign(v, dados)
      else invLojasDemo.push((v = { id: novoId('inv'), centroCustoId: e.centroCustoId, data: e.data, ...dados, itens: [] }))
      const id = v.id
      const antigos = new Set(movsInventarioDemo.get(id) ?? [])
      for (let j = movimentosDemo.length - 1; j >= 0; j--) if (antigos.has(movimentosDemo[j].id)) movimentosDemo.splice(j, 1)
      const novos: string[] = []
      const saldo = (insumoId: string) => movimentosDemo.filter((m) => m.centroCustoId === e.centroCustoId && m.insumoId === insumoId).reduce((t, m) => t + m.quantidade, 0)
      v.itens = e.itens.map((i) => ({ insumoId: i.insumoId, quantidade: i.quantidade, saldoSistema: saldo(i.insumoId), custoUnit: insumosDemo.find((x) => x.id === i.insumoId)?.preco ?? null }))
      for (const i of v.itens) {
        const dif = i.quantidade - i.saldoSistema
        if (Math.abs(dif) <= 0.0001) continue
        const mid = novoId('mv')
        novos.push(mid)
        movimentosDemo.push({ id: mid, centroCustoId: e.centroCustoId, insumoId: i.insumoId, data: e.data, tipo: 'ajuste', quantidade: dif, custoUnit: i.custoUnit, notaItemId: null, observacao: `Inventário ${e.data.slice(8)}/${e.data.slice(5, 7)}`, criadoEm: agora() })
      }
      movsInventarioDemo.set(id, novos)
      return espera(id)
    },
    async pedidosProducao(para) {
      const u = exigeEu()
      if (!(podeGerenciar(u.nivel) || u.setor === 'producao')) return espera([])
      const r = new Map<string, PedidoProducao>()
      for (const f of fechamentosDemo.filter((x) => x.para === para))
        for (const c of contagensFechDemo.filter((x) => x.fechamentoId === f.id && (x.pedido ?? 0) > 0)) {
          const it = listaFechDemo.find((x) => x.id === c.itemId)!
          const ins = insumosDemo.find((x) => x.id === it.insumoId)!
          const p = r.get(ins.id) ?? {
            insumoId: ins.id, nome: ins.nome, setor: f.setor, unidadeContagem: it.unidadeContagem, unidade: ins.unidade, prePreparo: prePreparoDemo.has(ins.id),
            psd: null, va: null, total: 0, central: movimentosDemo.filter((m) => m.centroCustoId === 'central' && m.insumoId === ins.id).reduce((t, m) => t + m.quantidade, 0),
          }
          if (f.unidadeId === 'burger-psd') p.psd = (p.psd ?? 0) + c.pedido!
          else p.va = (p.va ?? 0) + c.pedido!
          p.total += c.pedido!
          r.set(ins.id, p)
        }
      return espera([...r.values()].sort((a, b) => Number(b.prePreparo) - Number(a.prePreparo) || a.setor.localeCompare(b.setor) || a.nome.localeCompare(b.nome)))
    },
    async contarCentral(data, itens) {
      const u = exigeEu()
      if (!(podeGerenciar(u.nivel) || u.setor === 'producao')) throw new Error('Seu nível de acesso não permite esta ação.')
      let n = 0
      for (const i of itens) {
        const saldo = movimentosDemo.filter((m) => m.centroCustoId === 'central' && m.insumoId === i.insumoId).reduce((t, m) => t + m.quantidade, 0)
        const dif = i.quantidade - saldo
        if (Math.abs(dif) > 0.0001) {
          movimentosDemo.push({ id: novoId('mv'), centroCustoId: 'central', insumoId: i.insumoId, data, tipo: 'ajuste', quantidade: dif, custoUnit: null, notaItemId: null, observacao: 'Contagem da produção: ' + i.quantidade, criadoEm: agora() })
          n++
        }
      }
      return espera(n)
    },
    async itensListaFechamento(unidadeId, setor) {
      exigeGestao()
      return espera(listaFechDemo.filter((i) => i.unidadeId === unidadeId && i.setor === setor).sort((a, b) => a.ordem - b.ordem)
        .map((i) => ({ ...i, ideal: [...i.ideal], nome: insumosDemo.find((x) => x.id === i.insumoId)?.nome ?? '', categoria: insumosDemo.find((x) => x.id === i.insumoId)?.categoria ?? null, prePreparo: prePreparoDemo.has(i.insumoId) })))
    },
    async salvarItemListaFechamento(i) {
      exigeGestao()
      const comum = { unidadeContagem: i.unidadeContagem.trim() || 'Uni', ordem: i.ordem, ativo: i.ativo }
      const atual = listaFechDemo.find((x) => x.unidadeId === i.unidadeId && x.setor === i.setor && x.insumoId === i.insumoId)
      if (atual) {
        // Item tirado antes e adicionado de novo volta a valer nas duas lojas.
        atual.ideal = [...i.ideal]
        for (const x of listaFechDemo.filter((x) => x.setor === i.setor && x.insumoId === i.insumoId)) Object.assign(x, comum)
      } else {
        for (const u of ['burger-psd', 'burger-va'])
          listaFechDemo.push({ id: novoId('fi'), nome: '', unidadeId: u, setor: i.setor, insumoId: i.insumoId, ...comum, ideal: u === i.unidadeId ? [...i.ideal] : Array(7).fill(null), prePreparo: false })
      }
      if (i.prePreparo) prePreparoDemo.add(i.insumoId)
      else prePreparoDemo.delete(i.insumoId)
      return espera(undefined)
    },
    async lancarMovimentoEstoque(m) {
      exigeGestao()
      for (const x of Array.isArray(m) ? m : [m]) movimentosDemo.push({ ...x, id: novoId('mv'), custoUnit: x.custoUnit ?? null, notaItemId: null, observacao: x.observacao?.trim() || null, criadoEm: agora() })
      return espera(undefined)
    },
  }
}
