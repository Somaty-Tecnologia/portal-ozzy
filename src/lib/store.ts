import type { EnvioInventario, InventarioEstoque, ItemNota, ItemRecibo, ReferenciaPreco } from './types'
import type { SaldoEstoque, CompraFornecedor, ProdutoVenda, PedidoCompra, NovoPedidoCompra, PrecoFornecedor, SetorFechamento, ItemFechamento, Fechamento, EnvioFechamento, PedidoProducao, ItemListaFechamento, Producao, NovaProducao, Motoboy, SemanaMotoboy, LinhaSemanaMotoboy, PagamentoPessoa, CentroCusto, ContaContabil, NotaFiscal, NotaImportada, LancamentoNota, ContaPagar, NovaContaPagar, ContaRecorrente, FormaPagamento, MovimentoEstoque, MovimentoExtrato, RegraExtrato, SaldoExtrato, ExtratoOfx, MembroEquipeEvento, FreelaEvento, DiariaFreelaEvento, EventoAberto, ProdutoEvento, QtdDiaProduto, VendaEvento, ItemModeloChecklist, EnvioEvento, NovoItemEnvio, Inventario, ItemContagem, EventoEscalado, Fornecedor, Insumo, PrecoInsumo, Receita, VersaoReceita, ItemReceita, Evento, NovoEvento, HistoricoEvento, Operacao, Admissao, AjustePonto, DevolucaoUniforme, ItemDevolucao, TipoAjustePonto, LocalEnvio, LocalLoja, EnvioFreela, DiaEnviado, QuemSouFreela, StatusEnvioFreela, ContaPagamento, RemessaPagamento, Setor, VinculoAnterior, SolicitacaoUniforme, PedidoUniforme, ItemPedidoUniforme, MovimentoUniforme, NovoMovimentoUniforme, StatusTroca, Equipamento, ManutencaoEquipamento, Preventiva, ExecucaoPreventiva, Desligamento, DecimoTerceiro, Ferias, TipoFolga, Salario, TipoPagamento, Freelancer, DiariaFreela, PagamentoFreela, ResultadoMes, Avaliacao, Chamado, CategoriaChamado, Gravidade, StatusChamado, LeituraRegulamento, Turno, VersaoRegulamento, Comunicado, Documento, EntregaUniforme, ItemUniforme, Folga, Funcionario, Ocorrencia, TipoDocumento, TipoOcorrencia, Unidade, VendaDia } from './types'

export type NovoMovimentoEstoque = Omit<MovimentoEstoque, 'id' | 'criadoEm' | 'notaItemId' | 'custoUnit'> & { custoUnit?: number | null }
export type NovoFuncionario = Omit<Funcionario, 'id'> & { id?: string }

export interface NovoDocumento {
  funcionarioId: string
  tipo: TipoDocumento
  arquivo: File
  observacao?: string
  inicio?: string
  fim?: string
  realizadoEm?: string
  vence?: string
}

export interface NovaEntregaUniforme {
  funcionarioId: string
  data: string
  itens: ItemUniforme[]
  observacao?: string
  // Quando a pessoa assina na hora, no aparelho de quem está entregando.
  assinatura?: string
}

export interface NovaOcorrencia {
  funcionarioId: string
  tipo: TipoOcorrencia
  data: string
  descricao: string
  natureza?: string | null
  suspensaoInicio?: string | null
  suspensaoDias?: number | null
}

export interface NovoChamado {
  unidadeId: string
  categoria: CategoriaChamado
  gravidade: Gravidade
  titulo: string
  descricao: string
  local?: string
  foto?: File
}

export interface NovoComunicado {
  titulo: string
  corpo: string
  unidadeId: string | null
  setores?: Setor[] | null
  destinatarios?: string[] | null
}

// Tudo que as telas precisam. Há duas implementações: demonstração (dados de exemplo
// em memória) e Supabase (dados reais, com as regras de acesso aplicadas no banco).
export interface Store {
  modo: 'demo' | 'supabase'
  sessaoAtual(): Promise<Funcionario | null>
  // lembrar: mantém o acesso neste aparelho até a pessoa tocar em Sair.
  entrar(celular: string, senha: string, lembrar?: boolean): Promise<Funcionario>
  sair(): Promise<void>
  // A própria pessoa troca a senha (confere a atual antes).
  trocarSenha(atual: string, nova: string): Promise<void>

