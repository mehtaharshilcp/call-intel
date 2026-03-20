/** Lets React Query refetch after IndexedDB writes (no backend push). */
export function notifyIndexedDbUpdate(): void {
  window.dispatchEvent(new Event('callintel-db-update'))
}
