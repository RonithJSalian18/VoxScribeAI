"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { createClient } from "@supabase/supabase-js";
import {
  UploadCloud,
  Wand2,
  LogOut,
  FileText,
  CheckCircle2,
  Loader2,
  LayoutDashboard,
  Sparkles,
  AlertCircle,
  Copy,
} from "lucide-react";

// Initialize Supabase Client
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://ubwsprjkfejzsbfyzorx.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVid3NwcmprZmVqenNiZnl6b3J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyOTg1OTgsImV4cCI6MjA5Nzg3NDU5OH0.lx5Il1tMJ4tuvrIB7JWtpMPXTWD7eU5vH91-ugEfEJY";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Home() {
  // Auth State
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // App State
  const [url, setUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // Generation State
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Listen for Auth Changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Handle Authentication
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setAuthError(error.message);
      else alert("Success! You can now sign in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) setAuthError(error.message);
    }
  };

  // Handle PDF Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    setUploadStatus("Uploading to your Brand Vault...");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("user_id", user.id); // Pass user ID to associate the PDF with them

    try {
      const response = await fetch("http://localhost:8000/vault/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (data.status === "Success") {
        setUploadStatus(
          "Vault updated successfully! The AI will now write like you.",
        );
      } else {
        setUploadStatus("Upload failed. Please try again.");
      }
    } catch (err) {
      setUploadStatus("Failed to connect to backend.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    // Simulate premium step-by-step loading UX
    setLoadingStep(1);
    setTimeout(() => setLoadingStep(2), 2000);
    setTimeout(() => setLoadingStep(3), 5000);

    try {
      // 1. Send the URL and user_id to our FastAPI backend
      const response = await fetch("http://localhost:8000/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          youtube_url: url,
          user_id: user.id, // Send the user ID so the backend can search their specific vault
        }),
      });

      const data = await response.json();

      // 2. Handle the response
      if (data.status === "success") {
        setResult(data.blog_post);

        // 3. Save the generated post to the user's database history
        if (user) {
          const { error: dbError } = await supabase
            .from("blog_posts")
            .insert([
              { user_id: user.id, youtube_url: url, content: data.blog_post },
            ]);

          if (dbError) {
            console.error("Failed to save to database:", dbError);
          }
        }
      } else {
        setError(data.message || "Something went wrong.");
      }
    } catch (err) {
      setError(
        "Failed to connect to the backend server. Make sure it is running on port 8000.",
      );
    } finally {
      setIsLoading(false);
      setLoadingStep(0);
    }
  };

  // If user is NOT logged in, show Auth Screen
  if (!user) {
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

          <form onSubmit={handleAuth} className="flex flex-col gap-5">
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
              className="w-full bg-zinc-900 text-white p-4 rounded-xl font-semibold hover:bg-zinc-800 transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              {isSignUp ? "Create Account" : "Sign In"}
            </button>
          </form>

          {authError && (
            <div className="mt-6 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4" />
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

  return (
    <div className="flex h-screen bg-zinc-50 font-sans text-zinc-900 overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="w-64 bg-white border-r border-zinc-200 hidden md:flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-zinc-100">
          <div className="bg-zinc-900 p-2 rounded-xl">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight text-zinc-900">
            VoxScribe
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <a
            href="#"
            className="flex items-center gap-3 px-4 py-3 bg-zinc-100 text-zinc-900 rounded-xl font-medium transition-colors"
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </a>
          <a
            href="#"
            className="flex items-center gap-3 px-4 py-3 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 rounded-xl font-medium transition-colors"
          >
            <FileText className="w-5 h-5" />
            My History
          </a>
        </nav>

        <div className="p-4 border-t border-zinc-100">
          <div className="px-4 py-3 bg-zinc-50 rounded-xl mb-4">
            <p className="text-xs text-zinc-500 font-medium mb-1">
              Signed in as
            </p>
            <p className="text-sm font-semibold truncate">{user.email}</p>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-3 px-4 py-3 w-full text-left text-zinc-500 hover:bg-zinc-50 hover:text-red-600 rounded-xl font-medium transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto">
        <div className="max-w-4xl w-full mx-auto p-6 md:p-10">
          <header className="mb-10">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
              Create New Post
            </h1>
            <p className="text-zinc-500 mt-2">
              Turn any YouTube video into a blog post in your unique brand
              voice.
            </p>
          </header>

          <div className="grid gap-8">
            {/* Brand Voice Vault Section */}
            <section className="bg-white p-8 rounded-3xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-zinc-100">
              <div className="flex items-center gap-3 mb-2">
                <UploadCloud className="w-6 h-6 text-indigo-600" />
                <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
                  Train Brand Voice
                </h2>
              </div>
              <p className="text-zinc-500 text-sm mb-6">
                Upload a PDF of your past writing. Our AI agents will analyze it
                and mimic your exact style, vocabulary, and tone.
              </p>

              <div className="relative border-2 border-dashed border-zinc-200 rounded-2xl p-8 hover:bg-zinc-50 transition-colors group cursor-pointer">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="bg-indigo-50 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-8 h-8 text-indigo-600" />
                  </div>
                  <p className="font-semibold text-zinc-900 mb-1">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-zinc-500">
                    PDF files only (Max 10MB)
                  </p>
                </div>
              </div>

              {uploadStatus && (
                <div
                  className={`mt-4 flex items-center gap-2 p-4 rounded-xl text-sm font-medium ${uploadStatus.includes("success") ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-blue-50 text-blue-700 border border-blue-100"}`}
                >
                  {uploadStatus.includes("success") ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  )}
                  <p>{uploadStatus}</p>
                </div>
              )}
            </section>

            {/* Input Form Section */}
            <section className="bg-white p-8 rounded-3xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-zinc-100">
              <h2 className="text-xl font-semibold tracking-tight text-zinc-900 mb-6">
                Generate Content
              </h2>
              <form
                onSubmit={handleGenerate}
                className="flex flex-col sm:flex-row gap-4"
              >
                <div className="flex-1 relative">
                  <input
                    type="url"
                    placeholder="Paste YouTube URL here..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    className="w-full p-4 pl-5 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all outline-none text-zinc-900 placeholder:text-zinc-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-semibold hover:bg-indigo-700 disabled:bg-indigo-400 transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] flex items-center justify-center gap-2 min-w-[200px]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      Generate Post
                    </>
                  )}
                </button>
              </form>

              {/* Error Message */}
              {error && (
                <div className="mt-6 flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-sm">
                  <AlertCircle className="w-5 h-5" />
                  {error}
                </div>
              )}
            </section>

            {/* Loading State - Premium Steps */}
            {isLoading && (
              <div className="bg-white p-8 rounded-3xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-zinc-100 flex flex-col items-center justify-center py-16">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-indigo-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
                  <div className="bg-indigo-50 p-6 rounded-full relative">
                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                  </div>
                </div>

                <div className="space-y-4 w-full max-w-sm">
                  <div
                    className={`flex items-center gap-3 transition-opacity duration-500 ${loadingStep >= 1 ? "opacity-100" : "opacity-30"}`}
                  >
                    {loadingStep > 1 ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Loader2
                        className={`w-5 h-5 text-indigo-500 ${loadingStep === 1 ? "animate-spin" : ""}`}
                      />
                    )}
                    <p className="font-medium text-zinc-700">
                      Extracting YouTube transcript...
                    </p>
                  </div>
                  <div
                    className={`flex items-center gap-3 transition-opacity duration-500 ${loadingStep >= 2 ? "opacity-100" : "opacity-30"}`}
                  >
                    {loadingStep > 2 ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Loader2
                        className={`w-5 h-5 text-indigo-500 ${loadingStep === 2 ? "animate-spin" : ""}`}
                      />
                    )}
                    <p className="font-medium text-zinc-700">
                      Searching Vault for Brand Voice...
                    </p>
                  </div>
                  <div
                    className={`flex items-center gap-3 transition-opacity duration-500 ${loadingStep >= 3 ? "opacity-100" : "opacity-30"}`}
                  >
                    {loadingStep > 3 ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Loader2
                        className={`w-5 h-5 text-indigo-500 ${loadingStep === 3 ? "animate-spin" : ""}`}
                      />
                    )}
                    <p className="font-medium text-zinc-700">
                      Agents writing and formatting post...
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Results Display */}
            {result && !isLoading && (
              <section className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-zinc-100 mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
                {/* Decorative Cover Header */}
                <div className="h-32 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 w-full relative">
                  <div className="absolute -bottom-6 left-8 bg-white p-2 rounded-2xl shadow-sm">
                    <div className="bg-zinc-100 w-12 h-12 rounded-xl flex items-center justify-center">
                      <FileText className="w-6 h-6 text-indigo-600" />
                    </div>
                  </div>
                </div>

                <div className="p-8 md:p-12 pt-12">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-10 pb-6 border-b border-zinc-100 gap-4">
                    <div>
                      <p className="text-sm font-semibold tracking-widest text-indigo-500 uppercase mb-3">
                        Generated Draft
                      </p>
                      <div className="flex items-center gap-3 text-sm text-zinc-500">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700 shadow-sm border border-indigo-200">
                          {user?.email?.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-zinc-700">
                          By {user?.email?.split("@")[0]}
                        </span>
                        <span>•</span>
                        <span>
                          {new Date().toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(result)}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100 bg-indigo-50 px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      Copy to Clipboard
                    </button>
                  </div>

                  {/* Enhanced Tailwind Typography (Prose) */}
                  <article className="prose prose-zinc prose-lg md:prose-xl prose-headings:font-bold prose-headings:tracking-tight prose-h1:text-4xl prose-h1:mb-8 prose-h1:leading-tight prose-h2:text-2xl prose-h2:mt-12 prose-a:text-indigo-600 hover:prose-a:text-indigo-500 prose-blockquote:border-l-indigo-500 prose-blockquote:bg-indigo-50/50 prose-blockquote:py-2 prose-blockquote:px-6 prose-blockquote:rounded-r-2xl prose-blockquote:font-medium prose-blockquote:not-italic prose-blockquote:text-indigo-900 prose-li:marker:text-indigo-500 max-w-none">
                    <ReactMarkdown>{result}</ReactMarkdown>
                  </article>
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