  unidades(): Promise<Unidade[]>
  // Só id e nome de todos (inclusive inativos), para mostrar quem publicou um aviso ou registrou algo.
  nomes(): Promise<{ id: string; nome: string }[]>
  // Só quem está ativo, com o cargo (para quem não vê o cadastro da equipe, como a manutenção).
  pessoasAtivas(): Promise<{ id: string; nome: string; cargo: string | null }[]>
  funcionarios(): Promise<Funcionario[]>
  salvarFuncionario(f: NovoFuncionario, senhaInicial?: string): Promise<Funcionario>
  // Foto de perfil (já recortada e reduzida). A própria pessoa ou a gestão.
  definirFoto(funcionarioId: string, imagem: Blob): Promise<void>

  documentos(funcionarioId: string): Promise<Documento[]>
  enviarDocumento(d: NovoDocumento): Promise<Documento>
  // segundos: por quanto tempo o link vale (padrão 1 minuto; a guia mandada no WhatsApp vale 7 dias).
  abrirDocumento(d: Documento, segundos?: number): Promise<string | null>
  // Todos os documentos que eu posso ver (para o controle de vencimentos).
  documentosTodos(): Promise<Documento[]>

  uniformes(funcionarioId: string): Promise<EntregaUniforme[]>
  registrarUniforme(e: NovaEntregaUniforme): Promise<EntregaUniforme>
  // Só a própria pessoa assina pelo portal.
  assinarUniforme(entregaId: string, assinatura: string): Promise<void>
  // Tabela de desconto por peça e conferência da devolução no desligamento.
  valoresUniforme(): Promise<Record<string, number>>
  salvarValoresUniforme(valores: Record<string, number | null>): Promise<void>
  devolucoesUniforme(funcionarioId: string): Promise<DevolucaoUniforme[]>
  registrarDevolucao(d: { funcionarioId: string; data: string; itens: ItemDevolucao[]; observacao?: string }): Promise<DevolucaoUniforme>
  excluirDevolucao(id: string): Promise<void>
  // Ajuste do ponto: 'meus' = os da pessoa logada; 'pendente'/'todos' = a gestão vê de todos.
  ajustesPonto(filtro: 'meus' | 'pendente' | 'todos'): Promise<AjustePonto[]>
  pedirAjustePonto(a: { data: string; tipo: TipoAjustePonto; horario: string | null; motivo: string }): Promise<void>
  resolverAjustePonto(id: string, status: 'feito' | 'recusado', resposta: string): Promise<void>
  excluirAjustePonto(id: string): Promise<void>
  // Pedido de troca: a pessoa pede pelo próprio cadastro; a gestão vê todos e responde.
  solicitacoesUniforme(funcionarioId?: string): Promise<SolicitacaoUniforme[]>
  pedirTrocaUniforme(s: { funcionarioId: string; itens: string[]; motivo: string; foto?: Blob }): Promise<void>
  responderTrocaUniforme(id: string, status: StatusTroca, resposta: string): Promise<void>
  fotoSolicitacao(s: SolicitacaoUniforme): Promise<string | null>
  // Pedidos de compra de uniformes por leva (só a gestão).
  // Pagamento pelo banco (arquivo do Itaú hoje; a API quando estiver liberada).
  contasPagamento(): Promise<ContaPagamento[]>
  salvarContaPagamento(c: Omit<ContaPagamento, 'id'> & { id?: string }): Promise<ContaPagamento>
  remessasPagamento(tipo: RemessaPagamento['tipo'], referencia: string): Promise<RemessaPagamento[]>
  registrarRemessa(r: Omit<RemessaPagamento, 'id' | 'numero' | 'criadoEm'>): Promise<RemessaPagamento>
  pedidosUniforme(): Promise<PedidoUniforme[]>
  salvarPedidoUniforme(p: Pick<PedidoUniforme, 'titulo' | 'status' | 'fornecedor' | 'observacao' | 'valorTotal' | 'fechadoEm' | 'previsaoEntrega'> & { id?: string }): Promise<PedidoUniforme>
  excluirPedidoUniforme(id: string): Promise<void>
  itensPedidoUniforme(pedidoId: string): Promise<ItemPedidoUniforme[]>
  // Troca todas as peças de uma pessoa (ou avulsas, funcionarioId null) dentro do pedido.
  definirItensPedido(pedidoId: string, funcionarioId: string | null, itens: Omit<ItemPedidoUniforme, 'id' | 'pedidoId' | 'funcionarioId'>[]): Promise<void>
  // Estoque de uniformes (só a gestão). Desfazer apaga todos os movimentos da mesma referência.
  movimentosUniforme(): Promise<MovimentoUniforme[]>
  movimentarUniformes(linhas: NovoMovimentoUniforme[]): Promise<void>
  desfazerMovimentoUniforme(referencia: string): Promise<void>

