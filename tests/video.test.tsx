/**
 * Featured CBC video: click-to-load player loads nothing from YouTube
 * before activation, then uses the privacy-enhanced youtube-nocookie embed.
 */
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

    // No iframe, embed URL, remote thumbnail, or preconnect. The fallback
    // anchor href makes no network request on its own.
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.innerHTML).not.toContain("youtube-nocookie.com");
    expect(container.innerHTML).not.toContain("/embed/");
    expect(container.querySelector('link[rel="preconnect"]')).toBeNull();
    expect(container.querySelector("img")).toBeNull();

    const play = screen.getByRole("button", { name: `Play video: ${TITLE}` });
    expect(play).toBeTruthy();

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
