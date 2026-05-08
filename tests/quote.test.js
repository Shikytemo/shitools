import { afterEach, describe, expect, it, vi } from 'vitest'

import { ParseError } from '../src/errors.js'
import { randomAnimeQuote, randomQuote } from '../src/quote.js'

const mockResponse = body => ({
	ok: true,
	status: 200,
	statusText: 'OK',
	url: 'https://example.com/',
	headers: new Headers(),
	text: async () => JSON.stringify(body)
})

describe('randomQuote', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('returns content + author', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse([{ q: 'Stay hungry.', a: 'Steve Jobs' }]))
		)
		const q = await randomQuote()
		expect(q.content).toBe('Stay hungry.')
		expect(q.author).toBe('Steve Jobs')
		expect(q.source).toBe('zenquotes.io')
	})

	it('throws ParseError when payload empty', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse([]))
		)
		await expect(randomQuote()).rejects.toBeInstanceOf(ParseError)
	})
})

describe('randomAnimeQuote', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('returns normalized anime quote', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				mockResponse({
					data: { content: 'Believe it!', character: { name: 'Naruto' }, anime: { name: 'Naruto' } }
				})
			)
		)
		const q = await randomAnimeQuote()
		expect(q.content).toBe('Believe it!')
		expect(q.character).toBe('Naruto')
	})
})
