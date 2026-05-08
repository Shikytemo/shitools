/**
 * Random facts via uselessfacts.jsph.pl (public, no key).
 *
 * @example
 * import { randomFact } from '@shikytemo/shitools'
 * const f = await randomFact({ lang: 'en' })
 * console.log(f.text)
 */

import { ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'fact'
const BASE = 'https://uselessfacts.jsph.pl/api/v2/facts/random'

/**
 * @typedef {Object} Fact
 * @property {string} id
 * @property {string} text
 * @property {string} url
 * @property {string} language
 * @property {string} source
 */

/**
 * Random useless fact. Supports `lang: 'en' | 'de'`.
 *
 * @param {{ lang?: string, retries?: number }} [options]
 * @returns {Promise<Fact>}
 */
export const randomFact = async (options = {}) => {
	const lang = options.lang ?? 'en'
	const url = `${BASE}?language=${encodeURIComponent(lang)}`
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('uselessfacts returned non-JSON', { source: SOURCE, url, cause: error })
	}
	if (typeof json?.text !== 'string') {
		throw new ParseError('uselessfacts payload missing text', { source: SOURCE, url })
	}
	return {
		id: String(json.id ?? ''),
		text: json.text.trim(),
		url: json.permalink ?? json.source_url ?? '',
		language: json.language ?? lang,
		source: 'uselessfacts.jsph.pl'
	}
}
