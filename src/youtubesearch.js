/**
 * YouTube search via Piped (public proxy). Falls back to alternate hosts.
 * No API key required.
 *
 * @example
 * import { searchYoutube } from '@shikytemo/shitools'
 * const results = await searchYoutube('lo-fi beats', { limit: 5 })
 */

import { InvalidInputError, ParseError, ScrapeError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'youtube-search'

const PIPED_HOSTS = [
	'https://pipedapi.kavin.rocks',
	'https://pipedapi.adminforge.de',
	'https://pipedapi.tokhmi.xyz'
]

/**
 * @typedef {Object} YoutubeResult
 * @property {string} id
 * @property {string} title
 * @property {string} url
 * @property {string} channel
 * @property {string} thumbnail
 * @property {string} duration
 * @property {number} views
 * @property {string} uploaded
 */

const formatDuration = seconds => {
	const total = Number(seconds ?? 0)
	if (!Number.isFinite(total) || total <= 0) return ''
	const h = Math.floor(total / 3600)
	const m = Math.floor((total % 3600) / 60)
	const s = total % 60
	const pad = n => String(n).padStart(2, '0')
	return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/**
 * Search YouTube. Tries multiple Piped hosts on failure.
 *
 * @param {string} query
 * @param {{ limit?: number, retries?: number }} [options]
 * @returns {Promise<YoutubeResult[]>}
 */
export const searchYoutube = async (query, options = {}) => {
	if (typeof query !== 'string' || !query.trim()) {
		throw new InvalidInputError('query is required', { source: SOURCE })
	}
	const limit = Math.max(1, Math.min(50, Number(options.limit ?? 10)))
	let lastError
	for (const host of PIPED_HOSTS) {
		const url = `${host}/search?q=${encodeURIComponent(query.trim())}&filter=videos`
		try {
			const response = await httpClient.get(url, { source: SOURCE, ...options })
			let json
			try {
				json = JSON.parse(response.body)
			} catch (error) {
				throw new ParseError('piped returned non-JSON', { source: SOURCE, url, cause: error })
			}
			const items = Array.isArray(json?.items) ? json.items : []
			return items.slice(0, limit).map(it => {
				const id = it.url ? (String(it.url).split('=').pop() ?? '') : ''
				return {
					id,
					title: it.title ?? '',
					url: id ? `https://youtube.com/watch?v=${id}` : `${host}${it.url ?? ''}`,
					channel: it.uploaderName ?? '',
					thumbnail: it.thumbnail ?? '',
					duration: formatDuration(it.duration),
					views: Number(it.views ?? 0),
					uploaded: it.uploadedDate ?? ''
				}
			})
		} catch (error) {
			lastError = error
		}
	}
	throw new ScrapeError('All Piped hosts failed', { source: SOURCE, cause: lastError })
}
