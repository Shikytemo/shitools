import axios from 'axios'
import * as cheerio from 'cheerio'

export const JINA_READER_BASE = 'https://r.jina.ai/http://'

const pinterestHeaders = {
	accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
	'user-agent': process.env.USER_AGENT || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
}

const mediaUrlRegex = /https?:\\?\/\\?\/(?:i|v)\.pinimg\.com\/[^"'\\\s<>)]+/gi
const urlRegex = /https?:\/\/[^"'\s<>)]+/gi

const cleanupUrl = value =>
	String(value || '')
		.replaceAll('\\/', '/')
		.replaceAll('\\u002F', '/')
		.replace(/[),.;]+$/g, '')
		.trim()

const uniqueBy = (items, key) => {
	const seen = new Set()
	return items.filter(item => {
		const value = item[key]
		if (!value || seen.has(value)) return false
		seen.add(value)
		return true
	})
}

const limitItems = (items, limit) => Number.isFinite(limit) && limit > 0 ? items.slice(0, limit) : items

const isPinterestUrl = input => {
	try {
		const value = /^https?:\/\//i.test(input) ? input : `https://${input}`
		const { hostname } = new URL(value)
		return /(^|\.)pinterest\./i.test(hostname) || hostname === 'pin.it'
	} catch {
		return false
	}
}

export const getPinterestSearchUrl = query =>
	`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(String(query || '').trim())}`

const normalizePinterestUrl = async (url, options = {}) => {
	const input = String(url || '').trim()
	if (!input) throw new Error('Pinterest URL is required')

	const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`
	const parsed = new URL(withProtocol)

	if (parsed.hostname === 'pin.it' && options.resolveShortUrl !== false) {
		const response = await axios.get(withProtocol, {
			headers: pinterestHeaders,
			maxRedirects: 0,
			validateStatus: status => status >= 200 && status < 400,
			timeout: options.timeoutMs || 30000
		}).catch(error => {
			const location = error.response?.headers?.location
			if (location) return { headers: { location } }
			throw error
		})
		const location = response.headers?.location
		if (location) return new URL(location, withProtocol).toString()
	}

	return withProtocol
}

export const toJinaReaderUrl = url => `${JINA_READER_BASE}${url}`

const fetchText = async (url, options = {}) => {
	const response = await axios.get(url, {
		headers: {
			...pinterestHeaders,
			...options.headers
		},
		maxRedirects: 5,
		timeout: options.timeoutMs || 30000,
		responseType: 'text',
		transformResponse: [data => data],
		validateStatus: status => status >= 200 && status < 500
	})

	if (response.status >= 400) {
		throw new Error(`Request failed ${response.status}`)
	}

	return String(response.data || '')
}

const fetchPinterestPage = async (url, options = {}) => {
	const attempts = []

	if (options.direct !== false) {
		attempts.push({ via: 'direct', url })
	}

	if (options.jina !== false) {
		attempts.push({ via: 'jina', url: toJinaReaderUrl(url) })
	}

	let lastError
	for (const attempt of attempts) {
		try {
			const text = await fetchText(attempt.url, options)
			if (text.trim()) {
				return {
					...attempt,
					html: text
				}
			}
		} catch (error) {
			lastError = error
		}
	}

	throw lastError || new Error('Unable to fetch Pinterest page')
}

const getMeta = ($, name) =>
	$(`meta[property="${name}"]`).attr('content') ||
	$(`meta[name="${name}"]`).attr('content') ||
	''

const pushMedia = (items, url, type = 'unknown', source = 'unknown', extra = {}) => {
	const clean = cleanupUrl(url)
	if (!clean || !/^https?:\/\//i.test(clean)) return
	const hostname = new URL(clean).hostname
	if (!['i.pinimg.com', 'v.pinimg.com'].includes(hostname)) return

	const lowered = clean.toLowerCase()
	const guessedType = type === 'unknown'
		? lowered.includes('.mp4') || lowered.includes('/videos/') || lowered.includes('v.pinimg.com') ? 'video' : 'image'
		: type

	items.push({
		type: guessedType,
		url: clean,
		source,
		...extra
	})
}

const walkJson = (value, items, source) => {
	if (!value) return
	if (typeof value === 'string') {
		if (/pinimg\.com/i.test(value)) {
			pushMedia(items, value, 'unknown', source)
		}
		return
	}

	if (Array.isArray(value)) {
		for (const item of value) walkJson(item, items, source)
		return
	}

	if (typeof value !== 'object') return

	for (const [key, child] of Object.entries(value)) {
		if (typeof child === 'string' && /(?:url|src|image|video|contentUrl|thumbnail)/i.test(key)) {
			pushMedia(items, child, /video/i.test(key) ? 'video' : 'unknown', source)
		}
		walkJson(child, items, source)
	}
}

const parseJsonScripts = ($, items) => {
	$('script[type="application/ld+json"], script#__PWS_DATA__, script[data-test-id], script').each((_, element) => {
		const raw = $(element).text().trim()
		if (!raw || !/[{[]/.test(raw) || !/pinimg|ImageObject|VideoObject|contentUrl/i.test(raw)) return

		const candidates = [raw]
		const jsonMatches = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/g) || []
		candidates.push(...jsonMatches)

		for (const candidate of candidates) {
			try {
				walkJson(JSON.parse(candidate), items, 'json')
			} catch {
				// Ignore non-JSON script chunks.
			}
		}
	})
}

const parseHtml = (html, pageUrl) => {
	const $ = cheerio.load(html)
	const media = []

	for (const [name, type] of [
		['og:image', 'image'],
		['twitter:image', 'image'],
		['og:video', 'video'],
		['og:video:url', 'video'],
		['twitter:player:stream', 'video']
	]) {
		pushMedia(media, getMeta($, name), type, `meta:${name}`)
	}

	$('img[src], img[srcset], video[src], source[src]').each((_, element) => {
		const tag = element.tagName?.toLowerCase()
		const type = tag === 'video' || tag === 'source' ? 'video' : 'image'
		pushMedia(media, $(element).attr('src'), type, 'dom')
		const srcset = $(element).attr('srcset')
		if (srcset) {
			for (const part of srcset.split(',')) {
				pushMedia(media, part.trim().split(/\s+/)[0], type, 'dom:srcset')
			}
		}
	})

	parseJsonScripts($, media)

	for (const match of html.match(mediaUrlRegex) || []) {
		pushMedia(media, match, 'unknown', 'regex')
	}

	for (const match of html.match(urlRegex) || []) {
		if (/pinimg\.com/i.test(match)) {
			pushMedia(media, match, 'unknown', 'regex-url')
		}
	}

	return {
		source_url: pageUrl,
		title: getMeta($, 'og:title') || $('title').first().text().trim(),
		description: getMeta($, 'og:description') || getMeta($, 'description'),
		media: uniqueBy(media, 'url')
	}
}

export const scrapePinterest = async (url, options = {}) => {
	const sourceUrl = await normalizePinterestUrl(url, options)
	const page = await fetchPinterestPage(sourceUrl, options)
	const parsed = parseHtml(page.html, sourceUrl)
	const media = limitItems(parsed.media, options.limit)

	return {
		mode: 'pin',
		source_url: sourceUrl,
		fetched_url: page.url,
		via: page.via,
		title: parsed.title,
		description: parsed.description,
		count: media.length,
		total: parsed.media.length,
		media
	}
}

export const searchPinterest = async (query, options = {}) => {
	const cleanQuery = String(query || '').trim()
	if (!cleanQuery) throw new Error('Pinterest search query is required')

	const sourceUrl = getPinterestSearchUrl(cleanQuery)
	const page = await fetchPinterestPage(sourceUrl, {
		direct: false,
		...options
	})
	const parsed = parseHtml(page.html, sourceUrl)
	const media = limitItems(parsed.media, options.limit || 10)

	return {
		mode: 'search',
		query: cleanQuery,
		source_url: sourceUrl,
		fetched_url: page.url,
		via: page.via,
		title: parsed.title || `Pinterest search: ${cleanQuery}`,
		description: parsed.description,
		count: media.length,
		total: parsed.media.length,
		media
	}
}

export const pinterest = async (input, options = {}) => {
	const text = String(input || '').trim()
	if (!text) throw new Error('Pinterest URL or search query is required')

	const nextOptions = {
		limit: options.limit || 10,
		...options
	}

	return isPinterestUrl(text) ? scrapePinterest(text, nextOptions) : searchPinterest(text, nextOptions)
}
