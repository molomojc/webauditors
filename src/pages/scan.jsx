import { useNavigate, Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
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
    <div>
      <div className="page-grain" aria-hidden="true" />

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-rule pb-5">
          <span className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 bg-signal" aria-hidden="true" />
            <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-soft">
              New demonstration scan
            </span>
          </span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft">
            Demo protocol 0.1
          </span>
        </div>

        <h1 className="mt-8 max-w-[18ch] text-[clamp(2rem,4.2vw,3rem)] font-medium leading-[1.02] tracking-[-0.04em] text-ink">
          Analyse a website
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-ink-soft">
          Enter a URL to run the interactive prototype. The demo returns
          deterministic sample results — it does not contact the target.
        </p>

        <div className="mt-9 grid gap-px border border-rule bg-rule lg:grid-cols-12">
          <div className="bg-panel p-5 sm:p-7 lg:col-span-7">
            <label
              htmlFor="scan-url"
              className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft"
            >
              Website URL
            </label>
            <p className="mt-2 text-xs leading-5 text-ink-soft/80">
              HTTP and HTTPS URLs are accepted.
            </p>
            <div className="mt-4">
              <UrlForm
                id="scan-url"
                onSubmit={startDemo}
                autoFocus
                buttonLabel="Analyse website"
              />
            </div>

            <div className="mt-7 border-t border-rule pt-5">
              <span className="inline-flex items-center border border-amber-300/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-amber-300/90">
                Demo mode on
              </span>
              <p className="mt-2.5 text-xs leading-6 text-ink-soft">
                All checks return sample results. The prototype makes no
                network requests, so a demonstration scan can run immediately
                with no setup.
              </p>
            </div>

            <div className="mt-5 border-t border-rule pt-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink">
                  Real scanning
                </span>
                <span className="border border-rule px-2 py-px font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
                  Coming later
                </span>
              </div>
              <p className="mt-2.5 text-xs leading-6 text-ink-soft">
                Production scanning is disabled in this prototype. A live
                engine and its safety controls are out of scope for this demo.
              </p>
            </div>
          </div>

          <aside className="bg-panel p-5 sm:p-7 lg:col-span-5">
            <h2 className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft">
              What happens next
            </h2>
            <ol className="mt-4 border-t border-ink/40">
              {NEXT_STEPS.map((step, index) => (
                <li key={step} className="flex gap-4 border-b border-rule py-3.5">
                  <span
                    className="shrink-0 font-mono text-[10px] leading-5 tabular-nums text-signal"
                    aria-hidden="true"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[13px] leading-6 text-ink-soft">
                    {step}
                  </span>
                </li>
              ))}
            </ol>

            <DemoNotice className="mt-6">
              This prototype never performs live requests. Every result,
              timestamp and comparison is illustrative sample data.
            </DemoNotice>

            <div className="mt-6 border-t border-rule pt-5">
              <h2 className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft">
                Safe to explore
              </h2>
              <p className="mt-2.5 text-xs leading-6 text-ink-soft">
                You can enter any URL because no request is made. A production
                version would add its own safety checks before any live scan.
              </p>
              <Link
                to="/reports/demo"
                className="group mt-4 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-signal transition hover:text-ink"
              >
                Skip to the sample report
                <ArrowRight
                  size={12}
                  className="transition group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
