/**
 * Free Google Translate proxy via the public `translate.googleapis.com`
 * endpoint that the official Translate web client uses.
 *
 * No API key required, but it is rate-limited per IP — wrap with
 * {@link withCache} from `src/cache.js` if you call it in a hot loop.
 *
 * @example
 * import { translate, detectLanguage } from '@shikytemo/shitools'
 *
 * const out = await translate('Hello world', { to: 'id' })
 * console.log(out.text)         // "Halo dunia"
 * console.log(out.sourceLang)   // "en"  (auto-detected)
 *
 * const lang = await detectLanguage('Selamat pagi semua')
 * console.log(lang)             // "id"
 */

import { InvalidInputError, ParseError, ScrapeError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'translate'
const ENDPOINT = 'https://translate.googleapis.com/translate_a/single'
const MAX_INPUT_LENGTH = 5000

/**
 * @typedef {Object} TranslateOptions
 * @property {string} [from]      ISO source language code, default 'auto'
 * @property {string} [to]        ISO target language code, default 'id'
 * @property {number} [retries]
 * @property {number} [timeout]
 */

/**
 * @typedef {Object} TranslateResult
 * @property {string} text         Translated text (joined across all sentences).
 * @property {string} sourceLang   Detected (or supplied) source language.
 * @property {string} targetLang   Target language used.
 * @property {string} original     Input text echoed back for convenience.
 */

const buildUrl = (text, from, to) => {
	const params = new URLSearchParams({
		client: 'gtx',
		sl: from,
		tl: to,
		dt: 't',
		q: text
	})
	return `${ENDPOINT}?${params.toString()}`
}

/**
 * Translate `text` to `to` (default 'id' — Bahasa Indonesia, since this
 * library is most commonly used by Indo bots).
 *
 * @param {string} text
 * @param {TranslateOptions} [options]
 * @returns {Promise<TranslateResult>}
 */
export const translate = async (text, options = {}) => {
	if (typeof text !== 'string' || !text.trim()) {
		throw new InvalidInputError('text is required', { source: SOURCE })
	}
	if (text.length > MAX_INPUT_LENGTH) {
		throw new InvalidInputError(
			`text exceeds ${MAX_INPUT_LENGTH} character limit (got ${text.length})`,
			{ source: SOURCE }
		)
	}
	const from = options.from ?? 'auto'
	const to = options.to ?? 'id'
	const url = buildUrl(text, from, to)
	const response = await httpClient.get(url, { source: SOURCE, ...options })

	let parsed
	try {
		parsed = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('Translate endpoint returned non-JSON', {
			source: SOURCE,
			url,
			cause: error
		})
	}
	if (!Array.isArray(parsed) || !Array.isArray(parsed[0])) {
		throw new ScrapeError('Translate response shape unexpected', { source: SOURCE, url })
	}

	const sentences = parsed[0]
	const translated = sentences
		.map(item => (Array.isArray(item) ? (item[0] ?? '') : ''))
		.join('')
		.trim()
	const detected = typeof parsed[2] === 'string' ? parsed[2] : from

	return {
		text: translated,
		sourceLang: detected,
		targetLang: to,
		original: text
	}
}

/**
 * Quick language detection — runs a no-op self-translation to coax Google
 * into returning its detected language. Useful when you only need the lang
 * code (e.g. to decide whether to call {@link translate} at all).
 *
 * @param {string} text
 * @param {Pick<TranslateOptions, 'retries' | 'timeout'>} [options]
 * @returns {Promise<string>}     ISO code, e.g. 'en' / 'id' / 'ja'.
 */
export const detectLanguage = async (text, options = {}) => {
	const result = await translate(text, { ...options, from: 'auto', to: 'en' })
	return result.sourceLang
}
