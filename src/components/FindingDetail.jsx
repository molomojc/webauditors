import { useState } from 'react'
import { Check, Copy, FlaskConical } from 'lucide-react'
import SeverityBadge from './SeverityBadge'
import { getCheck } from '../data/demo'

function Section({ title, children }) {
  return (
    <section className="border-t border-white/5 pt-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h3>
      <div className="mt-2 text-sm leading-relaxed text-slate-200">
        {children}
      </div>
    </section>
  )
}

export default function FindingDetail({ finding }) {
  const [copied, setCopied] = useState(false)
  const check = getCheck(finding.checkId)

  async function copyEvidence() {
    try {
      await navigator.clipboard.writeText(finding.evidence)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={finding.severity} />
        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-slate-300">
          {finding.category}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-500/30">
          <FlaskConical size={11} aria-hidden="true" />
          Simulated
        </span>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-slate-200">
        {finding.description}
      </p>

      <dl className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-xs sm:grid-cols-2">
        <div>
          <dt className="font-medium text-slate-400">Check</dt>
          <dd className="mt-0.5 text-slate-100">
            {check?.name ?? finding.checkId}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-400">Finding type</dt>
          <dd className="mt-0.5 text-slate-100">{finding.kind}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium text-slate-400">Confidence</dt>
          <dd className="mt-0.5 text-slate-100">{finding.confidence}</dd>
        </div>
      </dl>

      <Section title="Demonstration evidence">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs text-slate-400">{finding.evidenceNote}</p>
          <button
            type="button"
            onClick={copyEvidence}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/10 bg-panel px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/5"
          >
            {copied ? (
              <Check size={12} aria-hidden="true" />
            ) : (
              <Copy size={12} aria-hidden="true" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-panel p-3 font-mono text-xs leading-relaxed text-slate-100">
          {finding.evidence}
        </pre>
      </Section>

      <Section title="Why it matters">{finding.why}</Section>

      <Section title="Potential impact">{finding.impact}</Section>

      <Section title="Recommended fix">
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-slate-100">
          {finding.recommendation}
        </div>
      </Section>

      <Section title="How to verify the fix">
        <ol className="list-decimal space-y-1.5 pl-5">
          {finding.verification.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Section>

      <Section title="Limitations and possible false positives">
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs leading-relaxed text-slate-300">
          {finding.limitations}
        </div>
      </Section>
    </div>
  )
}
