# Shitools

[![npm version](https://img.shields.io/npm/v/@shikytemo/shitools.svg?logo=npm&color=cb3837)](https://www.npmjs.com/package/@shikytemo/shitools)
[![npm downloads](https://img.shields.io/npm/dm/@shikytemo/shitools.svg?logo=npm)](https://www.npmjs.com/package/@shikytemo/shitools)
[![Node.js](https://img.shields.io/node/v/@shikytemo/shitools.svg?logo=node.js)](#requirements)
[![License](https://img.shields.io/github/license/Shikytemo/shitools.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-vitest-6E9F18?logo=vitest)](#dev)

Tempat ngumpulin tools scrape dan automation kecil.

## Fokus

- Scraper reusable.
- Helper request/fetch.
- Output rapi buat dipakai ulang.
- Struktur simpel biar gampang nambah module baru.

## Install

```sh
npm install @shikytemo/shitools
```

## Requirements

- Node.js **>= 20** (uses native `fetch`, `AbortController`, ESM only).
- `ffmpeg` binary on PATH (only if you use `src/converter.js`).

## CLI

Setelah install, satu binary `shitools` jadi pintu masuk semua module:

```sh
shitools                                       # show help
shitools version

shitools sources list
shitools sources find weather
shitools source samehadaku search "one piece"
shitools source samehadaku scrape "gnosia episode 20"

shitools pinterest "anime girl" --limit=20
shitools anime search "demon slayer"
shitools anime top
shitools katanime random
shitools registry github Shikytemo/shitools
shitools registry npm @shikytemo/shitools
shitools web meta https://example.com
shitools url shorten https://example.com/very/long
shitools url qr "hello world"

shitools catbox upload-file ./image.jpg
shitools catbox create-album "My Album" abc123.jpg def456.png

# global flags
shitools anime top --out=top.json     # write to file instead of stdout
shitools anime top --no-pretty        # compact JSON
```

## Example

```sh
npm run example
npm run example -- https://example.com
```

## Catbox

Wrapper Catbox buat upload file, mirror URL, hapus file, dan album.

```sh
npm run catbox -- upload-file ./image.jpg
npm run catbox -- upload-url https://example.com/image.jpg
npm run catbox -- delete-files abc123.jpg
npm run catbox -- create-album "My Album" abc123.jpg def456.png
npm run catbox -- edit-album albumshort "New Title" abc123.jpg
```

Kalau mau pakai akun Catbox, isi:

```sh
CATBOX_USER_HASH=your_user_hash
```

## Pinterest

Scraper Pinterest reusable. Bisa mode pin URL dan search keyword dalam satu API. Mengambil metadata dan media yang bisa ditemukan:
image, video, thumbnail, `pinimg.com`, JSON-LD, script JSON, dan meta tag. Fetch utama memakai Axios + Cheerio, lalu fallback ke Jina Reader (`r.jina.ai`) untuk bypass halaman yang susah dibaca.

```sh
npm run check
node examples/pinterest.js https://www.pinterest.com/pin/123456789/
node examples/pinterest.js anime girl
```

Pemakaian module:

```js
import { pinterest, scrapePinterest, searchPinterest } from '@shikytemo/shitools'

const result = await pinterest('anime girl', { limit: 10 })
console.log(result.media)
```

## Converter

Helper converter media berbasis ffmpeg buat bot WhatsApp atau script Node.js.

```js
import { toAudio, toPTT, toSticker, toVideo } from '@shikytemo/shitools'

const sticker = await toSticker({ buffer, mimetype: 'image/png' })
const audio = await toAudio({ buffer, mimetype: 'video/mp4' })
const voiceNote = await toPTT({ buffer, mimetype: 'audio/mpeg' })
const video = await toVideo({ buffer, mimetype: 'image/webp' })
```

Pastikan binary `ffmpeg` tersedia di device/server.

## Scraper Tools

Scraper tambahan yang aman dipakai ulang di bot atau REST API kecil.

```sh
node examples/scrapers.js web https://example.com
node examples/scrapers.js npm @shikytemo/shitools
node examples/scrapers.js npm-search whatsapp bot
node examples/scrapers.js github Shikytemo/shitools
node examples/scrapers.js github-search whatsapp bot scraper
node examples/scrapers.js anime one piece
node examples/scrapers.js samehadaku gnosia episode 20
node examples/scrapers.js samehadaku-legacy one-piece-episode-1155
node examples/scrapers.js samehadaku-latest latest
```

## Source Catalog

Katalog source reusable berisi scraper internal dan 600+ public API no-auth HTTPS yang bisa dicari/filter.

```sh
node examples/sources.js list
node examples/sources.js list Anime
node examples/sources.js find weather
node examples/sources.js get weather-open-meteo
node examples/sources.js search samehadaku "one piece"
node examples/sources.js scrape samehadaku "gnosia episode 20"
node examples/sources.js latest samehadaku
node examples/sources.js fetch animals-axolotl
```

Pemakaian module:

```js
import {
	fetchSource,
	getSource,
	listSources,
	scrapeSource,
	searchSource,
	searchSources,
	sourceCatalog,
	sources
} from '@shikytemo/shitools'

console.log(sourceCatalog.length)
console.log(listSources({ category: 'Anime' }))
console.log(searchSources('weather'))

const samehadaku = await searchSource('samehadaku', 'one piece')
const stream = await scrapeSource('samehadaku', 'gnosia episode 20')
const metadata = getSource('weather-open-meteo')
const publicApi = await fetchSource('animals-axolotl')
const pin = await sources.pinterest.scrape('https://www.pinterest.com/pin/123456789/')
```

Pemakaian module:

```js
import {
	getGithubRepo,
	getNpmPackage,
	getSamehadakuLegacyStream,
	getSamehadakuStream,
	scrapeWebsite,
	searchAnime,
	searchGithubRepos,
	searchNpmPackages
} from '@shikytemo/shitools'

const page = await scrapeWebsite('https://example.com')
const anime = await searchAnime('one piece')
const stream = await getSamehadakuStream('gnosia episode 20')
const legacyStream = await getSamehadakuLegacyStream('one-piece-episode-1155')
const repo = await getGithubRepo('Shikytemo/shitools')
const npmPackage = await getNpmPackage('@shikytemo/shitools')
```

Anime scraper pakai Jikan v4. Export yang tersedia:

```js
import {
	getAnimeById,
	getAnimeCharacters,
	getAnimeEpisodes,
	getAnimeGenres,
	getAnimePictures,
	getAnimeRecommendations,
	getAnimeReviews,
	getCurrentSeasonAnime,
	getRandomAnime,
	getSeasonAnime,
	getTopAnime,
	searchAnime,
	searchCharacters,
	searchManga
} from '@shikytemo/shitools'
```

API publik Indonesia yang aman dipasang:

```js
import {
	getKatanimeAnimeList,
	getKatanimeQuotesByAnime,
	getRandomKatanimeQuotes,
	searchKatanimeQuotes
} from '@shikytemo/shitools'

const quotes = await getRandomKatanimeQuotes()
const narutoQuotes = await getKatanimeQuotesByAnime('naruto')
const search = await searchKatanimeQuotes('kuat')
```

Samehadaku stream scraper mengambil halaman langsung tanpa Jina Reader. Bisa input query, URL series, atau URL episode:

```js
import {
	getSamehadakuLegacyStream,
	getSamehadakuStream,
	searchSamehadaku,
	getSamehadakuSeriesEpisodes
} from '@shikytemo/shitools'

const result = await getSamehadakuStream('gnosia episode 20')
console.log(result.episode.mirrors)

const legacy = await getSamehadakuLegacyStream('one-piece-episode-1155')
console.log(legacy.episode.mirrors.find(item => item.directVideo))
```

## Lyrics

Lookup lirik dengan auto-search Genius + fetch teks dari lyrics.ovh. Dua-duanya
publik tanpa API key.

```js
import { lyrics, searchLyrics, getLyrics } from '@shikytemo/shitools'

// Smart: dia split "Artist - Title", atau search dulu kalau belum ada dash
const song = await lyrics('lewis capaldi someone you loved')
console.log(song.lyrics)

// Cari kandidat di Genius
const hits = await searchLyrics('hello adele')

// Fetch langsung kalau udah tau exact artist + title
const exact = await getLyrics('Adele', 'Hello')
```

CLI:

```sh
shitools lyrics "lewis capaldi someone you loved"
shitools lyrics "Adele - Hello"
shitools lyrics search "hello adele" --limit=5
shitools lyrics get Adele -- Hello
```

REST:

```
GET /lyrics?q=<query-or-artist-dash-title>
GET /lyrics/search?q=<query>
GET /lyrics/get?artist=Adele&title=Hello
```

## TikTok

Native TikTok scraper via TikWM — no yt-dlp / Termux binaries / login required.
Returns no-watermark MP4 URL + metadata.

```js
import { tiktok, getTiktok, searchTiktok, getTiktokUser } from '@shikytemo/shitools'

// resolve a video URL → no-watermark MP4
const video = await getTiktok('https://www.tiktok.com/@khaby.lame/video/7137423965982858498')
console.log(video.noWatermarkUrl, video.duration, video.author.username)

// keyword search
const { videos, cursor, hasMore } = await searchTiktok('lucu kucing', { limit: 5 })

// user profile + stats
const user = await getTiktokUser('@khaby.lame')
console.log(user.stats.followers)

// smart dispatch — URL → video, else search
await tiktok('https://vm.tiktok.com/ZSNFRtUJj/')
await tiktok('axolotl', { limit: 3 })
```

CLI:

```sh
shitools tiktok video https://vm.tiktok.com/ZSNFRtUJj/
shitools tiktok search "lucu kucing" --limit=5
shitools tiktok user "@khaby.lame"
shitools tiktok https://vm.tiktok.com/ZSNFRtUJj/   # smart dispatch
```

REST:

```
GET /tiktok?url=<encoded-tiktok-url>
GET /tiktok/search?q=<keyword>&limit=10
GET /tiktok/user?username=khaby.lame
```

## Cache

Memoize scraper calls dengan TTL biar gak hammer upstream:

```js
import { withCache, memoryStore, getSamehadakuStream } from '@shikytemo/shitools'

const cached = withCache(getSamehadakuStream, {
	store: memoryStore({ ttlMs: 10 * 60_000, maxEntries: 200 })
})

await cached('one piece episode 1124') // hits upstream
await cached('one piece episode 1124') // returns cached
```

Store interface-nya sengaja kecil (`get` / `set` / `delete` / `clear`), jadi gampang
swap ke Redis / file / KV-edge:

```js
const redisStore = {
	async get(key) {
		const raw = await redis.get(key)
		return raw ? JSON.parse(raw) : undefined
	},
	async set(key, value, ttlMs) {
		await redis.set(key, JSON.stringify(value), 'PX', ttlMs ?? 60_000)
	},
	async delete(key) {
		await redis.del(key)
	},
	async clear() {}
}

const cached = withCache(scrapePinterest, { store: redisStore, ttlMs: 60_000 })
```

## REST server

Drop-in REST microservice (zero new dependencies, hanya `node:http`) ada di `examples/server.js`.

```sh
npm run server                # PORT=3000 by default
PORT=8787 npm run server      # custom port
```

Routes (semua GET, semua return JSON):

| Path                 | Query        | Maps to                 |
| -------------------- | ------------ | ----------------------- |
| `/health`            | —            | server heartbeat        |
| `/pinterest`         | `q`, `limit` | `pinterest()`           |
| `/anime/search`      | `q`          | `searchAnime()`         |
| `/anime/top`         | —            | `getTopAnime()`         |
| `/samehadaku/scrape` | `q`          | `getSamehadakuStream()` |
| `/source/:id/search` | `q`          | `searchSource(id, q)`   |
| `/source/:id/scrape` | `q`          | `scrapeSource(id, q)`   |
| `/url/qr`            | `text`       | `createQrImageUrl()`    |

`RateLimitError` di-map ke 429, missing query param ke 400, error lain ke 500. Lihat
`examples/server.js` untuk daftar route lengkap.

Container & Fly.io deploy:

```sh
docker build -f examples/Dockerfile -t shitools-server .
docker run --rm -p 3000:3000 shitools-server

fly launch --copy-config --no-deploy
fly deploy --dockerfile examples/Dockerfile
```

## Errors

Semua scraper boleh throw salah satu dari class berikut — bot/library code bisa
`instanceof`-branching tanpa parse string error:

```js
import {
	ScrapeError,
	RateLimitError,
	ParseError,
	UnsupportedSourceError,
	InvalidInputError
} from '@shikytemo/shitools'

try {
	await searchAnime('one piece')
} catch (error) {
	if (error instanceof RateLimitError) sleep(error.retryAfter ?? 5_000)
	else if (error instanceof ParseError) console.warn('upstream HTML berubah')
	else throw error
}
```

## TypeScript

Library 100% JavaScript, tapi `npm install @shikytemo/shitools` udah kasih
`types/*.d.ts` yang di-generate dari JSDoc. Editor (VSCode / Cursor / WebStorm)
otomatis dapet autocomplete + signature help — gak perlu pasang `@types/*`.

## Dev

```sh
npm install
npm run lint                   # eslint flat config + rules
npm run format                 # prettier --write
npm run check                  # node --check semua *.js
npm run test                   # vitest watch
npm run test:run               # vitest single run
npm run build:types            # generate types/*.d.ts
npm run cli -- anime search "one piece"
```

Pre-commit hook (husky) jalanin prettier + eslint --fix di staged files
sebelum commit.

## Struktur

```txt
bin/shitools.js          unified CLI entry (subcommand dispatch)
src/                     core helper
src/anime.js             Jikan anime/manga REST wrapper
src/cache.js             memoryStore + withCache memoizer
src/catbox.js            Catbox API wrapper
src/cli.js               CLI parser + dispatcher (testable, DI-ready)
src/converter.js         Media converter helper
src/errors.js            Scrape / RateLimit / Parse / Input error classes
src/http.js              Shared httpClient (UA pool, retry, RateLimit-aware)
src/indo.js              Public Indonesia anime quote APIs
src/lyrics.js            Lyrics lookup (Genius search + lyrics.ovh)
src/pinterest.js         Pinterest scraper
src/registry.js          GitHub/NPM public REST wrapper
src/samehadaku.js        Samehadaku search/episode stream scraper
src/source-profiles.js   Public source profile catalog (auto-generated)
src/sources.js           Source catalog router/search/fetch helpers
src/tiktok.js            TikTok no-watermark / search / profile scraper (TikWM)
src/utility.js           Shortlink, QR, and lightweight social helper
src/web.js               Generic website metadata scraper
examples/                contoh pemakaian + REST server + Dockerfile + fly.toml
tests/                   vitest unit tests
types/                   generated .d.ts (gitignored, packed at publish)
data/                    output lokal, tidak ikut git
```

## Catatan

Gunakan scraper dengan batas wajar, hormati robots/rate limit website, dan jangan commit token atau data private.
