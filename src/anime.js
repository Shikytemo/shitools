const JIKAN_BASE_URL = 'https://api.jikan.moe/v4'

const jikanRequest = async path => {
	const response = await fetch(`${JIKAN_BASE_URL}${path}`, {
		headers: {
			accept: 'application/json',
			'user-agent': process.env.USER_AGENT || 'Shitools/1.0'
		}
	})

	if (!response.ok) {
		throw new Error(`Jikan request failed ${response.status} ${response.statusText}`)
	}

	return response.json()
}

const compactAnime = item => ({
	malId: item.mal_id,
	url: item.url,
	title: item.title,
	titleEnglish: item.title_english,
	titleJapanese: item.title_japanese,
	type: item.type,
	source: item.source,
	episodes: item.episodes,
	status: item.status,
	airing: item.airing,
	duration: item.duration,
	rating: item.rating,
	score: item.score,
	rank: item.rank,
	popularity: item.popularity,
	synopsis: item.synopsis,
	season: item.season,
	year: item.year,
	image: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || null,
	trailer: item.trailer?.url || null,
	genres: item.genres || [],
	studios: item.studios || []
})

const compactManga = item => ({
	malId: item.mal_id,
	url: item.url,
	title: item.title,
	titleEnglish: item.title_english,
	titleJapanese: item.title_japanese,
	type: item.type,
	chapters: item.chapters,
	volumes: item.volumes,
	status: item.status,
	publishing: item.publishing,
	score: item.score,
	rank: item.rank,
	popularity: item.popularity,
	synopsis: item.synopsis,
	image: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || null,
	genres: item.genres || [],
	authors: item.authors || []
})

export const searchAnime = async (query, options = {}) => {
	const params = new URLSearchParams({
		q: query,
		limit: String(options.limit || 10),
		page: String(options.page || 1)
	})
	if (options.type) params.set('type', options.type)
	if (options.status) params.set('status', options.status)
	if (options.rating) params.set('rating', options.rating)
	if (options.orderBy) params.set('order_by', options.orderBy)
	if (options.sort) params.set('sort', options.sort)

	const data = await jikanRequest(`/anime?${params}`)

	return {
		query,
		pagination: data.pagination,
		results: (data.data || []).map(compactAnime)
	}
}

export const getAnimeById = async id => {
	const data = await jikanRequest(`/anime/${id}/full`)
	return compactAnime(data.data || {})
}

export const searchManga = async (query, options = {}) => {
	const params = new URLSearchParams({
		q: query,
		limit: String(options.limit || 10),
		page: String(options.page || 1)
	})
	if (options.type) params.set('type', options.type)
	if (options.status) params.set('status', options.status)
	if (options.orderBy) params.set('order_by', options.orderBy)
	if (options.sort) params.set('sort', options.sort)

	const data = await jikanRequest(`/manga?${params}`)

	return {
		query,
		pagination: data.pagination,
		results: (data.data || []).map(compactManga)
	}
}

export const getMangaById = async id => {
	const data = await jikanRequest(`/manga/${id}/full`)
	return compactManga(data.data || {})
}
