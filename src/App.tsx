import { useEffect, useMemo, useState } from 'react'
import { ligarAtalhoSalvar } from './lib/atalhoSalvar'
import { ProvedorApp, useApp } from './lib/contexto'
import { criarDemoStore } from './lib/demoStore'
import { criarSupabaseStore } from './lib/supabaseStore'
import { operaEstoque, podeGerenciar, podeVerEquipe } from './lib/permissoes'
import { ir } from './lib/rota'
import type { Funcionario } from './lib/types'
import { nomeNivel } from './lib/types'
import Login from './pages/Login'
import EnviarDiaria from './pages/EnviarDiaria'
import EnviarDiariaEvento from './pages/EnviarDiariaEvento'
import EnviarMotoboy from './pages/EnviarMotoboy'
import AbrirGuia from './pages/AbrirGuia'
import Inicio from './pages/Inicio'
import Comunicados from './pages/Comunicados'
import Escala from './pages/Escala'
import Equipe from './pages/Equipe'
import Perfil from './pages/Perfil'
import EmBreve from './pages/EmBreve'
import Cadastros, { ABAS_CADASTROS } from './pages/Cadastros'
import Compras, { ABAS_COMPRAS } from './pages/Compras'
import Vencimentos from './pages/Vencimentos'
import Caixinha from './pages/Caixinha'
import Turnos from './pages/Turnos'
import Ponto from './pages/Ponto'
import Regras from './pages/Regras'
import Manutencao from './pages/Manutencao'
import FichasEvento from './pages/FichasEvento'
import Checklists, { ABAS_CHECKLISTS } from './pages/Checklists'
import Freelancers from './pages/Freelancers'
import Motoboys from './pages/Motoboys'
import Producao, { ABAS_PRODUCAO } from './pages/Producao'
import Fechamento from './pages/Fechamento'
import Salarios from './pages/Salarios'
import ModuloFinanceiro, { ABAS_FINANCEIRO } from './pages/ModuloFinanceiro'
import Estoque, { ABAS_ESTOQUE } from './pages/Estoque'
import Eventos, { ABAS_EVENTOS } from './pages/Eventos'
import Refeicoes, { ABAS_REFEICOES, souCozinha } from './pages/Refeicoes'
import IrPara, { type Destino } from './components/IrPara'
import AtalhosOperacao, { ATALHOS_OPERACAO } from './components/AtalhosOperacao'
import { MeuEvento } from './pages/EventoLogistica'
import Icone from './components/Icone'
import logo from './assets/logo.png'
import { modulosVisiveis } from './lib/modulos'

const URL_SB = import.meta.env.VITE_SUPABASE_URL as string | undefined
const CHAVE_SB = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
// Ambiente de testes (08/10): outro banco, para testar integrações sem tocar nos dados reais.
const AMBIENTE_TESTE = import.meta.env.VITE_AMBIENTE === 'teste'
if (AMBIENTE_TESTE) document.title = 'TESTE · ' + document.title
const usarDemo = import.meta.env.MODE === 'preview' || !URL_SB || !CHAVE_SB

