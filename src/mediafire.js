/**
 * Mediafire direct download link extractor. Scrapes the public download
 * page HTML.
 *
 * @example
 * import { getMediafire } from '@shikytemo/shitools'
 * const file = await getMediafire('https://www.mediafire.com/file/abc/file.zip')
 */

import * as cheerio from 'cheerio'

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'mediafire'

const isMediafireUrl = input => {
	try {
		const url = new URL(input)
		return /(^|\.)mediafire\.com$/i.test(url.hostname)
	} catch {
		return false
	}
}

/**
 * @typedef {Object} MediafireFile
 * @property {string} filename
 * @property {string} mime         File extension (e.g. `mp4`, `zip`).
 * @property {string} size         e.g. `12.34MB`.
 * @property {string} url          Direct download URL.
 * @property {string} pageUrl
 * @property {string} source
 */

/**
 * Extract the direct download URL + filename + size from a public Mediafire
 * file page.
 *
 * @param {string} pageUrl
 * @param {{ retries?: number }} [options]
 * @returns {Promise<MediafireFile>}
 */
export const getMediafire = async (pageUrl, options = {}) => {
	if (typeof pageUrl !== 'string' || !pageUrl.trim()) {
		throw new InvalidInputError('mediafire url is required', { source: SOURCE })
	}
	if (!isMediafireUrl(pageUrl)) {
		throw new InvalidInputError('not a mediafire.com URL', { source: SOURCE })
	}
	const response = await httpClient.get(pageUrl.trim(), { source: SOURCE, ...options })
	let $
	try {
		$ = cheerio.load(response.body)
	} catch (error) {
		throw new ParseError('failed to parse mediafire HTML', {
			source: SOURCE,
			url: pageUrl,
			cause: error
		})
	}
	const downloadUrl = $('a#downloadButton').attr('href') ?? ''
	if (!downloadUrl) {
		const scrambled = $('a#downloadButton').attr('data-scrambled-url') ?? ''
		if (scrambled) {
			try {
				const decoded = Buffer.from(scrambled, 'base64').toString('utf-8')
				if (decoded) {
					return buildResult(decoded, $, pageUrl)
				}
			} catch {
				/* fall through */
			}
		}
		throw new ParseError('mediafire download link not found', { source: SOURCE, url: pageUrl })
	}
	return buildResult(downloadUrl, $, pageUrl)
}

const buildResult = (downloadUrl, $, pageUrl) => {
	const segments = downloadUrl.split('/')
	const filename = decodeURIComponent(segments[segments.length - 1] ?? '')
	const dot = filename.lastIndexOf('.')
	const mime = dot > -1 ? filename.slice(dot + 1).toLowerCase() : ''
	const sizeText = $('a#downloadButton').text().trim()
	const sizeMatch = sizeText.match(/\(([^)]+)\)/)
	const size = sizeMatch ? sizeMatch[1].trim() : ''
	return {
		filename,
		mime,
		size,
		url: downloadUrl,
		pageUrl,
		source: 'mediafire.com'
	}
}
