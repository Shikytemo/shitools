import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError } from '../src/errors.js'
import { shortenUrl } from '../src/shortlink.js'

const mockResponse = (body, init = {}) => ({
	ok: init.ok ?? true,
	status: init.status ?? 200,
	statusText: init.statusText ?? 'OK',
	url: init.url ?? 'https://example.com/',
	headers: new Headers(init.headers ?? {}),
	text: async () => String(body)
})

describe('shortenUrl', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('returns trimmed URL from TinyURL', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse('https://tinyurl.com/abc123\n'))
		)
		const result = await shortenUrl('https://example.com/very/long/path?q=1')
		expect(result).toBe('https://tinyurl.com/abc123')
	})

	it('rejects non-http URLs', async () => {
		await expect(shortenUrl('ftp://example.com')).rejects.toBeInstanceOf(InvalidInputError)
	})

	it('rejects empty input', async () => {
		await expect(shortenUrl('  ')).rejects.toBeInstanceOf(InvalidInputError)
	})
})
