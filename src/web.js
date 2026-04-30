import * as cheerio from 'cheerio'
import { URL } from 'node:url'
import { fetchText } from './index.js'

const uniq = values => [...new Set(values.filter(Boolean))]

const absoluteUrl = (value, baseUrl) => {
	if (!value) return null

	try {
		return new URL(value, baseUrl).toString()
	} catch {
		return null
	}
}

const cleanText = value => String(value || '').replace(/\s+/g, ' ').trim()

const firstAttr = ($, selectors, attr = 'content') => {
	for (const selector of selectors) {
		const value = cleanText($(selector).first().attr(attr))
		if (value) return value
	}

	return null
}

const getJsonLd = $ =>
	$('script[type="application/ld+json"]')
		.toArray()
		.map(element => cleanText($(element).contents().text()))
		.filter(Boolean)
		.flatMap(text => {
			try {
				const parsed = JSON.parse(text)
				return Array.isArray(parsed) ? parsed : [parsed]
			} catch {
				return []
			}
		})

export const scrapeWebsite = async (url, options = {}) => {
	const html = options.html || await fetchText(url, options)
	const $ = cheerio.load(html)
	const baseUrl = $('base[href]').first().attr('href') || url
	const title = cleanText(firstAttr($, ['meta[property="og:title"]', 'meta[name="twitter:title"]']) || $('title').first().text() || $('h1').first().text())
	const description = cleanText(firstAttr($, ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']))
	const canonicalUrl = absoluteUrl($('link[rel="canonical"]').first().attr('href') || firstAttr($, ['meta[property="og:url"]']), baseUrl)
	const image = absoluteUrl(firstAttr($, ['meta[property="og:image"]', 'meta[name="twitter:image"]', 'meta[itemprop="image"]']), baseUrl)
	const icon = absoluteUrl($('link[rel~="icon"]').first().attr('href') || $('link[rel="apple-touch-icon"]').first().attr('href'), baseUrl)
	const links = uniq(
		$('a[href]')
			.toArray()
			.map(element => absoluteUrl($(element).attr('href'), baseUrl))
	).slice(0, options.linkLimit || 50)
	const images = uniq(
		$('img[src], source[srcset]')
			.toArray()
			.flatMap(element => {
				const src = $(element).attr('src')
				const srcset = $(element).attr('srcset')
				const srcsetUrls = srcset ? srcset.split(',').map(item => item.trim().split(/\s+/)[0]) : []
				return [src, ...srcsetUrls].map(value => absoluteUrl(value, baseUrl))
			})
	).slice(0, options.imageLimit || 30)
	const headings = $('h1,h2,h3')
		.toArray()
		.map(element => ({
			level: element.tagName.toLowerCase(),
			text: cleanText($(element).text())
		}))
		.filter(item => item.text)
		.slice(0, options.headingLimit || 20)

	return {
		ok: true,
		url,
		finalUrl: canonicalUrl || url,
		title,
		description,
		siteName: firstAttr($, ['meta[property="og:site_name"]']),
		type: firstAttr($, ['meta[property="og:type"]']),
		language: $('html').attr('lang') || null,
		author: firstAttr($, ['meta[name="author"]', 'meta[property="article:author"]']),
		publishedAt: firstAttr($, ['meta[property="article:published_time"]', 'meta[name="date"]']),
		modifiedAt: firstAttr($, ['meta[property="article:modified_time"]']),
		image,
		icon,
		links,
		images,
		headings,
		jsonLd: getJsonLd($),
		text: cleanText($('body').text()).slice(0, options.textLimit || 2000)
	}
}

export const scrapeMeta = scrapeWebsite