  ocorrencias(funcionarioId: string): Promise<Ocorrencia[]>
  // Para o painel da gestão: tudo que eu posso ver num período.
  ocorrenciasEntre(inicio: string, fim: string): Promise<Ocorrencia[]>
  atestadosEntre(inicio: string, fim: string): Promise<Documento[]>
  registrarOcorrencia(o: NovaOcorrencia): Promise<Ocorrencia>

  comunicados(): Promise<Comunicado[]>
  publicarComunicado(c: NovoComunicado): Promise<Comunicado>
  marcarLido(comunicadoId: string): Promise<void>

  // Inclui as folgas automáticas do turno. 'trabalha' só vem com comTrabalha (tela de marcar folgas).
  folgas(inicio: string, fim: string, opcoes?: { comTrabalha?: boolean }): Promise<Folga[]>
  alternarFolga(funcionarioId: string, data: string): Promise<void>
  // Só a gestão: tipo null tira a folga do dia.
  definirFolga(funcionarioId: string, data: string, tipo: TipoFolga | null): Promise<void>

  // Férias e 13º (só a gestão vê e registra).
  ferias(funcionarioId?: string): Promise<Ferias[]>
  registrarFerias(f: Omit<Ferias, 'id'>): Promise<void>
  excluirFerias(id: string): Promise<void>
  decimoTerceiro(funcionarioId: string): Promise<DecimoTerceiro[]>
  registrarDecimoTerceiro(d: Omit<DecimoTerceiro, 'id'>): Promise<void>
  excluirDecimoTerceiro(id: string): Promise<void>

  // Passo a passo da admissão (só a gestão). Sem funcionarioId: todas.
  admissoes(funcionarioId?: string): Promise<Admissao[]>
  // Cria na primeira marcação. Uma admissão por pessoa e data de admissão.
  salvarAdmissao(a: Admissao): Promise<void>
  // Checklist de desligamento (só a gestão). Sem funcionarioId: todos os que eu vejo.
  desligamentos(funcionarioId?: string): Promise<Desligamento[]>
  abrirDesligamento(d: Pick<Desligamento, 'funcionarioId' | 'data' | 'tipo' | 'observacao'>): Promise<Desligamento>
  excluirDesligamento(id: string): Promise<void>
  atualizarDesligamento(id: string, mudanca: Partial<Pick<Desligamento, 'itens' | 'concluido' | 'observacao' | 'data' | 'tipo'>>): Promise<void>

  // Painel (Proprietário e Gerente): pedidos e faturamento por dia/loja/canal, e notas nas plataformas.
  vendasEntre(inicio: string, fim: string): Promise<VendaDia[]>

  // Caixinha: valor total arrecadado no mês ('AAAA-MM') por loja. Só a gestão.
  caixinhaTotais(mes: string): Promise<Record<string, number>>
  salvarCaixinhaTotal(mes: string, unidadeId: string, valor: number): Promise<void>
  avaliacoes(): Promise<Avaliacao[]>

  // Salários do mês. A gestão vê e lança todos; cada pessoa vê os seus meses já liberados.
  salarios(mes: string): Promise<Salario[]>
  salariosDe(funcionarioId: string): Promise<Salario[]>
  salvarSalario(s: Salario): Promise<void>
  liberarSalarios(mes: string, tipo: TipoPagamento, liberado: boolean): Promise<void>
  // Holerite em PDF de um pagamento (a gestão envia; a pessoa abre o seu quando liberado).
  enviarHolerite(s: Salario, pdf: Blob): Promise<void>
  abrirHolerite(s: Salario): Promise<string | null>

