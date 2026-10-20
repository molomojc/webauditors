import { Link } from 'react-router-dom'
import { ArrowLeft, Compass } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-20 text-center sm:px-6">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-slate-400">
        <Compass size={22} aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
        Page not found
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-300">
        That page does not exist in this prototype. The demonstration flow starts
        on the homepage or with a demo scan.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to homepage
        </Link>
        <Link
          to="/scan"
          className="inline-flex items-center rounded-lg border border-white/15 bg-panel px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
        >
          Run demo scan
        </Link>
      </div>
    </div>
  )
}
