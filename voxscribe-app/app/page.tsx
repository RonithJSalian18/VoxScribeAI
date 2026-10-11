"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  streamBackend,
  BackendError,
  API_BASE_URL,
  DEFAULT_API_BASE_URL,
} from "@/lib/api";
import { MobileNav, Sidebar } from "@/components/layout/Sidebar";
import { AuthCard } from "@/components/auth/AuthCard";
import { BrandVaultCard } from "@/components/dashboard/BrandVaultCard";
import { GeneratePostCard } from "@/components/dashboard/GeneratePostCard";
import { GenerationProgress } from "@/components/dashboard/GenerationProgress";
import { BlogResultViewer } from "@/components/dashboard/BlogResultViewer";
import { HistoryView } from "@/components/dashboard/HistoryView";
import { useAccount } from "@/hooks/useAccount";
import { useVoices } from "@/hooks/useVoices";
import { OutlineReview } from "@/components/dashboard/OutlineReview";
import {
  UserProfile,
  GenerateRequestBody,
  GenerationProgressEvent,
  GenerationStreamEvent,
} from "@/types";

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

const getAccessToken = async (): Promise<string | null> => {
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
};

export default function Home() {
  // Navigation & Auth State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Brand Voices (selected voice is used for generation)
  const {
    voices,
    selectedVoice,
    setSelectedVoiceId,
    refresh: refreshVoices,
  } = useVoices(getAccessToken, Boolean(user));

  // Available models and usage/quota
  const { models, usage, refreshUsage } = useAccount(getAccessToken, Boolean(user));

  // Generation State
  const [isLoading, setIsLoading] = useState(false);
  const [progressEvents, setProgressEvents] = useState<GenerationProgressEvent[]>([]);
  const [pendingOutline, setPendingOutline] = useState<{ threadId: string; outline: string } | null>(null);
  const [result, setResult] = useState<{ content: string; postId?: string | null; sourceUrl?: string | null } | null>(null);
  const [lastSourceUrl, setLastSourceUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Listen for Auth Changes
  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle Auth Form Submission
  const handleAuth = async (email: string, pass: string, isSignUp: boolean) => {
    setAuthError(null);

    if (!supabase) {
      setAuthError(
        "Supabase is not configured yet. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
      return;
    }

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password: pass });
      if (error) setAuthError(error.message);
      else alert("Account created successfully! You can now sign in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });
      if (error) setAuthError(error.message);
    }
  };

  /**
   * Streams a generation (or a resumed one) from the backend, updating progress,
   * the outline-review pause, and the final result as events arrive.
   */
  const runGeneration = async (
    path: string,
    body: unknown,
    keepProgress: boolean,
    resultSourceUrl: string | null
  ) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setPendingOutline(null);
    if (!keepProgress) setProgressEvents([]);

    let finished = false;
    try {
      await streamBackend<GenerationStreamEvent>(path, body, await getAccessToken(), (event) => {
        if (event.type === "progress") {
          setProgressEvents((prev) => [...prev, event]);
        } else if (event.type === "outline") {
          finished = true;
          setPendingOutline({ threadId: event.thread_id, outline: event.outline });
        } else if (event.type === "result") {
          // The backend saves the post to history under the authenticated user
          finished = true;
          setResult({ content: event.blog_post, postId: event.post_id, sourceUrl: resultSourceUrl });
        } else if (event.type === "error") {
          finished = true;
          setError(event.message);
        }
      });

      if (!finished) setError("Generation ended unexpectedly. Please try again.");
    } catch (err) {
      if (err instanceof BackendError) {
        setError(err.message);
      } else {
        const attempted =
          API_BASE_URL !== DEFAULT_API_BASE_URL
            ? `${API_BASE_URL} or ${DEFAULT_API_BASE_URL}`
            : DEFAULT_API_BASE_URL;
        setError(
          `Failed to connect to backend (${attempted}). Please verify that FastAPI is running on port 8000.`
        );
      }
    } finally {
      setIsLoading(false);
      refreshUsage();
    }
  };

  const handleGenerate = (body: Omit<GenerateRequestBody, "voice_id">) => {
    const sourceUrl = body.source_url ?? null;
    setLastSourceUrl(sourceUrl);
    return runGeneration(
      "/generate/stream",
      { ...body, voice_id: selectedVoice?.id ?? null },
      false,
      sourceUrl
    );
  };

  const handleResume = (outline: string) => {
    if (!pendingOutline) return;
    runGeneration(
      "/generate/resume",
      { thread_id: pendingOutline.threadId, outline },
      true,
      lastSourceUrl
    );
  };

  // Render Auth screen if not logged in
  if (!user) {
    return <AuthCard onSubmit={handleAuth} authError={authError} />;
  }

  return (
    <div className="flex h-screen bg-zinc-50 font-sans text-zinc-900 overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        user={user}
        onSignOut={() => supabase?.auth.signOut()}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        usage={usage}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto">
        <MobileNav
          user={user}
          onSignOut={() => supabase?.auth.signOut()}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
        <div className="max-w-4xl w-full mx-auto p-6 md:p-10">
          <header className="mb-10">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
              {activeTab === "history" ? "Post History" : "Create New Post"}
            </h1>
            <p className="text-zinc-500 mt-2">
              {activeTab === "history"
                ? "View, search and manage the content you've generated."
                : "Turn videos, articles and podcasts into content that sounds exactly like you."}
            </p>
          </header>

          {activeTab === "dashboard" ? (
            <div className="grid gap-8">
              {/* Brand Voice Vault Section */}
              <BrandVaultCard
                voices={voices}
                selectedVoice={selectedVoice}
                onSelectVoice={setSelectedVoiceId}
                onVoicesChanged={refreshVoices}
                getAccessToken={getAccessToken}
              />

              {/* Input Form Section */}
              <GeneratePostCard
                onGenerate={handleGenerate}
                isLoading={isLoading}
                error={error}
                voiceName={selectedVoice?.name}
                getAccessToken={getAccessToken}
                models={models}
              />

              {/* Multi-Agent Loading State */}
              {isLoading && <GenerationProgress events={progressEvents} />}

              {/* Outline review pause */}
              {pendingOutline && !isLoading && (
                <OutlineReview
                  key={pendingOutline.threadId}
                  outline={pendingOutline.outline}
                  onContinue={handleResume}
                  onCancel={() => setPendingOutline(null)}
                />
              )}

              {/* Output Result Viewer */}
              {result && !isLoading && (
                <BlogResultViewer
                  key={result.postId ?? result.content.slice(0, 50)}
                  result={result.content}
                  user={user}
                  postId={result.postId}
                  sourceUrl={result.sourceUrl}
                  voiceId={selectedVoice?.id}
                  supabase={supabase}
                  getAccessToken={getAccessToken}
                />
              )}
            </div>
          ) : (
            <HistoryView supabase={supabase} user={user} getAccessToken={getAccessToken} />
          )}
        </div>
      </main>
    </div>
  );
}
