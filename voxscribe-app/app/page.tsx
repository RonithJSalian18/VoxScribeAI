"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { streamBackend, BackendError, API_BASE_URL } from "@/lib/api";
import { AppView, Logo, MobileHeader, MobileTabBar, NAV_ITEMS, Sidebar } from "@/components/layout/Sidebar";
import { AuthCard } from "@/components/auth/AuthCard";
import { CreateView, GenerationResult } from "@/components/create/CreateView";
import { VoicesView } from "@/components/voices/VoicesView";
import { LibraryView } from "@/components/library/LibraryView";
import { useAccount } from "@/hooks/useAccount";
import { useVoices } from "@/hooks/useVoices";
import { cn } from "@/lib/utils";
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

const VIEW_IDS = NAV_ITEMS.map((item) => item.id);
const viewFromHash = (): AppView => {
  const hash = typeof window === "undefined" ? "" : window.location.hash.slice(1);
  return (VIEW_IDS as string[]).includes(hash) ? (hash as AppView) : "create";
};

const VIEW_HEADINGS: Record<AppView, { title: string; description: string }> = {
  create: { title: "Create", description: "Turn videos, articles and podcasts into content that sounds like you." },
  voices: { title: "Brand Voices", description: "Teach VoxScribe how you write with samples of your own work." },
  library: { title: "Library", description: "Everything you've generated, ready to edit, export or publish." },
};

function SplashScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6">
      <Logo />
      <div className="h-1 w-32 overflow-hidden rounded-full bg-secondary">
        <div className="h-full w-1/3 animate-[shimmer_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
      </div>
    </div>
  );
}

export default function Home() {
  // Auth & navigation
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [authError, setAuthError] = useState<string | null>(null);
  const [view, setView] = useState<AppView>("create");

  // Brand Voices (the selected voice is used for generation)
  const {
    voices,
    selectedVoice,
    setSelectedVoiceId,
    refresh: refreshVoices,
    isLoading: isLoadingVoices,
  } = useVoices(getAccessToken, Boolean(user));

  // Available models and usage/quota
  const { models, usage, refreshUsage } = useAccount(getAccessToken, Boolean(user));

  // Generation state
  const [isLoading, setIsLoading] = useState(false);
  const [progressEvents, setProgressEvents] = useState<GenerationProgressEvent[]>([]);
  const [pendingOutline, setPendingOutline] = useState<{ threadId: string; outline: string } | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<GenerateRequestBody | null>(null);

  // Listen for auth changes
  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Keep the active view in the URL hash so refresh and the back button work
  useEffect(() => {
    setView(viewFromHash());
    const onHashChange = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback((next: AppView) => {
    if (window.location.hash.slice(1) !== next) window.location.hash = next;
    setView(next);
    document.getElementById("main-content")?.scrollTo({ top: 0 });
  }, []);

  const handleAuth = async (email: string, pass: string, isSignUp: boolean) => {
    setAuthError(null);

    if (!supabase) {
      setAuthError("Supabase is not configured yet. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password: pass });
      if (error) setAuthError(error.message);
      else if (!data.session) toast.success("Account created", { description: "Check your inbox to confirm your email, then sign in." });
      else toast.success("Welcome to VoxScribe!");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) setAuthError(error.message);
    }
  };

  const handleSignOut = async () => {
    await supabase?.auth.signOut();
    setResult(null);
    setPendingOutline(null);
    setError(null);
  };

  /**
   * Streams a generation (or a resumed one) from the backend, updating progress,
   * the outline-review pause, and the final result as events arrive.
   */
  const runGeneration = async (path: string, body: unknown, keepProgress: boolean, request: GenerateRequestBody | null) => {
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
          // The backend saves the post to the library under the authenticated user
          finished = true;
          setResult({
            content: event.blog_post,
            postId: event.post_id,
            sourceUrl: request?.source_url ?? null,
            outputFormat: request?.options.output_format,
          });
          toast.success("Your content is ready", { description: "Saved to your library." });
        } else if (event.type === "error") {
          finished = true;
          setError(event.message);
        }
      });

      if (!finished) setError("Generation ended unexpectedly. Please try again.");
    } catch (err) {
      setError(
        err instanceof BackendError
          ? err.message
          : `Couldn't reach the backend at ${API_BASE_URL}. Make sure the FastAPI server is running.`,
      );
    } finally {
      setIsLoading(false);
      refreshUsage();
    }
  };

  const handleGenerate = async (body: GenerateRequestBody) => {
    setLastRequest(body);
    await runGeneration("/generate/stream", body, false, body);
  };

  const handleResume = (outline: string) => {
    if (!pendingOutline) return;
    runGeneration("/generate/resume", { thread_id: pendingOutline.threadId, outline }, true, lastRequest);
  };

  if (!authReady) return <SplashScreen />;

  if (!user) {
    return <AuthCard onSubmit={handleAuth} authError={authError} />;
  }

  const heading = VIEW_HEADINGS[view];

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <Sidebar user={user} view={view} onNavigate={navigate} onSignOut={handleSignOut} usage={usage} />

      <main id="main-content" className="flex-1 overflow-y-auto scrollbar-thin">
        <MobileHeader user={user} onSignOut={handleSignOut} />

        <div className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 sm:px-6 md:pb-12 lg:px-8 lg:pt-10">
          <header className="mb-6 lg:mb-8">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{heading.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">{heading.description}</p>
          </header>

          {/* Create stays mounted so in-progress work survives switching views */}
          <div className={cn(view !== "create" && "hidden")}>
            <CreateView
              voices={voices}
              selectedVoice={selectedVoice}
              onSelectVoice={setSelectedVoiceId}
              onManageVoices={() => navigate("voices")}
              models={models}
              supabase={supabase}
              getAccessToken={getAccessToken}
              isLoading={isLoading}
              progressEvents={progressEvents}
              pendingOutline={pendingOutline}
              result={result}
              error={error}
              canRetry={Boolean(lastRequest)}
              onGenerate={handleGenerate}
              onResume={handleResume}
              onDiscardOutline={() => setPendingOutline(null)}
              onRetry={() => lastRequest && handleGenerate(lastRequest)}
            />
          </div>

          {view === "voices" && (
            <VoicesView
              voices={voices}
              isLoadingVoices={isLoadingVoices}
              selectedVoice={selectedVoice}
              onSelectVoice={setSelectedVoiceId}
              onVoicesChanged={refreshVoices}
              getAccessToken={getAccessToken}
            />
          )}

          {view === "library" && (
            <LibraryView
              supabase={supabase}
              user={user}
              getAccessToken={getAccessToken}
              onCreate={() => navigate("create")}
            />
          )}
        </div>
      </main>

      <MobileTabBar view={view} onNavigate={navigate} />
    </div>
  );
}
