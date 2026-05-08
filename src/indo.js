const KATANIME_BASE_URL = 'https://katanime.vercel.app'

const requestJson = async (url, options = {}) => {
	const response = await fetch(url, {
		...options,
		headers: {
			accept: 'application/json',
			'user-agent': process.env.USER_AGENT || 'Shitools/1.0',
			...options.headers
		}
	})

	if (!response.ok) {
		throw new Error(`Request failed ${response.status} ${response.statusText}`)
	}

	return response.json()
}

const normalizeQuote = item => ({
	id: item.id || null,
	anime: item.anime || item.judul || item.title || null,
	character: item.character || item.karakter || item.nama || null,
	quote: item.indo || item.quote || item.kata || item.kata_indo || item.text || null,
	english: item.eng || item.english || item.kata_english || null,
	raw: item
})

const normalizeQuotesResponse = data => {
	const values = Array.isArray(data) ? data : data.result || data.data || data.results || []
	return (Array.isArray(values) ? values : [values]).filter(Boolean).map(normalizeQuote)
}

export const getRandomKatanimeQuotes = async (options = {}) => {
	const data = await requestJson(`${options.baseUrl || KATANIME_BASE_URL}/api/getrandom`, options)
	return normalizeQuotesResponse(data)
}

export const getKatanimeAnimeList = async (options = {}) => {
	const data = await requestJson(
		`${options.baseUrl || KATANIME_BASE_URL}/api/getlistanime`,
		options
	)
	const values = Array.isArray(data) ? data : data.result || data.data || data.results || []
	return Array.isArray(values) ? values : []
}

export const getKatanimeQuotesByAnime = async (anime, options = {}) => {
	const params = new URLSearchParams({
		anime,
		page: String(options.page || 1)
	})
	const data = await requestJson(
		`${options.baseUrl || KATANIME_BASE_URL}/api/getbyanime?${params}`,
		options
	)
	return {
		anime,
		page: Number(options.page || 1),
		results: normalizeQuotesResponse(data)
	}
}

export const searchKatanimeQuotes = async (kata, options = {}) => {
	const params = new URLSearchParams({
		kata,
		page: String(options.page || 1)
	})
	const data = await requestJson(
		`${options.baseUrl || KATANIME_BASE_URL}/api/carikata?${params}`,
		options
	)
	return {
		query: kata,
		page: Number(options.page || 1),
		results: normalizeQuotesResponse(data)
	}
}

export const katanime = {
	random: getRandomKatanimeQuotes,
	listAnime: getKatanimeAnimeList,
	byAnime: getKatanimeQuotesByAnime,
	search: searchKatanimeQuotes
}
