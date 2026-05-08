/**
 * TikTok scraper — uses the public TikWM service to resolve videos to
 * no-watermark URLs, run keyword search, and look up user profiles.
 *
 * Why TikWM and not yt-dlp?
 * - Pure HTTPS JSON, runs from Termux / serverless / fly.io without binaries.
 * - No login / cookies required.
 * - Returns the no-watermark MP4 URL directly so a bot can re-upload it
 *   without the TikTok logo overlay (which is what most Indo bots want).
 *
 * @example
 * import { tiktok, getTiktok, searchTiktok, getTiktokUser } from '@shikytemo/shitools'
 * await getTiktok('https://www.tiktok.com/@khaby.lame/video/7137423965982858498')
 * await searchTiktok('axolotl', { limit: 5 })
 * await getTiktokUser('@khaby.lame')
 *
 * @example  // smart dispatch — URL goes to getTiktok, query to searchTiktok
 * await tiktok('https://vm.tiktok.com/ZSNFRtUJj/')
 * await tiktok('lucu kucing', { limit: 3 })
 */

import { InvalidInputError, ParseError, RateLimitError, ScrapeError } from './errors.js'
import { httpClient } from './http.js'

const TIKWM_BASE = 'https://tikwm.com/api'
const SOURCE = 'tiktok'

const TIKTOK_URL_REGEX = /^(https?:\/\/)?(www\.|m\.|vm\.|vt\.|t\.)?tiktok\.com\/\S+/i

/**
 * Detect whether `input` looks like a TikTok URL (any of the common formats:
 * tiktok.com/@user/video/N, vm.tiktok.com/X, vt.tiktok.com/X, m.tiktok.com/...).
 *
 * @param {unknown} input
 * @returns {boolean}
 */
export const isTiktokUrl = input => typeof input === 'string' && TIKTOK_URL_REGEX.test(input.trim())

const parseJsonBody = (body, url) => {
	try {
		return JSON.parse(body)
	} catch (error) {
		throw new ParseError('TikWM returned non-JSON response', {
			source: SOURCE,
			url,
			cause: error
		})
	}
}

const RATE_LIMIT_HINTS = /limit|busy|too many|rate|frequent/i

const ensureOk = (json, url) => {
	if (json && json.code === 0 && json.data) return json.data
	const msg = json?.msg ?? json?.message ?? 'unknown TikWM error'
	if (json?.code === -1 && RATE_LIMIT_HINTS.test(msg)) {
		throw new RateLimitError(`TikWM throttled: ${msg}`, { source: SOURCE, url })
	}
	throw new ScrapeError(`TikWM error: ${msg}`, { source: SOURCE, url, status: json?.code })
}

/**
 * @typedef {Object} TiktokVideo
 * @property {string} id
 * @property {string} [title]
 * @property {string} url               No-watermark URL when available, else watermarked.
 * @property {string|null} noWatermarkUrl
 * @property {string|null} watermarkUrl
 * @property {string|null} hdUrl
 * @property {string} [cover]
 * @property {number} [duration]        Seconds
 * @property {number} [createdAt]       Unix ms
 * @property {string} [region]
 * @property {{ id?: string, title?: string, author?: string, url?: string }} [music]
 * @property {{ id?: string, username?: string, name?: string, avatar?: string }} [author]
 * @property {{ plays?: number, likes?: number, comments?: number, shares?: number, saves?: number }} stats
 * @property {string} [permalink]
 */

const normalizeVideo = raw => {
	const playUrl = raw.play ?? raw.wmplay ?? null
	const author = raw.author ?? {}
	const music = raw.music_info ?? {}
	return {
		id: raw.id ?? raw.video_id,
		title: raw.title ?? raw.desc,
		url: playUrl,
		noWatermarkUrl: raw.play ?? null,
		watermarkUrl: raw.wmplay ?? null,
		hdUrl: raw.hdplay ?? null,
		cover: raw.cover ?? raw.origin_cover ?? raw.ai_dynamic_cover,
		duration: raw.duration,
		createdAt:
			typeof raw.create_time === 'number' && raw.create_time > 0
				? raw.create_time * 1000
				: undefined,
		region: raw.region,
		music:
			music && (music.id || music.title || raw.music)
				? {
						id: music.id,
						title: music.title,
						author: music.author,
						url: raw.music ?? music.play
					}
				: undefined,
		author:
			author && (author.id || author.unique_id || author.nickname)
				? {
						id: author.id,
						username: author.unique_id,
						name: author.nickname,
						avatar: author.avatar
					}
				: undefined,
		stats: {
			plays: raw.play_count,
			likes: raw.digg_count,
			comments: raw.comment_count,
			shares: raw.share_count,
			saves: raw.collect_count
		},
		permalink:
			author?.unique_id && (raw.id ?? raw.video_id)
				? `https://www.tiktok.com/@${author.unique_id}/video/${raw.id ?? raw.video_id}`
				: undefined
	}
}

