import type { Funcionario, Nivel } from './types'

// Regra decidida em 06/10: Funcionário e Supervisor só visualizam;
// Gerente, Administrativo e Proprietário cadastram, desligam e publicam.
const GESTAO: Nivel[] = ['gerente', 'administrativo', 'proprietario']

// Painel inicial com indicadores por área (pedido de 06/10: Proprietário e Gerente).
export const podeVerPainel = (n: Nivel) => n === 'proprietario' || n === 'gerente'

export const podeGerenciar = (n: Nivel) => GESTAO.includes(n)

// O proprietário não entra no controle de exames nem assina o regulamento (pedido de 07/10).
// Menu Produção: gestão, setor Produção e supervisores (Heitor, 14/10).
export const vejoProducao = (eu: { nivel: Nivel; setor?: string | null }) => podeGerenciar(eu.nivel) || eu.setor === 'producao' || eu.nivel === 'supervisor'
// Compras e Estoque: gestão e supervisores (Heitor, 14/10).
export const operaEstoque = (n: Nivel) => podeGerenciar(n) || n === 'supervisor'
export const isentoDeRotinas = (n: Nivel) => n === 'proprietario'

// Chamados: o manutencista e a gestão veem todos e mudam o andamento.
export const atendeChamados = (n: Nivel) => n === 'manutencao' || podeGerenciar(n)

// Supervisor enxerga a equipe da própria unidade, sem editar.
export const podeVerEquipe = (n: Nivel) => n !== 'funcionario' && n !== 'manutencao'

// Documentos e atestados são dados sensíveis (LGPD): só o próprio funcionário e a gestão.
export const podeVerDocumentosDe = (eu: Funcionario, alvo: Funcionario) =>
  eu.id === alvo.id || podeGerenciar(eu.nivel)

export const podeVerFuncionario = (eu: Funcionario, alvo: Funcionario) =>
  eu.id === alvo.id ||
  podeGerenciar(eu.nivel) ||
  (eu.nivel === 'supervisor' && eu.unidadeId === alvo.unidadeId)

// Faturamento e resultado (DRE) do Lucro Fácil: só Proprietário e Administrativo.
export const vejoResultado = (n: Nivel) => n === 'proprietario' || n === 'administrativo'

// Hierarquia (pedido de 07/10): ninguém altera dados de quem está acima nem dá um nível acima do seu.
// Gerente e Administrativo ficam no mesmo degrau.
const DEGRAU: Record<Nivel, number> = { funcionario: 1, manutencao: 1, supervisor: 2, gerente: 3, administrativo: 3, proprietario: 4 }
export const degrau = (n: Nivel) => DEGRAU[n] ?? 0
export const possoAlterar = (eu: Funcionario, alvo: Funcionario) => podeGerenciar(eu.nivel) && degrau(alvo.nivel) <= degrau(eu.nivel)
export const niveisQuePossoDar = (eu: Funcionario) => (n: Nivel) => degrau(n) <= degrau(eu.nivel)

// Aviso de férias vencendo na página inicial: Administrativo e Gerente (o Proprietário não, pedido de 07/10).
export const avisaFerias = (n: Nivel) => n === 'administrativo' || n === 'gerente'
