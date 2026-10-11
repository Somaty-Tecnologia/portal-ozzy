import { useMemo, useState, type ReactNode } from 'react'

// Classificar tabelas pelo cabeçalho (Heitor, 11/10): clique na coluna ordena (A→Z, menor→maior);
// clique de novo inverte. Vazio fica sempre por último.
type Valor = string | number | boolean | null | undefined
export type Colunas<T> = Record<string, (x: T) => Valor>

const comparar = (a: Valor, b: Valor) => {
  if (a === b) return 0
  if (a === null || a === undefined || a === '') return 1
  if (b === null || b === undefined || b === '') return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' })
}

export function useOrdem<T>(lista: T[], colunas: Colunas<T>, inicial: { col: string; desc?: boolean }) {
  const [ordem, setOrdem] = useState(inicial)
  const pegar = colunas[ordem.col] ?? colunas[inicial.col]
  const ordenada = useMemo(() => {
    const r = [...lista].sort((x, y) => {
      const a = pegar(x)
      const b = pegar(y)
      // Vazio por último nos dois sentidos.
      if ((a === null || a === undefined || a === '') !== (b === null || b === undefined || b === '')) return comparar(a, b)
      return ordem.desc ? comparar(b, a) : comparar(a, b)
    })
    return r
  }, [lista, pegar, ordem.desc])
  const cabecalho = (col: string, rotulo: ReactNode, className = '', desc = false) => {
    const ativo = ordem.col === col
    return (
      <th className={`px-3 py-2 font-semibold ${className}`} aria-sort={ativo ? (ordem.desc ? 'descending' : 'ascending') : 'none'}>
        <button type="button" onClick={() => setOrdem(ativo ? { col, desc: !ordem.desc } : { col, desc })}
          className={`inline-flex items-center gap-1 hover:text-carvao ${ativo ? 'text-carvao' : ''}`}>
          {rotulo}
          <span className={`text-[10px] ${ativo ? '' : 'opacity-30'}`}>{ativo ? (ordem.desc ? '▼' : '▲') : '↕'}</span>
        </button>
      </th>
    )
  }
  return { ordenada, cabecalho }
}
