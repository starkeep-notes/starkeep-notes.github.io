import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchImages } from './imageSearch'

describe('image provider search', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('searches Wikimedia Commons without credentials and keeps license attribution metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      query: { pages: { 42: {
        pageid: 42,
        title: 'File:Blue flower.jpg',
        imageinfo: [{
          thumburl: 'https://images.example/thumb.jpg',
          url: 'https://images.example/full.jpg',
          descriptionurl: 'https://commons.wikimedia.org/wiki/File:Blue_flower.jpg',
          extmetadata: { ObjectName: { value: 'Blue flower' }, Artist: { value: '<a href="https://example.com">Artist &amp; Co</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' } },
        }],
      } } },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const images = await searchImages('blue flower', new AbortController().signal)

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('commons.wikimedia.org/w/api.php')
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('gsrsearch=filetype%3Abitmap+blue+flower')
    expect(images[0]).toMatchObject({
      id: '42',
      title: 'Blue flower',
      creator: 'Artist & Co',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    })
  })

  it('reports provider HTTP errors instead of returning empty results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })))
    await expect(searchImages('landscape', new AbortController().signal)).rejects.toThrow('Image search failed (503).')
  })
})
