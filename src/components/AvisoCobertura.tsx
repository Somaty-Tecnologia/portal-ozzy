import { ir } from '../lib/rota'

// Aviso de quanto das vendas tem ficha (o que fica fora não entra no ideal nem nas compras).
export default function AvisoCobertura({ porcento, semFicha }: { porcento: number; semFicha: number }) {
  if (!semFicha) return <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">Todos os produtos vendidos têm ficha: a conta pega 100% das vendas.</p>
  return (
    <p className={`rounded-xl px-3 py-2 text-sm ring-1 ${porcento >= 95 ? 'bg-stone-50 text-stone-700 ring-stone-200' : 'bg-amber-50 text-amber-900 ring-amber-200'}`}>
      A conta pega <b>{String(porcento).replace('.', ',')}%</b> dos itens vendidos. {semFicha} {semFicha === 1 ? 'produto vendido está' : 'produtos vendidos estão'} sem ficha e {semFicha === 1 ? 'fica' : 'ficam'} de fora:{' '}
      <button className="font-semibold underline" onClick={() => ir('producao/vendas')}>ver e resolver</button>.
    </p>
  )
}
