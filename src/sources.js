import { getRandomKatanimeQuotes, searchKatanimeQuotes } from './indo.js'
import { pinterest, scrapePinterest, searchPinterest } from './pinterest.js'
import { getLatestSamehadaku, getSamehadakuStream, searchSamehadaku } from './samehadaku.js'
import { getLatestOtakudesu, getOtakudesuStream, searchOtakudesu } from './otakudesu.js'
import { getLatestAnoboy, getAnoboyStream, searchAnoboy } from './anoboy.js'
import { searchSpotifyTracks, spotifyDl } from './spotify.js'
import { sourceProfiles } from './source-profiles.js'
import { scrapeWebsite } from './web.js'

const clean = value =>
	String(value || '')
		.replace(/\s+/g, ' ')
		.trim()

const builtInSources = [
	{
		id: 'samehadaku',
		name: 'Samehadaku',
		category: 'Anime',
		type: 'scraper',
		url: 'https://samehadaku.co',
		homepage: 'https://samehadaku.co',
		description: 'Anime search, latest episode, series episode, and stream resolver.',
		auth: 'none',
		https: true,
		cors: 'Unknown',
		tags: ['anime', 'stream', 'indonesia', 'samehadaku'],
		supports: ['search', 'scrape', 'latest', 'stream'],
		search: searchSamehadaku,
		scrape: getSamehadakuStream,
		latest: getLatestSamehadaku
	},
	{
		id: 'pinterest',
		name: 'Pinterest',
		category: 'Social',
		type: 'scraper',
		url: 'https://www.pinterest.com',
		homepage: 'https://www.pinterest.com',
		description: 'Pinterest pin and keyword media scraper.',
		auth: 'none',
		https: true,
		cors: 'Unknown',
		tags: ['social', 'image', 'media', 'pinterest'],
		supports: ['search', 'scrape'],
		search: searchPinterest,
		scrape: scrapePinterest,
		run: pinterest
	},
	{
		id: 'katanime',
		name: 'Katanime',
		category: 'Anime',
		type: 'public-api',
		url: 'https://katanime.vercel.app',
		homepage: 'https://katanime.vercel.app',
		description: 'Indonesian anime quote public API.',
		auth: 'none',
		https: true,
		cors: 'Unknown',
		tags: ['anime', 'quote', 'indonesia'],
		supports: ['search', 'random'],
		search: searchKatanimeQuotes,
		random: getRandomKatanimeQuotes
	},
	{
		id: 'otakudesu',
		name: 'Otakudesu',
		category: 'Anime',
		type: 'scraper',
		url: 'https://otakudesu.fit',
		homepage: 'https://otakudesu.fit',
		description: 'Anime search, latest episode, series episode, and stream resolver.',
		auth: 'none',
		https: true,
		cors: 'Unknown',
		tags: ['anime', 'stream', 'indonesia', 'otakudesu'],
		supports: ['search', 'scrape', 'latest', 'stream'],
		search: searchOtakudesu,
		scrape: getOtakudesuStream,
		latest: getLatestOtakudesu
	},
	{
		id: 'anoboy',
		name: 'Anoboy',
		category: 'Anime',
		type: 'scraper',
		url: 'https://anoboy.cv',
		homepage: 'https://anoboy.cv',
		description: 'Anime search, latest episode, series episode, and stream resolver.',
		auth: 'none',
		https: true,
		cors: 'Unknown',
		tags: ['anime', 'stream', 'indonesia', 'anoboy'],
		supports: ['search', 'scrape', 'latest', 'stream'],
		search: searchAnoboy,
		scrape: getAnoboyStream,
		latest: getLatestAnoboy
	},
	{
		id: 'spotify',
		name: 'Spotify',
		category: 'Music',
		type: 'scraper',
		url: 'https://open.spotify.com',
		homepage: 'https://open.spotify.com',
		description: 'Spotify track search, metadata, and MP3 download via fabdl.',
		auth: 'client-credentials',
		https: true,
		cors: 'Unknown',
		tags: ['music', 'spotify', 'download', 'stream'],
		supports: ['search', 'scrape', 'download'],
		search: searchSpotifyTracks,
		scrape: spotifyDl
	}
]

