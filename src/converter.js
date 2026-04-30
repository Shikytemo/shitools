import ffmpeg from 'fluent-ffmpeg'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const extensionByMime = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'video/mp4': 'mp4',
	'audio/mpeg': 'mp3',
	'audio/ogg': 'ogg',
	'audio/mp4': 'm4a'
}

const normalizeMime = input => {
	const mimetype = input?.mimetype || input?.mime || input?.info?.mimetype
	return typeof mimetype === 'string' ? mimetype : 'application/octet-stream'
}

const normalizeBuffer = input => {
	if (Buffer.isBuffer(input)) return input
	if (Buffer.isBuffer(input?.buffer)) return input.buffer
	throw new TypeError('Converter input needs a Buffer or an object with buffer.')
}

export const extFromMime = mimetype => {
	const clean = String(mimetype || '').split(';')[0].trim()
	return extensionByMime[clean] || clean.split('/')[1] || 'bin'
}

export const convertMedia = async ({ buffer, inputExt, outputExt, run }) => {
	const dir = await mkdtemp(join(tmpdir(), 'shitools-convert-'))
	const input = join(dir, `input.${inputExt}`)
	const output = join(dir, `output.${outputExt}`)

	try {
		await writeFile(input, buffer)
		await new Promise((resolve, reject) => {
			run(ffmpeg(input), output)
				.on('error', reject)
				.on('end', resolve)
				.save(output)
		})
		return await readFile(output)
	} finally {
		await rm(dir, { recursive: true, force: true })
	}
}

export const toSticker = media => {
	const buffer = normalizeBuffer(media)
	const mimetype = normalizeMime(media)
	const isVideo = mimetype.startsWith('video/') || mimetype === 'image/gif'

	return convertMedia({
		buffer,
		inputExt: extFromMime(mimetype),
		outputExt: 'webp',
		run: command => {
			if (isVideo) command.inputOptions(['-t', '10'])
			return command
				.videoFilters([
					'scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease',
					'format=rgba',
					'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000',
					'setsar=1'
				])
				.toFormat('webp')
		}
	})
}

export const toAudio = media =>
	convertMedia({
		buffer: normalizeBuffer(media),
		inputExt: extFromMime(normalizeMime(media)),
		outputExt: 'mp3',
		run: command => command.noVideo().audioCodec('libmp3lame').toFormat('mp3')
	})

export const toPTT = media =>
	convertMedia({
		buffer: normalizeBuffer(media),
		inputExt: extFromMime(normalizeMime(media)),
		outputExt: 'opus',
		run: command => command.noVideo().audioCodec('libopus').toFormat('opus')
	})

export const toVideo = media =>
	convertMedia({
		buffer: normalizeBuffer(media),
		inputExt: extFromMime(normalizeMime(media) || 'image/webp'),
		outputExt: 'mp4',
		run: command =>
			command
				.inputOptions(['-vcodec', 'webp'])
				.outputOptions(['-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2'])
				.toFormat('mp4')
	})
