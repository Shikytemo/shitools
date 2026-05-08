/**
 * GitHub user "stalker" — public profile + recent repos via api.github.com.
 * No token required for public data (subject to anonymous rate limits).
 *
 * @example
 * import { githubProfile } from '@shikytemo/shitools'
 * const me = await githubProfile('Shikytemo')
 * console.log(me.followers, me.publicRepos, me.repos[0].name)
 */

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'githubprofile'
const API = 'https://api.github.com'

const headers = () => {
	const h = { accept: 'application/vnd.github+json' }
	const token = process.env.GITHUB_TOKEN
	if (token) h.authorization = `Bearer ${token}`
	return h
}

/**
 * @typedef {Object} GithubProfileRepo
 * @property {string} name
 * @property {string} fullName
 * @property {string} url
 * @property {string} description
 * @property {string} language
 * @property {number} stars
 * @property {number} forks
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} GithubProfileResult
 * @property {string} login
 * @property {string} name
 * @property {string} bio
 * @property {string} avatar
 * @property {string} url
 * @property {string} [company]
 * @property {string} [location]
 * @property {string} [blog]
 * @property {string} [twitter]
 * @property {number} followers
 * @property {number} following
 * @property {number} publicRepos
 * @property {number} publicGists
 * @property {string} createdAt
 * @property {GithubProfileRepo[]} repos
 */

/**
 * Fetch a GitHub user's public profile + most recently updated repos.
 *
 * @param {string} username
 * @param {{ repoLimit?: number, retries?: number }} [options]
 * @returns {Promise<GithubProfileResult>}
 */
export const githubProfile = async (username, options = {}) => {
	if (typeof username !== 'string' || !username.trim()) {
		throw new InvalidInputError('github username is required', { source: SOURCE })
	}
	const repoLimit = Math.max(1, Math.min(30, Number(options.repoLimit ?? 6)))
	const userUrl = `${API}/users/${encodeURIComponent(username.trim())}`
	const reposUrl = `${API}/users/${encodeURIComponent(username.trim())}/repos?sort=updated&per_page=${repoLimit}`
	const [userRes, reposRes] = await Promise.all([
		httpClient.get(userUrl, { source: SOURCE, headers: headers(), ...options }),
		httpClient.get(reposUrl, { source: SOURCE, headers: headers(), ...options })
	])
	let user
	let repos
	try {
		user = JSON.parse(userRes.body)
		repos = JSON.parse(reposRes.body)
	} catch (error) {
		throw new ParseError('GitHub returned non-JSON', { source: SOURCE, url: userUrl, cause: error })
	}
	if (!Array.isArray(repos)) repos = []
	return {
		login: user?.login ?? username,
		name: user?.name ?? '',
		bio: user?.bio ?? '',
		avatar: user?.avatar_url ?? '',
		url: user?.html_url ?? `https://github.com/${username}`,
		company: user?.company ?? undefined,
		location: user?.location ?? undefined,
		blog: user?.blog ?? undefined,
		twitter: user?.twitter_username ?? undefined,
		followers: Number(user?.followers ?? 0),
		following: Number(user?.following ?? 0),
		publicRepos: Number(user?.public_repos ?? 0),
		publicGists: Number(user?.public_gists ?? 0),
		createdAt: user?.created_at ?? '',
		repos: repos.map(r => ({
			name: r?.name ?? '',
			fullName: r?.full_name ?? '',
			url: r?.html_url ?? '',
			description: r?.description ?? '',
			language: r?.language ?? '',
			stars: Number(r?.stargazers_count ?? 0),
			forks: Number(r?.forks_count ?? 0),
			updatedAt: r?.updated_at ?? ''
		}))
	}
}
