import { useEffect, useRef } from "react";

export const PHONE_VERIFY_EVENT = "phone-verify:open";

/** Asks the mounted phone verify host to open its dialog. */
export function requestPhoneVerify() {
  window.dispatchEvent(new CustomEvent(PHONE_VERIFY_EVENT));
}

/** Calls `onOpen` for each request until unmount. The latest callback is used without resubscribing. */
export function usePhoneVerifyRequests(onOpen: () => void) {
  const latest = useRef(onOpen);
  useEffect(() => {
    latest.current = onOpen;
  });
  useEffect(() => {
    const handler = () => latest.current();
    window.addEventListener(PHONE_VERIFY_EVENT, handler);
    return () => window.removeEventListener(PHONE_VERIFY_EVENT, handler);
  }, []);
}
