/**
 * Jadwal sholat (prayer schedule) via api.myquran.com v2.
 * No API key required.
 *
 * @example
 * import { searchSholatCity, getSholatSchedule } from '@shikytemo/shitools'
 *
 * const cities = await searchSholatCity('jakarta')
 * const sched  = await getSholatSchedule(cities[0].id, '2026-05-08')
 * console.log(sched.jadwal.subuh)
 */

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'sholat'
const BASE = 'https://api.myquran.com/v2/sholat'

const pad = n => String(n).padStart(2, '0')

const formatDate = value => {
	if (!value) {
		const d = new Date()
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
	}
	if (value instanceof Date)
		return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
	return String(value)
}

/**
 * @typedef {Object} SholatCity
 * @property {string} id
 * @property {string} lokasi
 */

/**
 * Search for a city by name. Returns matches with their numeric ID.
 *
 * @param {string} query
 * @param {{ retries?: number }} [options]
 * @returns {Promise<SholatCity[]>}
 */
export const searchSholatCity = async (query, options = {}) => {
	if (typeof query !== 'string' || !query.trim()) {
		throw new InvalidInputError('city name is required', { source: SOURCE })
	}
	const url = `${BASE}/kota/cari/${encodeURIComponent(query.trim())}`
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('myquran returned non-JSON', { source: SOURCE, url, cause: error })
	}
	const data = Array.isArray(json?.data) ? json.data : []
	return data.map(c => ({ id: String(c.id), lokasi: c.lokasi ?? '' }))
}

/**
 * @typedef {Object} SholatSchedule
 * @property {string} cityId
 * @property {string} city
 * @property {string} date           ISO `YYYY-MM-DD`
 * @property {Object<string,string>} jadwal  Keys: imsak, subuh, terbit, dhuha, dzuhur, ashar, maghrib, isya
 */

/**
 * Fetch sholat schedule for a city ID + date (defaults to today).
 *
 * @param {string|number} cityId      Numeric city ID from {@link searchSholatCity}.
 * @param {string|Date} [date]        `YYYY-MM-DD` or Date (default today).
 * @param {{ retries?: number }} [options]
 * @returns {Promise<SholatSchedule>}
 */
export const getSholatSchedule = async (cityId, date, options = {}) => {
	if (cityId === undefined || cityId === null || `${cityId}` === '') {
		throw new InvalidInputError('cityId is required', { source: SOURCE })
	}
	const iso = formatDate(date)
	const url = `${BASE}/jadwal/${encodeURIComponent(String(cityId))}/${iso}`
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('myquran returned non-JSON', { source: SOURCE, url, cause: error })
	}
	const data = json?.data ?? {}
	const j = data.jadwal ?? {}
	return {
		cityId: String(cityId),
		city: data.lokasi ?? data.daerah ?? '',
		date: j.tanggal ?? iso,
		jadwal: {
			imsak: j.imsak ?? '',
			subuh: j.subuh ?? '',
			terbit: j.terbit ?? '',
			dhuha: j.dhuha ?? '',
			dzuhur: j.dzuhur ?? '',
			ashar: j.ashar ?? '',
			maghrib: j.maghrib ?? '',
			isya: j.isya ?? ''
		}
	}
}

/**
 * Smart dispatch: city name → first match → schedule.
 *
 * @param {string} cityName
 * @param {string|Date} [date]
 * @param {{ retries?: number }} [options]
 * @returns {Promise<SholatSchedule>}
 */
export const sholat = async (cityName, date, options = {}) => {
	const matches = await searchSholatCity(cityName, options)
	if (matches.length === 0) {
		throw new ParseError(`Kota "${cityName}" tidak ditemukan`, { source: SOURCE })
	}
	return getSholatSchedule(matches[0].id, date, options)
}
