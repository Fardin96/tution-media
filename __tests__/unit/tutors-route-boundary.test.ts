import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// A loading.tsx at app/tutors/ would also wrap /tutors/[id] and flash the list skeleton on profile navigation.
describe("tutors route boundary", () => {
  it("has no loading.tsx at app/tutors, beside [id]", () => {
    expect(
      fs.existsSync(path.join(process.cwd(), "app/tutors/loading.tsx")),
    ).toBe(false);
  });
});
