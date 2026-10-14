import { useEffect, useState } from 'react'
import { Bookmark, ChevronDown, FolderPlus, GripVertical, Layers, Moon, Pencil, Plus, Search, Sun, Trash2, X } from 'lucide-react'
import { getSpaces, saveSpaces, type Bookmark as BookmarkItem, type Collection, type Space } from './lib/bookmarks'

type DeleteTarget =
  | { kind: 'space'; id: string; name: string }
  | { kind: 'collection'; id: string; name: string }
  | { kind: 'link'; id: string; collectionId: string; name: string }

type Dialog =
  | { type: 'space' }
  | { type: 'edit-space'; space: Space }
  | { type: 'collection' }
  | { type: 'edit-collection'; collection: Collection }
  | { type: 'link'; collectionId: string }
  | { type: 'edit-link'; collectionId: string; bookmark: BookmarkItem }
  | { type: 'delete'; target: DeleteTarget }
  | null

type DragItem =
  | { kind: 'collection'; id: string }
  | { kind: 'link'; collectionId: string; id: string }
  | null

const deleteNotes = {
  space: 'This also removes every collection and link inside it.',
  collection: 'This also removes every link inside it.',
  link: 'This removes the saved link.',
}

// Chrome's local favicon cache; unavailable outside the packaged extension.
function faviconUrl(pageUrl: string) {
  // Dev-only branch: import.meta.env.DEV is false in builds, so this is stripped from the extension.
  if (import.meta.env.DEV) {
    return `https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(pageUrl)}`
  }
  if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) return ''
  const url = new URL(chrome.runtime.getURL('/_favicon/'))
  url.searchParams.set('pageUrl', pageUrl)
  url.searchParams.set('size', '32')
  return url.toString()
}

function SiteIcon({ bookmark }: { bookmark: BookmarkItem }) {
  const [failed, setFailed] = useState(false)
  const source = failed ? '' : faviconUrl(bookmark.url)
  return <span className={source ? 'site-dot has-icon' : 'site-dot'} style={source ? undefined : { backgroundColor: bookmark.color }}>
    {source ? <img src={source} alt="" width="16" height="16" onError={() => setFailed(true)} /> : bookmark.title.charAt(0)}
  </span>
}

