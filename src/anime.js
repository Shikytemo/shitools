const JIKAN_BASE_URL = 'https://api.jikan.moe/v4'

const compactImage = images =>
	images?.jpg?.large_image_url ||
	images?.webp?.large_image_url ||
	images?.jpg?.image_url ||
	images?.webp?.image_url ||
	null

const cleanArray = value => Array.isArray(value) ? value : []

const jikanRequest = async (path, options = {}) => {
	const response = await fetch(`${options.baseUrl || JIKAN_BASE_URL}${path}`, {
		...options,
		headers: {
			accept: 'application/json',
			'user-agent': process.env.USER_AGENT || 'Shitools/1.0',
			...options.headers
		}
	})

	if (!response.ok) {
		throw new Error(`Jikan request failed ${response.status} ${response.statusText}`)
	}

	return response.json()
}

const addParam = (params, key, value) => {
	if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
}

const searchParams = (query, options = {}) => {
	const params = new URLSearchParams()
	addParam(params, 'q', query)
	addParam(params, 'limit', options.limit || 10)
	addParam(params, 'page', options.page || 1)
	addParam(params, 'type', options.type)
	addParam(params, 'status', options.status)
	addParam(params, 'rating', options.rating)
	addParam(params, 'order_by', options.orderBy)
	addParam(params, 'sort', options.sort)
	addParam(params, 'genres', options.genres)
	addParam(params, 'genres_exclude', options.genresExclude)
	addParam(params, 'min_score', options.minScore)
	addParam(params, 'max_score', options.maxScore)
	addParam(params, 'start_date', options.startDate)
	addParam(params, 'end_date', options.endDate)
	addParam(params, 'sfw', options.sfw)
	addParam(params, 'letter', options.letter)
	return params
}

const compactRelation = item => ({
	malId: item.mal_id,
	type: item.type,
	name: item.name,
	url: item.url
})

const compactAnime = item => ({
	malId: item.mal_id,
	url: item.url,
	title: item.title,
	titleEnglish: item.title_english,
	titleJapanese: item.title_japanese,
	titles: cleanArray(item.titles),
	type: item.type,
	source: item.source,
	episodes: item.episodes,
	status: item.status,
	airing: item.airing,
	aired: item.aired,
	duration: item.duration,
	rating: item.rating,
	score: item.score,
	scoredBy: item.scored_by,
	rank: item.rank,
	popularity: item.popularity,
	members: item.members,
	favorites: item.favorites,
	synopsis: item.synopsis,
	background: item.background,
	season: item.season,
	year: item.year,
	broadcast: item.broadcast,
	image: compactImage(item.images),
	trailer: item.trailer?.url || null,
	trailerEmbed: item.trailer?.embed_url || null,
	genres: cleanArray(item.genres).map(compactRelation),
	themes: cleanArray(item.themes).map(compactRelation),
	demographics: cleanArray(item.demographics).map(compactRelation),
	studios: cleanArray(item.studios).map(compactRelation),
	producers: cleanArray(item.producers).map(compactRelation),
	relations: cleanArray(item.relations),
	streaming: cleanArray(item.streaming),
	external: cleanArray(item.external)
})

const compactManga = item => ({
	malId: item.mal_id,
	url: item.url,
	title: item.title,
	titleEnglish: item.title_english,
	titleJapanese: item.title_japanese,
	titles: cleanArray(item.titles),
	type: item.type,
	chapters: item.chapters,
	volumes: item.volumes,
	status: item.status,
	publishing: item.publishing,
	published: item.published,
	score: item.score,
	scoredBy: item.scored_by,
	rank: item.rank,
	popularity: item.popularity,
	members: item.members,
	favorites: item.favorites,
	synopsis: item.synopsis,
	background: item.background,
	image: compactImage(item.images),
	genres: cleanArray(item.genres).map(compactRelation),
	themes: cleanArray(item.themes).map(compactRelation),
	demographics: cleanArray(item.demographics).map(compactRelation),
	authors: cleanArray(item.authors).map(compactRelation),
	serializations: cleanArray(item.serializations).map(compactRelation),
	relations: cleanArray(item.relations),
	external: cleanArray(item.external)
})

