import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import {
  tlsCertificate,
  tlsHsts,
  tlsNextActions,
  tlsProtocols,
  tlsRedirects,
} from '../../data/tls'

const MS_PER_DAY = 86_400_000
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const TH =
  'border-b border-rule py-2 pr-4 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft'
const TD = 'border-b border-rule py-3 pr-4 align-top'

const TONES = {
  pass: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
  warning: 'border-amber-500/30 bg-amber-500/5 text-amber-300',
  review: 'border-blue-500/30 bg-blue-500/5 text-blue-300',
  fail: 'border-red-500/30 bg-red-500/5 text-red-300',
}

function StatusChip({ tone = 'pass', children }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}

function SectionHead({ id, index, title, meta }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft">
        <span>{index}</span>
        {meta ? <span>{meta}</span> : null}
      </div>
      <h2
        id={id}
        className="mt-2 text-lg font-medium tracking-[-0.02em] text-ink"
      >
        {title}
      </h2>
    </div>
  )
}

function SummaryBlock({ label, value, unit, detail, valueClass = 'text-ink' }) {
  return (
    <div className="border-b border-r border-rule px-3 py-3 sm:px-4 sm:py-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
        {label}
      </p>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
        <span
          className={`font-mono text-[15px] leading-5 tracking-[-0.01em] ${valueClass}`}
        >
          {value}
        </span>
        {unit ? (
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
            {unit}
          </span>
        ) : null}
      </p>
      {detail ? (
        <p className="mt-1 font-mono text-[9.5px] leading-4 text-ink-soft">
          {detail}
        </p>
      ) : null}
    </div>
  )
}

// Fixed dates live in the data file; the label is derived here so both stay
// in step. UTC is used so the day is stable regardless of the reader's zone.
function formatCertificateDate(isoDate) {
  const date = new Date(isoDate)
  return `${String(date.getUTCDate()).padStart(2, '0')} ${
    MONTHS[date.getUTCMonth()]
  } ${date.getUTCFullYear()}`
}

