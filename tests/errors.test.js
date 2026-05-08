import { describe, expect, it } from 'vitest'

import {
	InvalidInputError,
	ParseError,
	RateLimitError,
	ScrapeError,
	UnsupportedSourceError
} from '../src/errors.js'

describe('error classes', () => {
	it('ScrapeError carries source / url / status / cause metadata', () => {
		const cause = new Error('upstream')
		const err = new ScrapeError('boom', {
			source: 'pinterest',
			url: 'https://x',
			status: 503,
			cause
		})
		expect(err).toBeInstanceOf(Error)
		expect(err).toBeInstanceOf(ScrapeError)
		expect(err.name).toBe('ScrapeError')
		expect(err.source).toBe('pinterest')
		expect(err.url).toBe('https://x')
		expect(err.status).toBe(503)
		expect(err.cause).toBe(cause)
	})

	it('RateLimitError extends ScrapeError and carries retryAfter', () => {
		const err = new RateLimitError('slow down', { retryAfter: 1500 })
		expect(err).toBeInstanceOf(ScrapeError)
		expect(err).toBeInstanceOf(RateLimitError)
		expect(err.name).toBe('RateLimitError')
		expect(err.retryAfter).toBe(1500)
	})

	it('ParseError / UnsupportedSourceError / InvalidInputError keep correct prototype chain', () => {
		const parse = new ParseError('bad markup')
		const unsupported = new UnsupportedSourceError('no such source')
		const invalid = new InvalidInputError('empty query')

		expect(parse).toBeInstanceOf(ScrapeError)
		expect(parse.name).toBe('ParseError')
		expect(unsupported).toBeInstanceOf(ScrapeError)
		expect(unsupported.name).toBe('UnsupportedSourceError')
		expect(invalid).toBeInstanceOf(ScrapeError)
		expect(invalid.name).toBe('InvalidInputError')
	})
})
