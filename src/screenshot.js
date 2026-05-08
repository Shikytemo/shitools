/**
 * Website screenshot via WordPress.com mShots service. No API key required.
 *
 * `mshots` is a free, hot-cached screenshot CDN (`s.wp.com/mshots/v1/...`)
 * used by WordPress to render link previews. We just build the URL and
 * (optionally) fetch the bytes.
 *
 * @example
 * import { getScreenshotUrl, fetchScreenshot } from '@shikytemo/shitools'
 * const url = getScreenshotUrl('https://example.com', { width: 1280 })
 * const bytes = await fetchScreenshot('https://example.com')
 */

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'screenshot'

/**
 * @typedef {Object} ScreenshotOptions
 * @property {number} [width]    Output width (default 1024).
 * @property {number} [height]   Output height (default 768).
 * @property {boolean} [vpw]     Use viewport width (mShots flag).
 */

const validateUrl = url => {
	let parsed
	try {
		parsed = new URL(url)
	} catch {
		throw new InvalidInputError('url must be a valid http(s) URL', { source: SOURCE })
	}
	if (!['http:', 'https:'].includes(parsed.protocol)) {
		throw new InvalidInputError('url must use http or https', { source: SOURCE })
	}
	return parsed
}

/**
 * Build the mShots screenshot URL.
 *
 * @param {string} target
 * @param {ScreenshotOptions} [options]
 * @returns {string}
 */
export const getScreenshotUrl = (target, options = {}) => {
	const url = validateUrl(target)
	const width = Math.max(320, Math.min(1920, Number(options.width ?? 1024)))
	const height = Math.max(240, Math.min(1920, Number(options.height ?? 768)))
	return `https://s.wp.com/mshots/v1/${encodeURIComponent(url.toString())}?w=${width}&h=${height}${options.vpw ? '&vpw=1' : ''}`
}

/**
 * Fetch the screenshot as a Uint8Array. Polls up to 5 times because the
 * mShots service returns a 1×1 placeholder PNG while still rendering.
 *
 * @param {string} target
 * @param {ScreenshotOptions & { retries?: number, attempts?: number }} [options]
 * @returns {Promise<Uint8Array>}
 */
export const fetchScreenshot = async (target, options = {}) => {
	const url = getScreenshotUrl(target, options)
	const attempts = Math.max(1, Math.min(8, Number(options.attempts ?? 5)))
	let lastBytes
	for (let i = 0; i < attempts; i += 1) {
		const response = await fetch(url)
		if (!response.ok) {
			throw new ParseError(`mshots HTTP ${response.status}`, {
				source: SOURCE,
				url,
				status: response.status
			})
		}
		const buffer = await response.arrayBuffer()
		const bytes = new Uint8Array(buffer)
		// mShots returns a tiny placeholder while rendering — keep polling.
		if (bytes.byteLength > 4096) return bytes
		lastBytes = bytes
		await new Promise(resolve => setTimeout(resolve, 1500))
	}
	if (lastBytes) return lastBytes
	throw new ParseError('mshots never returned a real screenshot', { source: SOURCE, url })
}

// Re-exported so `httpClient` can be substituted in unit tests if desired.
export { httpClient }
