import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ParseError, ScrapeError } from '../src/errors.js'
import { getLyrics, lyrics, searchLyrics } from '../src/lyrics.js'

const mockResponse = (body, init = {}) => ({
	ok: init.ok ?? true,
	status: init.status ?? 200,
	statusText: init.statusText ?? 'OK',
	url: init.url ?? 'https://example.com/',
	headers: new Headers(init.headers ?? {}),
	text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
})

const GENIUS_FIXTURE = {
	meta: { status: 200 },
	response: {
		sections: [
			{
				type: 'song',
				hits: [
					{
						type: 'song',
						result: {
							id: 4665269,
							title: 'Someone You Loved',
							full_title: 'Someone You Loved by\u00a0Lewis Capaldi',
							primary_artist: { name: 'Lewis Capaldi' },
							url: 'https://genius.com/Lewis-capaldi-someone-you-loved-lyrics',
							song_art_image_thumbnail_url: 'https://images.genius.com/abc.jpg',
							release_date_for_display: 'November 8, 2018'
						}
					}
				]
			},
			{
				type: 'lyric',
				hits: [
					{
						type: 'lyric',
						result: { id: 'noop', title: 'lyric snippet' }
					}
				]
			}
		]
	}
}

const LYRICS_FIXTURE = {
	lyrics:
		"I'm going under and this time I fear there's no one to save me\nThis all or nothing way of loving got me sleeping without you"
}

describe('searchLyrics', () => {
	beforeEach(() => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(GENIUS_FIXTURE))
		)
	})
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('returns normalized song hits from Genius', async () => {
		const hits = await searchLyrics('someone you loved')
		expect(hits).toHaveLength(1)
		expect(hits[0]).toMatchObject({
			id: '4665269',
			title: 'Someone You Loved',
			artist: 'Lewis Capaldi',
			url: 'https://genius.com/Lewis-capaldi-someone-you-loved-lyrics',
			thumbnail: 'https://images.genius.com/abc.jpg',
			releaseDate: 'November 8, 2018'
		})
	})

	it('hits Genius with the encoded query', async () => {
		await searchLyrics('lewis capaldi someone you loved')
		const calledUrl = global.fetch.mock.calls[0][0]
		expect(calledUrl).toContain('genius.com/api/search/multi?q=')
		expect(calledUrl).toContain('per_page=10')
	})

	it('throws InvalidInputError on empty query', async () => {
		await expect(searchLyrics('  ')).rejects.toThrow('lyrics query is required')
	})

	it('throws ParseError when Genius returns non-JSON', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse('<html></html>'))
		)
		await expect(searchLyrics('q')).rejects.toBeInstanceOf(ParseError)
	})

	it('returns [] when no song section is present', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse({ response: { sections: [] } }))
		)
		const hits = await searchLyrics('q')
		expect(hits).toEqual([])
	})
})

describe('getLyrics', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('returns lyrics from lyrics.ovh', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(LYRICS_FIXTURE))
		)
		const result = await getLyrics('Lewis Capaldi', 'Someone You Loved')
		expect(result).toMatchObject({
			artist: 'Lewis Capaldi',
			title: 'Someone You Loved',
			source: 'lyrics.ovh'
		})
		expect(result.lyrics.startsWith("I'm going under")).toBe(true)
	})

	it('hits the encoded artist/title path', async () => {
		const fetchMock = vi.fn(async () => mockResponse(LYRICS_FIXTURE))
		vi.stubGlobal('fetch', fetchMock)
		await getLyrics('Lewis Capaldi', 'Someone You Loved')
		const calledUrl = fetchMock.mock.calls[0][0]
		expect(calledUrl).toBe('https://api.lyrics.ovh/v1/Lewis%20Capaldi/Someone%20You%20Loved')
	})

	it('throws InvalidInputError when artist or title missing', async () => {
		await expect(getLyrics('', 'title')).rejects.toThrow('artist is required')
		await expect(getLyrics('artist', '')).rejects.toThrow('title is required')
	})

	it('throws a friendly ScrapeError when lyrics not found (lyrics.ovh 404)', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				mockResponse(
					{ error: 'No lyrics found' },
					{ ok: false, status: 404, statusText: 'Not Found' }
				)
			)
		)
		await expect(
			getLyrics('Unknown Artist', 'Unknown Song', { retries: 0 })
		).rejects.toBeInstanceOf(ScrapeError)
	})

	it('throws ScrapeError when body has no lyrics field', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse({ error: 'No lyrics found' }))
		)
		await expect(getLyrics('a', 'b')).rejects.toThrow(/Lyrics not found|No lyrics/)
	})
})

describe('lyrics dispatch', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('splits "Artist - Title" and calls lyrics.ovh directly', async () => {
		const fetchMock = vi.fn(async () => mockResponse(LYRICS_FIXTURE))
		vi.stubGlobal('fetch', fetchMock)
		const result = await lyrics('Adele - Hello')
		expect(result.artist).toBe('Adele')
		expect(result.title).toBe('Hello')
		expect(fetchMock).toHaveBeenCalledTimes(1)
		expect(fetchMock.mock.calls[0][0]).toContain('api.lyrics.ovh/v1/Adele/Hello')
	})

	it('searches Genius first for inputs without a dash, then fetches lyrics', async () => {
		let callIndex = 0
		const fetchMock = vi.fn(async () => {
			callIndex += 1
			if (callIndex === 1) return mockResponse(GENIUS_FIXTURE)
			return mockResponse(LYRICS_FIXTURE)
		})
		vi.stubGlobal('fetch', fetchMock)
		const result = await lyrics('lewis capaldi someone you loved')
		expect(fetchMock).toHaveBeenCalledTimes(2)
		expect(fetchMock.mock.calls[0][0]).toContain('genius.com/api/search/multi')
		expect(fetchMock.mock.calls[1][0]).toContain('api.lyrics.ovh/v1/Lewis%20Capaldi')
		expect(result.fullTitle).toContain('Lewis Capaldi')
		expect(result.url).toContain('genius.com')
	})

	it('throws when Genius returns no song hits', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse({ response: { sections: [] } }))
		)
		await expect(lyrics('totally made up song')).rejects.toThrow(/No Genius results/)
	})

	it('handles em-dash and en-dash separators', async () => {
		const fetchMock = vi.fn(async () => mockResponse(LYRICS_FIXTURE))
		vi.stubGlobal('fetch', fetchMock)
		await lyrics('Adele \u2014 Hello')
		expect(fetchMock.mock.calls[0][0]).toContain('api.lyrics.ovh/v1/Adele/Hello')
	})
})
