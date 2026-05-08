import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError, ParseError } from '../src/errors.js'
import { kateglo } from '../src/kateglo.js'

const mockResponse = body => ({
	ok: true,
	status: 200,
	statusText: 'OK',
	url: 'https://example.com/',
	headers: new Headers(),
	text: async () => JSON.stringify(body)
})

const FIXTURE = {
	kateglo: {
		phrase: 'komputer',
		type: 'baku',
		lex: [
			{
				lex_class_name: 'nomina',
				def_text: 'alat elektronik untuk mengolah data',
				def_sample: 'saya beli komputer'
			}
		],
		relation: {
			s: [{ related_phrase: 'pc' }],
			a: [{ related_phrase: 'analog' }]
		}
	}
}

describe('kateglo', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('returns definitions + sinonim/antonim', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(FIXTURE))
		)
		const entry = await kateglo('komputer')
		expect(entry.phrase).toBe('komputer')
		expect(entry.definitions[0].text).toContain('mengolah data')
		expect(entry.synonyms).toContain('pc')
		expect(entry.antonyms).toContain('analog')
	})

	it('throws InvalidInputError on empty word', async () => {
		await expect(kateglo('')).rejects.toBeInstanceOf(InvalidInputError)
	})

	it('throws ParseError when phrase not in dict', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse({}))
		)
		await expect(kateglo('asdfgh')).rejects.toBeInstanceOf(ParseError)
	})
})
