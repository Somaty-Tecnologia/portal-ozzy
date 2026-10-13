import { createClient } from '@supabase/supabase-js'
import { EVENTO_ALTERADO, codigoAleatorio, linkDaGuia, nomeItem, nomeProprio, soDigitos, type Store } from './store'
import { LOJAS_FECHAMENTO, chaveDe, daChave } from './types'
import { addDias as addDiasIso, hoje } from './datas'
import { comFolgasDoTurno } from './pessoal'
import { movimentosNovos } from './ofx'
import type { Refeicao, ModeloRefeicao, VotosRefeicao, EnvioMotoboy, TurnoMotoboy, EscalaMotoboy, CurvaAbc, InventarioEstoque, SaldoEstoque, CompraFornecedor, ProdutoVenda, PedidoCompra, PrecoFornecedor, ItemFechamento, Fechamento, PedidoProducao, ItemListaFechamento, Producao, Motoboy, NotaFiscal, ContaPagar, ContaRecorrente, ItemNota, MovimentoExtrato, MembroEquipeEvento, FreelaEvento, DiariaFreelaEvento, NovoItemEnvio, EnvioEvento, Inventario, ItemModeloChecklist, VendaEvento, Fornecedor, Insumo, Receita, VersaoReceita, DiaEvento, Evento, HistoricoEvento, Operacao, Admissao, AjustePonto, DevolucaoUniforme, EnvioFreela, ContaPagamento, RemessaPagamento, VinculoAnterior, SolicitacaoUniforme, PedidoUniforme, ItemPedidoUniforme, MovimentoUniforme, Equipamento, ManutencaoEquipamento, Preventiva, ExecucaoPreventiva, Desligamento, DecimoTerceiro, Ferias, Salario, DiariaFreela, Freelancer, Avaliacao, Chamado, VersaoRegulamento, Comunicado, Documento, EntregaUniforme, Folga, Funcionario, Ocorrencia, VendaDia } from './types'

// O login é celular + senha. Internamente o Supabase usa um e-mail derivado do celular,
// assim não dependemos de SMS (que é pago).
const emailDoCelular = (celular: string) => `${soDigitos(celular)}@portal.theozzy`

const paraFuncionario = (r: any): Funcionario => ({
  id: r.id, nome: r.nome, celular: r.celular, cargo: r.cargo, unidadeId: r.unidade_id, nivel: r.nivel,
  status: r.status, dataAdmissao: r.data_admissao, dataDesligamento: r.data_desligamento, respondePara: r.responde_para, setor: r.setor, turnoId: r.turno_id, pix: r.pix, foto: r.foto, optaVt: r.opta_vt ?? false, cpf: r.cpf ?? null, sexo: r.sexo ?? null,
  rg: r.rg ?? null, ctps: r.ctps ?? null, endereco: r.endereco ?? null,
  tamCamiseta: r.tam_camiseta ?? null, tamCalca: r.tam_calca ?? null, tamCalcado: r.tam_calcado ?? null,
  dataNascimento: r.data_nascimento ?? null, experienciaDias1: r.experiencia_dias1 ?? null, experienciaDias2: r.experiencia_dias2 ?? null,
})

const paraEquipamento = (r: any): Equipamento => ({
  id: r.id, unidadeId: r.unidade_id, nome: r.nome, marcaModelo: r.marca_modelo, numeroSerie: r.numero_serie, local: r.local, dataCompra: r.data_compra,
  valorCompra: r.valor_compra === null ? null : Number(r.valor_compra), valorAtual: r.valor_atual === null ? null : Number(r.valor_atual),
  foto: r.foto, observacao: r.observacao, ativo: r.ativo,
})
const paraPreventiva = (r: any): Preventiva => ({
  id: r.id, unidadeId: r.unidade_id, equipamentoId: r.equipamento_id, titulo: r.titulo, descricao: r.descricao, frequenciaDias: r.frequencia_dias, primeiraEm: r.primeira_em, ativo: r.ativo,
})
const texto = (v: string | null | undefined) => v?.trim() || null
const so = (v: string) => v.replace(/\D/g, '')

const paraSolicitacao = (r: any): SolicitacaoUniforme => ({
  id: r.id, funcionarioId: r.funcionario_id, itens: r.itens ?? [], motivo: r.motivo, foto: r.foto, status: r.status, resposta: r.resposta,
  respondidoPor: r.respondido_por, respondidoEm: r.respondido_em, criadoEm: r.criado_em,
})
const paraPedidoUniforme = (r: any): PedidoUniforme => ({
  id: r.id, numero: r.numero, titulo: r.titulo, status: r.status, fornecedor: r.fornecedor, observacao: r.observacao, criadoEm: r.criado_em,
  valorTotal: r.valor_total === null || r.valor_total === undefined ? null : Number(r.valor_total), fechadoEm: r.fechado_em ?? null, previsaoEntrega: r.previsao_entrega ?? null,
})

const paraDesligamento = (r: any): Desligamento => ({
  id: r.id, funcionarioId: r.funcionario_id, data: r.data, tipo: r.tipo, itens: r.itens ?? {}, observacao: r.observacao, concluido: r.concluido,
})

const paraDocumento = (r: any): Documento & { caminho: string } => ({
  id: r.id, funcionarioId: r.funcionario_id, tipo: r.tipo, nomeArquivo: r.nome_arquivo, observacao: r.observacao,
  inicio: r.inicio, fim: r.fim, realizadoEm: r.realizado_em, vence: r.vence, enviadoPor: r.enviado_por, criadoEm: r.criado_em, caminho: r.caminho,
})

const paraDevolucao = (r: any): DevolucaoUniforme => ({
  id: r.id, funcionarioId: r.funcionario_id, data: r.data, itens: r.itens ?? [], totalDesconto: Number(r.total_desconto),
  observacao: r.observacao, conferidoPor: r.conferido_por, criadoEm: r.criado_em,
})

const paraAjuste = (r: any): AjustePonto => ({
  id: r.id, funcionarioId: r.funcionario_id, data: r.data, tipo: r.tipo, horario: r.horario, motivo: r.motivo, status: r.status,
  resposta: r.resposta, criadoEm: r.criado_em, resolvidoPor: r.resolvido_por, resolvidoEm: r.resolvido_em,
})

const paraUniforme = (r: any): EntregaUniforme => ({
  id: r.id, funcionarioId: r.funcionario_id, data: r.data, itens: r.itens, observacao: r.observacao, entreguePor: r.entregue_por,
  assinatura: r.assinatura, assinadoEm: r.assinado_em, assinadoVia: r.assinado_via, criadoEm: r.criado_em,
})

const paraVersao = (r: any): VersaoRegulamento => ({
  id: r.id, numero: r.numero, texto: r.texto, nota: r.nota, publicadoEm: r.publicado_em, publicadoPor: r.publicado_por, hash: r.hash,
})

const paraChamado = (r: any): Chamado => ({
  id: r.id, numero: r.numero, unidadeId: r.unidade_id, categoria: r.categoria, gravidade: r.gravidade, titulo: r.titulo,
  descricao: r.descricao, local: r.local, foto: r.foto, status: r.status, abertoPor: r.aberto_por, abertoEm: r.aberto_em,
  responsavelId: r.responsavel_id, fechadoEm: r.fechado_em,
  aguardandoId: r.aguardando_id ?? null, aguardandoDesde: r.aguardando_desde ?? null, aguardandoMotivo: r.aguardando_motivo ?? null,
  eventos: (r.chamado_eventos ?? [])
    .map((e: any) => ({ id: e.id, autorId: e.autor_id, em: e.em, texto: e.texto, status: e.status }))
    .sort((a: any, b: any) => a.em.localeCompare(b.em)),
})

const paraOcorrencia = (r: any): Ocorrencia => ({
  id: r.id, funcionarioId: r.funcionario_id, tipo: r.tipo, data: r.data, descricao: r.descricao,
  natureza: r.natureza, suspensaoInicio: r.suspensao_inicio, suspensaoDias: r.suspensao_dias,
  registradoPor: r.registrado_por, criadoEm: r.criado_em,
})

const deFuncionario = (f: Partial<Funcionario>) => ({
  nome: f.nome === undefined ? undefined : nomeProprio(f.nome), celular: f.celular ? soDigitos(f.celular) : undefined, cargo: f.cargo, unidade_id: f.unidadeId,
  nivel: f.nivel, status: f.status, data_admissao: f.dataAdmissao, data_desligamento: f.dataDesligamento || null,
  responde_para: f.respondePara || null, setor: f.setor || null, pix: f.pix?.trim() || null,
  opta_vt: f.optaVt ?? false,
  cpf: f.cpf ? soDigitos(f.cpf) : null, sexo: f.sexo || null,
  rg: f.rg?.trim() || null, ctps: f.ctps?.trim() || null, endereco: f.endereco?.trim() || null,
  data_nascimento: f.dataNascimento || null,
  tam_camiseta: f.tamCamiseta || null, tam_calca: f.tamCalca || null, tam_calcado: f.tamCalcado || null,
  experiencia_dias1: f.experienciaDias1 || null, experiencia_dias2: f.experienciaDias1 ? f.experienciaDias2 ?? 0 : null,
})

const ok = <T,>({ data, error }: { data: T; error: { message: string } | null }) => {
  if (error) {
    // Erro de regra de acesso do banco vem em inglês; a gestão precisa entender o que houve.
    if (/row-level security/.test(error.message)) throw new Error('O banco não deixou salvar: sem permissão para esta alteração. Se você é da gestão, avise o Heitor.')
    throw new Error(error.message)
  }
  return data
}

// O Supabase entrega no máximo 1.000 linhas por consulta: busca de mil em mil até acabar.
// A consulta precisa de uma ordem estável (terminar em id) para não pular nem repetir linhas.
async function todas<T = any>(pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const r: T[] = []
  for (let de = 0; ; de += 1000) {
    const pg = ok(await pagina(de, de + 999)) ?? []
    r.push(...pg)
    if (pg.length < 1000) return r
  }
}

// "Lembrar meu acesso": com a opção marcada, a sessão fica guardada no aparelho (localStorage);
// sem ela, some quando o navegador fecha (sessionStorage).
const CHAVE_LEMBRAR = 'ozzy-lembrar'
const tentar = <T,>(f: () => T, padrao: T) => {
  try { return f() } catch { return padrao }
}
const lembrar = () => tentar(() => localStorage.getItem(CHAVE_LEMBRAR) !== 'nao', true)
const guarda = () => (lembrar() ? localStorage : sessionStorage)
const armazenamento = {
  getItem: (k: string) => tentar(() => guarda().getItem(k), null),
  setItem: (k: string, v: string) => tentar(() => guarda().setItem(k, v), undefined),
  removeItem: (k: string) => tentar(() => { localStorage.removeItem(k); sessionStorage.removeItem(k) }, undefined),
}

