// Compression gzip d'un corps JSON dans le navigateur (CompressionStream).
// 10 000 polygones ≈ 10 Mo de JSON → ≈ 3 Mo compressés : essentiel sur réseau mobile.
// Navigateurs trop anciens : envoi non compressé.
export async function gzipJson(value: unknown): Promise<{ body: Blob | string; gzip: boolean }> {
  const json = JSON.stringify(value)
  if (typeof CompressionStream === 'undefined') return { body: json, gzip: false }
  try {
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))
    const body = await new Response(stream).blob()
    return { body, gzip: true }
  } catch {
    return { body: json, gzip: false }
  }
}