  // Readmissão: guarda o período anterior e reativa com a nova data de admissão.
  vinculosAnteriores(funcionarioId: string): Promise<VinculoAnterior[]>
  readmitir(f: Funcionario, novaAdmissao: string, tipoDesligamento: string | null): Promise<void>

  // Turnos-padrão (horários). Todos veem; a gestão coloca cada pessoa no seu turno.
  turnos(): Promise<Turno[]>
  atribuirTurno(funcionarioId: string, turnoId: string | null): Promise<void>
  // Só a gestão: cria (novo = true) ou altera um turno; apagar tira as pessoas dele.
  salvarTurno(t: Turno, novo: boolean): Promise<void>
  excluirTurno(id: string): Promise<void>

  // Regulamento interno: versões (a mais nova primeiro). Todos leem; a gestão publica.
  // Cada pessoa assina a versão vigente; a gestão vê as assinaturas de todos.
  versoesRegulamento(): Promise<VersaoRegulamento[]>
  publicarRegulamento(texto: string, nota: string): Promise<VersaoRegulamento>
  leiturasRegulamento(): Promise<LeituraRegulamento[]>

  // Chamados de manutenção. Quem abre, data e hora são registrados automaticamente.
  // Funcionário vê os da sua loja e os que abriu; manutenção e gestão veem todos.
  chamados(): Promise<Chamado[]>
  abrirChamado(c: NovoChamado): Promise<Chamado>
  // Só manutenção e gestão mudam o status; qualquer um que vê o chamado pode comentar.
  atualizarChamado(id: string, mudanca: { status?: StatusChamado; texto?: string }): Promise<void>
  fotoChamado(c: Chamado): Promise<string | null>
  // Marca quem a manutenção está esperando (pessoaId) ou tira a espera (null; vale também para a própria pessoa).
  aguardarChamado(id: string, pessoaId: string | null, motivo: string): Promise<void>
  assinarRegulamento(versaoId: string, assinatura: string): Promise<void>

  // Equipamentos e manutenção preventiva (manutenção e gestão).
  equipamentos(): Promise<Equipamento[]>
  salvarEquipamento(e: Omit<Equipamento, 'id' | 'foto'> & { id?: string }, foto?: Blob): Promise<Equipamento>
  fotoEquipamento(e: Equipamento): Promise<string | null>
  manutencoesEquipamento(equipamentoId?: string): Promise<ManutencaoEquipamento[]>
  registrarManutencaoEquipamento(m: Omit<ManutencaoEquipamento, 'id' | 'registradoPor'>): Promise<void>
  excluirManutencaoEquipamento(id: string): Promise<void>
  preventivas(): Promise<Preventiva[]>
  salvarPreventiva(p: Omit<Preventiva, 'id'> & { id?: string }): Promise<void>
  excluirPreventiva(id: string): Promise<void>
  execucoesPreventiva(): Promise<ExecucaoPreventiva[]>
  registrarExecucao(x: Omit<ExecucaoPreventiva, 'id' | 'feitoPor'>): Promise<void>
  excluirExecucao(id: string): Promise<void>

  // Copiados do Lucro Fácil por uma rotina. atualizadoEm = última cópia (null se nunca).
  // Fichas: todos veem; os custos só chegam para a gestão.
  // Resultado do mês por loja: só Proprietário e Administrativo.
  resultados(): Promise<{ linhas: ResultadoMes[]; atualizadoEm: string | null }>

