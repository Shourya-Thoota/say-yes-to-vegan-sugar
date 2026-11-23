/**
 * Focused coverage for the featured CBC video on the homepage.
 *
 * The player is click-to-load: before activation there must be no YouTube
 * iframe, remote thumbnail, preconnect, or player request. After activation
 * the iframe must use the privacy-enhanced youtube-nocookie embed URL, and
 * the external fallback must point at the canonical watch URL.
 */
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VideoEmbed } from "../components/video-embed";

const VIDEO_ID = "tOw5M40uSyk";
const TITLE = "Sugar is sweet but is it vegan? by CBC British Columbia";
const WATCH_URL = "https://www.youtube.com/watch?v=tOw5M40uSyk";
const EMBED_URL = `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?rel=0`;

function renderEmbed() {
  return render(<VideoEmbed videoId={VIDEO_ID} title={TITLE} watchUrl={WATCH_URL} />);
}

describe("featured CBC video embed", () => {
  it("loads nothing from the video provider before activation", () => {
    const { container } = renderEmbed();

    // No iframe, no embed/player URL, and no remote thumbnail or preconnect.
    // (The only youtube.com reference allowed pre-consent is the fallback
    // anchor href, which makes no network request on its own.)
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.innerHTML).not.toContain("youtube-nocookie.com");
    expect(container.innerHTML).not.toContain("/embed/");
    expect(container.querySelector('link[rel="preconnect"]')).toBeNull();
    expect(container.querySelector("img")).toBeNull();

    // Play button exposes the accessible video title.
    const play = screen.getByRole("button", { name: `Play video: ${TITLE}` });
    expect(play).toBeTruthy();

    // External fallback points at the canonical watch URL.
    const fallback = screen.getByRole("link", { name: /watch on youtube instead/i });
    expect(fallback.getAttribute("href")).toBe(WATCH_URL);
  });

  it("loads the privacy-enhanced embed only after activation", () => {
    const { container } = renderEmbed();

    fireEvent.click(screen.getByRole("button", { name: `Play video: ${TITLE}` }));

    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("src")).toBe(EMBED_URL);
    expect(iframe?.getAttribute("title")).toBe(TITLE);

    const open = screen.getByRole("link", { name: /open on youtube/i });
    expect(open.getAttribute("href")).toBe(WATCH_URL);
  });
});

describe("homepage video configuration", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "app", "page.tsx"), "utf8");

  it("features the CBC segment and its fallback URL", () => {
    expect(source).toContain(VIDEO_ID);
    expect(source).toContain("Sugar is sweet but is it vegan?");
    expect(source).toContain("CBC British Columbia");
    expect(source).toContain(WATCH_URL);
  });

  it("no longer references the previous video", () => {
    expect(source).not.toContain("RcbeJEUnii4");
    expect(source).not.toContain("BiteSizeVegan");
  });
});