export function criarSupabaseStore(url: string, chave: string): Store {
  const sb = createClient(url, chave, { auth: { storage: armazenamento, persistSession: true, autoRefreshToken: true } })
  let eu: Funcionario | null = null

  // Fotos ficam em armazenamento privado: gera endereços temporários de uma vez para a lista toda.
  const comFotos = async (pessoas: Funcionario[]) => {
    const caminhos = pessoas.map((p) => p.foto).filter((c): c is string => !!c)
    if (!caminhos.length) return pessoas
    const { data } = await sb.storage.from('fotos').createSignedUrls(caminhos, 60 * 60 * 24)
    const url = new Map((data ?? []).map((d) => [d.path, d.signedUrl]))
    return pessoas.map((p) => ({ ...p, fotoUrl: p.foto ? url.get(p.foto) ?? null : null }))
  }

  const carregarEu = async () => {
    const { data } = await sb.auth.getUser()
    if (!data.user) return (eu = null)
    const r = ok(await sb.from('funcionarios').select('*').eq('auth_user_id', data.user.id).eq('status', 'ativo').maybeSingle())
    return (eu = r ? (await comFotos([paraFuncionario(r)]))[0] : null)
  }
  const exigeEu = () => {
    if (!eu) throw new Error('Sessão expirada')
    return eu
  }

  return {
    modo: 'supabase',
    sessaoAtual: carregarEu,
    async entrar(celular, senha, lembrarAcesso = true) {
      tentar(() => localStorage.setItem(CHAVE_LEMBRAR, lembrarAcesso ? 'sim' : 'nao'), undefined)
      const { error } = await sb.auth.signInWithPassword({ email: emailDoCelular(celular), password: senha })
      if (error) throw new Error('Celular ou senha incorretos.')
      const f = await carregarEu()
      if (!f) {
        await sb.auth.signOut()
        throw new Error('Este acesso não está ativo. Fale com o administrativo.')
      }
      return f
    },
    async sair() {
      await sb.auth.signOut()
      eu = null
    },
    async trocarSenha(atual, nova) {
      const { data } = await sb.auth.getUser()
      const email = data.user?.email
      if (!email) throw new Error('Sessão expirada. Entre de novo.')
      const { error: erroAtual } = await sb.auth.signInWithPassword({ email, password: atual })
      if (erroAtual) throw new Error('A senha atual não confere.')
      const { error } = await sb.auth.updateUser({ password: nova })
      if (error) throw new Error(error.message.includes('different') ? 'A nova senha precisa ser diferente da atual.' : 'Não deu para trocar a senha. Tente de novo.')
    },
    async unidades() {
      return ok(await sb.from('unidades').select('id, nome').order('nome')) ?? []
    },
    async pessoasAtivas() {
      return ok(await sb.rpc('pessoas_ativas')) ?? []
    },
    async nomes() {
      return ok(await sb.rpc('nomes_funcionarios')) ?? []
    },
    async funcionarios() {
      return comFotos((ok(await sb.from('funcionarios').select('*').order('nome')) ?? []).map(paraFuncionario))
    },
    async definirFoto(funcionarioId, imagem) {
      const caminho = `${funcionarioId}/${Date.now()}.jpg`
      ok(await sb.storage.from('fotos').upload(caminho, imagem, { contentType: 'image/jpeg' }))
      ok(await sb.rpc('definir_foto', { alvo: funcionarioId, caminho }))
    },
    async salvarFuncionario(f, senhaInicial) {
      const linha = f.id
        ? ok(await sb.from('funcionarios').update(deFuncionario(f)).eq('id', f.id).select().single())
        : ok(await sb.from('funcionarios').insert(deFuncionario(f)).select().single())
      const salvo = paraFuncionario(linha)
      if (senhaInicial) {
        const { error } = await sb.functions.invoke('criar-acesso', { body: { funcionarioId: salvo.id, senha: senhaInicial } })
        if (error) throw new Error('Funcionário salvo, mas o login não foi criado: ' + error.message)
      }
      return salvo
    },
    async documentos(fid) {
      return (ok(await sb.from('documentos').select('*').eq('funcionario_id', fid).order('criado_em', { ascending: false })) ?? []).map(paraDocumento)
    },
    async enviarDocumento(d) {
      const u = exigeEu()
      const caminho = `${d.funcionarioId}/${Date.now()}-${d.arquivo.name.replace(/[^\w.-]/g, '_')}`
      ok(await sb.storage.from('documentos').upload(caminho, d.arquivo))
      const r = ok(
        await sb.from('documentos').insert({
          funcionario_id: d.funcionarioId, tipo: d.tipo, nome_arquivo: d.arquivo.name, caminho,
          observacao: d.observacao || null, inicio: d.inicio || null, fim: d.fim || null,
          realizado_em: d.realizadoEm || null, vence: d.vence || null, enviado_por: u.id,
        }).select().single(),
      )
      return paraDocumento(r)
    },
    async abrirDocumento(d, segundos = 60) {
      const caminho = (d as Documento & { caminho?: string }).caminho
      if (!caminho) return null
      const { data } = await sb.storage.from('documentos').createSignedUrl(caminho, segundos)
      return data?.signedUrl ?? null
    },
    async documentosTodos() {
      return (await todas((de, ate) => sb.from('documentos').select('*').order('id').range(de, ate))).map(paraDocumento)
    },
    async uniformes(fid) {
      return (ok(await sb.from('uniforme_entregas').select('*').eq('funcionario_id', fid).order('data', { ascending: false })) ?? []).map(paraUniforme)
    },
    async registrarUniforme(e) {
      const u = exigeEu()
      const r = ok(
        await sb.from('uniforme_entregas').insert({
          funcionario_id: e.funcionarioId, data: e.data, itens: e.itens, observacao: e.observacao || null, entregue_por: u.id,
          assinatura: e.assinatura ?? null, assinado_em: e.assinatura ? new Date().toISOString() : null, assinado_via: e.assinatura ? 'presencial' : null,
        }).select().single(),
      )
      return paraUniforme(r)
    },
    async assinarUniforme(id, assinatura) {
      ok(await sb.rpc('assinar_uniforme', { entrega: id, imagem: assinatura }))
    },
    async valoresUniforme() {
      const rs = ok(await sb.from('uniforme_valores').select('item, valor')) ?? []
      return Object.fromEntries(rs.map((r: any) => [r.item, Number(r.valor)]))
    },
    async salvarValoresUniforme(valores) {
      const salvar = Object.entries(valores).filter(([, v]) => v !== null).map(([item, valor]) => ({ item, valor, atualizado_em: new Date().toISOString() }))
      const apagar = Object.entries(valores).filter(([, v]) => v === null).map(([item]) => item)
      if (salvar.length) ok(await sb.from('uniforme_valores').upsert(salvar))
      if (apagar.length) ok(await sb.from('uniforme_valores').delete().in('item', apagar))
    },
    async devolucoesUniforme(fid) {
      return (ok(await sb.from('uniforme_devolucoes').select('*').eq('funcionario_id', fid).order('criado_em', { ascending: false })) ?? []).map(paraDevolucao)
    },
    async registrarDevolucao(d) {
      const u = exigeEu()
      const total = d.itens.reduce((t, i) => t + Math.max(0, i.entregue - i.devolvido) * i.valor, 0)
      const r = ok(
        await sb.from('uniforme_devolucoes').insert({
          funcionario_id: d.funcionarioId, data: d.data, itens: d.itens, total_desconto: Math.round(total * 100) / 100,
          observacao: d.observacao?.trim() || null, conferido_por: u.id,
        }).select().single(),
      )
      return paraDevolucao(r)
    },
    async excluirDevolucao(id) {
      ok(await sb.from('uniforme_devolucoes').delete().eq('id', id))
    },
    async ajustesPonto(filtro) {
      let q = sb.from('ponto_ajustes').select('*').order('criado_em', { ascending: false }).limit(300)
      if (filtro === 'meus') q = q.eq('funcionario_id', exigeEu().id)
      if (filtro === 'pendente') q = q.eq('status', 'pendente')
      return (ok(await q) ?? []).map(paraAjuste)
    },
    async pedirAjustePonto(a) {
      const u = exigeEu()
      ok(await sb.from('ponto_ajustes').insert({ funcionario_id: u.id, data: a.data, tipo: a.tipo, horario: a.horario || null, motivo: a.motivo.trim() || null }))
    },
    async resolverAjustePonto(id, status, resposta) {
      const u = exigeEu()
      ok(await sb.from('ponto_ajustes').update({ status, resposta: resposta.trim() || null, resolvido_por: u.id, resolvido_em: new Date().toISOString() }).eq('id', id))
    },
    async excluirAjustePonto(id) {
      ok(await sb.from('ponto_ajustes').delete().eq('id', id))
    },
    async ocorrencias(fid) {
      return (ok(await sb.from('ocorrencias').select('*').eq('funcionario_id', fid).order('data', { ascending: false })) ?? []).map(paraOcorrencia)
    },
    async ocorrenciasEntre(inicio, fim) {
      return (ok(await sb.from('ocorrencias').select('*').gte('data', inicio).lte('data', fim)) ?? []).map(paraOcorrencia)
    },
    async atestadosEntre(inicio, fim) {
      return (ok(await sb.from('documentos').select('*').eq('tipo', 'atestado').gte('inicio', inicio).lte('inicio', fim)) ?? []).map(paraDocumento)
    },
    async registrarOcorrencia(o) {
      const u = exigeEu()
      const r = ok(
        await sb.from('ocorrencias').insert({
          funcionario_id: o.funcionarioId, tipo: o.tipo, data: o.data, descricao: o.descricao, registrado_por: u.id,
          natureza: o.natureza || null, suspensao_inicio: o.suspensaoInicio || null, suspensao_dias: o.suspensaoDias || null,
        }).select().single(),
      )
      return paraOcorrencia(r)
    },
    async comunicados() {
      const linhas = ok(await sb.from('comunicados').select('*, comunicado_leituras(funcionario_id)').order('criado_em', { ascending: false })) ?? []
      return linhas.map((r: any): Comunicado => ({
        id: r.id, titulo: r.titulo, corpo: r.corpo, unidadeId: r.unidade_id, setores: r.setores ?? null, destinatarios: r.destinatarios ?? null, autorId: r.autor_id, criadoEm: r.criado_em,
        lidoPor: (r.comunicado_leituras ?? []).map((l: any) => l.funcionario_id),
      }))
    },
    async publicarComunicado(c) {
      const u = exigeEu()
      const r = ok(await sb.from('comunicados').insert({
        titulo: c.titulo, corpo: c.corpo, unidade_id: c.unidadeId, autor_id: u.id,
        setores: c.setores?.length ? c.setores : null, destinatarios: c.destinatarios?.length ? c.destinatarios : null,
      }).select().single())
      await sb.from('comunicado_leituras').insert({ comunicado_id: r.id, funcionario_id: u.id })
      return { id: r.id, titulo: r.titulo, corpo: r.corpo, unidadeId: r.unidade_id, setores: r.setores, destinatarios: r.destinatarios, autorId: r.autor_id, criadoEm: r.criado_em, lidoPor: [u.id] }
    },
    async marcarLido(id) {
      const u = exigeEu()
      await sb.from('comunicado_leituras').upsert({ comunicado_id: id, funcionario_id: u.id }, { ignoreDuplicates: true })
    },
    async folgas(inicio, fim, opcoes) {
      const [linhas, pessoas, turnos] = await Promise.all([
        sb.from('folgas').select('*').gte('data', inicio).lte('data', fim).then(ok),
        sb.from('funcionarios').select('id, turno_id, status, data_admissao').not('turno_id', 'is', null).then(ok),
        sb.from('turnos').select('id, dias').then(ok),
      ])
      const marcadas = (linhas ?? []).map((r: any): Folga => ({ id: r.id, funcionarioId: r.funcionario_id, data: r.data, tipo: r.tipo ?? 'normal' }))
      const ps = (pessoas ?? []).map((r: any) => ({ id: r.id, turnoId: r.turno_id, status: r.status, dataAdmissao: r.data_admissao }))
      return comFolgasDoTurno(marcadas, ps, (turnos ?? []) as any[], inicio, fim, opcoes?.comTrabalha)
    },
    async folgasDaEquipe(inicio, fim) {
      const r = ok(await sb.rpc('folgas_da_equipe', { p_inicio: inicio, p_fim: fim })) as any[]
      return (r ?? []).map((x) => ({ id: `${x.funcionarioId}:${x.data}`, funcionarioId: x.funcionarioId, data: x.data, tipo: x.tipo, automatica: x.automatica || undefined, nome: x.nome, unidadeId: x.unidadeId, setor: x.setor }))
    },
    async definirFolga(fid, data, tipo) {
      if (!tipo) ok(await sb.from('folgas').delete().eq('funcionario_id', fid).eq('data', data))
      else ok(await sb.from('folgas').upsert({ funcionario_id: fid, data, tipo }, { onConflict: 'funcionario_id,data' }))
    },
    async ferias(fid) {
      let q = sb.from('ferias').select('*').order('inicio', { ascending: false })
      if (fid) q = q.eq('funcionario_id', fid)
      return (ok(await q) ?? []).map((r: any): Ferias => ({
        id: r.id, funcionarioId: r.funcionario_id, aquisitivoInicio: r.aquisitivo_inicio, inicio: r.inicio, dias: r.dias, abonoDias: r.abono_dias, observacao: r.observacao,
      }))
    },
    async registrarFerias(f) {
      ok(await sb.from('ferias').insert({
        funcionario_id: f.funcionarioId, aquisitivo_inicio: f.aquisitivoInicio, inicio: f.inicio, dias: f.dias, abono_dias: f.abonoDias, observacao: f.observacao?.trim() || null,
      }))
    },
    async excluirFerias(id) {
      ok(await sb.from('ferias').delete().eq('id', id))
    },
    async decimoTerceiro(fid) {
      return (ok(await sb.from('decimo_terceiro').select('*').eq('funcionario_id', fid).order('ano', { ascending: false })) ?? []).map((r: any): DecimoTerceiro => ({
        id: r.id, funcionarioId: r.funcionario_id, ano: r.ano, parcela: r.parcela, valor: Number(r.valor), pagoEm: r.pago_em, observacao: r.observacao,
      }))
    },
    async registrarDecimoTerceiro(d) {
      ok(await sb.from('decimo_terceiro').insert({
        funcionario_id: d.funcionarioId, ano: d.ano, parcela: d.parcela, valor: d.valor, pago_em: d.pagoEm, observacao: d.observacao?.trim() || null,
      }))
    },
    async excluirDecimoTerceiro(id) {
      ok(await sb.from('decimo_terceiro').delete().eq('id', id))
    },
    async solicitacoesUniforme(fid) {
      let q = sb.from('uniforme_solicitacoes').select('*').order('criado_em', { ascending: false })
      if (fid) q = q.eq('funcionario_id', fid)
      return (ok(await q) ?? []).map(paraSolicitacao)
    },
    async pedirTrocaUniforme(n) {
      let foto: string | null = null
      if (n.foto) {
        foto = `${n.funcionarioId}/uniforme-${Date.now()}.jpg`
        ok(await sb.storage.from('fotos').upload(foto, n.foto, { contentType: n.foto.type || 'image/jpeg' }))
      }
      ok(await sb.from('uniforme_solicitacoes').insert({ funcionario_id: n.funcionarioId, itens: n.itens, motivo: n.motivo.trim(), foto }))
    },
    async responderTrocaUniforme(id, status, resposta) {
      ok(await sb.from('uniforme_solicitacoes').update({
        status, resposta: texto(resposta), respondido_por: status === 'aberta' ? null : exigeEu().id, respondido_em: status === 'aberta' ? null : new Date().toISOString(),
      }).eq('id', id))
    },
    async fotoSolicitacao(x) {
      if (!x.foto) return null
      const { data } = await sb.storage.from('fotos').createSignedUrl(x.foto, 300)
      return data?.signedUrl ?? null
    },
    async contasPagamento() {
      return (ok(await sb.from('contas_pagamento').select('*').order('padrao', { ascending: false }).order('nome')) ?? []).map(paraConta)
    },
    async salvarContaPagamento(c) {
      const linha = {
        nome: c.nome.trim(), banco: c.banco, empresa_cnpj: so(c.empresaCnpj), empresa_nome: c.empresaNome.trim(),
        agencia: so(c.agencia), conta: so(c.conta), dac: so(c.dac), endereco: texto(c.endereco), numero: texto(c.numero),
        cidade: texto(c.cidade), cep: c.cep ? so(c.cep) : null, estado: c.estado?.toUpperCase() || null, padrao: c.padrao,
      }
      // Só uma conta fica marcada como padrão.
      if (c.padrao) ok(await sb.from('contas_pagamento').update({ padrao: false }).eq('padrao', true))
      return paraConta(c.id
        ? ok(await sb.from('contas_pagamento').update(linha).eq('id', c.id).select().single())
        : ok(await sb.from('contas_pagamento').insert(linha).select().single()))
    },
    async remessasPagamento(tipo, referencia) {
      return (ok(await sb.from('remessas_pagamento').select('*').eq('tipo', tipo).eq('referencia', referencia).order('criado_em', { ascending: false })) ?? []).map(paraRemessa)
    },
    async registrarRemessa(r) {
      return paraRemessa(ok(await sb.from('remessas_pagamento').insert({
        conta_id: r.contaId, tipo: r.tipo, referencia: r.referencia, data_pagamento: r.dataPagamento,
        quantidade: r.quantidade, valor_total: r.valorTotal, via: r.via, arquivo: r.arquivo, gerado_por: exigeEu().id,
      }).select().single()))
    },
    async pedidosUniforme() {
      return (ok(await sb.from('uniforme_pedidos').select('*').order('criado_em', { ascending: false })) ?? []).map(paraPedidoUniforme)
    },
    async salvarPedidoUniforme(p) {
      const linha = {
        titulo: p.titulo.trim(), status: p.status, fornecedor: texto(p.fornecedor), observacao: texto(p.observacao),
        valor_total: p.valorTotal ?? null, fechado_em: p.fechadoEm || null, previsao_entrega: p.previsaoEntrega || null,
      }
      return paraPedidoUniforme(p.id
        ? ok(await sb.from('uniforme_pedidos').update(linha).eq('id', p.id).select().single())
        : ok(await sb.from('uniforme_pedidos').insert(linha).select().single()))
    },
    async excluirPedidoUniforme(id) {
      ok(await sb.from('uniforme_pedidos').delete().eq('id', id))
    },
    async itensPedidoUniforme(pid) {
      return (ok(await sb.from('uniforme_pedido_itens').select('*').eq('pedido_id', pid)) ?? []).map((r: any): ItemPedidoUniforme => ({
        id: r.id, pedidoId: r.pedido_id, funcionarioId: r.funcionario_id, item: r.item, cor: r.cor, modelagem: r.modelagem, tamanho: r.tamanho, quantidade: r.quantidade,
      }))
    },
    async definirItensPedido(pid, fid, itens) {
      let del = sb.from('uniforme_pedido_itens').delete().eq('pedido_id', pid)
      del = fid ? del.eq('funcionario_id', fid) : del.is('funcionario_id', null)
      ok(await del)
      if (itens.length)
        ok(await sb.from('uniforme_pedido_itens').insert(itens.map((i) => ({
          pedido_id: pid, funcionario_id: fid, item: i.item, cor: i.cor, modelagem: i.modelagem, tamanho: i.tamanho, quantidade: i.quantidade,
        }))))
    },
    async movimentosUniforme() {
      const rs = await todas((de, ate) => sb.from('uniforme_estoque').select('*').order('criado_em').order('id').range(de, ate))
      return rs.map((r): MovimentoUniforme => ({
        id: r.id, data: r.data, item: r.item, cor: r.cor, modelagem: r.modelagem, tamanho: r.tamanho, tipo: r.tipo, quantidade: r.quantidade,
        referencia: r.referencia, observacao: r.observacao, criadoPor: r.criado_por, criadoEm: r.criado_em,
      }))
    },
    async movimentarUniformes(linhas) {
      if (!linhas.length) return
      ok(await sb.from('uniforme_estoque').insert(linhas.map((l) => ({
        data: l.data ?? undefined, item: l.item, cor: l.cor, modelagem: l.modelagem, tamanho: l.tamanho, tipo: l.tipo, quantidade: l.quantidade,
        referencia: l.referencia, observacao: l.observacao?.trim() || null,
      }))))
    },
    async desfazerMovimentoUniforme(ref) {
      ok(await sb.from('uniforme_estoque').delete().eq('referencia', ref))
    },
    async equipamentos() {
      return (ok(await sb.from('equipamentos').select('*').order('nome')) ?? []).map(paraEquipamento)
    },
    async salvarEquipamento(e, foto) {
      let caminho: string | undefined
      if (foto) {
        caminho = `equipamentos/${e.unidadeId}/${crypto.randomUUID()}.jpg`
        ok(await sb.storage.from('chamados').upload(caminho, foto, { contentType: foto.type || 'image/jpeg' }))
      }
      const linha = {
        unidade_id: e.unidadeId, nome: e.nome.trim(), marca_modelo: texto(e.marcaModelo), numero_serie: texto(e.numeroSerie), local: texto(e.local),
        data_compra: e.dataCompra || null, valor_compra: e.valorCompra, valor_atual: e.valorAtual, observacao: texto(e.observacao), ativo: e.ativo,
        ...(caminho ? { foto: caminho } : {}),
      }
      const r = e.id
        ? ok(await sb.from('equipamentos').update(linha).eq('id', e.id).select().single())
        : ok(await sb.from('equipamentos').insert(linha).select().single())
      return paraEquipamento(r)
    },
    async fotoEquipamento(e) {
      if (!e.foto) return null
      const { data } = await sb.storage.from('chamados').createSignedUrl(e.foto, 300)
      return data?.signedUrl ?? null
    },
    async manutencoesEquipamento(eid) {
      let q = sb.from('equipamento_manutencoes').select('*').order('data', { ascending: false })
      if (eid) q = q.eq('equipamento_id', eid)
      return (ok(await q) ?? []).map((r: any): ManutencaoEquipamento => ({
        id: r.id, equipamentoId: r.equipamento_id, data: r.data, tipo: r.tipo, descricao: r.descricao, prestador: r.prestador,
        custo: r.custo === null ? null : Number(r.custo), chamadoId: r.chamado_id, registradoPor: r.registrado_por,
      }))
    },
    async registrarManutencaoEquipamento(m) {
      ok(await sb.from('equipamento_manutencoes').insert({
        equipamento_id: m.equipamentoId, data: m.data, tipo: m.tipo, descricao: m.descricao.trim(), prestador: texto(m.prestador), custo: m.custo, chamado_id: m.chamadoId,
      }))
    },
    async excluirManutencaoEquipamento(id) {
      ok(await sb.from('equipamento_manutencoes').delete().eq('id', id))
    },
    async preventivas() {
      return (ok(await sb.from('preventivas').select('*').order('titulo')) ?? []).map(paraPreventiva)
    },
    async salvarPreventiva(p) {
      const linha = {
        unidade_id: p.unidadeId || null, equipamento_id: p.equipamentoId || null, titulo: p.titulo.trim(), descricao: texto(p.descricao),
        frequencia_dias: p.frequenciaDias, primeira_em: p.primeiraEm, ativo: p.ativo,
      }
      if (p.id) ok(await sb.from('preventivas').update(linha).eq('id', p.id))
      else ok(await sb.from('preventivas').insert(linha))
    },
    async excluirPreventiva(id) {
      ok(await sb.from('preventivas').delete().eq('id', id))
    },
    async execucoesPreventiva() {
      return (await todas((de, ate) => sb.from('preventiva_execucoes').select('*').order('feito_em', { ascending: false }).order('id').range(de, ate))).map((r: any): ExecucaoPreventiva => ({
        id: r.id, preventivaId: r.preventiva_id, unidadeId: r.unidade_id, feitoEm: r.feito_em, observacao: r.observacao, feitoPor: r.feito_por,
      }))
    },
    async registrarExecucao(x) {
      ok(await sb.from('preventiva_execucoes').insert({ preventiva_id: x.preventivaId, unidade_id: x.unidadeId, feito_em: x.feitoEm, observacao: texto(x.observacao) }))
    },
    async excluirExecucao(id) {
      ok(await sb.from('preventiva_execucoes').delete().eq('id', id))
    },
    async admissoes(fid) {
      let q = sb.from('admissoes').select('*')
      if (fid) q = q.eq('funcionario_id', fid)
      return (ok(await q) ?? []).map((r: any): Admissao => ({ funcionarioId: r.funcionario_id, dataAdmissao: r.data_admissao, itens: r.itens ?? {}, concluido: r.concluido }))
    },
    async salvarAdmissao(a) {
      ok(await sb.from('admissoes').upsert(
        { funcionario_id: a.funcionarioId, data_admissao: a.dataAdmissao, itens: a.itens, concluido: a.concluido },
        { onConflict: 'funcionario_id,data_admissao' },
      ))
    },
    async desligamentos(fid) {
      let q = sb.from('desligamentos').select('*').order('data', { ascending: false })
      if (fid) q = q.eq('funcionario_id', fid)
      return (ok(await q) ?? []).map(paraDesligamento)
    },
    async abrirDesligamento(d) {
      return paraDesligamento(ok(await sb.from('desligamentos').insert({
        funcionario_id: d.funcionarioId, data: d.data, tipo: d.tipo, observacao: d.observacao?.trim() || null,
      }).select().single()))
    },
    async excluirDesligamento(id) {
      ok(await sb.from('desligamentos').delete().eq('id', id))
    },
    async atualizarDesligamento(id, m) {
      const linha: Record<string, unknown> = {}
      if (m.itens) linha.itens = m.itens
      if (m.concluido !== undefined) linha.concluido = m.concluido
      if (m.observacao !== undefined) linha.observacao = m.observacao?.trim() || null
      if (m.data) linha.data = m.data
      if (m.tipo) linha.tipo = m.tipo
      ok(await sb.from('desligamentos').update(linha).eq('id', id))
    },
    async alternarFolga(fid, data) {
      const existente = ok(await sb.from('folgas').select('id').eq('funcionario_id', fid).eq('data', data).maybeSingle())
      if (existente) ok(await sb.from('folgas').delete().eq('id', (existente as any).id))
      else ok(await sb.from('folgas').insert({ funcionario_id: fid, data }))
    },
    async vendasEntre(inicio, fim) {
      const linhas = ok(await sb.from('vendas_diarias').select('*').gte('data', inicio).lte('data', fim)) ?? []
      return linhas.map((r: any): VendaDia => ({
        unidadeId: r.unidade_id, data: r.data, canal: r.canal, pedidos: r.pedidos, faturamento: Number(r.faturamento),
      }))
    },
    async caixinhaTotais(mes) {
      const linhas = ok(await sb.from('caixinha_mensal').select('*').eq('mes', mes)) ?? []
      return Object.fromEntries(linhas.map((r: any) => [r.unidade_id, Number(r.total)]))
    },
    async salvarCaixinhaTotal(mes, unidadeId, valor) {
      ok(await sb.from('caixinha_mensal').upsert({ mes, unidade_id: unidadeId, total: valor }))
    },
    async salarios(mes) {
      return (ok(await sb.from('salarios').select('*').eq('mes', mes)) ?? []).map(paraSalario)
    },
    async salariosDe(funcionarioId) {
      return (ok(await sb.from('salarios').select('*').eq('funcionario_id', funcionarioId).order('mes', { ascending: false })) ?? []).map(paraSalario)
    },
    async enviarHolerite(s, pdf) {
      const caminho = `${s.funcionarioId}/${s.mes}-${s.tipo}.pdf`
      ok(await sb.storage.from('holerites').upload(caminho, pdf, { contentType: 'application/pdf', upsert: true }))
      ok(await sb.from('salarios').update({ holerite: caminho }).eq('funcionario_id', s.funcionarioId).eq('mes', s.mes).eq('tipo', s.tipo))
    },
    async abrirHolerite(s) {
      if (!s.holerite) return null
      const { data } = await sb.storage.from('holerites').createSignedUrl(s.holerite, 300)
      return data?.signedUrl ?? null
    },
    async vinculosAnteriores(fid) {
      return (ok(await sb.from('vinculos_anteriores').select('*').eq('funcionario_id', fid).order('admissao', { ascending: false })) ?? []).map((r: any): VinculoAnterior => ({
        id: r.id, funcionarioId: r.funcionario_id, admissao: r.admissao, desligamento: r.desligamento, tipoDesligamento: r.tipo_desligamento, cargo: r.cargo, observacao: r.observacao,
      }))
    },
    async readmitir(f, novaAdmissao, tipo) {
      if (f.dataDesligamento) {
        ok(await sb.from('vinculos_anteriores').insert({
          funcionario_id: f.id, admissao: f.dataAdmissao, desligamento: f.dataDesligamento, tipo_desligamento: tipo, cargo: f.cargo,
        }))
      }
      ok(await sb.from('funcionarios').update({
        status: 'ativo', data_admissao: novaAdmissao, data_desligamento: null, experiencia_dias1: null, experiencia_dias2: null,
      }).eq('id', f.id))
    },
    async salvarSalario(s) {
      ok(await sb.from('salarios').upsert({
        funcionario_id: s.funcionarioId, mes: s.mes, tipo: s.tipo, desc_adiantamento: s.descAdiantamento, salario: s.salario, caixinha: s.caixinha, bonus_caixinha: s.bonusCaixinha,
        bonus_conclui: s.bonusConclui, desc_faltas: s.descFaltas, desc_atrasos: s.descAtrasos, inss: s.inss, desc_vt: s.descVt,
        outros_creditos: s.outrosCreditos, outros_descontos: s.outrosDescontos, rubricas: s.rubricas ?? null,
        observacao: s.observacao?.trim() || null, liberado: s.liberado, atualizado_em: new Date().toISOString(),
      }))
    },
    async liberarSalarios(mes, tipo, liberado) {
      ok(await sb.from('salarios').update({ liberado }).eq('mes', mes).eq('tipo', tipo))
    },
    async turnos() {
      const linhas = ok(await sb.from('turnos').select('*').order('ordem')) ?? []
      return linhas.map((r: any) => ({ id: r.id, local: r.local, nome: r.nome, dias: r.dias }))
    },
    async atribuirTurno(fid, turnoId) {
      ok(await sb.from('funcionarios').update({ turno_id: turnoId }).eq('id', fid))
    },
    async salvarTurno(t, novo) {
      const dados = { local: t.local, nome: t.nome, dias: t.dias }
      if (!novo) return void ok(await sb.from('turnos').update(dados).eq('id', t.id))
      const ultimo = ok(await sb.from('turnos').select('ordem').order('ordem', { ascending: false }).limit(1))
      ok(await sb.from('turnos').insert({ ...dados, id: t.id, ordem: (ultimo?.[0]?.ordem ?? 0) + 1 }))
    },
    async excluirTurno(id) {
      // Quem estava no turno fica sem turno (turno_id vira nulo pelo banco).
      ok(await sb.from('turnos').delete().eq('id', id))
    },
    async chamados() {
      const linhas = await todas((de, ate) => sb.from('chamados').select('*, chamado_eventos(*)').order('aberto_em', { ascending: false }).order('id').range(de, ate))
      return linhas.map(paraChamado)
    },
    async abrirChamado(n) {
      let foto: string | null = null
      if (n.foto) {
        foto = `${n.unidadeId}/${crypto.randomUUID()}-${n.foto.name}`
        ok(await sb.storage.from('chamados').upload(foto, n.foto))
      }
      // Quem abriu, data e hora são preenchidos pelo banco.
      const r = ok(await sb.from('chamados').insert({
        unidade_id: n.unidadeId, categoria: n.categoria, gravidade: n.gravidade, titulo: n.titulo,
        descricao: n.descricao, local: n.local || null, foto,
      }).select().single())
      return paraChamado(r)
    },
    async atualizarChamado(id, m) {
      ok(await sb.rpc('atualizar_chamado', { chamado: id, novo_status: m.status ?? null, comentario: m.texto?.trim() || null }))
    },
    async aguardarChamado(id, pessoaId, motivo) {
      ok(await sb.rpc('aguardar_chamado', { p_chamado: id, p_pessoa: pessoaId, p_motivo: motivo.trim() || null }))
    },
    async fotoChamado(c) {
      if (!c.foto) return null
      const { data } = await sb.storage.from('chamados').createSignedUrl(c.foto, 300)
      return data?.signedUrl ?? null
    },
    async versoesRegulamento() {
      const linhas = ok(await sb.from('regulamento_versoes').select('*').order('numero', { ascending: false })) ?? []
      return linhas.map(paraVersao)
    },
    async publicarRegulamento(texto, nota) {
      return paraVersao(ok(await sb.from('regulamento_versoes').insert({ texto, nota: nota || null, publicado_por: exigeEu().id }).select().single()))
    },
    async leiturasRegulamento() {
      const linhas = ok(await sb.from('regulamento_leituras').select('*')) ?? []
      return linhas.map((r: any) => ({
        funcionarioId: r.funcionario_id, versaoId: r.versao_id, assinatura: r.assinatura, assinadoEm: r.assinado_em,
        hash: r.hash, dispositivo: r.dispositivo, ip: r.ip,
      }))
    },
    async assinarRegulamento(versaoId, assinatura) {
      // Data, hash do texto e IP são gravados pelo banco, não pelo aparelho.
      ok(await sb.from('regulamento_leituras').insert({ funcionario_id: exigeEu().id, versao_id: versaoId, assinatura, dispositivo: navigator.userAgent }))
    },
    async avaliacoes() {
      const linhas = ok(await sb.from('avaliacoes').select('*')) ?? []
      return linhas.map((r: any): Avaliacao => ({
        unidadeId: r.unidade_id, plataforma: r.plataforma, nota: Number(r.nota), totalAvaliacoes: r.total_avaliacoes,
        notaHa30Dias: r.nota_ha_30_dias === null ? null : Number(r.nota_ha_30_dias), atualizadoEm: r.atualizado_em,
      }))
    },
    async resultados() {
      const [linhas, sinc] = await Promise.all([
        sb.from('lf_resultados').select('*'),
        sb.from('lf_sincronizacao').select('em').eq('dado', 'resultados').maybeSingle(),
      ])
      return {
        atualizadoEm: ok(sinc)?.em ?? null,
        linhas: (ok(linhas) ?? []).map((r: any) => ({
          unidadeId: r.unidade_id, mes: r.mes, pedidos: r.pedidos, faturamento: Number(r.faturamento), cmv: Number(r.cmv),
          impostos: Number(r.impostos), comissoes: Number(r.comissoes), taxasPagamento: Number(r.taxas_pagamento),
          custosOperacionais: Number(r.custos_operacionais), lucroOperacional: Number(r.lucro_operacional), ticketMedio: Number(r.ticket_medio),
        })),
      }
    },
    async freelancers() {
      return (ok(await sb.from('freelancers').select('*').order('nome')) ?? []).map(paraFreelancer)
    },
    async salvarFreelancer(f) {
      const linha = {
        nome: nomeProprio(f.nome), cpf: f.cpf ? soDigitos(f.cpf) : null, pix: f.pix.trim(), celular: f.celular ? soDigitos(f.celular) : null,
        ativo: f.ativo, funcionario_id: f.funcionarioId,
      }
      const r = f.id
        ? ok(await sb.from('freelancers').update(linha).eq('id', f.id).select().single())
        : ok(await sb.from('freelancers').insert({ ...linha, criado_por: exigeEu().id }).select().single())
      return paraFreelancer(r)
    },
    async excluirFreelancer(id) {
      ok(await sb.rpc('freela_excluir', { p_freelancer: id }))
    },
    async diariasFreela(inicio, fim) {
      return (ok(await sb.from('freela_diarias').select('*').gte('data', inicio).lte('data', fim).order('data')) ?? []).map(paraDiaria)
    },
    async lancarDiaria(d) {
      const { data, error } = await sb.from('freela_diarias').insert({
        freelancer_id: d.freelancerId, data: d.data, turno: d.turno, unidade_id: d.unidadeId, funcao: d.funcao.trim(),
        valor: d.valor, observacao: d.observacao?.trim() || null,
      }).select().single()
      if (error?.code === '23505') throw new Error('Esse freelancer já tem diária lançada nesse dia e turno.')
      return paraDiaria(ok({ data, error }))
    },
    async excluirDiaria(id) {
      ok(await sb.from('freela_diarias').delete().eq('id', id))
    },
    async pagamentosFreela(semana) {
      return (ok(await sb.from('freela_pagamentos').select('*').eq('semana', semana)) ?? []).map((r: any) => ({
        freelancerId: r.freelancer_id, semana: r.semana, valor: Number(r.valor), pagoEm: r.pago_em, pagoPor: r.pago_por,
      }))
    },
    async marcarPagoFreela(freelancerId, semana, valor) {
      ok(await sb.from('freela_pagamentos').insert({ freelancer_id: freelancerId, semana, valor }))
    },
    async desfazerPagoFreela(freelancerId, semana) {
      ok(await sb.from('freela_pagamentos').delete().eq('freelancer_id', freelancerId).eq('semana', semana))
    },
    async publicarGuia(funcionarioId, arquivo) {
      const u = exigeEu()
      const codigo = codigoAleatorio()
      ok(await sb.storage.from('guias').upload(`${codigo}.pdf`, arquivo, { contentType: 'application/pdf' }))
      ok(await sb.from('links_guia').insert({ codigo, funcionario_id: funcionarioId, expira_em: new Date(Date.now() + 7 * 86400_000).toISOString(), criado_por: u.id }))
      return linkDaGuia(codigo)
    },
    async abrirGuia(codigo) {
      const vale = ok(await sb.rpc('guia_valida', { p_codigo: codigo }))
      return vale ? sb.storage.from('guias').getPublicUrl(`${codigo}.pdf`).data.publicUrl : null
    },
    async lojasParaDiaria() {
      return ok(await sb.rpc('freela_lojas')) ?? []
    },
    async freelaQuemSou(cpf, celular) {
      return ok(await sb.rpc('freela_quem_sou', { p_cpf: cpf, p_celular: celular }))
    },
    async enviarDiarias(e) {
      return ok(await sb.rpc('freela_enviar_diarias', {
        p_cpf: e.cpf, p_celular: e.celular, p_nome: nomeProprio(e.nome), p_pix: e.pix, p_unidade: e.unidadeId, p_funcao: e.funcao, p_dias: e.dias, p_local: e.local,
      }))
    },
    async enviarMinhasDiarias(e) {
      return ok(await sb.rpc('freela_enviar_minhas_diarias', { p_pix: e.pix, p_unidade: e.unidadeId, p_funcao: e.funcao, p_dias: e.dias, p_local: e.local }))
    },
    async locaisLojas() {
      return (ok(await sb.from('unidades').select('id, nome, latitude, longitude').order('nome')) ?? []) as any
    },
    async definirLocalLoja(unidadeId, lat, lng) {
      ok(await sb.rpc('definir_local_loja', { p_unidade: unidadeId, p_lat: lat, p_lng: lng }))
    },
    async enviosFreela(status) {
      let q = sb.from('freela_envios').select('*')
      q = status === 'meus' ? q.eq('funcionario_id', exigeEu().id).order('data', { ascending: false }).limit(30) : q.eq('status', status).order('data')
      return (ok(await q) ?? []).map(paraEnvio)
    },
    async aprovarEnvioFreela(id, valor, funcao, usarPixNovo) {
      ok(await sb.rpc('freela_aprovar_envio', { p_envio: id, p_valor: valor, p_funcao: funcao, p_usar_pix: usarPixNovo }))
    },
    async recusarEnvioFreela(id, motivo) {
      ok(await sb.from('freela_envios').update({
        status: 'recusado', motivo: motivo.trim() || null, resolvido_por: exigeEu().id, resolvido_em: new Date().toISOString(),
      }).eq('id', id).eq('status', 'pendente'))
    },

    async operacoes() {
      return (ok(await sb.from('operacoes').select('id, nome, ativa').order('nome')) ?? []) as Operacao[]
    },
    async salvarOperacao(o) {
      ok(await sb.from('operacoes').upsert({ id: o.id, nome: o.nome.trim(), ativa: o.ativa }))
    },
    async eventos() {
      return (ok(await sb.from('eventos').select(SELECT_EVENTO).order('numero', { ascending: false })) ?? []).map(paraEvento)
    },
    async salvarEvento(e) {
      const linha = {
        nome: e.nome.trim(), status: e.status, status_motivo: texto(e.statusMotivo), tipo: texto(e.tipo), organizador: texto(e.organizador),
        organizador_contato: texto(e.organizadorContato), local: texto(e.local), endereco: texto(e.endereco), publico_estimado: e.publicoEstimado,
        montagem_inicio: e.montagemInicio || null, montagem_fim: e.montagemFim || null, desmontagem_inicio: e.desmontagemInicio || null, desmontagem_fim: e.desmontagemFim || null,
        taxa_organizador_pct: e.taxaOrganizadorPct, valor_fixo: e.valorFixo, condicoes: texto(e.condicoes), quem_recebe: e.quemRecebe,
        repasse_prazo_dias: e.repassePrazoDias, repasse_obs: texto(e.repasseObs), infraestrutura: texto(e.infraestrutura), observacao: texto(e.observacao),
        cidade: texto(e.cidade), gastronomia: texto(e.gastronomia), barracas: e.barracas, margem_seguranca_pct: e.margemSegurancaPct, diaria_freela: e.diariaFreela,
      }
      let id = e.id
      if (id) {
        // Só grava se ninguém salvou depois que eu abri (atualizado_em igual ao que eu li).
        const r = ok(await sb.from('eventos').update(linha).eq('id', id).eq('atualizado_em', e.atualizadoEm!).select('id')) ?? []
        if (!r.length) throw new Error(EVENTO_ALTERADO)
      } else id = (ok(await sb.from('eventos').insert(linha).select('id').single()) as { id: string }).id
      const dias = e.dias.filter((d) => d.data)
      if (dias.length)
        ok(await sb.from('evento_dias').upsert(dias.map((d) => ({ evento_id: id, data: d.data, abre: d.abre || null, fecha: d.fecha || null })), { onConflict: 'evento_id,data' }))
      let tirarDias = sb.from('evento_dias').delete().eq('evento_id', id)
      if (dias.length) tirarDias = tirarDias.not('data', 'in', `(${dias.map((d) => d.data).join(',')})`)
      ok(await tirarDias)
      ok(await sb.from('evento_operacoes').delete().eq('evento_id', id))
      if (e.operacoes.length) ok(await sb.from('evento_operacoes').insert(e.operacoes.map((o) => ({ evento_id: id, operacao_id: o }))))
      ok(await sb.from('evento_responsaveis').delete().eq('evento_id', id))
      if (e.responsaveis.length)
        ok(await sb.from('evento_responsaveis').insert(e.responsaveis.map((r) => ({ evento_id: id, funcionario_id: r.funcionarioId, papel: texto(r.papel) }))))
      return paraEvento(ok(await sb.from('eventos').select(SELECT_EVENTO).eq('id', id).single()))
    },
    async historicoEvento(eventoId) {
      return (ok(await sb.from('evento_historico').select('*').eq('evento_id', eventoId).order('em', { ascending: false })) ?? []).map((r: any): HistoricoEvento => ({
        id: r.id, eventoId: r.evento_id, em: r.em, por: r.por, tipo: r.tipo, de: r.de, para: r.para, campos: r.campos, motivo: r.motivo,
      }))
    },

    async fornecedores() {
      return (ok(await sb.from('fornecedores').select('*').order('nome')) ?? []).map(paraFornecedor)
    },
    async salvarFornecedor(f) {
      const linha = {
        nome: f.nome.trim(), contato: texto(f.contato), telefone: texto(f.telefone), observacao: texto(f.observacao), ativo: f.ativo,
        ...(f.cnpj !== undefined ? { cnpj: f.cnpj ? soDigitos(f.cnpj) || null : null } : {}),
        ...(f.contaPadraoId !== undefined ? { conta_padrao_id: f.contaPadraoId } : {}),
        ...(f.razaoSocial !== undefined ? { razao_social: f.razaoSocial?.trim() || null } : {}),
        ...(f.prazoEntregaDias !== undefined ? { prazo_entrega_dias: f.prazoEntregaDias } : {}),
      }
      return paraFornecedor(f.id
        ? ok(await sb.from('fornecedores').update(linha).eq('id', f.id).select().single())
        : ok(await sb.from('fornecedores').insert(linha).select().single()))
    },
    async insumos() {
      return (await todas((de, ate) => sb.from('insumos').select('*').order('nome').order('id').range(de, ate))).map(paraInsumo)
    },
    async salvarInsumo(i) {
      const linha = {
        nome: nomeItem(i.nome), categoria: texto(i.categoria), unidade: i.unidade, embalagem: texto(i.embalagem), embalagem_qtd: i.embalagemQtd,
        preco: i.preco, fornecedor_id: i.fornecedorId, observacao: texto(i.observacao), ativo: i.ativo,
        ...(i.setorEnvio !== undefined && { setor_envio: i.setorEnvio }),
        ...(i.contaId !== undefined && { conta_id: i.contaId }),
        ...(i.estoqueMinimo !== undefined && { estoque_minimo: i.estoqueMinimo }),
        ...(i.prePreparo !== undefined && { pre_preparo: i.prePreparo }),
      }
      return paraInsumo(i.id
        ? ok(await sb.from('insumos').update(linha).eq('id', i.id).select().single())
        : ok(await sb.from('insumos').insert(linha).select().single()))
    },
    async categoriasInsumo() {
      return (ok(await sb.from('categorias_insumo').select('nome').order('nome')) ?? []).map((r: { nome: string }) => r.nome)
    },
    async salvarCategoriaInsumo(nome, antigo) {
      if (antigo) ok(await sb.from('categorias_insumo').update({ nome: nome.trim() }).eq('nome', antigo))
      else ok(await sb.from('categorias_insumo').insert({ nome: nome.trim() }))
    },
    async referenciasPreco() {
      return (ok(await sb.rpc('conferencia_precos')) ?? []).map((r: any) => ({
        insumoId: r.insumo_id, precoAnterior: numeroOuNulo(r.preco_anterior), anteriorEm: r.anterior_em, custoEntrada: numeroOuNulo(r.custo_entrada), entradaEm: r.entrada_em,
      }))
    },
    async juntarInsumos(origemId, destinoId) {
      ok(await sb.rpc('juntar_insumos', { p_origem: origemId, p_destino: destinoId }))
    },
    async excluirInsumos(ids) {
      return (ok(await sb.rpc('excluir_insumos', { p_ids: ids })) ?? []).map((r: any) => ({ insumoId: r.insumo_id, nome: r.nome, excluido: r.excluido, motivo: r.motivo }))
    },
    async controlarEstoque(ids, controla) {
      ok(await sb.from('insumos').update({ controla_estoque: controla }).in('id', ids))
    },
    async ativarInsumos(ids, ativo) {
      ok(await sb.from('insumos').update({ ativo }).in('id', ids))
    },
    async conferirPrecoInsumo(id, preco) {
      ok(await sb.from('insumos').update({ preco_conferido: preco }).eq('id', id))
    },
    async juntarCategoriaInsumo(de, para) {
      ok(await sb.rpc('juntar_categoria_insumo', { p_de: de, p_para: para }))
    },
    async precosInsumo(id) {
      return (ok(await sb.from('insumo_precos').select('*').eq('insumo_id', id).order('em', { ascending: false })) ?? []).map((r: any) => ({
        id: r.id, insumoId: r.insumo_id, preco: numeroOuNulo(r.preco), em: r.em, por: r.por, origem: r.origem,
      }))
    },
    async receitas() {
      return (await todas((de, ate) => sb.from('receitas').select('*').order('nome').order('id').range(de, ate))).map(paraReceita)
    },
    async versoesReceitas() {
      return (await todas((de, ate) => sb.from('receita_versoes').select('*, receita_itens(ordem, insumo_id, sub_receita_id, quantidade, aproveitamento, so_delivery)').order('numero').order('id').range(de, ate))).map(
        (r: any): VersaoReceita => ({
          id: r.id, receitaId: r.receita_id, numero: r.numero, rendimento: Number(r.rendimento), custoTotal: numeroOuNulo(r.custo_total), nota: r.nota,
          criadaEm: r.criada_em, criadaPor: r.criada_por,
          itens: (r.receita_itens ?? [])
            .sort((a: any, b: any) => a.ordem - b.ordem)
            .map((i: any) => ({ insumoId: i.insumo_id, subReceitaId: i.sub_receita_id, quantidade: Number(i.quantidade), aproveitamento: Number(i.aproveitamento), soDelivery: !!i.so_delivery })),
        }),
      )
    },
    async salvarReceita(r) {
      const linha = {
        nome: r.nome.trim(), tipo: r.tipo, linha: texto(r.linha), operacao_id: r.operacaoId, origem: r.origem, unidade: r.unidade, preco_venda: r.precoVenda,
        tempo_preparo_min: r.tempoPreparoMin, tempo_finalizacao_min: r.tempoFinalizacaoMin, capacidade_hora: r.capacidadeHora, equipamentos: texto(r.equipamentos),
        conservacao: texto(r.conservacao), validade_dias: r.validadeDias, modo_preparo: texto(r.modoPreparo), ativo: r.ativo, atualizado_em: new Date().toISOString(),
        ...(r.area ? { area: r.area } : {}),
        ...(r.observacoes !== undefined ? { observacoes: texto(r.observacoes) } : {}),
        ...(r.responsavel !== undefined ? { responsavel: texto(r.responsavel) } : {}),
        ...(r.porcaoNome !== undefined ? { porcao_nome: texto(r.porcaoNome), porcao_qtd: r.porcaoQtd ?? null } : {}),
        ...(r.lotes !== undefined ? { lotes: r.lotes?.length ? r.lotes : null } : {}),
      }
      return paraReceita(r.id
        ? ok(await sb.from('receitas').update(linha).eq('id', r.id).select().single())
        : ok(await sb.from('receitas').insert(linha).select().single()))
    },
    async salvarVersaoReceita(receitaId, rendimento, custoTotal, nota, itens) {
      return ok(await sb.rpc('salvar_versao_receita', {
        p_receita: receitaId, p_rendimento: rendimento, p_custo: custoTotal, p_nota: nota,
        p_itens: itens.map((i) => ({ insumo_id: i.insumoId, sub_receita_id: i.subReceitaId, quantidade: i.quantidade, aproveitamento: i.aproveitamento, so_delivery: !!i.soDelivery })),
      })) as number
    },

    async cardapioEvento(eventoId) {
      return (ok(await sb.from('evento_produtos').select('*').eq('evento_id', eventoId).order('ordem')) ?? []).map((r: any) => ({
        receitaId: r.receita_id, preco: numeroOuNulo(r.preco), ordem: r.ordem,
      }))
    },
    async salvarCardapioEvento(eventoId, itens) {
      ok(await sb.from('evento_produtos').delete().eq('evento_id', eventoId))
      if (itens.length) ok(await sb.from('evento_produtos').insert(itens.map((i, o) => ({ evento_id: eventoId, receita_id: i.receitaId, preco: i.preco, ordem: o + 1 }))))
    },
    async previsaoEvento(eventoId) {
      return (ok(await sb.from('evento_previsao').select('*').eq('evento_id', eventoId)) ?? []).map((r: any) => ({
        data: r.data, receitaId: r.receita_id, quantidade: Number(r.quantidade),
      }))
    },
    async salvarPrevisaoEvento(eventoId, linhas) {
      ok(await sb.from('evento_previsao').delete().eq('evento_id', eventoId))
      const l = linhas.filter((x) => x.quantidade > 0)
      if (l.length) ok(await sb.from('evento_previsao').insert(l.map((x) => ({ evento_id: eventoId, data: x.data, receita_id: x.receitaId, quantidade: x.quantidade }))))
    },
    async vendasEventos() {
      return (await todas((de, ate) => sb.from('evento_vendas').select('*').order('id').range(de, ate))).map((r): VendaEvento => ({
        eventoId: r.evento_id, data: r.data, receitaId: r.receita_id, produto: r.produto, quantidade: Number(r.quantidade), total: numeroOuNulo(r.total), origem: r.origem,
      }))
    },
    async salvarVendasEvento(eventoId, linhas) {
      const receitas = (ok(await sb.from('receitas').select('id, nome').in('id', [...new Set(linhas.map((l) => l.receitaId))])) ?? []) as { id: string; nome: string }[]
      ok(await sb.from('evento_vendas').delete().eq('evento_id', eventoId))
      const l = linhas.filter((x) => x.quantidade > 0)
      if (l.length)
        ok(await sb.from('evento_vendas').insert(l.map((x) => ({
          evento_id: eventoId, data: x.data, receita_id: x.receitaId, produto: receitas.find((r) => r.id === x.receitaId)?.nome ?? '?', quantidade: x.quantidade, total: x.total, origem: 'manual',
        }))))
    },

    async modeloChecklist() {
      return (ok(await sb.from('checklist_evento_modelo').select('*').order('ordem')) ?? []).map((r: any): ItemModeloChecklist => ({
        id: r.id, categoria: r.categoria, item: r.item, operacao: r.operacao, operacaoId: r.operacao_id ?? null, quantidade: r.quantidade, ordem: r.ordem, ativo: r.ativo,
      }))
    },
    async salvarItemModelo(i) {
      const linha = { categoria: i.categoria.trim(), item: i.item.trim(), operacao: texto(i.operacao), operacao_id: i.operacaoId, quantidade: texto(i.quantidade), ordem: i.ordem, ativo: i.ativo }
      ok(i.id ? await sb.from('checklist_evento_modelo').update(linha).eq('id', i.id) : await sb.from('checklist_evento_modelo').insert(linha))
    },
    async envios(eventoId) {
      const c = (de: number, ate: number) => {
        const q = sb.from('evento_envios').select('*, evento_envio_itens(*)').order('data').order('criado_em').order('id')
        return (eventoId ? q.eq('evento_id', eventoId) : q).range(de, ate)
      }
      return (await todas(c)).map((r: any): EnvioEvento => ({
        id: r.id, eventoId: r.evento_id, data: r.data, tipo: r.tipo, observacao: r.observacao, criadoPor: r.criado_por, criadoEm: r.criado_em,
        itens: (r.evento_envio_itens ?? []).sort((a: any, b: any) => a.ordem - b.ordem).map((i: any) => ({
          id: i.id, ordem: i.ordem, categoria: i.categoria, operacao: i.operacao, insumoId: i.insumo_id, receitaId: i.receita_id, item: i.item, previsto: numeroOuNulo(i.previsto),
          quantidade: numeroOuNulo(i.quantidade), quantidadeTexto: i.quantidade_texto, unidade: i.unidade, conferido: i.conferido, conferidoPor: i.conferido_por,
          conferidoEm: i.conferido_em, retornou: i.retornou, retornoPor: i.retorno_por, retornoEm: i.retorno_em,
        })),
      }))
    },
    async criarEnvio(eventoId, data, tipo, observacao, itens) {
      const { id } = ok(await sb.from('evento_envios').insert({ evento_id: eventoId, data, tipo, observacao: texto(observacao) }).select('id').single()) as { id: string }
      if (itens.length)
        ok(await sb.from('evento_envio_itens').insert(itens.map((i, o) => ({
          envio_id: id, ordem: o + 1, ...linhaItemEnvio(i),
        }))))
      return id
    },
    async excluirEnvio(id) {
      ok(await sb.from('evento_envios').delete().eq('id', id))
    },
    async adicionarItemEnvio(envioId, i) {
      const ult = (ok(await sb.from('evento_envio_itens').select('ordem').eq('envio_id', envioId).order('ordem', { ascending: false }).limit(1)) ?? []) as { ordem: number }[]
      ok(await sb.from('evento_envio_itens').insert({
        envio_id: envioId, ordem: (ult[0]?.ordem ?? 0) + 1, ...linhaItemEnvio(i),
      }))
    },
    async excluirItemEnvio(itemId) {
      ok(await sb.from('evento_envio_itens').delete().eq('id', itemId))
    },
    async conferirItemEnvio(itemId, etapa, quantidade, feito) {
      ok(await sb.rpc('conferir_item_envio', { p_item: itemId, p_etapa: etapa, p_quantidade: quantidade, p_ok: feito }))
    },
    async inventarios(filtro) {
      let c = sb.from('inventarios').select('*, inventario_itens(insumo_id, receita_id, quantidade)').order('contado_em', { ascending: false })
      c = 'eventoId' in filtro ? c.eq('local', 'evento').eq('evento_id', filtro.eventoId) : c.eq('local', 'base')
      return (ok(await c) ?? []).map((r: any): Inventario => ({
        id: r.id, local: r.local, eventoId: r.evento_id, data: r.data, contadoPor: r.contado_por, contadoEm: r.contado_em, observacao: r.observacao, fala: r.fala,
        itens: (r.inventario_itens ?? []).map((i: any) => ({ chave: chaveDe({ insumoId: i.insumo_id, receitaId: i.receita_id })!, quantidade: Number(i.quantidade) })),
      }))
    },
    async salvarInventario(local, eventoId, data, itens, fala, observacao) {
      ok(await sb.rpc('salvar_inventario', {
        p_local: local, p_evento: eventoId, p_data: data, p_itens: itens.map((i) => {
          const k = daChave(i.chave)
          return { insumo_id: k.insumoId, receita_id: k.receitaId, quantidade: i.quantidade }
        }), p_fala: fala, p_obs: observacao,
      }))
    },
    async itensContagem() {
      return (ok(await sb.rpc('itens_contagem')) ?? []).map((r: any) => ({
        chave: (r.tipo === 'insumo' ? 'i:' : 'r:') + r.id, nome: r.nome, categoria: r.categoria, unidade: r.unidade, embalagem: r.embalagem, embalagemQtd: numeroOuNulo(r.embalagem_qtd),
      }))
    },
    async meusEventosEscalados() {
      return (ok(await sb.rpc('meus_eventos_escalados')) ?? []).map((r: any) => ({
        id: r.id, nome: r.nome, status: r.status, papel: r.papel,
        dias: (r.dias ?? []).map((d: any) => ({ data: d.data, abre: d.abre?.slice(0, 5) ?? null, fecha: d.fecha?.slice(0, 5) ?? null })),
      }))
    },

    async freelasEvento() {
      return (ok(await sb.from('freelas_evento').select('*').order('nome')) ?? []).map(paraFreelaEvento)
    },
    async salvarFreelaEvento(f) {
      const linha = {
        nome: nomeProprio(f.nome), cpf: soDigitos(f.cpf), pix: f.pix.trim(), celular: f.celular ? soDigitos(f.celular).slice(-11) : null,
        funcao: texto(f.funcao), valor_diaria: f.valorDiaria, observacao: texto(f.observacao), ativo: f.ativo,
      }
      const r = f.id
        ? ok(await sb.from('freelas_evento').update(linha).eq('id', f.id).select('*').single())
        : ok(await sb.from('freelas_evento').insert(linha).select('*').single())
      return paraFreelaEvento(r)
    },
    async producaoEvento(eventoId) {
      const r = ok(await sb.from('evento_producao').select('insumo_id, receita_id, dia, quantidade').eq('evento_id', eventoId)) ?? []
      return r.map((x: any) => ({ chave: x.insumo_id ? 'i:' + x.insumo_id : 'r:' + x.receita_id, dia: x.dia, quantidade: Number(x.quantidade) }))
    },
    async salvarProducaoEvento(eventoId, linhas) {
      ok(await sb.from('evento_producao').delete().eq('evento_id', eventoId))
      if (linhas.length) ok(await sb.from('evento_producao').insert(linhas.map((l) => ({
        evento_id: eventoId, insumo_id: l.chave.startsWith('i:') ? l.chave.slice(2) : null, receita_id: l.chave.startsWith('r:') ? l.chave.slice(2) : null, dia: l.dia, quantidade: l.quantidade,
      }))))
    },
    async pedidoInsumosEvento(eventoId) {
      const r = ok(await sb.from('evento_pedido_insumos').select('insumo_id, quantidade').eq('evento_id', eventoId)) ?? []
      return Object.fromEntries(r.map((x: any) => [x.insumo_id, Number(x.quantidade)]))
    },
    async salvarPedidoInsumosEvento(eventoId, valores) {
      const sim = Object.entries(valores).filter(([, q]) => q !== null).map(([insumo_id, q]) => ({ evento_id: eventoId, insumo_id, quantidade: q, atualizado_em: new Date().toISOString() }))
      const nao = Object.entries(valores).filter(([, q]) => q === null).map(([id]) => id)
      if (sim.length) ok(await sb.from('evento_pedido_insumos').upsert(sim, { onConflict: 'evento_id,insumo_id' }))
      if (nao.length) ok(await sb.from('evento_pedido_insumos').delete().eq('evento_id', eventoId).in('insumo_id', nao))
    },
    async diariasFreelaEvento(filtro) {
      let q = sb.from('evento_freela_diarias').select('*')
      q = 'eventoId' in filtro ? q.eq('evento_id', filtro.eventoId).neq('status', 'recusado') : q.eq('status', filtro.status)
      return (ok(await q.order('data').order('enviado_em')) ?? []).map(paraDiariaEvento)
    },
    async lancarDiariaFreelaEvento(d) {
      const f = ok(await sb.from('freelas_evento').select('cpf').eq('id', d.freelaId).single()) as { cpf: string }
      ok(await sb.from('evento_freela_diarias').insert({
        evento_id: d.eventoId, freela_id: d.freelaId, cpf: f.cpf, data: d.data, funcao: d.funcao.trim(), valor: d.valor, observacao: texto(d.observacao),
        origem: 'gestao', status: 'aprovado', resolvido_por: exigeEu().id, resolvido_em: new Date().toISOString(),
      }))
    },
    async aprovarDiariaFreelaEvento(id, valor, funcao, usarPixNovo) {
      ok(await sb.rpc('freela_evento_aprovar', { p_diaria: id, p_valor: valor, p_funcao: funcao, p_usar_pix: usarPixNovo }))
    },
    async recusarDiariaFreelaEvento(id, motivo) {
      ok(await sb.from('evento_freela_diarias').update({
        status: 'recusado', motivo: motivo.trim() || null, resolvido_por: exigeEu().id, resolvido_em: new Date().toISOString(),
      }).eq('id', id).eq('status', 'pendente'))
    },
    async excluirDiariaFreelaEvento(id) {
      ok(await sb.from('evento_freela_diarias').delete().eq('id', id))
    },
    async marcarPagoFreelaEvento(eventoId, freelaId, pago) {
      ok(await sb.from('evento_freela_diarias')
        .update(pago ? { pago_em: new Date().toISOString(), pago_por: exigeEu().id } : { pago_em: null, pago_por: null })
        .eq('evento_id', eventoId).eq('freela_id', freelaId).eq('status', 'aprovado'))
    },
    async definirLocalEvento(eventoId, lat, lng) {
      ok(await sb.rpc('definir_local_evento', { p_evento: eventoId, p_lat: lat, p_lng: lng }))
    },
    async equipeEvento(eventoId) {
      return (ok(await sb.from('evento_equipe').select('*').eq('evento_id', eventoId).order('ordem').order('criado_em')) ?? []).map(paraMembroEquipe)
    },
    async salvarMembroEquipe(m) {
      const linha = {
        evento_id: m.eventoId, funcionario_id: m.funcionarioId, freela_id: m.freelaId, nome: m.nome?.trim() || null, funcao: m.funcao?.trim() || null,
        barraca: m.barraca, posicao: m.posicao, observacao: m.observacao?.trim() || null, ordem: m.ordem,
      }
      const r = m.id
        ? ok(await sb.from('evento_equipe').update(linha).eq('id', m.id).select().single())
        : ok(await sb.from('evento_equipe').insert(linha).select().single())
      return paraMembroEquipe(r)
    },
    async excluirMembroEquipe(id) {
      ok(await sb.from('evento_equipe').delete().eq('id', id))
    },
    async salvarLayoutBarracas(eventoId, layout) {
      ok(await sb.from('eventos').update({ layout_barracas: layout }).eq('id', eventoId))
    },
    async marcarForaDaMedia(eventoId, fora) {
      ok(await sb.from('eventos').update({ fora_da_media: fora }).eq('id', eventoId))
    },
    async eventosAbertosDiaria() {
      return (ok(await sb.rpc('freela_eventos_abertos')) ?? []).map((r: any) => ({ id: r.id, nome: r.nome, dias: r.dias ?? [] }))
    },
    async freelaEventoQuemSou(cpf, celular) {
      return ok(await sb.rpc('freela_evento_quem_sou', { p_cpf: cpf, p_celular: celular }))
    },
    async enviarDiariasEvento(e) {
      return ok(await sb.rpc('freela_evento_enviar', {
        p_cpf: e.cpf, p_celular: e.celular, p_nome: e.nome ? nomeProprio(e.nome) : '', p_pix: e.pix, p_evento: e.eventoId, p_funcao: e.funcao, p_dias: e.dias, p_local: e.local,
      }))
    },

    // Financeiro e estoque (0044).
    async centrosCusto() {
      return (ok(await sb.from('centros_custo').select('*').order('ordem')) ?? []).map((r: any) => ({ id: r.id, nome: r.nome, cnpj: r.cnpj, ativo: r.ativo }))
    },
    async planoContas() {
      return (ok(await sb.from('plano_contas').select('*').order('ordem')) ?? []).map((r: any) => ({
        id: r.id, codigo: r.codigo, nome: r.nome, paiCodigo: r.pai_codigo, operacional: r.operacional, ordem: r.ordem, ativo: r.ativo,
      }))
    },
    async salvarContaContabil(c) {
      const linha = { codigo: c.codigo.trim(), nome: c.nome.trim(), pai_codigo: c.paiCodigo, operacional: c.operacional, ordem: c.ordem, ativo: c.ativo }
      if (c.id) ok(await sb.from('plano_contas').update(linha).eq('id', c.id))
      else ok(await sb.from('plano_contas').insert(linha))
    },
    async notasFiscais() {
      return (await todas((de, ate) => sb.from('notas_fiscais').select('id, chave, numero, serie, emissao, fornecedor_id, emitente_cnpj, emitente_nome, destinatario_cnpj, centro_custo_id, valor_produtos, frete, desconto, valor_total, pagamento_xml, duplicatas, arquivo, observacao, status, lancada_em, criado_em, extrato_movimento_id').order('emissao', { ascending: false }).order('id').range(de, ate))).map(paraNota)
    },
    async notaFiscal(id) {
      return paraNota(ok(await sb.from('notas_fiscais').select('id, chave, numero, serie, emissao, fornecedor_id, emitente_cnpj, emitente_nome, destinatario_cnpj, centro_custo_id, valor_produtos, frete, desconto, valor_total, pagamento_xml, duplicatas, arquivo, observacao, status, lancada_em, criado_em, extrato_movimento_id, nota_itens(*)').eq('id', id).single()))
    },
    async importarNota(n) {
      return ok(await sb.rpc('importar_nota', {
        p: {
          chave: n.chave, numero: n.numero, serie: n.serie, emissao: n.emissao, emitente: n.emitente, destinatario_cnpj: n.destinatarioCnpj,
          totais: n.totais, pagamento: n.pagamento, duplicatas: n.duplicatas, xml: n.xml,
          itens: n.itens.map((i) => ({
            codigo: i.codigo, ean: i.ean, descricao: i.descricao, ncm: i.ncm, cfop: i.cfop, unidade: i.unidade,
            quantidade: i.quantidade, valor_unit: i.valorUnit, valor_total: i.valorTotal,
          })),
        },
      }))
    },
    async criarNotaManual(n) {
      let arquivo: string | null = null
      if (n.arquivo) {
        arquivo = `notas/${n.emissao.slice(0, 7)}/${crypto.randomUUID()}-${n.arquivo.name.replace(/[^\w.-]/g, '_')}`
        ok(await sb.storage.from('documentos').upload(arquivo, n.arquivo))
      }
      const r = ok(await sb.from('notas_fiscais').insert({
        numero: texto(n.numero), emissao: n.emissao, fornecedor_id: n.fornecedorId, emitente_nome: texto(n.emitenteNome),
        centro_custo_id: n.centroCustoId, valor_total: n.valorTotal, observacao: texto(n.observacao), arquivo,
        extrato_movimento_id: n.extratoMovimentoId ?? null,
      }).select('id').single())
      return r!.id
    },
    async salvarItensNota(notaId, itens) {
      ok(await sb.from('nota_itens').delete().eq('nota_id', notaId))
      if (!itens.length) return []
      const linhas = ok(await sb.from('nota_itens').insert(itens.map((i, k) => ({
        nota_id: notaId, ordem: k + 1, descricao: i.descricao.trim(), unidade: texto(i.unidade), quantidade: i.quantidade,
        valor_unit: i.quantidade > 0 ? Math.round((i.valorTotal / i.quantidade) * 1e6) / 1e6 : null, valor_total: i.valorTotal, insumo_id: i.insumoId,
      }))).select('*')) ?? []
      return paraNota({ nota_itens: linhas } as any).itens ?? []
    },
    async ligarNotaExtrato(notaId, movimentoId) {
      ok(await sb.from('notas_fiscais').update({ extrato_movimento_id: movimentoId }).eq('id', notaId).eq('status', 'conferir'))
    },
    async linkArquivoNota(caminho) {
      const { data } = await sb.storage.from('documentos').createSignedUrl(caminho, 300)
      return data?.signedUrl ?? ''
    },
    async lancarNota(id, l) {
      ok(await sb.rpc('lancar_nota', {
        p_nota: id, p_centro: l.centroCustoId, p_conta: l.contaId, p_competencia: l.competencia,
        p_itens: l.itens.map((i) => ({ id: i.id, insumo_id: i.insumoId, fator: i.fator, fora_estoque: i.foraEstoque })),
        p_parcelas: l.parcelas.map((p) => ({ vencimento: p.vencimento, valor: p.valor, forma: p.forma, documento: p.documento ?? null })),
        p_atualizar_preco: l.atualizarPreco,
      }))
    },
    async estornarNota(id) {
      ok(await sb.rpc('estornar_nota', { p_nota: id }))
    },
    async excluirNota(id) {
      ok(await sb.from('notas_fiscais').delete().eq('id', id).eq('status', 'conferir'))
    },
    async contasPagar() {
      return (await todas((de, ate) => sb.from('contas_pagar').select('*').order('vencimento').order('id').range(de, ate))).map(paraContaPagar)
    },
    async contasDaNota(notaId) {
      return (ok(await sb.from('contas_pagar').select('*').eq('nota_id', notaId).order('vencimento')) ?? []).map(paraContaPagar)
    },
    async contasRecorrentes() {
      return (ok(await sb.from('contas_recorrentes').select('*').order('dia').order('descricao')) ?? []).map(paraRecorrente)
    },
    async salvarRecorrente(r) {
      const linha = {
        descricao: r.descricao.trim(), fornecedor_id: r.fornecedorId, fornecedor_nome: texto(r.fornecedorNome), centro_custo_id: r.centroCustoId,
        conta_id: r.contaId, valor: r.valor, variavel: r.variavel, dia: r.dia, forma: r.forma, inicio: r.inicio, fim: r.fim || null,
        situacao: r.situacao, observacao: texto(r.observacao),
      }
      const salva = paraRecorrente(r.id
        ? ok(await sb.from('contas_recorrentes').update(linha).eq('id', r.id).select().single())
        : ok(await sb.from('contas_recorrentes').insert(linha).select().single()))
      // As contas que ela já lançou e ainda não foram pagas acompanham a mudança (ou saem, se parou).
      if (r.id) {
        const abertas = (ok(await sb.from('contas_pagar').select('id, vencimento, competencia').eq('recorrente_id', r.id).is('pago_em', null)
          .eq('conciliado', false).gte('vencimento', hoje())) ?? []) as { id: string; vencimento: string; competencia: string }[]
        for (const c of abertas) {
          const mes = c.vencimento.slice(0, 7)
          if (salva.situacao !== 'ativa' || (salva.fim && mes > salva.fim) || mes < salva.inicio) {
            ok(await sb.from('contas_pagar').delete().eq('id', c.id))
            continue
          }
          const venc = diaDoMes(mes, salva.dia)
          ok(await sb.from('contas_pagar').update({
            descricao: salva.descricao, fornecedor_id: salva.fornecedorId, favorecido: salva.fornecedorId ? null : salva.fornecedorNome,
            centro_custo_id: salva.centroCustoId, conta_id: salva.contaId, valor: salva.valor, forma: salva.forma, vencimento: venc,
          }).eq('id', c.id))
        }
      }
      return salva
    },
    async excluirRecorrente(id) {
      ok(await sb.from('contas_pagar').delete().eq('recorrente_id', id).is('pago_em', null).eq('conciliado', false))
      ok(await sb.from('contas_recorrentes').delete().eq('id', id))
    },
    async atualizarContasAutomaticas(ateMes) {
      ok(await sb.rpc('gerar_contas_recorrentes', { p_ate: ateMes }))
      ok(await sb.rpc('sincronizar_pessoal'))
    },
    async conciliarLote(movimentoId, contaIds, contaDiferencaId) {
      ok(await sb.rpc('conciliar_lote', { p_mov: movimentoId, p_contas: contaIds, p_conta_diferenca: contaDiferencaId }))
    },
    async salvarContasPagar(contas) {
      const linhas = contas.map((c) => ({
        ...(c.id ? { id: c.id } : {}),
        centro_custo_id: c.centroCustoId, conta_id: c.contaId, fornecedor_id: c.fornecedorId, favorecido: texto(c.favorecido), descricao: c.descricao.trim(),
        competencia: c.competencia, vencimento: c.vencimento, valor: c.valor, forma: c.forma, parcela: c.parcela, parcelas: c.parcelas,
        documento: texto(c.documento), nota_id: c.notaId, observacao: texto(c.observacao),
        ...(c.origem ? { origem: c.origem } : {}),
        ...(c.pagoEm ? { pago_em: c.pagoEm, valor_pago: c.valorPago ?? c.valor, pago_por: exigeEu().id } : {}),
      }))
      const novas = linhas.filter((l) => !('id' in l))
      const editadas = linhas.filter((l) => 'id' in l)
      // Em blocos; com origem, o que já foi importado antes fica de fora (importar o mesmo arquivo duas vezes não duplica).
      for (let i = 0; i < novas.length; i += 500) {
        const bloco = novas.slice(i, i + 500)
        if (bloco.some((l) => 'origem' in l)) ok(await sb.from('contas_pagar').upsert(bloco, { onConflict: 'origem', ignoreDuplicates: true }))
        else ok(await sb.from('contas_pagar').insert(bloco))
      }
      for (const l of editadas) ok(await sb.from('contas_pagar').update(l).eq('id', (l as { id: string }).id))
    },
    async pagarConta(id, p) {
      const u = exigeEu()
      ok(await sb.from('contas_pagar').update(p
        ? { pago_em: p.pagoEm, valor_pago: p.valorPago, forma: p.forma, pago_por: u.id }
        : { pago_em: null, valor_pago: null, pago_por: null, conciliado: false }).eq('id', id))
    },
    async excluirContaPagar(id) {
      ok(await sb.from('contas_pagar').delete().eq('id', id))
    },
    async movimentosEstoque(de, ate) {
      return (await todas((x, y) => sb.from('estoque_movimentos').select('*').gte('data', de).lte('data', ate).order('data', { ascending: false }).order('id').range(x, y))).map((r: any) => ({
        id: r.id, centroCustoId: r.centro_custo_id, insumoId: r.insumo_id, data: r.data, tipo: r.tipo, quantidade: Number(r.quantidade),
        custoUnit: numeroOuNulo(r.custo_unit), notaItemId: r.nota_item_id, observacao: r.observacao, criadoEm: r.criado_em, producaoId: r.producao_id ?? null,
      }))
    },
    async saldosEstoque(centroCustoId) {
      return (ok(await sb.rpc('saldos_estoque', { p_centro: centroCustoId })) ?? []).map((r: any): SaldoEstoque => ({
        insumoId: r.insumo_id, quantidade: Number(r.quantidade), custo: numeroOuNulo(r.custo), ultima: r.ultima,
      }))
    },
    async extrato() {
      const linhas = await todas((de, ate) => sb.from('extrato_movimentos').select('*').order('data', { ascending: false }).order('id').range(de, ate))
      return linhas.map((r): MovimentoExtrato => ({
        id: r.id, banco: r.banco, agencia: r.agencia, conta: r.conta, fitid: r.fitid, data: r.data, valor: Number(r.valor), descricao: r.descricao,
        documento: r.documento, tipo: r.tipo, status: r.status, contaPagarId: r.conta_pagar_id, observacao: r.observacao, importadoEm: r.importado_em,
      }))
    },
    async saldosExtrato() {
      return (ok(await sb.from('extrato_saldos').select('*').order('data', { ascending: false })) ?? []).map((r: any) => ({
        banco: r.banco, agencia: r.agencia, conta: r.conta, data: r.data, saldo: Number(r.saldo),
      }))
    },
    async motoboys() {
      return (ok(await sb.from('motoboys').select('*').order('nome')) ?? []).map(paraMotoboy)
    },
    async salvarMotoboy(m) {
      const u = exigeEu()
      const linha = {
        nome: nomeProprio(m.nome), unidade_id: m.unidadeId || null, pix: texto(m.pix), telefone: m.telefone ? soDigitos(m.telefone) || null : null,
        cpf: m.cpf ? soDigitos(m.cpf) || null : null, observacao: texto(m.observacao), ativo: m.ativo,
        responsavel: !!m.responsavel, ...(m.adicionalResponsavel !== undefined ? { adicional_responsavel: m.adicionalResponsavel } : {}),
        ...(m.valorDiaria !== undefined ? { valor_diaria: m.valorDiaria, valor_diaria_fds: m.valorDiariaFds ?? 115, entregas_incluidas: m.entregasIncluidas ?? 10, valor_entrega: m.valorEntrega ?? 4 } : {}),
      }
      if (!linha.nome) throw new Error('Diga o nome.')
      const r = m.id
        ? ok(await sb.from('motoboys').update(linha).eq('id', m.id).select().single())
        : ok(await sb.from('motoboys').insert({ ...linha, criado_por: u.id }).select().single())
      return paraMotoboy(r)
    },
    async semanasMotoboys(de, ate) {
      return (ok(await sb.rpc('semanas_motoboys', { p_de: de, p_ate: ate })) ?? []).map((r: any) => ({
        id: r.id, motoboyId: r.motoboy_id, unidadeId: r.unidade_id, pagamento: r.pagamento, diarias: Number(r.diarias), entregas: Number(r.entregas),
        extras: (r.extras ?? []).map((e: any) => ({ descricao: e.descricao ?? '', valor: Number(e.valor) })), total: Number(r.total), pagoEm: r.pago_em, conciliado: r.conciliado, dias: r.dias ?? {},
      }))
    },
    async salvarSemanaMotoboys(pagamento, unidadeId, linhas) {
      ok(await sb.rpc('salvar_motoboys_semana', {
        p_pagamento: pagamento, p_unidade: unidadeId,
        p_linhas: linhas.map((l) => ({ motoboy_id: l.motoboyId, diarias: l.diarias, entregas: l.entregas, extras: l.extras, ja_pago: l.jaPago, dias: l.dias ?? {} })),
      }))
    },
    async turnosMotoboys() {
      return (ok(await sb.from('motoboy_turnos').select('*').order('unidade_id').order('dia')) ?? []).map((r: any): TurnoMotoboy => ({
        unidadeId: r.unidade_id, dia: r.dia, inicio: String(r.inicio).slice(0, 5), fim: String(r.fim).slice(0, 5),
      }))
    },
    async salvarTurnoMotoboy(unidadeId, dia, horario) {
      if (!horario) ok(await sb.from('motoboy_turnos').delete().eq('unidade_id', unidadeId).eq('dia', dia))
      else ok(await sb.from('motoboy_turnos').upsert({ unidade_id: unidadeId, dia, inicio: horario.inicio, fim: horario.fim }))
    },
    async escalaMotoboys(de, ate) {
      return (ok(await sb.from('motoboy_escala').select('id, motoboy_id, unidade_id, data').gte('data', de).lte('data', ate)) ?? []).map((r: any): EscalaMotoboy => ({
        id: r.id, motoboyId: r.motoboy_id, unidadeId: r.unidade_id, data: r.data,
      }))
    },
    async escalarMotoboy(motoboyId, unidadeId, data, escalado) {
      if (!escalado) ok(await sb.from('motoboy_escala').delete().eq('motoboy_id', motoboyId).eq('data', data))
      else ok(await sb.from('motoboy_escala').upsert({ motoboy_id: motoboyId, unidade_id: unidadeId, data }, { onConflict: 'motoboy_id,data' }))
    },
    async refeicoes(de, ate) {
      return (ok(await sb.from('refeicoes').select('id, data, centro_custo_id, prato, acompanhamentos, observacao, pessoas, peso_kg').gte('data', de).lte('data', ate).order('data')) ?? []).map(paraRefeicao)
    },
    async refeicoesCozinha(de, ate) {
      return (ok(await sb.rpc('refeicoes_cozinha', { p_de: de, p_ate: ate })) ?? []).map(paraRefeicao)
    },
    async salvarRefeicao(r) {
      return ok(await sb.rpc('salvar_refeicao', { p: {
        id: r.id ?? null, data: r.data, centro_custo_id: r.centroCustoId, prato: r.prato, acompanhamentos: r.acompanhamentos, observacao: r.observacao,
        pessoas: r.pessoas === null ? '' : String(r.pessoas), peso_kg: r.pesoKg === null ? '' : String(r.pesoKg), itens: r.itens.map((i) => ({ insumo_id: i.insumoId, quantidade: String(i.quantidade) })),
      } }))
    },
    async excluirRefeicao(id) {
      ok(await sb.rpc('excluir_refeicao', { p_id: id }))
    },
    async votarRefeicao(id, voto) {
      ok(await sb.rpc('votar_refeicao', { p_id: id, p_voto: voto }))
    },
    async votosRefeicoes(de, ate) {
      return (ok(await sb.rpc('votos_refeicoes', { p_de: de, p_ate: ate })) ?? []).map((r: any): VotosRefeicao => ({
        refeicaoId: r.refeicao_id, positivos: r.positivos, negativos: r.negativos, meuVoto: r.meu_voto,
      }))
    },
    async modelosRefeicao() {
      return (ok(await sb.from('refeicao_modelos').select('*').order('nome')) ?? []).map((r: any): ModeloRefeicao => ({
        id: r.id, nome: r.nome, tipo: r.tipo, modoPreparo: r.modo_preparo, ativo: r.ativo,
        itens: (r.itens ?? []).map((i: any) => ({ nome: i.nome, quantidade: Number(i.quantidade), unidade: i.unidade ?? '', insumoId: i.insumo_id ?? null })),
      }))
    },
    async salvarModeloRefeicao(m) {
      const linha = {
        nome: nomeItem(m.nome), tipo: m.tipo, modo_preparo: m.modoPreparo?.trim() || null, ativo: m.ativo,
        itens: m.itens.filter((i) => i.nome.trim() && i.quantidade > 0).map((i) => ({ nome: i.nome.trim(), quantidade: i.quantidade, unidade: i.unidade, insumo_id: i.insumoId ?? null })),
      }
      if (m.id) ok(await sb.from('refeicao_modelos').update(linha).eq('id', m.id))
      else ok(await sb.from('refeicao_modelos').insert(linha))
    },
    async quemCome(data) {
      return ok(await sb.rpc('quem_come', { p_data: data }))
    },
    async motoboyQuemSou(celular) {
      return ok(await sb.rpc('motoboy_quem_sou', { p_celular: celular }))
    },
    async motoboyCadastrar(c) {
      return ok(await sb.rpc('motoboy_cadastrar', { p_celular: c.celular, p_nome: c.nome, p_cpf: c.cpf, p_pix: c.pix, p_unidade: c.unidadeId || null }))
    },
    async enviarDiaMotoboy(e) {
      const fotos: string[] = []
      for (const f of e.fotos) {
        const caminho = `envios/${e.data}/${crypto.randomUUID()}.jpg`
        ok(await sb.storage.from('motoboys').upload(caminho, f, { contentType: f.type || 'image/jpeg' }))
        fotos.push(caminho)
      }
      ok(await sb.rpc('motoboy_enviar', {
        p_celular: e.celular, p_unidade: e.unidadeId, p_data: e.data, p_entregas: e.entregas,
        p_extras: e.extras.map((x) => ({ descricao: x.descricao, valor: String(x.valor) })), p_obs: e.observacao, p_fotos: fotos,
      }))
    },
    async enviosMotoboys(de, ate) {
      return (ok(await sb.from('motoboy_envios').select('*').gte('data', de).lte('data', ate).order('data').order('enviado_em')) ?? []).map((r: any): EnvioMotoboy => ({
        id: r.id, motoboyId: r.motoboy_id, unidadeId: r.unidade_id, data: r.data, entregas: r.entregas,
        extras: (r.extras ?? []).map((x: any) => ({ descricao: x.descricao, valor: Number(x.valor) })), observacao: r.observacao, fotos: r.fotos ?? [],
        status: r.status, entregasConferidas: r.entregas_conferidas, motivo: r.motivo, enviadoEm: r.enviado_em,
      }))
    },
    async fotosEnvioMotoboy(caminhos) {
      if (!caminhos.length) return []
      const { data } = await sb.storage.from('motoboys').createSignedUrls(caminhos, 60 * 60)
      return caminhos.map((c) => data?.find((d) => d.path === c)?.signedUrl ?? '')
    },
    async resolverEnvioMotoboy(id, aprovar, entregas, motivo) {
      ok(await sb.rpc('motoboy_resolver_envio', { p_id: id, p_aprovar: aprovar, p_entregas: entregas, p_motivo: motivo }))
    },
    async reabrirEnvioMotoboy(id) {
      ok(await sb.rpc('motoboy_reabrir_envio', { p_id: id }))
    },
    async regrasExtrato() {
      return (ok(await sb.from('extrato_regras').select('*')) ?? []).map((r: any) => ({
        chave: r.chave, centroCustoId: r.centro_custo_id, contaId: r.conta_id, favorecido: r.favorecido, fornecedorId: r.fornecedor_id ?? null, funcionarioId: r.funcionario_id ?? null, motoboyId: r.motoboy_id ?? null, ignorar: r.ignorar,
      }))
    },
    async importarExtrato(e) {
      const datas = e.movimentos.map((m) => m.data).sort()
      const existentes = (await todas((de, ate) => sb.from('extrato_movimentos').select('fitid, data, valor, descricao').eq('banco', e.banco).eq('agencia', e.agencia).eq('conta', e.conta)
        .gte('data', datas[0]).lte('data', datas[datas.length - 1]).order('id').range(de, ate))).map((r: any) => ({ fitid: r.fitid, data: r.data, valor: Number(r.valor), descricao: r.descricao }))
      const linhas = movimentosNovos(e.movimentos, existentes).map((m) => ({
        banco: e.banco, agencia: e.agencia, conta: e.conta, fitid: m.fitid, data: m.data, valor: m.valor, descricao: m.descricao, documento: m.documento, tipo: m.tipo,
      }))
      let novos = 0
      for (let i = 0; i < linhas.length; i += 500) {
        const r = ok(await sb.from('extrato_movimentos').upsert(linhas.slice(i, i + 500), { onConflict: 'banco,agencia,conta,fitid', ignoreDuplicates: true }).select('id')) ?? []
        novos += r.length
      }
      if (e.saldo) {
        ok(await sb.from('extrato_saldos').upsert({ banco: e.banco, agencia: e.agencia, conta: e.conta, data: e.saldo.data, saldo: e.saldo.valor }))
      }
      return { novos, repetidos: linhas.length - novos }
    },
    async conciliarMovimento(movimentoId, contaPagarId) {
      ok(await sb.rpc('conciliar_movimento', { p_mov: movimentoId, p_conta: contaPagarId }))
    },
    async desconciliarMovimento(movimentoId) {
      const m = ok(await sb.from('extrato_movimentos').select('status').eq('id', movimentoId).single())
      if (m?.status === 'ignorado') ok(await sb.from('extrato_movimentos').update({ status: 'pendente', observacao: null }).eq('id', movimentoId))
      else ok(await sb.rpc('desconciliar_movimento', { p_mov: movimentoId }))
    },
    async registrarMovimento(movimentoId, r) {
      ok(await sb.rpc('registrar_movimento', {
        p_mov: movimentoId, p_centro: r.centroCustoId, p_conta: r.contaId, p_favorecido: r.favorecido ?? '', p_descricao: r.descricao, p_chave: r.chave, p_fornecedor: r.fornecedorId ?? null,
        p_funcionario: r.funcionarioId ?? null, p_motoboy: r.motoboyId ?? null,
      }))
    },
    async pagamentosFuncionario(fid) {
      return (ok(await sb.rpc('pagamentos_funcionario', { p_func: fid })) ?? []).map((r: any) => ({
        id: r.id, descricao: r.descricao, vencimento: r.vencimento, pagoEm: r.pago_em, valor: Number(r.valor), forma: r.forma, conta: r.conta, conciliado: r.conciliado,
      }))
    },
    async ignorarMovimento(movimentoId, motivo, chaveSempre) {
      ok(await sb.from('extrato_movimentos').update({ status: 'ignorado', observacao: motivo }).eq('id', movimentoId))
      if (chaveSempre) ok(await sb.from('extrato_regras').upsert({ chave: chaveSempre, ignorar: true, favorecido: motivo, atualizado_em: new Date().toISOString() }))
    },
    async producoes(de, ate) {
      return (await todas((x, y) => sb.from('producoes').select('*').gte('data', de).lte('data', ate).order('data', { ascending: false }).order('criado_em', { ascending: false }).order('id').range(x, y))).map((r: any): Producao => ({
        id: r.id, centroCustoId: r.centro_custo_id, data: r.data, receitaId: r.receita_id, versao: r.versao, insumoId: r.insumo_id, quantidade: Number(r.quantidade),
        custoTotal: numeroOuNulo(r.custo_total), observacao: r.observacao, criadoEm: r.criado_em, criadoPor: r.criado_por,
      }))
    },
    async lancarProducao(p) {
      return ok(await sb.rpc('lancar_producao', {
        p_centro: p.centroCustoId, p_data: p.data, p_receita: p.receitaId, p_insumo: p.insumoId, p_quantidade: p.quantidade,
        p_saidas: p.saidas.map((x) => ({ insumo_id: x.insumoId, quantidade: x.quantidade })), p_obs: p.observacao.trim() || null,
      })) as string
    },
    async desfazerProducao(id) {
      ok(await sb.rpc('desfazer_producao', { p_id: id }))
    },
    async pedidosCompra() {
      const desde = addDiasIso(hoje(), -120)
      const linhas = ok(await sb.from('compras_pedidos').select('*').or(`data_pedido.gte.${desde},status.in.(rascunho,pedido)`).order('previsao_entrega', { ascending: false })) ?? []
      return linhas.map(paraPedidoCompra)
    },
    async salvarPedidoCompra(p) {
      const itens = p.itens.filter((i) => i.quantidade > 0).map((i) => ({ insumo_id: i.insumoId, quantidade: i.quantidade, unidade: i.unidade, preco: i.preco, ...(i.fator && i.fator > 0 && i.fator !== 1 ? { embalagem: i.embalagem, fator: i.fator } : {}) }))
      const linha = {
        fornecedor_id: p.fornecedorId, centro_custo_id: p.centroCustoId, categoria: p.categoria, status: p.status, data_pedido: p.dataPedido,
        previsao_entrega: p.previsaoEntrega, itens, total: Math.round(itens.reduce((t, i) => t + i.quantidade * (i.preco ?? 0), 0) * 100) / 100,
        forma_pagamento: texto(p.formaPagamento), observacao: texto(p.observacao), atualizado_em: new Date().toISOString(),
      }
      return paraPedidoCompra(p.id
        ? ok(await sb.from('compras_pedidos').update(linha).eq('id', p.id).select().single())
        : ok(await sb.from('compras_pedidos').insert(linha).select().single()))
    },
    async receberPedidoCompra(id, recebido) {
      ok(await sb.rpc('marcar_compra_recebida', { p_id: id, p_recebido: recebido }))
    },
    async precosFornecedor(fornecedorId) {
      return (ok(await sb.rpc('precos_fornecedor', { p_fornecedor: fornecedorId })) ?? []).map((r: any): PrecoFornecedor => ({
        insumoId: r.insumo_id, preco: Number(r.preco), em: r.em, origem: r.origem,
      }))
    },
    async comprasDoFornecedor(fornecedorId) {
      return (ok(await sb.rpc('compras_do_fornecedor', { p_fornecedor: fornecedorId })) ?? []).map((r: any): CompraFornecedor => ({
        insumoId: r.insumo_id, compras: r.compras, quantidade: numeroOuNulo(r.quantidade), porSemana: Number(r.por_semana), porCompra: numeroOuNulo(r.por_compra),
        intervaloDias: numeroOuNulo(r.intervalo_dias), ultima: r.ultima, ultimaQtd: Number(r.ultima_qtd),
      }))
    },
    async produtosVenda() {
      return (await todas((de, ate) => sb.from('produtos_venda').select('*').order('nome').order('id').range(de, ate))).map(paraProdutoVenda)
    },
    async salvarProdutoVenda(p) {
      const linha = {
        ecletica_codigo: texto(p.ecleticaCodigo), nome: nomeItem(p.nome), grupo: texto(p.grupo), subgrupo: texto(p.subgrupo), tipo: p.tipo, unidade: p.unidade,
        preco: p.preco, preco_pizza: p.precoPizza, receita_id: p.receitaId, ativo: p.ativo, atualizado_em: new Date().toISOString(),
      }
      return paraProdutoVenda(p.id
        ? ok(await sb.from('produtos_venda').update(linha).eq('id', p.id).select().single())
        : ok(await sb.from('produtos_venda').insert(linha).select().single()))
    },
    async listaFechamento(unidadeId, setor, data) {
      return (ok(await sb.rpc('itens_fechamento', { p_unidade: unidadeId, p_setor: setor, p_data: data })) ?? []).map((r: any): ItemFechamento => ({
        itemId: r.item_id, insumoId: r.insumo_id, nome: r.nome, categoria: r.categoria ?? null, unidadeContagem: r.unidade_contagem, ordem: r.ordem, prePreparo: r.pre_preparo,
        ideal: numeroOuNulo(r.ideal), contagem: numeroOuNulo(r.contagem), sugestao: numeroOuNulo(r.sugestao), pedido: numeroOuNulo(r.pedido),
      }))
    },
    async fechamentos(de, ate) {
      return (ok(await sb.from('fechamentos').select('*').gte('data', de).lte('data', ate).order('data', { ascending: false })) ?? []).map((r: any): Fechamento => ({
        id: r.id, unidadeId: r.unidade_id, setor: r.setor, data: r.data, para: r.para, responsavel: r.responsavel, observacao: r.observacao,
        fala: r.fala, enviadoEm: r.enviado_em, enviadoPor: r.enviado_por,
      }))
    },
    async enviarFechamento(f) {
      return ok(await sb.rpc('enviar_fechamento', {
        p_unidade: f.unidadeId, p_setor: f.setor, p_data: f.data, p_responsavel: f.responsavel, p_obs: f.observacao, p_fala: f.fala,
        p_itens: f.itens.map((i) => ({ item_id: i.itemId, contagem: i.contagem, sugestao: i.sugestao, pedido: i.pedido })),
      })) as string
    },
    async inventariosEstoque(centroCustoId) {
      const rows = ok(await sb.from('inventarios_estoque').select('*, inventario_estoque_itens(*)').eq('centro_custo_id', centroCustoId).order('data', { ascending: false }).limit(12)) ?? []
      return rows.map((r: any): InventarioEstoque => ({
        id: r.id, centroCustoId: r.centro_custo_id, data: r.data, responsavel: r.responsavel, observacao: r.observacao, fala: r.fala,
        enviadoEm: r.enviado_em, enviadoPor: r.enviado_por,
        itens: (r.inventario_estoque_itens ?? []).map((i: any) => ({ insumoId: i.insumo_id, quantidade: Number(i.quantidade), saldoSistema: Number(i.saldo_sistema), custoUnit: numeroOuNulo(i.custo_unit) })),
      }))
    },
    async curvaAbc(dias = 90) {
      return (ok(await sb.rpc('curva_abc', { p_dias: dias })) ?? []).map((r: any): CurvaAbc => ({ insumoId: r.insumo_id, valor: Number(r.valor), participacao: Number(r.participacao), classe: r.classe }))
    },
    async enviarInventario(e) {
      return ok(await sb.rpc('enviar_inventario', {
        p_centro: e.centroCustoId, p_data: e.data, p_responsavel: e.responsavel, p_obs: e.observacao, p_fala: e.fala,
        p_itens: e.itens.map((i) => ({ insumo_id: i.insumoId, quantidade: i.quantidade })),
      })) as string
    },
    async pedidosProducao(para) {
      return (ok(await sb.rpc('pedidos_producao', { p_para: para })) ?? []).map((r: any): PedidoProducao => ({
        insumoId: r.insumo_id, nome: r.nome, setor: r.setor, unidadeContagem: r.unidade_contagem, unidade: r.unidade, prePreparo: r.pre_preparo,
        psd: numeroOuNulo(r.psd), va: numeroOuNulo(r.va), total: Number(r.total), central: Number(r.central),
      }))
    },
    async contarCentral(data, itens) {
      return ok(await sb.rpc('contar_central', { p_data: data, p_itens: itens.map((i) => ({ insumo_id: i.insumoId, quantidade: i.quantidade })) })) as number
    },
    async itensListaFechamento(unidadeId, setor) {
      const linhas = ok(await sb.from('fechamento_itens').select('*, insumos(nome, categoria, pre_preparo)').eq('unidade_id', unidadeId).eq('setor', setor).order('ordem')) ?? []
      return linhas.map((r: any): ItemListaFechamento => ({
        id: r.id, unidadeId: r.unidade_id, setor: r.setor, insumoId: r.insumo_id, nome: r.insumos?.nome ?? '', categoria: r.insumos?.categoria ?? null, unidadeContagem: r.unidade_contagem,
        ordem: r.ordem, ideal: Array.from({ length: 7 }, (_, k) => numeroOuNulo(r.ideal?.[k])), prePreparo: !!r.insumos?.pre_preparo, ativo: r.ativo,
      }))
    },
    async salvarItemListaFechamento(i) {
      // A lista é a mesma nas duas lojas (Heitor, 09/10): item, unidade, ordem e ativo valem para as duas; o ideal é de cada loja.
      const comum = { unidade_contagem: i.unidadeContagem.trim() || 'Uni', ordem: i.ordem, ativo: i.ativo }
      const ideal = i.ideal.some((x) => x !== null) ? i.ideal : null
      // Item tirado antes (inativo) e adicionado de novo volta a valer nas duas lojas.
      ok(await sb.from('fechamento_itens').upsert(LOJAS_FECHAMENTO.map((u) => ({ ...comum, unidade_id: u, setor: i.setor, insumo_id: i.insumoId })),
        { onConflict: 'unidade_id,setor,insumo_id', ignoreDuplicates: true }))
      ok(await sb.from('fechamento_itens').update(comum).eq('setor', i.setor).eq('insumo_id', i.insumoId))
      ok(await sb.from('fechamento_itens').update({ ideal }).eq('unidade_id', i.unidadeId).eq('setor', i.setor).eq('insumo_id', i.insumoId))
      ok(await sb.from('insumos').update({ pre_preparo: i.prePreparo }).eq('id', i.insumoId))
    },
    async lancarMovimentoEstoque(m) {
      ok(await sb.from('estoque_movimentos').insert((Array.isArray(m) ? m : [m]).map((x) => ({
        centro_custo_id: x.centroCustoId, insumo_id: x.insumoId, data: x.data, tipo: x.tipo, quantidade: x.quantidade,
        custo_unit: x.custoUnit ?? null, observacao: texto(x.observacao),
      }))))
    },
  }
}

