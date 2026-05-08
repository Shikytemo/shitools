/**
 * Random memes via meme-api.com (Reddit-backed, public, no key).
 *
 * @example
 * import { randomMeme } from '@shikytemo/shitools'
 * const m = await randomMeme()
 * const m2 = await randomMeme({ subreddit: 'wholesomememes' })
 */

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'meme'
const BASE = 'https://meme-api.com/gimme'

/**
 * @typedef {Object} Meme
 * @property {string} title
 * @property {string} url        Image URL (jpg/png).
 * @property {string} subreddit
 * @property {string} author
 * @property {string} postLink   Reddit permalink.
 * @property {boolean} nsfw
 * @property {boolean} spoiler
 * @property {string} source
 */

/**
 * Fetch one random meme (optionally from a specific subreddit).
 *
 * @param {{ subreddit?: string, retries?: number }} [options]
 * @returns {Promise<Meme>}
 */
export const randomMeme = async (options = {}) => {
	const sub = options.subreddit ? String(options.subreddit).trim() : ''
	if (sub && /[^a-z0-9_]/i.test(sub)) {
		throw new InvalidInputError('subreddit name has invalid characters', { source: SOURCE })
	}
	const url = sub ? `${BASE}/${encodeURIComponent(sub)}` : BASE
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('meme-api returned non-JSON', { source: SOURCE, url, cause: error })
	}
	if (json?.code && json.code !== 200) {
		throw new ParseError(json.message ?? 'meme-api error', { source: SOURCE, url })
	}
	if (typeof json?.url !== 'string') {
		throw new ParseError('meme-api payload missing url', { source: SOURCE, url })
	}
	return {
		title: json.title ?? '',
		url: json.url,
		subreddit: json.subreddit ?? sub,
		author: json.author ?? '',
		postLink: json.postLink ?? '',
		nsfw: Boolean(json.nsfw),
		spoiler: Boolean(json.spoiler),
		source: 'meme-api.com'
	}
}
