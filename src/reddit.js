/**
 * Reddit subreddit listings via reddit.com/r/<sub>/<sort>.json.
 * No API key required.
 *
 * @example
 * import { getSubreddit } from '@shikytemo/shitools'
 * const posts = await getSubreddit('ProgrammerHumor', { sort: 'top', limit: 10 })
 */

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'reddit'

const VALID_SORT = new Set(['hot', 'new', 'top', 'rising', 'controversial'])
const VALID_T = new Set(['hour', 'day', 'week', 'month', 'year', 'all'])

/**
 * @typedef {Object} RedditPost
 * @property {string} id
 * @property {string} title
 * @property {string} author
 * @property {string} subreddit
 * @property {string} permalink
 * @property {string} url            Direct media URL when post links to media.
 * @property {string} thumbnail
 * @property {number} score
 * @property {number} comments
 * @property {boolean} nsfw
 * @property {boolean} spoiler
 * @property {string} flair
 * @property {string} createdAt      ISO timestamp.
 * @property {string} selftext       Post body for text posts.
 * @property {boolean} isVideo
 * @property {string} [videoUrl]     Reddit-hosted video URL.
 */

/**
 * Fetch subreddit posts.
 *
 * @param {string} subreddit
 * @param {{ sort?: string, t?: string, limit?: number, retries?: number }} [options]
 * @returns {Promise<RedditPost[]>}
 */
export const getSubreddit = async (subreddit, options = {}) => {
	if (typeof subreddit !== 'string' || !subreddit.trim()) {
		throw new InvalidInputError('subreddit is required', { source: SOURCE })
	}
	const sub = subreddit.trim().replace(/^\/?r\//, '')
	if (!/^[a-z0-9_]+$/i.test(sub)) {
		throw new InvalidInputError('subreddit name has invalid characters', { source: SOURCE })
	}
	const sort = (options.sort ?? 'hot').toLowerCase()
	if (!VALID_SORT.has(sort)) {
		throw new InvalidInputError('sort must be hot|new|top|rising|controversial', { source: SOURCE })
	}
	const t = options.t ? String(options.t).toLowerCase() : null
	if (t && !VALID_T.has(t)) {
		throw new InvalidInputError('t must be hour|day|week|month|year|all', { source: SOURCE })
	}
	const limit = Math.max(1, Math.min(100, Number(options.limit ?? 25)))
	const params = new URLSearchParams({ limit: String(limit), raw_json: '1' })
	if (t) params.set('t', t)
	const url = `https://www.reddit.com/r/${encodeURIComponent(sub)}/${sort}.json?${params}`
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('reddit returned non-JSON', { source: SOURCE, url, cause: error })
	}
	const children = Array.isArray(json?.data?.children) ? json.data.children : []
	return children.map(c => {
		const d = c.data ?? {}
		const isVideo = Boolean(d.is_video)
		const videoUrl = isVideo ? (d.media?.reddit_video?.fallback_url ?? '') : ''
		return {
			id: d.id ?? '',
			title: d.title ?? '',
			author: d.author ?? '',
			subreddit: d.subreddit ?? sub,
			permalink: d.permalink ? `https://reddit.com${d.permalink}` : '',
			url: d.url_overridden_by_dest ?? d.url ?? '',
			thumbnail: d.thumbnail && d.thumbnail.startsWith('http') ? d.thumbnail : '',
			score: Number(d.score ?? 0),
			comments: Number(d.num_comments ?? 0),
			nsfw: Boolean(d.over_18),
			spoiler: Boolean(d.spoiler),
			flair: d.link_flair_text ?? '',
			createdAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : '',
			selftext: d.selftext ?? '',
			isVideo,
			videoUrl: videoUrl || undefined
		}
	})
}
