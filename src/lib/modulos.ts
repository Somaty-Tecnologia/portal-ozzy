import { operaEstoque, podeGerenciar, vejoProducao, vejoResultado } from './permissoes'
import { LOJAS_FECHAMENTO, type Funcionario } from './types'

// Checklists: até o Heitor aprovar, só a gestão vê no portal de verdade (na demonstração, todos).
export const CHECKLISTS_PARA_EQUIPE = import.meta.env.MODE === 'preview'

export type IdIcone =
  | 'inicio' | 'rh' | 'freelancers' | 'motoboys' | 'fechamento' | 'producao' | 'fichas' | 'financeiro' | 'cadastros' | 'compras' | 'estoque'
  | 'checklists' | 'regras' | 'treinamentos' | 'manutencao' | 'eventos' | 'refeicoes'

export interface Modulo {
  id: IdIcone
  nome: string
  pronto: boolean
  // Para os módulos "em breve": o que vai ter e de onde vêm os dados.
  resumo?: string
  itens?: string[]
  origem?: string
  soGestao?: boolean
  // Regra própria de quem vê (no lugar de soGestao).
  ve?: (eu: Funcionario) => boolean
}

// Ordem do menu lateral. Funcionário, Supervisor e Manutenção não veem Fichas,
// Compras, Estoque e Eventos (pedido de 07/10). Os "em breve" seguem o plano e o roteiro da reunião de regras.
export const MODULOS: Modulo[] = [
  { id: 'inicio', nome: 'Início', pronto: true },
  { id: 'rh', nome: 'Departamento Pessoal', pronto: true },
  // Refeição da equipe (13/10): todos veem e votam; o manutencista e a gestão montam o prato.
  { id: 'refeicoes', nome: 'Refeição do dia', pronto: true },
  // Menu próprio (pedido de 08/10), para a gestão achar rápido as diárias enviadas.
  { id: 'freelancers', nome: 'Freelancers', pronto: true, soGestao: true },
  // Cadastro e pagamento semanal dos motoboys (09/10), que não são da equipe.
  { id: 'motoboys', nome: 'Motoboys', pronto: true, soGestao: true },
  // Central de produção (09/10): lançar o que foi produzido; depois pedidos das lojas e lista de preparo.
  // Fechamento das lojas (09/10): quem é da PSD ou da Vila conta o estoque no fim do turno e faz o pedido à Central.
  { id: 'fechamento', nome: 'Fechamento e pedido', pronto: true, ve: (eu) => podeGerenciar(eu.nivel) || (LOJAS_FECHAMENTO.includes(eu.unidadeId as never) && eu.nivel !== 'manutencao') },
  // Central de produção (09/10): pedidos das lojas, lista de preparo e o que foi produzido. Gestão e quem é da produção.
  { id: 'producao', nome: 'Produção', pronto: true, ve: (eu) => vejoProducao(eu) },
  { id: 'fichas', nome: 'Fichas técnicas', pronto: true, soGestao: true },
  {
    id: 'financeiro', nome: 'Financeiro', pronto: true, ve: (eu) => vejoResultado(eu.nivel),
    resumo: 'Contas a pagar, despesas por conta contábil e loja, e o resultado do Lucro Fácil.',
  },
  // Cadastros da Eclética (09/10): materiais (insumos), produtos de venda com preço e fornecedores, num lugar só.
  { id: 'cadastros', nome: 'Cadastros', pronto: true, soGestao: true },
  {
    id: 'compras', nome: 'Compras', pronto: true, ve: (eu) => operaEstoque(eu.nivel) || eu.setor === 'producao',
    resumo: 'Do pedido de compra até a conferência da nota.',
    itens: ['Solicitação de compra por unidade', 'Cotação e aprovação por valor', 'Recebimento com conferência e fotos'],
  },
  {
    id: 'estoque', ve: (eu) => operaEstoque(eu.nivel), nome: 'Estoque', pronto: true,
    resumo: 'Entradas, saídas e perdas sob controle.',
    itens: ['Inventário semanal', 'Transferências entre Burger e Pizza', 'Registro de perdas com motivo'],
  },
  // Checklists (15/10, no lugar do Konclui). Até o Heitor aprovar, só a gestão vê (na demonstração, todos).
  {
    id: 'checklists', nome: 'Checklists', pronto: true, ve: (eu) => podeGerenciar(eu.nivel) || CHECKLISTS_PARA_EQUIPE,
    resumo: 'Abertura, fechamento e limpeza de cada pessoa.',
  },
  {
    id: 'regras', nome: 'Regras e processos', pronto: true,
    resumo: 'A versão oficial de como a The Ozzy funciona.',
    itens: ['POPs e políticas por área', 'Manual de exceções', 'Assistente que responde dúvidas só com base nas regras oficiais'],
    origem: 'Conteúdo da reunião de estrutura, regras e processos.',
  },
  {
    id: 'treinamentos', nome: 'Treinamentos', pronto: false,
    resumo: 'Vídeos curtos, gravados pela própria equipe.',
    itens: ['Trilhas por cargo', 'Treinamento obrigatório para quem entra', 'Progresso de cada funcionário'],
  },
  {
    id: 'manutencao', nome: 'Manutenção', pronto: true,
    resumo: 'Equipamento parado não pode esperar.',
    itens: ['Cadastro de equipamentos críticos', 'Abertura e acompanhamento de chamados', 'Agenda de manutenção preventiva'],
  },
  {
    // Entrega 1 (08/10): cadastro de eventos. Fichas, previsão, insumos e simulador vêm em seguida.
    id: 'eventos', soGestao: true, nome: 'Eventos', pronto: true,
    resumo: 'Do orçamento ao resultado de cada evento.',
    itens: ['Cadastro e status de cada evento', 'Cardápio, fichas e previsão de vendas', 'Insumos, simulador e resultado'],
  },
]

export const modulosVisiveis = (eu: Funcionario) => MODULOS.filter((m) => (m.ve ? m.ve(eu) : !m.soGestao || podeGerenciar(eu.nivel)))
