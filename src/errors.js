/**
 * Error class hierarchy for shitools.
 *
 * Bot/library consumers can branch on these types instead of parsing
 * error message strings:
 *
 * @example
 * try {
 *   await scrapeSource('samehadaku', 'one piece')
 * } catch (err) {
 *   if (err instanceof RateLimitError) await wait(err.retryAfter ?? 60_000)
 *   else if (err instanceof UnsupportedSourceError) console.warn('source missing')
 *   else throw err
 * }
 */

/**
 * Base error for any scrape/network/parse failure raised by shitools.
 *
 * @typedef {Object} ScrapeErrorOptions
 * @property {string} [source]   Source id (e.g. 'pinterest', 'samehadaku')
 * @property {unknown} [cause]   Underlying error (preserved on `.cause`)
 * @property {string} [url]      Request URL that triggered the failure
 * @property {number} [status]   HTTP status code, when applicable
 */
export class ScrapeError extends Error {
	/**
	 * @param {string} message
	 * @param {ScrapeErrorOptions} [options]
	 */
	constructor(message, options = {}) {
		super(message, { cause: options.cause })
		this.name = 'ScrapeError'
		this.source = options.source
		this.url = options.url
		this.status = options.status
	}
}

/**
 * Thrown when the upstream signals rate limiting (HTTP 429, captcha, etc.).
 *
 * @typedef {ScrapeErrorOptions & { retryAfter?: number }} RateLimitErrorOptions
 */
export class RateLimitError extends ScrapeError {
	/**
	 * @param {string} message
	 * @param {RateLimitErrorOptions} [options]
	 */
	constructor(message, options = {}) {
		super(message, options)
		this.name = 'RateLimitError'
		/** Suggested wait before retrying, in milliseconds. */
		this.retryAfter = options.retryAfter
	}
}

/**
 * Thrown when an HTTP response was OK but the payload could not be parsed
 * (HTML markup changed, JSON malformed, expected field missing, ...).
 */
export class ParseError extends ScrapeError {
	/**
	 * @param {string} message
	 * @param {ScrapeErrorOptions} [options]
	 */
	constructor(message, options = {}) {
		super(message, options)
		this.name = 'ParseError'
	}
}

/**
 * Thrown when caller asked for a source/feature that is not registered.
 */
export class UnsupportedSourceError extends ScrapeError {
	/**
	 * @param {string} message
	 * @param {ScrapeErrorOptions} [options]
	 */
	constructor(message, options = {}) {
		super(message, options)
		this.name = 'UnsupportedSourceError'
	}
}

/**
 * Thrown when caller-provided input is invalid before any network call
 * (e.g. malformed URL, empty query). Useful for input validation.
 */
export class InvalidInputError extends ScrapeError {
	/**
	 * @param {string} message
	 * @param {ScrapeErrorOptions} [options]
	 */
	constructor(message, options = {}) {
		super(message, options)
		this.name = 'InvalidInputError'
	}
}
