"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  mediaRefIds,
  type MediaEntry,
  type MediaMap,
} from "@/lib/admin-site-content";

// The media one open editor can show: the saved item's media, plus this session's uploads. An
// upload keeps an object URL until the draft stops using it or a save replaces it with the
// API's URLs. Every URL this editor made is revoked when the editor unmounts.

export interface SiteMedia {
  /** Every file id the draft can show: the saved media and this session's uploads. */
  media: MediaMap;
  /** Records a finished upload under its file id. */
  register: (fileId: string, entry: MediaEntry) => void;
  /** An object URL for a picked file, revoked when the editor closes or a save replaces it. */
  createObjectUrl: (file: File) => string;
  /** Marks one field's upload as running or done. Save waits while any is running. */
  setBusy: (key: string, busy: boolean) => void;
  /** How many uploads are running. */
  busy: number;
  /** The submission each file came from, by file id ("Uploaded by" on a card). */
  owners: Record<string, string>;
}

export const SiteMediaContext = createContext<SiteMedia>({
  media: {},
  register: () => {},
  createObjectUrl: () => "",
  setBusy: () => {},
  busy: 0,
  owners: {},
});

export function useSiteMedia(): SiteMedia {
  return useContext(SiteMediaContext);
}

/** The media state for an editor. `initial` is the saved item's media; `draft` is the value being edited. */
export function useSiteMediaStore(initial: MediaMap, draft: unknown) {
  const [serverMedia, setServerMedia] = useState<MediaMap>(initial);
  const [uploads, setUploads] = useState<MediaMap>({});
  const [busyKeys, setBusyKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // Every object URL this editor has made, so unmounting can revoke them all.
  const urls = useRef(new Set<string>());

  useEffect(() => {
    const created = urls.current;
    return () => {
      for (const url of created) URL.revokeObjectURL(url);
      created.clear();
    };
  }, []);

  // Only uploads the draft still refers to are shown. The rest are revoked below.
  const used = useMemo(() => mediaRefIds(draft), [draft]);

  useEffect(() => {
    for (const [id, entry] of Object.entries(uploads)) {
      if (used.has(id) || !entry.url) continue;
      if (!urls.current.delete(entry.url)) continue;
      URL.revokeObjectURL(entry.url);
    }
  }, [used, uploads]);

  const register = useCallback(
    (fileId: string, entry: MediaEntry) =>
      setUploads((prev) => ({ ...prev, [fileId]: entry })),
    [],
  );

  const createObjectUrl = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    urls.current.add(url);
    return url;
  }, []);

  const setBusy = useCallback((key: string, busy: boolean) => {
    setBusyKeys((prev) => {
      if (prev.has(key) === busy) return prev;
      const next = new Set(prev);
      if (busy) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  /** After a save: the API's media replaces everything, and the object URLs go. */
  const replaceSaved = useCallback((next: MediaMap) => {
    setServerMedia(next);
    setUploads({});
    for (const url of urls.current) URL.revokeObjectURL(url);
    urls.current.clear();
  }, []);

  const state = useMemo<SiteMedia>(() => {
    const live: MediaMap = {};
    for (const [id, entry] of Object.entries(uploads)) {
      if (used.has(id)) live[id] = entry;
    }
    return {
      media: { ...serverMedia, ...live },
      register,
      createObjectUrl,
      setBusy,
      busy: busyKeys.size,
      owners: {},
    };
  }, [
    serverMedia,
    uploads,
    used,
    register,
    createObjectUrl,
    setBusy,
    busyKeys,
  ]);

  return { state, replaceSaved };
}
