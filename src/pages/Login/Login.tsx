import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

import { login, googleLogin } from "../../services/auth";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  // Get the redirect path from state, default to home
  const from = (location.state as any)?.from || "/";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);

      await login(email, password);

      // Navigate to the original page they came from
      navigate(from, { replace: true });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    try {
      await googleLogin();

      // Navigate to the original page they came from
      navigate(from, { replace: true });
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-black px-6 text-zinc-900 dark:text-white">
      <div className="w-full max-w-sm">

        <h1 className="mb-8 text-center text-4xl font-bold text-zinc-900 dark:text-white">
          HIVEZ
        </h1>

        <form
          onSubmit={handleLogin}
          className="space-y-4"
        >
          <input
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-zinc-900 dark:text-white"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
          />

          <input
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-zinc-900 dark:text-white"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zinc-900 dark:bg-white p-3 font-semibold text-white dark:text-black transition hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <button
          onClick={handleGoogleLogin}
          className="mt-4 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 p-3 text-zinc-900 dark:text-white transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          Continue with Google
        </button>

        <p className="mt-6 text-center text-zinc-600 dark:text-zinc-400">
          Don't have an account?{" "}
          <Link
            className="text-zinc-900 dark:text-white font-semibold"
            to="/signup"
          >
            Sign Up
          </Link>
        </p>

      </div>
    </div>
  );
}