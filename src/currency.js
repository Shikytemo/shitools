/**
 * Currency conversion via open.er-api.com. No API key required.
 *
 * @example
 * import { convertCurrency, getRates } from '@shikytemo/shitools'
 * const out = await convertCurrency('USD', 'IDR', 100)
 * const rates = await getRates('USD')
 */

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'currency'
const BASE = 'https://open.er-api.com/v6/latest'

/**
 * @typedef {Object} Rates
 * @property {string} base
 * @property {string} updatedAt   UTC time of last update from API.
 * @property {Object<string, number>} rates
 * @property {string} source
 */

/**
 * Fetch latest rates with `base` as the reference currency.
 *
 * @param {string} [base='USD']
 * @param {{ retries?: number }} [options]
 * @returns {Promise<Rates>}
 */
export const getRates = async (base = 'USD', options = {}) => {
	const code = String(base ?? 'USD')
		.toUpperCase()
		.trim()
	if (!/^[A-Z]{3}$/.test(code)) {
		throw new InvalidInputError('base must be a 3-letter ISO 4217 code', { source: SOURCE })
	}
	const url = `${BASE}/${code}`
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('open.er-api returned non-JSON', { source: SOURCE, url, cause: error })
	}
	if (json?.result !== 'success') {
		throw new ParseError(json?.['error-type'] ?? 'currency API error', { source: SOURCE, url })
	}
	return {
		base: json.base_code ?? code,
		updatedAt: json.time_last_update_utc ?? '',
		rates: json.rates ?? {},
		source: 'open.er-api.com'
	}
}

/**
 * @typedef {Object} Conversion
 * @property {string} from
 * @property {string} to
 * @property {number} amount
 * @property {number} rate
 * @property {number} result
 * @property {string} updatedAt
 * @property {string} source
 */

/**
 * Convert `amount` from `from` to `to` (defaults to 1).
 *
 * @param {string} from
 * @param {string} to
 * @param {number} [amount=1]
 * @param {{ retries?: number }} [options]
 * @returns {Promise<Conversion>}
 */
export const convertCurrency = async (from, to, amount = 1, options = {}) => {
	const a = Number(amount)
	if (!Number.isFinite(a)) {
		throw new InvalidInputError('amount must be a finite number', { source: SOURCE })
	}
	const target = String(to ?? '')
		.toUpperCase()
		.trim()
	if (!/^[A-Z]{3}$/.test(target)) {
		throw new InvalidInputError('to must be a 3-letter ISO 4217 code', { source: SOURCE })
	}
	const ratesData = await getRates(from, options)
	const rate = ratesData.rates[target]
	if (typeof rate !== 'number') {
		throw new ParseError(`Currency ${target} not found in rates`, { source: SOURCE })
	}
	return {
		from: ratesData.base,
		to: target,
		amount: a,
		rate,
		result: Number((a * rate).toFixed(4)),
		updatedAt: ratesData.updatedAt,
		source: 'open.er-api.com'
	}
}
