import { useEffect, useState } from 'react'
import { Botao, Campo, estiloEntrada } from '../components/ui'
import logo from '../assets/logo.png'
import { addDias, dataCurta, diaSemana, hoje } from '../lib/datas'
import { lerNumero, reais } from '../lib/financeiro'
import { reduzirFoto } from '../lib/imagem'
import { mascaraCelular, mascaraCpf, nomeProprio, soDigitos, type Store } from '../lib/store'
import { cpfValido } from '../lib/cpf'
import type { QuemSouMotoboy, Unidade } from '../lib/types'

// Link dos motoboys (#/motoboy, Heitor 12/10), sem login: no fim do turno o motoboy manda quantas entregas fez,
// as fotos das notinhas e algum valor a mais. Antes ia tudo pelo WhatsApp. A gestão confere em Motoboys › Conferir.
export const linkMotoboy = () => `${location.origin}${location.pathname}#/motoboy`

interface Extra { descricao: string; valor: string }

export default function EnviarMotoboy({ store }: { store: Store }) {
  const [lojas, setLojas] = useState<Unidade[]>([])
  const [celular, setCelular] = useState('')
  const [quem, setQuem] = useState<Extract<QuemSouMotoboy, { tipo: 'motoboy' }> | null>(null)
  const [loja, setLoja] = useState('')
  const [data, setData] = useState(hoje())
  const [entregas, setEntregas] = useState('')
  const [fotos, setFotos] = useState<{ arquivo: File; url: string }[]>([])
  const [extras, setExtras] = useState<Extra[]>([])
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  // Motoboy novo (Heitor, 12/10): se cadastra aqui mesmo, com nome, CPF e Pix obrigatórios.
  const [novo, setNovo] = useState(false)
  const [cad, setCad] = useState({ nome: '', cpf: '', pix: '', loja: '' })

  useEffect(() => {
    store.lojasParaDiaria().then((us) => setLojas(us.filter((u) => u.id !== 'central' && u.id !== 'eventos')), () => undefined)
  }, [store])

  const identificar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (soDigitos(celular).length < 10) return setErro('Coloque o celular com DDD.')
    setErro('')
    setEnviando(true)
    try {
      const q = await store.motoboyQuemSou(soDigitos(celular))
      if (q.tipo !== 'motoboy') return setNovo(true)
      setQuem(q)
      setLoja(q.unidadeId ?? '')
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const cadastrar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (nomeProprio(cad.nome).split(' ').length < 2) return setErro('Coloque o nome completo.')
    if (!cpfValido(cad.cpf)) return setErro('CPF inválido. Confira os números.')
    if (!cad.pix.trim()) return setErro('Coloque a chave Pix.')
    if (!cad.loja) return setErro('Escolha a loja em que você roda.')
    setErro('')
    setEnviando(true)
    try {
      const q = await store.motoboyCadastrar({ celular: soDigitos(celular), nome: nomeProprio(cad.nome), cpf: soDigitos(cad.cpf), pix: cad.pix.trim(), unidadeId: cad.loja })
      if (q.tipo !== 'motoboy') return setErro('Não deu para cadastrar. Fale com a gerente.')
      setNovo(false)
      setQuem(q)
      setLoja(q.unidadeId ?? cad.loja)
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const escolherFotos = (lista: FileList | null) => {
    if (!lista) return
    // Copia já: o input é limpo logo depois (para poder escolher as mesmas fotos de novo).
    const novas = Array.from(lista).map((arquivo) => ({ arquivo, url: URL.createObjectURL(arquivo) }))
    setFotos((fs) => [...fs, ...novas].slice(0, 40))
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = lerNumero(entregas)
    if (!loja) return setErro('Escolha a loja.')
    if (n === null || n < 0 || n > 200 || !Number.isInteger(n)) return setErro('Coloque quantas entregas você fez.')
    if (n > 0 && !fotos.length) return setErro('Mande as fotos das notinhas.')
    const ruim = extras.find((x) => (x.descricao.trim() && !lerNumero(x.valor)) || (!x.descricao.trim() && lerNumero(x.valor)))
    if (ruim) return setErro('No valor a mais, diga o que foi e quanto.')
    setErro('')
    setEnviando(true)
    try {
      const reduzidas = await Promise.all(fotos.map((f) => reduzirFoto(f.arquivo)))
      await store.enviarDiaMotoboy({
        celular: soDigitos(celular), unidadeId: loja, data, entregas: n, observacao: obs,
        extras: extras.filter((x) => x.descricao.trim() && lerNumero(x.valor)).map((x) => ({ descricao: x.descricao.trim(), valor: lerNumero(x.valor)! })),
        fotos: reduzidas,
      })
      setEnviado(true)
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const recomecar = () => {
    setEnviado(false)
    setEntregas('')
    setFotos([])
    setExtras([])
    setObs('')
    setData(hoje())
  }

  const dias = Array.from({ length: 7 }, (_, i) => addDias(hoje(), -i))
  const nomeLoja = (id: string) => lojas.find((u) => u.id === id)?.nome ?? ''

  return (
    <div className="min-h-full bg-[#f6f5f3]">
      <header className="bg-carvao px-4 pt-6 pb-5 text-white">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <img src={logo} alt="The Ozzy" className="h-12 w-12" />
          <div>
            <div className="text-lg font-bold">Entregas do dia</div>
            <div className="text-sm text-ozzy-400">Motoboys The Ozzy</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 py-5">
        {enviado ? (
          <div className="space-y-4 rounded-2xl bg-white p-5 text-center ring-1 ring-stone-200">
            <div className="text-4xl">✓</div>
            <h1 className="text-lg font-bold">Dia enviado</h1>
            <p className="text-sm text-stone-600">
              {entregas} {entregas === '1' ? 'entrega' : 'entregas'} em {diaSemana(data).toLowerCase()}, {dataCurta(data)}, na {nomeLoja(loja)}. A gerente confere as notinhas e
              o dia entra no pagamento da semana, na segunda-feira.
            </p>
            <p className="text-xs text-stone-500">Mandou algo errado? Mande de novo o mesmo dia: o último envio vale, enquanto a gerente não conferiu.</p>
            <Botao variante="secundario" className="w-full" onClick={recomecar}>Mandar outro dia</Botao>
          </div>
        ) : novo && !quem ? (
          <form onSubmit={cadastrar} className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
            <h1 className="text-lg font-bold">Primeira vez por aqui?</h1>
            <p className="text-sm text-stone-600">Não achamos o celular {mascaraCelular(celular)} no cadastro. Preencha seus dados uma vez só; das próximas, é só o celular.</p>
            <Campo rotulo="Nome completo">
              <input className={estiloEntrada} autoComplete="name" value={cad.nome} onChange={(e) => setCad({ ...cad, nome: e.target.value })} onBlur={() => setCad((c) => ({ ...c, nome: nomeProprio(c.nome) }))} required />
            </Campo>
            <Campo rotulo="CPF">
              <input className={estiloEntrada} inputMode="numeric" placeholder="000.000.000-00" value={cad.cpf} onChange={(e) => setCad({ ...cad, cpf: mascaraCpf(e.target.value) })} required />
            </Campo>
            <Campo rotulo="Chave Pix" dica="CPF, celular, e-mail ou chave aleatória. Precisa estar no seu nome.">
              <input className={estiloEntrada} value={cad.pix} onChange={(e) => setCad({ ...cad, pix: e.target.value })} required />
            </Campo>
            <Campo rotulo="Loja em que você roda">
              <select className={estiloEntrada} value={cad.loja} onChange={(e) => setCad({ ...cad, loja: e.target.value })} required>
                <option value="">Escolha</option>
                {lojas.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </Campo>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <Botao className="w-full" disabled={enviando}>{enviando ? 'Cadastrando…' : 'Cadastrar e continuar'}</Botao>
            <button type="button" className="w-full text-sm font-semibold text-stone-500" onClick={() => { setNovo(false); setErro('') }}>Errei o celular</button>
          </form>
        ) : !quem ? (
          <form onSubmit={identificar} className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
            <p className="text-sm text-stone-600">Terminou o turno? Mande aqui quantas entregas você fez e as fotos das notinhas.</p>
            <Campo rotulo="Seu celular (com DDD)" dica="O mesmo que está no cadastro com a gerente.">
              <input className={estiloEntrada} inputMode="tel" autoComplete="tel" placeholder="(11) 90000-0000" value={celular} onChange={(e) => setCelular(mascaraCelular(e.target.value))} required />
            </Campo>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <Botao className="w-full" disabled={enviando}>{enviando ? 'Conferindo…' : 'Continuar'}</Botao>
          </form>
        ) : (
          <form onSubmit={enviar} className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
            <h1 className="text-lg font-bold">Oi, {quem.nome}!</h1>
            <Campo rotulo="Loja">
              <select className={estiloEntrada} value={loja} onChange={(e) => setLoja(e.target.value)} required>
                <option value="">Escolha</option>
                {lojas.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Dia">
              <select className={estiloEntrada} value={data} onChange={(e) => setData(e.target.value)}>
                {dias.map((d, i) => <option key={d} value={d}>{i === 0 ? 'Hoje' : i === 1 ? 'Ontem' : diaSemana(d)}, {dataCurta(d)}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Quantas entregas você fez no total?">
              <input className={estiloEntrada + ' text-center text-2xl! font-bold'} inputMode="numeric" value={entregas} onChange={(e) => setEntregas(e.target.value.replace(/\D/g, ''))} placeholder="0" required />
            </Campo>
            <p className="-mt-2 text-xs text-stone-500">Coloque <b>todas</b> as entregas do dia, não só as extras: o portal faz a conta. A diária ({reais(Number(quem.valorDiaria ?? 100))}, ou {reais(Number(quem.valorDiariaFds ?? 115))} no sábado e domingo) já inclui as {quem.entregasIncluidas ?? 10} primeiras entregas do dia. Da {(quem.entregasIncluidas ?? 10) + 1}ª em diante, {reais(Number(quem.valorEntrega ?? 4))} por entrega.</p>

            <div className="space-y-2">
              <div className="text-sm font-semibold">Fotos das notinhas</div>
              {fotos.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {fotos.map((f, i) => (
                    <div key={f.url} className="relative">
                      <img src={f.url} alt={`Notinha ${i + 1}`} className="aspect-[3/4] w-full rounded-lg object-cover ring-1 ring-stone-200" />
                      <button type="button" onClick={() => setFotos(fotos.filter((_, j) => j !== i))} aria-label={`Tirar foto ${i + 1}`}
                        className="absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full bg-carvao text-xs text-white">✕</button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 px-3 py-4 text-sm font-semibold text-stone-600">
                📷 {fotos.length ? 'Pôr mais fotos' : 'Tirar ou escolher fotos'}
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { escolherFotos(e.target.files); e.target.value = '' }} />
              </label>
              <p className="text-xs text-stone-500">Pode pôr várias notinhas na mesma foto, desde que dê para ler o número do pedido.{fotos.length ? ` ${fotos.length} ${fotos.length === 1 ? 'foto' : 'fotos'}.` : ''}</p>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold">Valor a mais <span className="font-normal text-stone-500">(se teve)</span></div>
              {extras.map((x, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className={estiloEntrada + ' min-w-0 flex-1'} placeholder="O que foi (entrega longe, pedágio…)" value={x.descricao}
                    onChange={(e) => setExtras(extras.map((y, j) => (j === i ? { ...y, descricao: e.target.value } : y)))} />
                  <input className={estiloEntrada + ' w-24! shrink-0'} inputMode="decimal" placeholder="R$" value={x.valor}
                    onChange={(e) => setExtras(extras.map((y, j) => (j === i ? { ...y, valor: e.target.value } : y)))} />
                  <button type="button" className="px-1 text-stone-400" aria-label="Tirar" onClick={() => setExtras(extras.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <button type="button" className="text-sm font-semibold text-sky-700" onClick={() => setExtras([...extras, { descricao: '', valor: '' }])}>+ Valor a mais</button>
            </div>

            <Campo rotulo="Observação">
              <textarea className={estiloEntrada} rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Algo que a gerente precisa saber" />
            </Campo>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <Botao className="w-full" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar o dia'}</Botao>
            <button type="button" className="w-full text-sm font-semibold text-stone-500" onClick={() => setQuem(null)}>Voltar</button>
          </form>
        )}
      </main>
    </div>
  )
}
