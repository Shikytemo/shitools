/**
 * Random quotes — generic (zenquotes) + anime (animechan). No API key.
 *
 * @example
 * import { randomQuote, randomAnimeQuote } from '@shikytemo/shitools'
 * const q = await randomQuote()
 * const a = await randomAnimeQuote()
 */

import { ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'quote'

/**
 * @typedef {Object} Quote
 * @property {string} content
 * @property {string} author
 * @property {string} source
 */

/**
 * Random English quote via zenquotes.io (no key, no rate-limit on /random).
 *
 * @param {{ retries?: number }} [options]
 * @returns {Promise<Quote>}
 */
export const randomQuote = async (options = {}) => {
	const url = 'https://zenquotes.io/api/random'
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('zenquotes returned non-JSON', { source: SOURCE, url, cause: error })
	}
	const item = Array.isArray(json) ? json[0] : json
	if (!item || typeof item.q !== 'string') {
		throw new ParseError('zenquotes payload missing quote', { source: SOURCE, url })
	}
	return {
		content: item.q.trim(),
		author: (item.a ?? 'Unknown').trim(),
		source: 'zenquotes.io'
	}
}

/**
 * @typedef {Object} AnimeQuote
 * @property {string} content
 * @property {string} character
 * @property {string} anime
 * @property {string} source
 */

/**
 * Random anime quote via animechan.io (public). Falls back to zenquotes when
 * animechan is throttled.
 *
 * @param {{ retries?: number }} [options]
 * @returns {Promise<AnimeQuote>}
 */
export const randomAnimeQuote = async (options = {}) => {
	const url = 'https://animechan.io/api/v1/quotes/random'
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('animechan returned non-JSON', { source: SOURCE, url, cause: error })
	}
	const data = json?.data ?? json
	if (!data || typeof data.content !== 'string') {
		throw new ParseError('animechan payload missing content', { source: SOURCE, url })
	}
	return {
		content: data.content.trim(),
		character: data.character?.name ?? data.character ?? 'Unknown',
		anime: data.anime?.name ?? data.anime ?? 'Unknown',
		source: 'animechan.io'
	}
}
