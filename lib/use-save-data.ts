"use client";

import { useEffect, useState } from "react";

type NetworkInformation = EventTarget & {
  saveData?: boolean;
  effectiveType?: string;
};

const SLOW_TYPES = new Set(["slow-2g", "2g", "3g"]);

function getConnection(): NetworkInformation | undefined {
  return (navigator as Navigator & { connection?: NetworkInformation })
    .connection;
}

/** True when the user asked for data saving or the connection is slow. */
export function useSaveData(): boolean {
  // false on the server and on the first client render, so hydration matches.
  const [saveData, setSaveData] = useState(false);

  useEffect(() => {
    const connection = getConnection();
    if (!connection) return;
    const update = () =>
      setSaveData(
        connection.saveData === true ||
          SLOW_TYPES.has(connection.effectiveType ?? ""),
      );
    update();
    connection.addEventListener("change", update);
    return () => connection.removeEventListener("change", update);
  }, []);

  return saveData;
}