  // Freelancers (só a gestão). semana = segunda-feira que abre a semana.
  // Motoboys (0056, só gestão): cadastro e a semana de cada loja, que vira conta a pagar na segunda.
  motoboys(): Promise<Motoboy[]>
  salvarMotoboy(m: Omit<Motoboy, 'id'> & { id?: string }): Promise<Motoboy>
  semanasMotoboys(de: string, ate: string): Promise<SemanaMotoboy[]>
  salvarSemanaMotoboys(pagamento: string, unidadeId: string, linhas: LinhaSemanaMotoboy[]): Promise<void>
  freelancers(): Promise<Freelancer[]>
  salvarFreelancer(f: Omit<Freelancer, 'id'> & { id?: string }): Promise<Freelancer>
  // Leva junto diárias e envios; recusa se já houver pagamento marcado.
  excluirFreelancer(id: string): Promise<void>
  diariasFreela(inicio: string, fim: string): Promise<DiariaFreela[]>
  lancarDiaria(d: Omit<DiariaFreela, 'id' | 'lancadoPor'>): Promise<DiariaFreela>
  excluirDiaria(id: string): Promise<void>
  pagamentosFreela(semana: string): Promise<PagamentoFreela[]>
  marcarPagoFreela(freelancerId: string, semana: string, valor: number): Promise<void>
  desfazerPagoFreela(freelancerId: string, semana: string): Promise<void>
  // Diárias mandadas pelo próprio freelancer (link da loja, sem login) ou pelo funcionário (login).
  // Guia de exame com link curto (#/g/<código>), válido por 7 dias. publicarGuia devolve o link pronto.
  publicarGuia(funcionarioId: string, arquivo: File): Promise<string>
  // Página pública do link: endereço do PDF, ou null se o link venceu.
  abrirGuia(codigo: string): Promise<string | null>
  lojasParaDiaria(): Promise<Unidade[]>
  freelaQuemSou(cpf: string, celular: string): Promise<QuemSouFreela>
  enviarDiarias(e: { cpf: string; celular: string; nome: string; pix: string; unidadeId: string; funcao: string; dias: DiaEnviado[]; local: LocalEnvio | null }): Promise<number>
  enviarMinhasDiarias(e: { pix: string; unidadeId: string; funcao: string; dias: DiaEnviado[]; local: LocalEnvio | null }): Promise<number>
  locaisLojas(): Promise<LocalLoja[]>
  definirLocalLoja(unidadeId: string, lat: number, lng: number): Promise<void>
  enviosFreela(status: StatusEnvioFreela | 'meus'): Promise<EnvioFreela[]>
  aprovarEnvioFreela(id: string, valor: number, funcao: string, usarPixNovo: boolean): Promise<void>
  recusarEnvioFreela(id: string, motivo: string): Promise<void>

  // Eventos (só a gestão). salvarEvento recusa quando outra pessoa salvou o mesmo evento depois que eu abri.
  operacoes(): Promise<Operacao[]>
  salvarOperacao(o: Operacao): Promise<void>
  eventos(): Promise<Evento[]>
  salvarEvento(e: NovoEvento): Promise<Evento>
  historicoEvento(eventoId: string): Promise<HistoricoEvento[]>

  // Cadastro único de fornecedores, insumos e fichas de eventos (só a gestão).
  fornecedores(): Promise<Fornecedor[]>
  salvarFornecedor(f: Omit<Fornecedor, 'id'> & { id?: string }): Promise<Fornecedor>
  insumos(): Promise<Insumo[]>
  salvarInsumo(i: Omit<Insumo, 'id' | 'precoEm'> & { id?: string }): Promise<Insumo>
  precosInsumo(insumoId: string): Promise<PrecoInsumo[]>
  // Cadastro de categorias dos materiais: renomear muda todos os materiais; juntar com null tira a categoria.
  categoriasInsumo(): Promise<string[]>
  salvarCategoriaInsumo(nome: string, antigo?: string): Promise<void>
  juntarCategoriaInsumo(de: string, para: string | null): Promise<void>
  // Conferência de preços: referências do banco e o "está certo" de um material (guarda o preço conferido).
  referenciasPreco(): Promise<ReferenciaPreco[]>
  conferirPrecoInsumo(insumoId: string, preco: number | null): Promise<void>
  controlarEstoque(insumoIds: string[], controla: boolean): Promise<void>
  // Exclui de vez o material sem história; o que tem (ficha, nota, produção…) é inativado e volta com o motivo.
  excluirInsumos(ids: string[]): Promise<{ insumoId: string; nome: string; excluido: boolean; motivo: string | null }[]>
  receitas(): Promise<Receita[]>
  // Todas as versões de todas as fichas, com os itens (a tela calcula o custo da versão atual).
  versoesReceitas(): Promise<VersaoReceita[]>
  // Dados da ficha (nome, preço, tempos…); a composição muda só por salvarVersaoReceita.
  salvarReceita(r: Omit<Receita, 'id' | 'versaoAtual'> & { id?: string }): Promise<Receita>
  // Cria a versão seguinte e passa a usá-la; as anteriores não mudam. Devolve o número da versão.
  salvarVersaoReceita(receitaId: string, rendimento: number, custoTotal: number | null, nota: string, itens: ItemReceita[]): Promise<number>

