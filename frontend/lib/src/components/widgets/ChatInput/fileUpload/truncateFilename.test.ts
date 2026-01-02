/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { describe, expect, it } from "vitest"

import { truncateFilename } from "./truncateFilename"

describe("truncateFilename", () => {
  describe("files under max length", () => {
    it("returns short filenames unchanged", () => {
      expect(truncateFilename("short.txt")).toBe("short.txt")
      expect(truncateFilename("document.pdf")).toBe("document.pdf")
    })

    it("returns filenames at exactly max length unchanged", () => {
      // 36 characters exactly (32 digits + 4 for ".pdf")
      const exactLength = "12345678901234567890123456789012.pdf"
      expect(exactLength.length).toBe(36) // verify test setup
      expect(truncateFilename(exactLength)).toBe(exactLength)
    })

    it("returns filenames without extension unchanged when short", () => {
      expect(truncateFilename("README")).toBe("README")
      expect(truncateFilename("Makefile")).toBe("Makefile")
    })
  })

  describe("files with extensions (over max length)", () => {
    it("truncates long filenames while preserving extension", () => {
      const longName = "this-is-a-very-long-filename-that-needs-truncation.pdf"
      const result = truncateFilename(longName)

      expect(result.length).toBeLessThanOrEqual(36)
      expect(result).toContain("...")
      expect(result).toMatch(/\.pdf$/)
    })

    it("preserves different extension types", () => {
      const testCases = [
        { input: "very-long-document-name-that-exceeds.docx", ext: ".docx" },
        { input: "super-long-image-filename-here-now.jpeg", ext: ".jpeg" },
        { input: "extremely-lengthy-archive-name-test.tar.gz", ext: ".gz" },
      ]

      testCases.forEach(({ input, ext }) => {
        const result = truncateFilename(input)
        expect(result).toMatch(new RegExp(`${ext.replace(".", "\\.")}$`))
      })
    })

    it("uses middle truncation (keeps start and end of name)", () => {
      const result = truncateFilename(
        "abcdefghijklmnopqrstuvwxyz123456789.txt"
      )

      // Should start with beginning of filename
      expect(result.startsWith("abcdef")).toBe(true)
      // Should contain ellipsis
      expect(result).toContain("...")
      // Should end with extension
      expect(result).toMatch(/\.txt$/)
    })
  })

  describe("files without extensions", () => {
    it("truncates long filenames without extension using middle truncation", () => {
      const longName = "this-is-a-very-long-filename-without-any-extension"
      const result = truncateFilename(longName)

      expect(result.length).toBeLessThanOrEqual(36)
      expect(result).toContain("...")
      // Should have content from both start and end
      expect(result.startsWith("this-is-a")).toBe(true)
      expect(result.endsWith("extension")).toBe(true)
    })

    it("handles files ending with dot as no extension", () => {
      const withDot = "some-very-long-filename-ending-with-dot."
      const result = truncateFilename(withDot)

      expect(result.length).toBeLessThanOrEqual(36)
      expect(result).toContain("...")
    })
  })

  describe("files with very long extensions", () => {
    it("handles extensions longer than available space", () => {
      // Extension so long it exceeds normal allocation (40+ chars total)
      const longExt = "myfile.verylongextensionnamethatexceedslimit"
      const result = truncateFilename(longExt)

      // Should still truncate reasonably
      expect(result.length).toBeLessThanOrEqual(36)
      expect(result).toContain("...")
    })
  })

  describe("files with multiple dots", () => {
    it("preserves only the last extension segment", () => {
      const tarGz = "very-long-archive-name-that-is-too-long.tar.gz"
      const result = truncateFilename(tarGz)

      expect(result).toMatch(/\.gz$/)
      expect(result.length).toBeLessThanOrEqual(36)
    })

    it("handles version numbers in filenames", () => {
      const versioned = "my-application-package-version-1.2.3.4.5.dmg"
      const result = truncateFilename(versioned)

      expect(result).toMatch(/\.dmg$/)
      expect(result.length).toBeLessThanOrEqual(36)
    })
  })

  describe("edge cases", () => {
    it("handles empty string", () => {
      expect(truncateFilename("")).toBe("")
    })

    it("handles single character", () => {
      expect(truncateFilename("a")).toBe("a")
    })

    it("handles filename that is just a dot", () => {
      expect(truncateFilename(".")).toBe(".")
    })

    it("handles hidden files (starting with dot)", () => {
      expect(truncateFilename(".gitignore")).toBe(".gitignore")

      const longHidden = ".very-long-hidden-config-file-name-here"
      const result = truncateFilename(longHidden)
      expect(result.length).toBeLessThanOrEqual(36)
    })

    it("handles UUID-style filenames", () => {
      const uuid =
        "2e1de717-dc5f-4d3e-a7e5-9558f33adaca_ExportBlock-54fa9781.zip"
      const result = truncateFilename(uuid)

      expect(result.length).toBeLessThanOrEqual(36)
      expect(result).toContain("...")
      expect(result).toMatch(/\.zip$/)
    })
  })

  describe("custom max length", () => {
    it("respects custom max length parameter", () => {
      const filename = "medium-length-filename.txt"

      // With default (36), should not truncate
      expect(truncateFilename(filename)).toBe(filename)

      // With shorter max, should truncate
      const result = truncateFilename(filename, 20)
      expect(result.length).toBeLessThanOrEqual(20)
      expect(result).toContain("...")
      expect(result).toMatch(/\.txt$/)
    })

    it("handles very short max length", () => {
      const result = truncateFilename("document.pdf", 10)

      expect(result.length).toBeLessThanOrEqual(10)
      expect(result).toContain("...")

      // Edge case: maxLength that results in zero endLength (slice(-0) returns full string)
      // filename="abcdefgh.pdf" (12 chars), maxLength=8
      // extension=".pdf" (4), ellipsis (3) → availableForName = 8 - 4 - 3 = 1
      // startLength=ceil(1/2)=1, endLength=floor(1/2)=0
      // Result should be "a....pdf" (8 chars), NOT "a...abcdefgh.pdf"
      const edgeResult = truncateFilename("abcdefgh.pdf", 8)
      expect(edgeResult.length).toBeLessThanOrEqual(8)
      expect(edgeResult).not.toContain("abcdefgh")
    })
  })
})
