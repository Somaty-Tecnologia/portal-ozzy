// Diminui a foto antes de mandar (celular tira 4–12 MB): lado maior até `max` px, JPEG. Se o navegador não
// conseguir ler (ex.: HEIC fora do iPhone), manda a original.
export async function reduzirFoto(arquivo: File, max = 1600): Promise<Blob> {
  try {
    const img = await createImageBitmap(arquivo)
    const escala = Math.min(1, max / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * escala)
    c.height = Math.round(img.height * escala)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.82))
    return blob ?? arquivo
  } catch {
    return arquivo
  }
}
