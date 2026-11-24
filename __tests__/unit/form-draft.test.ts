import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { act, renderHook } from "@testing-library/react";
import {
  clearAllDrafts,
  draftKey,
  loadDraft,
  saveDraft,
  useFormDraft,
  useRestoredDraft,
} from "@/lib/form-draft";
import { readReturnTo, setReturnTo } from "@/lib/return-to";
import { api } from "@/lib/api";

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  window.localStorage.clear();
  clearAllDrafts();
  // Drafts are only written for a signed-in person, so every test starts signed in.
  window.localStorage.setItem(
    "auth_tokens",
    JSON.stringify({ accessToken: "a", refreshToken: "r" }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("draftKey", () => {
  it("keys each account and form apart, and is off until the account is known", () => {
    expect(draftKey("acc-1", "requirement")).toBe("draft:v1:acc-1:requirement");
    expect(draftKey("acc-1", "requirement", "from:9")).toBe(
      "draft:v1:acc-1:requirement:from:9",
    );
    expect(draftKey("acc-2", "requirement")).not.toBe(
      draftKey("acc-1", "requirement"),
    );
    expect(draftKey(undefined, "requirement")).toBeNull();
  });
});

describe("useFormDraft", () => {
  it("saves 500 ms after a change, not before", () => {
    vi.useFakeTimers();
    const key = draftKey("acc-1", "package")!;
    const { rerender } = renderHook(
      ({ value }) => useFormDraft({ key, value, pristine: false }),
      { initialProps: { value: { title: "A" } } },
    );
    rerender({ value: { title: "Ab" } });
    act(() => vi.advanceTimersByTime(499));
    expect(window.localStorage.getItem(key)).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(JSON.parse(window.localStorage.getItem(key)!).value).toEqual({
      title: "Ab",
    });
  });

  it("reads an existing draft once, on mount", () => {
    const key = draftKey("acc-1", "package")!;
    saveDraft(key, { title: "Kept" });
    const { result } = renderHook(() =>
      useFormDraft({ key, value: { title: "" }, pristine: true }),
    );
    expect(result.current.restored?.value).toEqual({ title: "Kept" });
  });

  it("clear() removes the draft and blocks later saves for this mount", () => {
    vi.useFakeTimers();
    const key = draftKey("acc-1", "package")!;
    const { result, rerender } = renderHook(
      ({ value }) => useFormDraft({ key, value, pristine: false }),
      { initialProps: { value: { title: "A" } } },
    );
    act(() => result.current.clear());
    rerender({ value: { title: "Later" } });
    act(() => vi.advanceTimersByTime(1000));
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("saves nothing while the form is pristine", () => {
    vi.useFakeTimers();
    const key = draftKey("acc-1", "package")!;
    renderHook(() =>
      useFormDraft({ key, value: { title: "" }, pristine: true }),
    );
    act(() => vi.advanceTimersByTime(1000));
    expect(window.localStorage.getItem(key)).toBeNull();
  });
});

describe("useFormDraft flushes", () => {
  it("saves at once on pagehide, without waiting for the debounce", () => {
    const key = draftKey("acc-1", "package")!;
    const { rerender } = renderHook(
      ({ value }) => useFormDraft({ key, value, pristine: false }),
      { initialProps: { value: { title: "A" } } },
    );
    rerender({ value: { title: "Typed" } });
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(JSON.parse(window.localStorage.getItem(key)!).value).toEqual({
      title: "Typed",
    });
  });

  it("saves at once on unmount, so leaving for the dashboard keeps the draft", () => {
    const key = draftKey("acc-1", "package")!;
    const { rerender, unmount } = renderHook(
      ({ value }) => useFormDraft({ key, value, pristine: false }),
      { initialProps: { value: { title: "A" } } },
    );
    rerender({ value: { title: "Left" } });
    unmount();
    expect(JSON.parse(window.localStorage.getItem(key)!).value).toEqual({
      title: "Left",
    });
  });
});

describe("useRestoredDraft", () => {
  type Form = { title: string };
  const EMPTY: Form = { title: "" };

  function renderRestore(key: string | null, ready = true) {
    return renderHook(
      (props: { ready: boolean }) => {
        const [form, setForm] = useState<Form>(EMPTY);
        const restore = useRestoredDraft<Form>({
          key,
          form,
          setForm,
          baseline: EMPTY,
          ready: props.ready,
          sanitize: (saved) => ({ title: saved.title.trim() }),
          fresh: EMPTY,
          focusId: "restore-title",
        });
        return { form, setForm, ...restore };
      },
      { initialProps: { ready } },
    );
  }

  it("an untouched restore is not saved again, so its savedAt and TTL stay", () => {
    vi.useFakeTimers();
    const key = draftKey("acc-1", "package")!;
    const savedAt = Date.now() - 60_000;
    window.localStorage.setItem(
      key,
      JSON.stringify({ v: 1, savedAt, value: { title: "Saved" } }),
    );
    const { result } = renderRestore(key);
    expect(result.current.restoredAt).toBe(savedAt);
    act(() => vi.advanceTimersByTime(5000));
    expect(JSON.parse(window.localStorage.getItem(key)!).savedAt).toBe(savedAt);
  });

  it("writes nothing once the tokens are cleared, even when unmounting with a change pending", () => {
    const key = draftKey("acc-1", "package")!;
    const { rerender, unmount } = renderHook(
      ({ value }) => useFormDraft({ key, value, pristine: false }),
      { initialProps: { value: { title: "A" } } },
    );
    window.localStorage.removeItem("auth_tokens");
    rerender({ value: { title: "Late" } });
    unmount();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("applies a draft once the lists are ready", () => {
    const key = draftKey("acc-1", "package")!;
    saveDraft(key, { title: "  Saved  " });
    const { result } = renderRestore(key);
    expect(result.current.form.title).toBe("Saved");
    expect(result.current.restoredAt).not.toBeNull();
  });

  it("discards the offer, not the typing, when the person typed before the lists loaded", () => {
    const key = draftKey("acc-1", "package")!;
    saveDraft(key, { title: "Old" });
    const { result, rerender } = renderRestore(key, false);
    act(() => result.current.setForm({ title: "Typed" }));
    rerender({ ready: true });
    expect(result.current.form.title).toBe("Typed");
    expect(result.current.restoredAt).toBeNull();
    expect(loadDraft(key)).toBeNull();
  });

  it("holds saving until the restore decision is made", () => {
    vi.useFakeTimers();
    const key = draftKey("acc-1", "package")!;
    saveDraft(key, { title: "Saved" });
    const { result } = renderRestore(key, false);
    act(() => result.current.setForm({ title: "Typed" }));
    act(() => vi.advanceTimersByTime(1000));
    expect(loadDraft<Form>(key)?.value.title).toBe("Saved");
  });

  it("never reads or saves without an account", () => {
    saveDraft(draftKey("acc-1", "package")!, { title: "Other" });
    const { result } = renderRestore(null);
    expect(result.current.restoredAt).toBeNull();
    expect(result.current.form.title).toBe("");
  });

  it("Start over resets to the fresh state, drops the draft and moves focus to the title", () => {
    const key = draftKey("acc-1", "package")!;
    saveDraft(key, { title: "Saved" });
    const heading = document.createElement("h1");
    heading.id = "restore-title";
    heading.tabIndex = -1;
    document.body.appendChild(heading);
    const { result } = renderRestore(key);
    act(() => result.current.startOver());
    expect(result.current.form.title).toBe("");
    expect(result.current.restoredAt).toBeNull();
    expect(loadDraft(key)).toBeNull();
    expect(document.activeElement).toBe(heading);
    heading.remove();
  });
});

describe("token clearing", () => {
  it("clears every draft and the return trip when tokens are cleared", () => {
    saveDraft(draftKey("acc-1", "package")!, { a: 1 });
    setReturnTo("/dashboard/find-tuitions", "search");
    api.clearTokens();
    expect(loadDraft(draftKey("acc-1", "package")!)).toBeNull();
    expect(readReturnTo()).toBeNull();
  });
});

describe("loadDraft and storage", () => {
  it("drops an entry older than 7 days", () => {
    const key = draftKey("acc-1", "package")!;
    window.localStorage.setItem(
      key,
      JSON.stringify({ v: 1, savedAt: Date.now() - 8 * DAY, value: { a: 1 } }),
    );
    expect(loadDraft(key)).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("drops malformed JSON and a wrong version", () => {
    const key = draftKey("acc-1", "package")!;
    window.localStorage.setItem(key, "{not json");
    expect(loadDraft(key)).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();

    window.localStorage.setItem(
      key,
      JSON.stringify({ v: 2, savedAt: Date.now(), value: {} }),
    );
    expect(loadDraft(key)).toBeNull();
  });

  it("falls back to memory when storage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const key = draftKey("acc-1", "package")!;
    saveDraft(key, { title: "In memory" });
    expect(loadDraft(key)?.value).toEqual({ title: "In memory" });
  });

  it("clearAllDrafts removes every draft key and leaves other keys alone", () => {
    saveDraft(draftKey("acc-1", "package")!, { a: 1 });
    saveDraft(draftKey("acc-2", "requirement")!, { b: 2 });
    window.localStorage.setItem("other", "keep");
    clearAllDrafts();
    expect(loadDraft(draftKey("acc-1", "package")!)).toBeNull();
    expect(loadDraft(draftKey("acc-2", "requirement")!)).toBeNull();
    expect(window.localStorage.getItem("other")).toBe("keep");
  });
});
