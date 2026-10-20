import net from 'node:net'
import { lookup } from 'node:dns/promises'

// Everything the collector is allowed to talk to goes through this file. The
// rules are deliberately conservative: a false rejection is a support ticket,
// a false accept is a request from our server into someone's internal network.

export class ScanError extends Error {
  constructor(status, message, code = 'scan_error') {
    super(message)
    this.name = 'ScanError'
    this.status = status
    this.code = code
  }
}

const ipv4 = new net.BlockList()
const ipv6 = new net.BlockList()

// RFC1918, loopback, link-local (including the 169.254.169.254 metadata
// endpoint), CGNAT, documentation, benchmarking, multicast and reserved space.
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
]) {
  ipv4.addSubnet(address, prefix, 'ipv4')
}

// Loopback, unique-local, link-local, multicast, documentation, NAT64 and
// IPv4-mapped addresses (which would otherwise smuggle a v4 target past the
// v4 rules).
for (const [address, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
  ['2001:db8::', 32],
  ['64:ff9b::', 96],
  ['::ffff:0:0', 96],
]) {
  ipv6.addSubnet(address, prefix, 'ipv6')
}

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa']

export function classifyIp(address) {
  const ip = String(address ?? '')
    .trim()
    .replace(/^\[|\]$/g, '')
  const version = net.isIP(ip)

  if (version === 4) {
    return ipv4.check(ip, 'ipv4')
      ? { blocked: true, reason: `${ip} is a private or reserved IPv4 address.` }
      : { blocked: false }
  }

  if (version === 6) {
    return ipv6.check(ip, 'ipv6')
      ? { blocked: true, reason: `${ip} is a private or reserved IPv6 address.` }
      : { blocked: false }
  }

  return { blocked: true, reason: `"${address}" is not a valid IP address.` }
}

// Returns every address the hostname resolves to, or throws. Callers pin the
// connection to the first returned address so a second DNS answer cannot point
// somewhere else after validation (rebinding).
export async function resolvePublicHost(hostname) {
  const bare = String(hostname ?? '')
    .trim()
    .replace(/^\[|\]$/g, '')
    .toLowerCase()

  if (!bare) {
    throw new ScanError(400, 'Enter a complete domain.', 'invalid_host')
  }

  if (bare === 'localhost' || BLOCKED_SUFFIXES.some((suffix) => bare.endsWith(suffix))) {
    throw new ScanError(400, 'Local and internal hostnames cannot be scanned.', 'blocked_host')
  }

  if (net.isIP(bare)) {
    const verdict = classifyIp(bare)
    if (verdict.blocked) {
      throw new ScanError(400, verdict.reason, 'blocked_host')
    }
    return [bare]
  }

  let records
  try {
    records = await lookup(bare, { all: true, verbatim: true })
  } catch {
    throw new ScanError(400, 'That domain could not be resolved.', 'dns_failed')
  }

  if (!records.length) {
    throw new ScanError(400, 'That domain could not be resolved.', 'dns_failed')
  }

  const addresses = [...new Set(records.map((record) => record.address))]

  for (const address of addresses) {
    const verdict = classifyIp(address)
    if (verdict.blocked) {
      throw new ScanError(
        400,
        'That hostname resolves to a private or reserved address.',
        'blocked_host',
      )
    }
  }

  return addresses
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i

export function normaliseTarget(raw) {
  const value = String(raw ?? '').trim()

  if (!value) {
    throw new ScanError(400, 'Enter a website URL to analyse.', 'invalid_url')
  }

  if (/\s/.test(value)) {
    throw new ScanError(400, 'URLs cannot contain spaces.', 'invalid_url')
  }

  if (SCHEME.test(value) && !/^https?:\/\//i.test(value)) {
    throw new ScanError(
      400,
      'Only HTTP and HTTPS URLs are supported.',
      'invalid_scheme',
    )
  }

  let url
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
  } catch {
    throw new ScanError(
      400,
      'Enter a valid URL, for example https://example.com.',
      'invalid_url',
    )
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ScanError(400, 'Only HTTP and HTTPS URLs are supported.', 'invalid_scheme')
  }

  if (url.username || url.password) {
    throw new ScanError(
      400,
      'Remove credentials from the URL before scanning.',
      'invalid_url',
    )
  }

  // 80/443 only. Arbitrary ports turn the collector into a port scanner.
  const port = url.port || (url.protocol === 'https:' ? '443' : '80')
  if (port !== '80' && port !== '443') {
    throw new ScanError(
      400,
      'Only ports 80 and 443 can be reached by the collector.',
      'blocked_port',
    )
  }

  url.hash = ''
  return url
}
