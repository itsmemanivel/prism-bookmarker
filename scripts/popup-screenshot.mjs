// Captures the action popup composited over the dashboard, as Chrome renders it.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const URL = process.env.PRISM_URL ?? 'http://127.0.0.1:4173/'

const demoSpaces = [
  {
    id: 'personal',
    name: 'Personal',
    collections: [
      {
        id: 'design',
        name: 'Design references',
        bookmarks: [
          { id: 'a1', title: 'Awwwards', description: 'awwwards.com', url: 'https://www.awwwards.com/', color: '#d98a70' },
          { id: 'a2', title: 'Mobbin', description: 'mobbin.com', url: 'https://mobbin.com/', color: '#7d9dce' },
          { id: 'a3', title: 'Typewolf', description: 'typewolf.com', url: 'https://www.typewolf.com/', color: '#c39a5a' },
          { id: 'a4', title: 'Dribbble', description: 'dribbble.com', url: 'https://dribbble.com/', color: '#9a7fbc' },
        ],
      },
      {
        id: 'reading',
        name: 'Reading room',
        bookmarks: [
          { id: 'b1', title: 'The Browser', description: 'thebrowser.com', url: 'https://thebrowser.com/', color: '#68a598' },
          { id: 'b2', title: 'Aeon', description: 'aeon.co', url: 'https://aeon.co/', color: '#9a7fbc' },
          { id: 'b3', title: 'Longreads', description: 'longreads.com', url: 'https://longreads.com/', color: '#d98a70' },
        ],
      },
    ],
  },
  {
    id: 'work',
    name: 'Work',
    collections: [
      { id: 'tools', name: 'Daily tools', bookmarks: [{ id: 'c1', title: 'Excalidraw', description: 'excalidraw.com', url: 'https://excalidraw.com/', color: '#e0a45c' }] },
      { id: 'eng', name: 'Engineering', bookmarks: [{ id: 'd1', title: 'MDN Web Docs', description: 'developer.mozilla.org', url: 'https://developer.mozilla.org/', color: '#68a598' }] },
    ],
  },
]

mkdirSync('screenshots', { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })

// Stand in for the extension APIs so the popup shows a real "save this tab" state.
await context.addInitScript(() => {
  window.chrome = {
    tabs: {
      query: async () => [{
        title: 'Using IndexedDB - Web APIs | MDN',
        url: 'https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API',
        favIconUrl: 'https://developer.mozilla.org/favicon.ico',
      }],
      create: () => {},
    },
    runtime: { getURL: (path) => new URL(path, location.origin).toString() },
  }
})

// The real _favicon endpoint only exists inside the extension; redirect so the
// browser fetches the icon with its own network stack.
await context.route(/_favicon/, async (route) => {
  try {
    const pageUrl = new URL(route.request().url()).searchParams.get('pageUrl')
    const domain = new URL(pageUrl).hostname
    route.fulfill({ status: 302, headers: { location: `https://www.google.com/s2/favicons?sz=32&domain=${domain}` } })
  } catch {
    route.abort()
  }
})

const page = await context.newPage()
await page.goto(`${URL}index.html`, { waitUntil: 'networkidle' })

await page.evaluate((spaces) => new Promise((done) => {
  const request = indexedDB.open('prism-bookmarks', 2)
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains('spaces')) request.result.createObjectStore('spaces', { keyPath: 'id' })
  }
  request.onsuccess = () => {
    const database = request.result
    const transaction = database.transaction('spaces', 'readwrite')
    const store = transaction.objectStore('spaces')
    store.clear()
    spaces.forEach((space) => store.put(space))
    transaction.oncomplete = () => { database.close(); done() }
  }
}), demoSpaces)

await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.bookmark-card')

// Overlay the popup where Chrome anchors it, under the toolbar on the right.
await page.evaluate(() => {
  const frame = document.createElement('iframe')
  frame.src = 'popup.html'
  frame.style.cssText = [
    'position:fixed', 'top:14px', 'right:18px', 'width:340px', 'height:470px',
    'border:1px solid rgba(0,0,0,.35)', 'border-radius:10px', 'z-index:9999',
    'box-shadow:0 18px 50px rgba(0,0,0,.45)', 'background:transparent',
  ].join(';')
  document.body.appendChild(frame)
})

await page.waitForTimeout(2500)
await page.screenshot({ path: 'screenshots/06-save-current-tab.jpg', type: 'jpeg', quality: 92 })
console.log('screenshots/06-save-current-tab.jpg')

await browser.close()
