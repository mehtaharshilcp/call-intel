/** All persistence is IndexedDB (Dexie). Groq is proxied in dev (see vite.config.ts). */
export { localApi as api } from './lib/localApi'

export const apiUsesBlobAudio = true