const paraRefeicao = (r: any): Refeicao => ({
  id: r.id, data: r.data, centroCustoId: r.centro_custo_id, prato: r.prato, acompanhamentos: r.acompanhamentos, observacao: r.observacao,
  pessoas: r.pessoas ?? null, pesoKg: numeroOuNulo(r.peso_kg),
  ...('itens' in r ? {
    custoTotal: numeroOuNulo(r.custo_total),
    itens: (r.itens ?? []).map((i: any) => ({ insumoId: i.insumo_id, quantidade: Number(i.quantidade), custoUnit: numeroOuNulo(i.custo_unit) })),
  } : {}),
})
const paraFreelaEvento = (r: any): FreelaEvento => ({
  id: r.id, nome: r.nome, cpf: r.cpf, pix: r.pix, celular: r.celular, funcao: r.funcao, valorDiaria: numeroOuNulo(r.valor_diaria),
  observacao: r.observacao, ativo: r.ativo,
})
const paraDiariaEvento = (r: any): DiariaFreelaEvento => ({
  id: r.id, eventoId: r.evento_id, freelaId: r.freela_id, cpf: r.cpf, data: r.data, funcao: r.funcao, valor: numeroOuNulo(r.valor), observacao: r.observacao,
  nome: r.nome, pix: r.pix, celular: r.celular, origem: r.origem, status: r.status, motivo: r.motivo, distanciaM: r.distancia_m,
  noLocal: r.no_local, enviadoEm: r.enviado_em, pagoEm: r.pago_em,
})

