import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { login, googleLogin } from "../../services/auth";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);

      await login(email, password);

      navigate("/");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    try {
      await googleLogin();

      navigate("/");
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-sm">

        <h1 className="mb-8 text-center text-4xl font-bold">
          HIVEZ
        </h1>

        <form
          onSubmit={handleLogin}
          className="space-y-4"
        >
          <input
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
          />

          <input
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3"
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
            className="w-full rounded-lg bg-white p-3 font-semibold text-black"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <button
          onClick={handleGoogleLogin}
          className="mt-4 w-full rounded-lg border border-zinc-700 p-3"
        >
          Continue with Google
        </button>

        <p className="mt-6 text-center text-zinc-400">
          Don't have an account?{" "}
          <Link
            className="text-white"
            to="/signup"
          >
            Sign Up
          </Link>
        </p>

      </div>
    </div>
  );
}