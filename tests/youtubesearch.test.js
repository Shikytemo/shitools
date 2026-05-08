import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError } from '../src/errors.js'
import { searchYoutube } from '../src/youtubesearch.js'

const mockResponse = (body, init = {}) => ({
	ok: init.ok ?? true,
	status: init.status ?? 200,
	statusText: init.statusText ?? 'OK',
	url: init.url ?? 'https://example.com/',
	headers: new Headers(init.headers ?? {}),
	text: async () => JSON.stringify(body)
})

describe('searchYoutube', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('parses Piped items', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				mockResponse({
					items: [
						{
							url: '/watch?v=dQw4w9WgXcQ',
							title: 'Never Gonna Give You Up',
							uploaderName: 'Rick Astley',
							thumbnail: 'https://i.ytimg.com/r.jpg',
							duration: 213,
							views: 1500000000,
							uploadedDate: '2009-10-25'
						}
					]
				})
			)
		)
		const out = await searchYoutube('rick astley', { limit: 1 })
		expect(out).toHaveLength(1)
		expect(out[0].id).toBe('dQw4w9WgXcQ')
		expect(out[0].url).toContain('youtube.com')
		expect(out[0].duration).toBe('3:33')
	})

	it('throws InvalidInputError on empty query', async () => {
		await expect(searchYoutube('')).rejects.toBeInstanceOf(InvalidInputError)
	})
})
