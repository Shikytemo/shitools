import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError } from '../src/errors.js'
import { getSfileFile, searchSfile } from '../src/sfile.js'

const mockResponse = (body, init = {}) => ({
	ok: init.ok ?? true,
	status: init.status ?? 200,
	statusText: init.statusText ?? 'OK',
	url: init.url ?? 'https://example.com/',
	headers: new Headers(init.headers ?? {}),
	text: async () => String(body)
})

const SEARCH_HTML = `<html><body>
<div class="list"><a href="/?id=abc">whatsapp.apk</a> (52.4 MB)</div>
<div class="list"><a href="https://sfile.mobi/?id=def">whatsapp-mod.apk</a> (60.1 MB)</div>
</body></html>`

const FILE_HTML = `<html><body>
<div class="w3-row-padding"><img src="/icon.png" alt="whatsapp.apk"></div>
<div class="list">whatsapp.apk - application/vnd.android.package-archive
some other line</div>
<a id="download" href="https://sfile.mobi/dl?token=xyz">Download File (52.4 MB)</a>
</body></html>`

describe('searchSfile', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('parses search results', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(SEARCH_HTML))
		)
		const hits = await searchSfile('whatsapp')
		expect(hits).toHaveLength(2)
		expect(hits[0].title).toBe('whatsapp.apk')
		expect(hits[0].size).toBe('52.4 MB')
		expect(hits[1].url).toBe('https://sfile.mobi/?id=def')
	})

	it('throws on empty query', async () => {
		await expect(searchSfile('  ')).rejects.toBeInstanceOf(InvalidInputError)
	})
})

describe('getSfileFile', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('extracts download link with random k token', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(FILE_HTML))
		)
		const file = await getSfileFile('https://sfile.mobi/?id=abc')
		expect(file.filename).toBe('whatsapp.apk')
		expect(file.download).toMatch(/^https:\/\/sfile\.mobi\/dl\?token=xyz&k=\d+$/)
		expect(file.filesize).toBe('52.4 MB')
	})
})
