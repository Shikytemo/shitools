/**
 * Random anime image URLs from waifu.pics — categories grouped into SFW
 * and NSFW. No API key required.
 *
 * @example
 * import { waifuImage, listWaifuCategories } from '@shikytemo/shitools'
 * const img = await waifuImage('waifu')
 * console.log(img.url)
 */

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'waifu'
const API = 'https://api.waifu.pics'

const SFW = [
	'waifu',
	'neko',
	'shinobu',
	'megumin',
	'bully',
	'cuddle',
	'cry',
	'hug',
	'awoo',
	'kiss',
	'lick',
	'pat',
	'smug',
	'bonk',
	'yeet',
	'blush',
	'smile',
	'wave',
	'highfive',
	'handhold',
	'nom',
	'bite',
	'glomp',
	'slap',
	'kill',
	'kick',
	'happy',
	'wink',
	'poke',
	'dance',
	'cringe'
]

const NSFW = ['waifu', 'neko', 'trap', 'blowjob']

/**
 * @typedef {Object} WaifuImage
 * @property {string} url
 * @property {string} category
 * @property {'sfw' | 'nsfw'} type
 */

const ensureCategory = (type, category) => {
	const list = type === 'nsfw' ? NSFW : SFW
	if (!list.includes(category)) {
		throw new InvalidInputError(`unknown ${type} category: ${category}`, { source: SOURCE })
	}
}

/**
 * Fetch a random image URL from waifu.pics for the given category.
 *
 * @param {string} category
 * @param {{ type?: 'sfw' | 'nsfw', retries?: number }} [options]
 * @returns {Promise<WaifuImage>}
 */
export const waifuImage = async (category, options = {}) => {
	if (typeof category !== 'string' || !category.trim()) {
		throw new InvalidInputError('category is required', { source: SOURCE })
	}
	const type = options.type === 'nsfw' ? 'nsfw' : 'sfw'
	const cat = category.trim().toLowerCase()
	ensureCategory(type, cat)
	const url = `${API}/${type}/${encodeURIComponent(cat)}`
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('waifu.pics returned non-JSON', { source: SOURCE, url, cause: error })
	}
	if (!json?.url) {
		throw new ParseError('waifu.pics response missing url', { source: SOURCE, url })
	}
	return { url: String(json.url), category: cat, type }
}

/**
 * List supported categories.
 *
 * @returns {{ sfw: string[], nsfw: string[] }}
 */
export const listWaifuCategories = () => ({ sfw: [...SFW], nsfw: [...NSFW] })
