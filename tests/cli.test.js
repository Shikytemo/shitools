import { describe, expect, it, vi } from 'vitest'

import { parseArgv, renderHelp, runCli } from '../src/cli.js'

const captureIo = () => {
	const stdout = []
	const stderr = []
	const writes = []
	return {
		io: {
			stdout: line => stdout.push(line),
			stderr: line => stderr.push(line),
			writeFile: (file, content) => writes.push({ file, content })
		},
		stdout,
		stderr,
		writes
	}
}

describe('parseArgv', () => {
	it('splits positional args from flags', () => {
		const result = parseArgv(['anime', 'search', 'one', 'piece'])
		expect(result.positional).toEqual(['anime', 'search', 'one', 'piece'])
		expect(result.flags).toEqual({})
	})

	it('handles --flag=value, --flag value, and bare --flag', () => {
		const result = parseArgv(['cmd', '--limit=10', '--out', 'a.json', '--pretty'])
		expect(result.positional).toEqual(['cmd'])
		expect(result.flags).toEqual({ limit: '10', out: 'a.json', pretty: true })
	})

	it('handles --no-flag negation', () => {
		expect(parseArgv(['--no-pretty']).flags).toEqual({ pretty: false })
	})

	it('handles short flags and combined short flags', () => {
		expect(parseArgv(['-h']).flags).toEqual({ h: true })
		expect(parseArgv(['-pq']).flags).toEqual({ p: true, q: true })
	})

	it('treats tokens after `--` as positional', () => {
		const result = parseArgv(['cmd', '--', '--not-a-flag', 'x'])
		expect(result.positional).toEqual(['cmd', '--not-a-flag', 'x'])
		expect(result.flags).toEqual({})
	})

	it('lowercases flag names', () => {
		expect(parseArgv(['--LIMIT=5']).flags).toEqual({ limit: '5' })
	})
})

describe('renderHelp', () => {
	it('mentions every top-level command', () => {
		const help = renderHelp()
		for (const cmd of [
			'sources',
			'source',
			'pinterest',
			'anime',
			'katanime',
			'registry',
			'web',
			'url',
			'social',
			'catbox',
			'help',
			'version'
		]) {
			expect(help).toContain(cmd)
		}
	})
})

describe('runCli — built-in commands', () => {
	it('prints help and exits 0 with no args', async () => {
		const { io, stdout } = captureIo()
		const code = await runCli([], { io, deps: {} })
		expect(code).toBe(0)
		expect(stdout.join('\n')).toContain('shitools — reusable scraping toolkit')
	})

	it('prints version', async () => {
		const { io, stdout } = captureIo()
		const code = await runCli(['version'], { io, deps: {}, version: '9.9.9' })
		expect(code).toBe(0)
		expect(stdout).toEqual(['9.9.9'])
	})

	it('--help short alias works', async () => {
		const { io, stdout } = captureIo()
		const code = await runCli(['-h'], { io, deps: {} })
		expect(code).toBe(0)
		expect(stdout.join('\n')).toContain('Usage:')
	})
})

describe('runCli — dispatch', () => {
	it('dispatches anime search to deps.searchAnime', async () => {
		const { io, stdout } = captureIo()
		const deps = {
			searchAnime: vi.fn(async q => ({ query: q, results: [{ title: 'X' }] }))
		}
		const code = await runCli(['anime', 'search', 'demon', 'slayer'], { io, deps })
		expect(code).toBe(0)
		expect(deps.searchAnime).toHaveBeenCalledWith('demon slayer')
		expect(stdout[0]).toContain('"query": "demon slayer"')
	})

	it('dispatches sources find to deps.searchSources', async () => {
		const { io, stdout } = captureIo()
		const deps = {
			searchSources: vi.fn(() => [{ id: 'animals-axolotl' }])
		}
		const code = await runCli(['sources', 'find', 'axolotl'], { io, deps })
		expect(code).toBe(0)
		expect(deps.searchSources).toHaveBeenCalledWith('axolotl')
		expect(stdout[0]).toContain('animals-axolotl')
	})

	it('dispatches source <id> search to deps.searchSource', async () => {
		const { io } = captureIo()
		const deps = {
			searchSource: vi.fn(async () => [])
		}
		const code = await runCli(['source', 'samehadaku', 'search', 'one', 'piece'], { io, deps })
		expect(code).toBe(0)
		expect(deps.searchSource).toHaveBeenCalledWith('samehadaku', 'one piece')
	})

	it('writes output to --out file when provided', async () => {
		const { io, writes, stderr } = captureIo()
		const deps = {
			getNpmPackage: vi.fn(async () => ({ name: 'express', version: '4.0.0' }))
		}
		const code = await runCli(['registry', 'npm', 'express', '--out', '/tmp/x.json'], {
			io,
			deps
		})
		expect(code).toBe(0)
		expect(writes).toEqual([
			{
				file: '/tmp/x.json',
				content: JSON.stringify({ name: 'express', version: '4.0.0' }, null, 2)
			}
		])
		expect(stderr.join('\n')).toContain('Wrote /tmp/x.json')
	})

	it('--no-pretty produces compact JSON', async () => {
		const { io, stdout } = captureIo()
		const deps = {
			scrapeWebsite: vi.fn(async () => ({ title: 'X' }))
		}
		const code = await runCli(['web', 'meta', 'https://example.com', '--no-pretty'], { io, deps })
		expect(code).toBe(0)
		expect(stdout[0]).toBe('{"title":"X"}')
	})

	it('returns 1 on unknown command', async () => {
		const { io, stderr } = captureIo()
		const code = await runCli(['nope'], { io, deps: {} })
		expect(code).toBe(1)
		expect(stderr.join('\n')).toContain('Unknown command: nope')
	})

	it('returns 1 and surfaces error name + message on handler throw', async () => {
		const { io, stderr } = captureIo()
		const error = Object.assign(new Error('rate limited'), { name: 'RateLimitError' })
		const deps = {
			pinterest: vi.fn(async () => {
				throw error
			})
		}
		const code = await runCli(['pinterest', 'axolotl'], { io, deps })
		expect(code).toBe(1)
		expect(stderr.join('\n')).toBe('RateLimitError: rate limited')
	})

	it('returns 1 when required positional argument is missing', async () => {
		const { io, stderr } = captureIo()
		const code = await runCli(['anime', 'detail'], { io, deps: { getAnimeDetail: vi.fn() } })
		expect(code).toBe(1)
		expect(stderr.join('\n')).toContain('Missing required argument')
	})

	it('catbox upload-file dispatches with single path', async () => {
		const { io } = captureIo()
		const deps = { uploadFile: vi.fn(async () => 'https://files.catbox.moe/abc.png') }
		const code = await runCli(['catbox', 'upload-file', '/tmp/img.png'], { io, deps })
		expect(code).toBe(0)
		expect(deps.uploadFile).toHaveBeenCalledWith('/tmp/img.png')
	})

	it('pinterest passes --limit as number', async () => {
		const { io } = captureIo()
		const deps = { pinterest: vi.fn(async () => []) }
		const code = await runCli(['pinterest', 'anime girl', '--limit=3'], { io, deps })
		expect(code).toBe(0)
		expect(deps.pinterest).toHaveBeenCalledWith('anime girl', { limit: 3 })
	})
})
