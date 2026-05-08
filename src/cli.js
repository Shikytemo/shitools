/**
 * Unified CLI for shitools.
 *
 * Pure dispatch logic — testable without spawning a child process. The thin
 * binary at `bin/shitools.js` only wires `process.argv` and `process.exit` to
 * {@link runCli}.
 *
 * @example
 * import { runCli } from '@shikytemo/shitools/src/cli.js'
 * await runCli(['anime', 'search', 'one piece'])
 */

import { writeFileSync } from 'node:fs'

import * as shitools from './index.js'

/**
 * Result of {@link parseArgv}.
 *
 * @typedef {Object} ParsedArgv
 * @property {string[]} positional   Positional arguments, in order.
 * @property {Record<string, string|boolean>} flags   Long/short flags, lower-cased keys.
 */

/**
 * Parse a process.argv-style list (already stripped of node + script).
 *
 * Supports:
 * - `--flag`           → `{ flag: true }`
 * - `--flag=value`     → `{ flag: 'value' }`
 * - `--flag value`     → `{ flag: 'value' }`
 * - `-x`               → `{ x: true }`
 * - `--no-flag`        → `{ flag: false }`
 * - Everything else is positional.
 * - `--` ends flag parsing; remaining tokens are all positional.
 *
 * @param {string[]} argv
 * @returns {ParsedArgv}
 */
export const parseArgv = (argv = []) => {
	const positional = []
	/** @type {Record<string, string|boolean>} */
	const flags = {}
	let stopFlags = false

	for (let i = 0; i < argv.length; i += 1) {
		const token = argv[i]

		if (stopFlags) {
			positional.push(token)
			continue
		}
		if (token === '--') {
			stopFlags = true
			continue
		}

		if (token.startsWith('--')) {
			const body = token.slice(2)
			const eq = body.indexOf('=')
			if (eq !== -1) {
				flags[body.slice(0, eq).toLowerCase()] = body.slice(eq + 1)
				continue
			}
			if (body.startsWith('no-')) {
				flags[body.slice(3).toLowerCase()] = false
				continue
			}
			const next = argv[i + 1]
			if (next !== undefined && !next.startsWith('-')) {
				flags[body.toLowerCase()] = next
				i += 1
			} else {
				flags[body.toLowerCase()] = true
			}
			continue
		}

		if (token.startsWith('-') && token.length > 1) {
			for (const char of token.slice(1)) flags[char.toLowerCase()] = true
			continue
		}

		positional.push(token)
	}

	return { positional, flags }
}

const ALIASES = {
	h: 'help',
	v: 'version',
	q: 'quiet',
	o: 'out',
	p: 'pretty'
}

const expandAliases = flags => {
	const out = { ...flags }
	for (const [short, long] of Object.entries(ALIASES)) {
		if (Object.prototype.hasOwnProperty.call(out, short)) {
			if (!Object.prototype.hasOwnProperty.call(out, long)) out[long] = out[short]
			delete out[short]
		}
	}
	return out
}

/**
 * Render the human-readable CLI help blob.
 *
 * @returns {string}
 */
export const renderHelp = () =>
	[
		'shitools — reusable scraping toolkit',
		'',
		'Usage:',
		'  shitools <command> [...args] [--flag=value]',
		'',
		'Commands:',
		'  help                                Show this help',
		'  version                             Print package version',
		'',
		'  sources list [--category=...] [--type=...] [--limit=N]',
		'  sources find <query>',
		'  sources get <id>',
		'  sources fetch <id>',
		'  source <id> search <query>',
		'  source <id> scrape <input>',
		'  source <id> latest',
		'',
		'  pinterest <url-or-query> [--limit=N]',
		'  anime search <query>',
		'  anime detail <url>',
		'  anime top',
		'  anime current',
		'  katanime search <query>',
		'  katanime random',
		'',
		'  registry github <owner/repo>',
		'  registry github-search <query>',
		'  registry npm <package>',
		'  registry npm-search <query>',
		'',
		'  web meta <url>',
		'  url shorten <url>',
		'  url qr <text>',
		'  social <url>                        Resolve TikTok / Instagram / YouTube via yt-dlp',
		'',
		'  lyrics <query>                      Smart: split "Artist - Title", else Genius search + lyrics.ovh fetch',
		'  lyrics search <query> [--limit=N]   Genius search hits',
		'  lyrics get <artist> -- <title>      Direct lyrics.ovh fetch',
		'',
		'  tiktok <url-or-query> [--limit=N]   Smart dispatch (URL → video, else search)',
		'  tiktok video <url>                  Resolve to no-watermark MP4 + metadata',
		'  tiktok search <query> [--limit=N]   Keyword feed search',
		'  tiktok user <@username>             Profile + stats',
		'',
		'  catbox upload-file <path>',
		'  catbox upload-url <url>',
		'  catbox delete-files <name...>',
		'  catbox create-album <title> <name...>',
		'  catbox edit-album <short> <title> <name...>',
		'  catbox add-album <short> <name...>',
		'  catbox remove-album <short> <name...>',
		'  catbox delete-album <short>',
		'',
		'Global flags:',
		'  --pretty, -p             Pretty-print JSON (default: on)',
		'  --out=<file>, -o <file>  Write output to file instead of stdout',
		'  --quiet, -q              Suppress non-error output',
		'  --help, -h               Show help',
		'  --version, -v            Show version',
		''
	].join('\n')

