/**
 * Indonesian news headlines via berita-indo-api-next (no key, public).
 * Sources: cnn-indonesia, cnbc-indonesia, antara, tempo, okezone, republika.
 *
 * @example
 * import { getNews, listNewsSources } from '@shikytemo/shitools'
 * const headlines = await getNews('cnn-news')
 */

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'news'
const BASE = 'https://berita-indo-api-next.vercel.app/api'

const SOURCES = Object.freeze([
	{ id: 'cnn-news', label: 'CNN Indonesia', path: '/cnn-news' },
	{ id: 'cnbc-news', label: 'CNBC Indonesia', path: '/cnbc-news' },
	{ id: 'antara-news', label: 'Antara', path: '/antara-news' },
	{ id: 'tempo-news', label: 'Tempo', path: '/tempo-news' },
	{ id: 'okezone-news', label: 'Okezone', path: '/okezone-news' },
	{ id: 'republika-news', label: 'Republika', path: '/republika-news' },
	{ id: 'jpnn-news', label: 'JPNN', path: '/jpnn-news' },
	{ id: 'tvone-news', label: 'TVOne', path: '/tvone-news' },
	{ id: 'kumparan-news', label: 'Kumparan', path: '/kumparan-news' }
])

/**
 * @returns {Array<{ id: string, label: string }>}
 */
export const listNewsSources = () => SOURCES.map(s => ({ id: s.id, label: s.label }))

/**
 * @typedef {Object} NewsItem
 * @property {string} title
 * @property {string} link
 * @property {string} description
 * @property {string} thumbnail
 * @property {string} source
 * @property {string} publishedAt
 */

/**
 * Fetch headlines from the given source.
 *
 * @param {string} sourceId   Use {@link listNewsSources} for available IDs.
 * @param {{ retries?: number }} [options]
 * @returns {Promise<NewsItem[]>}
 */
export const getNews = async (sourceId = 'cnn-news', options = {}) => {
	const source = SOURCES.find(s => s.id === sourceId)
	if (!source) {
		throw new InvalidInputError(`unknown news source "${sourceId}"`, { source: SOURCE })
	}
	const url = `${BASE}${source.path}`
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('berita-indo returned non-JSON', { source: SOURCE, url, cause: error })
	}
	const data = Array.isArray(json?.data) ? json.data : []
	return data.map(item => ({
		title: item.title ?? '',
		link: item.link ?? '',
		description: item.contentSnippet ?? item.description ?? '',
		thumbnail: item.image?.large ?? item.image?.small ?? item.thumbnail ?? '',
		source: source.label,
		publishedAt: item.isoDate ?? item.pubDate ?? ''
	}))
}
