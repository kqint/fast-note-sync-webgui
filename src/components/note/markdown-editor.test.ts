import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadTransform() {
    vi.resetModules();
    const mod = await import("./markdown-editor");
    return {
        transformObsidianSyntax: mod.transformObsidianSyntax,
        parseFrontmatter: mod.parseFrontmatter
    };
}

describe("transformObsidianSyntax", () => {
    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem("API_URL", "https://notes.example.com");
    });

    it("rewrites markdown image links with resolved file URLs", async () => {
        const { transformObsidianSyntax } = await loadTransform();

        const transformed = transformObsidianSyntax(
            `![inline](../images/demo.jpg "title")`,
            "Work",
            { "../images/demo.jpg": "notes/images/demo.jpg" },
            "token-123"
        );

        expect(transformed).toContain("https://notes.example.com/api/file?");
        expect(transformed).toContain("vault=Work");
        expect(transformed).toContain("path=notes%2Fimages%2Fdemo.jpg");
        expect(transformed).toContain("token=token-123");
        expect(transformed).toContain(`"title"`);
    });

    it("rewrites html image sources with resolved file URLs", async () => {
        const { transformObsidianSyntax } = await loadTransform();

        const transformed = transformObsidianSyntax(
            `<img src="./img/html.png" alt="demo">`,
            "Work",
            { "./img/html.png": "assets/html.png" },
            "token-456"
        );

        expect(transformed).toContain(`<img src="https://notes.example.com/api/file?`);
        expect(transformed).toContain("vault=Work");
        expect(transformed).toContain("path=assets%2Fhtml.png");
        expect(transformed).toContain("token=token-456");
        expect(transformed).toContain(`alt="demo"`);
    });

    it("does not rewrite remote image links", async () => {
        const { transformObsidianSyntax } = await loadTransform();

        const content = `![remote](https://cdn.example.com/demo.png)`;
        const transformed = transformObsidianSyntax(content, "Work", {}, "token-789");

        expect(transformed).toBe(content);
    });

    it("rewrites markdown image syntax pointing at video into a <video> tag", async () => {
        const { transformObsidianSyntax } = await loadTransform();

        const transformed = transformObsidianSyntax(
            `![demo clip](videos/demo.mp4)`,
            "Work",
            { "videos/demo.mp4": "videos/demo.mp4" },
            "tk"
        );

        expect(transformed).toMatch(/^<video\s/);
        expect(transformed).toContain('controls');
        expect(transformed).toContain('preload="metadata"');
        expect(transformed).toContain('title="demo clip"');
        expect(transformed).toContain("/api/file?");
        expect(transformed).toContain("path=videos%2Fdemo.mp4");
        expect(transformed).not.toContain("![demo clip]");
    });

    it("rewrites markdown image syntax pointing at audio into an <audio> tag", async () => {
        const { transformObsidianSyntax } = await loadTransform();

        const transformed = transformObsidianSyntax(
            `![bgm](audio/song.mp3)`,
            "Work",
            { "audio/song.mp3": "audio/song.mp3" },
            "tk"
        );

        expect(transformed).toMatch(/^<audio\s/);
        expect(transformed).toContain('controls');
        expect(transformed).toContain('title="bgm"');
        expect(transformed).toContain("/api/file?");
    });

    it("supports literal whitespace and non-ASCII chars when wrapped in angle brackets", async () => {
        const { transformObsidianSyntax } = await loadTransform();

        // Server-side normalization (PR #4) rewrites ambiguous embeds into
        // the angle-bracket CommonMark form, which the frontend must keep
        // honoring for media files just like it already does for images.
        const transformed = transformObsidianSyntax(
            `![](<视频/演 示.mp4>)`,
            "Vault",
            { "视频/演 示.mp4": "视频/演 示.mp4" },
            "tk"
        );

        expect(transformed).toMatch(/^<video\s/);
        expect(transformed).toContain("/api/file?");
        // The path query parameter must be percent-encoded by URLSearchParams.
        expect(transformed).toMatch(/path=%E8%A7%86%E9%A2%91%2F[^"&]+%E7%A4%BA\.mp4/);
    });

    it("rewrites html <video src=> when the path resolves through fileLinks", async () => {
        const { transformObsidianSyntax } = await loadTransform();

        const transformed = transformObsidianSyntax(
            `<video src="assets/clip.mp4" controls width="500"></video>`,
            "Vault",
            { "assets/clip.mp4": "assets/clip.mp4" },
            "tk"
        );

        expect(transformed).toMatch(/^<video[^>]+src="[^"]*\/api\/file\?[^"]+"/);
        expect(transformed).toContain('controls');
        expect(transformed).toContain('width="500"');
    });

    it("rewrites html <audio src=> when the path resolves through fileLinks", async () => {
        const { transformObsidianSyntax } = await loadTransform();

        const transformed = transformObsidianSyntax(
            `<audio src="assets/song.mp3" controls></audio>`,
            "Vault",
            { "assets/song.mp3": "assets/song.mp3" },
            "tk"
        );

        expect(transformed).toMatch(/^<audio[^>]+src="[^"]*\/api\/file\?[^"]+"/);
        expect(transformed).toContain('controls');
    });

    it("rewrites nested <source src=> inside <video>/<audio>", async () => {
        const { transformObsidianSyntax } = await loadTransform();

        const transformed = transformObsidianSyntax(
            `<video controls><source src="assets/clip.webm" type="video/webm"><source src="assets/clip.mp4" type="video/mp4"></video>`,
            "Vault",
            {
                "assets/clip.webm": "assets/clip.webm",
                "assets/clip.mp4": "assets/clip.mp4",
            },
            "tk"
        );

        expect(transformed).toContain('type="video/webm"');
        expect(transformed).toContain('type="video/mp4"');
        // Both nested <source> src must be rewritten to API URLs.
        const apiUrlMatches = transformed.match(/src="[^"]*\/api\/file\?[^"]+"/g) ?? [];
        expect(apiUrlMatches.length).toBe(2);
    });

    it("preserves self-closing form on <source />", async () => {
        const { transformObsidianSyntax } = await loadTransform();

        const transformed = transformObsidianSyntax(
            `<video controls><source src="assets/clip.mp4" type="video/mp4" /></video>`,
            "Vault",
            { "assets/clip.mp4": "assets/clip.mp4" },
            "tk"
        );

        expect(transformed).toMatch(/<source[^>]+\/>/);
    });

    it("does not rewrite <video src=> for URLs not in fileLinks", async () => {
        const { transformObsidianSyntax } = await loadTransform();

        const content = `<video src="https://cdn.example.com/clip.mp4" controls></video>`;
        const transformed = transformObsidianSyntax(content, "Vault", {}, "tk");

        expect(transformed).toBe(content);
    });

    it("emits <video> for wiki-style ![[clip.mp4]] embeds", async () => {
        const { transformObsidianSyntax } = await loadTransform();

        const transformed = transformObsidianSyntax(
            `![[clip.mp4|Demo Clip]]`,
            "Vault",
            { "clip.mp4": "videos/clip.mp4" },
            "tk"
        );

        expect(transformed).toMatch(/^<video\s/);
        expect(transformed).toContain('title="Demo Clip"');
        expect(transformed).toContain("path=videos%2Fclip.mp4");
    });

    it("emits <audio> for wiki-style ![[song.mp3]] embeds", async () => {
        const { transformObsidianSyntax } = await loadTransform();

        const transformed = transformObsidianSyntax(
            `![[song.mp3]]`,
            "Vault",
            { "song.mp3": "music/song.mp3" },
            "tk"
        );

        expect(transformed).toMatch(/^<audio\s/);
        expect(transformed).toContain("path=music%2Fsong.mp3");
    });

    it("standard `[text](video.mp4)` link stays a clickable link, not embedded", async () => {
        const { transformObsidianSyntax } = await loadTransform();

        const transformed = transformObsidianSyntax(
            `[Watch the demo](videos/demo.mp4)`,
            "Vault",
            { "videos/demo.mp4": "videos/demo.mp4" },
            "tk"
        );

        // The href is rewritten to the API URL, but the markdown link form
        // is preserved (no <video> tag emitted, no `!` prefix added).
        expect(transformed).toMatch(/^\[Watch the demo\]\(/);
        expect(transformed).not.toMatch(/<video/);
        expect(transformed).not.toMatch(/^!/);
        expect(transformed).toContain("/api/file?");
        expect(transformed).toContain("path=videos%2Fdemo.mp4");
    });

    it("escapes HTML-special characters in video alt text", async () => {
        const { transformObsidianSyntax } = await loadTransform();

        const transformed = transformObsidianSyntax(
            `![<script>"x"</script>](videos/demo.mp4)`,
            "Vault",
            { "videos/demo.mp4": "videos/demo.mp4" },
            "tk"
        );

        // Raw '<', '"', '&' must not survive into the title attribute.
        expect(transformed).toMatch(/^<video\s/);
        expect(transformed).toContain("&lt;script&gt;");
        expect(transformed).toContain("&quot;x&quot;");
        expect(transformed).not.toMatch(/title="<script>/);
    });
});

describe("parseFrontmatter", () => {
    it("handles plain markdown content without frontmatter", async () => {
        const { parseFrontmatter } = await loadTransform();
        const content = "# Simple Markdown\nThis is a test note.";
        const { properties, contentBody } = parseFrontmatter(content);
        expect(properties).toEqual({});
        expect(contentBody).toBe(content);
    });

    it("parses single values (string, number, boolean) correctly", async () => {
        const { parseFrontmatter } = await loadTransform();
        const content = `---
title: "My Beautiful Note"
numberValue: 123
floatValue: 45.67
boolTrue: true
boolFalse: false
plainString: Hello Obsidian
---
# Main Content
Body text.`;
        const { properties, contentBody } = parseFrontmatter(content);
        expect(properties).toEqual({
            title: "My Beautiful Note",
            numberValue: 123,
            floatValue: 45.67,
            boolTrue: true,
            boolFalse: false,
            plainString: "Hello Obsidian",
        });
        expect(contentBody).toBe("# Main Content\nBody text.");
    });

    it("parses inline arrays and multiline bullet lists correctly", async () => {
        const { parseFrontmatter } = await loadTransform();
        const content = `---
tags: [idea, article, obsidian]
aliases:
  - my-alias
  - second-alias
numbers:
  - 10
  - 20.5
---
Some body text.`;
        const { properties, contentBody } = parseFrontmatter(content);
        expect(properties).toEqual({
            tags: ["idea", "article", "obsidian"],
            aliases: ["my-alias", "second-alias"],
            numbers: [10, 20.5],
        });
        expect(contentBody).toBe("Some body text.");
    });

    it("gracefully falls back when closing --- is missing", async () => {
        const { parseFrontmatter } = await loadTransform();
        const content = `---
title: Broken
tags: [1, 2]
No closing marks here.`;
        const { properties, contentBody } = parseFrontmatter(content);
        expect(properties).toEqual({});
        expect(contentBody).toBe(content);
    });
});
