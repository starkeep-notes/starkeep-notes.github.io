import { useEffect, useRef, useState, type FormEvent } from 'react'
import { searchImages, selectImage, storeImageLocally, type EmbeddedImage, type ImageSearchResult } from './imageSearch'

type Props = { onSelect: (image: EmbeddedImage) => void; onClose: () => void }

export function ImagePicker({ onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ImageSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [addingId, setAddingId] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const searchControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      searchControllerRef.current?.abort()
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose])

  const search = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!query.trim()) return
    searchControllerRef.current?.abort()
    const controller = new AbortController()
    searchControllerRef.current = controller
    setLoading(true)
    setError('')
    try {
      setResults(await searchImages(query, controller.signal))
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Image search failed. Please try again.')
        setResults([])
      }
    } finally {
      if (searchControllerRef.current === controller) setLoading(false)
    }
  }

  const addSearchResult = async (result: ImageSearchResult) => {
    setAddingId(result.id)
    setError('')
    try {
      onSelect(await selectImage(result))
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add this image.')
    } finally {
      setAddingId('')
    }
  }

  const addLocalFile = async (file?: File) => {
    if (!file) return
    setError('')
    try {
      const dataUrl = await storeImageLocally(file)
      onSelect({ dataUrl, alt: file.name.replace(/\.[^.]+$/, ''), title: file.name })
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add this image.')
    }
  }

  return <div className="image-picker-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="image-picker" role="dialog" aria-modal="true" aria-labelledby="image-picker-title">
      <header className="image-picker-header"><div><span className="eyebrow">Local-first images</span><h2 id="image-picker-title">Add an image</h2></div><button type="button" className="editor-close" aria-label="Close image picker" onClick={onClose}>× Close</button></header>
      <div className="image-picker-tabs" role="group" aria-label="Image source">
        <span className="image-picker-source-label">Wikimedia Commons</span>
        <button type="button" onClick={() => fileRef.current?.click()}>Upload from device</button>
        <input ref={fileRef} className="sr-only" type="file" accept="image/*" aria-label="Upload an image from your device" onChange={(event) => { void addLocalFile(event.target.files?.[0]); event.currentTarget.value = '' }} />
      </div>
      <form className="image-picker-search" onSubmit={(event) => { void search(event) }}>
        <label htmlFor="image-search-query">Search images</label>
        <div><input id="image-search-query" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search images" autoFocus /><button type="submit" disabled={loading || !query.trim()}>{loading ? 'Searching…' : 'Search'}</button></div>
      </form>
      <div className="image-picker-external">
        <span>Search elsewhere, then download an image and upload it here:</span>
        <a href={`https://www.bing.com/images/search?q=${encodeURIComponent(query)}`} aria-disabled={!query.trim()} onClick={(event) => { if (!query.trim()) event.preventDefault() }} target="_blank" rel="noreferrer">Bing Images</a>
        <a href={`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`} aria-disabled={!query.trim()} onClick={(event) => { if (!query.trim()) event.preventDefault() }} target="_blank" rel="noreferrer">DuckDuckGo Images</a>
      </div>
      <div className="image-picker-guidance">{error && <p className="image-picker-error" role="alert">{error}</p>}<p className="image-picker-note">Images you add are copied into this notebook and optimized for local storage. Wikimedia search uses your query; external image searches open in a new tab and require downloading and uploading an image. Check its license and attribution before reuse.</p></div>
      <div className="image-picker-results" aria-live="polite">
        {loading && <p role="status">Searching Wikimedia Commons…</p>}
        {!loading && query.trim() && !results.length && !error && <p>No images found. Try another search.</p>}
        {results.map((result) => <article className="image-picker-result" key={`wikimedia-${result.id}`}>
          <img src={result.thumbnailUrl} alt="" loading="lazy" />
          <div className="image-picker-result-meta"><strong>{result.title}</strong><span>{result.creator} · {result.license}</span><a href={result.pageUrl} target="_blank" rel="noreferrer">Source details</a>{result.licenseUrl && <a href={result.licenseUrl} target="_blank" rel="noreferrer">License / usage guidance</a>}</div>
          <button type="button" onClick={() => { void addSearchResult(result) }} disabled={addingId !== ''}>{addingId === result.id ? 'Adding…' : 'Add image'}</button>
        </article>)}
      </div>
    </section>
  </div>
}
