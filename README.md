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

## Struktur

```txt
src/        core helper
examples/   contoh pemakaian
data/       output lokal, tidak ikut git
```

## Catatan

Gunakan scraper dengan batas wajar, hormati robots/rate limit website, dan jangan commit token atau data private.
