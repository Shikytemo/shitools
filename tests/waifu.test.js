import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError } from '../src/errors.js'
import { listWaifuCategories, waifuImage } from '../src/waifu.js'

const mockResponse = (body, init = {}) => ({
	ok: init.ok ?? true,
	status: init.status ?? 200,
	statusText: init.statusText ?? 'OK',
	url: init.url ?? 'https://example.com/',
	headers: new Headers(init.headers ?? {}),
	text: async () => JSON.stringify(body)
})

describe('waifuImage', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('returns sfw image with category', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse({ url: 'https://i.waifu.pics/abc.png' }))
		)
		const img = await waifuImage('waifu')
		expect(img.url).toContain('waifu.pics')
		expect(img.type).toBe('sfw')
		expect(img.category).toBe('waifu')
	})

	it('rejects unknown category', async () => {
		await expect(waifuImage('nope')).rejects.toBeInstanceOf(InvalidInputError)
	})
})

describe('listWaifuCategories', () => {
	it('returns sfw and nsfw lists', () => {
		const out = listWaifuCategories()
		expect(out.sfw).toContain('waifu')
		expect(out.nsfw.length).toBeGreaterThan(0)
	})
})
