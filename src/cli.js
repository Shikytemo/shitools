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

const IMAGE_FLAG_KEYS = [
	'model',
	'width',
	'height',
	'seed',
	'enhance',
	'nologo',
	'private',
	'referrer'
]
const pickImageOptions = flags => {
	const out = {}
	for (const key of IMAGE_FLAG_KEYS) {
		if (flags[key] === undefined) continue
		const value = flags[key]
		if (key === 'width' || key === 'height' || key === 'seed') {
			const n = Number(value)
			if (Number.isFinite(n)) out[key] = n
		} else if (key === 'enhance' || key === 'nologo' || key === 'private') {
			out[key] = value === true || value === 'true'
		} else {
			out[key] = String(value)
		}
	}
	return out
}

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
		'  lyrics get "<artist>" "<title>"     Direct lyrics.ovh fetch (or use --artist=X --title=Y)',
		'',
		'  translate <text> [--to=id] [--from=auto]   Free Google Translate proxy',
		'  detect <text>                       Detect source language code',
		'',
		'  image <prompt> [--model=flux] [--width=N] [--height=N] [--seed=N] [--save=path]',
		'                                      Free Pollinations text-to-image (URL or saved bytes)',
		'  image-models                        List Pollinations models',
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
		'Group-bot scrapers (Tier 2.5):',
		'  wikipedia <topic> [--lang=id]       Smart search → top summary',
		'  wikipedia search <q> [--lang=id]    Search hits',
		'  wikipedia summary <title>           Direct REST v1 summary',
		'  quran list                          Daftar 114 surah',
		'  quran surah <nomor>                 Detail surah + ayat',
		'  quran ayat <surah> <ayat>           Ayat tertentu',
		'  sholat <kota> [--date=YYYY-MM-DD]   Smart: cari kota → jadwal',
		'  sholat city <q>                     Cari kota',
		'  sholat schedule <id> [date]         Jadwal langsung dari id',
		'  cuaca <kota>                        Cuaca via wttr.in (global)',
		'  bmkg <kota>                         Cuaca BMKG (Indonesia)',
		'  bmkg search <q>                     Cari kode wilayah (adm4)',
		'  bmkg forecast <adm4>                Prakiraan dari kode wilayah',
		'  quote                               Random English quote (zenquotes)',
		'  animequote                          Random anime quote (animechan)',
		'  fact [--lang=en]                    Random useless fact',
		'  joke [--category=Any]               Random joke (jokeapi)',
		'  meme [--subreddit=memes]            Random meme (meme-api)',
		'  kateglo <kata>                      Kamus Indonesia (definisi/sinonim/antonim)',
		'  pypi <package>                      Metadata package PyPI',
		'  ghtrend [--language=js] [--since=daily|weekly|monthly]',
		'  ytsearch <q> [--limit=N]            YouTube search via Piped',
		'  wallhaven <q> [--limit=N]           Wallpaper search (SFW)',
		'  kurs <from> <to> [amount]           Currency conversion',
		'  rates [base=USD]                    Latest exchange rates',
		'  ip [<addr>]                         IP geolocation lookup',
		'  reddit <sub> [--sort=hot] [--t=day] [--limit=N]',
		'  news [source]                       Indonesian news (cnn-news, antara-news, ...)',
		'  news sources                        List news sources',
		'  ss <url> [--width=1280] [--height=720] [--save=path]',
		'  mediafire <url>                     Resolve direct download link',
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

