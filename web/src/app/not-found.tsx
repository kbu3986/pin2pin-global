import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md rounded-lg border border-slate-300 bg-white p-6 text-center space-y-4">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-rose-700">
          HTTP 404 · Route Not Found
        </p>
        <h1 className="text-xl font-bold text-slate-950">Part or Comparison Not Found</h1>
        <p className="text-xs text-slate-600 leading-relaxed">
          The requested OPN datasheet or cross-reference URL is not in the current verified index. Use the parametric catalog to locate exact orderable part numbers.
        </p>
        <div className="flex items-center justify-center gap-2.5 pt-2">
          <Link
            href="/en"
            className="rounded-md bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Go to Home (/en)
          </Link>
          <Link
            href="/en/catalog"
            className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            Browse Catalog
          </Link>
        </div>
      </div>
    </main>
  );
}