const paraPedidoCompra = (r: any): PedidoCompra => ({
  id: r.id, numero: r.numero, fornecedorId: r.fornecedor_id, centroCustoId: r.centro_custo_id, categoria: r.categoria, status: r.status,
  dataPedido: r.data_pedido, previsaoEntrega: r.previsao_entrega, total: Number(r.total), formaPagamento: r.forma_pagamento, observacao: r.observacao,
  recebidoEm: r.recebido_em, criadoEm: r.criado_em, criadoPor: r.criado_por,
  itens: (r.itens ?? []).map((i: any) => ({ insumoId: i.insumo_id, quantidade: Number(i.quantidade), unidade: i.unidade ?? '', preco: numeroOuNulo(i.preco), embalagem: i.embalagem ?? null, fator: numeroOuNulo(i.fator) })),
})
const paraFornecedor = (r: any): Fornecedor => ({
  id: r.id, nome: r.nome, contato: r.contato, telefone: r.telefone, observacao: r.observacao, ativo: r.ativo, cnpj: r.cnpj ?? null, contaPadraoId: r.conta_padrao_id ?? null, razaoSocial: r.razao_social ?? null,
  prazoEntregaDias: r.prazo_entrega_dias ?? null,
})
const paraNota = (r: any): NotaFiscal => ({
  id: r.id, chave: r.chave, numero: r.numero, serie: r.serie, emissao: r.emissao, fornecedorId: r.fornecedor_id, emitenteCnpj: r.emitente_cnpj,
  emitenteNome: r.emitente_nome, destinatarioCnpj: r.destinatario_cnpj, centroCustoId: r.centro_custo_id, valorProdutos: numeroOuNulo(r.valor_produtos),
  frete: numeroOuNulo(r.frete), desconto: numeroOuNulo(r.desconto), valorTotal: Number(r.valor_total),
  pagamentoXml: (r.pagamento_xml ?? []).map((x: any) => ({ tPag: String(x.tPag ?? ''), valor: Number(x.valor ?? 0) })),
  duplicatas: (r.duplicatas ?? []).map((d: any) => ({ numero: d.numero ?? null, vencimento: d.vencimento, valor: Number(d.valor) })),
  arquivo: r.arquivo, observacao: r.observacao, status: r.status, lancadaEm: r.lancada_em, criadoEm: r.criado_em,
  extratoMovimentoId: r.extrato_movimento_id ?? null,
  itens: r.nota_itens
    ? (r.nota_itens as any[]).sort((a, b) => a.ordem - b.ordem).map((i): ItemNota => ({
        id: i.id, ordem: i.ordem, codigo: i.codigo, ean: i.ean, descricao: i.descricao, ncm: i.ncm, cfop: i.cfop, unidade: i.unidade,
        quantidade: Number(i.quantidade), valorUnit: numeroOuNulo(i.valor_unit), valorTotal: Number(i.valor_total), insumoId: i.insumo_id,
        fator: numeroOuNulo(i.fator), foraEstoque: i.fora_estoque,
      }))
    : undefined,
})
const paraMotoboy = (r: any): Motoboy => ({
  id: r.id, nome: r.nome, unidadeId: r.unidade_id, pix: r.pix, telefone: r.telefone, cpf: r.cpf, observacao: r.observacao, ativo: r.ativo,
  responsavel: !!r.responsavel, adicionalResponsavel: numeroOuNulo(r.adicional_responsavel) ?? 125,
  valorDiaria: numeroOuNulo(r.valor_diaria) ?? 100, valorDiariaFds: numeroOuNulo(r.valor_diaria_fds) ?? 115, entregasIncluidas: numeroOuNulo(r.entregas_incluidas) ?? 10, valorEntrega: numeroOuNulo(r.valor_entrega) ?? 4,
})
const paraContaPagar = (r: any): ContaPagar => ({
  id: r.id, centroCustoId: r.centro_custo_id, contaId: r.conta_id, fornecedorId: r.fornecedor_id, funcionarioId: r.funcionario_id ?? null, motoboyId: r.motoboy_id ?? null, favorecido: r.favorecido, descricao: r.descricao,
  competencia: r.competencia, vencimento: r.vencimento, valor: Number(r.valor), forma: r.forma, parcela: r.parcela, parcelas: r.parcelas,
  documento: r.documento, notaId: r.nota_id, observacao: r.observacao, pagoEm: r.pago_em, valorPago: numeroOuNulo(r.valor_pago), conciliado: r.conciliado,
  recorrenteId: r.recorrente_id ?? null, origem: r.origem ?? null, lote: r.lote ?? null, extratoMovimentoId: r.extrato_movimento_id ?? null,
})
const paraRecorrente = (r: any): ContaRecorrente => ({
  id: r.id, descricao: r.descricao, fornecedorId: r.fornecedor_id, fornecedorNome: r.fornecedor_nome, centroCustoId: r.centro_custo_id,
  contaId: r.conta_id, valor: Number(r.valor), variavel: r.variavel, dia: r.dia, forma: r.forma, inicio: r.inicio, fim: r.fim,
  situacao: r.situacao, observacao: r.observacao,
})
// Dia do mês sem passar do último (31 em fevereiro vira 28/29).
const diaDoMes = (mes: string, dia: number) => {
  const [a, m] = mes.split('-').map(Number)
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate()
  return `${mes}-${String(Math.min(dia, ultimo)).padStart(2, '0')}`
}
const paraInsumo = (r: any): Insumo => ({
  id: r.id, nome: r.nome, categoria: r.categoria, unidade: r.unidade, embalagem: r.embalagem, embalagemQtd: numeroOuNulo(r.embalagem_qtd),
  preco: numeroOuNulo(r.preco), precoEm: r.preco_em, fornecedorId: r.fornecedor_id, observacao: r.observacao, ativo: r.ativo,
  ecleticaCodigo: r.ecletica_codigo ?? null, setorEnvio: r.setor_envio ?? null, contaId: r.conta_id ?? null, estoqueMinimo: numeroOuNulo(r.estoque_minimo),
  prePreparo: !!r.pre_preparo, precoConferido: numeroOuNulo(r.preco_conferido), controlaEstoque: r.controla_estoque !== false,
})
const paraProdutoVenda = (r: any): ProdutoVenda => ({
  id: r.id, ecleticaCodigo: r.ecletica_codigo, nome: r.nome, grupo: r.grupo, subgrupo: r.subgrupo, tipo: r.tipo, unidade: r.unidade,
  preco: numeroOuNulo(r.preco), precoPizza: numeroOuNulo(r.preco_pizza), receitaId: r.receita_id, ativo: r.ativo,
})
const paraReceita = (r: any): Receita => ({
  id: r.id, nome: r.nome, tipo: r.tipo, linha: r.linha, operacaoId: r.operacao_id, origem: r.origem, unidade: r.unidade, precoVenda: numeroOuNulo(r.preco_venda),
  tempoPreparoMin: r.tempo_preparo_min, tempoFinalizacaoMin: r.tempo_finalizacao_min, capacidadeHora: r.capacidade_hora, equipamentos: r.equipamentos,
  conservacao: r.conservacao, validadeDias: r.validade_dias, modoPreparo: r.modo_preparo ?? null, ativo: r.ativo, versaoAtual: r.versao_atual, insumoId: r.insumo_id ?? null,
  area: r.area ?? 'eventos', ecleticaCodigo: r.ecletica_codigo ?? null, observacoes: r.observacoes ?? null, responsavel: r.responsavel ?? null,
  porcaoNome: r.porcao_nome ?? null, porcaoQtd: numeroOuNulo(r.porcao_qtd), lotes: r.lotes ? r.lotes.map(Number) : null,
})