const compactCharacter = item => ({
	malId: item.mal_id,
	url: item.url,
	name: item.name,
	nameKanji: item.name_kanji,
	nicknames: item.nicknames || [],
	favorites: item.favorites,
	about: item.about,
	image: compactImage(item.images),
	anime: cleanArray(item.anime).map(entry => ({
		role: entry.role,
		anime: compactRelation(entry.anime || {})
	})),
	manga: cleanArray(item.manga).map(entry => ({
		role: entry.role,
		manga: compactRelation(entry.manga || {})
	})),
	voices: cleanArray(item.voices)
})

const compactEpisode = item => ({
	malId: item.mal_id,
	url: item.url,
	title: item.title,
	titleJapanese: item.title_japanese,
	titleRomanji: item.title_romanji,
	aired: item.aired,
	score: item.score,
	filler: item.filler,
	recap: item.recap,
	forumUrl: item.forum_url
})

const compactReview = item => ({
	malId: item.mal_id,
	url: item.url,
	type: item.type,
	reactions: item.reactions,
	date: item.date,
	review: item.review,
	score: item.score,
	tags: item.tags || [],
	isSpoiler: item.is_spoiler,
	isPreliminary: item.is_preliminary,
	user: item.user
})

export const searchAnime = async (query, options = {}) => {
	const data = await jikanRequest(`/anime?${searchParams(query, options)}`, options)
	return {
		query,
		pagination: data.pagination,
		results: cleanArray(data.data).map(compactAnime)
	}
}

export const getAnimeById = async (id, options = {}) => {
	const data = await jikanRequest(`/anime/${id}/full`, options)
	return compactAnime(data.data || {})
}

export const getAnimeCharacters = async (id, options = {}) => {
	const data = await jikanRequest(`/anime/${id}/characters`, options)
	return cleanArray(data.data).map(item => ({
		role: item.role,
		favorites: item.favorites,
		character: compactCharacter(item.character || {}),
		voiceActors: cleanArray(item.voice_actors)
	}))
}

export const getAnimeEpisodes = async (id, options = {}) => {
	const params = new URLSearchParams()
	addParam(params, 'page', options.page || 1)
	const data = await jikanRequest(`/anime/${id}/episodes?${params}`, options)
	return {
		pagination: data.pagination,
		results: cleanArray(data.data).map(compactEpisode)
	}
}

export const getAnimePictures = async (id, options = {}) => {
	const data = await jikanRequest(`/anime/${id}/pictures`, options)
	return cleanArray(data.data).map(item => ({
		image: compactImage(item)
	})).filter(item => item.image)
}

export const getAnimeRecommendations = async (id, options = {}) => {
	const data = await jikanRequest(`/anime/${id}/recommendations`, options)
	return cleanArray(data.data).map(item => ({
		votes: item.votes,
		entry: compactAnime(item.entry || {})
	}))
}

export const getAnimeReviews = async (id, options = {}) => {
	const params = new URLSearchParams()
	addParam(params, 'page', options.page || 1)
	addParam(params, 'preliminary', options.preliminary)
	addParam(params, 'spoilers', options.spoilers)
	const data = await jikanRequest(`/anime/${id}/reviews?${params}`, options)
	return {
		pagination: data.pagination,
		results: cleanArray(data.data).map(compactReview)
	}
}

export const getRandomAnime = async (options = {}) => {
	const data = await jikanRequest('/random/anime', options)
	return compactAnime(data.data || {})
}

export const getTopAnime = async (options = {}) => {
	const params = new URLSearchParams()
	addParam(params, 'type', options.type)
	addParam(params, 'filter', options.filter)
	addParam(params, 'rating', options.rating)
	addParam(params, 'sfw', options.sfw)
	addParam(params, 'page', options.page || 1)
	addParam(params, 'limit', options.limit || 10)
	const data = await jikanRequest(`/top/anime?${params}`, options)
	return {
		pagination: data.pagination,
		results: cleanArray(data.data).map(compactAnime)
	}
}