export default function App() {
  const store = useMemo(() => (usarDemo ? criarDemoStore() : criarSupabaseStore(URL_SB!, CHAVE_SB!)), [])
  const [eu, setEu] = useState<Funcionario | null>(null)
  const [carregando, setCarregando] = useState(true)
  // Link da loja para o freelancer mandar a diária (#/diaria/<loja>): abre sem login.
  const [diaria, setDiaria] = useState(() => location.hash.match(/^#\/?diaria(?!-evento)(?:\/([\w-]+))?/))
  // Link dos freelas de evento (#/diaria-evento[/<evento>]): base separada, também sem login.
  const [diariaEvento, setDiariaEvento] = useState(() => location.hash.match(/^#\/?diaria-evento(?:\/([\w-]+))?/))
  // Link dos motoboys (#/motoboy): mandam as entregas do dia e as fotos das notinhas, sem login.
  const [motoboy, setMotoboy] = useState(() => /^#\/?motoboy\b/.test(location.hash))
  // Link curto da guia de exame (#/g/<código>), mandado no WhatsApp: abre sem login.
  const [guia, setGuia] = useState(() => location.hash.match(/^#\/?g\/([A-Za-z0-9]+)/))
  useEffect(() => ligarAtalhoSalvar(), [])
  useEffect(() => {
    const ouvir = () => {
      setDiaria(location.hash.match(/^#\/?diaria(?!-evento)(?:\/([\w-]+))?/))
      setDiariaEvento(location.hash.match(/^#\/?diaria-evento(?:\/([\w-]+))?/))
      setMotoboy(/^#\/?motoboy\b/.test(location.hash))
      setGuia(location.hash.match(/^#\/?g\/([A-Za-z0-9]+)/))
    }
    window.addEventListener('hashchange', ouvir)
    return () => window.removeEventListener('hashchange', ouvir)
  }, [])

  useEffect(() => {
    store.sessaoAtual().then((f) => {
      setEu(f)
      setCarregando(false)
    })
  }, [store])

  if (motoboy) return <EnviarMotoboy store={store} />
  if (diariaEvento) return <EnviarDiariaEvento store={store} eventoId={diariaEvento[1]} />
  if (diaria) return <EnviarDiaria store={store} lojaId={diaria[1]} />
  if (guia) return <AbrirGuia store={store} codigo={guia[1]} />
  if (carregando) return <div className="flex h-full items-center justify-center text-stone-400">Carregando…</div>
  if (!eu)
    return (
      <>
        {AMBIENTE_TESTE && <div className="bg-sky-600 px-4 py-1.5 text-center text-xs font-semibold text-white">Ambiente de testes</div>}
        <Login store={store} aoEntrar={setEu} />
      </>
    )

  return (
    <ProvedorApp store={store} eu={eu}>
      <Casca
        aoSair={async () => {
          await store.sair()
          location.hash = ''
          setEu(null)
        }}
      />
    </ProvedorApp>
  )
}

function useRota() {
  const ler = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [partes, setPartes] = useState(ler)
  useEffect(() => {
    const ouvir = () => {
      setPartes(ler())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', ouvir)
    return () => window.removeEventListener('hashchange', ouvir)
  }, [])
  return partes
}

function Casca({ aoSair }: { aoSair: () => void }) {
  const { eu, nomeUnidade, store } = useApp()
  const [area = 'inicio', sub, param] = useRota()
  const [menuAberto, setMenuAberto] = useState(false)
  const modulos = modulosVisiveis(eu)
  // Freelancers saiu do Departamento Pessoal para o menu (08/10): link antigo continua funcionando.
  useEffect(() => {
    if (area === 'rh' && sub === 'freelancers') ir('freelancers')
  }, [area, sub])
  const modulo = modulos.find((m) => m.id === area) ?? modulos[0]

  useEffect(() => setMenuAberto(false), [area, sub])

  const abasRh = [
    { id: 'avisos', nome: 'Avisos' },
    { id: 'turnos', nome: 'Turnos' },
    { id: 'folgas', nome: 'Folgas' },
    ...(podeVerEquipe(eu.nivel) ? [{ id: 'equipe', nome: 'Equipe' }] : []),
    ...(podeGerenciar(eu.nivel) ? [{ id: 'exames', nome: 'Exames' }, { id: 'caixinha', nome: 'Caixinha' }, { id: 'salarios', nome: 'Salários' }] : []),
    { id: 'ponto', nome: 'Ponto' },
    { id: 'perfil', nome: 'Meu perfil' },
  ]
  const abaRh = abasRh.find((a) => a.id === sub)?.id ?? 'avisos'

  // Abas de cada menu, com endereço próprio: aparecem embaixo do menu na lateral e no "Ir para" (Heitor, 12/10).
  const abasDe = (id: string): { id: string; nome: string }[] =>
    id === 'rh' ? abasRh
      : id === 'cadastros' ? ABAS_CADASTROS
      : id === 'producao' ? ABAS_PRODUCAO.filter((a) => !a.soGestao || podeGerenciar(eu.nivel))
      : id === 'compras' ? ABAS_COMPRAS.filter((a) => a.id === 'semana' || (operaEstoque(eu.nivel) && (!('soGestao' in a) || podeGerenciar(eu.nivel))))
      : id === 'estoque' ? ABAS_ESTOQUE
      : id === 'financeiro' ? ABAS_FINANCEIRO
      : id === 'eventos' ? ABAS_EVENTOS
      : id === 'refeicoes' ? (souCozinha(eu) ? ABAS_REFEICOES : [])
      : id === 'checklists' ? ABAS_CHECKLISTS.filter((a) => !a.gestao || podeGerenciar(eu.nivel))
      : []
  const caminhoDe = (m: string, aba: string) => (aba ? `${m}/${aba}` : m)
  const abaAtiva = (m: string) => (m === 'rh' ? abaRh : abasDe(m).some((a) => a.id && a.id === sub) ? sub! : '')
  const [abertos, setAbertos] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('menu-abertos') ?? '[]') } catch { return [] }
  })
  const alternar = (id: string) => {
    const novo = abertos.includes(id) ? abertos.filter((x) => x !== id) : [...abertos, id]
    setAbertos(novo)
    try { localStorage.setItem('menu-abertos', JSON.stringify(novo)) } catch { /* sem armazenamento */ }
  }
  const destinos = modulos.filter((m) => m.pronto).flatMap<Destino>((m) => {
    const abas = abasDe(m.id)
    return abas.length ? abas.map((a) => ({ caminho: caminhoDe(m.id, a.id), modulo: m.nome, aba: a.nome })) : [{ caminho: m.id, modulo: m.nome }]
  })
  const [irPara, setIrPara] = useState(false)
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.code === 'KeyK' && (e.altKey || e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setIrPara(true)
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])

  let conteudo
  // Quem está escalado num evento confere a separação e conta as sobras, mesmo sem ver o módulo Eventos.
  if (area === 'meu-evento') conteudo = <MeuEvento id={sub} aba={param} />
  else if (modulo.id === 'inicio') conteudo = <Inicio />
  else if (modulo.id === 'regras') conteudo = <Regras />
  else if (modulo.id === 'manutencao') conteudo = <Manutencao />
  else if (modulo.id === 'fichas') conteudo = <FichasEvento area="lojas" id={sub} key={sub ?? 'lista'} />
  else if (modulo.id === 'financeiro') conteudo = <ModuloFinanceiro sub={sub} />
  else if (modulo.id === 'cadastros') conteudo = <Cadastros aba={sub} key={sub ?? 'cadastros'} />
  else if (modulo.id === 'compras') conteudo = <Compras sub={sub} />
  else if (modulo.id === 'estoque') conteudo = <Estoque sub={sub} param={param} />
  else if (modulo.id === 'freelancers') conteudo = <Freelancers />
  else if (modulo.id === 'motoboys') conteudo = <Motoboys />
  else if (modulo.id === 'producao') conteudo = <Producao sub={sub} />
  else if (modulo.id === 'fechamento') conteudo = <Fechamento />
  else if (modulo.id === 'eventos') conteudo = <Eventos sub={sub} param={param} />
  else if (modulo.id === 'refeicoes') conteudo = <Refeicoes sub={sub} param={param} />
  else if (modulo.id === 'checklists') conteudo = <Checklists sub={sub} param={param} key={sub === 'fazer' ? param : sub} />
  else if (modulo.id !== 'rh') conteudo = <EmBreve modulo={modulo} />
  else if (abaRh === 'turnos') conteudo = <Turnos />
  else if (abaRh === 'folgas') conteudo = <Escala />
  else if (abaRh === 'equipe' && param) conteudo = <Perfil funcionarioId={param} />
  else if (abaRh === 'equipe') conteudo = <Equipe />
  else if (abaRh === 'exames') conteudo = <Vencimentos />
  else if (abaRh === 'caixinha') conteudo = <Caixinha />
  else if (abaRh === 'salarios') conteudo = <Salarios />
  else if (abaRh === 'ponto') conteudo = <Ponto codigo={param} />
  else if (abaRh === 'perfil') conteudo = <Perfil funcionarioId={eu.id} />
  else conteudo = <Comunicados />

  const menu = (
    <nav className="flex h-full flex-col bg-carvao text-stone-300">
      <button onClick={() => ir('inicio')} className="flex items-center gap-3 px-5 pt-5 pb-1 text-left">
        <img src={logo} alt="The Ozzy" className="h-14 w-14" />
        <div>
          <div className="text-[15px] font-light tracking-[0.25em] text-white">THE OZZY</div>
          <div className="rotulo-marca text-[10px] text-ozzy-400">Portal do Time</div>
        </div>
      </button>
      <div className="px-3 pt-3">
        <button onClick={() => setIrPara(true)} className="flex w-full items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-left text-sm text-stone-400 hover:bg-white/15 hover:text-white">
          <Icone nome="busca" tamanho={16} />
          <span className="flex-1">Ir para…</span>
          <kbd className="rounded bg-white/10 px-1.5 text-[10px] font-semibold">Alt K</kbd>
        </button>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {modulos.map((m) => {
          const ativo = m.id === modulo.id
          const abas = m.pronto ? abasDe(m.id) : []
          const aberto = abas.length > 0 && (ativo || abertos.includes(m.id))
          return (
            <div key={m.id}>
              <div className={`flex items-center rounded-xl transition ${ativo ? 'bg-ozzy-500 text-carvao' : 'hover:bg-white/10 hover:text-white'}`}>
                <button
                  onClick={() => ir(m.id === 'rh' ? 'rh/avisos' : m.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left text-sm font-semibold"
                >
                  <Icone nome={m.id} />
                  <span className="flex-1">{m.nome}</span>
                  {!m.pronto && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${ativo ? 'bg-carvao/15' : 'bg-white/10 text-stone-400'}`}>
                      em breve
                    </span>
                  )}
                </button>
                {abas.length > 0 && !ativo && (
                  <button onClick={() => alternar(m.id)} className="px-3 py-2.5 text-xs opacity-60 hover:opacity-100" aria-label={`${aberto ? 'Fechar' : 'Abrir'} as abas de ${m.nome}`} aria-expanded={aberto}>
                    {aberto ? '▾' : '▸'}
                  </button>
                )}
              </div>
              {aberto && (
                <div className="my-0.5 ml-6 space-y-0.5 border-l border-white/10 pl-2">
                  {abas.map((a) => {
                    const essa = ativo && abaAtiva(m.id) === a.id
                    return (
                      <button
                        key={a.id}
                        onClick={() => ir(caminhoDe(m.id, a.id))}
                        className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] ${essa ? 'bg-white/15 font-semibold text-white' : 'hover:bg-white/10 hover:text-white'}`}
                      >
                        {a.nome}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="border-t border-white/10 px-5 py-4">
        <div className="text-sm font-semibold text-white">{eu.nome}</div>
        <div className="text-xs text-stone-400">
          {nomeNivel(eu.nivel)} · {nomeUnidade(eu.unidadeId)}
        </div>
        <button onClick={aoSair} className="mt-2 text-xs font-semibold text-stone-400 hover:text-white">
          Sair
        </button>
      </div>
    </nav>
  )

  return (
    <div className="min-h-full lg:pl-64 print:pl-0">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block print:hidden">{menu}</aside>

      {menuAberto && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMenuAberto(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] pt-[env(safe-area-inset-top)]" onClick={(e) => e.stopPropagation()}>
            {menu}
          </aside>
        </div>
      )}

      {AMBIENTE_TESTE && store.modo === 'supabase' && (
        <div className="bg-sky-600 px-4 py-1.5 text-center text-xs font-semibold text-white print:hidden">
          Ambiente de testes: banco separado, nada aqui chega ao portal real
        </div>
      )}
      {store.modo === 'demo' && (
        <div className="bg-ozzy-500 px-4 py-1.5 text-center text-xs font-semibold text-carvao print:hidden">
          Modo demonstração: dados de exemplo, nada é salvo de verdade
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur lg:hidden print:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => setMenuAberto(true)} className="-ml-1 rounded-lg p-1.5 text-stone-700 hover:bg-stone-100" aria-label="Abrir menu">
            <Icone nome="menu" tamanho={22} />
          </button>
          <img src={logo} alt="The Ozzy" className="h-8 w-8" />
          <span className="flex-1 truncate text-sm font-semibold text-stone-600">{modulo.id === 'inicio' ? '' : modulo.nome}</span>
          <button onClick={() => setIrPara(true)} className="rounded-lg p-1.5 text-stone-700 hover:bg-stone-100" aria-label="Ir para">
            <Icone nome="busca" tamanho={20} />
          </button>
        </div>
      </header>

      {modulo.id === 'rh' && (
        <div className="sticky top-[57px] z-20 border-b border-stone-200 bg-[#f6f5f3]/95 backdrop-blur lg:top-0 print:hidden">
          <div className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-4 py-2">
            <span className="mr-2 hidden text-sm font-bold lg:inline">Departamento Pessoal</span>
            {abasRh.map((a) => (
              <button
                key={a.id}
                onClick={() => ir('rh/' + a.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  abaRh === a.id ? 'bg-carvao text-white' : 'text-stone-600 hover:bg-stone-200'
                }`}
              >
                {a.nome}
                {'emBreve' in a && <span className="h-1.5 w-1.5 rounded-full bg-ozzy-500" title="Em breve" />}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-5 pb-12">
        {ATALHOS_OPERACAO.includes(modulo.id) && <AtalhosOperacao destinos={destinos.filter((d) => ATALHOS_OPERACAO.includes(d.caminho.split('/')[0]))} atual={caminhoDe(modulo.id, abaAtiva(modulo.id))} />}
        {conteudo}
      </main>
      <IrPara destinos={destinos} aberto={irPara} aoFechar={() => setIrPara(false)} />
    </div>
  )
}

