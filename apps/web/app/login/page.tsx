import { login } from "./actions";

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; next?: string | string[] }>;
}) {
  const params = await searchParams;
  const error = firstValue(params.error);
  const nextPath = firstValue(params.next) || "/investing";

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Private beta</p>
        <h2>Sign in to your portfolio</h2>
        <p className="muted">Your holdings, journey, thesis, and notes are isolated with Supabase Auth and RLS.</p>
        {error ? <p className="notice danger">{error}</p> : null}
        <form action={login} className="form-grid">
          <input type="hidden" name="next" value={nextPath} />
          <label className="span-2">
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="span-2">
            <span>Password</span>
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="button" type="submit">
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
