"use client";

import React, { useState } from "react";
import { Sparkles, AlertCircle } from "lucide-react";

interface AuthCardProps {
  onSubmit: (email: string, pass: string, isSignUp: boolean) => Promise<void>;
  authError: string | null;
}

export function AuthCard({ onSubmit, authError }: AuthCardProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(email, password, isSignUp);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-100 via-zinc-50 to-zinc-200">
      <div className="bg-white/70 backdrop-blur-xl p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] max-w-md w-full border border-white/50">
        <div className="flex justify-center mb-6">
          <div className="bg-zinc-900 p-3 rounded-2xl shadow-lg">
            <Sparkles className="text-white w-8 h-8" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-center text-zinc-900 mb-2 tracking-tight">
          VoxScribe
        </h1>
        <p className="text-center text-zinc-500 mb-8 text-sm">
          Sign in to train your AI brand voice.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all outline-none text-zinc-900 placeholder:text-zinc-400"
              required
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all outline-none text-zinc-900 placeholder:text-zinc-400"
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-zinc-900 text-white p-4 rounded-xl font-semibold hover:bg-zinc-800 disabled:opacity-50 transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            {submitting ? "Processing..." : isSignUp ? "Create Account" : "Sign In"}
          </button>
        </form>

        {authError && (
          <div className="mt-6 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p>{authError}</p>
          </div>
        )}

        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full text-center mt-6 text-zinc-500 hover:text-zinc-900 transition-colors text-sm font-medium"
        >
          {isSignUp
            ? "Already have an account? Sign In"
            : "Don't have an account? Sign Up"}
        </button>
      </div>
    </main>
  );
}
