"use client";

import React, { useState } from "react";
import { AlertCircle, AudioLines, Eye, EyeOff, FileText, Loader2, Mic, Sparkles, Wand2 } from "lucide-react";
import { Logo } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";

interface AuthCardProps {
  onSubmit: (email: string, pass: string, isSignUp: boolean) => Promise<void>;
  authError: string | null;
}

const FEATURES = [
  { icon: AudioLines, title: "Learns your voice", text: "Upload past writing and VoxScribe mirrors your tone and phrasing." },
  { icon: Mic, title: "Any source", text: "YouTube videos, articles, podcasts and audio recordings." },
  { icon: Wand2, title: "Five formats", text: "Blog posts, X threads, LinkedIn posts, newsletters and show notes." },
];

export function AuthCard({ onSubmit, authError }: AuthCardProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isSignUp = mode === "signup";

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
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-zinc-950 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_20%_10%,hsl(252_90%_60%/0.45),transparent_70%),radial-gradient(60%_50%_at_90%_90%,hsl(300_90%_55%/0.30),transparent_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />

        <div className="relative">
          <Logo className="[&_span]:text-white" />
        </div>

        <div className="relative my-auto max-w-lg">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
            <Sparkles className="h-3.5 w-3.5" /> Multi-agent AI writing studio
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            Content that sounds{" "}
            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
              exactly like you.
            </span>
          </h1>
          <p className="mt-4 text-lg text-white/60">
            Turn any video, article or podcast into publish-ready content written in your own voice.
          </p>

          <ul className="mt-10 space-y-5">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                  <Icon className="h-5 w-5 text-violet-300" />
                </span>
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="block text-sm text-white/55">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm backdrop-blur">
          <FileText className="h-5 w-5 shrink-0 text-violet-300" />
          <p className="text-white/70">
            Researcher → Writer → Reviewer → Editor: four AI agents collaborate on every piece.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="bg-glow flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Logo className="mb-10 lg:hidden" />

          <h2 className="text-2xl font-semibold tracking-tight">
            {isSignUp ? "Create your account" : "Welcome back"}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isSignUp ? "Start writing in your own voice in minutes." : "Sign in to continue to your studio."}
          </p>

          <SegmentedControl
            label="Authentication mode"
            fullWidth
            className="mt-8"
            value={mode}
            onChange={setMode}
            options={[
              { value: "signin", label: "Sign in" },
              { value: "signup", label: "Create account" },
            ]}
          />

          <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  placeholder={isSignUp ? "At least 6 characters" : "••••••••"}
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {authError && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{authError}</p>
              </div>
            )}

            <Button type="submit" size="lg" disabled={submitting} className="mt-2 w-full">
              {submitting && <Loader2 className="animate-spin" />}
              {isSignUp ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            By continuing you agree to use VoxScribe responsibly with content you have rights to.
          </p>
        </div>
      </section>
    </main>
  );
}
