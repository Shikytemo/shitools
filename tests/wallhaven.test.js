import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError } from '../src/errors.js'
import { searchWallhaven } from '../src/wallhaven.js'

const mockResponse = body => ({
	ok: true,
	status: 200,
	statusText: 'OK',
	url: 'https://example.com/',
	headers: new Headers(),
	text: async () => JSON.stringify(body)
})

const FIXTURE = {
	data: [
		{
			id: 'abc123',
			path: 'https://w.wallhaven.cc/full/abc123.jpg',
			thumbs: { large: 'https://th.wallhaven.cc/lg/abc123.jpg' },
			url: 'https://wallhaven.cc/w/abc123',
			resolution: '1920x1080',
			ratio: '1.78',
			file_size: 1234567,
			category: 'general',
			purity: 'sfw',
			colors: ['#000000', '#ffffff']
		}
	]
}

describe('searchWallhaven', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('returns mapped wallpapers', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(FIXTURE))
		)
		const wallpapers = await searchWallhaven('cyberpunk', { limit: 1 })
		expect(wallpapers).toHaveLength(1)
		expect(wallpapers[0].url).toContain('w.wallhaven.cc/full/abc123.jpg')
		expect(wallpapers[0].resolution).toBe('1920x1080')
		expect(wallpapers[0].fileSize).toBe(1234567)
	})

	it('rejects empty query', async () => {
		await expect(searchWallhaven('')).rejects.toBeInstanceOf(InvalidInputError)
	})
})
