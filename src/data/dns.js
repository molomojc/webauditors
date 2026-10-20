// Fixed demonstration data for the DNS configuration page. Nothing in this
// file is fetched: the values describe one simulated zone, demo.example.com.

export const ZONE = {
  hostname: 'demo.example.com',
  recordTypes: 7,
}

export const RECORDS = [
  {
    id: 'a',
    type: 'A',
    name: '@',
    values: ['203.0.113.10'],
    ttl: 300,
    status: 'Passed',
  },
  {
    id: 'aaaa',
    type: 'AAAA',
    name: '@',
    values: ['2001:db8::10'],
    ttl: 300,
    status: 'Passed',
  },
  {
    id: 'cname-www',
    type: 'CNAME',
    name: 'www',
    values: ['demo.example.com'],
    ttl: 300,
    status: 'Passed',
  },
  {
    id: 'mx',
    type: 'MX',
    name: '@',
    values: ['10 mail.demo.example.com'],
    ttl: 3600,
    status: 'Passed',
  },
  {
    id: 'txt-spf',
    type: 'TXT',
    name: '@',
    values: ['v=spf1 include:_spf.example.com ~all'],
    ttl: 3600,
    status: 'Warning',
  },
  {
    id: 'txt-dmarc',
    type: 'TXT',
    name: '_dmarc',
    values: ['v=DMARC1; p=none; rua=mailto:dmarc@example.com'],
    ttl: 3600,
    status: 'Warning',
  },
  {
    id: 'txt-dkim',
    type: 'TXT',
    name: 'default._domainkey',
    values: ['v=DKIM1; k=rsa; p=MIIBIjANBg…'],
    ttl: 3600,
    status: 'Passed',
  },
  {
    id: 'ns',
    type: 'NS',
    name: '@',
    values: ['ns1.dns.example', 'ns2.dns.example'],
    ttl: 86400,
    status: 'Passed',
  },
  {
    id: 'soa',
    type: 'SOA',
    name: '@',
    values: ['ns1.dns.example hostmaster.example.com 2026101701 3600 900 1209600 300'],
    ttl: 86400,
    status: 'Passed',
  },
]

export const SUMMARY = [
  {
    id: 'records',
    label: 'Records published',
    value: String(RECORDS.length),
    tone: 'neutral',
    note: `${ZONE.recordTypes} record types in the sample zone`,
  },
  {
    id: 'email',
    label: 'Email authentication',
    value: '2 warnings',
    tone: 'warning',
    note: 'SPF soft-fail · DMARC monitor-only',
  },
  {
    id: 'dnssec',
    label: 'DNSSEC',
    value: 'Not signed',
    tone: 'notset',
    note: 'No chain of trust to validate',
  },
  {
    id: 'caa',
    label: 'CAA',
    value: 'Not set',
    tone: 'notset',
    note: 'Any public CA may issue',
  },
]

export const EMAIL_AUTH = [
  {
    id: 'spf',
    label: 'SPF',
    status: 'Warning',
    evidence: 'v=spf1 include:_spf.example.com ~all',
    meaning:
      '~all soft-fails unauthorised senders: the message is still accepted and can land in spam rather than being rejected.',
    suggestion: null,
  },
  {
    id: 'dkim',
    label: 'DKIM',
    status: 'Passed',
    evidence: 'default._domainkey · v=DKIM1; k=rsa; p=MIIBIjANBg…',
    meaning:
      'A 2048-bit key is published at default._domainkey, so receivers can verify messages signed with the matching private key.',
    suggestion: null,
  },
  {
    id: 'dmarc',
    label: 'DMARC',
    status: 'Warning',
    evidence: 'v=DMARC1; p=none; rua=mailto:dmarc@example.com',
    meaning:
      'p=none asks for reports only, so no message is quarantined or rejected.',
    suggestion: 'Suggested path: p=quarantine → monitor → p=reject',
  },
]

export const ZONE_CONTROLS = [
  {
    id: 'dnssec',
    label: 'DNSSEC',
    status: 'Not set',
    observation: 'No DNSKEY or RRSIG is published in the sample records.',
    body: 'The zone is not signed, so responses cannot be cryptographically validated. A resolver has no chain of trust to confirm an answer came from this zone.',
    note: 'Enabling DNSSEC requires coordination with the DNS provider and a DS record at the registrar.',
    suggested: null,
  },
  {
    id: 'caa',
    label: 'CAA',
    status: 'Not set',
    observation: 'No CAA record is published in the sample records.',
    body: 'Any public certificate authority may issue a certificate for the domain.',
    note: 'Review the certificate authorities actually in use before publishing the record.',
    suggested: '0 issue "example-ca.example"',
  },
]

export const NEXT_ACTIONS = [
  {
    id: 'caa',
    title: 'Publish a CAA record',
    detail:
      'Add 0 issue "example-ca.example" and list every CA you actually use before enforcing the policy.',
  },
  {
    id: 'dmarc',
    title: 'Move DMARC to quarantine, then reject',
    detail:
      'Change p=none to p=quarantine, review the rua reports for the sample domain, then move to p=reject once legitimate mail is confirmed.',
  },
  {
    id: 'spf',
    title: 'Tighten SPF to -all',
    detail:
      'Audit every sender included in the sample SPF record, then replace ~all with -all so unauthorised senders are rejected.',
  },
  {
    id: 'dnssec',
    title: 'Enable DNSSEC',
    detail:
      'Ask the DNS provider to sign the zone, publish the resulting DS record at the registrar, and confirm validation before relying on it.',
  },
]
