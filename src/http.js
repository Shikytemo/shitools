/**
 * Shared HTTP client used across every scraper.
 *
 * Goals:
 * - One place to set timeout / user-agent / proxy / retry behaviour.
 * - Mappable to {@link RateLimitError} / {@link ScrapeError} so callers can
 *   `instanceof`-branch.
 * - Safe defaults for Termux + serverless: no global state, AbortController
 *   driven timeouts, optional proxy via env.
 *
 * @example
 * import { httpClient } from '@shikytemo/shitools'
 * const html = await httpClient.text('https://example.com')
 * const json = await httpClient.json('https://api.example.com/x')
 *
 * @example  // override per-call
 * const res = await httpClient.get(url, { retries: 5, userAgent: 'mybot/1.0', timeout: 15000 })
 * console.log(res.status, res.body)
 */

import { ScrapeError, RateLimitError } from './errors.js'

/**
 * Curated User-Agent pool. Rotated on each request when `userAgent` is not
 * explicitly provided. All entries are well-formed strings real browsers
 * have shipped — no spoofing of revoked / suspicious agents.
 *
 * @type {readonly string[]}
 */
export const userAgentPool = Object.freeze([
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
	'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
	'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0'
])

/**
 * Pick a random User-Agent from {@link userAgentPool}.
 *
 * @param {{ random?: () => number }} [options]  Inject a deterministic RNG in tests.
 * @returns {string}
 */
export const pickRandomUserAgent = (options = {}) => {
	const random = options.random ?? Math.random
	const index = Math.floor(random() * userAgentPool.length)
	return userAgentPool[index]
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Compute exponential backoff delay with optional ±20% jitter.
 *
 * @param {number} attempt   1-based attempt number
 * @param {number} baseMs    Base delay in ms (default 500)
 * @param {number} capMs     Maximum delay cap in ms (default 8000)
 * @returns {number}
 */
export const computeBackoff = (attempt, baseMs = 500, capMs = 8000) => {
	const expo = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt - 1))
	const jitter = expo * 0.2 * (Math.random() * 2 - 1)
	return Math.max(0, Math.round(expo + jitter))
}

/**
 * Determine whether a thrown error or HTTP status is worth retrying.
 *
 * @param {{ status?: number, code?: string, name?: string }} err
 * @returns {boolean}
 */
