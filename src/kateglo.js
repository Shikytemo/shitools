/**
 * Indonesian dictionary via kateglo.com (Kateglo — Kamus, Tesaurus, Glosari).
 * Public JSON API, no key required.
 *
 * @example
 * import { kateglo } from '@shikytemo/shitools'
 * const entry = await kateglo('komputer')
 * console.log(entry.lex[0].def_text)
 */

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'kateglo'
const BASE = 'https://kateglo.com/api.php'

/**
 * @typedef {Object} KategloDef
 * @property {string} kelas      Word class (n., v., a., adv.)
 * @property {string} text       Definition text
 * @property {string} [sample]   Example usage
 */

/**
 * @typedef {Object} KategloEntry
 * @property {string} phrase
 * @property {string} type
 * @property {KategloDef[]} definitions
 * @property {string[]} synonyms
 * @property {string[]} antonyms
 * @property {string} source
 */

/**
 * Look up a word in the Indonesian dictionary. Returns definitions,
 * synonyms, and antonyms.
 *
 * @param {string} word
 * @param {{ retries?: number }} [options]
 * @returns {Promise<KategloEntry>}
 */
export const kateglo = async (word, options = {}) => {
	if (typeof word !== 'string' || !word.trim()) {
		throw new InvalidInputError('word is required', { source: SOURCE })
	}
	const trimmed = word.trim().toLowerCase()
	const url = `${BASE}?format=json&phrase=${encodeURIComponent(trimmed)}`
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('kateglo returned non-JSON', { source: SOURCE, url, cause: error })
	}
	const phrase = json?.kateglo?.phrase
	if (!phrase) {
		throw new ParseError(`Kata "${trimmed}" tidak ada di kamus`, { source: SOURCE, url })
	}
	const lex = Array.isArray(json.kateglo.lex) ? json.kateglo.lex : []
	const relation = json.kateglo.relation ?? {}
	const collectRelations = code => {
		const list = relation[code]
		if (!Array.isArray(list)) return []
		return list.map(r => r.related_phrase ?? r).filter(Boolean)
	}
	return {
		phrase,
		type: json.kateglo.type ?? '',
		definitions: lex.map(l => ({
			kelas: l.lex_class_name ?? l.lex_class ?? '',
			text: l.def_text ?? '',
			sample: l.def_sample ?? undefined
		})),
		synonyms: collectRelations('s'),
		antonyms: collectRelations('a'),
		source: 'kateglo.com'
	}
}
