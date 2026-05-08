/**
 * Public Instagram profile "stalker" via dumpoir.com — no login, no API key.
 * Scrapes profile picture, follower counts, bio.
 *
 * @example
 * import { igStalk } from '@shikytemo/shitools'
 * const me = await igStalk('cristiano')
 * console.log(me.fullname, me.followers)
 */

import { load } from 'cheerio'

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'igstalk'
const BASE = 'https://dumpoir.com'

const stripCount = text =>
	String(text || '')
		.replace(/\s+(Posts|Followers|Following)\s*$/i, '')
		.trim()

/**
 * @typedef {Object} IgStalkResult
 * @property {string} username
 * @property {string} fullname
 * @property {string} profilePic
 * @property {string} bio
 * @property {string} posts
 * @property {string} followers
 * @property {string} following
 * @property {string} url
 */

/**
 * Scrape `dumpoir.com/v/<username>` for a public Instagram profile.
 *
 * @param {string} username
 * @param {{ retries?: number }} [options]
 * @returns {Promise<IgStalkResult>}
 */
export const igStalk = async (username, options = {}) => {
	if (typeof username !== 'string' || !username.trim()) {
		throw new InvalidInputError('username is required', { source: SOURCE })
	}
	const clean = username.trim().replace(/^@/, '')
	const url = `${BASE}/v/${encodeURIComponent(clean)}`
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	const $ = load(response.body)
	const profileBg = $('#user-page > div.user > div.row > div > div.user__img').attr('style') ?? ''
	const profilePic = profileBg.replace(/^.*url\(['"]?/, '').replace(/['"]?\).*$/, '')
	const fullname = $('#user-page > div.user > div > div.col-md-4.col-8.my-3 > div > a > h1')
		.text()
		.trim()
	const handle = $('#user-page > div.user > div > div.col-md-4.col-8.my-3 > div > h4').text().trim()
	if (!fullname && !handle) {
		throw new ParseError(`profile "${clean}" not found`, { source: SOURCE, url })
	}
	const stats = $('#user-page > div.user > div > div.col-md-4.col-8.my-3 > ul > li')
	const bio = $('#user-page > div.user > div > div.col-md-5.my-3 > div').text().trim()
	return {
		username: handle.replace(/^@/, '') || clean,
		fullname: fullname || handle,
		profilePic,
		bio,
		posts: stripCount($(stats[0]).text()),
		followers: stripCount($(stats[1]).text()),
		following: stripCount($(stats[2]).text()),
		url: `https://instagram.com/${clean}`
	}
}