export default function TlsPage() {
  const daysRemaining = Math.ceil(
    (new Date(tlsCertificate.validTo).getTime() - Date.now()) / MS_PER_DAY,
  )
  const hasExpired = daysRemaining <= 0
  const expiryTone = hasExpired
    ? 'text-red-300'
    : daysRemaining <= 30
      ? 'text-amber-300'
      : 'text-ink'

  const certificateRows = [
    { label: 'Subject', value: tlsCertificate.subject },
    { label: 'SANs', value: tlsCertificate.subjectAltNames.join(', ') },
    {
      label: 'Issuer',
      value: tlsCertificate.issuer,
      note: tlsCertificate.issuerNote,
    },
    { label: 'Valid from', value: formatCertificateDate(tlsCertificate.validFrom) },
    { label: 'Valid to', value: formatCertificateDate(tlsCertificate.validTo) },
    { label: 'Key', value: tlsCertificate.key },
    { label: 'Signature', value: tlsCertificate.signature },
    { label: 'Chain', value: tlsCertificate.chain.join(' → ') },
    { label: 'OCSP', value: tlsCertificate.ocsp },
  ]

  return (
    <DashboardLayout
      active="tls"
      title="HTTPS & TLS"
      subtitle="Certificate, protocol and redirect evidence from the sample handshake with demo.example.com."
    >
      <div className="space-y-8">
        <section aria-labelledby="tls-summary">
          <SectionHead
            id="tls-summary"
            index="01 / Summary"
            title="Summary"
            meta="Sample handshake"
          />

          <div className="mt-5 grid grid-cols-2 border-l border-t border-rule lg:grid-cols-4">
            <SummaryBlock
              label="Certificate"
              value={hasExpired ? 'Expired' : 'Valid'}
              detail="ECDSA P-256 · SHA-256"
              valueClass={hasExpired ? 'text-red-300' : 'text-emerald-300'}
            />
            <SummaryBlock
              label="Expires"
              value={hasExpired ? 'Expired' : String(daysRemaining)}
              unit={hasExpired ? null : 'days'}
              detail={formatCertificateDate(tlsCertificate.validTo)}
              valueClass={expiryTone}
            />
            <SummaryBlock
              label="Protocols"
              value="TLS 1.2 · 1.3"
              detail="TLS 1.0 / 1.1 disabled"
            />
            <SummaryBlock
              label="HSTS"
              value="Not set"
              detail="Strict-Transport-Security"
              valueClass="text-red-300"
            />
          </div>
        </section>

        <section
          aria-labelledby="tls-certificate"
          className="border-t border-rule pt-6"
        >
          <SectionHead
            id="tls-certificate"
            index="02 / Certificate"
            title="Certificate"
            meta="9 fields"
          />

          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
            Facts from the sample handshake. The validity dates are fixed and
            the remaining lifetime is computed when this page renders.
          </p>

          <dl className="mt-5 border-t border-rule">
            {certificateRows.map((row) => (
              <div
                key={row.label}
                className="grid gap-1 border-b border-rule py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6"
              >
                <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft sm:pt-0.5">
                  {row.label}
                </dt>
                <dd className="min-w-0">
                  <p className="break-words font-mono text-[12px] leading-5 text-ink sm:text-[12.5px]">
                    {row.value}
                  </p>
                  {row.note ? (
                    <p className="mt-1 max-w-md text-xs leading-5 text-ink-soft">
                      {row.note}
                    </p>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 max-w-2xl text-xs leading-5 text-ink-soft">
            These values describe the sample handshake only. No live connection
            was made to demo.example.com.
          </p>
        </section>

        <section
          aria-labelledby="tls-protocols"
          className="border-t border-rule pt-6"
        >
          <SectionHead
            id="tls-protocols"
            index="03 / Protocol support"
            title="Protocol support"
            meta={`${tlsProtocols.length} checks`}
          />

          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
            Protocol and cipher observations from the sample handshake. TLS 1.0
            and 1.1 pass because they are disabled, not because they are
            available.
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
              <caption className="sr-only">
                Protocol support and cipher observations from the sample
                handshake with demo.example.com.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={TH}>
                    Protocol
                  </th>
                  <th scope="col" className={TH}>
                    Status
                  </th>
                  <th scope="col" className={TH}>
                    Note
                  </th>
                </tr>
              </thead>
              <tbody>
                {tlsProtocols.map((row) => (
                  <tr key={row.id}>
                    <th
                      scope="row"
                      className={`${TD} whitespace-nowrap text-left font-mono text-[12px] font-normal text-ink`}
                    >
                      {row.protocol}
                    </th>
                    <td className={TD}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusChip tone={row.tone}>{row.status}</StatusChip>
                        {row.qualifier ? (
                          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
                            {row.qualifier}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className={`${TD} text-[13px] leading-5 text-ink-soft`}>
                      {row.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section
          aria-labelledby="tls-redirects"
          className="border-t border-rule pt-6"
        >
          <SectionHead
            id="tls-redirects"
            index="04 / Redirect behaviour"
            title="Redirect behaviour"
            meta={`${tlsRedirects.length} observations`}
          />

          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
            Redirect and HSTS evidence from the sample response. Finding
            context for HSTS is in the sample report.
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <caption className="sr-only">
                Redirect and HSTS observations from the sample response for
                demo.example.com.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={TH}>
                    Request
                  </th>
                  <th scope="col" className={TH}>
                    Response
                  </th>
                  <th scope="col" className={TH}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {tlsRedirects.map((row) => (
                  <tr key={row.id}>
                    <th
                      scope="row"
                      className={`${TD} text-left font-normal`}
                    >
                      <span className="break-all font-mono text-[12px] text-ink">
                        {row.check}
                      </span>
                      <span className="mt-1 block max-w-[24rem] text-xs leading-5 text-ink-soft">
                        {row.detail}
                      </span>
                    </th>
                    <td
                      className={`${TD} break-all font-mono text-[12px] ${row.responseTone}`}
                    >
                      {row.response}
                    </td>
                    <td className={TD}>
                      <StatusChip tone={row.tone}>{row.status}</StatusChip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 border border-rule bg-panel px-4 py-4 sm:px-5 sm:py-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-amber-300">
              HSTS / Not set
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
              {tlsHsts.note}
            </p>

            <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
              Suggested header for this scenario
            </p>
            <div className="mt-2 overflow-x-auto border border-rule bg-canvas px-3 py-2">
              <code className="whitespace-nowrap font-mono text-[11px] leading-5 text-ink">
                {tlsHsts.suggestedHeader}
              </code>
            </div>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-ink-soft">
              {tlsHsts.preloadNote}
            </p>

            <Link
              to="/reports/demo"
              className="group mt-4 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-signal transition hover:text-ink"
            >
              Read the HSTS finding
              <ArrowRight
                size={12}
                className="transition group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </div>
        </section>

        <section
          aria-labelledby="tls-next"
          className="border-t border-rule pt-6"
        >
          <SectionHead
            id="tls-next"
            index="05 / Review next"
            title="Review next"
            meta={`${tlsNextActions.length} actions`}
          />

          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
            Ordered for a site that already redirects to HTTPS.
          </p>

          <ol className="mt-5 border-t border-ink/40">
            {tlsNextActions.map((action, index) => (
              <li
                key={action.id}
                className="grid grid-cols-[2rem_1fr] gap-4 border-b border-rule py-4 sm:grid-cols-[3rem_1fr]"
              >
                <span
                  className="font-mono text-[11px] tabular-nums text-signal"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="text-[15px] font-medium text-ink">
                    {action.title}
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">
                    {action.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <footer className="border-t border-rule pt-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <p className="max-w-xl text-xs leading-5 text-ink-soft">
              This page records what the sample response for demo.example.com
              contained. It is not a live handshake, and every value is fixed
              for the demo.
            </p>
            <div className="flex flex-col gap-2 sm:items-end">
              <Link
                to="/reports/demo"
                className="group inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-signal transition hover:text-ink"
              >
                Open the sample report
                <ArrowRight
                  size={12}
                  className="transition group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
              <Link
                to="/how-it-works"
                className="group inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-signal transition hover:text-ink"
              >
                How the checks work
                <ArrowRight
                  size={12}
                  className="transition group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </DashboardLayout>
  )
}