const formatOutput = (data, flags) => {
	if (data === undefined) return ''
	if (typeof data === 'string') return data
	const indent = flags.pretty === false ? 0 : 2
	return JSON.stringify(data, null, indent)
}

const requirePositional = (rest, index, label) => {
	if (rest[index] === undefined || rest[index] === '') {
		throw new Error(`Missing required argument: ${label}`)
	}
	return rest[index]
}

const buildHandlers = deps => ({
	sources: async rest => {
		const [sub, ...args] = rest
		switch (sub) {
			case 'list': {
				return deps.listSources({})
			}
			case 'find': {
				return deps.searchSources(args.join(' '))
			}
			case 'get': {
				return deps.getSource(requirePositional(args, 0, 'source-id'))
			}
			case 'fetch': {
				return deps.fetchSource(requirePositional(args, 0, 'source-id'))
			}
			default:
				throw new Error(`Unknown sources subcommand: ${sub ?? '(none)'}`)
		}
	},

	source: async rest => {
		const id = requirePositional(rest, 0, 'source-id')
		const sub = requirePositional(rest, 1, 'subcommand (search|scrape|latest)')
		const args = rest.slice(2)
		switch (sub) {
			case 'search':
				return deps.searchSource(id, args.join(' '))
			case 'scrape':
				return deps.scrapeSource(id, args.join(' '))
			case 'latest':
				return deps.latestSource(id)
			default:
				throw new Error(`Unknown source subcommand: ${sub}`)
		}
	},

	pinterest: async (rest, flags) => {
		const target = rest.join(' ').trim()
		if (!target) throw new Error('pinterest requires <url-or-query>')
		const limit = Number(flags.limit) > 0 ? Number(flags.limit) : 10
		return deps.pinterest(target, { limit })
	},

	anime: async rest => {
		const [sub, ...args] = rest
		switch (sub) {
			case 'search':
				return deps.searchAnime(args.join(' '))
			case 'detail':
				return deps.getAnimeDetail(requirePositional(args, 0, 'url'))
			case 'top':
				return deps.getTopAnime()
			case 'current':
				return deps.getCurrentSeasonAnime()
			default:
				throw new Error(`Unknown anime subcommand: ${sub ?? '(none)'}`)
		}
	},

	katanime: async rest => {
		const [sub, ...args] = rest
		switch (sub) {
			case 'search':
				return deps.searchKatanimeQuotes(args.join(' '))
			case 'random':
				return deps.getRandomKatanimeQuotes()
			default:
				throw new Error(`Unknown katanime subcommand: ${sub ?? '(none)'}`)
		}
	},

	registry: async rest => {
		const [sub, ...args] = rest
		switch (sub) {
			case 'github':
				return deps.getGithubRepo(requirePositional(args, 0, 'owner/repo'))
			case 'github-search':
				return deps.searchGithubRepos(args.join(' '))
			case 'npm':
				return deps.getNpmPackage(requirePositional(args, 0, 'package'))
			case 'npm-search':
				return deps.searchNpmPackages(args.join(' '))
			default:
				throw new Error(`Unknown registry subcommand: ${sub ?? '(none)'}`)
		}
	},

	web: async rest => {
		const [sub, ...args] = rest
		switch (sub) {
			case 'meta':
				return deps.scrapeWebsite(requirePositional(args, 0, 'url'))
			default:
				throw new Error(`Unknown web subcommand: ${sub ?? '(none)'}`)
		}
	},

	url: async rest => {
		const [sub, ...args] = rest
		switch (sub) {
			case 'shorten':
				return deps.shortenUrl(requirePositional(args, 0, 'url'))
			case 'qr':
				return { url: deps.createQrImageUrl(args.join(' ')) }
			default:
				throw new Error(`Unknown url subcommand: ${sub ?? '(none)'}`)
		}
	},

	social: async rest => {
		const input = rest.join(' ').trim()
		if (!input) throw new Error('social requires <url>')
		return deps.resolveSocialDownloader({ input })
	},

	lyrics: async (rest, flags) => {
		const [sub, ...args] = rest
		const limit = Number(flags.limit) > 0 ? Number(flags.limit) : 10
		switch (sub) {
			case 'search':
				return (await deps.searchLyrics(args.join(' '))).slice(0, limit)
			case 'get': {
				const dashIdx = args.findIndex(token => token === '--')
				if (dashIdx === -1) throw new Error('lyrics get requires <artist> -- <title>')
				const artist = args.slice(0, dashIdx).join(' ').trim()
				const title = args
					.slice(dashIdx + 1)
					.join(' ')
					.trim()
				return deps.getLyrics(artist, title)
			}
			default: {
				const input = rest.join(' ').trim()
				if (!input) throw new Error('lyrics requires <query> or "Artist - Title"')
				return deps.lyrics(input)
			}
		}
	},

	tiktok: async (rest, flags) => {
		const [sub, ...args] = rest
		const limit = Number(flags.limit) > 0 ? Number(flags.limit) : 10
		switch (sub) {
			case 'video':
				return deps.getTiktok(requirePositional(args, 0, 'url'))
			case 'search':
				return deps.searchTiktok(args.join(' '), { limit })
			case 'user':
				return deps.getTiktokUser(requirePositional(args, 0, 'username'))
			default: {
				const input = rest.join(' ').trim()
				if (!input) throw new Error('tiktok requires <url-or-query> or a subcommand')
				return deps.tiktok(input, { limit })
			}
		}
	},

	catbox: async rest => {
		const [sub, ...args] = rest
		switch (sub) {
			case 'upload-file':
				return deps.uploadFile(requirePositional(args, 0, 'path'))
			case 'upload-url':
				return deps.uploadUrl(requirePositional(args, 0, 'url'))
			case 'delete-files':
				if (!args.length) throw new Error('delete-files requires <name...>')
				return deps.deleteFiles(args)
			case 'create-album':
				if (args.length < 2) throw new Error('create-album requires <title> <name...>')
				return deps.createAlbum({ title: args[0], files: args.slice(1) })
			case 'edit-album':
				if (args.length < 3) throw new Error('edit-album requires <short> <title> <name...>')
				return deps.editAlbum({ short: args[0], title: args[1], files: args.slice(2) })
			case 'add-album':
				if (args.length < 2) throw new Error('add-album requires <short> <name...>')
				return deps.addToAlbum(args[0], args.slice(1))
			case 'remove-album':
				if (args.length < 2) throw new Error('remove-album requires <short> <name...>')
				return deps.removeFromAlbum(args[0], args.slice(1))
			case 'delete-album':
				return deps.deleteAlbum(requirePositional(args, 0, 'short'))
			default:
				throw new Error(`Unknown catbox subcommand: ${sub ?? '(none)'}`)
		}
	}
})

