// Ficha recém-criada abre direto no editor da composição (a página da ficha lê e apaga a marca).
const CHAVE_ABRIR = 'abrir-composicao'
export function abrirComposicaoDe(id: string) {
  try { sessionStorage.setItem(CHAVE_ABRIR, id) } catch { /* sem sessionStorage */ }
}
export function pegarAbrirComposicao(id: string) {
  try {
    if (sessionStorage.getItem(CHAVE_ABRIR) !== id) return false
    // Apaga depois do render (no modo estrito o React chama o inicializador duas vezes).
    setTimeout(() => sessionStorage.getItem(CHAVE_ABRIR) === id && sessionStorage.removeItem(CHAVE_ABRIR), 0)
    return true
  } catch { return false }
}
