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

Scraper Pinterest reusable. Mengambil metadata dan semua media yang bisa ditemukan dari pin:
image, video, thumbnail, `pinimg.com`, JSON-LD, script JSON, dan meta tag. Fetch utama memakai Axios + Cheerio, lalu fallback ke Jina Reader (`r.jina.ai`) untuk bypass halaman yang susah dibaca.

```sh
npm run check
node examples/pinterest.js https://www.pinterest.com/pin/123456789/
```

Pemakaian module:

```js
import { scrapePinterest } from '@shikytemo/shitools'

const result = await scrapePinterest('https://www.pinterest.com/pin/123456789/')
console.log(result.media)
```

## Struktur

```txt
src/             core helper
src/catbox.js   Catbox API wrapper
src/pinterest.js Pinterest scraper
examples/        contoh pemakaian
data/            output lokal, tidak ikut git
```

## Catatan

Gunakan scraper dengan batas wajar, hormati robots/rate limit website, dan jangan commit token atau data private.
