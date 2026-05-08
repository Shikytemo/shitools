/**
 * Quran lookup via the public equran.id v2 API. No API key required.
 *
 * @example
 * import { getSurah, getAyat, listSurah } from '@shikytemo/shitools'
 *
 * const list = await listSurah()
 * const surah = await getSurah(36)        // Yasin
 * const ayat  = await getAyat(2, 255)     // Al-Baqarah:255 (Ayat Kursi)
 */

import { InvalidInputError, ParseError } from './errors.js'
import { httpClient } from './http.js'

const SOURCE = 'quran'
const BASE = 'https://equran.id/api/v2'

/**
 * @typedef {Object} SurahMeta
 * @property {number} nomor
 * @property {string} nama
 * @property {string} namaLatin
 * @property {number} jumlahAyat
 * @property {string} tempatTurun
 * @property {string} arti
 */

/**
 * List all 114 surahs with their metadata.
 *
 * @param {{ retries?: number }} [options]
 * @returns {Promise<SurahMeta[]>}
 */
export const listSurah = async (options = {}) => {
	const url = `${BASE}/surat`
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('equran.id returned non-JSON', { source: SOURCE, url, cause: error })
	}
	const data = Array.isArray(json?.data) ? json.data : []
	return data.map(s => ({
		nomor: Number(s.nomor),
		nama: s.nama ?? '',
		namaLatin: s.namaLatin ?? '',
		jumlahAyat: Number(s.jumlahAyat ?? 0),
		tempatTurun: s.tempatTurun ?? '',
		arti: s.arti ?? ''
	}))
}

/**
 * @typedef {Object} Ayat
 * @property {number} nomorAyat
 * @property {string} teksArab
 * @property {string} teksLatin
 * @property {string} teksIndonesia
 * @property {string} [audio]
 */

/**
 * @typedef {SurahMeta} SurahDetail
 * @property {Ayat[]} ayat
 */

/**
 * Fetch a single surah (1–114) with full ayat list.
 *
 * @param {number|string} nomor
 * @param {{ retries?: number }} [options]
 * @returns {Promise<SurahDetail & { ayat: Ayat[] }>}
 */
export const getSurah = async (nomor, options = {}) => {
	const n = Number(nomor)
	if (!Number.isInteger(n) || n < 1 || n > 114) {
		throw new InvalidInputError('surah nomor must be an integer 1..114', { source: SOURCE })
	}
	const url = `${BASE}/surat/${n}`
	const response = await httpClient.get(url, { source: SOURCE, ...options })
	let json
	try {
		json = JSON.parse(response.body)
	} catch (error) {
		throw new ParseError('equran.id returned non-JSON', { source: SOURCE, url, cause: error })
	}
	const data = json?.data ?? {}
	const ayat = Array.isArray(data.ayat) ? data.ayat : []
	return {
		nomor: Number(data.nomor ?? n),
		nama: data.nama ?? '',
		namaLatin: data.namaLatin ?? '',
		jumlahAyat: Number(data.jumlahAyat ?? ayat.length),
		tempatTurun: data.tempatTurun ?? '',
		arti: data.arti ?? '',
		ayat: ayat.map(a => ({
			nomorAyat: Number(a.nomorAyat),
			teksArab: a.teksArab ?? '',
			teksLatin: a.teksLatin ?? '',
			teksIndonesia: a.teksIndonesia ?? '',
			audio: a.audio?.['05'] ?? a.audio?.['01'] ?? undefined
		}))
	}
}

/**
 * Fetch a single ayat (verse) by surah + ayah number.
 *
 * @param {number|string} surahNo
 * @param {number|string} ayahNo
 * @param {{ retries?: number }} [options]
 * @returns {Promise<Ayat & { surah: SurahMeta }>}
 */
export const getAyat = async (surahNo, ayahNo, options = {}) => {
	const a = Number(ayahNo)
	if (!Number.isInteger(a) || a < 1) {
		throw new InvalidInputError('ayat nomor must be a positive integer', { source: SOURCE })
	}
	const surah = await getSurah(surahNo, options)
	const found = surah.ayat.find(v => v.nomorAyat === a)
	if (!found) {
		throw new ParseError(`Ayat ${surah.namaLatin}:${a} not found (max ${surah.jumlahAyat})`, {
			source: SOURCE
		})
	}
	return {
		...found,
		surah: {
			nomor: surah.nomor,
			nama: surah.nama,
			namaLatin: surah.namaLatin,
			jumlahAyat: surah.jumlahAyat,
			tempatTurun: surah.tempatTurun,
			arti: surah.arti
		}
	}
}
