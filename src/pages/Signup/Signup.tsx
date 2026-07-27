import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

import { signup, googleLogin } from "../../services/auth";

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  // Get the redirect path from state, default to home
  const from = (location.state as any)?.from || "/";

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);

      await signup(email, password);

      // Navigate to the original page they came from
      navigate(from, { replace: true });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
    try {
      await googleLogin();

      // Navigate to the original page they came from
      navigate(from, { replace: true });
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 text-zinc-900 dark:bg-black dark:text-white">
      <div className="w-full max-w-sm">

        <h1 className="mb-2 text-center text-4xl font-black tracking-tight text-zinc-900 dark:text-white">
          HIVEZ
        </h1>
        <p className="mb-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Create your account and join nearby hives.</p>

        <form
          onSubmit={handleSignup}
          className="app-surface space-y-4 p-4"
        >
          <input
            className="app-field"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="app-field"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="submit"
            disabled={loading}
            className="app-primary-button w-full py-3"
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>

        <button
          onClick={handleGoogleSignup}
          className="app-secondary-button mt-4 w-full py-3"
        >
          Continue with Google
        </button>

        <p className="mt-6 text-center text-zinc-600 dark:text-zinc-400">
          Already have an account?{" "}
          <Link
            className="text-zinc-900 dark:text-white font-semibold"
            to="/login"
          >
            Login
          </Link>
        </p>

      </div>
    </div>
  );
}
