import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError } from '../src/errors.js'
import { getNews, listNewsSources } from '../src/news.js'

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
			title: 'Headline 1',
			link: 'https://news/1',
			contentSnippet: 'snippet',
			image: { large: 'https://img/1.jpg', small: 'https://img/1-s.jpg' },
			isoDate: '2026-05-08T00:00:00Z'
		}
	]
}

describe('news', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('lists sources', () => {
		const sources = listNewsSources()
		expect(sources.length).toBeGreaterThan(0)
		expect(sources[0]).toHaveProperty('id')
		expect(sources[0]).toHaveProperty('label')
	})

	it('returns headlines', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(FIXTURE))
		)
		const items = await getNews('cnn-news')
		expect(items).toHaveLength(1)
		expect(items[0].title).toBe('Headline 1')
		expect(items[0].thumbnail).toContain('img/1.jpg')
	})

	it('rejects unknown source', async () => {
		await expect(getNews('not-a-source')).rejects.toBeInstanceOf(InvalidInputError)
	})
})
