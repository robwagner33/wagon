import { watch } from 'node:fs'

/**
 * Watch a file and fire `onChange` once a burst of writes settles — a trailing debounce over `fs.watch`, which
 * emits several events per save (and while an editor writes in bursts). Node-only server/dev infra. Returns a
 * disposer that stops watching and cancels any pending fire. The caller decides what a change means (re-read +
 * reload); this owns only the watch + debounce.
 */
export function watchFileDebounced(path: string, debounceMs: number, onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const watcher = watch(path, () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(onChange, debounceMs)
  })
  return () => {
    if (timer) clearTimeout(timer)
    watcher.close()
  }
}
