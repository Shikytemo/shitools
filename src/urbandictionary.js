/**
 * Urban Dictionary slang definitions via the public `api.urbandictionary.com`
 * endpoint. No API key required.
 *
 * @example
 * import { urbanDefine } from '@shikytemo/shitools'
 * const hits = await urbanDefine('rizz')
 * console.log(hits[0].definition)
 */

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'urbandictionary'
const API = 'https://api.urbandictionary.com/v0/define'

const stripBrackets = text => String(text || '').replace(/[[\]]/g, '')

/**
 * @typedef {Object} UrbanDefinition
 * @property {string} word
 * @property {string} definition
 * @property {string} example
 * @property {string} author
 * @property {number} thumbsUp
 * @property {number} thumbsDown
 * @property {string} permalink
 * @property {string} writtenOn   ISO timestamp
 */

/**
 * Look up `term` on Urban Dictionary. Returns up to 10 definitions.
 *
 * @param {string} term
 * @param {{ limit?: number, retries?: number }} [options]
 * @returns {Promise<UrbanDefinition[]>}
 */
export const urbanDefine = async (term, options = {}) => {
	if (typeof term !== 'string' || !term.trim()) {
		throw new InvalidInputError('term is required', { source: SOURCE })
	}
	const limit = Math.max(1, Math.min(20, Number(options.limit ?? 5)))
	const url = `${API}?term=${encodeURIComponent(term.trim())}`
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('Urban Dictionary returned non-JSON', {
			source: SOURCE,
			url,
			cause: error
		})
	}
	const list = Array.isArray(json?.list) ? json.list : []
	return list.slice(0, limit).map(item => ({
		word: item?.word ?? term,
		definition: stripBrackets(item?.definition),
		example: stripBrackets(item?.example),
		author: item?.author ?? '',
		thumbsUp: Number(item?.thumbs_up ?? 0),
		thumbsDown: Number(item?.thumbs_down ?? 0),
		permalink: item?.permalink ?? '',
		writtenOn: item?.written_on ?? ''
	}))
}