const linhaItemEnvio = (i: NovoItemEnvio) => ({
  categoria: texto(i.categoria), operacao: texto(i.operacao), insumo_id: i.insumoId, receita_id: i.receitaId, item: texto(i.item), previsto: i.previsto,
  quantidade: i.quantidade, quantidade_texto: texto(i.quantidadeTexto), unidade: texto(i.unidade),
})
const SELECT_EVENTO = '*, evento_dias(data, abre, fecha), evento_operacoes(operacao_id), evento_responsaveis(funcionario_id, papel)'
const numeroOuNulo = (v: unknown) => (v === null || v === undefined ? null : Number(v))
const paraEvento = (r: any): Evento => ({
  id: r.id, numero: r.numero, nome: r.nome, status: r.status, statusMotivo: r.status_motivo, tipo: r.tipo, organizador: r.organizador,
  organizadorContato: r.organizador_contato, local: r.local, endereco: r.endereco, publicoEstimado: r.publico_estimado,
  montagemInicio: r.montagem_inicio?.slice(0, 16) ?? null, montagemFim: r.montagem_fim?.slice(0, 16) ?? null,
  desmontagemInicio: r.desmontagem_inicio?.slice(0, 16) ?? null, desmontagemFim: r.desmontagem_fim?.slice(0, 16) ?? null,
  taxaOrganizadorPct: numeroOuNulo(r.taxa_organizador_pct), valorFixo: numeroOuNulo(r.valor_fixo), condicoes: r.condicoes, quemRecebe: r.quem_recebe,
  repassePrazoDias: r.repasse_prazo_dias, repasseObs: r.repasse_obs, infraestrutura: r.infraestrutura, observacao: r.observacao,
  cidade: r.cidade ?? null, gastronomia: r.gastronomia ?? null, barracas: numeroOuNulo(r.barracas), margemSegurancaPct: Number(r.margem_seguranca_pct ?? 10),
  diariaFreela: numeroOuNulo(r.diaria_freela), latitude: r.latitude ?? null, longitude: r.longitude ?? null, foraDaMedia: r.fora_da_media ?? false, layoutBarracas: r.layout_barracas ?? {},
  dias: (r.evento_dias ?? [])
    .map((d: any) => ({ data: d.data, abre: d.abre?.slice(0, 5) ?? null, fecha: d.fecha?.slice(0, 5) ?? null }))
    .sort((a: DiaEvento, b: DiaEvento) => a.data.localeCompare(b.data)),
  operacoes: (r.evento_operacoes ?? []).map((o: any) => o.operacao_id),
  responsaveis: (r.evento_responsaveis ?? []).map((x: any) => ({ funcionarioId: x.funcionario_id, papel: x.papel })),
  criadoPor: r.criado_por, criadoEm: r.criado_em, atualizadoPor: r.atualizado_por, atualizadoEm: r.atualizado_em,
})

