/**
 * Random jokes via v2.jokeapi.dev (public, no key, supports many languages).
 *
 * @example
 * import { randomJoke } from '@shikytemo/shitools'
 * const j = await randomJoke({ category: 'Programming' })
 * console.log(j.setup, j.delivery)
 */

import { ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'joke'
const BASE = 'https://v2.jokeapi.dev/joke'

const DEFAULT_BLACKLIST = ['nsfw', 'religious', 'political', 'racist', 'sexist', 'explicit']

/**
 * @typedef {Object} Joke
 * @property {'single'|'twopart'} type
 * @property {string} category
 * @property {string} setup           Empty for `type === 'single'`.
 * @property {string} delivery        Empty for `type === 'single'`.
 * @property {string} joke            For `type === 'single'`.
 * @property {string} language
 * @property {string} source
 */

/**
 * Fetch a random joke. Pass `category` (`Any`, `Programming`, `Misc`,
 * `Pun`, `Spooky`, `Christmas`) or comma-separated list.
 * Bad-content categories are blacklisted by default.
 *
 * @param {{ category?: string, lang?: string, blacklist?: string[], retries?: number }} [options]
 * @returns {Promise<Joke>}
 */
export const randomJoke = async (options = {}) => {
	const category = options.category ?? 'Any'
	const lang = options.lang ?? 'en'
	const blacklist = options.blacklist ?? DEFAULT_BLACKLIST
	const url = `${BASE}/${encodeURIComponent(category)}?lang=${encodeURIComponent(lang)}&blacklistFlags=${blacklist.join(',')}`
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('jokeapi returned non-JSON', { source: SOURCE, url, cause: error })
	}
	if (json?.error) {
		throw new ParseError(json.message ?? 'jokeapi error', { source: SOURCE, url })
	}
	const type = json?.type === 'twopart' ? 'twopart' : 'single'
	return {
		type,
		category: json?.category ?? category,
		setup: type === 'twopart' ? (json.setup ?? '') : '',
		delivery: type === 'twopart' ? (json.delivery ?? '') : '',
		joke: type === 'single' ? (json.joke ?? '') : '',
		language: json?.lang ?? lang,
		source: 'v2.jokeapi.dev'
	}
}
