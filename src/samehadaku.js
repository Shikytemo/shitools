import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as cheerio from 'cheerio'

const SAMEHADAKU_BASE_URL = 'https://samehadaku.co'
const SAMEHADAKU_LEGACY_BASE_URL = 'https://v1.samehadaku.how'
const SAMEHADAKU_LEGACY_AJAX_BASE_URL = 'https://v2.samehadaku.how'
const execFileAsync = promisify(execFile)

const defaultHeaders = {
	accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
	'user-agent': process.env.USER_AGENT || 'Shitools/1.0'
}

const baseUrl = options =>
	String(options.baseUrl || process.env.SAMEHADAKU_BASE_URL || SAMEHADAKU_BASE_URL).replace(
		/\/+$/,
		''
	)

const cleanText = value =>
	String(value || '')
		.replace(/\s+/g, ' ')
		.trim()

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

const isSamehadakuUrl = input => {
	try {
		const url = /^https?:\/\//i.test(input) ? input : `https://${input}`
		return new URL(url).hostname.includes('samehadaku')
	} catch {
		return false
	}
}

const isEpisodeUrl = url => /episode-\d+/i.test(url) || /-episode-/i.test(url)
const isSeriesUrl = url => /\/anime\/[^/]+\/?$/i.test(url)
const isDirectVideoUrl = url => /\.(?:mp4|webm|mkv)(?:[?#].*)?$/i.test(url)

export const getSamehadakuEpisodeNumber = text => {
	const explicit = String(text || '').match(/\b(?:episode|eps?|ep)\s*(\d+)\b/i)
	if (explicit) return Number(explicit[1])

	const fromUrl = String(text || '').match(/episode-(\d+)/i)
	return fromUrl ? Number(fromUrl[1]) : null
}

const seriesSearchQuery = text =>
	cleanText(String(text || '').replace(/\b(?:episode|eps?|ep)\s*\d+\b/gi, ''))

export const fetchSamehadakuHtml = async (url, options = {}) => {
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
			throw new Error(`Samehadaku request failed ${response.status} ${response.statusText}`)
		}

		return response.text()
	} finally {
		clearTimeout(timer)
	}
}

export const fetchSamehadakuHtmlWithCurl = async (url, options = {}) => {
	const { stdout } = await execFileAsync(
		'curl',
		['-s', '-L', '--compressed', '-A', options.userAgent || defaultHeaders['user-agent'], url],
		{
			encoding: 'utf8',
			maxBuffer: options.maxBuffer || 20 * 1024 * 1024,
			timeout: options.timeoutMs || 30000
		}
	)

	return stdout
}

const postSamehadakuAjaxWithCurl = async (url, data, options = {}) => {
	const { stdout } = await execFileAsync(
		'curl',
		[
			'-s',
			'-L',
			'--compressed',
			'-A',
			options.userAgent || defaultHeaders['user-agent'],
			'-H',
			'X-Requested-With: XMLHttpRequest',
			'-H',
			'Content-Type: application/x-www-form-urlencoded; charset=UTF-8',
			'--data-raw',
			data,
			url
		],
		{
			encoding: 'utf8',
			maxBuffer: options.maxBuffer || 10 * 1024 * 1024,
			timeout: options.timeoutMs || 30000
		}
	)

	return stdout
}

const extractIframeSrc = (html, options = {}) => {
	const $ = cheerio.load(html)
	return absoluteUrl($('iframe[src]').first().attr('src'), options)
}

const decodeMirrorValue = value => {
	try {
		return Buffer.from(String(value || ''), 'base64').toString('utf8')
	} catch {
		return ''
	}
}

