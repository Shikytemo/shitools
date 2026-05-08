import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	computeBackoff,
	get,
	httpClient,
	isRetryable,
	pickRandomUserAgent,
	request,
	userAgentPool
} from '../src/http.js'
import { ScrapeError } from '../src/errors.js'

const originalFetch = globalThis.fetch

const mockResponse = (body, init = {}) => {
	const headers = new Headers(init.headers ?? {})
	return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
		status: init.status ?? 200,
		statusText: init.statusText ?? 'OK',
		headers
	})
}

afterEach(() => {
	globalThis.fetch = originalFetch
	vi.restoreAllMocks()
	vi.useRealTimers()
})

describe('userAgentPool / pickRandomUserAgent', () => {
	it('exposes a non-empty frozen pool', () => {
		expect(userAgentPool.length).toBeGreaterThan(3)
		expect(Object.isFrozen(userAgentPool)).toBe(true)
	})

	it('returns a UA from the pool', () => {
		const ua = pickRandomUserAgent({ random: () => 0 })
		expect(userAgentPool).toContain(ua)
	})
})

describe('computeBackoff', () => {
	it('grows exponentially and caps', () => {
		// jitter is ±20% so we widen the assertion
		const a1 = computeBackoff(1, 100, 1000)
		const a4 = computeBackoff(4, 100, 1000)
		expect(a1).toBeGreaterThanOrEqual(80)
		expect(a1).toBeLessThanOrEqual(120)
		expect(a4).toBeLessThanOrEqual(1200)
	})
})

describe('isRetryable', () => {
	it('marks 429/5xx/transient codes retryable, others not', () => {
		expect(isRetryable({ status: 429 })).toBe(true)
		expect(isRetryable({ status: 503 })).toBe(true)
		expect(isRetryable({ code: 'ECONNRESET' })).toBe(true)
		expect(isRetryable({ name: 'AbortError' })).toBe(true)
		expect(isRetryable({ status: 404 })).toBe(false)
		expect(isRetryable({ status: 200 })).toBe(false)
		expect(isRetryable(undefined)).toBe(false)
	})
})

describe('request', () => {
	it('returns a normalized HttpResponse on 200', async () => {
		globalThis.fetch = vi.fn(async () => mockResponse('hello', { headers: { 'X-Trace': 'abc' } }))
		const res = await request('https://example.com')
		expect(res.status).toBe(200)
		expect(res.body).toBe('hello')
		expect(res.headers['x-trace']).toBe('abc')
	})

	it('throws RateLimitError with retryAfter on 429', async () => {
		globalThis.fetch = vi.fn(async () =>
			mockResponse('limited', {
				status: 429,
				statusText: 'Too Many Requests',
				headers: { 'retry-after': '3' }
			})
		)
		await expect(request('https://example.com')).rejects.toMatchObject({
			name: 'RateLimitError',
			status: 429,
			retryAfter: 3000
		})
	})

	it('throws ScrapeError on non-2xx, non-429', async () => {
		globalThis.fetch = vi.fn(async () => mockResponse('nope', { status: 500, statusText: 'ERR' }))
		await expect(request('https://example.com')).rejects.toBeInstanceOf(ScrapeError)
	})

	it('sets a User-Agent header automatically', async () => {
		const fetchSpy = vi.fn(async () => mockResponse('ok'))
		globalThis.fetch = fetchSpy
		await request('https://example.com')
		const init = fetchSpy.mock.calls[0][1]
		expect(init.headers['user-agent']).toBeTruthy()
	})
})

describe('get (retrying)', () => {
	beforeEach(() => {
		// Speed up tests by stubbing setTimeout to fire immediately.
		vi.stubGlobal('setTimeout', fn => {
			fn()
			return 0
		})
	})

	it('retries on retryable status, then succeeds', async () => {
		const fetchSpy = vi
			.fn()
			.mockResolvedValueOnce(mockResponse('flaky', { status: 503 }))
			.mockResolvedValueOnce(mockResponse('ok'))
		globalThis.fetch = fetchSpy
		const res = await get('https://example.com', { retries: 1 })
		expect(res.body).toBe('ok')
		expect(fetchSpy).toHaveBeenCalledTimes(2)
	})

	it('respects RateLimitError.retryAfter on 429 then succeeds', async () => {
		const fetchSpy = vi
			.fn()
			.mockResolvedValueOnce(mockResponse('busy', { status: 429, headers: { 'retry-after': '1' } }))
			.mockResolvedValueOnce(mockResponse('ok'))
		globalThis.fetch = fetchSpy
		const res = await get('https://example.com', { retries: 1 })
		expect(res.body).toBe('ok')
	})

	it('does not retry on non-retryable error', async () => {
		const fetchSpy = vi.fn(async () => mockResponse('gone', { status: 404 }))
		globalThis.fetch = fetchSpy
		await expect(get('https://example.com', { retries: 5 })).rejects.toBeInstanceOf(ScrapeError)
		expect(fetchSpy).toHaveBeenCalledTimes(1)
	})

	it('throws after exhausting retries', async () => {
		const fetchSpy = vi.fn(async () => mockResponse('boom', { status: 503 }))
		globalThis.fetch = fetchSpy
		await expect(get('https://example.com', { retries: 2 })).rejects.toBeInstanceOf(ScrapeError)
		expect(fetchSpy).toHaveBeenCalledTimes(3)
	})
})

describe('httpClient.json', () => {
	it('parses JSON body', async () => {
		globalThis.fetch = vi.fn(async () => mockResponse({ hello: 'world' }))
		const data = await httpClient.json('https://api.example.com')
		expect(data).toEqual({ hello: 'world' })
	})

	it('throws ScrapeError on malformed JSON', async () => {
		globalThis.fetch = vi.fn(async () => mockResponse('not-json'))
		await expect(httpClient.json('https://api.example.com')).rejects.toBeInstanceOf(ScrapeError)
	})
})

describe('httpClient.text', () => {
	it('returns raw text body', async () => {
		globalThis.fetch = vi.fn(async () => mockResponse('<html>'))
		const text = await httpClient.text('https://example.com')
		expect(text).toBe('<html>')
	})
})