export const getSeasonAnime = async (year, season, options = {}) => {
	const params = new URLSearchParams()
	addParam(params, 'page', options.page || 1)
	addParam(params, 'limit', options.limit || 10)
	addParam(params, 'filter', options.filter)
	addParam(params, 'sfw', options.sfw)
	addParam(params, 'continuing', options.continuing)
	const data = await jikanRequest(`/seasons/${year}/${season}?${params}`, options)
	return {
		year: Number(year),
		season,
		pagination: data.pagination,
		results: cleanArray(data.data).map(compactAnime)
	}
}

export const getCurrentSeasonAnime = async (options = {}) => {
	const params = new URLSearchParams()
	addParam(params, 'page', options.page || 1)
	addParam(params, 'limit', options.limit || 10)
	addParam(params, 'filter', options.filter)
	addParam(params, 'sfw', options.sfw)
	addParam(params, 'continuing', options.continuing)
	const data = await jikanRequest(`/seasons/now?${params}`, options)
	return {
		pagination: data.pagination,
		results: cleanArray(data.data).map(compactAnime)
	}
}

export const getUpcomingSeasonAnime = async (options = {}) => {
	const params = new URLSearchParams()
	addParam(params, 'page', options.page || 1)
	addParam(params, 'limit', options.limit || 10)
	addParam(params, 'filter', options.filter)
	addParam(params, 'sfw', options.sfw)
	const data = await jikanRequest(`/seasons/upcoming?${params}`, options)
	return {
		pagination: data.pagination,
		results: cleanArray(data.data).map(compactAnime)
	}
}

export const getAnimeGenres = async (options = {}) => {
	const data = await jikanRequest('/genres/anime', options)
	return cleanArray(data.data).map(compactRelation)
}

export const searchManga = async (query, options = {}) => {
	const data = await jikanRequest(`/manga?${searchParams(query, options)}`, options)
	return {
		query,
		pagination: data.pagination,
		results: cleanArray(data.data).map(compactManga)
	}
}

export const getMangaById = async (id, options = {}) => {
	const data = await jikanRequest(`/manga/${id}/full`, options)
	return compactManga(data.data || {})
}

export const getTopManga = async (options = {}) => {
	const params = new URLSearchParams()
	addParam(params, 'type', options.type)
	addParam(params, 'filter', options.filter)
	addParam(params, 'page', options.page || 1)
	addParam(params, 'limit', options.limit || 10)
	const data = await jikanRequest(`/top/manga?${params}`, options)
	return {
		pagination: data.pagination,
		results: cleanArray(data.data).map(compactManga)
	}
}

export const getRandomManga = async (options = {}) => {
	const data = await jikanRequest('/random/manga', options)
	return compactManga(data.data || {})
}

export const getMangaGenres = async (options = {}) => {
	const data = await jikanRequest('/genres/manga', options)
	return cleanArray(data.data).map(compactRelation)
}

export const searchCharacters = async (query, options = {}) => {
	const params = new URLSearchParams()
	addParam(params, 'q', query)
	addParam(params, 'limit', options.limit || 10)
	addParam(params, 'page', options.page || 1)
	addParam(params, 'order_by', options.orderBy)
	addParam(params, 'sort', options.sort)
	const data = await jikanRequest(`/characters?${params}`, options)
	return {
		query,
		pagination: data.pagination,
		results: cleanArray(data.data).map(compactCharacter)
	}
}

export const getCharacterById = async (id, options = {}) => {
	const data = await jikanRequest(`/characters/${id}/full`, options)
	return compactCharacter(data.data || {})
}

export const getRandomCharacter = async (options = {}) => {
	const data = await jikanRequest('/random/characters', options)
	return compactCharacter(data.data || {})
}

export const anime = searchAnime
export const manga = searchManga
export const character = searchCharacters
