/**
 * Cuaca BMKG (Indonesia) — official Badan Meteorologi, Klimatologi, dan
 * Geofisika public API.
 *
 * @example
 * import { searchBmkgArea, getBmkgWeather } from '@shikytemo/shitools'
 * const areas = await searchBmkgArea('Sleman')
 * const cuaca = await getBmkgWeather(areas[0].adm4)
 */

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'bmkg'
const PRAKIRAAN_BASE = 'https://api.bmkg.go.id/publik/prakiraan-cuaca'
const WILAYAH_BASE = 'https://kodewilayah.id/api'

/**
 * @typedef {Object} BmkgArea
 * @property {string} adm4
 * @property {string} desa
 * @property {string} kecamatan
 * @property {string} kotkab
 * @property {string} provinsi
 */

/**
 * Search administrative area code (adm4) by query.
 *
 * @param {string} query
 * @param {{ retries?: number }} [options]
 * @returns {Promise<BmkgArea[]>}
 */
export const searchBmkgArea = async (query, options = {}) => {
	if (typeof query !== 'string' || !query.trim()) {
		throw new InvalidInputError('area query is required', { source: SOURCE })
	}
	const url = `${WILAYAH_BASE}/cari/${encodeURIComponent(query.trim())}`
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('kodewilayah returned non-JSON', { source: SOURCE, url, cause: error })
	}
	const data = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : []
	return data.map(a => ({
		adm4: a.kode ?? a.adm4 ?? '',
		desa: a.desa ?? a.kelurahan ?? '',
		kecamatan: a.kecamatan ?? '',
		kotkab: a.kabupaten ?? a.kota ?? a.kotkab ?? '',
		provinsi: a.provinsi ?? ''
	}))
}

/**
 * @typedef {Object} BmkgForecast
 * @property {string} datetime         ISO timestamp
 * @property {string} weatherDesc
 * @property {number} temperature
 * @property {number} humidity
 * @property {number} windSpeed        km/h
 * @property {string} windDirection
 */

/**
 * @typedef {Object} BmkgWeather
 * @property {string} adm4
 * @property {string} desa
 * @property {string} kecamatan
 * @property {string} kotkab
 * @property {string} provinsi
 * @property {BmkgForecast[]} forecast
 */

/**
 * Fetch BMKG official weather forecast for a given area code (adm4).
 *
 * @param {string} adm4
 * @param {{ retries?: number }} [options]
 * @returns {Promise<BmkgWeather>}
 */
export const getBmkgWeather = async (adm4, options = {}) => {
	if (typeof adm4 !== 'string' || !adm4.trim()) {
		throw new InvalidInputError('adm4 area code is required', { source: SOURCE })
	}
	const url = `${PRAKIRAAN_BASE}?adm4=${encodeURIComponent(adm4.trim())}`
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('BMKG returned non-JSON', { source: SOURCE, url, cause: error })
	}
	const lokasi = json?.lokasi ?? {}
	const cuaca = Array.isArray(json?.data?.[0]?.cuaca) ? json.data[0].cuaca : []
	const forecast = []
	for (const slot of cuaca) {
		if (!Array.isArray(slot)) continue
		for (const f of slot) {
			forecast.push({
				datetime: f.local_datetime ?? f.datetime ?? '',
				weatherDesc: f.weather_desc ?? f.weather_desc_en ?? '',
				temperature: Number(f.t ?? 0),
				humidity: Number(f.hu ?? 0),
				windSpeed: Number(f.ws ?? 0),
				windDirection: f.wd ?? f.wd_to ?? ''
			})
		}
	}
	return {
		adm4: lokasi.adm4 ?? adm4,
		desa: lokasi.desa ?? '',
		kecamatan: lokasi.kecamatan ?? '',
		kotkab: lokasi.kotkab ?? '',
		provinsi: lokasi.provinsi ?? '',
		forecast
	}
}

/**
 * Smart dispatch: search by name → use first match → fetch forecast.
 *
 * @param {string} query
 * @param {{ retries?: number }} [options]
 * @returns {Promise<BmkgWeather>}
 */
export const bmkg = async (query, options = {}) => {
	const areas = await searchBmkgArea(query, options)
	if (areas.length === 0)
		throw new ParseError(`Area "${query}" tidak ditemukan`, { source: SOURCE })
	const top = areas.find(a => a.adm4) ?? areas[0]
	if (!top.adm4) throw new ParseError(`Area "${query}" tidak punya kode adm4`, { source: SOURCE })
	return getBmkgWeather(top.adm4, options)
}