export const isRetryable = err => {
	if (!err) return false
	const status = err.status ?? 0
	if (status === 408 || status === 425 || status === 429) return true
	if (status >= 500 && status < 600) return true
	const code = err.code ?? ''
	if (['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'ECONNREFUSED'].includes(code))
		return true
	if (err.name === 'AbortError') return true
	return false
}

/**
 * Result of {@link request}.
 *
 * @typedef {Object} HttpResponse
 * @property {number} status               HTTP status code
 * @property {Record<string, string>} headers   Lower-cased header map
 * @property {string} body                 Response body as text (or stringified JSON)
 * @property {string} url                  Final URL (after any redirects)
 */

/**
 * Per-request options.
 *
 * @typedef {Object} HttpRequestOptions
 * @property {string} [method]                       HTTP method, default 'GET'
 * @property {Record<string, string>} [headers]      Extra headers (User-Agent set automatically)
 * @property {string} [userAgent]                    Force a specific UA (skips the pool)
 * @property {string|FormData|Buffer|null} [body]    Request body
 * @property {number} [timeout]                      Per-attempt timeout in ms (default 30000)
 * @property {number} [retries]                      Max retries on retryable errors (default 2)
 * @property {(attempt:number) => number} [backoff]  Custom backoff function
 * @property {string} [proxy]                        HTTP/HTTPS proxy URL (overrides env)
 * @property {AbortSignal} [signal]                  External abort
 */

const DEFAULT_TIMEOUT_MS = Number.parseInt(process.env.REQUEST_TIMEOUT_MS ?? '', 10) || 30_000

const buildHeaders = (input = {}, userAgent) => {
	const headers = {}
	for (const [key, value] of Object.entries(input)) {
		if (value !== undefined && value !== null) headers[String(key).toLowerCase()] = String(value)
	}
	if (!('user-agent' in headers)) headers['user-agent'] = userAgent
	return headers
}

const headersToObject = headers => {
	const out = {}
	if (!headers) return out
	if (typeof headers.forEach === 'function') {
		headers.forEach((value, key) => {
			out[String(key).toLowerCase()] = value
		})
	}
	return out
}

const parseRetryAfter = value => {
	if (!value) return undefined
	const seconds = Number.parseInt(value, 10)
	if (Number.isFinite(seconds)) return seconds * 1000
	const date = Date.parse(value)
	if (Number.isFinite(date)) return Math.max(0, date - Date.now())
	return undefined
}

/**
 * Low-level request — issues a single attempt, returns full {@link HttpResponse}.
 * Use {@link httpClient} for the retrying high-level helpers.
 *
 * @param {string} url
 * @param {HttpRequestOptions} [options]
 * @returns {Promise<HttpResponse>}
 */
export const request = async (url, options = {}) => {
	const userAgent = options.userAgent ?? process.env.USER_AGENT ?? pickRandomUserAgent()
	const headers = buildHeaders(options.headers, userAgent)
	const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS

	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), timeout)
	const externalAbort = options.signal
	if (externalAbort) {
		if (externalAbort.aborted) controller.abort()
		else externalAbort.addEventListener('abort', () => controller.abort(), { once: true })
	}

	try {
		const response = await fetch(url, {
			method: options.method ?? 'GET',
			headers,
			body: options.body,
			signal: controller.signal,
			redirect: 'follow'
		})
		const body = await response.text()
		const responseHeaders = headersToObject(response.headers)

		if (!response.ok) {
			const status = response.status
			const baseInfo = { url, status, source: options.source }
			if (status === 429) {
				throw new RateLimitError(`Rate limited (429) for ${url}`, {
					...baseInfo,
					retryAfter: parseRetryAfter(responseHeaders['retry-after'])
				})
			}
			throw new ScrapeError(`HTTP ${status} ${response.statusText || ''}`.trim(), baseInfo)
		}

		return { status: response.status, headers: responseHeaders, body, url: response.url || url }
	} finally {
		clearTimeout(timer)
	}
}

/**
 * High-level retrying request. Wraps {@link request} with exponential
 * backoff and {@link RateLimitError}-aware sleeping.
 *
 * @param {string} url
 * @param {HttpRequestOptions} [options]
 * @returns {Promise<HttpResponse>}
 */
export const get = async (url, options = {}) => {
	const retries = options.retries ?? 2
	const backoff = options.backoff ?? computeBackoff
	let lastError

	for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
		try {
			return await request(url, options)
		} catch (error) {
			lastError = error
			if (!isRetryable(error) || attempt > retries) throw error
			const wait =
				error instanceof RateLimitError && typeof error.retryAfter === 'number'
					? error.retryAfter
					: backoff(attempt)
			await sleep(wait)
		}
	}

	/* c8 ignore next */
	throw lastError
}

/**
 * Convenience wrappers.
 */
export const httpClient = {
	request,
	get,
	/**
	 * Shorthand: GET → text body.
	 *
	 * @param {string} url
	 * @param {HttpRequestOptions} [options]
	 * @returns {Promise<string>}
	 */
	async text(url, options) {
		const response = await get(url, options)
		return response.body
	},
	/**
	 * Shorthand: GET → JSON-parsed body.
	 *
	 * @template T
	 * @param {string} url
	 * @param {HttpRequestOptions} [options]
	 * @returns {Promise<T>}
	 */
	async json(url, options) {
		const response = await get(url, options)
		try {
			return JSON.parse(response.body)
		} catch (error) {
			throw new ScrapeError('Failed to parse JSON response', {
				url: response.url,
				status: response.status,
				source: options?.source,
				cause: error
			})
		}
	}
}
