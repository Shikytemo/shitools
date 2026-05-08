import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError } from '../src/errors.js'
import { getAyat, getSurah, listSurah } from '../src/quran.js'

const mockResponse = (body, init = {}) => ({
	ok: init.ok ?? true,
	status: init.status ?? 200,
	statusText: init.statusText ?? 'OK',
	url: init.url ?? 'https://example.com/',
	headers: new Headers(init.headers ?? {}),
	text: async () => JSON.stringify(body)
})

const SURAH_LIST = {
	code: 200,
	data: [
		{
			nomor: 1,
			nama: 'الفاتحة',
			namaLatin: 'Al-Fatihah',
			jumlahAyat: 7,
			tempatTurun: 'Mekah',
			arti: 'Pembukaan'
		}
	]
}

const SURAH_DETAIL = {
	code: 200,
	data: {
		nomor: 36,
		nama: 'يس',
		namaLatin: 'Yasin',
		jumlahAyat: 2,
		tempatTurun: 'Mekah',
		arti: 'Yaa siin',
		ayat: [
			{
				nomorAyat: 1,
				teksArab: 'يس',
				teksLatin: 'Yaasiin',
				teksIndonesia: 'Yaa siin.',
				audio: { '05': 'https://x' }
			},
			{
				nomorAyat: 2,
				teksArab: 'وَالْقُرْآنِ',
				teksLatin: 'Wal qur’aanil',
				teksIndonesia: 'Demi Al-Quran.',
				audio: {}
			}
		]
	}
}

describe('listSurah', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('returns the 114-list shape', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(SURAH_LIST))
		)
		const list = await listSurah()
		expect(list[0].namaLatin).toBe('Al-Fatihah')
	})
})

describe('getSurah', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('throws InvalidInputError on out-of-range nomor', async () => {
		await expect(getSurah(0)).rejects.toBeInstanceOf(InvalidInputError)
		await expect(getSurah(115)).rejects.toBeInstanceOf(InvalidInputError)
	})

	it('returns ayat normalized', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(SURAH_DETAIL))
		)
		const surah = await getSurah(36)
		expect(surah.namaLatin).toBe('Yasin')
		expect(surah.ayat).toHaveLength(2)
		expect(surah.ayat[0].audio).toBe('https://x')
	})
})

describe('getAyat', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('returns single ayat with surah meta', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(SURAH_DETAIL))
		)
		const ayat = await getAyat(36, 2)
		expect(ayat.nomorAyat).toBe(2)
		expect(ayat.surah.namaLatin).toBe('Yasin')
	})
})
