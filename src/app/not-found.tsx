import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md space-y-3 text-center">
      <h1 className="text-lg font-semibold text-white">Not found</h1>
      <p className="text-sm text-slate-400">That project or task does not exist any more.</p>
      <Link href="/" className="btn-primary">
        Back to dashboard
      </Link>
    </div>
  );
}