export const parseSamehadakuEpisodePage = (html, pageUrl, options = {}) => {
	const $ = cheerio.load(html)
	const mirrors = []
	const firstIframe = extractIframeSrc(html, options)
	const schemaHeadline = cleanText(html.match(/"headline"\s*:\s*"([^"]+)"/)?.[1])

	if (firstIframe) {
		mirrors.push({
			name: 'Video',
			url: firstIframe
		})
	}

	$('select.mirror option[value]').each((_, element) => {
		const value = $(element).attr('value')
		if (!value) return

		const iframeHtml = decodeMirrorValue(value)
		const url = extractIframeSrc(iframeHtml, options)
		if (!url) return

		mirrors.push({
			name: cleanText($(element).text()) || `Server ${mirrors.length + 1}`,
			url
		})
	})

	const title =
		schemaHeadline ||
		cleanText($('meta[property="og:title"]').attr('content')) ||
		cleanText($('h1.entry-title').first().text()) ||
		cleanText($('title').first().text())
	const image =
		absoluteUrl($('meta[property="og:image"]').attr('content'), options) ||
		absoluteUrl($('.single-info .thumb img').first().attr('src'), options)
	const seriesUrl =
		absoluteUrl($('.naveps .nvsc a[href]').first().attr('href'), options) ||
		absoluteUrl($('[itemprop="partOfSeries"] a[href]').first().attr('href'), options)
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

export const parseSamehadakuSearchPage = (html, options = {}) => {
	const $ = cheerio.load(html)
	const results = []

	$('article, .bsx, .listupd .bs, .postbody .bixbox').each((_, element) => {
		const link = $(element).find('a[href]').first()
		const url = absoluteUrl(link.attr('href'), options)
		if (!url) return

		const title =
			cleanText(link.attr('title')) ||
			cleanText($(element).find('h2, .tt, .entry-title, a').first().text())
		const image = absoluteUrl($(element).find('img[src]').first().attr('src'), options)
		results.push({ title, url, image })
	})

	const limit = Number(options.limit || 10)
	return uniqueByUrl(results)
		.filter(item => item.title && (isEpisodeUrl(item.url) || isSeriesUrl(item.url)))
		.map(item => ({
			...item,
			type: isEpisodeUrl(item.url) ? 'episode' : 'series'
		}))
		.slice(0, Number.isFinite(limit) && limit > 0 ? limit : 10)
}

export const parseLatestSamehadakuPage = (html, options = {}) => {
	const $ = cheerio.load(html)
	const results = []

	$('.listupd .bs, .bsx, .postbody article, article').each((_, element) => {
		const link = $(element).find('a[href*="episode"]').first()
		const url = absoluteUrl(link.attr('href'), options)
		if (!url || !isEpisodeUrl(url)) return

		const title =
			cleanText(link.attr('title')) ||
			cleanText($(element).find('.tt, h2, .entry-title, a').first().text()) ||
			cleanText(link.text())
		const image = absoluteUrl($(element).find('img[src]').first().attr('src'), options)

		results.push({
			title,
			url,
			image,
			episode: getSamehadakuEpisodeNumber(title) || getSamehadakuEpisodeNumber(url),
			type: 'episode'
		})
	})

	const limit = Number(options.limit || 20)
	return uniqueByUrl(results).slice(0, Number.isFinite(limit) && limit > 0 ? limit : 20)
}

const slugFromSamehadakuInput = input => {
	const text = cleanText(input)
	if (!text) return ''

	try {
		const url = /^https?:\/\//i.test(text) ? new URL(text) : null
		if (url) return url.pathname.split('/').filter(Boolean).at(-1) || ''
	} catch {
		// Fall through to plain slug handling.
	}

	return text.replace(/^\/+|\/+$/g, '')
}

const legacySlugCandidates = input => {
	const slug = slugFromSamehadakuInput(input)
	if (!slug) return []

	return [
		...new Set(
			[slug, slug.replace(/-subtitle-indonesia$/i, ''), slug.replace(/-sub-indo$/i, '')].filter(
				Boolean
			)
		)
	]
}

export const parseSamehadakuLegacyEpisodePage = (html, pageUrl, options = {}) => {
	const $ = cheerio.load(html)
	const servers = []

	$('.east_player_option').each((_, element) => {
		const post = $(element).attr('data-post')
		const nume = $(element).attr('data-nume')
		const type = $(element).attr('data-type')
		if (!post || !nume || !type) return

		servers.push({
			name: cleanText($(element).find('span').text()) || `Server ${servers.length + 1}`,
			post,
			nume,
			type
		})
	})

	return {
		url: pageUrl,
		title: cleanText($('h1.entry-title').text()) || cleanText($('title').text()),
		image: absoluteUrl(
			$('meta[property="og:image"]').attr('content') || $('.thumb img').first().attr('src'),
			{
				...options,
				baseUrl: options.legacyBaseUrl || SAMEHADAKU_LEGACY_BASE_URL
			}
		),
		servers
	}
}

export const getSamehadakuLegacyStream = async (input, options = {}) => {
	const candidates = legacySlugCandidates(input)
	if (!candidates.length) throw new Error('Samehadaku legacy episode slug or URL is required')

	let html = ''
	let pageUrl = ''
	let episode = null

	for (const slug of candidates) {
		pageUrl = `${options.legacyBaseUrl || SAMEHADAKU_LEGACY_BASE_URL}/${slug}/`
		html = await fetchSamehadakuHtmlWithCurl(pageUrl, options)
		episode = parseSamehadakuLegacyEpisodePage(html, pageUrl, options)
		if (episode.servers.length) break
	}

	if (!episode?.servers?.length) {
		return {
			ok: false,
			text: 'Samehadaku legacy stream not found'
		}
	}

	const ajaxUrl = `${options.legacyAjaxBaseUrl || SAMEHADAKU_LEGACY_AJAX_BASE_URL}/wp-admin/admin-ajax.php`
	const mirrors = []

	for (const server of episode.servers) {
		const data = new URLSearchParams({
			action: 'player_ajax',
			post: server.post,
			nume: server.nume,
			type: server.type
		}).toString()
		const iframeHtml = await postSamehadakuAjaxWithCurl(ajaxUrl, data, options).catch(() => '')
		const $ = cheerio.load(iframeHtml)
		const url = $('iframe').attr('src') || ''
		if (!url) continue

		mirrors.push({
			name: server.name,
			url,
			directVideo: isDirectVideoUrl(url),
			server
		})
	}

	return {
		ok: Boolean(mirrors.length),
		...(mirrors.length ? {} : { text: 'Samehadaku legacy stream not found' }),
		episode: {
			...episode,
			mirrors: uniqueByUrl(mirrors)
		}
	}
}

export const parseSamehadakuSeriesPage = (html, options = {}) => {
	const $ = cheerio.load(html)
	const episodes = []

	$('.eplister a[href], a[href*="episode"]').each((_, element) => {
		const url = absoluteUrl($(element).attr('href'), options)
		if (!url || !isEpisodeUrl(url)) return

		const title = cleanText($(element).text()) || cleanText($(element).attr('title')) || url
		episodes.push({
			title,
			url,
			episode: getSamehadakuEpisodeNumber(title) || getSamehadakuEpisodeNumber(url)
		})
	})

	return uniqueByUrl(episodes)
}

export const getSamehadakuSeriesEpisodes = async (seriesUrl, options = {}) => {
	if (!seriesUrl) return []

	const html = await fetchSamehadakuHtml(seriesUrl, options)
	return parseSamehadakuSeriesPage(html, options)
}

export const resolveSamehadakuEpisode = async ({ seriesUrl, episodeNumber, ...options }) => {
	const episodes = await getSamehadakuSeriesEpisodes(seriesUrl, options)
	if (!episodes.length) return { episodeUrl: '', episodes }

	if (episodeNumber) {
		const selected = episodes.find(item => item.episode === episodeNumber)
		if (selected) return { episodeUrl: selected.url, episodes }
	}

	return { episodeUrl: episodes[0].url, episodes }
}

export const searchSamehadaku = async (query, options = {}) => {
	const cleanQuery = cleanText(query)
	if (!cleanQuery) throw new Error('Samehadaku query is required')

	const url = `${baseUrl(options)}/?s=${encodeURIComponent(cleanQuery)}`
	const html = await fetchSamehadakuHtml(url, options)
	return {
		query: cleanQuery,
		url,
		results: parseSamehadakuSearchPage(html, options)
	}
}

export const getLatestSamehadaku = async (options = {}) => {
	const url = options.url || baseUrl(options)
	const html = await fetchSamehadakuHtml(url, options)

	return {
		url,
		results: parseLatestSamehadakuPage(html, options)
	}
}

export const getSamehadakuStream = async (input, options = {}) => {
	const text = cleanText(input)
	if (!text) throw new Error('Samehadaku episode URL or query is required')

	let episodeUrl = ''
	let search = null
	let episodes = []
	const episodeNumber = getSamehadakuEpisodeNumber(text)

	if (isSamehadakuUrl(text)) {
		const url = absoluteUrl(text, options)
		if (isSeriesUrl(url)) {
			const resolved = await resolveSamehadakuEpisode({ ...options, seriesUrl: url, episodeNumber })
			episodeUrl = resolved.episodeUrl
			episodes = resolved.episodes
		} else {
			episodeUrl = url
		}
	} else {
		search = await searchSamehadaku(seriesSearchQuery(text) || text, options)
		const directEpisode = search.results.find(item => item.type === 'episode')
		const series = search.results.find(item => item.type === 'series')

		if (directEpisode) {
			episodeUrl = directEpisode.url
		} else if (series) {
			const resolved = await resolveSamehadakuEpisode({
				...options,
				seriesUrl: series.url,
				episodeNumber
			})
			episodeUrl = resolved.episodeUrl
			episodes = resolved.episodes
		}
	}

	if (!episodeUrl) {
		return {
			ok: false,
			text: 'Samehadaku episode not found'
		}
	}

	const html = await fetchSamehadakuHtml(episodeUrl, options)
	const episode = parseSamehadakuEpisodePage(html, episodeUrl, options)
	if (!episodes.length && episode.seriesUrl) {
		episodes = await getSamehadakuSeriesEpisodes(episode.seriesUrl, options).catch(() => [])
	}
	episode.episodes = episodes

	if (!episode.mirrors.length) {
		return {
			ok: false,
			text: 'Samehadaku stream not found on episode page'
		}
	}

	return {
		ok: true,
		search,
		episode
	}
}

export const samehadaku = getSamehadakuStream
