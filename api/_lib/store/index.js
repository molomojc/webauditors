import fs from 'node:fs/promises'
import path from 'node:path'
import { createFileStore } from './file.js'
import { createMemoryStore } from './memory.js'

// The store is chosen by environment:
//   STORE=file      (default) JSON file under STORE_DIR or ./.data
//   STORE=memory    in-process only, for tests
//   STORE=postgres  requires DATABASE_URL and the optional `pg` dependency
//
// The file store keeps a dev server honest: a run survives a restart. It is not
// durable on serverless, where each instance has its own filesystem, so a
// production deployment must set DATABASE_URL.

export function createStore(options = {}) {
  const kind = options.kind ?? process.env.STORE ?? 'file'

  if (kind === 'memory') return createMemoryStore()
  if (kind === 'postgres') return createPostgresStore(options)

  return createFileStore({
    dir:
      options.dir ??
      process.env.STORE_DIR ??
      path.join(process.cwd(), '.data'),
  })
}

async function createPostgresStore(options) {
  const { createPostgresClient } = await import('./postgres.js')
  return createPostgresClient(options)
}

let singleton = null

export async function getStore() {
  if (!singleton) {
    singleton = createStore()
    await singleton.init()
  }
  return singleton
}

// Tests need a clean store between cases.
export function resetStore() {
  singleton = null
}

export async function ensureStoreDirectory(dir) {
  await fs.mkdir(dir, { recursive: true })
}
