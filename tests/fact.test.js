import { afterEach, describe, expect, it, vi } from 'vitest'

import { ParseError } from '../src/errors.js'
import { randomFact } from '../src/fact.js'

const mockResponse = body => ({
	ok: true,
	status: 200,
	statusText: 'OK',
	url: 'https://example.com/',
	headers: new Headers(),
	text: async () => JSON.stringify(body)
})

describe('randomFact', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('returns normalized fact', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				mockResponse({
					id: 'abc',
					text: 'Bananas are berries.',
					permalink: 'https://x',
					language: 'en'
				})
			)
		)
		const f = await randomFact()
		expect(f.text).toBe('Bananas are berries.')
		expect(f.id).toBe('abc')
		expect(f.source).toBe('uselessfacts.jsph.pl')
	})

	it('throws when payload missing text', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse({ id: 'x' }))
		)
		await expect(randomFact()).rejects.toBeInstanceOf(ParseError)
	})
})
