"use client";

import { useState } from "react";
import { API_BASE_URL } from "../lib/api";

export type AuthUser = {
  id: number;
  full_name: string;
  email: string;
  role: string;
};

type AuthPageProps = {
  onAuthenticated: (token: string, user: AuthUser) => void;
};

const STAKEHOLDER_ROLES = [
  "Product Owner",
  "Business Analyst",
  "Compliance & Legal Officer",
  "Information Security Architect",
  "Risk Manager",
];

export default function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Product Owner");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/signup";
      const body =
        mode === "login"
          ? { email, password }
          : { full_name: fullName, email, password, role };

      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Authentication failed");

      localStorage.setItem("finai_token", data.token);
      onAuthenticated(data.token, data.user);
    } catch (err: any) {
      setError(err.message || "Unable to authenticate.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-xs">
        <div className="mb-6">
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            FinAI
          </span>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
            {mode === "login" ? "Sign in to Requirements Studio" : "Create your FinAI account"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {mode === "login"
              ? "Access your financial requirements, audits, and specification workspaces."
              : "Set up your stakeholder profile for gated requirement approvals."}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-lg bg-zinc-100 p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`rounded-md py-2 transition ${
              mode === "login"
                ? "bg-white text-zinc-900 shadow-2xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError("");
            }}
            className={`rounded-md py-2 transition ${
              mode === "signup"
                ? "bg-white text-zinc-900 shadow-2xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Tarun Prasad"
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  Stakeholder Role
                </label>
                <select
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {STAKEHOLDER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">
              Work Email
            </label>
            <input
              type="email"
              required
              placeholder="you@institution.com"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              placeholder="••••••••"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Sign In"
                : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}