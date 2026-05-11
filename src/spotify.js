import axios from 'axios'
import * as cheerio from 'cheerio'

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || 'acc6302297e040aeb6e4ac1fbdfd62c3'
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '0e8439a1280a43aba9a5bc0a16f3f009'
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token'

const cleanText = value => String(value || '').replace(/\s+/g, ' ').trim()

const isSpotifyUrl = input => {
	try {
		const url = /^https?:\/\//i.test(input) ? input : `https://${input}`
		return new URL(url).hostname.includes('spotify')
	} catch {
		return false
	}
}

const extractSpotifyId = (url, type = 'track') => {
	const patterns = {
		track: /\/track\/([a-zA-Z0-9]+)/,
		album: /\/album\/([a-zA-Z0-9]+)/,
		playlist: /\/playlist\/([a-zA-Z0-9]+)/,
		artist: /\/artist\/([a-zA-Z0-9]+)/
	}
	const match = String(url).match(patterns[type])
	return match ? match[1] : null
}

let cachedToken = null
let tokenExpiresAt = 0

export const getSpotifyAccessToken = async (options = {}) => {
	const now = Date.now()
	if (cachedToken && now < tokenExpiresAt) return cachedToken

	const clientId = options.clientId || SPOTIFY_CLIENT_ID
	const clientSecret = options.clientSecret || SPOTIFY_CLIENT_SECRET
	const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

	const response = await fetch(TOKEN_ENDPOINT, {
		method: 'POST',
		headers: {
			Authorization: `Basic ${basic}`,
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({ grant_type: 'client_credentials' })
	})

	if (!response.ok) {
		throw new Error(`Spotify token request failed ${response.status} ${response.statusText}`)
	}

	const data = await response.json()
	cachedToken = data.access_token
	tokenExpiresAt = now + (data.expires_in - 60) * 1000

	return cachedToken
}

const spotifyRequest = async (endpoint, options = {}) => {
	const token = await getSpotifyAccessToken(options)

	const maxRetries = Number(options.maxRetries || 2)
	let lastError = null

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` }
		})

		if (response.ok) return response.json()

		if (response.status === 429) {
			const retryAfter = Number(response.headers.get('retry-after') || 3)
			if (attempt < maxRetries) {
				await new Promise(resolve => setTimeout(resolve, (retryAfter + 1) * 1000))
				continue
			}
		}

		if (response.status === 401) {
			cachedToken = null
			tokenExpiresAt = 0
			if (attempt < maxRetries) continue
		}

		lastError = new Error(`Spotify API request failed ${response.status} ${response.statusText}`)
		break
	}

	throw lastError
}

const normalizeTrack = item => {
	if (!item) return null
	const artists = (item.artists || []).map(a => a.name).join(', ')
	const album = item.album || {}
	return {
		id: item.id,
		title: item.name,
		artists,
		album: album.name || null,
		albumImage: (album.images || [])[0]?.url || null,
		durationMs: item.duration_ms || 0,
		durationSec: Math.round((item.duration_ms || 0) / 1000),
		popularity: item.popularity || 0,
		previewUrl: item.preview_url || null,
		url: (item.external_urls || {}).spotify || null,
		explicit: item.explicit || false
	}
}

export const searchSpotifyTracks = async (query, options = {}) => {
	const cleanQuery = cleanText(query)
	if (!cleanQuery) throw new Error('Spotify search query is required')

	const limit = Number(options.limit || 20)
	const data = await spotifyRequest(`/search?q=${encodeURIComponent(cleanQuery)}&type=track&limit=${limit}`, options)

	return {
		query: cleanQuery,
		results: (data.tracks?.items || []).map(normalizeTrack).filter(Boolean)
	}
}

export const searchSpotifyAlbums = async (query, options = {}) => {
	const cleanQuery = cleanText(query)
	if (!cleanQuery) throw new Error('Spotify search query is required')

	const limit = Number(options.limit || 20)
	const data = await spotifyRequest(`/search?q=${encodeURIComponent(cleanQuery)}&type=album&limit=${limit}`, options)

	return {
		query: cleanQuery,
		results: (data.albums?.items || []).map(item => {
			if (!item) return null
			const artists = (item.artists || []).map(a => a.name).join(', ')
			return {
				id: item.id,
				name: item.name,
				artists,
				image: (item.images || [])[0]?.url || null,
				releaseDate: item.release_date || null,
				totalTracks: item.total_tracks || 0,
				url: (item.external_urls || {}).spotify || null
			}
		}).filter(Boolean)
	}
}

export const searchSpotifyArtists = async (query, options = {}) => {
	const cleanQuery = cleanText(query)
	if (!cleanQuery) throw new Error('Spotify search query is required')

	const limit = Number(options.limit || 20)
	const data = await spotifyRequest(`/search?q=${encodeURIComponent(cleanQuery)}&type=artist&limit=${limit}`, options)

	return {
		query: cleanQuery,
		results: (data.artists?.items || []).map(item => {
			if (!item) return null
			return {
				id: item.id,
				name: item.name,
				genres: item.genres || [],
				followers: item.followers?.total || 0,
				popularity: item.popularity || 0,
				image: (item.images || [])[0]?.url || null,
				url: (item.external_urls || {}).spotify || null
			}
		}).filter(Boolean)
	}
}

export const searchSpotifyPlaylists = async (query, options = {}) => {
	const cleanQuery = cleanText(query)
	if (!cleanQuery) throw new Error('Spotify search query is required')

	const limit = Number(options.limit || 20)
	const data = await spotifyRequest(`/search?q=${encodeURIComponent(cleanQuery)}&type=playlist&limit=${limit}`, options)

	return {
		query: cleanQuery,
		results: (data.playlists?.items || []).map(item => {
			if (!item) return null
			return {
				id: item.id,
				name: item.name,
				description: item.description || null,
				owner: item.owner?.display_name || null,
				tracksTotal: item.tracks?.total || 0,
				image: (item.images || [])[0]?.url || null,
				url: (item.external_urls || {}).spotify || null
			}
		}).filter(Boolean)
	}
}

export const getSpotifyTrack = async (trackId, options = {}) => {
	const id = extractSpotifyId(trackId, 'track') || trackId
	if (!id) throw new Error('Spotify track ID is required')

	const data = await spotifyRequest(`/tracks/${id}${options.market ? `?market=${options.market}` : ''}`, options)
	return normalizeTrack(data)
}

export const getSpotifyAlbum = async (albumId, options = {}) => {
	const id = extractSpotifyId(albumId, 'album') || albumId
	if (!id) throw new Error('Spotify album ID is required')

	const data = await spotifyRequest(`/albums/${id}`, options)
	const artists = (data.artists || []).map(a => a.name).join(', ')
	const tracks = (data.tracks?.items || []).map(item => ({
		id: item.id,
		title: item.name,
		durationMs: item.duration_ms || 0,
		trackNumber: item.track_number || 0,
		previewUrl: item.preview_url || null,
		url: (item.external_urls || {}).spotify || null
	}))

	return {
		id: data.id,
		name: data.name,
		artists,
		image: (data.images || [])[0]?.url || null,
		releaseDate: data.release_date || null,
		totalTracks: data.total_tracks || 0,
		label: data.label || null,
		genres: data.genres || [],
		tracks,
		url: (data.external_urls || {}).spotify || null
	}
}

export const getSpotifyPlaylistTracks = async (playlistId, options = {}) => {
	const id = extractSpotifyId(playlistId, 'playlist') || playlistId
	if (!id) throw new Error('Spotify playlist ID is required')

	const limit = Number(options.limit || 100)
	const data = await spotifyRequest(`/playlists/${id}/tracks?limit=${limit}`, options)

	const tracks = (data.items || []).map(item => {
		const track = item.track
		if (!track) return null
		return normalizeTrack(track)
	}).filter(Boolean)

	return {
		id: data.id || id,
		name: data.name || null,
		description: data.description || null,
		owner: data.owner?.display_name || null,
		tracksTotal: data.total || tracks.length,
		tracks
	}
}

export const getSpotifyArtist = async (artistId, options = {}) => {
	const id = extractSpotifyId(artistId, 'artist') || artistId
	if (!id) throw new Error('Spotify artist ID is required')

	const data = await spotifyRequest(`/artists/${id}`, options)
	return {
		id: data.id,
		name: data.name,
		genres: data.genres || [],
		followers: data.followers?.total || 0,
		popularity: data.popularity || 0,
		image: (data.images || [])[0]?.url || null,
		url: (data.external_urls || {}).spotify || null
	}
}

export const getSpotifyArtistTopTracks = async (artistId, options = {}) => {
	const id = extractSpotifyId(artistId, 'artist') || artistId
	if (!id) throw new Error('Spotify artist ID is required')

	const market = options.market || 'US'
	const data = await spotifyRequest(`/artists/${id}/top-tracks?market=${market}`, options)

	return {
		id,
		tracks: (data.tracks || []).map(normalizeTrack).filter(Boolean)
	}
}

const fetchEmbedMetadata = async (url, options = {}) => {
	const timeoutMs = Number(options.timeoutMs || 30000)
	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), timeoutMs)

	try {
		const embedUrl = url.replace('open.spotify.com', 'open.spotify.com/embed')
		const response = await fetch(embedUrl, {
			headers: {
				accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
				'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
			},
			signal: controller.signal
		})

		if (!response.ok) return null

		const html = await response.text()
		const $ = cheerio.load(html)

		const scriptTag = $('script#__NEXT_DATA__').first().html()
		if (!scriptTag) return null

		const nextData = JSON.parse(scriptTag)
		const props = nextData?.props?.pageProps

		if (!props || props.status === 404) return null

		const entity = props.track || props.state?.data?.entity || props.data?.entity
		if (!entity) return null

		const artists = (entity.artists || []).map(a => typeof a === 'string' ? a : (a.name || '')).filter(Boolean)

		return {
			title: entity.title || entity.name || null,
			artists: artists.join(', ') || null,
			album: entity.albumTitle || entity.album?.name || null,
			image: entity.imageUrl || (entity.album?.images || [])[0]?.url || null,
			durationMs: entity.durationMs || entity.duration_ms || 0,
			type: entity.type || 'track',
			uri: entity.uri || null,
			id: entity.id || null,
			previewUrl: entity.audioPreview?.url || entity.preview_url || null
		}
	} catch {
		return null
	} finally {
		clearTimeout(timer)
	}
}

const fabdlHeaders = {
	accept: 'application/json, text/plain, */*',
	'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
	'sec-ch-ua': '"Not)A;Brand";v="24", "Chromium";v="116"',
	'sec-ch-ua-mobile': '?1',
	'sec-ch-ua-platform': '"Android"',
	'sec-fetch-dest': 'empty',
	'sec-fetch-mode': 'cors',
	'sec-fetch-site': 'cross-site',
	Referer: 'https://spotifydownload.org/',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'user-agent': process.env.USER_AGENT || 'Shitools/1.0'
}

const tryFabdlDownload = async (url, options = {}) => {
	try {
		const getInfoResponse = await axios.get(`https://api.fabdl.com/spotify/get?url=${encodeURIComponent(url)}`, {
			headers: { ...fabdlHeaders, ...(options.headers || {}) },
			timeout: options.timeoutMs || 30000
		})

		const info = getInfoResponse.data?.result
		if (!info || !info.gid || !info.id) return null

		const convertResponse = await axios.get(`https://api.fabdl.com/spotify/mp3-convert-task/${info.gid}/${info.id}`, {
			headers: { ...fabdlHeaders, ...(options.headers || {}) },
			timeout: options.timeoutMs || 30000
		})

		const convertResult = convertResponse.data?.result
		if (!convertResult?.download_url) return null

		return `https://api.fabdl.com${convertResult.download_url}`
	} catch {
		return null
	}
}

