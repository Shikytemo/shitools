import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError } from '../src/errors.js'
import { decodeQrCode, qrCodeUrl } from '../src/qrcode.js'

const mockResponse = (body, init = {}) => ({
	ok: init.ok ?? true,
	status: init.status ?? 200,
	statusText: init.statusText ?? 'OK',
	url: init.url ?? 'https://example.com/',
	headers: new Headers(init.headers ?? {}),
	text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
})

describe('qrCodeUrl', () => {
	it('builds api.qrserver.com URL with default size', () => {
		const url = qrCodeUrl('hello world')
		expect(url).toContain('api.qrserver.com')
		expect(url).toContain('size=300x300')
		expect(url).toContain('data=hello+world')
	})

	it('clamps size to allowed range', () => {
		const url = qrCodeUrl('x', { size: 99999 })
		expect(url).toContain('size=1000x1000')
	})

	it('throws on empty input', () => {
		expect(() => qrCodeUrl('')).toThrow(InvalidInputError)
	})
})

describe('decodeQrCode', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('extracts symbol data from response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse([{ symbol: [{ data: 'https://example.com', error: null }] }]))
		)
		const data = await decodeQrCode('https://example.com/qr.png')
		expect(data).toBe('https://example.com')
	})
})
