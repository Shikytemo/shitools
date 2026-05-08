/**
 * Global weather lookup via wttr.in. No API key required, no auth.
 *
 * @example
 * import { getWeather } from '@shikytemo/shitools'
 * const w = await getWeather('Jakarta')
 * console.log(w.condition, w.temperature)
 */

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'weather'

/**
 * @typedef {Object} Weather
 * @property {string} location
 * @property {string} country
 * @property {string} condition
 * @property {string} temperature   e.g. `27°C`
 * @property {string} feelsLike
 * @property {string} humidity
 * @property {string} wind
 * @property {string} visibility
 * @property {string} observedAt
 * @property {string} source        'wttr.in'
 */

/**
 * Fetch current weather for `query` (city name, airport code, lat,lon).
 *
 * @param {string} query
 * @param {{ lang?: string, retries?: number }} [options]
 * @returns {Promise<Weather>}
 */
export const getWeather = async (query, options = {}) => {
	if (typeof query !== 'string' || !query.trim()) {
		throw new InvalidInputError('weather location is required', { source: SOURCE })
	}
	const lang = options.lang ?? 'en'
	const url = `https://wttr.in/${encodeURIComponent(query.trim())}?format=j1&lang=${encodeURIComponent(lang)}`
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('wttr.in returned non-JSON', { source: SOURCE, url, cause: error })
	}
	const current = json?.current_condition?.[0] ?? {}
	const area = json?.nearest_area?.[0] ?? {}
	const desc = current.lang_id?.[0]?.value ?? current.weatherDesc?.[0]?.value ?? ''
	return {
		location: area.areaName?.[0]?.value ?? query,
		country: area.country?.[0]?.value ?? '',
		condition: desc,
		temperature: `${current.temp_C ?? '?'}°C`,
		feelsLike: `${current.FeelsLikeC ?? '?'}°C`,
		humidity: `${current.humidity ?? '?'}%`,
		wind: `${current.windspeedKmph ?? '?'} km/h ${current.winddir16Point ?? ''}`.trim(),
		visibility: `${current.visibility ?? '?'} km`,
		observedAt: current.observation_time ?? '',
		source: 'wttr.in'
	}
}
