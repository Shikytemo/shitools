/**
 * sfile.mobi search + direct download link extractor.
 * No API key — scrapes public HTML pages with cheerio.
 *
 * @example
 * import { searchSfile, getSfileFile } from '@shikytemo/shitools'
 * const hits = await searchSfile('whatsapp mod')
 * const file = await getSfileFile(hits[0].url)
 * console.log(file.download)
 */

import { load } from 'cheerio'

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'sfile'
const BASE = 'https://sfile.mobi'

/**
 * @typedef {Object} SfileSearchHit
 * @property {string} title
 * @property {string} size
 * @property {string} url
 */

/**
 * Search sfile.mobi for `query`. Returns up to one page of hits.
 *
 * @param {string} query
 * @param {{ page?: number, retries?: number }} [options]
 * @returns {Promise<SfileSearchHit[]>}
 */
export const searchSfile = async (query, options = {}) => {
	if (typeof query !== 'string' || !query.trim()) {
		throw new InvalidInputError('query is required', { source: SOURCE })
	}
	const page = Math.max(1, Math.min(20, Number(options.page ?? 1)))
	const url = `${BASE}/search.php?q=${encodeURIComponent(query.trim())}&page=${page}`
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	const $ = load(response.body)
	const results = []
	$('div.list').each((_, el) => {
		const link = $(el).find('a').attr('href')
		const title = $(el).find('a').text().trim()
		const raw = $(el).text().trim()
		const sizeMatch = raw.match(/\(([^)]+)\)\s*$/)
		if (link) {
			results.push({
				title,
				size: sizeMatch ? sizeMatch[1] : '',
				url: link.startsWith('http') ? link : `${BASE}/${link.replace(/^\/+/, '')}`
			})
		}
	})
	return results
}

/**
 * @typedef {Object} SfileFileResult
 * @property {string} filename
 * @property {string} filesize
 * @property {string} mimetype
 * @property {string} download   Direct download URL with random `&k=` token
 * @property {string} sourceUrl  Original page URL
 */

/**
 * Fetch a single sfile.mobi page and extract the download URL + metadata.
 *
 * @param {string} pageUrl
 * @param {{ retries?: number }} [options]
 * @returns {Promise<SfileFileResult>}
 */
export const getSfileFile = async (pageUrl, options = {}) => {
	if (typeof pageUrl !== 'string' || !pageUrl.trim()) {
		throw new InvalidInputError('sfile page url is required', { source: SOURCE })
	}
	const target = pageUrl.startsWith('http') ? pageUrl : `${BASE}/${pageUrl.replace(/^\/+/, '')}`
	const response = await httpClient.get(target, { source: SOURCE, ...options })
	const $ = load(response.body)
	const filename = $('div.w3-row-padding').find('img').attr('alt') ?? ''
	const downloadHref = $('#download').attr('href')
	if (!downloadHref) {
		throw new ParseError('sfile page missing #download link', { source: SOURCE, url: target })
	}
	const filesize = $('#download')
		.text()
		.replace(/Download File/g, '')
		.replace(/\(|\)/g, '')
		.trim()
	const listText = $('div.list').first().text().trim()
	const mimetypeMatch = listText.match(/[-•]\s*([\w./+-]+)/)
	const mimetype = mimetypeMatch ? mimetypeMatch[1].trim() : ''
	const k = Math.floor(Math.random() * 6 + 10)
	return {
		filename: filename || 'sfile-download',
		filesize,
		mimetype,
		download: downloadHref.includes('?') ? `${downloadHref}&k=${k}` : `${downloadHref}?k=${k}`,
		sourceUrl: target
	}
}

/**
 * Smart dispatch: if `input` looks like a URL → resolve direct DL; else search.
 *
 * @param {string} input
 * @param {{ retries?: number }} [options]
 * @returns {Promise<SfileFileResult | { hits: SfileSearchHit[] }>}
 */
export const sfile = async (input, options = {}) => {
	if (typeof input !== 'string' || !input.trim()) {
		throw new InvalidInputError('input is required', { source: SOURCE })
	}
	const trimmed = input.trim()
	if (/^https?:\/\//i.test(trimmed)) return getSfileFile(trimmed, options)
	const hits = await searchSfile(trimmed, options)
	return { hits }
}
