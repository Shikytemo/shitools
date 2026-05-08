/**
 * Lyrics lookup — combines Genius search (for metadata + correct
 * artist/title) with the free `lyrics.ovh` endpoint (for the actual
 * lyrics text). Both are public, no API key needed.
 *
 * @example
 * import { lyrics, searchLyrics, getLyrics } from '@shikytemo/shitools'
 *
 * const hits = await searchLyrics('someone you loved')
 * console.log(hits[0])
 *
 * const song = await getLyrics('Lewis Capaldi', 'Someone You Loved')
 * console.log(song.lyrics)
 *
 * // smart: pass anything the user typed
 * await lyrics('lewis capaldi someone you loved')
 * await lyrics('Adele - Hello')
 */

import { InvalidInputError, ParseError, RateLimitError, ScrapeError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'lyrics'
const GENIUS_SEARCH_URL = 'https://genius.com/api/search/multi'
const LYRICS_OVH_URL = 'https://api.lyrics.ovh/v1'

const cleanText = value => (typeof value === 'string' ? value.trim() : undefined)

/**
 * @typedef {Object} LyricsHit
 * @property {string} id
 * @property {string} title
 * @property {string} artist
 * @property {string} fullTitle
 * @property {string} url               Genius URL (web page, not lyrics text).
 * @property {string} [thumbnail]
 * @property {string} [releaseDate]
 */

const normalizeHit = hit => {
	const result = hit?.result ?? {}
	const artist = result.primary_artist?.name ?? result.artist_names ?? ''
	return {
		id: result.id != null ? String(result.id) : '',
		title: cleanText(result.title) ?? '',
		artist: cleanText(artist) ?? '',
		fullTitle: cleanText(result.full_title) ?? '',
		url: cleanText(result.url) ?? '',
		thumbnail: cleanText(result.song_art_image_thumbnail_url ?? result.header_image_thumbnail_url),
		releaseDate: cleanText(result.release_date_for_display)
	}
}

/**
 * Search Genius for songs matching the query. Returns up to 10 hits.
 * No API key required — Genius's `/api/search/multi` is publicly readable.
 *
 * @param {string} query
 * @param {{ retries?: number, timeout?: number }} [options]
 * @returns {Promise<LyricsHit[]>}
 */
export const searchLyrics = async (query, options = {}) => {
	if (typeof query !== 'string' || !query.trim()) {
		throw new InvalidInputError('lyrics query is required', { source: SOURCE })
	}
	const url = `${GENIUS_SEARCH_URL}?q=${encodeURIComponent(query.trim())}&per_page=10`
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('Genius returned non-JSON response', {
			source: SOURCE,
			url,
			cause: error
		})
	}
	const sections = json?.response?.sections ?? []
	const songSection = sections.find(s => s.type === 'song')
	const hits = Array.isArray(songSection?.hits) ? songSection.hits : []
	return hits.map(normalizeHit).filter(hit => hit.title && hit.artist)
}

/**
 * @typedef {Object} LyricsResult
 * @property {string} artist
 * @property {string} title
 * @property {string} lyrics
 * @property {'lyrics.ovh'} source
 */

/**
 * Fetch lyrics text for an exact artist + title pair from lyrics.ovh.
 *
 * @param {string} artist
 * @param {string} title
 * @param {{ retries?: number, timeout?: number }} [options]
 * @returns {Promise<LyricsResult>}
 */
export const getLyrics = async (artist, title, options = {}) => {
	if (typeof artist !== 'string' || !artist.trim()) {
		throw new InvalidInputError('artist is required', { source: SOURCE })
	}
	if (typeof title !== 'string' || !title.trim()) {
		throw new InvalidInputError('title is required', { source: SOURCE })
	}
	const url = `${LYRICS_OVH_URL}/${encodeURIComponent(artist.trim())}/${encodeURIComponent(title.trim())}`
	let response
	try {
		response = await httpClient.get(url, { source: SOURCE, ...options })
	} catch (error) {
		if (error instanceof ScrapeError && error.status === 404) {
			throw new ScrapeError(`Lyrics not found for ${artist} — ${title}`, {
				source: SOURCE,
				url,
				status: 404,
				cause: error
			})
		}
		throw error
	}
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('lyrics.ovh returned non-JSON response', {
			source: SOURCE,
			url,
			cause: error
		})
	}
	if (typeof json?.lyrics !== 'string' || !json.lyrics.trim()) {
		throw new ScrapeError(json?.error ?? 'Lyrics not found', {
			source: SOURCE,
			url,
			status: response.status
		})
	}
	return {
		artist: artist.trim(),
		title: title.trim(),
		lyrics: json.lyrics.trim(),
		source: 'lyrics.ovh'
	}
}

const splitDashed = input => {
	const dashIndex = input.search(/\s[-–—]\s/)
	if (dashIndex === -1) return null
	const head = input.slice(0, dashIndex).trim()
	const tail = input.slice(dashIndex + 3).trim()
	if (!head || !tail) return null
	return { artist: head, title: tail }
}

/**
 * @typedef {LyricsResult & { fullTitle?: string, url?: string, thumbnail?: string }} LyricsDispatchResult
 */

/**
 * Smart dispatch:
 *   - If `input` contains ` - ` / ` – ` / ` — `, split into artist + title and
 *     fetch directly via {@link getLyrics}.
 *   - Otherwise search Genius via {@link searchLyrics} and fetch lyrics for
 *     the top hit. Returns the lyrics text plus the Genius hit's URL +
 *     thumbnail so callers can render a richer card.
 *
 * @param {string} input
 * @param {{ retries?: number, timeout?: number }} [options]
 * @returns {Promise<LyricsDispatchResult>}
 */
export const lyrics = async (input, options = {}) => {
	if (typeof input !== 'string' || !input.trim()) {
		throw new InvalidInputError('lyrics input is required', { source: SOURCE })
	}
	const split = splitDashed(input.trim())
	if (split) {
		return getLyrics(split.artist, split.title, options)
	}
	const hits = await searchLyrics(input, options)
	if (hits.length === 0) {
		throw new ScrapeError(`No Genius results for "${input}"`, { source: SOURCE })
	}
	const top = hits[0]
	const result = await getLyrics(top.artist, top.title, options)
	return {
		...result,
		fullTitle: top.fullTitle,
		url: top.url,
		thumbnail: top.thumbnail
	}
}

// re-exported so consumers can `instanceof`-branch against rate-limit edge cases
export { RateLimitError }
