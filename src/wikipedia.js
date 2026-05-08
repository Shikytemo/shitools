/**
 * Wikipedia summary + search via the public REST v1 API.
 * No API key required.
 *
 * @example
 * import { searchWikipedia, getWikipediaSummary } from '@shikytemo/shitools'
 *
 * const hits = await searchWikipedia('Sukarno', { lang: 'id' })
 * const page = await getWikipediaSummary(hits[0].title, { lang: 'id' })
 * console.log(page.extract)
 */

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'wikipedia'
const DEFAULT_LANG = 'id'

const apiBase = lang => `https://${lang}.wikipedia.org/api/rest_v1`
const searchBase = lang => `https://${lang}.wikipedia.org/w/rest.php/v1`

/**
 * @typedef {Object} WikipediaHit
 * @property {string} title
 * @property {string} description
 * @property {string} excerpt
 * @property {string} url
 * @property {string} [thumbnail]
 */

/**
 * Search Wikipedia titles for `query`. Returns up to 10 normalized hits.
 *
 * @param {string} query
 * @param {{ lang?: string, limit?: number, retries?: number }} [options]
 * @returns {Promise<WikipediaHit[]>}
 */
export const searchWikipedia = async (query, options = {}) => {
	if (typeof query !== 'string' || !query.trim()) {
		throw new InvalidInputError('wikipedia query is required', { source: SOURCE })
	}
	const lang = options.lang ?? DEFAULT_LANG
	const limit = Math.max(1, Math.min(20, Number(options.limit ?? 10)))
	const url = `${searchBase(lang)}/search/title?q=${encodeURIComponent(query.trim())}&limit=${limit}`
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('Wikipedia returned non-JSON', { source: SOURCE, url, cause: error })
	}
	const pages = Array.isArray(json?.pages) ? json.pages : []
	return pages.map(p => ({
		title: p.title ?? p.key ?? '',
		description: p.description ?? '',
		excerpt: p.excerpt ?? '',
		url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.key ?? p.title ?? '')}`,
		thumbnail: p.thumbnail?.url ? `https:${p.thumbnail.url}` : undefined
	}))
}

/**
 * @typedef {Object} WikipediaSummary
 * @property {string} title
 * @property {string} description
 * @property {string} extract
 * @property {string} url
 * @property {string} [thumbnail]
 * @property {string} lang
 */

/**
 * Fetch the rest_v1 summary for a single Wikipedia title.
 *
 * @param {string} title
 * @param {{ lang?: string, retries?: number }} [options]
 * @returns {Promise<WikipediaSummary>}
 */
export const getWikipediaSummary = async (title, options = {}) => {
	if (typeof title !== 'string' || !title.trim()) {
		throw new InvalidInputError('wikipedia title is required', { source: SOURCE })
	}
	const lang = options.lang ?? DEFAULT_LANG
	const url = `${apiBase(lang)}/page/summary/${encodeURIComponent(title.trim())}`
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('Wikipedia returned non-JSON', { source: SOURCE, url, cause: error })
	}
	return {
		title: json.title ?? title,
		description: json.description ?? '',
		extract: json.extract ?? '',
		url:
			json.content_urls?.desktop?.page ??
			`https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
		thumbnail: json.thumbnail?.source,
		lang
	}
}

/**
 * Smart wikipedia: search → summary of top hit. Returns the same
 * shape as {@link getWikipediaSummary} plus the search hit list.
 *
 * @param {string} query
 * @param {{ lang?: string, retries?: number }} [options]
 * @returns {Promise<WikipediaSummary & { hits: WikipediaHit[] }>}
 */
export const wikipedia = async (query, options = {}) => {
	const hits = await searchWikipedia(query, { ...options, limit: 5 })
	if (hits.length === 0) {
		throw new ParseError(`No Wikipedia results for "${query}"`, { source: SOURCE })
	}
	const summary = await getWikipediaSummary(hits[0].title, options)
	return { ...summary, hits }
}
