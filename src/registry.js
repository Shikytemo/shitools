const jsonRequest = async (url, options = {}) => {
	const response = await fetch(url, {
		...options,
		headers: {
			accept: 'application/json',
			'user-agent': process.env.USER_AGENT || 'Shitools/1.0',
			...options.headers
		}
	})

	if (!response.ok) {
		throw new Error(`Request failed ${response.status} ${response.statusText}`)
	}

	return response.json()
}

const compactNpmPackage = data => {
	const latestVersion = data['dist-tags']?.latest
	const latest = latestVersion ? data.versions?.[latestVersion] : null

	return {
		name: data.name,
		version: latestVersion || null,
		description: data.description || latest?.description || null,
		keywords: latest?.keywords || data.keywords || [],
		license: latest?.license || data.license || null,
		homepage: latest?.homepage || data.homepage || null,
		repository: latest?.repository || data.repository || null,
		author: latest?.author || data.author || null,
		maintainers: data.maintainers || [],
		distTags: data['dist-tags'] || {},
		createdAt: data.time?.created || null,
		modifiedAt: data.time?.modified || null,
		tarball: latest?.dist?.tarball || null
	}
}

export const getNpmPackage = async packageName => {
	const escaped = encodeURIComponent(packageName).replace('%2F', '%2f')
	const data = await jsonRequest(`https://registry.npmjs.org/${escaped}`)
	return compactNpmPackage(data)
}

export const searchNpmPackages = async (query, options = {}) => {
	const params = new URLSearchParams({
		text: query,
		size: String(options.limit || 10),
		from: String(options.from || 0)
	})
	const data = await jsonRequest(`https://registry.npmjs.org/-/v1/search?${params}`)

	return {
		query,
		total: data.total || 0,
		results: (data.objects || []).map(item => ({
			name: item.package?.name,
			version: item.package?.version,
			description: item.package?.description || null,
			keywords: item.package?.keywords || [],
			links: item.package?.links || {},
			publisher: item.package?.publisher || null,
			score: item.score || null
		}))
	}
}

const githubHeaders = options => ({
	accept: 'application/vnd.github+json',
	'user-agent': process.env.USER_AGENT || 'Shitools/1.0',
	...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
	...options.headers
})

export const getGithubRepo = async (repo, options = {}) => {
	const [owner, name] = repo.split('/')
	if (!owner || !name) throw new TypeError('Repo format must be owner/name.')

	const data = await jsonRequest(`https://api.github.com/repos/${owner}/${name}`, {
		...options,
		headers: githubHeaders(options)
	})

	return {
		name: data.name,
		fullName: data.full_name,
		description: data.description,
		url: data.html_url,
		apiUrl: data.url,
		cloneUrl: data.clone_url,
		sshUrl: data.ssh_url,
		homepage: data.homepage,
		language: data.language,
		license: data.license,
		stars: data.stargazers_count,
		forks: data.forks_count,
		watchers: data.watchers_count,
		openIssues: data.open_issues_count,
		defaultBranch: data.default_branch,
		archived: data.archived,
		disabled: data.disabled,
		private: data.private,
		createdAt: data.created_at,
		updatedAt: data.updated_at,
		pushedAt: data.pushed_at,
		owner: data.owner
	}
}

export const searchGithubRepos = async (query, options = {}) => {
	const params = new URLSearchParams({
		q: query,
		sort: options.sort || 'updated',
		order: options.order || 'desc',
		per_page: String(options.limit || 10),
		page: String(options.page || 1)
	})
	const data = await jsonRequest(`https://api.github.com/search/repositories?${params}`, {
		...options,
		headers: githubHeaders(options)
	})

	return {
		query,
		total: data.total_count || 0,
		results: (data.items || []).map(item => ({
			name: item.name,
			fullName: item.full_name,
			description: item.description,
			url: item.html_url,
			language: item.language,
			stars: item.stargazers_count,
			forks: item.forks_count,
			openIssues: item.open_issues_count,
			license: item.license,
			updatedAt: item.updated_at,
			pushedAt: item.pushed_at,
			owner: item.owner
		}))
	}
}

export const getGithubRepoLanguages = async (repo, options = {}) => {
	const [owner, name] = repo.split('/')
	if (!owner || !name) throw new TypeError('Repo format must be owner/name.')

	return jsonRequest(`https://api.github.com/repos/${owner}/${name}/languages`, {
		...options,
		headers: githubHeaders(options)
	})
}
