import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "./login/actions";
import { createSupabaseServerClient, hasSupabaseConfig } from "../lib/supabase-server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Investment OS",
  description: "Private portfolio, investment journey, research, and news workspace.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = hasSupabaseConfig()
    ? (await (await createSupabaseServerClient()).auth.getUser()).data.user
    : null;

  return (
    <html lang="en">
      <body>
        <header className="app-header">
          <div>
            <p className="eyebrow">Investment OS</p>
            <h1>Portfolio thinking workspace</h1>
          </div>
          <nav aria-label="Primary navigation">
            <Link href="/investing">Overview</Link>
            <Link href="/investing/journey">Activity</Link>
            <Link href="/investing/watchlist">Watchlist</Link>
            <Link href="/investing/journal">Notes</Link>
            <Link href="/daily">Daily News</Link>
            {user ? (
              <form action={logout}>
                <button className="nav-button" type="submit">
                  Sign out
                </button>
              </form>
            ) : (
              <Link href="/login">Sign in</Link>
            )}
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
