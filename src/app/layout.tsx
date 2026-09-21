import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Task Manager",
  description: "Full-stack Next.js + Prisma + PostgreSQL task manager",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-edge bg-panel/60 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
            <Link href="/" className="text-sm font-semibold tracking-tight text-white">
              ◆ Task Manager
            </Link>
            <nav className="flex items-center gap-4 text-sm text-slate-400">
              <Link href="/" className="hover:text-white">
                Dashboard
              </Link>
              <a
                href="/api/projects"
                className="hover:text-white"
                target="_blank"
                rel="noreferrer"
              >
                REST API
              </a>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>

        <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-xs text-slate-600">
          Next.js App Router · TypeScript (strict, no <code>any</code>/<code>unknown</code>) ·
          Prisma · PostgreSQL
        </footer>
      </body>
    </html>
  );
}
