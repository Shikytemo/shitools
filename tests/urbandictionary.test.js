import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError } from '../src/errors.js'
import { urbanDefine } from '../src/urbandictionary.js'

const mockResponse = (body, init = {}) => ({
	ok: init.ok ?? true,
	status: init.status ?? 200,
	statusText: init.statusText ?? 'OK',
	url: init.url ?? 'https://example.com/',
	headers: new Headers(init.headers ?? {}),
	text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
})

const FIXTURE = {
	list: [
		{
			word: 'rizz',
			definition: 'short for [charisma]',
			example: 'his [rizz] is unmatched',
			author: 'kai',
			thumbs_up: 999,
			thumbs_down: 11,
			permalink: 'https://urbandictionary.com/define.php?term=rizz',
			written_on: '2023-06-01T00:00:00Z'
		}
	]
}

describe('urbanDefine', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('strips brackets and returns up to limit definitions', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(FIXTURE))
		)
		const hits = await urbanDefine('rizz')
		expect(hits).toHaveLength(1)
		expect(hits[0].definition).toBe('short for charisma')
		expect(hits[0].example).toBe('his rizz is unmatched')
		expect(hits[0].thumbsUp).toBe(999)
	})

	it('throws on empty term', async () => {
		await expect(urbanDefine('  ')).rejects.toBeInstanceOf(InvalidInputError)
	})
})
