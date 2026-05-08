/**
 * npm package "stalker" — fetches metadata, version history, dependency
 * counts, and publish times from the public npm registry.
 *
 * @example
 * import { npmStalk } from '@shikytemo/shitools'
 * const info = await npmStalk('axios')
 * console.log(info.versionLatest, info.versionPublish)
 */

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'npmstalk'
const REGISTRY = 'https://registry.npmjs.org'

/**
 * @typedef {Object} NpmStalkResult
 * @property {string} name
 * @property {string} description
 * @property {string} versionLatest
 * @property {string} versionPublish
 * @property {number} versionCount
 * @property {number} latestDependencies
 * @property {number} publishDependencies
 * @property {string} publishTime         ISO timestamp
 * @property {string} latestPublishTime   ISO timestamp
 * @property {string} [homepage]
 * @property {string} [license]
 * @property {string[]} [keywords]
 * @property {string[]} [maintainers]
 */

/**
 * Fetch npm registry data for `packageName`.
 *
 * @param {string} packageName
 * @param {{ retries?: number }} [options]
 * @returns {Promise<NpmStalkResult>}
 */
export const npmStalk = async (packageName, options = {}) => {
	if (typeof packageName !== 'string' || !packageName.trim()) {
		throw new InvalidInputError('package name is required', { source: SOURCE })
	}
	const url = `${REGISTRY}/${encodeURIComponent(packageName.trim())}`
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('npm registry returned non-JSON', { source: SOURCE, url, cause: error })
	}
	const versions = json?.versions ?? {}
	const allVersions = Object.keys(versions)
	if (allVersions.length === 0) {
		throw new ParseError(`Package "${packageName}" has no versions`, { source: SOURCE })
	}
	const versionLatest = json?.['dist-tags']?.latest ?? allVersions[allVersions.length - 1]
	const versionPublish = allVersions[0]
	const latestPkg = versions[versionLatest] ?? {}
	const firstPkg = versions[versionPublish] ?? {}
	return {
		name: json?.name ?? packageName,
		description: json?.description ?? latestPkg.description ?? '',
		versionLatest,
		versionPublish,
		versionCount: allVersions.length,
		latestDependencies: Object.keys(latestPkg.dependencies ?? {}).length,
		publishDependencies: Object.keys(firstPkg.dependencies ?? {}).length,
		publishTime: json?.time?.created ?? '',
		latestPublishTime: json?.time?.[versionLatest] ?? '',
		homepage: json?.homepage,
		license: latestPkg.license ?? json?.license,
		keywords: Array.isArray(latestPkg.keywords) ? latestPkg.keywords : [],
		maintainers: Array.isArray(json?.maintainers)
			? json.maintainers.map(m => m?.name).filter(Boolean)
			: []
	}
}
