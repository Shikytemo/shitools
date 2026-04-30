# Shitools

Tempat ngumpulin tools scrape dan automation kecil.

## Fokus

- Scraper reusable.
- Helper request/fetch.
- Output rapi buat dipakai ulang.
- Struktur simpel biar gampang nambah module baru.

## Install

```sh
npm install
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
```

Pemakaian module:

```js
import {
	getGithubRepo,
	getNpmPackage,
	getSamehadakuStream,
	scrapeWebsite,
	searchAnime,
	searchGithubRepos,
	searchNpmPackages
} from '@shikytemo/shitools'

const page = await scrapeWebsite('https://example.com')
const anime = await searchAnime('one piece')
const stream = await getSamehadakuStream('gnosia episode 20')
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
	getSamehadakuStream,
	searchSamehadaku,
	getSamehadakuSeriesEpisodes
} from '@shikytemo/shitools'

const result = await getSamehadakuStream('gnosia episode 20')
console.log(result.episode.mirrors)
```

## Struktur

```txt
src/             core helper
src/anime.js    Jikan anime/manga REST wrapper
src/catbox.js   Catbox API wrapper
src/converter.js Media converter helper
src/indo.js     Public Indonesia anime quote APIs
src/pinterest.js Pinterest scraper
src/registry.js GitHub/NPM public REST wrapper
src/samehadaku.js Samehadaku search/episode stream scraper
src/web.js      Generic website metadata scraper
examples/        contoh pemakaian
data/            output lokal, tidak ikut git
```

## Catatan

Gunakan scraper dengan batas wajar, hormati robots/rate limit website, dan jangan commit token atau data private.
