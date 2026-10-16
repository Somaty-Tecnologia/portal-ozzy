import { useState } from 'react'
import { Botao, Cartao, Selo } from './ui'
import { useApp } from '../lib/contexto'
import { dataLonga, hoje } from '../lib/datas'
import { etapasDesligamento, progressoDesligamento, prazoRescisao } from '../lib/pessoal'
import { TIPOS_DESLIGAMENTO, type Desligamento, type Funcionario } from '../lib/types'

// Etapas do desligamento: a gestão marca cada uma; o portal registra quem marcou e quando.
export default function ChecklistDesligamento({ d, pessoa, podeMarcar, aoMudar, aoTermos, aoCancelar }: {
  d: Desligamento
  pessoa: Funcionario
  podeMarcar: boolean
  aoMudar: () => void
  aoTermos: () => void
  aoCancelar: () => Promise<void>
}) {
  const { eu, store, nomeDe, avisar } = useApp()
  const [salvando, setSalvando] = useState(false)
  const etapas = etapasDesligamento(d, pessoa)
  const { feitas, total } = progressoDesligamento(d, pessoa)
  const prazo = prazoRescisao(d)
  const atrasado = !d.itens.pagamento && hoje() > prazo

  const mudar = async (m: Parameters<typeof store.atualizarDesligamento>[1], aviso?: string) => {
    setSalvando(true)
    try {
      await store.atualizarDesligamento(d.id, m)
      aoMudar()
      if (aviso) avisar(aviso)
    } catch (e) {
      avisar((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  const alternar = (chave: string) => {
    const itens = { ...d.itens }
    if (itens[chave]) delete itens[chave]
    else itens[chave] = { por: eu.id, em: new Date().toISOString() }
    mudar({ itens })
  }

  return (
    <Cartao className={d.concluido ? '' : 'ring-2! ring-ozzy-400!'}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-bold">Desligamento</h2>
          <p className="text-sm text-stone-600">
            {TIPOS_DESLIGAMENTO.find((t) => t.valor === d.tipo)?.nome} · último dia {dataLonga(d.data)}
          </p>
        </div>
        {d.concluido ? (
          <Selo cor="verde">Concluído</Selo>
        ) : (
          <Selo cor={atrasado ? 'vermelho' : 'ambar'}>
            {feitas} de {total} · {atrasado ? 'rescisão atrasada' : `pagar até ${dataLonga(prazo)}`}
          </Selo>
        )}
      </div>
      <ul className="mt-3 divide-y divide-stone-100">
        {etapas.map((e) => {
          const feito = d.itens[e.chave]
          return (
            <li key={e.chave} className="py-2">
              <label className={`flex items-start gap-3 ${podeMarcar && !d.concluido ? 'cursor-pointer' : ''}`}>
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 shrink-0 accent-carvao"
                  checked={!!feito}
                  disabled={!podeMarcar || d.concluido || salvando}
                  onChange={() => alternar(e.chave)}
                />
                <span className="min-w-0 flex-1 text-sm">
                  <span className={`block font-medium ${feito ? 'text-stone-500 line-through' : ''}`}>{e.nome}</span>
                  {feito ? (
                    <span className="block text-xs text-stone-500">
                      {nomeDe(feito.por)} · {dataLonga(feito.em.slice(0, 10))}
                    </span>
                  ) : (
                    e.detalhe && <span className="block text-xs text-stone-500">{e.detalhe}</span>
                  )}
                </span>
                {e.chave === 'gravidez' && !feito && (
                  <button type="button" onClick={aoTermos} className="shrink-0 text-xs font-semibold underline decoration-ozzy-500 decoration-2 underline-offset-2">
                    Gerar termos
                  </button>
                )}
              </label>
            </li>
          )
        })}
      </ul>
      {podeMarcar && (
        <div className="mt-3 flex flex-wrap gap-2">
          {d.concluido ? (
            <Botao variante="secundario" disabled={salvando} onClick={() => mudar({ concluido: false }, 'Desligamento reaberto')}>
              Reabrir
            </Botao>
          ) : (
            <>
              <Botao disabled={salvando || feitas < total} onClick={() => mudar({ concluido: true }, 'Desligamento concluído')}>
                {feitas < total ? `Faltam ${total - feitas} etapa${total - feitas > 1 ? 's' : ''}` : 'Concluir desligamento'}
              </Botao>
              {/* Desligamento aberto sem querer (Heitor, 16/10/2026): o checklist ficava preso no perfil. */}
              <Botao
                variante="perigo"
                disabled={salvando}
                onClick={async () => {
                  const aviso = feitas > 0 ? ` As ${feitas} etapa${feitas > 1 ? 's' : ''} já marcada${feitas > 1 ? 's' : ''} também some${feitas > 1 ? 'm' : ''}.` : ''
                  if (!confirm(`Cancelar o desligamento de ${pessoa.nome}? O checklist some e a pessoa continua (ou volta a ficar) ativa.${aviso}`)) return
                  setSalvando(true)
                  try {
                    await aoCancelar()
                  } catch (e) {
                    avisar((e as Error).message)
                  } finally {
                    setSalvando(false)
                  }
                }}
              >
                Cancelar desligamento
              </Botao>
            </>
          )}
        </div>
      )}
    </Cartao>
  )
}
