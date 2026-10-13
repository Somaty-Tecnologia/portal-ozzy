import type { IdIcone } from '../lib/modulos'

// Ícones de traço simples, desenhados à mão para não depender de biblioteca.
const CAMINHOS: Record<IdIcone | 'menu' | 'relogio' | 'pedidos' | 'avaliacoes' | 'busca', string> = {
  inicio: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  rh: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6M20 19v-1.5a3.5 3.5 0 0 0-2.5-3.4M15.5 4.6a3 3 0 0 1 0 5.8',
  freelancers: 'M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M4 19v-1.5A3.5 3.5 0 0 1 7.5 14h5M15 15h6M18 12v6',
  motoboys: 'M8 17a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0M21 17a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0M8 17h8M14 6h3l1.5 8.5M5 14l2-4h7l2 7',
  producao: 'M5 11h14v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1zM3 11h18M9 7c0-1.5 1-2 1-3M13 7c0-1.5 1-2 1-3M17 15h3',
  fechamento: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M8 11h8M8 15h5',
  fichas: 'M6 14a4 4 0 0 1 .9-7.9A5 5 0 0 1 17.1 6.1 4 4 0 0 1 18 14v6H6zM6 17h12',
  financeiro: 'M4 19V9M10 19V5M16 19v-7M3 19h18',
  cadastros: 'M5 4h11l3 3v13H5zM8 9h8M8 13h8M8 17h5',
  compras: 'M3 4h2l2.4 11h11.2L21 8H6.2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2M18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2',
  estoque: 'M3 8l9-4 9 4-9 4zM3 8v8l9 4 9-4V8M12 12v8',
  checklists: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  regras: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7',
  treinamentos: 'M3 5h18v12H3zM10 9v4l4-2zM8 21h8',
  manutencao: 'M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.3 2.3-2.4-.6-.6-2.4z',
  eventos: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  menu: 'M4 7h16M4 12h16M4 17h16',
  refeicoes: 'M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M2 4v5a1.5 1.5 0 0 0 3 0V4M3.5 9v11M22 20V4c-1.5 0-2.5 2-2.5 5s1 4 2.5 4',
  busca: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M20 20l-4-4',
  relogio: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2',
  pedidos: 'M6 3h12l1 18H5zM9 7a3 3 0 0 0 6 0',
  avaliacoes: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
}

export default function Icone({ nome, tamanho = 20 }: { nome: keyof typeof CAMINHOS; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={CAMINHOS[nome]} />
    </svg>
  )
}
