// Alt+S (pedido dele) ou Ctrl+S / Cmd+S salvam a tela (Heitor, 12/10): aperta o botão "Salvar…" visível. Com uma janela aberta,
// vale o botão dela; senão, o da página. Se houver mais de um, o primeiro "Salvar" exato ganha dos outros
// ("Salvar e lançar outra", "Salvar horários"…).
export function ligarAtalhoSalvar() {
  const visivel = (b: HTMLElement) => !!(b.offsetWidth || b.offsetHeight || b.getClientRects().length)
  const ouvir = (e: KeyboardEvent) => {
    // e.code: no Mac, Alt+S vira "ß" em e.key.
    const altS = e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyS'
    const ctrlS = (e.ctrlKey || e.metaKey) && !e.altKey && e.code === 'KeyS'
    if (!altS && !ctrlS) return
    e.preventDefault()
    const janelas = document.querySelectorAll<HTMLElement>('[role=dialog]')
    const onde: ParentNode = janelas.length ? janelas[janelas.length - 1] : document
    const botoes = [...onde.querySelectorAll<HTMLButtonElement>('button')].filter((b) => !b.disabled && visivel(b) && /^\s*Salvar/i.test(b.textContent ?? ''))
    const alvo = botoes.find((b) => /^\s*Salvar\s*$/i.test(b.textContent ?? '')) ?? botoes[0]
    alvo?.click()
  }
  window.addEventListener('keydown', ouvir)
  return () => window.removeEventListener('keydown', ouvir)
}
