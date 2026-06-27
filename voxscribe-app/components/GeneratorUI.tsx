"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

export default function GeneratorUI() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // 1. Send the URL to our FastAPI backend
      const response = await fetch("http://localhost:8000/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ youtube_url: url }),
      });

      const data = await response.json();

      // 2. Handle the response
      if (data.status === "success") {
        setResult(data.blog_post);
      } else {
        setError(data.message || "Something went wrong.");
      }
    } catch (err) {
      setError(
        "Failed to connect to the backend server. Make sure it is running on port 8000.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 mt-10">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
        VoxScribe AI Blog Generator
      </h1>

      {/* Input Form */}
      <form onSubmit={handleGenerate} className="flex gap-4 mb-8">
        <input
          type="url"
          placeholder="Paste YouTube URL here..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
        >
          {isLoading ? "Generating..." : "Generate Blog Post"}
        </button>
      </form>

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">
            Agents are analyzing the video and writing your post...
          </p>
          <p className="text-sm text-gray-400 mt-2">
            This usually takes 30-60 seconds.
          </p>
        </div>
      )}

      {/* Results Display */}
      {result && !isLoading && (
        <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 mt-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-500 border-b pb-2">
            Final Output
          </h2>
          {/* React Markdown renders the AI's markdown string cleanly */}
          <article className="prose prose-blue max-w-none text-gray-800">
            <ReactMarkdown>{result}</ReactMarkdown>
          </article>
        </div>
      )}
    </div>
  );
}
