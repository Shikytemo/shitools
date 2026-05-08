/**
 * Spotify track downloader via the public api.fabdl.com endpoint.
 * Returns metadata + a direct MP3 URL. No API key required.
 *
 * Note: fabdl is a third-party mirror. The endpoint occasionally changes
 * shape; failures surface as ParseError.
 *
 * @example
 * import { spotifyDl } from '@shikytemo/shitools'
 * const track = await spotifyDl('https://open.spotify.com/track/2takcwOaAZWiXQijPHIx7B')
 * console.log(track.title, track.download)
 */

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'spotifydl'
const FABDL = 'https://api.fabdl.com'
const SPOTIFY_RE = /^https?:\/\/(?:open\.)?spotify\.com\/(track|album|playlist)\/[a-zA-Z0-9]+/i

/**
 * @typedef {Object} SpotifyDlResult
 * @property {string} title
 * @property {string} type
 * @property {string} artists
 * @property {number} durationMs
 * @property {string} image
 * @property {string} download   Direct MP3 URL
 * @property {string} source     Original Spotify URL
 */

/**
 * Resolve a Spotify track URL to a direct MP3 download via fabdl.com.
 *
 * @param {string} url
 * @param {{ retries?: number }} [options]
 * @returns {Promise<SpotifyDlResult>}
 */
export const spotifyDl = async (url, options = {}) => {
	if (typeof url !== 'string' || !SPOTIFY_RE.test(url.trim())) {
		throw new InvalidInputError('valid Spotify URL required', { source: SOURCE })
	}
	const trimmed = url.trim()
	const lookupUrl = `${FABDL}/spotify/get?url=${encodeURIComponent(trimmed)}`
	const lookupRes = await httpClient.get(lookupUrl, {
		source: SOURCE,
		headers: { accept: 'application/json, text/plain, */*' },
		...options
	})
	let lookup
	try {
		lookup = JSON.parse(lookupRes.body)
	} catch (error) {
		throw new ParseError('fabdl returned non-JSON (lookup)', {
			source: SOURCE,
			url: lookupUrl,
			cause: error
		})
	}
	const meta = lookup?.result
	if (!meta?.gid || !meta?.id) {
		throw new ParseError('fabdl lookup missing gid/id', { source: SOURCE, url: lookupUrl })
	}
	const convertUrl = `${FABDL}/spotify/mp3-convert-task/${encodeURIComponent(meta.gid)}/${encodeURIComponent(meta.id)}`
	const convertRes = await httpClient.get(convertUrl, {
		source: SOURCE,
		headers: { accept: 'application/json, text/plain, */*' },
		...options
	})
	let convert
	try {
		convert = JSON.parse(convertRes.body)
	} catch (error) {
		throw new ParseError('fabdl returned non-JSON (convert)', {
			source: SOURCE,
			url: convertUrl,
			cause: error
		})
	}
	const downloadPath = convert?.result?.download_url
	if (!downloadPath) {
		throw new ParseError('fabdl convert missing download_url', { source: SOURCE, url: convertUrl })
	}
	return {
		title: meta.name ?? '',
		type: meta.type ?? 'track',
		artists: meta.artists ?? '',
		durationMs: Number(meta.duration_ms ?? 0),
		image: meta.image ?? '',
		download: downloadPath.startsWith('http') ? downloadPath : `${FABDL}${downloadPath}`,
		source: trimmed
	}
}