  // Cardápio, previsão e vendas por dia de cada evento (só a gestão). Salvar substitui a lista inteira do evento.
  cardapioEvento(eventoId: string): Promise<ProdutoEvento[]>
  salvarCardapioEvento(eventoId: string, itens: ProdutoEvento[]): Promise<void>
  previsaoEvento(eventoId: string): Promise<QtdDiaProduto[]>
  salvarPrevisaoEvento(eventoId: string, linhas: QtdDiaProduto[]): Promise<void>
  // Vendas reais de todos os eventos (base da sugestão e do comparativo).
  vendasEventos(): Promise<VendaEvento[]>
  salvarVendasEvento(eventoId: string, linhas: (QtdDiaProduto & { total: number | null })[]): Promise<void>

  // Logística. Itens fixos (equipamentos, utensílios…) e separações: a gestão monta; quem está escalado no evento confere.
  modeloChecklist(): Promise<ItemModeloChecklist[]>
  salvarItemModelo(i: Omit<ItemModeloChecklist, 'id'> & { id?: string }): Promise<void>
  // Sem eventoId: as separações de todos os eventos (para o estoque da base).
  envios(eventoId?: string): Promise<EnvioEvento[]>
  criarEnvio(eventoId: string, data: string, tipo: EnvioEvento['tipo'], observacao: string, itens: NovoItemEnvio[]): Promise<string>
  excluirEnvio(id: string): Promise<void>
  adicionarItemEnvio(envioId: string, item: NovoItemEnvio): Promise<void>
  excluirItemEnvio(itemId: string): Promise<void>
  // Saída: confere a quantidade separada. Retorno: o item voltou do evento.
  conferirItemEnvio(itemId: string, etapa: 'saida' | 'retorno', quantidade: number | null, ok: boolean): Promise<void>
  // Contagens: sobra no fim do dia do evento (uma por dia, contar de novo substitui) ou estoque da base.
  inventarios(filtro: { eventoId: string } | { local: 'base' }): Promise<Inventario[]>
  salvarInventario(local: 'base' | 'evento', eventoId: string | null, data: string, itens: { chave: string; quantidade: number }[], fala: string, observacao: string): Promise<void>
  // Insumos e pré-preparos ativos, sem preço (para quem conta).
  itensContagem(): Promise<ItemContagem[]>
  // Eventos aprovados, em preparação ou em execução em que estou escalado.
  meusEventosEscalados(): Promise<EventoEscalado[]>

