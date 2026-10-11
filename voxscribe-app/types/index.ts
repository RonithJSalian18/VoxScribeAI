export interface UserProfile {
  id: string;
  email?: string;
}

export type OutputFormat = "blog" | "twitter_thread" | "linkedin" | "newsletter" | "show_notes";
export type SourceType = "youtube" | "article" | "text";

export interface GenerationOptions {
  output_format: OutputFormat;
  length: "short" | "medium" | "long";
  tone: string;
  audience: string;
  language: string;
  keyword: string;
  model?: string;
}

export interface GenerateRequestBody {
  source_type: SourceType;
  source_url?: string | null;
  transcript?: string | null;
  timestamped_transcript?: string | null;
  source_label?: string | null;
  voice_id?: string | null;
  options: GenerationOptions;
  review_outline: boolean;
}

export interface TranscriptionResponse {
  transcript: string;
  timestamped_transcript: string;
  filename: string;
}

export interface BlogGenerateResponse {
  status: "success" | "error";
  blog_post?: string;
  message?: string;
}

export type AgentNode = "researcher" | "writer" | "reviewer" | "editor";

export interface GenerationProgressEvent {
  type: "progress";
  node: AgentNode;
  voice_samples?: number;
  revision?: boolean;
  score?: number | null;
  revision_requested?: boolean;
}

export type GenerationStreamEvent =
  | { type: "started"; thread_id: string }
  | GenerationProgressEvent
  | { type: "outline"; thread_id: string; outline: string }
  | { type: "result"; blog_post: string; post_id?: string | null }
  | { type: "error"; message: string };

export interface VaultUploadResponse {
  status: "Success" | "Error";
  message: string;
  saved_chunks?: number;
  source_id?: string;
  voice_id?: string;
}

export interface Voice {
  id: string;
  name: string;
  style_profile: string | null;
  created_at: string;
  source_count: number;
  chunk_count: number;
}

export interface VaultSource {
  id: string;
  voice_id: string | null;
  name: string;
  source_type: "pdf" | "docx" | "txt" | "md" | "text" | "url";
  chunk_count: number;
  created_at: string;
}

export interface BlogPostHistoryItem {
  id: string;
  user_id: string;
  youtube_url: string;
  content: string;
  created_at: string;
  source_type?: SourceType;
  output_format?: OutputFormat;
  voice_id?: string | null;
}

export interface SeoResult {
  title: string;
  meta_description: string;
  slug: string;
  tags: string[];
  readability: { flesch_score: number; level: string; words: number; reading_minutes: number };
  internal_links: { post_id: string; title: string; anchor_text: string }[];
}

export type PublishPlatform = "devto" | "wordpress" | "ghost" | "hashnode";

export interface PublishResult {
  platform: PublishPlatform;
  status: "draft" | "published";
  url?: string | null;
  id?: string | null;
}

export interface ModelInfo {
  id: string;
  default: boolean;
}

export interface UsageSummary {
  generations_last_24h: number;
  daily_limit: number;
  total_posts: number;
  posts_by_format: Record<string, number>;
  voices: number;
  samples: number;
  chunks: number;
}
