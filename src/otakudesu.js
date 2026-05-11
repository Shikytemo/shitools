import * as cheerio from 'cheerio'

const OTAKUDESU_BASE_URL = 'https://otakudesu.fit'

const defaultHeaders = {
	accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
	'user-agent': process.env.USER_AGENT || 'Shitools/1.0'
}

const baseUrl = options => String(options.baseUrl || process.env.OTAKUDESU_BASE_URL || OTAKUDESU_BASE_URL).replace(/\/+$/, '')

const cleanText = value => String(value || '').replace(/\s+/g, ' ').trim()

const absoluteUrl = (url, options = {}) => {
	if (!url) return ''

	try {
		return new URL(url, `${baseUrl(options)}/`).toString()
	} catch {
		return ''
	}
}

const uniqueByUrl = items => {
	const seen = new Set()
	return items.filter(item => {
		if (!item.url || seen.has(item.url)) return false
		seen.add(item.url)
		return true
	})
}

const isOtakudesuUrl = input => {
	try {
		const url = /^https?:\/\//i.test(input) ? input : `https://${input}`
		return new URL(url).hostname.includes('otakudesu')
	} catch {
		return false
	}
}

const isEpisodeUrl = url => /\/episode\//i.test(url)
const isSeriesUrl = url => /\/anime\/[^/]+\/?$/i.test(url) || /\/series\//i.test(url)

export const getOtakudesuEpisodeNumber = text => {
	const explicit = String(text || '').match(/\b(?:episode|eps?|ep)\s*(\d+)\b/i)
	if (explicit) return Number(explicit[1])

	const fromUrl = String(text || '').match(/episode-(\d+)/i)
	return fromUrl ? Number(fromUrl[1]) : null
}

export const fetchOtakudesuHtml = async (url, options = {}) => {
	const timeoutMs = Number(options.timeoutMs || process.env.REQUEST_TIMEOUT_MS || 30000)
	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), timeoutMs)

	try {
		const response = await fetch(url, {
			...options.fetchOptions,
			headers: {
				...defaultHeaders,
				...options.headers
			},
			signal: options.signal || controller.signal
		})

		if (!response.ok) {
			throw new Error(`Otakudesu request failed ${response.status} ${response.statusText}`)
		}

		return response.text()
	} finally {
		clearTimeout(timer)
	}
}

export const parseOtakudesuEpisodePage = (html, pageUrl, options = {}) => {
	const $ = cheerio.load(html)
	const mirrors = []

	$('iframe[src]').each((_, element) => {
		const url = $(element).attr('src')
		if (url) mirrors.push({ name: `Server ${mirrors.length + 1}`, url })
	})

	$('.mirror option[value]').each((_, element) => {
		const value = $(element).attr('value')
		if (!value) return

		let decoded = ''
		try {
			decoded = Buffer.from(String(value), 'base64').toString('utf8')
		} catch {
			decoded = value
		}

		const $$ = cheerio.load(decoded)
		const iframeUrl = $$('iframe[src]').first().attr('src')
		if (!iframeUrl) return

		mirrors.push({
			name: cleanText($(element).text()) || `Server ${mirrors.length + 1}`,
			url: iframeUrl
		})
	})

	const title =
		cleanText($('meta[property="og:title"]').attr('content')) ||
		cleanText($('h1.entry-title').first().text()) ||
		cleanText($('title').first().text())
	const image =
		absoluteUrl($('meta[property="og:image"]').attr('content'), options) ||
		absoluteUrl($('.thumb img').first().attr('src'), options)
	const seriesUrl =
		absoluteUrl($('.naveps .nvsc a[href]').first().attr('href'), options) ||
		absoluteUrl($('[rel="tag"]').first().attr('href'), options)
	const prevUrl = absoluteUrl($('.naveps a[rel="prev"]').first().attr('href'), options)
	const nextUrl = absoluteUrl($('.naveps a[rel="next"]').first().attr('href'), options)

	return {
		url: pageUrl,
		title,
		image,
		seriesUrl,
		prevUrl,
		nextUrl,
		mirrors: uniqueByUrl(mirrors)
	}
}

export const parseOtakudesuSearchPage = (html, options = {}) => {
	const $ = cheerio.load(html)
	const results = []

	$('.bsx a[href], .listupd .bs a[href], article a[href]').each((_, element) => {
		const url = absoluteUrl($(element).attr('href'), options)
		if (!url) return

		const title =
			cleanText($(element).attr('title')) ||
			cleanText($(element).find('.tt, h2, .entry-title').first().text()) ||
			cleanText($(element).text())
		const image = absoluteUrl($(element).find('img[src]').first().attr('src'), options)

		if (title) {
			results.push({
				title,
				url,
				image,
				type: isEpisodeUrl(url) ? 'episode' : isSeriesUrl(url) ? 'series' : 'unknown'
			})
		}
	})

	const limit = Number(options.limit || 10)
	return uniqueByUrl(results)
		.filter(item => item.type !== 'unknown')
		.slice(0, Number.isFinite(limit) && limit > 0 ? limit : 10)
}