function App() {
  const [spaces, setSpaces] = useState<Space[]>([])
  const [activeSpaceId, setActiveSpaceId] = useState('')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [query, setQuery] = useState('')
  const [collapsedIds, setCollapsedIds] = useState<string[]>([])
  const [drag, setDrag] = useState<DragItem>(null)
  const [dragOverId, setDragOverId] = useState('')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('prism-theme') === 'light' ? 'light' : 'dark'))

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('prism-theme', theme)
  }, [theme])

  useEffect(() => {
    void getSpaces().then((savedSpaces) => {
      setSpaces(savedSpaces)
      setActiveSpaceId(savedSpaces[0]?.id ?? '')
    })
  }, [])

  const activeSpace = spaces.find((space) => space.id === activeSpaceId)

  function updateSpaces(nextSpaces: Space[]) {
    setSpaces(nextSpaces)
    void saveSpaces(nextSpaces)
  }

  function updateActiveCollections(collections: Collection[]) {
    updateSpaces(spaces.map((space) => space.id === activeSpaceId ? { ...space, collections } : space))
  }

  function getTextValue(formData: FormData, field: string) {
    const value = formData.get(field)
    return typeof value === 'string' ? value.trim() : ''
  }

  function toggleCollapsed(id: string) {
    setCollapsedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])
  }

  function endDrag() {
    setDrag(null)
    setDragOverId('')
  }

  // Reorders by id so a filtered view still moves the right item.
  function reorder<T extends { id: string }>(items: T[], fromId: string, toId: string) {
    const from = items.findIndex((item) => item.id === fromId)
    const to = items.findIndex((item) => item.id === toId)
    if (from < 0 || to < 0 || from === to) return items
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    return next
  }

  function dropCollection(targetId: string) {
    if (drag?.kind !== 'collection' || !activeSpace) return
    updateActiveCollections(reorder(activeSpace.collections, drag.id, targetId))
    endDrag()
  }

  function dropLink(collectionId: string, targetId: string) {
    if (drag?.kind !== 'link' || drag.collectionId !== collectionId || !activeSpace) return
    const dragged = drag
    updateActiveCollections(activeSpace.collections.map((collection) => collection.id === collectionId
      ? { ...collection, bookmarks: reorder(collection.bookmarks, dragged.id, targetId) }
      : collection))
    endDrag()
  }

  function removeTarget(target: DeleteTarget) {
    if (target.kind === 'space') {
      const remaining = spaces.filter((space) => space.id !== target.id)
      updateSpaces(remaining)
      if (activeSpaceId === target.id) setActiveSpaceId(remaining[0]?.id ?? '')
      return
    }
    if (!activeSpace) return
    if (target.kind === 'collection') {
      updateActiveCollections(activeSpace.collections.filter((collection) => collection.id !== target.id))
      return
    }
    updateActiveCollections(activeSpace.collections.map((collection) => collection.id === target.collectionId
      ? { ...collection, bookmarks: collection.bookmarks.filter((bookmark) => bookmark.id !== target.id) }
      : collection))
  }

  function submitDialog(formData: FormData) {
    if (!dialog) return
    switch (dialog.type) {
      case 'space': {
        const name = getTextValue(formData, 'spaceName')
        if (!name) return
        const space: Space = { id: crypto.randomUUID(), name, collections: [] }
        updateSpaces([...spaces, space])
        setActiveSpaceId(space.id)
        break
      }
      case 'edit-space': {
        const name = getTextValue(formData, 'spaceName')
        if (!name) return
        updateSpaces(spaces.map((space) => space.id === dialog.space.id ? { ...space, name } : space))
        break
      }
      case 'collection': {
        const name = getTextValue(formData, 'collectionName')
        if (!name || !activeSpace) return
        updateActiveCollections([...activeSpace.collections, { id: crypto.randomUUID(), name, bookmarks: [] }])
        break
      }
      case 'edit-collection': {
        const name = getTextValue(formData, 'collectionName')
        if (!name || !activeSpace) return
        updateActiveCollections(activeSpace.collections.map((collection) => collection.id === dialog.collection.id ? { ...collection, name } : collection))
        break
      }
      case 'link':
      case 'edit-link': {
        if (!activeSpace) return
        const title = getTextValue(formData, 'title')
        const urlValue = getTextValue(formData, 'url')
        const description = getTextValue(formData, 'description') || 'A saved link for later.'
        if (!title || !urlValue) return
        const url = /^https?:\/\//i.test(urlValue) ? urlValue : `https://${urlValue}`
        const edited = dialog.type === 'edit-link' ? dialog.bookmark : null
        updateActiveCollections(activeSpace.collections.map((collection) => {
          if (collection.id !== dialog.collectionId) return collection
          if (edited) {
            return { ...collection, bookmarks: collection.bookmarks.map((bookmark) => bookmark.id === edited.id ? { ...bookmark, title, url, description } : bookmark) }
          }
          const colors = ['#d98a70', '#7d9dce', '#68a598', '#c39a5a', '#9a7fbc']
          return { ...collection, bookmarks: [...collection.bookmarks, { id: crypto.randomUUID(), title, url, description, color: colors[collection.bookmarks.length % colors.length] }] }
        }))
        break
      }
      case 'delete': {
        removeTarget(dialog.target)
        break
      }
    }
    setDialog(null)
  }

  function dialogCopy(current: Exclude<Dialog, null>) {
    switch (current.type) {
      case 'space': return { eyebrow: 'New space', title: 'Name your space', submit: 'Create space' }
      case 'edit-space': return { eyebrow: 'Edit space', title: 'Rename space', submit: 'Save changes' }
      case 'collection': return { eyebrow: activeSpace?.name ?? 'Collection', title: 'Name your collection', submit: 'Create collection' }
      case 'edit-collection': return { eyebrow: 'Edit collection', title: 'Rename collection', submit: 'Save changes' }
      case 'link': return { eyebrow: 'New link', title: 'Save a link', submit: 'Save link' }
      case 'edit-link': return { eyebrow: 'Edit link', title: 'Update link', submit: 'Save changes' }
      case 'delete': return { eyebrow: `Delete ${current.target.kind}`, title: `Delete "${current.target.name}"?`, submit: 'Delete' }
    }
  }

  const editedBookmark = dialog?.type === 'edit-link' ? dialog.bookmark : null
  const isLinkDialog = dialog?.type === 'link' || dialog?.type === 'edit-link'
  const isSpaceDialog = dialog?.type === 'space' || dialog?.type === 'edit-space'
  const copy = dialog ? dialogCopy(dialog) : null

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Bookmark size={17} fill="currentColor" /></span> Prism</div>
        <label className="search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search links" /></label>
        <div className="nav-label">Spaces <button type="button" aria-label="Add space" onClick={() => setDialog({ type: 'space' })}><Plus size={15} /></button></div>
        <nav>{spaces.map((space) => <div key={space.id} className={space.id === activeSpaceId ? 'nav-item active' : 'nav-item'}>
          <button type="button" className="nav-item-main" onClick={() => { setActiveSpaceId(space.id); setQuery('') }}><span className="nav-item-name">{space.name}</span><small>{space.collections.length}</small></button>
          <span className="nav-actions">
            <button type="button" aria-label={`Rename ${space.name}`} onClick={() => setDialog({ type: 'edit-space', space })}><Pencil size={13} /></button>
            <button type="button" aria-label={`Delete ${space.name}`} onClick={() => setDialog({ type: 'delete', target: { kind: 'space', id: space.id, name: space.name } })}><Trash2 size={13} /></button>
          </span>
        </div>)}</nav>
        <div className="sidebar-footer"><span className="avatar">SB</span><span>Saved by you</span><button type="button" className="theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</button></div>
      </aside>

      <section className="workspace">
        <header className="topbar"><div><p className="eyebrow">Space</p><h1>{activeSpace?.name ?? 'Loading...'}</h1></div><button className="primary-button" type="button" onClick={() => setDialog({ type: 'collection' })}><FolderPlus size={17} /> New collection</button></header>
        <div className="collection-rows">
          {activeSpace?.collections.map((collection) => {
            const bookmarks = collection.bookmarks.filter((bookmark) => `${bookmark.title} ${bookmark.description}`.toLowerCase().includes(query.toLowerCase()))
            const collapsed = collapsedIds.includes(collection.id)
            const movingRow = drag?.kind === 'collection' && drag.id === collection.id
            const rowTarget = drag?.kind === 'collection' && !movingRow && dragOverId === collection.id
            return <section
              className={`collection-row${movingRow ? ' dragging' : ''}${rowTarget ? ' drag-over' : ''}`}
              key={collection.id}
              id={collection.id}
              onDragOver={(event) => { if (drag?.kind === 'collection') { event.preventDefault(); setDragOverId(collection.id) } }}
              onDrop={(event) => { if (drag?.kind === 'collection') { event.preventDefault(); dropCollection(collection.id) } }}
            >
              <div className="row-heading">
                <div><h2><button type="button" className="row-toggle" aria-expanded={!collapsed} onClick={() => toggleCollapsed(collection.id)}>{collection.name} <ChevronDown size={16} /></button></h2><p>{bookmarks.length} saved {bookmarks.length === 1 ? 'link' : 'links'}</p></div>
                <div className="row-actions">
                  <button className="icon-button grip" type="button" aria-label={`Reorder ${collection.name}`} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; setDrag({ kind: 'collection', id: collection.id }) }} onDragEnd={endDrag}><GripVertical size={14} /></button>
                  <button className="row-add-button" type="button" onClick={() => setDialog({ type: 'link', collectionId: collection.id })}><Plus size={16} /> Add link</button>
                  <button className="icon-button" type="button" aria-label={`Rename ${collection.name}`} onClick={() => setDialog({ type: 'edit-collection', collection })}><Pencil size={14} /></button>
                  <button className="icon-button" type="button" aria-label={`Delete ${collection.name}`} onClick={() => setDialog({ type: 'delete', target: { kind: 'collection', id: collection.id, name: collection.name } })}><Trash2 size={14} /></button>
                </div>
              </div>
              {!collapsed && (bookmarks.length > 0 ? <div className="bookmark-grid">{bookmarks.map((bookmark) => {
                const movingCard = drag?.kind === 'link' && drag.id === bookmark.id
                const cardTarget = drag?.kind === 'link' && drag.collectionId === collection.id && !movingCard && dragOverId === bookmark.id
                return <div
                  className={`card-wrap${movingCard ? ' dragging' : ''}${cardTarget ? ' drag-over' : ''}`}
                  key={bookmark.id}
                  draggable
                  onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.effectAllowed = 'move'; setDrag({ kind: 'link', collectionId: collection.id, id: bookmark.id }) }}
                  onDragEnd={endDrag}
                  onDragOver={(event) => { if (drag?.kind === 'link' && drag.collectionId === collection.id) { event.preventDefault(); event.stopPropagation(); setDragOverId(bookmark.id) } }}
                  onDrop={(event) => { if (drag?.kind === 'link' && drag.collectionId === collection.id) { event.preventDefault(); event.stopPropagation(); dropLink(collection.id, bookmark.id) } }}
                >
                  <a className="bookmark-card" draggable={false} href={bookmark.url} target="_blank" rel="noreferrer" title={bookmark.description}><span className="card-head"><SiteIcon bookmark={bookmark} /><span className="card-title">{bookmark.title}</span></span><span className="card-foot">{bookmark.description}</span></a>
                  <span className="card-actions">
                    <button type="button" aria-label={`Edit ${bookmark.title}`} onClick={() => setDialog({ type: 'edit-link', collectionId: collection.id, bookmark })}><Pencil size={13} /></button>
                    <button type="button" aria-label={`Delete ${bookmark.title}`} onClick={() => setDialog({ type: 'delete', target: { kind: 'link', id: bookmark.id, collectionId: collection.id, name: bookmark.title } })}><Trash2 size={13} /></button>
                  </span>
                </div>
              })}</div> : <div className="row-empty"><Bookmark size={19} /> No matching links in this collection.</div>)}
            </section>
          })}
          {activeSpace?.collections.length === 0 && <div className="row-empty"><Layers size={19} /> No collections in this space yet.</div>}
        </div>
      </section>

      {dialog && copy && <div className="modal-backdrop">
        <form className="modal" action={submitDialog}>
          <button className="modal-close" type="button" aria-label="Close dialog" onClick={() => setDialog(null)}><X size={18} /></button>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
          {dialog.type === 'delete' ? <>
            <p className="modal-note">{deleteNotes[dialog.target.kind]}</p>
            <button className="primary-button submit danger" type="submit"><Trash2 size={16} /> {copy.submit}</button>
          </> : <>
            {isLinkDialog ? <>
              <label>Title<input name="title" required defaultValue={editedBookmark?.title} placeholder="What is this link?" /></label>
              <label>URL<input name="url" type="url" required defaultValue={editedBookmark?.url} placeholder="https://example.com" /></label>
              <label>Description<input name="description" defaultValue={editedBookmark?.description} placeholder="A short reminder for later" /></label>
            </> : isSpaceDialog
              ? <label>Space name<input name="spaceName" required defaultValue={dialog.type === 'edit-space' ? dialog.space.name : undefined} placeholder="e.g. Work" /></label>
              : <label>Collection name<input name="collectionName" required defaultValue={dialog.type === 'edit-collection' ? dialog.collection.name : undefined} placeholder="e.g. Weekend ideas" /></label>}
            <button className="primary-button submit" type="submit"><Plus size={16} /> {copy.submit}</button>
          </>}
        </form>
      </div>}
    </main>
  )
}

export default App
