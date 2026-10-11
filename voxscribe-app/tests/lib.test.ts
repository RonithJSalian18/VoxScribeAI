import { afterEach, describe, expect, it, vi } from "vitest";
import { apiJson, BackendError, streamBackend } from "@/lib/api";
import { getPostExcerpt, getPostTitle, getYoutubeId } from "@/lib/markdown";

describe("markdown helpers", () => {
  const post = "# The **Best** [Guide](https://x.y)\n\n> A quote\n\nFirst paragraph with *emphasis*.\n\n## Next\n- item";

  it("extracts the H1 title without inline markdown", () => {
    expect(getPostTitle(post)).toBe("The Best Guide");
    expect(getPostTitle("no heading")).toBe("Untitled post");
  });

  it("builds a plain-text excerpt that skips headings and quotes", () => {
    expect(getPostExcerpt(post)).toBe("First paragraph with emphasis. - item");
    expect(getPostExcerpt("word ".repeat(100), 20)).toMatch(/…$/);
  });

  it("parses YouTube IDs", () => {
    expect(getYoutubeId("https://www.youtube.com/watch?v=abcdefghijk&t=10")).toBe("abcdefghijk");
    expect(getYoutubeId("https://youtu.be/abcdefghijk")).toBe("abcdefghijk");
    expect(getYoutubeId("https://example.com/article")).toBeNull();
    expect(getYoutubeId(null)).toBeNull();
  });
});

/** Builds a fetch Response whose body arrives in the given chunks. */
const streamingResponse = (chunks: string[], status = 200) =>
  new Response(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
        controller.close();
      },
    }),
    { status }
  );

describe("streamBackend", () => {
  afterEach(() => vi.restoreAllMocks());

  it("parses SSE events split across chunks and ignores keep-alive comments", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      streamingResponse([
        'data: {"type":"started"}\n\n: keep-alive\n\nda',
        'ta: {"type":"progress","node":"researcher"}\n',
        '\ndata: {"type":"result","blog_post":"# Hi"}\n\n',
      ])
    );

    const events: unknown[] = [];
    await streamBackend("/generate/stream", { a: 1 }, "token-123", (e) => events.push(e));

    expect(events).toEqual([
      { type: "started" },
      { type: "progress", node: "researcher" },
      { type: "result", blog_post: "# Hi" },
    ]);
    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer token-123");
  });

  it("throws BackendError with the server's detail on HTTP errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Voice not found." }), { status: 404 })
    );
    await expect(streamBackend("/x", {}, null, () => {})).rejects.toThrow(new BackendError("Voice not found."));
  });
});

describe("apiJson", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends JSON and returns the parsed body", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response('{"ok":true}'));
    await expect(apiJson("/voices", "t", { method: "POST", body: "{}" })).resolves.toEqual({ ok: true });
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("Content-Type")).toBe("application/json");
  });

  it("surfaces FastAPI validation messages", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: [{ msg: "Field required" }] }), { status: 422 })
    );
    await expect(apiJson("/x", null)).rejects.toThrow("Field required");
  });

  it("reports network failures clearly", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(apiJson("/x", null)).rejects.toThrow(/Failed to connect to backend/);
  });
});