/**
 * Resolve a TikTok video URL to its metadata + no-watermark MP4 URL.
 *
 * @param {string} url
 * @param {{ retries?: number, timeout?: number }} [options]
 * @returns {Promise<TiktokVideo>}
 */
export const getTiktok = async (url, options = {}) => {
	if (typeof url !== 'string' || !url.trim()) {
		throw new InvalidInputError('TikTok URL is required', { source: SOURCE })
	}
	const target = url.trim()
	const apiUrl = `${TIKWM_BASE}/?url=${encodeURIComponent(target)}&hd=1`
	const response = await httpClient.get(apiUrl, { source: SOURCE, ...options })
	const data = ensureOk(parseJsonBody(response.body, apiUrl), target)
	return normalizeVideo(data)
}

/**
 * @typedef {Object} TiktokSearchResult
 * @property {TiktokVideo[]} videos
 * @property {number|string} [cursor]
 * @property {boolean} [hasMore]
 */

/**
 * Keyword search across TikTok via TikWM feed/search.
 *
 * @param {string} keyword
 * @param {{ limit?: number, cursor?: number|string, retries?: number, timeout?: number }} [options]
 * @returns {Promise<TiktokSearchResult>}
 */
export const searchTiktok = async (keyword, options = {}) => {
	if (typeof keyword !== 'string' || !keyword.trim()) {
		throw new InvalidInputError('TikTok keyword is required', { source: SOURCE })
	}
	const params = new URLSearchParams({
		keywords: keyword.trim(),
		count: String(options.limit ?? 10),
		cursor: String(options.cursor ?? 0)
	})
	const apiUrl = `${TIKWM_BASE}/feed/search?${params.toString()}`
	const response = await httpClient.get(apiUrl, { source: SOURCE, ...options })
	const data = ensureOk(parseJsonBody(response.body, apiUrl), apiUrl)
	const videos = Array.isArray(data.videos) ? data.videos : []
	return {
		videos: videos.map(normalizeVideo),
		cursor: data.cursor ?? data.next_cursor,
		hasMore: data.hasMore ?? data.has_more
	}
}

/**
 * @typedef {Object} TiktokUser
 * @property {string} id
 * @property {string} username
 * @property {string} [name]
 * @property {string} [avatar]
 * @property {string} [bio]
 * @property {boolean} [verified]
 * @property {boolean} [private]
 * @property {string} [region]
 * @property {{ followers?: number, following?: number, likes?: number, videos?: number }} stats
 */

/**
 * Get TikTok user profile + stats by `@username`.
 *
 * @param {string} username   With or without leading `@`.
 * @param {{ retries?: number, timeout?: number }} [options]
 * @returns {Promise<TiktokUser>}
 */
export const getTiktokUser = async (username, options = {}) => {
	if (typeof username !== 'string' || !username.trim()) {
		throw new InvalidInputError('TikTok username is required', { source: SOURCE })
	}
	const handle = username.trim().replace(/^@/, '')
	const apiUrl = `${TIKWM_BASE}/user/info?unique_id=${encodeURIComponent(handle)}`
	const response = await httpClient.get(apiUrl, { source: SOURCE, ...options })
	const data = ensureOk(parseJsonBody(response.body, apiUrl), apiUrl)
	const user = data.user ?? {}
	const stats = data.stats ?? {}
	return {
		id: user.id,
		username: user.uniqueId ?? user.unique_id ?? handle,
		name: user.nickname,
		avatar: user.avatarLarger ?? user.avatar_larger ?? user.avatarThumb,
		bio: user.signature,
		verified: user.verified,
		private: user.privateAccount ?? user.private_account,
		region: user.region,
		stats: {
			followers: stats.followerCount ?? stats.follower_count,
			following: stats.followingCount ?? stats.following_count,
			likes: stats.heartCount ?? stats.heart_count,
			videos: stats.videoCount ?? stats.video_count
		}
	}
}

/**
 * Smart dispatch: TikTok URL → {@link getTiktok}, otherwise treat as a keyword
 * and call {@link searchTiktok}.
 *
 * @param {string} input
 * @param {Object} [options]   Forwarded to the underlying call.
 * @returns {Promise<TiktokVideo | TiktokSearchResult>}
 */
export const tiktok = async (input, options = {}) => {
	if (isTiktokUrl(input)) return getTiktok(input, options)
	return searchTiktok(input, options)
}
