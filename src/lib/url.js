// URL parsing and validation for the prototype. No requests are made here.

const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i

export function parseTarget(rawValue) {
  const value = (rawValue ?? '').trim()

  if (!value) {
    return { ok: false, error: 'Enter a website URL to analyse.' }
  }

  if (/\s/.test(value)) {
    return { ok: false, error: 'URLs cannot contain spaces.' }
  }

  let candidate = value

  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    if (SCHEME_PATTERN.test(candidate)) {
      return {
        ok: false,
        error: 'Only HTTP and HTTPS URLs are supported.',
      }
    }
    candidate = `https://${candidate}`
  }

  let url
  try {
    url = new URL(candidate)
  } catch {
    return {
      ok: false,
      error: 'Enter a valid URL, for example https://example.com.',
    }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: 'Only HTTP and HTTPS URLs are supported.' }
  }

  if (!url.hostname) {
    return {
      ok: false,
      error: 'Enter a complete domain, for example example.com.',
    }
  }

  const isLocalhost = url.hostname === 'localhost'
  if (!isLocalhost && !url.hostname.includes('.')) {
    return {
      ok: false,
      error: 'Enter a complete domain, for example example.com.',
    }
  }

  if (url.username || url.password) {
    return {
      ok: false,
      error: 'Remove credentials from the URL before scanning.',
    }
  }

  url.hash = ''

  const normalised =
    url.pathname === '/' && !url.search ? url.origin : url.href

  return { ok: true, url: normalised, hostname: url.hostname }
}

export function hostnameOf(target) {
  try {
    return new URL(target).hostname
  } catch {
    return target
  }
}
