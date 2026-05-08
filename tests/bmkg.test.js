import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError } from '../src/errors.js'
import { bmkg, getBmkgWeather, searchBmkgArea } from '../src/bmkg.js'

const mockResponse = body => ({
	ok: true,
	status: 200,
	statusText: 'OK',
	url: 'https://example.com/',
	headers: new Headers(),
	text: async () => JSON.stringify(body)
})

const AREA_FIXTURE = [
	{
		kode: '34.04.05.2003',
		desa: 'Caturtunggal',
		kecamatan: 'Depok',
		kabupaten: 'Sleman',
		provinsi: 'DI Yogyakarta'
	}
]

const WEATHER_FIXTURE = {
	lokasi: {
		adm4: '34.04.05.2003',
		desa: 'Caturtunggal',
		kecamatan: 'Depok',
		kotkab: 'Sleman',
		provinsi: 'DI Yogyakarta'
	},
	data: [
		{
			cuaca: [
				[
					{
						local_datetime: '2026-05-08 12:00',
						weather_desc: 'Cerah Berawan',
						t: 28,
						hu: 75,
						ws: 8,
						wd: 'Barat'
					}
				]
			]
		}
	]
}

describe('searchBmkgArea', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('returns mapped areas', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(AREA_FIXTURE))
		)
		const areas = await searchBmkgArea('Sleman')
		expect(areas[0].adm4).toBe('34.04.05.2003')
		expect(areas[0].kotkab).toBe('Sleman')
	})

	it('throws on empty query', async () => {
		await expect(searchBmkgArea('')).rejects.toBeInstanceOf(InvalidInputError)
	})
})

describe('getBmkgWeather', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('throws on empty adm4', async () => {
		await expect(getBmkgWeather('')).rejects.toBeInstanceOf(InvalidInputError)
	})

	it('returns mapped forecast', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(WEATHER_FIXTURE))
		)
		const w = await getBmkgWeather('34.04.05.2003')
		expect(w.kotkab).toBe('Sleman')
		expect(w.forecast).toHaveLength(1)
		expect(w.forecast[0].weatherDesc).toBe('Cerah Berawan')
	})
})

describe('bmkg dispatch', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('searches area then fetches weather', async () => {
		let calls = 0
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				calls += 1
				return mockResponse(calls === 1 ? AREA_FIXTURE : WEATHER_FIXTURE)
			})
		)
		const w = await bmkg('Sleman')
		expect(w.adm4).toBe('34.04.05.2003')
	})
})
