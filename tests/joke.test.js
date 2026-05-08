import { afterEach, describe, expect, it, vi } from 'vitest'

import { ParseError } from '../src/errors.js'
import { randomJoke } from '../src/joke.js'

const mockResponse = body => ({
	ok: true,
	status: 200,
	statusText: 'OK',
	url: 'https://example.com/',
	headers: new Headers(),
	text: async () => JSON.stringify(body)
})

describe('randomJoke', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('returns twopart joke shape', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				mockResponse({
					error: false,
					category: 'Programming',
					type: 'twopart',
					setup: 'Why do programmers prefer dark mode?',
					delivery: 'Because light attracts bugs.',
					lang: 'en'
				})
			)
		)
		const j = await randomJoke({ category: 'Programming' })
		expect(j.type).toBe('twopart')
		expect(j.setup).toContain('programmers')
		expect(j.delivery).toContain('bugs')
	})

	it('returns single joke shape', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				mockResponse({
					error: false,
					category: 'Misc',
					type: 'single',
					joke: 'Single line joke.',
					lang: 'en'
				})
			)
		)
		const j = await randomJoke()
		expect(j.type).toBe('single')
		expect(j.joke).toBe('Single line joke.')
	})

	it('throws ParseError when API errors', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse({ error: true, message: 'No joke' }))
		)
		await expect(randomJoke()).rejects.toBeInstanceOf(ParseError)
	})
})
