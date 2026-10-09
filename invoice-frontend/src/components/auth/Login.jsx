import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../../utils/auth";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = (event) => {
    event.preventDefault();
    setError("");

    if (username.trim() === "" || password.trim() === "") {
      setError("Please enter both username and password.");
      return;
    }

    const ok = login(username, password);
    if (!ok) {
      setError("Invalid username or password.");
      return;
    }

    navigate("/dashboard");
  };

  return (
    <div className="flex min-h-screen">
      {/* Brand side */}
      <div className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-slate-900 p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="absolute -left-16 bottom-0 h-72 w-72 rounded-full bg-lime-300/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 ring-1 ring-white/20">
            <span className="text-sm font-extrabold text-lime-300">RZ</span>
          </div>
          <div>
            <div className="text-base font-extrabold leading-none tracking-tight">
              ROOF<span className="text-lime-300">ZE</span> DIGITAL HUB
            </div>
            <div className="text-[11px] tracking-wide text-white/50">EMPOWER YOUR DIGITAL JOURNEY</div>
          </div>
        </div>
        <div className="relative">
          <h1 className="mb-4 text-4xl font-bold leading-tight">
            Invoice Console <br />
            <span className="text-lime-300">for internal billing.</span>
          </h1>
          <p className="max-w-sm leading-relaxed text-white/60">
            GST and Without-GST billing locations, financial-year invoice numbering, and clean
            client-ready invoices — built for Roofze's own workflow.
          </p>
        </div>
        <div className="relative text-xs text-white/40">
          © {new Date().getFullYear()} Roofze Digital Hub LLP · Internal tool
        </div>
      </div>

      {/* Form side */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 ring-1 ring-slate-900/10">
              <span className="text-sm font-extrabold text-lime-300">RZ</span>
            </div>
            <div className="text-sm font-extrabold text-slate-900">ROOFZE DIGITAL HUB</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="mb-1 text-xl font-bold text-slate-900">Sign in</h2>
            <p className="mb-6 text-sm text-slate-500">Local session only — no server yet.</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="username" className="mb-1.5 block text-xs font-semibold text-slate-500">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-slate-500">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              {error && <p className="text-sm font-medium text-red-500">{error}</p>}

              <button
                type="submit"
                className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Sign in
              </button>
            </form>

            <div className="mt-5 rounded-lg border border-lime-300/50 bg-lime-50 px-3 py-2 text-xs text-slate-500">
              Demo credentials — <span className="font-semibold text-slate-700">admin / admin123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
