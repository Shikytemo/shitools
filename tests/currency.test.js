import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError, ParseError } from '../src/errors.js'
import { convertCurrency, getRates } from '../src/currency.js'

const mockResponse = body => ({
	ok: true,
	status: 200,
	statusText: 'OK',
	url: 'https://example.com/',
	headers: new Headers(),
	text: async () => JSON.stringify(body)
})

const RATES_FIXTURE = {
	result: 'success',
	base_code: 'USD',
	time_last_update_utc: 'Wed, 08 May 2026 00:00:00 +0000',
	rates: { USD: 1, IDR: 16000, EUR: 0.92 }
}

describe('getRates', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('returns rates map', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(RATES_FIXTURE))
		)
		const r = await getRates('USD')
		expect(r.base).toBe('USD')
		expect(r.rates.IDR).toBe(16000)
	})

	it('rejects bad base code', async () => {
		await expect(getRates('idr2')).rejects.toBeInstanceOf(InvalidInputError)
	})

	it('throws ParseError when result not success', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse({ result: 'error', 'error-type': 'unsupported-code' }))
		)
		await expect(getRates('USD')).rejects.toBeInstanceOf(ParseError)
	})
})

describe('convertCurrency', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('multiplies by rate', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(RATES_FIXTURE))
		)
		const out = await convertCurrency('USD', 'IDR', 100)
		expect(out.from).toBe('USD')
		expect(out.to).toBe('IDR')
		expect(out.rate).toBe(16000)
		expect(out.result).toBe(1600000)
	})

	it('rejects non-finite amount', async () => {
		await expect(convertCurrency('USD', 'IDR', 'asd')).rejects.toBeInstanceOf(InvalidInputError)
	})
})