const sourceMethods = new Map(builtInSources.map(source => [source.id, source]))

const publicCatalog = sourceProfiles.map(profile => ({
	...profile,
	supports: ['metadata', 'fetch']
}))

export const sourceCatalog = [
	...builtInSources.map(({ search, scrape, latest, run, random, ...profile }) => profile),
	...publicCatalog
]

const matchesFilter = (profile, filter = {}) => {
	if (
		filter.category &&
		clean(profile.category).toLowerCase() !== clean(filter.category).toLowerCase()
	)
		return false
	if (filter.type && profile.type !== filter.type) return false
	if (filter.auth && profile.auth !== filter.auth) return false
	if (filter.https !== undefined && Boolean(profile.https) !== Boolean(filter.https)) return false
	if (
		filter.tag &&
		!(profile.tags || []).some(tag => tag.toLowerCase() === clean(filter.tag).toLowerCase())
	)
		return false

	const query = clean(filter.query || filter.q).toLowerCase()
	if (query) {
		const haystack = [
			profile.id,
			profile.name,
			profile.category,
			profile.description,
			...(profile.tags || [])
		]
			.join(' ')
			.toLowerCase()
		if (!haystack.includes(query)) return false
	}

	return true
}

export const listSources = (filter = {}) => {
	const limit = Number(filter.limit || 0)
	const results = sourceCatalog.filter(profile => matchesFilter(profile, filter))
	return limit > 0 ? results.slice(0, limit) : results
}

export const searchSources = (query, options = {}) =>
	listSources({
		...options,
		query
	})

export const getSource = sourceId => {
	const id = clean(sourceId).toLowerCase()
	return sourceMethods.get(id) || sourceCatalog.find(profile => profile.id === id) || null
}

const assertSourceMethod = (sourceId, method) => {
	const source = sourceMethods.get(clean(sourceId).toLowerCase())
	if (!source || typeof source[method] !== 'function') {
		throw new Error(`Source ${sourceId} does not support ${method}.`)
	}

	return source[method]
}

export const searchSource = async (sourceId, query, options = {}) => {
	const search = assertSourceMethod(sourceId, 'search')
	return search(query, options)
}

export const scrapeSource = async (sourceId, input, options = {}) => {
	const scrape = assertSourceMethod(sourceId, 'scrape')
	return scrape(input, options)
}

export const latestSource = async (sourceId, options = {}) => {
	const latest = assertSourceMethod(sourceId, 'latest')
	return latest(options)
}

export const fetchSource = async (sourceId, options = {}) => {
	const source = getSource(sourceId)
	if (!source) throw new Error(`Source ${sourceId} not found.`)

	if (sourceMethods.has(source.id) && typeof sourceMethods.get(source.id).run === 'function') {
		return sourceMethods.get(source.id).run(options.input || source.url, options)
	}

	if (options.metadataOnly) return scrapeWebsite(source.url, options)

	const response = await fetch(source.url, {
		...options,
		headers: {
			accept: options.accept || 'application/json, text/plain;q=0.8, text/html;q=0.5',
			'user-agent': process.env.USER_AGENT || 'Shitools/1.0',
			...(options.headers || {})
		}
	})
	if (!response.ok)
		throw new Error(`Source request failed ${response.status} ${response.statusText}`)

	const contentType = response.headers.get('content-type') || ''
	if (contentType.includes('application/json')) {
		return {
			source,
			data: await response.json()
		}
	}

	return {
		source,
		text: await response.text()
	}
}

export const sources = Object.freeze(
	Object.fromEntries(builtInSources.map(source => [source.id, Object.freeze(source)]))
)
