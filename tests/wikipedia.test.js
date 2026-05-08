import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError } from '../src/errors.js'
import { getWikipediaSummary, searchWikipedia, wikipedia } from '../src/wikipedia.js'

const mockResponse = (body, init = {}) => ({
	ok: init.ok ?? true,
	status: init.status ?? 200,
	statusText: init.statusText ?? 'OK',
	url: init.url ?? 'https://example.com/',
	headers: new Headers(init.headers ?? {}),
	text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
})

const SEARCH_FIXTURE = {
	pages: [
		{
			id: 100,
			key: 'Sukarno',
			title: 'Sukarno',
			description: 'Presiden Indonesia pertama',
			excerpt: 'Sukarno adalah <span>Presiden</span> pertama',
			thumbnail: { url: '//upload.wikimedia.org/sukarno.jpg' }
		}
	]
}

const SUMMARY_FIXTURE = {
	title: 'Sukarno',
	description: 'Presiden Indonesia',
	extract: 'Ir. Sukarno adalah Presiden Indonesia pertama yang menjabat 1945-1967.',
	content_urls: { desktop: { page: 'https://id.wikipedia.org/wiki/Sukarno' } },
	thumbnail: { source: 'https://upload.wikimedia.org/sukarno.jpg' }
}

describe('searchWikipedia', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('returns hits with thumbnail and url', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(SEARCH_FIXTURE))
		)
		const hits = await searchWikipedia('Sukarno')
		expect(hits).toHaveLength(1)
		expect(hits[0].title).toBe('Sukarno')
		expect(hits[0].url).toContain('id.wikipedia.org/wiki/Sukarno')
		expect(hits[0].thumbnail).toBe('https://upload.wikimedia.org/sukarno.jpg')
	})

	it('throws InvalidInputError on empty query', async () => {
		await expect(searchWikipedia('  ')).rejects.toBeInstanceOf(InvalidInputError)
	})
})

describe('getWikipediaSummary', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('returns normalized summary', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(SUMMARY_FIXTURE))
		)
		const result = await getWikipediaSummary('Sukarno')
		expect(result.title).toBe('Sukarno')
		expect(result.extract).toContain('Presiden Indonesia pertama')
		expect(result.url).toContain('id.wikipedia.org')
	})
})

describe('wikipedia dispatch', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('searches then fetches summary of top hit', async () => {
		let calls = 0
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				calls += 1
				return mockResponse(calls === 1 ? SEARCH_FIXTURE : SUMMARY_FIXTURE)
			})
		)
		const result = await wikipedia('Sukarno')
		expect(result.title).toBe('Sukarno')
		expect(result.hits).toHaveLength(1)
	})
})
