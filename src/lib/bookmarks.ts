export type Bookmark = {
  id: string
  title: string
  description: string
  url: string
  color: string
}

export type Collection = {
  id: string
  name: string
  bookmarks: Bookmark[]
}

export type Space = {
  id: string
  name: string
  collections: Collection[]
}

const databaseName = 'prism-bookmarks'
const storeName = 'spaces'
const legacyStoreName = 'collections'

const seedSpaces: Space[] = [
  {
    id: 'personal',
    name: 'Personal',
    collections: [
      {
        id: 'design',
        name: 'Design references',
        bookmarks: [
          { id: 'a1', title: 'Awwwards', description: 'A showcase of thoughtful digital experiences.', url: 'https://www.awwwards.com/', color: '#d98a70' },
          { id: 'a2', title: 'Mobbin', description: 'Mobile and web UI patterns worth keeping nearby.', url: 'https://mobbin.com/', color: '#7d9dce' },
          { id: 'a3', title: 'Typewolf', description: 'Independent typography inspiration and resources.', url: 'https://www.typewolf.com/', color: '#c39a5a' },
        ],
      },
      {
        id: 'reading',
        name: 'Reading room',
        bookmarks: [
          { id: 'b1', title: 'The Browser', description: 'Five outstanding articles, handpicked each day.', url: 'https://thebrowser.com/', color: '#68a598' },
          { id: 'b2', title: 'Aeon', description: 'Ideas that challenge the way we see the world.', url: 'https://aeon.co/', color: '#9a7fbc' },
        ],
      },
    ],
  },
  {
    id: 'work',
    name: 'Work',
    collections: [
      {
        id: 'tools',
        name: 'Useful tools',
        bookmarks: [
          { id: 'c1', title: 'Excalidraw', description: 'A virtual whiteboard for sketching ideas together.', url: 'https://excalidraw.com/', color: '#e0a45c' },
          { id: 'c2', title: 'Raycast', description: 'A collection of powerful everyday productivity tools.', url: 'https://www.raycast.com/', color: '#d67b84' },
        ],
      },
    ],
  },
]

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 2)
    request.onupgradeneeded = () => {
      const database = request.result
      const transaction = request.transaction
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, { keyPath: 'id' })
      }
      // Collections used to be top level; fold any existing ones into a starter space.
      if (transaction && database.objectStoreNames.contains(legacyStoreName)) {
        const legacy = transaction.objectStore(legacyStoreName).getAll()
        legacy.onsuccess = () => {
          const collections = legacy.result as Collection[]
          if (collections.length > 0) {
            transaction.objectStore(storeName).put({ id: 'my-space', name: 'My Space', collections })
          }
        }
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getSpaces(): Promise<Space[]> {
  const database = await openDatabase()
  const spaces = await new Promise<Space[]>((resolve, reject) => {
    const request = database.transaction(storeName, 'readonly').objectStore(storeName).getAll()
    request.onsuccess = () => resolve(request.result as Space[])
    request.onerror = () => reject(request.error)
  })
  database.close()

  if (spaces.length > 0) return spaces
  await saveSpaces(seedSpaces)
  return seedSpaces
}

export async function saveSpaces(spaces: Space[]): Promise<void> {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    store.clear()
    spaces.forEach((space) => store.put(space))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
}