// Captures Chrome Web Store listing screenshots (1280x800 JPEG, no alpha).
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const URL = process.env.PRISM_URL ?? 'http://127.0.0.1:4173/'
const OUT = 'screenshots'

// Demo content so the listing shots show a populated board.
const demoSpaces = [
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
          { id: 'a4', title: 'Dribbble', description: 'Visual explorations from the design community.', url: 'https://dribbble.com/', color: '#9a7fbc' },
          { id: 'a5', title: 'Fonts In Use', description: 'Typography documented in the real world.', url: 'https://fontsinuse.com/', color: '#68a598' },
        ],
      },
      {
        id: 'reading',
        name: 'Reading room',
        bookmarks: [
          { id: 'b1', title: 'The Browser', description: 'Five outstanding articles, handpicked each day.', url: 'https://thebrowser.com/', color: '#68a598' },
          { id: 'b2', title: 'Aeon', description: 'Ideas that challenge the way we see the world.', url: 'https://aeon.co/', color: '#9a7fbc' },
          { id: 'b3', title: 'Longreads', description: 'The best longform storytelling on the web.', url: 'https://longreads.com/', color: '#d98a70' },
          { id: 'b4', title: 'Works in Progress', description: 'Essays on science, progress and ideas.', url: 'https://worksinprogress.co/', color: '#7d9dce' },
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
        name: 'Daily tools',
        bookmarks: [
          { id: 'c1', title: 'Excalidraw', description: 'A virtual whiteboard for sketching ideas together.', url: 'https://excalidraw.com/', color: '#e0a45c' },
          { id: 'c2', title: 'Raycast', description: 'A collection of powerful everyday productivity tools.', url: 'https://www.raycast.com/', color: '#d67b84' },
          { id: 'c3', title: 'Linear', description: 'Issue tracking that stays out of the way.', url: 'https://linear.app/', color: '#7d9dce' },
        ],
      },
      {
        id: 'engineering',
        name: 'Engineering',
        bookmarks: [
          { id: 'd1', title: 'MDN Web Docs', description: 'The reference for web platform APIs.', url: 'https://developer.mozilla.org/', color: '#68a598' },
          { id: 'd2', title: 'Chrome for Developers', description: 'Extension and platform documentation.', url: 'https://developer.chrome.com/', color: '#c39a5a' },
          { id: 'd3', title: 'Can I Use', description: 'Browser support tables for modern features.', url: 'https://caniuse.com/', color: '#9a7fbc' },
        ],
      },
    ],
  },
]

function seed(spaces) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('prism-bookmarks', 2)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('spaces')) {
        request.result.createObjectStore('spaces', { keyPath: 'id' })
      }
    }
    request.onsuccess = () => {
      const database = request.result
      const transaction = database.transaction('spaces', 'readwrite')
      const store = transaction.objectStore('spaces')
      store.clear()
      spaces.forEach((space) => store.put(space))
      transaction.oncomplete = () => { database.close(); resolve('seeded') }
      transaction.onerror = () => reject(transaction.error)
    }
    request.onerror = () => reject(request.error)
  })
}

mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
const page = await context.newPage()

await page.goto(URL, { waitUntil: 'networkidle' })
await page.evaluate(seed, demoSpaces)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.collection-row')

const shot = async (name) => {
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 92 })
  console.log(`${OUT}/${name}.jpg`)
}

await shot('01-dashboard-dark')

await page.hover('#design .row-heading')
await shot('02-manage-collections')

await page.click('#design .row-add-button')
await page.waitForSelector('.modal')
await page.fill('input[name="title"]', 'Interaction Design Foundation')
await page.fill('input[name="url"]', 'https://www.interaction-design.org')
await page.fill('input[name="description"]', 'Courses and literature on UX fundamentals.')
await shot('03-save-a-link')
await page.click('.modal-close')

await page.click('nav .nav-item:nth-child(2) .nav-item-main')
await page.mouse.move(640, 700)
await shot('04-work-space')
await page.click('nav .nav-item:nth-child(1) .nav-item-main')

await page.click('.theme-toggle')
await page.mouse.move(640, 760)
await shot('05-light-theme')

await browser.close()
