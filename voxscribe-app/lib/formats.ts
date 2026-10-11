import { GenerationOptions, OutputFormat } from "@/types";

export const OUTPUT_FORMATS: { id: OutputFormat; label: string; description: string }[] = [
  { id: "blog", label: "Blog post", description: "SEO-ready article with headings" },
  { id: "twitter_thread", label: "X thread", description: "Numbered tweets, 280 chars each" },
  { id: "linkedin", label: "LinkedIn", description: "Hook, short paragraphs, hashtags" },
  { id: "newsletter", label: "Newsletter", description: "Subject, preview text and body" },
  { id: "show_notes", label: "Show notes", description: "Summary, takeaways, timestamped chapters" },
];

export const formatLabel = (format?: OutputFormat): string =>
  OUTPUT_FORMATS.find((f) => f.id === format)?.label ?? "Blog post";

export const TONE_SUGGESTIONS = [
  "Conversational",
  "Professional",
  "Witty",
  "Authoritative",
  "Inspirational",
  "Educational",
];

export const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Italian",
  "Dutch",
  "Hindi",
  "Japanese",
  "Korean",
  "Chinese",
  "Arabic",
];

export const DEFAULT_OPTIONS: GenerationOptions = {
  output_format: "blog",
  length: "medium",
  tone: "",
  audience: "",
  language: "English",
  keyword: "",
};
