import { describe, expect, it } from "vitest";
import { buildShareData, buildShareText, SHARE_MESSAGE_BODY } from "../lib/share";

describe("share helpers", () => {
  it("appends the homepage URL without private paths", () => {
    const text = buildShareText("https://example.org/");
    expect(text).toContain(SHARE_MESSAGE_BODY);
    expect(text.endsWith("https://example.org/")).toBe(true);
    expect(text).not.toContain("localhost");
  });

  it("builds native share data with title and url", () => {
    const data = buildShareData("https://example.org");
    expect(data.title).toContain("Temple Initiative");
    expect(data.url).toBe("https://example.org/");
  });
});