const defaultIo = {
	stdout: line => process.stdout.write(`${line}\n`),
	stderr: line => process.stderr.write(`${line}\n`),
	writeFile: (file, content) => writeFileSync(file, content)
}

/**
 * Execute the CLI.
 *
 * @param {string[]} argv                    `process.argv.slice(2)`-style array.
 * @param {Object} [options]
 * @param {Object} [options.io]              Inject stdout/stderr/writeFile in tests.
 * @param {Record<string, Function>} [options.deps]   Inject scraper modules in tests.
 * @param {string} [options.version]         Override package version (defaults to package.json#version).
 * @returns {Promise<number>}                Exit code (0 on success).
 */
export const runCli = async (argv = [], options = {}) => {
	const io = { ...defaultIo, ...(options.io ?? {}) }
	const deps = options.deps ?? shitools
	const version = options.version

	const { positional, flags: rawFlags } = parseArgv(argv)
	const flags = expandAliases(rawFlags)

	if (flags.help || positional[0] === 'help' || positional.length === 0) {
		io.stdout(renderHelp())
		return 0
	}
	if (flags.version || positional[0] === 'version') {
		io.stdout(version ?? '(unknown)')
		return 0
	}

	const [command, ...rest] = positional
	const handlers = buildHandlers(deps)
	const handler = handlers[command]
	if (!handler) {
		io.stderr(`Unknown command: ${command}`)
		io.stderr(renderHelp())
		return 1
	}

	try {
		const data = await handler(rest, flags, deps)
		const output = formatOutput(data, flags)
		if (flags.out) {
			io.writeFile(String(flags.out), output)
			if (!flags.quiet) io.stderr(`Wrote ${flags.out}`)
		} else {
			io.stdout(output)
		}
		return 0
	} catch (error) {
		const name = error?.name ?? 'Error'
		io.stderr(`${name}: ${error?.message ?? error}`)
		return 1
	}
}
