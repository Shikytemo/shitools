/**
 * PyPI package info via pypi.org JSON endpoint. No key required.
 *
 * @example
 * import { getPypiPackage } from '@shikytemo/shitools'
 * const p = await getPypiPackage('requests')
 * console.log(p.versionLatest, p.summary)
 */

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'pypi'

/**
 * @typedef {Object} PypiPackage
 * @property {string} name
 * @property {string} versionLatest
 * @property {string} summary
 * @property {string} description
 * @property {string} author
 * @property {string} authorEmail
 * @property {string} license
 * @property {string} homepage
 * @property {string} projectUrl
 * @property {string[]} requiresDist
 * @property {string} requiresPython
 * @property {string} releaseDate
 * @property {string[]} versions
 * @property {string} source
 */

/**
 * Fetch metadata for a PyPI package.
 *
 * @param {string} name
 * @param {{ retries?: number }} [options]
 * @returns {Promise<PypiPackage>}
 */
export const getPypiPackage = async (name, options = {}) => {
	if (typeof name !== 'string' || !name.trim()) {
		throw new InvalidInputError('package name is required', { source: SOURCE })
	}
	const trimmed = name.trim()
	const url = `https://pypi.org/pypi/${encodeURIComponent(trimmed)}/json`
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('pypi returned non-JSON', { source: SOURCE, url, cause: error })
	}
	const info = json?.info ?? {}
	const releases = json?.releases ?? {}
	const versions = Object.keys(releases)
	const latestVersion = info.version ?? versions[versions.length - 1] ?? ''
	const latestRelease = releases[latestVersion]
	const releaseDate =
		Array.isArray(latestRelease) && latestRelease[0]?.upload_time
			? latestRelease[0].upload_time
			: ''
	return {
		name: info.name ?? trimmed,
		versionLatest: latestVersion,
		summary: info.summary ?? '',
		description: info.description ?? '',
		author: info.author ?? '',
		authorEmail: info.author_email ?? '',
		license: info.license ?? '',
		homepage: info.home_page ?? info.project_url ?? '',
		projectUrl: info.project_url ?? `https://pypi.org/project/${trimmed}/`,
		requiresDist: Array.isArray(info.requires_dist) ? info.requires_dist : [],
		requiresPython: info.requires_python ?? '',
		releaseDate,
		versions,
		source: 'pypi.org'
	}
}
