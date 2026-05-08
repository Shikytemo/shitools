/**
 * GitHub Trending repos — scraped from github.com/trending HTML.
 *
 * @example
 * import { getGithubTrending } from '@shikytemo/shitools'
 * const repos = await getGithubTrending({ language: 'javascript', since: 'daily' })
 */

import * as cheerio from 'cheerio'

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'github-trending'
const BASE = 'https://github.com/trending'

const VALID_SINCE = new Set(['daily', 'weekly', 'monthly'])

/**
 * @typedef {Object} TrendingRepo
 * @property {string} owner
 * @property {string} repo
 * @property {string} fullName
 * @property {string} url
 * @property {string} description
 * @property {string} language
 * @property {number} stars
 * @property {number} forks
 * @property {number} starsAdded   Stars added in the requested window
 */

/**
 * Fetch trending repos. `since` may be `'daily'` (default), `'weekly'`, or
 * `'monthly'`. `language` is a slug (e.g. `'javascript'`, `'python'`).
 *
 * @param {{ language?: string, since?: string, retries?: number }} [options]
 * @returns {Promise<TrendingRepo[]>}
 */
export const getGithubTrending = async (options = {}) => {
	const since = (options.since ?? 'daily').toLowerCase()
	if (!VALID_SINCE.has(since)) {
		throw new InvalidInputError('since must be daily | weekly | monthly', { source: SOURCE })
	}
	const language = options.language ? String(options.language).trim().toLowerCase() : ''
	const url = language
		? `${BASE}/${encodeURIComponent(language)}?since=${since}`
		: `${BASE}?since=${since}`
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let $
	try {
		$ = cheerio.load(response.body)
	} catch (error) {
		throw new ParseError('failed to parse github trending HTML', {
			source: SOURCE,
			url,
			cause: error
		})
	}
	const articles = $('article.Box-row')
	const out = []
	articles.each((_, el) => {
		const $el = $(el)
		const link = $el.find('h2 a').attr('href') ?? ''
		const fullName = link.replace(/^\//, '').trim()
		const [owner, repo] = fullName.split('/')
		if (!owner || !repo) return
		const description = $el.find('p').text().trim()
		const language = $el.find('[itemprop="programmingLanguage"]').text().trim()
		const stats = $el.find('a.Link--muted')
		const stars = parseNumber(stats.eq(0).text())
		const forks = parseNumber(stats.eq(1).text())
		const starsAdded = parseNumber(
			$el
				.find('span.d-inline-block.float-sm-right')
				.text()
				.replace(/stars\s+(today|this week|this month)/i, '')
				.trim()
		)
		out.push({
			owner,
			repo,
			fullName,
			url: `https://github.com${link}`,
			description,
			language,
			stars,
			forks,
			starsAdded
		})
	})
	return out
}

const parseNumber = text => {
	if (!text) return 0
	const cleaned = text.replace(/[,\s]/g, '').match(/(\d+(?:\.\d+)?)([km]?)/i)
	if (!cleaned) return 0
	const n = Number(cleaned[1])
	const suffix = (cleaned[2] ?? '').toLowerCase()
	if (suffix === 'k') return Math.round(n * 1000)
	if (suffix === 'm') return Math.round(n * 1_000_000)
	return Math.round(n)
}
