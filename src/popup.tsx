import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Bookmark, Check, ExternalLink, Folder, Plus } from 'lucide-react'
import { getSpaces, saveSpaces, type Space } from './lib/bookmarks'
import './popup.css'

type CurrentTab = { title: string; url: string; favIconUrl?: string }

const colors = ['#d98a70', '#7d9dce', '#68a598', '#c39a5a', '#9a7fbc']

function Popup() {
  const [spaces, setSpaces] = useState<Space[]>([])
  const [tab, setTab] = useState<CurrentTab | null>(null)
  const [spaceId, setSpaceId] = useState('')
  const [collectionId, setCollectionId] = useState('')
  const [title, setTitle] = useState('')
  const [saved, setSaved] = useState('')

  useEffect(() => {
    document.documentElement.dataset.theme = localStorage.getItem('prism-theme') === 'light' ? 'light' : 'dark'
  }, [])

  useEffect(() => {
    void getSpaces().then((saved) => {
      setSpaces(saved)
      const first = saved[0]
      setSpaceId(first?.id ?? '')
      setCollectionId(first?.collections[0]?.id ?? '')
    })
  }, [])

  useEffect(() => {
    // chrome.* is absent on the dev server; the save panel degrades to a hint there.
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) return
    void chrome.tabs.query({ active: true, currentWindow: true }).then(([active]) => {
      if (!active?.url) return
      setTab({ title: active.title ?? active.url, url: active.url, favIconUrl: active.favIconUrl })
      setTitle(active.title ?? active.url)
    })
  }, [])

  const activeSpace = spaces.find((space) => space.id === spaceId)
  const collections = activeSpace?.collections ?? []
  const canSave = Boolean(tab && title.trim() && collectionId)

  function selectSpace(id: string) {
    setSpaceId(id)
    const next = spaces.find((space) => space.id === id)
    setCollectionId(next?.collections[0]?.id ?? '')
  }

  function openDashboard() {
    if (typeof chrome === 'undefined' || !chrome.tabs?.create) {
      window.open('/index.html', '_blank')
      return
    }
    void chrome.tabs.create({ url: chrome.runtime.getURL('index.html') })
    window.close()
  }

  function saveTab() {
    if (!tab || !canSave) return
    const next = spaces.map((space) => space.id !== spaceId ? space : {
      ...space,
      collections: space.collections.map((collection) => collection.id !== collectionId ? collection : {
        ...collection,
        bookmarks: [...collection.bookmarks, {
          id: crypto.randomUUID(),
          title: title.trim(),
          url: tab.url,
          description: hostname(tab.url),
          color: colors[collection.bookmarks.length % colors.length],
        }],
      }),
    })
    setSpaces(next)
    void saveSpaces(next)
    setSaved(collections.find((collection) => collection.id === collectionId)?.name ?? 'collection')
  }

  return (
    <div className="popup">
      <header className="popup-head">
        <span className="popup-brand"><span className="popup-mark"><Bookmark size={13} fill="currentColor" /></span> Prism</span>
        <button type="button" className="popup-open" onClick={openDashboard}>Open Prism <ExternalLink size={13} /></button>
      </header>

      <section className="popup-save">
        {tab ? <>
          <p className="popup-label">Save this tab</p>
          <div className="popup-tab">
            {tab.favIconUrl ? <img src={tab.favIconUrl} alt="" width="16" height="16" /> : <span className="popup-dot" />}
            <span className="popup-url">{hostname(tab.url)}</span>
          </div>
          <input className="popup-input" value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Title" />
          <div className="popup-selects">
            <select value={spaceId} onChange={(event) => selectSpace(event.target.value)} aria-label="Space">
              {spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
            </select>
            <select value={collectionId} onChange={(event) => setCollectionId(event.target.value)} aria-label="Collection" disabled={collections.length === 0}>
              {collections.length === 0
                ? <option value="">No collections</option>
                : collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
            </select>
          </div>
          {collections.length === 0 && <p className="popup-hint">Create a collection in Prism first.</p>}
          <button type="button" className="popup-save-button" onClick={saveTab} disabled={!canSave}>
            {saved ? <><Check size={14} /> Saved to {saved}</> : <><Plus size={14} /> Add to collection</>}
          </button>
        </> : <p className="popup-hint">No page to save from this tab.</p>}
      </section>

      <section className="popup-list">
        <p className="popup-label">Spaces</p>
        {spaces.map((space) => <div className="popup-space" key={space.id}>
          <div className="popup-space-name">{space.name} <small>{space.collections.length}</small></div>
          {space.collections.length > 0 && <ul>
            {space.collections.map((collection) => <li key={collection.id}>
              <Folder size={12} /> {collection.name} <small>{collection.bookmarks.length}</small>
            </li>)}
          </ul>}
        </div>)}
      </section>
    </div>
  )
}

function hostname(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

createRoot(document.getElementById('root')!).render(<StrictMode><Popup /></StrictMode>)
