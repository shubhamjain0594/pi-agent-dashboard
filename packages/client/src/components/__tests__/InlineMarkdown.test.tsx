import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import React from "react";
import { InlineMarkdown } from "../interactive-renderers/InlineMarkdown.js";

afterEach(cleanup);

describe("InlineMarkdown", () => {
  it("renders bold text", async () => {
    const { container } = render(<InlineMarkdown content="Allow **dangerous** operation?" />);
    await waitFor(() => {
      expect(container.querySelector("strong")).toBeTruthy();
    });
    expect(container.querySelector("strong")!.textContent).toBe("dangerous");
  });

  it("renders inline code", async () => {
    const { container } = render(<InlineMarkdown content="Run `rm -rf` command?" />);
    await waitFor(() => {
      expect(container.querySelector("code")).toBeTruthy();
    });
    expect(container.querySelector("code")!.textContent).toBe("rm -rf");
  });

  it("renders italic text", async () => {
    const { container } = render(<InlineMarkdown content="This is *important*" />);
    await waitFor(() => {
      expect(container.querySelector("em")).toBeTruthy();
    });
    expect(container.querySelector("em")!.textContent).toBe("important");
  });

  it("renders links", async () => {
    const { container } = render(<InlineMarkdown content="See [docs](https://example.com)" />);
    await waitFor(() => {
      expect(container.querySelector("a")).toBeTruthy();
    });
    const link = container.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("https://example.com");
    expect(link.textContent).toBe("docs");
  });

  it("strips block elements like paragraphs", async () => {
    const { container } = render(<InlineMarkdown content="Hello world" />);
    await waitFor(() => {
      expect(container.textContent).toContain("Hello world");
    });
    expect(container.querySelector("p")).toBeNull();
  });

  it("strips list elements but keeps text", async () => {
    const { container } = render(<InlineMarkdown content="- item one\n- item two" />);
    await waitFor(() => {
      expect(container.textContent).toContain("item one");
    });
    expect(container.querySelector("ul")).toBeNull();
    expect(container.querySelector("li")).toBeNull();
    expect(container.textContent).toContain("item two");
  });

  it("strips heading elements but keeps text", async () => {
    const { container } = render(<InlineMarkdown content="# Big Title" />);
    await waitFor(() => {
      expect(container.textContent).toContain("Big Title");
    });
    expect(container.querySelector("h1")).toBeNull();
  });
});