  // Freelancers de eventos (base separada da das lojas; só a gestão).
  freelasEvento(): Promise<FreelaEvento[]>
  salvarFreelaEvento(f: Omit<FreelaEvento, 'id'> & { id?: string }): Promise<FreelaEvento>
  diariasFreelaEvento(filtro: { eventoId: string } | { status: 'pendente' }): Promise<DiariaFreelaEvento[]>
  lancarDiariaFreelaEvento(d: { eventoId: string; freelaId: string; data: string; funcao: string; valor: number; observacao: string | null }): Promise<void>
  aprovarDiariaFreelaEvento(id: string, valor: number, funcao: string, usarPixNovo: boolean): Promise<void>
  recusarDiariaFreelaEvento(id: string, motivo: string): Promise<void>
  excluirDiariaFreelaEvento(id: string): Promise<void>
  marcarPagoFreelaEvento(eventoId: string, freelaId: string, pago: boolean): Promise<void>
  definirLocalEvento(eventoId: string, lat: number, lng: number): Promise<void>
  marcarForaDaMedia(eventoId: string, fora: boolean): Promise<void>
  equipeEvento(eventoId: string): Promise<MembroEquipeEvento[]>
  // Financeiro e estoque (09/10)
  centrosCusto(): Promise<CentroCusto[]>
  planoContas(): Promise<ContaContabil[]>
  salvarContaContabil(c: Omit<ContaContabil, 'id'> & { id?: string }): Promise<void>
  notasFiscais(): Promise<NotaFiscal[]>
  notaFiscal(id: string): Promise<NotaFiscal>
  importarNota(n: NotaImportada): Promise<string>
  criarNotaManual(n: { numero: string | null; emissao: string; fornecedorId: string | null; emitenteNome: string | null; centroCustoId: string | null; valorTotal: number; observacao: string | null; arquivo?: File | null; extratoMovimentoId?: string | null }): Promise<string>
  // Recibo / nota sem XML: troca os itens (só antes de lançar). Devolve os itens salvos.
  salvarItensNota(notaId: string, itens: ItemRecibo[]): Promise<ItemNota[]>
  // Liga (ou desliga, com null) uma nota a um débito do extrato.
  ligarNotaExtrato(notaId: string, movimentoId: string | null): Promise<void>
  linkArquivoNota(caminho: string): Promise<string>
  lancarNota(id: string, l: LancamentoNota): Promise<void>
  estornarNota(id: string): Promise<void>
  excluirNota(id: string): Promise<void>
  contasPagar(): Promise<ContaPagar[]>
  contasDaNota(notaId: string): Promise<ContaPagar[]>
  salvarContasPagar(contas: NovaContaPagar[]): Promise<void>
  pagarConta(id: string, p: { pagoEm: string; valorPago: number; forma: FormaPagamento } | null): Promise<void>
  excluirContaPagar(id: string): Promise<void>
  // Movimentos de um período (de e até inclusive) e o saldo de cada item numa loja.
  movimentosEstoque(de: string, ate: string): Promise<MovimentoEstoque[]>
  saldosEstoque(centroCustoId: string): Promise<SaldoEstoque[]>
  // Produção de pré-preparos (0058, gestão): entrada do preparo e baixa dos ingredientes de uma vez.
  producoes(de: string, ate: string): Promise<Producao[]>
  lancarProducao(p: NovaProducao): Promise<string>
  desfazerProducao(id: string): Promise<void>
  // Fechamento das lojas (09/10): quem é da loja conta e pede; a produção vê os pedidos e o que preparar.
  listaFechamento(unidadeId: string, setor: SetorFechamento, data: string): Promise<ItemFechamento[]>
  fechamentos(de: string, ate: string): Promise<Fechamento[]>
  enviarFechamento(f: EnvioFechamento): Promise<string>
  inventariosEstoque(centroCustoId: string): Promise<InventarioEstoque[]>
  enviarInventario(e: EnvioInventario): Promise<string>
  pedidosProducao(para: string): Promise<PedidoProducao[]>
  // Só os itens informados: lança a diferença para o saldo da Central.
  contarCentral(data: string, itens: { insumoId: string; quantidade: number }[]): Promise<number>
  itensListaFechamento(unidadeId: string, setor: SetorFechamento): Promise<ItemListaFechamento[]>
  // Compras (09/10): os abertos e os dos últimos 120 dias.
  pedidosCompra(): Promise<PedidoCompra[]>
  salvarPedidoCompra(p: NovoPedidoCompra): Promise<PedidoCompra>
  receberPedidoCompra(id: string, recebido: boolean): Promise<void>
  precosFornecedor(fornecedorId: string): Promise<PrecoFornecedor[]>
  comprasDoFornecedor(fornecedorId: string): Promise<CompraFornecedor[]>
  produtosVenda(): Promise<ProdutoVenda[]>
  salvarProdutoVenda(p: Omit<ProdutoVenda, 'id'> & { id?: string }): Promise<ProdutoVenda>
  salvarItemListaFechamento(i: Omit<ItemListaFechamento, 'id' | 'nome'> & { id?: string }): Promise<void>
  // Conciliação bancária (só administrativo e proprietário).
  extrato(): Promise<MovimentoExtrato[]>
  saldosExtrato(): Promise<SaldoExtrato[]>
  regrasExtrato(): Promise<RegraExtrato[]>
  // Lançamentos que já estavam (mesmo identificador do banco) não entram de novo.
  importarExtrato(e: ExtratoOfx): Promise<{ novos: number; repetidos: number }>
  // Recorrentes (0047): confirmadas viram contas do mês sozinhas.
  contasRecorrentes(): Promise<ContaRecorrente[]>
  salvarRecorrente(r: Omit<ContaRecorrente, 'id'> & { id?: string }): Promise<ContaRecorrente>
  excluirRecorrente(id: string): Promise<void>
  // Lança as contas das recorrentes ativas até o mês dado e traz salários liberados e diárias para o contas a pagar.
  atualizarContasAutomaticas(ateMes: string): Promise<void>
  // Um débito do extrato paga várias contas; a diferença (juros, IOF…) vira despesa na conta escolhida.
  conciliarLote(movimentoId: string, contaIds: string[], contaDiferencaId: string | null): Promise<void>
  conciliarMovimento(movimentoId: string, contaPagarId: string): Promise<void>
  desconciliarMovimento(movimentoId: string): Promise<void>
  registrarMovimento(movimentoId: string, r: { centroCustoId: string; contaId: string | null; favorecido: string | null; fornecedorId?: string | null; funcionarioId?: string | null; motoboyId?: string | null; descricao: string; chave: string }): Promise<void>
  pagamentosFuncionario(funcionarioId: string): Promise<PagamentoPessoa[]>
  ignorarMovimento(movimentoId: string, motivo: string, chaveSempre: string | null): Promise<void>
  // Vários de uma vez entram juntos (a transferência sai de uma loja e entra na outra no mesmo comando).
  lancarMovimentoEstoque(m: NovoMovimentoEstoque | NovoMovimentoEstoque[]): Promise<void>
  salvarMembroEquipe(m: Omit<MembroEquipeEvento, 'id'> & { id?: string }): Promise<MembroEquipeEvento>
  excluirMembroEquipe(id: string): Promise<void>
  salvarLayoutBarracas(eventoId: string, layout: Record<string, Record<string, string>>): Promise<void>
  // Link dos freelas de evento (sem login).
  eventosAbertosDiaria(): Promise<EventoAberto[]>
  freelaEventoQuemSou(cpf: string, celular: string): Promise<QuemSouFreela>
  enviarDiariasEvento(e: { cpf: string; celular: string; nome: string; pix: string; eventoId: string; funcao: string; dias: { data: string; observacao?: string }[]; local: LocalEnvio | null }): Promise<number>
}

