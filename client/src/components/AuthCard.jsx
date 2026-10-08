export default function AuthCard({ title, subtitle, children }) {
  return (
    <main className="auth-page">
      <section className="card" aria-labelledby="auth-title">
        <h1 id="auth-title">{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
        {children}
      </section>
    </main>
  );
}

export function FormError({ error }) {
  return (
    <div role="alert" aria-live="assertive">
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
