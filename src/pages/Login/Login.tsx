import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { googleLogin, login } from "../../services/auth";
import "../Auth/Auth.css";

function getAuthMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.replace("Firebase: ", "").replace(/\s*\(auth\/.*\)\.?$/, ".");
  }

  return "Something went wrong. Please try again.";
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const from = (location.state as { from?: string } | null)?.from || "/";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(getAuthMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");

    try {
      setGoogleLoading(true);
      await googleLogin();
      navigate(from, { replace: true });
    } catch (err) {
      setError(getAuthMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-brand-panel" aria-label="Hivez">
        <div className="auth-brand-top">
          <Link to="/" className="auth-logo">Hivez</Link>
          <Link to="/" className="auth-home-link">Back to home</Link>
        </div>

        <div className="auth-brand-copy">
          <span>Local action starts here</span>
          <h1>Welcome back to your community feed.</h1>
          <p>
            Sign in to report issues, follow nearby updates, support important
            posts, and stay connected with what is happening around you.
          </p>
        </div>

        <div className="auth-preview-card" aria-hidden="true">
          <div className="auth-preview-card__media">
            <strong>Broken streetlight reported nearby</strong>
          </div>
          <div className="auth-preview-card__meta">
            <span>0.5 km away</span>
            <span>128 upvotes</span>
            <span>18 comments</span>
          </div>
        </div>
      </aside>

      <section className="auth-form-panel" aria-labelledby="login-title">
        <div className="auth-card">
          <div className="auth-card__header">
            <p>Log in</p>
            <h2 id="login-title">Continue to Hivez.</h2>
            <p>Use your email or Google account to get back into your local feed.</p>
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <form className="auth-form" onSubmit={handleLogin}>
            <div className="auth-field">
              <label htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                autoComplete="current-password"
                placeholder="Enter your password"
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button className="auth-submit" disabled={loading || googleLoading} type="submit">
              {loading ? "Signing in..." : "Log in"}
              {!loading && <ArrowRight size={18} aria-hidden="true" />}
            </button>
          </form>

          <div className="auth-divider">or</div>

          <button
            className="auth-google"
            disabled={loading || googleLoading}
            onClick={handleGoogleLogin}
            type="button"
          >
            <span className="auth-google-icon" aria-hidden="true">G</span>
            {googleLoading ? "Connecting..." : "Continue with Google"}
          </button>

          <p className="auth-switch">
            New to Hivez? <Link to="/signup">Create an account</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
