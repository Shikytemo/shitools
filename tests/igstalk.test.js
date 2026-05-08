import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidInputError } from '../src/errors.js'
import { igStalk } from '../src/igstalk.js'

const mockResponse = (body, init = {}) => ({
	ok: init.ok ?? true,
	status: init.status ?? 200,
	statusText: init.statusText ?? 'OK',
	url: init.url ?? 'https://example.com/',
	headers: new Headers(init.headers ?? {}),
	text: async () => String(body)
})

const HTML = `<html><body>
<div id="user-page">
  <div class="user">
    <div class="row">
      <div><div class="user__img" style="background-image: url('https://cdn/profile.jpg')"></div></div>
    </div>
    <div>
      <div class="col-md-4 col-8 my-3">
        <div><a href="#"><h1>Cristiano Ronaldo</h1></a><h4>@cristiano</h4></div>
        <ul>
          <li>3,500 Posts</li>
          <li>620,000,000 Followers</li>
          <li>540 Following</li>
        </ul>
      </div>
      <div class="col-md-5 my-3"><div>Footballer</div></div>
    </div>
  </div>
</div>
</body></html>`

describe('igStalk', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('extracts profile fields from dumpoir HTML', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mockResponse(HTML))
		)
		const result = await igStalk('cristiano')
		expect(result.username).toBe('cristiano')
		expect(result.fullname).toBe('Cristiano Ronaldo')
		expect(result.followers).toBe('620,000,000')
		expect(result.profilePic).toBe('https://cdn/profile.jpg')
	})

	it('throws on empty username', async () => {
		await expect(igStalk('  ')).rejects.toBeInstanceOf(InvalidInputError)
	})
})
