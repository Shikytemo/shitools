import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError } from '../src/errors.js'
import { getSholatSchedule, searchSholatCity, sholat } from '../src/sholat.js'

const mockResponse = body => ({
	ok: true,
	status: 200,
	statusText: 'OK',
	url: 'https://example.com/',
	headers: new Headers(),
	text: async () => JSON.stringify(body)
})

const CITY_FIXTURE = { status: true, data: [{ id: '1301', lokasi: 'KOTA JAKARTA SELATAN' }] }
const SCHEDULE_FIXTURE = {
	status: true,
	data: {
		lokasi: 'KOTA JAKARTA SELATAN',
		jadwal: {
			tanggal: '2026-05-08',
			imsak: '04:30',
			subuh: '04:40',
			terbit: '05:55',
			dhuha: '06:25',
			dzuhur: '12:00',
			ashar: '15:15',
			maghrib: '18:00',
			isya: '19:10'
		}
	}
}

describe('searchSholatCity', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('returns city matches with id', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(CITY_FIXTURE))
		)
		const cities = await searchSholatCity('jakarta')
		expect(cities[0].id).toBe('1301')
	})

	it('throws on empty query', async () => {
		await expect(searchSholatCity('  ')).rejects.toBeInstanceOf(InvalidInputError)
	})
})

describe('getSholatSchedule', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('throws when cityId missing', async () => {
		await expect(getSholatSchedule('')).rejects.toBeInstanceOf(InvalidInputError)
	})

	it('returns parsed jadwal', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(SCHEDULE_FIXTURE))
		)
		const sched = await getSholatSchedule('1301', '2026-05-08')
		expect(sched.jadwal.subuh).toBe('04:40')
		expect(sched.jadwal.maghrib).toBe('18:00')
	})
})

describe('sholat dispatch', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('searches city then fetches schedule', async () => {
		let calls = 0
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				calls += 1
				return mockResponse(calls === 1 ? CITY_FIXTURE : SCHEDULE_FIXTURE)
			})
		)
		const sched = await sholat('jakarta', '2026-05-08')
		expect(sched.cityId).toBe('1301')
	})
})