const buildHandlers = (deps, io) => ({
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
				const artist = String(flags.artist ?? args[0] ?? '').trim()
				const title = String(flags.title ?? args.slice(1).join(' ')).trim()
				if (!artist || !title) {
					throw new Error('lyrics get requires --artist=X --title=Y or "<artist>" "<title>"')
				}
				return deps.getLyrics(artist, title)
			}
			default: {
				const input = rest.join(' ').trim()
				if (!input) throw new Error('lyrics requires <query> or "Artist - Title"')
				return deps.lyrics(input)
			}
		}
	},

	translate: async (rest, flags) => {
		const text = rest.join(' ').trim()
		if (!text) throw new Error('translate requires <text>')
		const to = flags.to ? String(flags.to) : undefined
		const from = flags.from ? String(flags.from) : undefined
		return deps.translate(text, { from, to })
	},

	detect: async rest => {
		const text = rest.join(' ').trim()
		if (!text) throw new Error('detect requires <text>')
		const lang = await deps.detectLanguage(text)
		return { language: lang, original: text }
	},

	image: async (rest, flags) => {
		const prompt = rest.join(' ').trim()
		if (!prompt) throw new Error('image requires <prompt>')
		const opts = pickImageOptions(flags)
		if (flags.save) {
			const bytes = await deps.fetchImage(prompt, opts)
			io.writeFile(String(flags.save), Buffer.from(bytes))
			return { saved: String(flags.save), prompt, bytes: bytes.length }
		}
		return deps.generateImage(prompt, opts)
	},

	'image-models': async () => deps.listModels(),

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

	wikipedia: async (rest, flags) => {
		const [maybeSub, ...args] = rest
		const lang = flags.lang ? String(flags.lang) : undefined
		const limit = Number(flags.limit) > 0 ? Number(flags.limit) : 10
		switch (maybeSub) {
			case 'search':
				return (await deps.searchWikipedia(args.join(' '), { lang, limit })).slice(0, limit)
			case 'summary':
				return deps.getWikipediaSummary(args.join(' '), { lang })
			default: {
				const query = rest.join(' ').trim()
				if (!query) throw new Error('wikipedia requires <topic>')
				return deps.wikipedia(query, { lang })
			}
		}
	},
	wiki: async (rest, flags) => {
		const [maybeSub, ...args] = rest
		const lang = flags.lang ? String(flags.lang) : undefined
		const limit = Number(flags.limit) > 0 ? Number(flags.limit) : 10
		switch (maybeSub) {
			case 'search':
				return (await deps.searchWikipedia(args.join(' '), { lang, limit })).slice(0, limit)
			case 'summary':
				return deps.getWikipediaSummary(args.join(' '), { lang })
			default: {
				const query = rest.join(' ').trim()
				if (!query) throw new Error('wiki requires <topic>')
				return deps.wikipedia(query, { lang })
			}
		}
	},

	quran: async rest => {
		const [sub, ...args] = rest
		switch (sub) {
			case 'list':
				return deps.listSurah()
			case 'surah':
				return deps.getSurah(Number(requirePositional(args, 0, 'nomor')))
			case 'ayat':
				return deps.getAyat(
					Number(requirePositional(args, 0, 'surah')),
					Number(requirePositional(args, 1, 'ayat'))
				)
			default:
				throw new Error('quran requires list | surah <n> | ayat <s> <a>')
		}
	},
	surah: async rest => {
		const [first] = rest
		if (!first) throw new Error('surah requires <nomor>')
		return deps.getSurah(Number(first))
	},
	ayat: async rest => {
		if (rest.length < 2) throw new Error('ayat requires <surah> <ayat>')
		return deps.getAyat(Number(rest[0]), Number(rest[1]))
	},

	sholat: async (rest, flags) => {
		const [sub, ...args] = rest
		const date = flags.date ? String(flags.date) : undefined
		switch (sub) {
			case 'city':
				return deps.searchSholatCity(args.join(' '))
			case 'schedule': {
				const id = requirePositional(args, 0, 'cityId')
				const dateArg = args[1] ?? date
				return deps.getSholatSchedule(id, dateArg)
			}
			default: {
				const query = rest.join(' ').trim()
				if (!query) throw new Error('sholat requires <kota>')
				return deps.sholat(query, date)
			}
		}
	},

	cuaca: async rest => {
		const query = rest.join(' ').trim()
		if (!query) throw new Error('cuaca requires <lokasi>')
		return deps.getWeather(query)
	},
	weather: async rest => {
		const query = rest.join(' ').trim()
		if (!query) throw new Error('weather requires <lokasi>')
		return deps.getWeather(query)
	},

	bmkg: async rest => {
		const [sub, ...args] = rest
		switch (sub) {
			case 'search':
				return deps.searchBmkgArea(args.join(' '))
			case 'forecast':
				return deps.getBmkgWeather(requirePositional(args, 0, 'adm4'))
			default: {
				const query = rest.join(' ').trim()
				if (!query) throw new Error('bmkg requires <kota>')
				return deps.bmkg(query)
			}
		}
	},

	quote: async () => deps.randomQuote(),
	animequote: async () => deps.randomAnimeQuote(),
	'anime-quote': async () => deps.randomAnimeQuote(),

	fact: async (_rest, flags) =>
		deps.randomFact({ lang: flags.lang ? String(flags.lang) : undefined }),

	joke: async (_rest, flags) =>
		deps.randomJoke({
			category: flags.category ? String(flags.category) : undefined,
			lang: flags.lang ? String(flags.lang) : undefined
		}),

	meme: async (_rest, flags) =>
		deps.randomMeme({ subreddit: flags.subreddit ? String(flags.subreddit) : undefined }),

	kateglo: async rest => {
		const word = rest.join(' ').trim()
		if (!word) throw new Error('kateglo requires <kata>')
		return deps.kateglo(word)
	},

	pypi: async rest => deps.getPypiPackage(requirePositional(rest, 0, 'package')),

	ghtrend: async (_rest, flags) =>
		deps.getGithubTrending({
			language: flags.language ? String(flags.language) : undefined,
			since: flags.since ? String(flags.since) : undefined
		}),
	'github-trending': async (_rest, flags) =>
		deps.getGithubTrending({
			language: flags.language ? String(flags.language) : undefined,
			since: flags.since ? String(flags.since) : undefined
		}),

	ytsearch: async (rest, flags) => {
		const query = rest.join(' ').trim()
		if (!query) throw new Error('ytsearch requires <query>')
		const limit = Number(flags.limit) > 0 ? Number(flags.limit) : 10
		return deps.searchYoutube(query, { limit })
	},

	wallhaven: async (rest, flags) => {
		const query = rest.join(' ').trim()
		if (!query) throw new Error('wallhaven requires <query>')
		const limit = Number(flags.limit) > 0 ? Number(flags.limit) : 12
		return deps.searchWallhaven(query, { limit })
	},
	wallpaper: async (rest, flags) => {
		const query = rest.join(' ').trim()
		if (!query) throw new Error('wallpaper requires <query>')
		const limit = Number(flags.limit) > 0 ? Number(flags.limit) : 12
		return deps.searchWallhaven(query, { limit })
	},

	kurs: async rest => {
		const from = requirePositional(rest, 0, 'from')
		const to = requirePositional(rest, 1, 'to')
		const amount = rest[2] !== undefined ? Number(rest[2]) : 1
		return deps.convertCurrency(from, to, amount)
	},
	currency: async rest => {
		const from = requirePositional(rest, 0, 'from')
		const to = requirePositional(rest, 1, 'to')
		const amount = rest[2] !== undefined ? Number(rest[2]) : 1
		return deps.convertCurrency(from, to, amount)
	},
	rates: async rest => deps.getRates(rest[0] ?? 'USD'),

	ip: async rest => deps.getIpInfo(rest[0] ?? ''),
	iplookup: async rest => deps.getIpInfo(rest[0] ?? ''),

	reddit: async (rest, flags) =>
		deps.getSubreddit(requirePositional(rest, 0, 'subreddit'), {
			sort: flags.sort ? String(flags.sort) : undefined,
			t: flags.t ? String(flags.t) : undefined,
			limit: Number(flags.limit) > 0 ? Number(flags.limit) : undefined
		}),

	news: async rest => {
		const [sub] = rest
		if (sub === 'sources') return deps.listNewsSources()
		return deps.getNews(rest[0] ?? 'cnn-news')
	},
	berita: async rest => deps.getNews(rest[0] ?? 'cnn-news'),

	ss: async (rest, flags) => {
		const url = rest.join(' ').trim()
		if (!url) throw new Error('ss requires <url>')
		const opts = {
			width: Number(flags.width) > 0 ? Number(flags.width) : undefined,
			height: Number(flags.height) > 0 ? Number(flags.height) : undefined
		}
		if (flags.save) {
			const bytes = await deps.fetchScreenshot(url, opts)
			io.writeFile(String(flags.save), Buffer.from(bytes))
			return { saved: String(flags.save), url, bytes: bytes.length }
		}
		return { url: deps.getScreenshotUrl(url, opts) }
	},
	screenshot: async (rest, flags) => {
		const url = rest.join(' ').trim()
		if (!url) throw new Error('screenshot requires <url>')
		const opts = {
			width: Number(flags.width) > 0 ? Number(flags.width) : undefined,
			height: Number(flags.height) > 0 ? Number(flags.height) : undefined
		}
		if (flags.save) {
			const bytes = await deps.fetchScreenshot(url, opts)
			io.writeFile(String(flags.save), Buffer.from(bytes))
			return { saved: String(flags.save), url, bytes: bytes.length }
		}
		return { url: deps.getScreenshotUrl(url, opts) }
	},

	mediafire: async rest => {
		const url = requirePositional(rest, 0, 'url')
		return deps.getMediafire(url)
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
	const handlers = buildHandlers(deps, io)
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