const paraFreelancer = (r: any): Freelancer => ({
  id: r.id, nome: r.nome, cpf: r.cpf, pix: r.pix, celular: r.celular, ativo: r.ativo, funcionarioId: r.funcionario_id,
})

const paraDiaria = (r: any): DiariaFreela => ({
  id: r.id, freelancerId: r.freelancer_id, data: r.data, turno: r.turno, unidadeId: r.unidade_id, funcao: r.funcao,
  valor: Number(r.valor), observacao: r.observacao, lancadoPor: r.lancado_por,
})

const paraEnvio = (r: any): EnvioFreela => ({
  id: r.id, cpf: r.cpf, celular: r.celular, nome: r.nome, pix: r.pix, freelancerId: r.freelancer_id, funcionarioId: r.funcionario_id,
  data: r.data, turno: r.turno, unidadeId: r.unidade_id, funcao: r.funcao, observacao: r.observacao, status: r.status,
  motivo: r.motivo, enviadoEm: r.enviado_em, naLoja: !!r.na_loja, distanciaLojaM: r.distancia_loja_m ?? null,
})

const paraConta = (r: any): ContaPagamento => ({
  id: r.id, nome: r.nome, banco: r.banco, empresaCnpj: r.empresa_cnpj, empresaNome: r.empresa_nome, agencia: r.agencia,
  conta: r.conta, dac: r.dac, endereco: r.endereco, numero: r.numero, cidade: r.cidade, cep: r.cep, estado: r.estado, padrao: r.padrao,
})

