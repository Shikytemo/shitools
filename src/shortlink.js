/**
 * URL shortener via the public TinyURL `api-create.php` endpoint.
 * Returns the shortened URL as plain text. No API key required.
 *
 * @example
 * import { shortenUrl } from '@shikytemo/shitools'
 * const short = await shortenUrl('https://example.com/some/very/long/path?q=1')
 * console.log(short)
 */

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'shortlink'
const ENDPOINT = 'https://tinyurl.com/api-create.php'

/**
 * Shorten `url` via TinyURL. Throws if the response doesn't look like a URL.
 *
 * @param {string} url
 * @param {{ retries?: number }} [options]
 * @returns {Promise<string>}
 */
export const shortenUrl = async (url, options = {}) => {
	if (typeof url !== 'string' || !url.trim()) {
		throw new InvalidInputError('url is required', { source: SOURCE })
	}
	const trimmed = url.trim()
	if (!/^https?:\/\//i.test(trimmed)) {
		throw new InvalidInputError('url must start with http:// or https://', { source: SOURCE })
	}
	const target = `${ENDPOINT}?url=${encodeURIComponent(trimmed)}`
	const response = await httpClient.get(target, { source: SOURCE, ...options })
	const body = String(response.body ?? '').trim()
	if (!/^https?:\/\//i.test(body)) {
		throw new ParseError(`TinyURL returned unexpected body: ${body.slice(0, 80)}`, {
			source: SOURCE,
			url: target
		})
	}
	return body
}
