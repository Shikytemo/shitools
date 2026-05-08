/**
 * TikTok user "stalker" — full public profile + stats via the TikWM API
 * (same backend used by the no-watermark video resolver).
 *
 * @example
 * import { tiktokStalk } from '@shikytemo/shitools'
 * const me = await tiktokStalk('khaby.lame')
 * console.log(me.followers, me.likes, me.videoCount)
 */

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'tiktokstalk'
const TIKWM = 'https://tikwm.com/api/user/info'

/**
 * @typedef {Object} TiktokStalkResult
 * @property {string} id
 * @property {string} uniqueId
 * @property {string} nickname
 * @property {string} avatar
 * @property {string} signature
 * @property {boolean} verified
 * @property {boolean} privateAccount
 * @property {string} region
 * @property {number} followers
 * @property {number} following
 * @property {number} likes
 * @property {number} videoCount
 * @property {number} friends
 * @property {string} url
 */

/**
 * Fetch a TikTok user's public profile + stats via TikWM.
 *
 * @param {string} username
 * @param {{ retries?: number }} [options]
 * @returns {Promise<TiktokStalkResult>}
 */
export const tiktokStalk = async (username, options = {}) => {
	if (typeof username !== 'string' || !username.trim()) {
		throw new InvalidInputError('username is required', { source: SOURCE })
	}
	const clean = username.trim().replace(/^@/, '')
	const url = `${TIKWM}?unique_id=${encodeURIComponent(clean)}`
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('TikWM returned non-JSON', { source: SOURCE, url, cause: error })
	}
	if (json?.code !== 0 || !json?.data) {
		throw new ParseError(`TikWM error: ${json?.msg ?? 'unknown'}`, { source: SOURCE, url })
	}
	const user = json.data?.user ?? {}
	const stats = json.data?.stats ?? {}
	return {
		id: String(user.id ?? ''),
		uniqueId: user.uniqueId ?? clean,
		nickname: user.nickname ?? '',
		avatar: user.avatarLarger ?? user.avatarMedium ?? user.avatarThumb ?? '',
		signature: user.signature ?? '',
		verified: Boolean(user.verified),
		privateAccount: Boolean(user.privateAccount),
		region: user.region ?? '',
		followers: Number(stats.followerCount ?? 0),
		following: Number(stats.followingCount ?? 0),
		likes: Number(stats.heartCount ?? 0),
		videoCount: Number(stats.videoCount ?? 0),
		friends: Number(stats.friendCount ?? 0),
		url: `https://www.tiktok.com/@${clean}`
	}
}
