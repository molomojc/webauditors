import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import UrlForm from '../components/UrlForm'
import TerminalCard from '../components/TerminalCard'
import {
  CHECKS,
  CHECK_GROUPS,
  FINDINGS,
  SAMPLE_FINDING_KEYS,
  statusesForFindings,
} from '../data/demo'

// three.js is heavy: keep it out of the initial bundle and only pull the scene
// in on screens wide enough to show the report figure.
const HeroScene = lazy(() => import('../components/HeroScene'))

function HeroVisual() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)')
    const sync = () => setShow(query.matches)

    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  if (!show) return null

  return (
    <Suspense fallback={null}>
      <HeroScene />
    </Suspense>
  )
}

const STEPS = [
  {
    title: 'Enter a website',
    text: 'Paste a URL. The prototype validates the format before anything starts.',
  },
  {
    title: 'Run the checks',
    text: 'Twelve simulated checks run in sequence and record what each one observed.',
  },
  {
    title: 'Read the evidence',
    text: 'Open each finding for the observation, impact, a practical fix and its limits.',
  },
]

const DOES = [
  'Each finding states what was observed separately from what it might mean.',
  'Confidence, limitations and possible false positives appear on every finding.',
  'A missing header is called a missing header — never a confirmed exploit.',
  'The overall status summarises findings. It is not a security score.',
]

const DOES_NOT = [
  'Demo scans never contact the website you enter.',
  'It does not exploit, enumerate or fuzz anything.',
  'It cannot confirm that a site is secure or insecure.',
  'Live checks are opt-in, and send real requests from the collector.',
]

const SCOPE_GROUPS = Object.entries(CHECK_GROUPS).map(([key, label]) => ({
  key,
  label,
  checks: CHECKS.filter((check) => check.group === key),
}))

const STATUS_TONES = {
  pass: 'ok',
  warn: 'warn',
  review: 'signal',
}

const AGENT_STATUSES = Object.fromEntries(
  statusesForFindings(SAMPLE_FINDING_KEYS).map(({ id, status }) => [
    id,
    status,
  ]),
)

// Status first so the outcome stays visible when the transcript scrolls
// sideways on narrow screens; the numbers keep the log easy to scan.
const countSeverity = (severity) =>
  SAMPLE_FINDING_KEYS.filter((key) => FINDINGS[key]?.severity === severity)
    .length

const AGENT_SUMMARY = [
  `${countSeverity('high')} high`,
  `${countSeverity('medium')} medium`,
  `${countSeverity('info')} informational`,
].join(' · ')

const AGENT_LINES = [
  { tone: 'muted', text: 'demo mode · no network requests' },
  ...CHECKS.map((check, index) => {
    const status = AGENT_STATUSES[check.id]
    const number = String(index + 1).padStart(2, '0')

    return {
      tone: STATUS_TONES[status] ?? 'muted',
      text: `${number} ${(status ?? 'unknown').padEnd(6)} ${check.name}`,
    }
  }),
  {
    tone: 'warn',
    text: `summary ........ ${AGENT_SUMMARY}`,
    pause: 220,
  },
]

