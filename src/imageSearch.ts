export type ImageSearchResult = {
  id: string
  title: string
  thumbnailUrl: string
  imageUrl: string
  pageUrl: string
  creator: string
  creatorUrl?: string
  license: string
  licenseUrl?: string
}

export type EmbeddedImage = {
  dataUrl: string
  alt: string
  title: string
  pageUrl?: string
  creator?: string
  creatorUrl?: string
  license?: string
  licenseUrl?: string
}

const safeUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function plainMetadata(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/<br\s*\/?>/gi, ' ').replace(/<\/(?:p|div|li)>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim()
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`Image search failed (${response.status}).`)
  return response.json() as Promise<T>
}

async function searchWikimedia(query: string, signal: AbortSignal): Promise<ImageSearchResult[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: '6',
    gsrlimit: '24',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '640',
    format: 'json',
    origin: '*',
  })
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { signal })
  const data = await readJson<{ query?: { pages?: Record<string, { pageid: number; title: string; imageinfo?: Array<{ thumburl?: string; url?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }> }> } }>(response)
  return Object.values(data.query?.pages ?? []).flatMap((page) => {
    const image = page.imageinfo?.[0]
    const thumbnailUrl = safeUrl(image?.thumburl)
    const imageUrl = safeUrl(image?.url)
    const pageUrl = safeUrl(image?.descriptionurl)
    if (!thumbnailUrl || !imageUrl || !pageUrl) return []
    const metadata = image?.extmetadata ?? {}
    return [{
      id: String(page.pageid),
      title: plainMetadata(metadata.ObjectName?.value) || page.title.replace(/^File:/, ''),
      thumbnailUrl,
      imageUrl,
      pageUrl,
      creator: plainMetadata(metadata.Artist?.value) || plainMetadata(metadata.Credit?.value) || 'Wikimedia Commons contributor',
      license: plainMetadata(metadata.LicenseShortName?.value) || plainMetadata(metadata.UsageTerms?.value) || 'See file page',
      licenseUrl: safeUrl(metadata.LicenseUrl?.value),
    }]
  })
}

export async function searchImages(query: string, signal: AbortSignal): Promise<ImageSearchResult[]> {
  const cleanQuery = query.trim()
  if (!cleanQuery) return []
  return searchWikimedia(cleanQuery, signal)
}

export async function storeImageLocally(blob: Blob): Promise<string> {
  if (!blob.type.startsWith('image/')) throw new Error('The selected file is not an image.')
  if (blob.size > 20 * 1024 * 1024) throw new Error('Choose an image smaller than 20 MB.')
  const image = await createImageBitmap(blob)
  try {
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Your browser could not prepare the image.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const compressed = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Your browser could not convert the image.')), 'image/webp', 0.84)
    })
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Your browser could not read the image.'))
      reader.onerror = () => reject(new Error('Your browser could not read the image.'))
      reader.readAsDataURL(compressed)
    })
  } finally {
    image.close()
  }
}

export async function selectImage(result: ImageSearchResult): Promise<EmbeddedImage> {
  const response = await fetch(result.imageUrl)
  if (!response.ok) throw new Error(`Could not download this image (${response.status}).`)
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > 20 * 1024 * 1024) throw new Error('This image is larger than 20 MB and cannot be added.')
  const dataUrl = await storeImageLocally(await response.blob())
  return {
    dataUrl,
    alt: result.title,
    title: result.title,
    pageUrl: result.pageUrl,
    creator: result.creator,
    creatorUrl: result.creatorUrl,
    license: result.license,
    licenseUrl: result.licenseUrl,
  }
}
