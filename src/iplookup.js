/**
 * IP geolocation lookup via ipwho.is (public, no key, generous limits).
 *
 * @example
 * import { getIpInfo } from '@shikytemo/shitools'
 * const info = await getIpInfo('8.8.8.8')
 */

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'iplookup'
const BASE = 'https://ipwho.is'

/**
 * @typedef {Object} IpInfo
 * @property {string} ip
 * @property {string} type            'IPv4' | 'IPv6'
 * @property {string} country
 * @property {string} countryCode
 * @property {string} region
 * @property {string} city
 * @property {string} postal
 * @property {number} latitude
 * @property {number} longitude
 * @property {string} timezone
 * @property {string} isp
 * @property {string} org
 * @property {string} asn
 * @property {string} flag           Country flag emoji.
 * @property {string} mapUrl         Google Maps URL.
 * @property {string} source
 */

/**
 * Look up an IPv4/IPv6 address. Pass empty string to look up the caller's
 * own public IP.
 *
 * @param {string} [ip='']
 * @param {{ retries?: number }} [options]
 * @returns {Promise<IpInfo>}
 */
export const getIpInfo = async (ip = '', options = {}) => {
	const trimmed = String(ip ?? '').trim()
	if (trimmed && !/^[a-fA-F0-9.:]+$/.test(trimmed)) {
		throw new InvalidInputError('ip looks malformed', { source: SOURCE })
	}
	const url = trimmed ? `${BASE}/${encodeURIComponent(trimmed)}` : BASE
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('ipwho.is returned non-JSON', { source: SOURCE, url, cause: error })
	}
	if (json?.success === false) {
		throw new ParseError(json.message ?? 'ipwho.is lookup failed', { source: SOURCE, url })
	}
	const lat = Number(json.latitude ?? 0)
	const lon = Number(json.longitude ?? 0)
	return {
		ip: json.ip ?? trimmed,
		type: json.type ?? '',
		country: json.country ?? '',
		countryCode: json.country_code ?? '',
		region: json.region ?? '',
		city: json.city ?? '',
		postal: json.postal ?? '',
		latitude: lat,
		longitude: lon,
		timezone: json.timezone?.id ?? '',
		isp: json.connection?.isp ?? '',
		org: json.connection?.org ?? '',
		asn: json.connection?.asn ? String(json.connection.asn) : '',
		flag: json.flag?.emoji ?? '',
		mapUrl: lat || lon ? `https://www.google.com/maps?q=${lat},${lon}` : '',
		source: 'ipwho.is'
	}
}
