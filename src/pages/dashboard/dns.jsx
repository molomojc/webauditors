import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import {
  EMAIL_AUTH,
  NEXT_ACTIONS,
  RECORDS,
  SUMMARY,
  ZONE,
  ZONE_CONTROLS,
} from '../../data/dns'

const CHIP_TONES = {
  Passed: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
  Warning: 'border-amber-500/30 bg-amber-500/5 text-amber-300',
  'Needs review': 'border-blue-500/30 bg-blue-500/5 text-blue-300',
  'Not set': 'border-red-500/30 bg-red-500/5 text-red-300',
}

const SUMMARY_TONES = {
  neutral: 'text-ink',
  passed: 'text-emerald-300',
  warning: 'text-amber-300',
  review: 'text-blue-300',
  notset: 'text-red-300',
}

function StatusChip({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] ${
        CHIP_TONES[status] ?? 'border-rule bg-transparent text-ink-soft'
      }`}
    >
      {status}
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

function Summary() {
  return (
    <section aria-labelledby="dns-summary">
      <SectionHead
        id="dns-summary"
        index="01 / Summary"
        title="Zone summary"
        meta={`${ZONE.hostname} / sample records`}
      />

      <dl className="mt-5 grid grid-cols-2 border-l border-t border-rule lg:grid-cols-4">
        {SUMMARY.map((item) => (
          <div
            key={item.id}
            className="border-b border-r border-rule px-4 py-4 sm:px-5"
          >
            <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
              {item.label}
            </dt>
            <dd>
              <span
                className={`mt-2 block font-mono text-xl leading-none tracking-[-0.02em] ${
                  SUMMARY_TONES[item.tone] ?? 'text-ink'
                }`}
              >
                {item.value}
              </span>
              <span className="mt-2 block text-[11px] leading-4 text-ink-soft">
                {item.note}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function RecordsTable() {
  return (
    <section
      aria-labelledby="dns-records"
      className="border-t border-rule pt-6"
    >
      <SectionHead
        id="dns-records"
        index="02 / Records"
        title="DNS records"
        meta={`${RECORDS.length} records / TTL in seconds`}
      />

      <div
        className="mt-5 overflow-x-auto"
        tabIndex={0}
        role="group"
        aria-label="DNS records table, scrolls horizontally on narrow screens"
      >
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <caption className="sr-only">
            DNS records published in the sample zone for demo.example.com.
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="w-[84px] border-b border-rule py-2 pr-4 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft"
              >
                Type
              </th>
              <th
                scope="col"
                className="w-[160px] border-b border-rule py-2 pr-4 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft"
              >
                Name
              </th>
              <th
                scope="col"
                className="border-b border-rule py-2 pr-4 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft"
              >
                Value
              </th>
              <th
                scope="col"
                className="w-[80px] border-b border-rule py-2 pr-4 text-right font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft"
              >
                TTL
              </th>
              <th
                scope="col"
                className="w-[112px] border-b border-rule py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft"
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {RECORDS.map((record) => (
              <tr key={record.id}>
                <th
                  scope="row"
                  className="border-b border-rule py-3 pr-4 text-left align-top font-mono text-[11px] uppercase tracking-[0.12em] text-ink"
                >
                  {record.type}
                </th>
                <td className="border-b border-rule py-3 pr-4 align-top font-mono text-[11.5px] text-ink">
                  {record.name}
                </td>
                <td className="border-b border-rule py-3 pr-4 align-top font-mono text-[11.5px] leading-5 text-ink-soft">
                  {record.values.map((value) => (
                    <span key={value} className="block break-words">
                      {value}
                    </span>
                  ))}
                </td>
                <td className="border-b border-rule py-3 pr-4 text-right align-top font-mono text-[11px] tabular-nums text-ink-soft">
                  {record.ttl}
                </td>
                <td className="border-b border-rule py-3 align-top">
                  <StatusChip status={record.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function EmailAuthentication() {
  return (
    <section
      aria-labelledby="dns-email"
      className="border-t border-rule pt-6"
    >
      <SectionHead
        id="dns-email"
        index="03 / Email authentication"
        title="Email authentication"
        meta="3 mechanisms / 2 warnings"
      />

      <div className="mt-5 grid gap-px border border-rule bg-rule md:grid-cols-3">
        {EMAIL_AUTH.map((item) => (
          <article key={item.id} className="flex flex-col bg-panel p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink">
                {item.label}
              </h3>
              <StatusChip status={item.status} />
            </div>

            <p className="mt-4 break-words font-mono text-[10.5px] leading-5 text-ink-soft">
              {item.evidence}
            </p>
            <p className="mt-3 text-[13px] leading-6 text-ink-soft">
              {item.meaning}
            </p>

            {item.suggestion ? (
              <div className="mt-auto pt-4">
                <p className="border-t border-rule pt-3 font-mono text-[10px] leading-5 text-blue-300">
                  {item.suggestion}
                </p>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <p className="mt-3 text-xs leading-5 text-ink-soft">
        This view reads the sample TXT records only. It does not send or inspect
        mail.
      </p>
    </section>
  )
}

function ZoneControls() {
  return (
    <section
      aria-labelledby="dns-controls"
      className="border-t border-rule pt-6"
    >
      <SectionHead
        id="dns-controls"
        index="04 / DNSSEC and CAA"
        title="DNSSEC and CAA"
        meta="Both controls not set"
      />

      <div className="mt-5 grid gap-px border border-rule bg-rule md:grid-cols-2">
        {ZONE_CONTROLS.map((control) => (
          <article key={control.id} className="flex flex-col bg-panel">
            <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 sm:px-5">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink">
                {control.label}
              </h3>
              <StatusChip status={control.status} />
            </div>

            <div className="flex flex-1 flex-col px-4 py-4 sm:px-5">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft/70">
                Observation
              </p>
              <p className="mt-1.5 break-words font-mono text-[11px] leading-5 text-ink-soft">
                {control.observation}
              </p>
              <p className="mt-3 text-sm leading-6 text-ink-soft">
                {control.body}
              </p>

              <div className="mt-auto pt-4">
                <p className="border-t border-rule pt-3 text-xs leading-5 text-ink-soft">
                  {control.note}
                </p>
                {control.suggested ? (
                  <div className="mt-3">
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft/70">
                      Suggested record
                    </p>
                    <p className="mt-1 break-words font-mono text-[11px] text-signal">
                      {control.suggested}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function NextActions() {
  return (
    <section
      aria-labelledby="dns-actions"
      className="border-t border-rule pt-6"
    >
      <SectionHead
        id="dns-actions"
        index="05 / Actions"
        title="Review next"
        meta="4 actions / ordered"
      />

      <ol>
        {NEXT_ACTIONS.map((action, index) => (
          <li
            key={action.id}
            className="grid grid-cols-[2rem_1fr] gap-3 border-b border-rule py-4 sm:grid-cols-[3rem_1fr] sm:gap-4"
          >
            <span
              className="font-mono text-[11px] leading-5 tabular-nums text-signal"
              aria-hidden="true"
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <div>
              <h3 className="text-sm font-medium text-ink">{action.title}</h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">
                {action.detail}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default function DnsPage() {
  return (
    <DashboardLayout
      active="dns"
      title="DNS configuration"
      subtitle="How demo.example.com tells the internet where to send traffic and mail."
    >
      <div className="space-y-8">
        <Summary />
        <RecordsTable />
        <EmailAuthentication />
        <ZoneControls />
        <NextActions />

        <footer className="border-t border-rule pt-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-baseline sm:justify-between">
            <p className="max-w-xl text-sm leading-6 text-ink-soft">
              This page is configuration evidence for the sample zone, not a
              finding list. The sample report records five findings from twelve
              simulated checks.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <Link
                to="/reports/demo"
                className="group inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-signal transition hover:text-ink"
              >
                See the five sample findings
                <ArrowRight
                  size={11}
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
                  size={11}
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
