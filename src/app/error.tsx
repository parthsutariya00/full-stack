"use client";

import { useEffect } from "react";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="card mx-auto max-w-lg space-y-3">
      <h1 className="text-lg font-semibold text-white">Something broke</h1>
      <p className="text-sm text-slate-400">
        {error.message.length > 0 ? error.message : "Unexpected server error."}
      </p>
      <p className="text-xs text-slate-600">
        If this mentions the database, check that <code>DATABASE_URL</code> is set and that
        migrations have run.
      </p>
      <button type="button" className="btn-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
