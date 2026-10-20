import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  Lock,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { CHECKS, CHECK_GROUPS } from '../data/demo'

const STEPS = [
  {
    title: 'Enter a website',
    text: 'The URL is parsed and validated in the browser. Malformed URLs, unsupported schemes and URLs containing credentials are rejected before anything starts.',
  },
  {
    title: 'Run the demonstration checks',
    text: 'Twelve checks run through a fixed sequence with realistic waiting, checking, passed, warning and needs-review states. No network request is made.',
  },
  {
    title: 'Understand what to fix',
    text: 'Each finding separates the observation from the potential risk, shows the evidence, explains the impact and gives a fix you can verify.',
  },
]

export default function HowItWorksPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="max-w-3xl">
        <p className="text-sm font-medium text-blue-300">Method and limits</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          How WebAuditors works
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
          WebAuditors is designed to turn security observations into decisions:
          what was seen, why it matters, how confident the check is, and what to
          do next. This page explains both the prototype and what a real scanner
          will need.
        </p>
      </div>

      <section className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <div key={step.title} className="border-t border-white/15 pt-4">
            <span className="text-xs font-semibold tabular-nums text-blue-300">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h2 className="mt-3 text-sm font-semibold text-white">
              {step.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {step.text}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            The twelve demonstration checks
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            These are the checks represented in the mockup. In this prototype
            their results are deterministic sample data, not measurements of a
            live website.
          </p>
        </div>

        <div className="mt-6 grid gap-x-12 gap-y-8 sm:grid-cols-2">
          {Object.entries(CHECK_GROUPS).map(([groupKey, groupLabel]) => (
            <div key={groupKey} className="border-t border-white/15 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {groupLabel}
              </h3>
              <ul className="mt-4 space-y-4">
                {CHECKS.filter((check) => check.group === groupKey).map(
                  (check) => (
                    <li key={check.id} className="flex items-start gap-2.5">
                      <CheckCircle2
                        size={15}
                        className="mt-0.5 shrink-0 text-slate-500"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-sm font-medium leading-snug text-white">
                          {check.name}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                          {check.description}
                        </p>
                      </div>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="border-t border-white/15 pt-5">
          <div className="flex items-center gap-2">
            <ShieldCheck
              size={18}
              className="text-emerald-400"
              aria-hidden="true"
            />
            <h2 className="text-lg font-semibold tracking-tight text-white">
              What this prototype does
            </h2>
          </div>
          <ul className="mt-5 space-y-3">
            {[
              'Validates URL format and supported schemes entirely in the browser.',
              'Runs a complete simulated scan sequence with realistic states and timing.',
              'Shows five sample findings with evidence, impact, remediation, confidence and limitations.',
              'Filters, searches, exports and compares reports.',
              'Stores demonstration history in local storage and can reset it.',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <CheckCircle2
                  size={16}
                  className="mt-0.5 shrink-0 text-emerald-400"
                  aria-hidden="true"
                />
                <span className="text-sm leading-relaxed text-slate-200">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-amber-400/40 pt-5">
          <div className="flex items-center gap-2">
            <XCircle
              size={18}
              className="text-amber-300"
              aria-hidden="true"
            />
            <h2 className="text-lg font-semibold tracking-tight text-white">
              What it deliberately does not do
            </h2>
          </div>
          <ul className="mt-5 space-y-3">
            {[
              'It does not make HTTP requests to the website you enter.',
              'It does not test for vulnerabilities, exploit anything, enumerate paths or submit forms.',
              'It does not contact, scan or verify any live website in this build.',
              'It does not claim that a site is secure, insecure or free of issues.',
              'It does not produce a numerical security score.',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <XCircle
                  size={16}
                  className="mt-0.5 shrink-0 text-amber-300"
                  aria-hidden="true"
                />
                <span className="text-sm leading-relaxed text-amber-200">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-12 border-t border-white/15 pt-6">
        <div className="flex items-center gap-2">
          <Lock size={18} className="text-slate-300" aria-hidden="true" />
          <h2 className="text-lg font-semibold tracking-tight text-white">
            What real scanning will require
          </h2>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
          The prototype validates the experience. To prove that WebAuditors can
          genuinely detect issues, the next stage needs a safe, server-side
          scanner tested against controlled websites with known configurations.
        </p>
        <ol className="mt-6 grid gap-x-10 gap-y-5 sm:grid-cols-2">
          {[
            {
              title: 'Safe target handling',
              text: 'Block private, loopback, link-local and cloud metadata addresses, and re-check redirects so scans cannot reach internal services.',
            },
            {
              title: 'Abuse and rate controls',
              text: 'Per-account quotas, concurrency limits and audit logs to prevent the scanner from being used to probe third parties.',
            },
            {
              title: 'Verified detection rules',
              text: 'Test each rule against controlled sites with known security configurations, and measure false positives before shipping.',
            },
          ].map((item, index) => (
            <li key={item.title} className="flex gap-4">
              <span className="w-6 shrink-0 pt-0.5 text-xs font-semibold tabular-nums text-slate-500">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <p className="text-sm font-medium text-white">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  {item.text}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 border-t border-white/15 pt-6">
        <div className="flex items-center gap-2">
          <FlaskConical
            size={18}
            className="text-amber-400"
            aria-hidden="true"
          />
          <h2 className="text-lg font-semibold tracking-tight text-white">
            How to read the report
          </h2>
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: 'Observation',
              text: 'What the simulated response contained, shown as exact evidence.',
            },
            {
              title: 'Risk',
              text: 'What could follow if the observation is present in production. This is not a confirmed exploit.',
            },
            {
              title: 'Confidence',
              text: 'How strongly the evidence supports the observation, and what could make it a false positive.',
            },
            {
              title: 'Verification',
              text: 'Steps to confirm the fix yourself after changing the website.',
            },
          ].map((item) => (
            <div key={item.title}>
              <p className="text-sm font-semibold text-white">{item.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/scan"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          Run a demonstration scan
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
        <Link
          to="/reports/demo"
          className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-panel px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
        >
          Open the sample report
        </Link>
      </div>
    </div>
  )
}
