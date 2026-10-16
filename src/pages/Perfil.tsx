import { useCallback, useEffect, useState } from 'react'
import { Avatar, Botao, Campo, Cartao, Modal, Selo, Vazio, estiloEntrada } from '../components/ui'
import FormFuncionario from '../components/FormFuncionario'
import { useApp } from '../lib/contexto'
import { addDias, dataLonga, hoje } from '../lib/datas'
import { possoAlterar, podeGerenciar, podeVerDocumentosDe, podeVerEquipe, isentoDeRotinas } from '../lib/permissoes'
import { ir } from '../lib/rota'
import {
  NATUREZAS, TIPOS_DESLIGAMENTO, TIPOS_DOCUMENTO, TIPOS_OCORRENCIA, ehSaude, nomeNivel, nomeTipoDocumento, nomeTipoOcorrencia,
  type Desligamento, type TipoDesligamento, type VinculoAnterior, type Documento, type Funcionario, type Ocorrencia, type OcorrenciaRemovida, type Salario, type PagamentoPessoa, type TipoDocumento, type TipoOcorrencia,
} from '../lib/types'
import { addMesesData, corSituacao, exigenciasDe, iconeSituacao, situacaoDoc, textoSituacao } from '../lib/vencimentos'
import Uniformes from './Uniformes'
import FeriasPessoa from './FeriasPessoa'
import DocumentoOcorrencia, { temDocumento } from '../components/DocumentoOcorrencia'
import DeclaracaoVinculo from '../components/DeclaracaoVinculo'
import { ContratoExperiencia, GuiaExame } from '../components/DocumentosAdmissao'
import TermosGravidez from '../components/TermosGravidez'
import { formatarCpf } from '../lib/cpf'
import { Contracheque } from './Salarios'
import { dataPagamento } from '../lib/salarios'
import ChecklistDesligamento from '../components/ChecklistDesligamento'
import ChecklistAdmissao from '../components/ChecklistAdmissao'
import { emAdmissao } from '../lib/pessoal'
import { tamanhosDe } from './Compras'
import { textoExperiencia } from '../components/FormFuncionario'
import { experienciaDe, idadeEm } from '../lib/pessoal'
import { reais } from '../lib/financeiro'

type AbaPerfil = 'documentos' | 'saude' | 'uniformes' | 'ocorrencias' | 'ferias' | 'salario'

const corOcorrencia: Record<TipoOcorrencia, 'vermelho' | 'ambar' | 'verde' | 'cinza'> = {
  falta: 'vermelho', advertencia: 'vermelho', suspensao: 'vermelho', atraso: 'ambar', orientacao: 'cinza', elogio: 'verde', outro: 'cinza',
}