export const parseLatestOtakudesuPage = (html, options = {}) => {
	const $ = cheerio.load(html)
	const results = []

	$('.bsx a[href], .listupd .bs a[href]').each((_, element) => {
		const url = absoluteUrl($(element).attr('href'), options)
		if (!url) return

		const title =
			cleanText($(element).attr('title')) ||
			cleanText($(element).find('.tt, h2, .entry-title').first().text()) ||
			cleanText($(element).text())
		const image = absoluteUrl($(element).find('img[src]').first().attr('src'), options)

		results.push({
			title,
			url,
			image,
			episode: getOtakudesuEpisodeNumber(title) || getOtakudesuEpisodeNumber(url),
			type: 'episode'
		})
	})

	const limit = Number(options.limit || 20)
	return uniqueByUrl(results).slice(0, Number.isFinite(limit) && limit > 0 ? limit : 20)
}

export const parseOtakudesuSeriesPage = (html, options = {}) => {
	const $ = cheerio.load(html)
	const episodes = []

	$('.eplister a[href], a[href*="episode"], .episodelist a[href]').each((_, element) => {
		const url = absoluteUrl($(element).attr('href'), options)
		if (!url) return

		const title = cleanText($(element).text()) || cleanText($(element).attr('title')) || url
		episodes.push({
			title,
			url,
			episode: getOtakudesuEpisodeNumber(title) || getOtakudesuEpisodeNumber(url)
		})
	})

	// Also check the episode list on the anime page itself
	$('.epcheck a[href], .eplist a[href]').each((_, element) => {
		const url = absoluteUrl($(element).attr('href'), options)
		if (!url) return

		const title = cleanText($(element).text()) || cleanText($(element).attr('title')) || url
		if (!episodes.some(e => e.url === url)) {
			episodes.push({
				title,
				url,
				episode: getOtakudesuEpisodeNumber(title) || getOtakudesuEpisodeNumber(url)
			})
		}
	})

	return uniqueByUrl(episodes)
}

export const getOtakudesuSeriesEpisodes = async (seriesUrl, options = {}) => {
	if (!seriesUrl) return []

	const html = await fetchOtakudesuHtml(seriesUrl, options)
	return parseOtakudesuSeriesPage(html, options)
}

export const resolveOtakudesuEpisode = async ({ seriesUrl, episodeNumber, ...options }) => {
	const episodes = await getOtakudesuSeriesEpisodes(seriesUrl, options)
	if (!episodes.length) return { episodeUrl: '', episodes }

	if (episodeNumber) {
		const selected = episodes.find(item => item.episode === episodeNumber)
		if (selected) return { episodeUrl: selected.url, episodes }
	}

	return { episodeUrl: episodes[0].url, episodes }
}

const seriesSearchQuery = text =>
	cleanText(String(text || '').replace(/\b(?:episode|eps?|ep)\s*\d+\b/ig, ''))

export const searchOtakudesu = async (query, options = {}) => {
	const cleanQuery = cleanText(query)
	if (!cleanQuery) throw new Error('Otakudesu query is required')

	const url = `${baseUrl(options)}/?s=${encodeURIComponent(cleanQuery)}`
	const html = await fetchOtakudesuHtml(url, options)
	return {
		query: cleanQuery,
		url,
		results: parseOtakudesuSearchPage(html, options)
	}
}

export const getLatestOtakudesu = async (options = {}) => {
	const url = options.url || baseUrl(options)
	const html = await fetchOtakudesuHtml(url, options)

	return {
		url,
		results: parseLatestOtakudesuPage(html, options)
	}
}

export const getOtakudesuStream = async (input, options = {}) => {
	const text = cleanText(input)
	if (!text) throw new Error('Otakudesu episode URL or query is required')

	let episodeUrl = ''
	let search = null
	let episodes = []
	const episodeNumber = getOtakudesuEpisodeNumber(text)

	if (isOtakudesuUrl(text)) {
		const url = absoluteUrl(text, options)
		if (isSeriesUrl(url)) {
			const resolved = await resolveOtakudesuEpisode({ ...options, seriesUrl: url, episodeNumber })
			episodeUrl = resolved.episodeUrl
			episodes = resolved.episodes
		} else {
			episodeUrl = url
		}
	} else {
		search = await searchOtakudesu(seriesSearchQuery(text) || text, options)
		const directEpisode = search.results.find(item => item.type === 'episode')
		const series = search.results.find(item => item.type === 'series')

		if (directEpisode) {
			episodeUrl = directEpisode.url
		} else if (series) {
			const resolved = await resolveOtakudesuEpisode({ ...options, seriesUrl: series.url, episodeNumber })
			episodeUrl = resolved.episodeUrl
			episodes = resolved.episodes
		}
	}

	if (!episodeUrl) {
		return {
			ok: false,
			text: 'Otakudesu episode not found'
		}
	}

	const html = await fetchOtakudesuHtml(episodeUrl, options)
	const episode = parseOtakudesuEpisodePage(html, episodeUrl, options)
	if (!episodes.length && episode.seriesUrl) {
		episodes = await getOtakudesuSeriesEpisodes(episode.seriesUrl, options).catch(() => [])
	}
	episode.episodes = episodes

	if (!episode.mirrors.length) {
		return {
			ok: false,
			text: 'Otakudesu stream not found on episode page'
		}
	}

	return {
		ok: true,
		search,
		episode
	}
}

export const otakudesu = getOtakudesuStream