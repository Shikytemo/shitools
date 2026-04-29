import { readFile } from 'fs/promises'
import { basename } from 'path'

export const CATBOX_API_URL = 'https://catbox.moe/user/api.php'
export const CATBOX_FILE_HOST = 'https://files.catbox.moe/'

const appendOptional = (form, key, value) => {
	if (value !== undefined && value !== null && value !== '') {
		form.append(key, value)
	}
}

const createForm = (reqtype, userHash) => {
	const form = new FormData()
	form.append('reqtype', reqtype)
	appendOptional(form, 'userhash', userHash || process.env.CATBOX_USER_HASH)
	return form
}

const normalizeFiles = files => (Array.isArray(files) ? files : [files]).filter(Boolean).join(' ')

export const requestCatbox = async (form, options = {}) => {
	const response = await fetch(options.apiUrl || CATBOX_API_URL, {
		method: 'POST',
		body: form,
		signal: options.signal
	})
	const text = (await response.text()).trim()

	if (!response.ok) {
		throw new Error(`Catbox request failed ${response.status}: ${text || response.statusText}`)
	}

	if (/^error[:\s]/i.test(text)) {
		throw new Error(text)
	}

	return text
}

export const uploadFile = async (filePath, options = {}) => {
	const form = createForm('fileupload', options.userHash)
	const buffer = await readFile(filePath)
	const blob = new Blob([buffer], {
		type: options.contentType || 'application/octet-stream'
	})

	form.append('fileToUpload', blob, options.filename || basename(filePath))
	const url = await requestCatbox(form, options)

	return {
		type: 'file',
		source: filePath,
		url,
		filename: url.startsWith(CATBOX_FILE_HOST) ? url.slice(CATBOX_FILE_HOST.length) : url
	}
}

export const uploadUrl = async (url, options = {}) => {
	const form = createForm('urlupload', options.userHash)
	form.append('url', url)
	const resultUrl = await requestCatbox(form, options)

	return {
		type: 'url',
		source: url,
		url: resultUrl,
		filename: resultUrl.startsWith(CATBOX_FILE_HOST) ? resultUrl.slice(CATBOX_FILE_HOST.length) : resultUrl
	}
}

export const deleteFiles = async (files, options = {}) => {
	const form = createForm('deletefiles', options.userHash)
	form.append('files', normalizeFiles(files))

	return {
		type: 'deletefiles',
		files: normalizeFiles(files).split(' '),
		result: await requestCatbox(form, options)
	}
}

export const createAlbum = async ({ title, description = '', files = [] }, options = {}) => {
	const form = createForm('createalbum', options.userHash)
	form.append('title', title)
	form.append('desc', description)
	form.append('files', normalizeFiles(files))

	return {
		type: 'createalbum',
		url: await requestCatbox(form, options)
	}
}

export const addToAlbum = async (short, files, options = {}) => {
	const form = createForm('addtoalbum', options.userHash)
	form.append('short', short)
	form.append('files', normalizeFiles(files))

	return {
		type: 'addtoalbum',
		short,
		files: normalizeFiles(files).split(' '),
		result: await requestCatbox(form, options)
	}
}

export const editAlbum = async ({ short, title = '', description = '', files = [] }, options = {}) => {
	const form = createForm('editalbum', options.userHash)
	form.append('short', short)
	form.append('title', title)
	form.append('desc', description)
	form.append('files', normalizeFiles(files))

	return {
		type: 'editalbum',
		short,
		result: await requestCatbox(form, options)
	}
}

export const removeFromAlbum = async (short, files, options = {}) => {
	const form = createForm('removefromalbum', options.userHash)
	form.append('short', short)
	form.append('files', normalizeFiles(files))

	return {
		type: 'removefromalbum',
		short,
		files: normalizeFiles(files).split(' '),
		result: await requestCatbox(form, options)
	}
}

export const deleteAlbum = async (short, options = {}) => {
	const form = createForm('deletealbum', options.userHash)
	form.append('short', short)

	return {
		type: 'deletealbum',
		short,
		result: await requestCatbox(form, options)
	}
}
