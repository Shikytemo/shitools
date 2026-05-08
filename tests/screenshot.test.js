import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError } from '../src/errors.js'
import { fetchScreenshot, getScreenshotUrl } from '../src/screenshot.js'

describe('getScreenshotUrl', () => {
	it('builds the mShots URL with width/height', () => {
		const url = getScreenshotUrl('https://example.com', { width: 1280, height: 720 })
		expect(url).toContain('s.wp.com/mshots/v1/')
		expect(url).toContain('w=1280')
		expect(url).toContain('h=720')
		expect(decodeURIComponent(url)).toContain('https://example.com/')
	})

	it('rejects non-http URLs', () => {
		expect(() => getScreenshotUrl('ftp://x')).toThrow(InvalidInputError)
		expect(() => getScreenshotUrl('not-a-url')).toThrow(InvalidInputError)
	})
})

describe('fetchScreenshot', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('returns bytes once payload exceeds placeholder size', async () => {
		const big = new Uint8Array(8000)
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				status: 200,
				arrayBuffer: async () => big.buffer
			}))
		)
		const bytes = await fetchScreenshot('https://example.com', { attempts: 1 })
		expect(bytes.byteLength).toBe(8000)
	})
})
