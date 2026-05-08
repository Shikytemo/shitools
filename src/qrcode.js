/**
 * QR code generator + decoder via the public api.qrserver.com endpoints.
 * Encoding is a URL builder (no network call required).
 * Decoding fetches the API for content extracted from an image URL.
 *
 * @example
 * import { qrCodeUrl, decodeQrCode } from '@shikytemo/shitools'
 * const url = qrCodeUrl('https://example.com', { size: 400 })
 * const decoded = await decodeQrCode('https://example.com/qr.png')
 */

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'qrcode'
const CREATE = 'https://api.qrserver.com/v1/create-qr-code/'
const READ = 'https://api.qrserver.com/v1/read-qr-code/'

/**
 * Build a `api.qrserver.com` URL that renders `text` as a QR PNG.
 *
 * @param {string} text
 * @param {{ size?: number, margin?: number, format?: 'png' | 'svg' | 'gif' | 'jpeg' }} [options]
 * @returns {string}
 */
export const qrCodeUrl = (text, options = {}) => {
	if (typeof text !== 'string' || !text.length) {
		throw new InvalidInputError('text is required', { source: SOURCE })
	}
	const size = Math.max(50, Math.min(1000, Number(options.size ?? 300)))
	const margin = Math.max(0, Math.min(50, Number(options.margin ?? 2)))
	const format = options.format ?? 'png'
	const params = new URLSearchParams({
		size: `${size}x${size}`,
		margin: String(margin),
		format,
		data: text
	})
	return `${CREATE}?${params.toString()}`
}

/**
 * Read a QR code from a remote PNG/JPG URL via api.qrserver.com.
 *
 * @param {string} imageUrl
 * @param {{ retries?: number }} [options]
 * @returns {Promise<string>}
 */
export const decodeQrCode = async (imageUrl, options = {}) => {
	if (typeof imageUrl !== 'string' || !imageUrl.trim()) {
		throw new InvalidInputError('image url is required', { source: SOURCE })
	}
	const target = `${READ}?fileurl=${encodeURIComponent(imageUrl.trim())}`
	const response = await httpClient.get(target, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('qrserver returned non-JSON', {
			source: SOURCE,
			url: target,
			cause: error
		})
	}
	const data = Array.isArray(json) ? json[0]?.symbol?.[0]?.data : null
	if (!data) {
		throw new ParseError('No QR data found in image', { source: SOURCE, url: target })
	}
	return String(data)
}
