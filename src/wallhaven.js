/**
 * Wallpaper search via wallhaven.cc public API. No API key required for SFW.
 *
 * @example
 * import { searchWallhaven } from '@shikytemo/shitools'
 * const wallpapers = await searchWallhaven('cyberpunk', { limit: 8 })
 */

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'wallhaven'
const BASE = 'https://wallhaven.cc/api/v1/search'

/**
 * @typedef {Object} Wallpaper
 * @property {string} id
 * @property {string} url            Image URL (jpg/png).
 * @property {string} thumbnail
 * @property {string} pageUrl        Wallhaven web page.
 * @property {string} resolution     e.g. `1920x1080`.
 * @property {string} ratio
 * @property {number} fileSize       In bytes.
 * @property {string} category       `general` | `anime` | `people`.
 * @property {string} purity         `sfw` | `sketchy` | `nsfw`.
 * @property {string[]} colors
 */

/**
 * Search wallpapers. Defaults to SFW + general+anime categories.
 *
 * @param {string} query
 * @param {{ limit?: number, category?: string, purity?: string, sorting?: string, retries?: number }} [options]
 * @returns {Promise<Wallpaper[]>}
 */
export const searchWallhaven = async (query, options = {}) => {
	if (typeof query !== 'string' || !query.trim()) {
		throw new InvalidInputError('query is required', { source: SOURCE })
	}
	const limit = Math.max(1, Math.min(24, Number(options.limit ?? 12)))
	const category = options.category ?? '110' // general + anime
	const purity = options.purity ?? '100' // sfw only
	const sorting = options.sorting ?? 'relevance'
	const url = `${BASE}?q=${encodeURIComponent(query.trim())}&categories=${category}&purity=${purity}&sorting=${encodeURIComponent(sorting)}`
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('wallhaven returned non-JSON', { source: SOURCE, url, cause: error })
	}
	const data = Array.isArray(json?.data) ? json.data : []
	return data.slice(0, limit).map(w => ({
		id: String(w.id ?? ''),
		url: w.path ?? '',
		thumbnail: w.thumbs?.large ?? w.thumbs?.original ?? '',
		pageUrl: w.url ?? '',
		resolution: w.resolution ?? '',
		ratio: w.ratio ?? '',
		fileSize: Number(w.file_size ?? 0),
		category: w.category ?? '',
		purity: w.purity ?? '',
		colors: Array.isArray(w.colors) ? w.colors : []
	}))
}
