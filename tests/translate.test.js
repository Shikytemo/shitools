import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError, ParseError, ScrapeError } from '../src/errors.js'
import { detectLanguage, translate } from '../src/translate.js'

const mockResponse = (body, init = {}) => ({
	ok: init.ok ?? true,
	status: init.status ?? 200,
	statusText: init.statusText ?? 'OK',
	url: init.url ?? 'https://translate.googleapis.com/',
	headers: new Headers(init.headers ?? {}),
	text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
})

const HELLO_WORLD_FIXTURE = [
	[
		['Halo dunia', 'Hello world', null, null, 1],
		['Selamat datang', 'Welcome', null, null, 1]
	],
	null,
	'en',
	null,
	null,
	null,
	1
]

describe('translate', () => {
	beforeEach(() => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(HELLO_WORLD_FIXTURE))
		)
	})
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('joins sentence pieces and returns metadata', async () => {
		const result = await translate('Hello world. Welcome', { to: 'id' })
		expect(result).toEqual({
			text: 'Halo duniaSelamat datang',
			sourceLang: 'en',
			targetLang: 'id',
			original: 'Hello world. Welcome'
		})
	})

	it('hits the gtx endpoint with sl=auto and tl=id by default', async () => {
		await translate('Bonjour')
		const calledUrl = global.fetch.mock.calls[0][0]
		expect(calledUrl).toContain('translate.googleapis.com/translate_a/single?')
		expect(calledUrl).toContain('client=gtx')
		expect(calledUrl).toContain('sl=auto')
		expect(calledUrl).toContain('tl=id')
		expect(calledUrl).toContain('dt=t')
		expect(calledUrl).toContain('q=Bonjour')
	})

	it('supports explicit from/to', async () => {
		await translate('Halo', { from: 'id', to: 'ja' })
		const calledUrl = global.fetch.mock.calls[0][0]
		expect(calledUrl).toContain('sl=id')
		expect(calledUrl).toContain('tl=ja')
	})

	it('throws InvalidInputError on empty input', async () => {
		await expect(translate('   ')).rejects.toBeInstanceOf(InvalidInputError)
	})

	it('throws InvalidInputError on text > 5000 chars', async () => {
		await expect(translate('a'.repeat(5001))).rejects.toBeInstanceOf(InvalidInputError)
	})

	it('throws ParseError on non-JSON', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse('<html></html>'))
		)
		await expect(translate('hello')).rejects.toBeInstanceOf(ParseError)
	})

	it('throws ScrapeError on unexpected JSON shape', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse({ unexpected: true }))
		)
		await expect(translate('hello')).rejects.toBeInstanceOf(ScrapeError)
	})

	it('falls back to provided "from" when upstream omits detected lang', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse([[['Salam', 'Hi', null, null, 1]], null, null]))
		)
		const result = await translate('Hi', { from: 'en', to: 'ar' })
		expect(result.sourceLang).toBe('en')
		expect(result.targetLang).toBe('ar')
	})
})

describe('detectLanguage', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('returns the detected sourceLang code', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				mockResponse([[['Good morning', 'Selamat pagi', null, null, 1]], null, 'id'])
			)
		)
		const lang = await detectLanguage('Selamat pagi semua')
		expect(lang).toBe('id')
	})
})