export default function Perfil({ funcionarioId }: { funcionarioId: string }) {
  const { eu, store, equipe, nomeDe, nomeUnidade, recarregarEquipe, avisar } = useApp()
  const pessoa = equipe.find((f) => f.id === funcionarioId) ?? (funcionarioId === eu.id ? eu : null)
  const [aba, setAba] = useState<AbaPerfil>('documentos')
  const [tipoInicial, setTipoInicial] = useState<TipoDocumento>('atestado')
  const [docs, setDocs] = useState<Documento[]>([])
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [desligamentos, setDesligamentos] = useState<Desligamento[]>([])
  const [vinculos, setVinculos] = useState<VinculoAnterior[]>([])
  const [readmitir, setReadmitir] = useState(false)
  const [imprimir, setImprimir] = useState<Ocorrencia | null>(null)
  const [remover, setRemover] = useState<Ocorrencia | null>(null)
  const [removidas, setRemovidas] = useState<OcorrenciaRemovida[]>([])
  const [verRemovidas, setVerRemovidas] = useState(false)
  const [declaracao, setDeclaracao] = useState(false)
  const [admissao, setAdmissao] = useState<'contrato' | 'guia' | null>(null)
  const [versaoAdm, setVersaoAdm] = useState(0)
  const [termos, setTermos] = useState(false)
  const [modal, setModal] = useState<'editar' | 'documento' | 'ocorrencia' | 'desligar' | null>(null)
  // Gestão sobre esta pessoa: só quem está no mesmo degrau ou acima.
  const gestao = !!pessoa && possoAlterar(eu, pessoa)
  const souEu = funcionarioId === eu.id
  const [trocarSenha, setTrocarSenha] = useState(false)

  const carregar = useCallback(async () => {
    setDocs(await store.documentos(funcionarioId))
    setOcorrencias(await store.ocorrencias(funcionarioId))
    if (podeGerenciar(eu.nivel)) {
      setRemovidas(await store.ocorrenciasRemovidas(funcionarioId).catch(() => []))
      setDesligamentos(await store.desligamentos(funcionarioId).catch(() => []))
      setVinculos(await store.vinculosAnteriores(funcionarioId).catch(() => []))
    }
  }, [store, funcionarioId, eu.nivel])
  useEffect(() => {
    carregar()
  }, [carregar])

  if (!pessoa) return <Vazio>Funcionário não encontrado ou fora do seu acesso.</Vazio>
  const verDocs = podeVerDocumentosDe(eu, pessoa)
  const docsSaude = docs.filter((d) => ehSaude(d.tipo))
  const docsGerais = docs.filter((d) => !ehSaude(d.tipo))
  const exigencias = exigenciasDe(docs, pessoa)
  const pendentes = pessoa.status === 'ativo' ? exigencias.filter((i) => i.situacao !== 'em_dia').length : 0

  const abrir = async (d: Documento) => {
    const url = await store.abrirDocumento(d)
    if (url) window.open(url, '_blank')
    else avisar('Arquivo de exemplo: na versão real ele abre aqui.')
  }

  const exp = pessoa.status === 'ativo' ? experienciaDe(pessoa, hoje()) : null
  // Só o desligamento do período atual (quem foi readmitido não carrega o checklist antigo).
  const desligamento = desligamentos.find((d) => d.data >= pessoa.dataAdmissao)


  return (
    <div className="space-y-5">
      {!souEu && podeVerEquipe(eu.nivel) && (
        <button onClick={() => ir('rh/equipe')} className="text-sm font-semibold text-stone-500">
          ‹ Equipe
        </button>
      )}

      <Cartao>
        <div className="flex items-start gap-4">
          {souEu || gestao ? (
            <TrocarFoto
              pessoa={pessoa}
              aoTrocar={async (img) => {
                try {
                  await store.definirFoto(pessoa.id, img)
                  await recarregarEquipe()
                  avisar('Foto atualizada')
                } catch (e) {
                  avisar((e as Error).message)
                }
              }}
            />
          ) : (
            <Avatar nome={pessoa.nome} tamanho={56} foto={pessoa.fotoUrl} />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">{pessoa.nome}</h1>
            <div className="text-stone-600">{pessoa.cargo}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Selo cor="azul">{nomeUnidade(pessoa.unidadeId)}</Selo>
              <Selo>{nomeNivel(pessoa.nivel)}</Selo>
              {pessoa.status === 'inativo' ? <Selo cor="vermelho">Inativo</Selo> : <Selo cor="verde">Ativo</Selo>}
            </div>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-stone-100 pt-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-stone-500">Celular</dt>
            <dd className="font-medium">{pessoa.celular.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')}</dd>
          </div>
          {verDocs && (
            <div>
              <dt className="text-stone-500">Pix</dt>
              <dd className="font-medium break-all">{pessoa.pix || '—'}</dd>
            </div>
          )}
          {verDocs && (
            <div>
              <dt className="text-stone-500">CPF</dt>
              <dd className="font-medium">{pessoa.cpf ? formatarCpf(pessoa.cpf) : '—'}</dd>
            </div>
          )}
          {verDocs && (
            <div>
              <dt className="text-stone-500">Vale-transporte</dt>
              <dd className="font-medium">{pessoa.optaVt ? 'Optou' : 'Não optou'}</dd>
            </div>
          )}
          <div>
            <dt className="text-stone-500">Admissão</dt>
            <dd className="font-medium">{dataLonga(pessoa.dataAdmissao)}</dd>
          </div>
          {(souEu || verDocs) && (
            <div>
              <dt className="text-stone-500">Uniforme</dt>
              <dd className="font-medium">{tamanhosDe(pessoa)}</dd>
            </div>
          )}
          {pessoa.dataNascimento && (souEu || verDocs) && (
            <div>
              <dt className="text-stone-500">Nascimento</dt>
              <dd className="font-medium">{dataLonga(pessoa.dataNascimento)} ({idadeEm(pessoa.dataNascimento, hoje())} anos)</dd>
            </div>
          )}
          {exp && exp.fase !== 'encerrado' && verDocs && (
            <div className="col-span-2">
              <dt className="text-stone-500">Contrato de experiência ({pessoa.experienciaDias1} + {pessoa.experienciaDias2 ?? 0})</dt>
              <dd className="font-medium">{textoExperiencia(exp)}</dd>
            </div>
          )}
          <div>
            <dt className="text-stone-500">Responde para</dt>
            <dd className="font-medium">{pessoa.respondePara ? nomeDe(pessoa.respondePara) : '—'}</dd>
          </div>
          {pessoa.dataDesligamento && (
            <div>
              <dt className="text-stone-500">Desligamento</dt>
              <dd className="font-medium">{dataLonga(pessoa.dataDesligamento)}</dd>
            </div>
          )}
        </dl>
        {gestao && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Botao variante="secundario" onClick={() => setModal('editar')}>
              Editar
            </Botao>
            <Botao variante="secundario" onClick={() => setModal('ocorrencia')}>
              Registrar ocorrência
            </Botao>
            {pessoa.nivel !== 'proprietario' && (
              <>
                {pessoa.status === 'ativo' && (
                  <Botao variante="secundario" onClick={() => setAdmissao('contrato')}>
                    Contrato de experiência
                  </Botao>
                )}
                <Botao variante="secundario" onClick={() => setAdmissao('guia')}>
                  Encaminhamento para exame
                </Botao>
              </>
            )}
            {pessoa.status === 'ativo' && pessoa.nivel !== 'proprietario' && (
              <Botao variante="secundario" onClick={() => setDeclaracao(true)}>
                Declaração de vínculo
              </Botao>
            )}
            {pessoa.sexo === 'feminino' && (
              <Botao variante="secundario" onClick={() => setTermos(true)}>
                Termos de gravidez
              </Botao>
            )}
            {pessoa.status === 'ativo' && !souEu ? (
              <Botao variante="perigo" onClick={() => setModal('desligar')}>
                Desligar
              </Botao>
            ) : pessoa.status === 'inativo' ? (
              <Botao variante="secundario" onClick={() => setReadmitir(true)}>
                Reativar / readmitir
              </Botao>
            ) : null}
            {souEu && (
              <Botao variante="secundario" onClick={() => setTrocarSenha(true)}>
                Trocar minha senha
              </Botao>
            )}
          </div>
        )}
        {souEu && !gestao && (
          <div className="mt-4">
            <Botao variante="secundario" onClick={() => setTrocarSenha(true)}>
              Trocar minha senha
            </Botao>
          </div>
        )}
      </Cartao>

      {podeGerenciar(eu.nivel) && emAdmissao(pessoa, hoje()) && (
        <ChecklistAdmissao
          key={`${versaoAdm}-${docs.length}-${aba}-${modal}`}
          pessoa={pessoa}
          docs={docs}
          podeMarcar={gestao}
          aoAcao={(acao, chave) => {
            if (acao === 'editar') setModal('editar')
            else if (acao === 'guia' || acao === 'contrato') setAdmissao(acao)
            else if (acao === 'uniforme') setAba('uniformes')
            else if (acao === 'turno') ir('rh/turnos')
            else {
              setTipoInicial(chave === 'aso' ? 'aso_admissional' : 'contrato')
              setModal('documento')
            }
          }}
        />
      )}
      {podeGerenciar(eu.nivel) && desligamento && (
        <ChecklistDesligamento d={desligamento} pessoa={pessoa} podeMarcar={gestao} aoMudar={carregar} aoTermos={() => setTermos(true)} />
      )}
      {podeGerenciar(eu.nivel) && vinculos.length > 0 && <HistoricoVinculos vinculos={vinculos} pessoa={pessoa} />}
      {gestao && !desligamento && pessoa.status === 'inativo' && pessoa.dataDesligamento && (
        <button
          onClick={async () => {
            await store.abrirDesligamento({ funcionarioId: pessoa.id, data: pessoa.dataDesligamento!, tipo: 'sem_justa_causa', observacao: null })
            await carregar()
          }}
          className="w-full rounded-2xl bg-white p-3 text-left text-sm font-semibold ring-1 ring-stone-200 hover:ring-carvao"
        >
          Abrir checklist de desligamento ›
        </button>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-stone-200 p-1 text-xs font-semibold sm:text-sm">
        {(
          [
            ['documentos', 'Documentos'],
            ['saude', 'Exames'],
            ['uniformes', 'Uniformes'],
            ['ocorrencias', 'Ocorrências'],
            ...(podeGerenciar(eu.nivel) && pessoa.nivel !== 'proprietario' ? [['ferias', 'Férias e 13º']] : []),
            ...(souEu || gestao ? [['salario', 'Salário']] : []),
          ] as [AbaPerfil, string][]
        ).map(([a, nome]) => (
          <button key={a} onClick={() => setAba(a)} className={`flex-1 shrink-0 rounded-lg px-2.5 py-2 whitespace-nowrap ${aba === a ? 'bg-white shadow-sm' : 'text-stone-600'}`}>
            {nome}
            {a === 'saude' && verDocs && pendentes > 0 && <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] text-white">{pendentes}</span>}
          </button>
        ))}
      </div>

      {aba === 'ferias' ? (
        <FeriasPessoa pessoa={pessoa} podeRegistrar={gestao} />
      ) : aba === 'salario' ? (
        <>
          {podeGerenciar(eu.nivel) && <PagamentosPessoa funcionarioId={funcionarioId} />}
          <MeusSalarios funcionarioId={funcionarioId} />
        </>
      ) : aba === 'saude' ? (
        <section className="space-y-3">
          {!verDocs ? (
            <Vazio>Exames são visíveis só para a própria pessoa e para a gestão.</Vazio>
          ) : isentoDeRotinas(pessoa.nivel) ? (
            <Vazio>O proprietário não entra no controle de exames.</Vazio>
          ) : (
            <>
              <Cartao>
                <div className="mb-2 text-sm font-semibold text-stone-600">Obrigatórios para manipulador de alimentos</div>
                <ul className="divide-y divide-stone-100">
                  {exigencias.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2.5">
                      <div className="min-w-0">
                        <div className="font-semibold">{i.nome}</div>
                        <div className="text-xs text-stone-500">{i.base}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Selo cor={corSituacao[i.situacao]}>
                          {iconeSituacao[i.situacao]} {textoSituacao(i)}
                        </Selo>
                        {(souEu || gestao) && i.situacao !== 'em_dia' && (
                          <button
                            onClick={() => {
                              setTipoInicial(i.id === 'aso' ? (i.doc ? 'aso_periodico' : 'aso_admissional') : (i.id as TipoDocumento))
                              setModal('documento')
                            }}
                            className="text-sm font-semibold underline decoration-ozzy-500 decoration-2 underline-offset-4"
                          >
                            Enviar
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Cartao>
              {(souEu || gestao) && (
                <Botao
                  className="w-full"
                  variante="secundario"
                  onClick={() => {
                    setTipoInicial('aso_periodico')
                    setModal('documento')
                  }}
                >
                  + Enviar exame ou laudo da clínica
                </Botao>
              )}
              {docsSaude.length === 0 ? <Vazio>Nenhum exame enviado.</Vazio> : docsSaude.map((d) => <LinhaDocumento key={d.id} d={d} aoAbrir={abrir} />)}
            </>
          )}
        </section>
      ) : aba === 'uniformes' ? (
        <Uniformes pessoa={pessoa} />
      ) : aba === 'documentos' ? (
        <section className="space-y-2">
          {(souEu || gestao) && (
            <Botao
              className="w-full"
              onClick={() => {
                setTipoInicial('atestado')
                setModal('documento')
              }}
            >
              {souEu && !isentoDeRotinas(eu.nivel) ? '+ Enviar atestado ou documento' : '+ Anexar documento'}
            </Botao>
          )}
          {!verDocs ? (
            <Vazio>Documentos e atestados são visíveis só para a própria pessoa e para a gestão.</Vazio>
          ) : docsGerais.length === 0 ? (
            <Vazio>Nenhum documento enviado.</Vazio>
          ) : (
            docsGerais.map((d) => (
              <Cartao key={d.id} onClick={() => abrir(d)}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Selo cor={d.tipo === 'atestado' ? 'ambar' : 'cinza'}>{nomeTipoDocumento(d.tipo)}</Selo>
                      <span className="truncate text-sm font-medium">{d.nomeArquivo}</span>
                    </div>
                    <div className="mt-1 text-xs text-stone-500">
                      {d.inicio && `Afastamento ${dataLonga(d.inicio)}${d.fim && d.fim !== d.inicio ? ` a ${dataLonga(d.fim)}` : ''} · `}
                      Enviado por {d.enviadoPor === eu.id ? 'você' : nomeDe(d.enviadoPor)} em {dataLonga(d.criadoEm)}
                      {d.observacao && ` · ${d.observacao}`}
                    </div>
                  </div>
                  <span className="text-stone-400">›</span>
                </div>
              </Cartao>
            ))
          )}
        </section>
      ) : (
        <section className="space-y-2">
          {ocorrencias.length === 0 ? (
            <Vazio>Nenhuma ocorrência registrada.</Vazio>
          ) : (
            ocorrencias.map((o) => (
              <Cartao key={o.id}>
                <div className="flex items-center gap-2">
                  <Selo cor={corOcorrencia[o.tipo]}>{nomeTipoOcorrencia(o.tipo)}</Selo>
                  <span className="text-sm font-medium">{dataLonga(o.data)}</span>
                </div>
                {o.natureza && <div className="mt-1.5 text-sm font-medium">{o.natureza}{o.tipo === 'suspensao' && o.suspensaoDias ? ` · ${o.suspensaoDias} dia${o.suspensaoDias > 1 ? 's' : ''}` : ''}</div>}
                <p className="mt-1 text-sm text-stone-700">{o.descricao}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-xs text-stone-400">Registrado por {nomeDe(o.registradoPor)}</span>
                  <div className="flex items-center gap-3">
                    {gestao && temDocumento(o) && (
                      <button onClick={() => setImprimir(o)} className="text-sm font-semibold underline decoration-ozzy-500 decoration-2 underline-offset-4">
                        Imprimir documento
                      </button>
                    )}
                    {/* Remover lançamento errado ou de teste (Heitor, 16/10/2026): gestão, nunca de si mesmo. */}
                    {gestao && !souEu && (
                      <button onClick={() => setRemover(o)} className="text-sm font-semibold text-red-600 underline underline-offset-4">
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              </Cartao>
            ))
          )}
          {gestao && removidas.length > 0 && (
            <div className="pt-2">
              <button onClick={() => setVerRemovidas((v) => !v)} className="text-sm text-stone-500 underline underline-offset-4">
                {verRemovidas ? 'Esconder removidas' : `Ver removidas (${removidas.length})`}
              </button>
              {verRemovidas && (
                <div className="mt-2 space-y-2">
                  {removidas.map((o) => (
                    <Cartao key={o.id} className="opacity-70">
                      <div className="flex items-center gap-2">
                        <Selo cor="cinza">{nomeTipoOcorrencia(o.tipo)}</Selo>
                        <span className="text-sm font-medium line-through">{dataLonga(o.data)}</span>
                      </div>
                      <p className="mt-1 text-sm text-stone-700">{o.descricao}</p>
                      <p className="mt-1 text-sm">
                        <span className="font-medium">Motivo da remoção:</span> {o.motivo}
                      </p>
                      <span className="text-xs text-stone-400">
                        Removida por {nomeDe(o.removidoPor)} em {dataLonga(o.removidoEm.slice(0, 10))} · registrada por {nomeDe(o.registradoPor)}
                      </span>
                    </Cartao>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {trocarSenha && (
        <TrocarSenha
          aoFechar={() => setTrocarSenha(false)}
          aoTrocar={() => {
            setTrocarSenha(false)
            avisar('Senha trocada. Use a nova no próximo acesso.')
          }}
        />
      )}
      {modal === 'editar' && <FormFuncionario aberto existente={pessoa} aoFechar={() => setModal(null)} />}
      <EnviarDocumento
        key={tipoInicial + String(modal === 'documento')}
        aberto={modal === 'documento'}
        tipoInicial={tipoInicial}
        funcionarioId={pessoa.id}
        aoFechar={() => setModal(null)}
        aoEnviar={async () => {
          setModal(null)
          await carregar()
          avisar(souEu ? 'Enviado! O Departamento Pessoal já consegue ver.' : 'Documento anexado')
        }}
      />
      <NovaOcorrencia
        aberto={modal === 'ocorrencia'}
        funcionarioId={pessoa.id}
        aoFechar={() => setModal(null)}
        aoSalvar={async (o) => {
          setModal(null)
          setAba('ocorrencias')
          await carregar()
          avisar('Ocorrência registrada')
          // Advertência e suspensão já abrem o documento para imprimir e assinar.
          if (temDocumento(o)) setImprimir(o)
        }}
      />
      {termos && <TermosGravidez pessoa={pessoa} aoFechar={() => setTermos(false)} />}
      {admissao === 'contrato' && <ContratoExperiencia pessoa={pessoa} aoFechar={() => { setAdmissao(null); setVersaoAdm((v) => v + 1) }} />}
      {admissao === 'guia' && <GuiaExame pessoa={pessoa} aoFechar={() => { setAdmissao(null); setVersaoAdm((v) => v + 1) }} />}
      {declaracao && <DeclaracaoVinculo pessoa={pessoa} aoFechar={() => setDeclaracao(false)} />}
      {imprimir && <DocumentoOcorrencia o={imprimir} pessoa={pessoa} aoFechar={() => setImprimir(null)} />}
      {remover && (
        <RemoverOcorrencia
          o={remover}
          aoFechar={() => setRemover(null)}
          aoRemover={async () => {
            setRemover(null)
            await carregar()
            avisar('Ocorrência removida')
          }}
        />
      )}
      {readmitir && (
        <Readmitir
          pessoa={pessoa}
          aoFechar={() => setReadmitir(false)}
          aoConfirmar={async (modo, data) => {
            try {
              if (modo === 'engano') {
                // Desligamento lançado por engano: volta como estava e o checklist some.
                if (desligamento) await store.excluirDesligamento(desligamento.id)
                await store.salvarFuncionario({ ...pessoa, status: 'ativo', dataDesligamento: null })
              } else {
                await store.readmitir(pessoa, data, desligamento?.tipo ?? null)
              }
              await recarregarEquipe()
              await carregar()
              setReadmitir(false)
              avisar(modo === 'engano' ? 'Desligamento desfeito' : 'Readmitido! O período anterior ficou no histórico.')
            } catch (e) {
              avisar((e as Error).message)
            }
          }}
        />
      )}
      <Modal titulo="Desligar funcionário" aberto={modal === 'desligar'} aoFechar={() => setModal(null)}>
        <Desligar
          aoConfirmar={async (data, tipo) => {
            await store.salvarFuncionario({ ...pessoa, status: 'inativo', dataDesligamento: data })
            await store.abrirDesligamento({ funcionarioId: pessoa.id, data, tipo, observacao: null })
            await recarregarEquipe()
            await carregar()
            setModal(null)
            avisar('Desligamento aberto: siga o checklist')
            // Colaboradora: já abre os termos de exame de gravidez para imprimir e colher a assinatura.
            if (pessoa.sexo === 'feminino') setTermos(true)
          }}
          nome={pessoa.nome}
          feminino={pessoa.sexo === 'feminino'}
        />
      </Modal>
    </div>
  )
}

function Desligar({ nome, feminino, aoConfirmar }: { nome: string; feminino: boolean; aoConfirmar: (data: string, tipo: TipoDesligamento) => void }) {
  const [data, setData] = useState(hoje())
  const [tipo, setTipo] = useState<TipoDesligamento>('sem_justa_causa')
  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600">
        {nome} vai para a lista de inativos e perde o acesso ao portal. O histórico (documentos e ocorrências) continua guardado.
      </p>
      <Campo rotulo="Tipo">
        <select className={estiloEntrada} value={tipo} onChange={(e) => setTipo(e.target.value as TipoDesligamento)}>
          {TIPOS_DESLIGAMENTO.map((t) => <option key={t.valor} value={t.valor}>{t.nome}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Último dia de trabalho" dica="A rescisão tem que ser paga em até 10 dias depois dessa data.">
        <input className={estiloEntrada} type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </Campo>
      <p className="text-sm text-stone-600">Ao confirmar, aparece aqui no cadastro o checklist do desligamento (aviso, exame demissional, uniforme, acessos, rescisão…).</p>
      {feminino && (
        <p className="rounded-xl bg-ozzy-50 p-3 text-sm text-stone-700 ring-1 ring-ozzy-200">
          Ao confirmar, o portal abre os termos de exame de gravidez (oferta e recusa) com os dados dela para imprimir.
          Depois de assinados, anexe em Documentos.
        </p>
      )}
      <Botao variante="perigo" className="w-full" onClick={() => aoConfirmar(data, tipo)}>
        Confirmar desligamento
      </Botao>
    </div>
  )
}

function LinhaDocumento({ d, aoAbrir }: { d: Documento; aoAbrir: (d: Documento) => void }) {
  const { eu, nomeDe } = useApp()
  const sit = situacaoDoc(d.vence)
  return (
    <Cartao onClick={() => aoAbrir(d)}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Selo>{nomeTipoDocumento(d.tipo)}</Selo>
            {d.vence && (
              <Selo cor={corSituacao[sit]}>
                {iconeSituacao[sit]} {sit === 'vencido' ? 'Venceu' : 'Vence'} {dataLonga(d.vence)}
              </Selo>
            )}
          </div>
          <div className="mt-1 truncate text-sm font-medium">{d.nomeArquivo}</div>
          <div className="mt-0.5 text-xs text-stone-500">
            {d.realizadoEm && `Feito em ${dataLonga(d.realizadoEm)} · `}
            Enviado por {d.enviadoPor === eu.id ? 'você' : nomeDe(d.enviadoPor)}
            {d.observacao && ` · ${d.observacao}`}
          </div>
        </div>
        <span className="text-stone-400">›</span>
      </div>
    </Cartao>
  )
}

function EnviarDocumento({
  aberto, funcionarioId, aoFechar, aoEnviar, tipoInicial = 'atestado',
}: { aberto: boolean; funcionarioId: string; aoFechar: () => void; aoEnviar: () => void; tipoInicial?: TipoDocumento }) {
  const { store } = useApp()
  const [tipo, setTipoBruto] = useState<TipoDocumento>(tipoInicial)
  const meses = (t: TipoDocumento) => TIPOS_DOCUMENTO.find((x) => x.valor === t)?.validadeMeses
  const [realizadoEm, setRealizadoEm] = useState(hoje())
  const [vence, setVence] = useState(meses(tipoInicial) ? addMesesData(hoje(), meses(tipoInicial)!) : '')
  const recalcular = (t: TipoDocumento, feito: string) => setVence(meses(t) && feito ? addMesesData(feito, meses(t)!) : '')
  const setTipo = (t: TipoDocumento) => {
    setTipoBruto(t)
    recalcular(t, realizadoEm)
  }
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [inicio, setInicio] = useState(hoje())
  const [fim, setFim] = useState(hoje())
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!arquivo) return setErro('Escolha a foto ou o arquivo.')
    setEnviando(true)
    try {
      await store.enviarDocumento({
        funcionarioId, tipo, arquivo, observacao,
        inicio: tipo === 'atestado' ? inicio : undefined,
        fim: tipo === 'atestado' ? fim : undefined,
        realizadoEm: ehSaude(tipo) ? realizadoEm : undefined,
        vence: ehSaude(tipo) && vence ? vence : undefined,
      })
      setArquivo(null)
      setObservacao('')
      aoEnviar()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Enviar documento" aberto={aberto} aoFechar={aoFechar}>
      <form onSubmit={enviar} className="space-y-4">
        <Campo rotulo="Tipo">
          <select className={estiloEntrada} value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumento)}>
            {(['geral', 'saude'] as const).map((g) => (
              <optgroup key={g} label={g === 'geral' ? 'Documentos' : 'Exames e saúde'}>
                {TIPOS_DOCUMENTO.filter((t) => t.grupo === g).map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.nome}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Campo>
        <Campo rotulo={ehSaude(tipo) ? 'Laudo ou relatório da clínica' : 'Foto ou arquivo'} dica="Pode tirar foto na hora. Confira se está legível.">
          <input
            className={`${estiloEntrada} file:mr-3 file:rounded-lg file:border-0 file:bg-ozzy-400 file:px-3 file:py-1.5 file:font-semibold file:text-carvao`}
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          />
        </Campo>
        {tipo === 'atestado' && (
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Afastado de">
              <input className={estiloEntrada} type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </Campo>
            <Campo rotulo="Até">
              <input className={estiloEntrada} type="date" value={fim} min={inicio} onChange={(e) => setFim(e.target.value)} />
            </Campo>
          </div>
        )}
        {ehSaude(tipo) && (
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Data do exame">
              <input
                className={estiloEntrada}
                type="date"
                value={realizadoEm}
                max={hoje()}
                onChange={(e) => {
                  setRealizadoEm(e.target.value)
                  recalcular(tipo, e.target.value)
                }}
              />
            </Campo>
            <Campo rotulo="Vence em" dica={meses(tipo) ? `Sugestão: ${meses(tipo)} meses. Ajuste se o médico pediu outro prazo.` : 'Deixe vazio se não vence.'}>
              <input className={estiloEntrada} type="date" value={vence} min={realizadoEm} onChange={(e) => setVence(e.target.value)} />
            </Campo>
          </div>
        )}
        <Campo rotulo="Observação (opcional)">
          <input className={estiloEntrada} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder={ehSaude(tipo) ? 'Ex.: nome da clínica' : ''} />
        </Campo>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar'}
        </Botao>
      </form>
    </Modal>
  )
}

function RemoverOcorrencia({ o, aoFechar, aoRemover }: { o: Ocorrencia; aoFechar: () => void; aoRemover: () => void }) {
  const { store } = useApp()
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    try {
      await store.removerOcorrencia(o.id, motivo)
      aoRemover()
    } catch (err) {
      setErro((err as Error).message)
      setSalvando(false)
    }
  }

  return (
    <Modal titulo="Remover ocorrência" aberto aoFechar={aoFechar}>
      <form onSubmit={confirmar} className="space-y-4">
        <p className="text-sm text-stone-700">
          {nomeTipoOcorrencia(o.tipo)} de {dataLonga(o.data)}: some do perfil, da caixinha e do painel. Fica guardada em
          "Ver removidas" com o seu nome e o motivo.
        </p>
        <Campo rotulo="Motivo da remoção" dica="Ex.: lançada na pessoa errada, lançada em teste.">
          <textarea className={estiloEntrada} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} minLength={5} required />
        </Campo>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao variante="perigo" className="w-full" disabled={salvando || motivo.trim().length < 5}>
          Remover
        </Botao>
      </form>
    </Modal>
  )
}

function NovaOcorrencia({ aberto, funcionarioId, aoFechar, aoSalvar }: { aberto: boolean; funcionarioId: string; aoFechar: () => void; aoSalvar: (o: Ocorrencia) => void }) {
  const { store } = useApp()
  const [tipo, setTipo] = useState<TipoOcorrencia>('falta')
  const [data, setData] = useState(hoje())
  const [descricao, setDescricao] = useState('')
  const [natureza, setNatureza] = useState('')
  const [outra, setOutra] = useState('')
  const [suspInicio, setSuspInicio] = useState(addDias(hoje(), 1))
  const [suspDias, setSuspDias] = useState('1')
  const [erro, setErro] = useState('')
  const disciplinar = tipo === 'advertencia' || tipo === 'suspensao'

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const o = await store.registrarOcorrencia({
        funcionarioId, tipo, data, descricao,
        natureza: disciplinar ? (natureza === 'outra' ? outra.trim() : natureza) : null,
        suspensaoInicio: tipo === 'suspensao' ? suspInicio : null,
        suspensaoDias: tipo === 'suspensao' ? Number(suspDias) : null,
      })
      setDescricao('')
      aoSalvar(o)
    } catch (err) {
      setErro((err as Error).message)
    }
  }

  return (
    <Modal titulo="Registrar ocorrência" aberto={aberto} aoFechar={aoFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Tipo">
            <select className={estiloEntrada} value={tipo} onChange={(e) => setTipo(e.target.value as TipoOcorrencia)}>
              {TIPOS_OCORRENCIA.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Data">
            <input className={estiloEntrada} type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
        </div>
        {disciplinar && (
          <Campo rotulo="Natureza" dica="Sai no documento impresso.">
            <select className={estiloEntrada} value={natureza} onChange={(e) => setNatureza(e.target.value)} required>
              <option value="">Escolha…</option>
              {NATUREZAS.map((n) => <option key={n} value={n}>{n}</option>)}
              <option value="outra">Outra…</option>
            </select>
          </Campo>
        )}
        {disciplinar && natureza === 'outra' && (
          <Campo rotulo="Qual?">
            <input className={estiloEntrada} value={outra} onChange={(e) => setOutra(e.target.value)} required />
          </Campo>
        )}
        {tipo === 'suspensao' && (
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Suspensão a partir de">
              <input className={estiloEntrada} type="date" value={suspInicio} onChange={(e) => setSuspInicio(e.target.value)} required />
            </Campo>
            <Campo rotulo="Dias">
              <input className={estiloEntrada} type="number" min={1} max={30} value={suspDias} onChange={(e) => setSuspDias(e.target.value)} required />
            </Campo>
          </div>
        )}
        <Campo rotulo="O que aconteceu">
          <textarea className={estiloEntrada} rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} required />
        </Campo>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full">{disciplinar ? 'Salvar e gerar documento' : 'Salvar'}</Botao>
      </form>
    </Modal>
  )
}

// Recorta o centro em quadrado e reduz para 512 px antes de enviar (foto de celular tem vários MB).
async function reduzirFoto(arquivo: File): Promise<Blob> {
  const img = await createImageBitmap(arquivo)
  const lado = Math.min(img.width, img.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = Math.min(512, lado)
  canvas.getContext('2d')!.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, canvas.width, canvas.height)
  return new Promise((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error('Não deu para ler a foto.'))), 'image/jpeg', 0.85))
}

function TrocarFoto({ pessoa, aoTrocar }: { pessoa: Funcionario; aoTrocar: (img: Blob) => Promise<void> }) {
  const [enviando, setEnviando] = useState(false)
  return (
    <label className="relative shrink-0 cursor-pointer" title="Trocar foto">
      <Avatar nome={pessoa.nome} tamanho={56} foto={pessoa.fotoUrl} />
      <span className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full bg-ozzy-500 text-xs text-carvao ring-2 ring-white">
        {enviando ? '…' : '📷'}
      </span>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Trocar foto de perfil"
        disabled={enviando}
        onChange={async (e) => {
          const arquivo = e.target.files?.[0]
          e.target.value = ''
          if (!arquivo) return
          setEnviando(true)
          try {
            await aoTrocar(await reduzirFoto(arquivo))
          } finally {
            setEnviando(false)
          }
        }}
      />
    </label>
  )
}

// O que a pessoa já recebeu pelo banco (Heitor, 09/10): salários, vales e diárias ligados a ela. Só a gestão vê.
function PagamentosPessoa({ funcionarioId }: { funcionarioId: string }) {
  const { store } = useApp()
  const [lista, setLista] = useState<PagamentoPessoa[] | null>(null)
  const [tudo, setTudo] = useState(false)
  useEffect(() => {
    store.pagamentosFuncionario(funcionarioId).then(setLista).catch(() => setLista([]))
  }, [store, funcionarioId])
  if (!lista) return null
  const pagos = lista.filter((p) => p.pagoEm)
  const ano = pagos.filter((p) => p.pagoEm!.slice(0, 4) === hoje().slice(0, 4)).reduce((s, p) => s + p.valor, 0)
  return (
    <section className="mb-3 rounded-2xl bg-white p-3 ring-1 ring-stone-200">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-bold">Pagamentos feitos</h3>
        {pagos.length > 0 && <span className="text-xs text-stone-500">{reais(ano)} em {hoje().slice(0, 4)}</span>}
      </div>
      {lista.length === 0 ? (
        <p className="text-sm text-stone-500">Nenhum pagamento ligado a esta pessoa ainda. Na conciliação, use "Lançar como despesa" › Funcionário.</p>
      ) : (
        <ul className="mt-1 divide-y divide-stone-100 text-sm">
          {lista.slice(0, tudo ? undefined : 12).map((p) => (
            <li key={p.id} className="flex items-baseline justify-between gap-2 py-1">
              <span className="min-w-0 truncate">
                <span className="text-stone-500">{(p.pagoEm ?? p.vencimento).split('-').reverse().slice(0, 2).join('/')}/{(p.pagoEm ?? p.vencimento).slice(2, 4)}</span> {p.descricao}
                {!p.pagoEm && <span className="ml-1 text-xs text-amber-700">a pagar</span>}
              </span>
              <span className="shrink-0 font-semibold">{reais(p.valor)}</span>
            </li>
          ))}
        </ul>
      )}
      {lista.length > 12 && !tudo && <button className="mt-1 text-xs font-semibold text-stone-500" onClick={() => setTudo(true)}>Ver todos ({lista.length})</button>}
    </section>
  )
}

function MeusSalarios({ funcionarioId }: { funcionarioId: string }) {
  const { store } = useApp()
  const [lista, setLista] = useState<Salario[] | null>(null)
  useEffect(() => {
    store.salariosDe(funcionarioId).then(setLista)
  }, [store, funcionarioId])
  if (!lista) return <p className="text-stone-400">Carregando…</p>
  if (!lista.length) return <Vazio>Nenhum salário liberado ainda.</Vazio>
  const ordenada = [...lista].sort((a, b) => dataPagamento(b).localeCompare(dataPagamento(a)))
  return <section className="space-y-3">{ordenada.map((s) => <Contracheque key={s.mes + s.tipo} s={s} />)}</section>
}

function Readmitir({ pessoa, aoFechar, aoConfirmar }: { pessoa: Funcionario; aoFechar: () => void; aoConfirmar: (modo: 'volta' | 'engano', data: string) => Promise<void> }) {
  const [modo, setModo] = useState<'volta' | 'engano'>('volta')
  const [data, setData] = useState(hoje())
  const [salvando, setSalvando] = useState(false)
  const opcoes = [
    ['volta', 'Voltou a trabalhar (readmissão)', 'O período anterior fica guardado no histórico e começa um novo, com a nova data de admissão.'],
    ['engano', 'O desligamento foi um engano', 'Desfaz o desligamento: mantém a admissão original e apaga o checklist.'],
  ] as const
  return (
    <Modal titulo={`Reativar ${pessoa.nome.split(' ')[0]}`} aberto aoFechar={aoFechar}>
      <div className="space-y-4">
        {opcoes.map(([valor, titulo, dica]) => (
          <label key={valor} className={`block cursor-pointer rounded-xl p-3 ring-1 ${modo === valor ? 'bg-carvao text-white ring-carvao' : 'ring-stone-300'}`}>
            <input type="radio" name="modo-reativar" className="sr-only" checked={modo === valor} onChange={() => setModo(valor)} />
            <span className="block font-semibold">{titulo}</span>
            <span className={`block text-xs ${modo === valor ? 'text-stone-300' : 'text-stone-500'}`}>{dica}</span>
          </label>
        ))}
        {modo === 'volta' && (
          <Campo rotulo="Nova data de admissão">
            <input className={estiloEntrada} type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
        )}
        {modo === 'volta' && pessoa.dataDesligamento && (
          <p className="text-sm text-stone-600">
            Vai para o histórico: de {dataLonga(pessoa.dataAdmissao)} a {dataLonga(pessoa.dataDesligamento)}.
          </p>
        )}
        <Botao className="w-full" disabled={salvando || (modo === 'volta' && !data)} onClick={async () => { setSalvando(true); await aoConfirmar(modo, data); setSalvando(false) }}>
          {modo === 'volta' ? 'Readmitir' : 'Desfazer desligamento'}
        </Botao>
      </div>
    </Modal>
  )
}

function HistoricoVinculos({ vinculos, pessoa }: { vinculos: VinculoAnterior[]; pessoa: Funcionario }) {
  const nomeTipo = (t: string | null) => TIPOS_DESLIGAMENTO.find((x) => x.valor === t)?.nome ?? 'Desligamento'
  return (
    <Cartao>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">Histórico na empresa</h2>
        <Selo cor="azul">{vinculos.length + 1}ª passagem</Selo>
      </div>
      <ol className="space-y-2 border-l-2 border-stone-200 pl-4 text-sm">
        <li>
          <b>Atual:</b> desde {dataLonga(pessoa.dataAdmissao)}
          {pessoa.dataDesligamento && ` até ${dataLonga(pessoa.dataDesligamento)}`} · {pessoa.cargo}
        </li>
        {vinculos.map((v) => (
          <li key={v.id}>
            {dataLonga(v.admissao)} a {dataLonga(v.desligamento)}
            {v.cargo && ` · ${v.cargo}`}
            <span className="block text-xs text-stone-500">{nomeTipo(v.tipoDesligamento)}</span>
          </li>
        ))}
      </ol>
    </Cartao>
  )
}

// A própria pessoa troca a senha (pedido de 08/10). Confere a atual antes, para ninguém trocar a senha de
// outra pessoa num celular esquecido aberto.
function TrocarSenha({ aoFechar, aoTrocar }: { aoFechar: () => void; aoTrocar: () => void }) {
  const { store } = useApp()
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [repetir, setRepetir] = useState('')
  const [ver, setVer] = useState(false)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (nova.length < 6) return setErro('A nova senha precisa ter pelo menos 6 caracteres.')
    if (nova !== repetir) return setErro('As duas senhas novas estão diferentes.')
    if (nova === atual) return setErro('A nova senha precisa ser diferente da atual.')
    setErro('')
    setSalvando(true)
    try {
      await store.trocarSenha(atual, nova)
      aoTrocar()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  const tipo = ver ? 'text' : 'password'
  return (
    <Modal titulo="Trocar minha senha" aberto aoFechar={aoFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <Campo rotulo="Senha atual">
          <input className={estiloEntrada} type={tipo} autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} required />
        </Campo>
        <Campo rotulo="Nova senha" dica="Pelo menos 6 caracteres.">
          <input className={estiloEntrada} type={tipo} autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} required />
        </Campo>
        <Campo rotulo="Repita a nova senha">
          <input className={estiloEntrada} type={tipo} autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} required />
        </Campo>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-carvao" checked={ver} onChange={(e) => setVer(e.target.checked)} />
          Mostrar as senhas
        </label>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full" disabled={salvando}>{salvando ? 'Trocando…' : 'Trocar senha'}</Botao>
      </form>
    </Modal>
  )
}
