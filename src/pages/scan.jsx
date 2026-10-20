import { useNavigate, Link } from 'react-router-dom'
import {
  ArrowRight,
  FlaskConical,
  Lock,
  ScanSearch,
  ShieldCheck,
} from 'lucide-react'
import UrlForm from '../components/UrlForm'
import DemoNotice from '../components/DemoNotice'

const NEXT_STEPS = [
  'The URL format is validated locally in your browser.',
  'Twelve simulated checks run in a fixed, realistic sequence.',
  'You get a report with evidence, remediation and limitations.',
]

export default function ScanPage() {
  const navigate = useNavigate()

  function startDemo(url) {
    navigate(`/scan/demo?url=${encodeURIComponent(url)}`)
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-medium text-blue-300">
          New demonstration scan
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Analyse a website
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
          Enter a URL to run the interactive prototype. The demo returns
          deterministic sample results — it does not contact the target.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-xl border border-white/10 bg-panel p-5 shadow-sm sm:p-6">
            <label
              htmlFor="scan-url"
              className="text-sm font-medium text-white"
            >
              Website URL
            </label>
            <p className="mt-1 text-xs text-slate-400">
              HTTP and HTTPS URLs are accepted.
            </p>
            <div className="mt-3">
              <UrlForm
                id="scan-url"
                onSubmit={startDemo}
                autoFocus
                buttonLabel="Analyse website"
              />
            </div>

            <div className="mt-5 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-100">
                <FlaskConical size={15} aria-hidden="true" />
                Demo mode is on
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-blue-200/80">
                All checks return sample results. The prototype makes no
                network requests, so a demonstration scan can run immediately
                with no setup.
              </p>
            </div>

            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Lock size={15} className="text-slate-400" aria-hidden="true" />
                <p className="text-sm font-medium text-slate-200">
                  Real scanning
                </p>
                <span className="rounded-full bg-panel px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 ring-1 ring-inset ring-white/15">
                  Coming later
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                Production scanning is disabled in this prototype. A live
                engine and its safety controls are out of scope for this demo.
              </p>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-panel p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <ScanSearch
                  size={17}
                  className="text-blue-300"
                  aria-hidden="true"
                />
                <h2 className="text-sm font-semibold text-white">
                  What happens next
                </h2>
              </div>
              <ol className="mt-3 space-y-3">
                {NEXT_STEPS.map((step, index) => (
                  <li key={step} className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-semibold text-slate-300">
                      {index + 1}
                    </span>
                    <span className="text-sm leading-relaxed text-slate-300">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <DemoNotice>
              This prototype never performs live requests. Every result,
              timestamp and comparison is illustrative sample data.
            </DemoNotice>

            <div className="rounded-xl border border-white/10 bg-panel p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck
                  size={17}
                  className="text-emerald-400"
                  aria-hidden="true"
                />
                <h2 className="text-sm font-semibold text-white">
                  Safe to explore
                </h2>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                You can enter any URL because no request is made. A production
                version would add its own safety checks before any live scan.
              </p>
              <Link
                to="/reports/demo"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-300 hover:text-blue-200"
              >
                Skip to the sample report
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
