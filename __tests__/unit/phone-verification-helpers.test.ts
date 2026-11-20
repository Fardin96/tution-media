import { describe, expect, it } from "vitest";
import { parseNewPhone, verifiedAtFor } from "@/lib/phone-verification";

const CHECKED = {
  phoneNumber: "+8801712345678",
  verifiedAt: "2026-11-20T10:00:00.000Z",
};
const HELD = {
  phoneNumber: "+8801812345678",
  verifiedAt: "2026-11-20T09:00:00.000Z",
};

describe("verifiedAtFor (wizard seeding)", () => {
  it("is null without a number", () => {
    expect(verifiedAtFor(null, CHECKED, HELD)).toBeNull();
  });

  it("uses the check made in this session for the same number", () => {
    expect(verifiedAtFor(CHECKED.phoneNumber, CHECKED, HELD)).toBe(
      CHECKED.verifiedAt,
    );
  });

  it("seeds from the server's pending verification after a reload", () => {
    expect(verifiedAtFor(HELD.phoneNumber, null, HELD)).toBe(HELD.verifiedAt);
  });

  it("ignores a verification for a different number", () => {
    expect(verifiedAtFor("+8801612345678", CHECKED, HELD)).toBeNull();
  });

  it("prefers the session check when both match", () => {
    const same = { ...HELD, phoneNumber: CHECKED.phoneNumber };
    expect(verifiedAtFor(CHECKED.phoneNumber, CHECKED, same)).toBe(
      CHECKED.verifiedAt,
    );
  });

  it("skips a non-matching first source and uses the next", () => {
    expect(verifiedAtFor(HELD.phoneNumber, CHECKED, HELD)).toBe(
      HELD.verifiedAt,
    );
  });
});

describe("parseNewPhone (dashboard number entry)", () => {
  it.each([
    ["01712345678", "+8801712345678"],
    ["+8801712345678", "+8801712345678"],
    ["8801712345678", "+8801712345678"],
    ["+880 1712-345678", "+8801712345678"],
    ["  01912345678  ", "+8801912345678"],
  ])("accepts %s", (input, phoneNumber) => {
    expect(parseNewPhone(input)).toEqual({ phoneNumber });
  });

  it.each([
    "",
    "12345",
    "01012345678",
    "01212345678",
    "+14155550123",
    "0171234567",
    "017123456789",
  ])("rejects %j with the inline message", (input) => {
    expect(parseNewPhone(input)).toEqual({
      error: "Enter a Bangladeshi mobile number",
    });
  });
});