export const spotifyDl = async (url, options = {}) => {
	const input = cleanText(url)
	if (!input) throw new Error('Spotify URL is required')

	if (!isSpotifyUrl(input)) {
		return {
			ok: false,
			text: 'Invalid Spotify URL'
		}
	}

	const normalizedUrl = input.startsWith('http') ? input : `https://${input}`

	const embedMeta = await fetchEmbedMetadata(normalizedUrl, options)

	if (!embedMeta) {
		return {
			ok: false,
			text: 'Spotify track info not found'
		}
	}

	let downloadUrl = null
	if (embedMeta.previewUrl) {
		downloadUrl = embedMeta.previewUrl
	}

	const fabdlUrl = await tryFabdlDownload(normalizedUrl, options)
	if (fabdlUrl) {
		downloadUrl = fabdlUrl
	}

	return {
		ok: Boolean(downloadUrl || embedMeta.previewUrl),
		...(downloadUrl ? {} : { text: 'No download URL available, preview only' }),
		title: embedMeta.title,
		type: embedMeta.type,
		artists: embedMeta.artists,
		album: embedMeta.album,
		durationMs: embedMeta.durationMs,
		image: embedMeta.image,
		previewUrl: embedMeta.previewUrl,
		download: downloadUrl
	}
}

export const SpotifyAPI = async (options = {}) => {
	const token = await getSpotifyAccessToken(options)

	return {
		searchTracks: (query, opts) => searchSpotifyTracks(query, { ...options, ...opts }),
		searchAlbums: (query, opts) => searchSpotifyAlbums(query, { ...options, ...opts }),
		searchArtists: (query, opts) => searchSpotifyArtists(query, { ...options, ...opts }),
		searchPlaylists: (query, opts) => searchSpotifyPlaylists(query, { ...options, ...opts }),
		getTrack: (id, opts) => getSpotifyTrack(id, { ...options, ...opts }),
		getAlbum: (id, opts) => getSpotifyAlbum(id, { ...options, ...opts }),
		getPlaylist: (id, opts) => getSpotifyPlaylistTracks(id, { ...options, ...opts }),
		getArtist: (id, opts) => getSpotifyArtist(id, { ...options, ...opts }),
		getArtistTopTracks: (id, opts) => getSpotifyArtistTopTracks(id, { ...options, ...opts }),
		download: (url, opts) => spotifyDl(url, { ...options, ...opts })
	}
}

export const spotify = spotifyDl