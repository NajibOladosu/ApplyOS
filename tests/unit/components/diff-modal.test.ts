import { describe, expect, it } from "vitest"
import { escapeMarkdownTableCell } from "@/modules/applications/components/editor/diff-modal"

describe("escapeMarkdownTableCell", () => {
    it("escapes backslashes and pipes in report table cells", () => {
        expect(escapeMarkdownTableCell("Node\\API | TypeScript")).toBe("Node\\\\API \\| TypeScript")
    })
})
