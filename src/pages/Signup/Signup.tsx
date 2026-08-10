import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { googleLogin, signup } from "../../services/auth";
import "../Auth/Auth.css";

function getAuthMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.replace("Firebase: ", "").replace(/\s*\(auth\/.*\)\.?$/, ".");
  }

  return "Something went wrong. Please try again.";
}

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const from = (location.state as { from?: string } | null)?.from || "/";

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);
      await signup(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(getAuthMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
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
          <span>Join your local network</span>
          <h1>Start reporting what your community needs.</h1>
          <p>
            Create an account to post civic issues, support nearby reports,
            join conversations, and help important local problems get seen.
          </p>
        </div>

        <div className="auth-preview-card" aria-hidden="true">
          <div className="auth-preview-card__media">
            <strong>Garbage overflow shared by neighbors</strong>
          </div>
          <div className="auth-preview-card__meta">
            <span>Environment</span>
            <span>141 upvotes</span>
            <span>Volunteer help</span>
          </div>
        </div>
      </aside>

      <section className="auth-form-panel" aria-labelledby="signup-title">
        <div className="auth-card">
          <div className="auth-card__header">
            <p>Sign up</p>
            <h2 id="signup-title">Create your Hivez account.</h2>
            <p>Join the community layer for local issues, updates, and action.</p>
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <form className="auth-form" onSubmit={handleSignup}>
            <div className="auth-field">
              <label htmlFor="signup-email">Email address</label>
              <input
                id="signup-email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="signup-password">Password</label>
              <input
                id="signup-password"
                autoComplete="new-password"
                minLength={6}
                placeholder="Create a password"
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button className="auth-submit" disabled={loading || googleLoading} type="submit">
              {loading ? "Creating account..." : "Create account"}
              {!loading && <ArrowRight size={18} aria-hidden="true" />}
            </button>
          </form>

          <div className="auth-divider">or</div>

          <button
            className="auth-google"
            disabled={loading || googleLoading}
            onClick={handleGoogleSignup}
            type="button"
          >
            <span className="auth-google-icon" aria-hidden="true">G</span>
            {googleLoading ? "Connecting..." : "Continue with Google"}
          </button>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>

          <p className="auth-footnote">
            By creating an account, you agree to use Hivez responsibly and support
            accurate community reporting.
          </p>
        </div>
      </section>
    </div>
  );
}