const paraRemessa = (r: any): RemessaPagamento => ({
  id: r.id, numero: r.numero, contaId: r.conta_id, tipo: r.tipo, referencia: r.referencia, dataPagamento: r.data_pagamento,
  quantidade: r.quantidade, valorTotal: Number(r.valor_total), via: r.via, arquivo: r.arquivo, criadoEm: r.criado_em,
})

const paraSalario = (r: any): Salario => ({
  funcionarioId: r.funcionario_id, mes: r.mes, tipo: r.tipo ?? 'salario', descAdiantamento: Number(r.desc_adiantamento ?? 0), salario: Number(r.salario), caixinha: Number(r.caixinha), bonusCaixinha: Number(r.bonus_caixinha),
  bonusConclui: Number(r.bonus_conclui), descFaltas: Number(r.desc_faltas), descAtrasos: Number(r.desc_atrasos), inss: Number(r.inss),
  descVt: Number(r.desc_vt), outrosCreditos: Number(r.outros_creditos ?? 0), outrosDescontos: Number(r.outros_descontos ?? 0), rubricas: r.rubricas ?? null, observacao: r.observacao, liberado: r.liberado, holerite: r.holerite ?? null,
})

const paraMembroEquipe = (r: any): MembroEquipeEvento => ({
  id: r.id, eventoId: r.evento_id, funcionarioId: r.funcionario_id, freelaId: r.freela_id, nome: r.nome, funcao: r.funcao,
  barraca: r.barraca, posicao: r.posicao, observacao: r.observacao, ordem: r.ordem,
})