function SectionHead({ index, title, meta }) {
  return (
    <div className="border-b border-rule pb-5">
      <div className="flex items-center justify-between gap-4 font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft">
        <span>{index}</span>
        {meta ? <span>{meta}</span> : null}
      </div>
      <h2 className="mt-3 max-w-2xl text-[1.7rem] font-medium leading-[1.15] tracking-[-0.03em] text-ink sm:text-[2rem]">
        {title}
      </h2>
    </div>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()

  function startDemo(url) {
    navigate(`/scan/demo?url=${encodeURIComponent(url)}`)
  }

  return (
    <div>
      <div className="page-grain" aria-hidden="true" />

      <section className="border-b border-rule bg-canvas">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:py-24">
          <div className="lg:col-span-7 lg:pr-8">
            <div className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 bg-signal" aria-hidden="true" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
                WebAuditors / Demo protocol 0.1
              </span>
            </div>

            <h1 className="mt-8 max-w-[13ch] text-[clamp(2.65rem,6.2vw,4.55rem)] font-medium leading-[0.98] tracking-[-0.045em] text-ink">
              What your site tells the internet about itself.
            </h1>

            <p className="mt-7 max-w-lg text-[15px] leading-7 text-ink-soft sm:text-base">
              Headers, TLS and public files, read as evidence rather than a
              score. See what was observed, what it means, and what to fix
              first.
            </p>

            <div className="mt-9 max-w-xl">
              <UrlForm onSubmit={startDemo} buttonLabel="Analyse website" />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-soft">
              <span className="flex items-center gap-2">
                <span className="h-px w-4 bg-rule" aria-hidden="true" />
                Demo only — no site is contacted
              </span>
              <span className="text-ink/20" aria-hidden="true">
                /
              </span>
              <span>No account required</span>
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-rule pt-4">
              <Link
                to="/reports/demo"
                className="group inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-signal transition hover:text-ink"
              >
                Read a sample audit
                <ArrowRight
                  size={12}
                  className="transition group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
              <a
                href="#scope"
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft transition hover:text-ink"
              >
                What gets checked
              </a>
            </div>
          </div>

          <div className="hidden md:block lg:col-span-5 lg:pt-2">
            <div className="relative flex h-[440px] flex-col justify-between border-y border-rule py-4 lg:h-[520px]">
              <div className="flex items-center justify-between gap-4 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">
                <span>Fig. 01 / External surface</span>
                <span>{CHECKS.length} checks</span>
              </div>
              <div className="absolute inset-x-0 bottom-10 top-10">
                <HeroVisual />
              </div>
              <div className="flex items-center justify-between gap-4 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">
                <span>{SAMPLE_FINDING_KEYS.length} simulated findings</span>
                <span className="text-amber-300/80">Not a live scan</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="scope"
        className="scroll-mt-20 border-b border-rule bg-canvas"
      >
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <SectionHead
            index="01 / Scope"
            title="Four groups. Twelve observations."
            meta={`${CHECKS.length} checks`}
          />

          <div className="mt-8 grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
            {SCOPE_GROUPS.map((group) => (
              <div key={group.key}>
                <h3 className="border-t border-ink/40 pt-3 font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink">
                  {group.label}
                </h3>
                <ul className="mt-3 space-y-2.5">
                  {group.checks.map((check, index) => (
                    <li
                      key={check.id}
                      className="flex gap-2.5 text-[12.5px] leading-snug text-ink-soft"
                    >
                      <span
                        className="shrink-0 font-mono text-[10px] leading-5 tabular-nums text-ink/30"
                        aria-hidden="true"
                      >
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span>{check.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-rule bg-canvas">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16">
            <div>
              <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft">
                02 / Method
              </p>
              <h2 className="mt-4 max-w-sm text-[1.7rem] font-medium leading-[1.15] tracking-[-0.03em] text-ink sm:text-[2rem]">
                From a URL to a written finding.
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-6 text-ink-soft">
                The prototype follows the whole journey so you can judge the
                experience, not just the styling.
              </p>
              <Link
                to="/how-it-works"
                className="group mt-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-signal transition hover:text-ink"
              >
                Read the method
                <ArrowRight
                  size={12}
                  className="transition group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </div>

            <ol className="border-t border-ink/40">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="grid grid-cols-[2.5rem_1fr] gap-4 border-b border-rule py-5 sm:grid-cols-[3.5rem_1fr]"
                >
                  <span className="font-mono text-[11px] tabular-nums text-signal">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="text-[15px] font-medium text-ink">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 max-w-md text-sm leading-6 text-ink-soft">
                      {step.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="border-b border-rule bg-canvas">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-0">
            <div className="lg:pr-12">
              <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft">
                03 / Evidence discipline
              </p>
              <h2 className="mt-4 text-[1.7rem] font-medium leading-[1.15] tracking-[-0.03em] text-ink sm:text-[2rem]">
                Evidence before adjectives.
              </h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-ink-soft">
                Trust matters more than a dramatic score. The report says what
                it saw before it says what that might mean.
              </p>
              <ul className="mt-6 border-t border-ink/40">
                {DOES.map((item, index) => (
                  <li
                    key={item}
                    className="flex gap-4 border-b border-rule py-3.5"
                  >
                    <span
                      className="shrink-0 font-mono text-[10px] leading-5 tabular-nums text-ink/30"
                      aria-hidden="true"
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="text-sm leading-6 text-ink-soft">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:border-l lg:border-rule lg:pl-12">
              <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-amber-300/80">
                04 / Prototype limits
              </p>
              <h2 className="mt-4 text-[1.7rem] font-medium leading-[1.15] tracking-[-0.03em] text-ink sm:text-[2rem]">
                A prototype, not a scanner.
              </h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-ink-soft">
                This build leads with demo data and adds an opt-in live
                collector. Demo scans never leave this browser; live checks send
                real requests from our server.
              </p>
              <ul className="mt-6 border-t border-amber-300/30">
                {DOES_NOT.map((item) => (
                  <li
                    key={item}
                    className="flex gap-4 border-b border-rule py-3.5"
                  >
                    <span
                      className="shrink-0 font-mono text-[11px] leading-5 text-amber-300/60"
                      aria-hidden="true"
                    >
                      —
                    </span>
                    <span className="text-sm leading-6 text-ink-soft">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                to="/how-it-works"
                className="group mt-5 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-200 transition hover:text-amber-100"
              >
                Read the limits
                <ArrowRight
                  size={12}
                  className="transition group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-rule bg-canvas">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <div>
              <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft">
                05 / Agent view
              </p>
              <h2 className="mt-4 max-w-sm text-[1.7rem] font-medium leading-[1.15] tracking-[-0.03em] text-ink sm:text-[2rem]">
                The audit, read back as a transcript.
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-6 text-ink-soft">
                This is the shape a working session would take. Nothing below
                ran: the transcript is written from the same demonstration data
                as the sample report.
              </p>
              <Link
                to="/reports/demo"
                className="group mt-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-signal transition hover:text-ink"
              >
                Open the sample report
                <ArrowRight
                  size={12}
                  className="transition group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </div>

            <TerminalCard
              className="min-w-0"
              title="webauditors / demo session"
              tag="Simulated"
              command="webauditors scan demo.example.com --demo"
              lines={AGENT_LINES}
              footer="Simulated transcript · no process was run"
            />
          </div>
        </div>
      </section>

      <section className="bg-canvas">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="bg-ink px-6 py-10 text-canvas sm:px-10 sm:py-12">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-canvas/60">
                  Sample audit / no account
                </p>
                <h2 className="mt-4 max-w-xl text-[clamp(1.6rem,3vw,2.4rem)] font-medium leading-[1.05] tracking-[-0.035em]">
                  See the report before you run one.
                </h2>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/scan"
                  className="inline-flex items-center justify-center gap-2 border border-canvas bg-canvas px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink transition hover:bg-[#17191c] focus-visible:outline-canvas"
                >
                  Run demo scan
                  <ArrowRight size={13} aria-hidden="true" />
                </Link>
                <Link
                  to="/reports/demo"
                  className="inline-flex items-center justify-center border border-canvas/25 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-canvas transition hover:bg-canvas/5 focus-visible:outline-canvas"
                >
                  Open sample report
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
