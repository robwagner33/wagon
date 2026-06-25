import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadImage } from './sprite'

// A stand-in for the DOM Image: setting `src` fires onload, unless the url is 'fail' (then onerror).
class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  set src(url: string) {
    if (url === 'fail') this.onerror?.()
    else this.onload?.()
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loadImage', () => {
  it('resolves with the image once it has loaded', async () => {
    vi.stubGlobal('Image', FakeImage)
    const img = await loadImage('hero.png')
    expect(img).toBeInstanceOf(FakeImage)
  })

  it('rejects with the url when the image fails to load', async () => {
    vi.stubGlobal('Image', FakeImage)
    await expect(loadImage('fail')).rejects.toThrow('failed to load image: fail')
  })
})