export const EVENTO_ALTERADO = 'Outra pessoa salvou este evento enquanto você editava. Feche, abra de novo e refaça a alteração.'

export const soDigitos = (s: string) => s.replace(/\D/g, '')

// Nome com a inicial maiúscula (pedido de 08/10): "MARIA DA silva" vira "Maria da Silva".
// Preposições do meio do nome ficam minúsculas. O banco faz o mesmo (migration 0025), isto é só para já mostrar certo.
const PARTICULAS = new Set(['da', 'das', 'de', 'di', 'do', 'dos', 'du', 'e'])
export const nomeProprio = (nome: string) =>
  nome
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR')
    .split(' ')
    .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.replace(/(^|[-'’])(\p{L})/gu, (_, a: string, l: string) => a + l.toLocaleUpperCase('pt-BR'))))
    .join(' ')

// Localização do celular (com até 12 s de espera). null quando a pessoa nega ou o aparelho não consegue.
export const pegarLocalizacao = () =>
  new Promise<{ lat: number; lng: number; precisao: number | null } | null>((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, precisao: Math.round(p.coords.accuracy) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    )
  })

// Distância em metros entre dois pontos (a mesma conta que o banco faz).
export function distanciaM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = (g: number) => (g * Math.PI) / 180
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(a))
}

// Código aleatório do link curto (12 letras e números).
export function codigoAleatorio(n = 12) {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const r = crypto.getRandomValues(new Uint32Array(n))
  return Array.from(r, (x) => letras[x % letras.length]).join('')
}
export const linkDaGuia = (codigo: string) => `${location.origin}${location.pathname.replace(/index\.html$/, '')}#/g/${codigo}`
