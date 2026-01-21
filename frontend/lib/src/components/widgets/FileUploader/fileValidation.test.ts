/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import {
  FileValidationError,
  filterDuplicateFiles,
  getFileKey,
  getValidationErrorMessage,
  validateFileNotEmpty,
  validateFileReadable,
  validateFiles,
} from "./fileValidation"

const createMockFile = (
  name: string,
  size: number,
  type = "text/plain",
  webkitRelativePath?: string
): File => {
  // Create a real File with actual content matching the size
  const content = size > 0 ? new Array(size).fill("x").join("") : ""
  const file = new File([content], name, { type })

  // Mock size if needed (for zero-size testing)
  if (size === 0 && content.length > 0) {
    Object.defineProperty(file, "size", { value: 0, writable: false })
  }

  if (webkitRelativePath) {
    Object.defineProperty(file, "webkitRelativePath", {
      value: webkitRelativePath,
      writable: false,
    })
  }

  return file
}

describe("fileValidation", () => {
  describe("validateFileNotEmpty", () => {
    it("returns valid for non-empty file", () => {
      const file = createMockFile("test.txt", 100)
      const result = validateFileNotEmpty(file)
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it("returns invalid for zero-size file", () => {
      const file = new File([], "empty.txt", { type: "text/plain" })
      const result = validateFileNotEmpty(file)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe(FileValidationError.ZERO_SIZE)
    })
  })

  describe("validateFileReadable", () => {
    it("returns valid for readable file", async () => {
      const file = createMockFile("test.txt", 100)
      const result = await validateFileReadable(file)
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it("returns valid for empty file (skipped)", async () => {
      const file = new File([], "empty.txt", { type: "text/plain" })
      const result = await validateFileReadable(file)
      // Empty files are skipped by validateFileReadable
      expect(result.isValid).toBe(true)
    })

    it("handles read timeout gracefully", async () => {
      const file = createMockFile("test.txt", 100)

      // Mock FileReader to simulate timeout (never fires onload or onerror)
      const originalFileReader = window.FileReader
      class MockFileReader {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        readAsArrayBuffer = vi.fn() // Does nothing, so timeout triggers
      }
      window.FileReader = MockFileReader as unknown as typeof FileReader

      const result = await validateFileReadable(file, 50) // 50ms timeout

      // Restore original FileReader
      window.FileReader = originalFileReader

      expect(result.isValid).toBe(false)
      expect(result.error).toBe(FileValidationError.READ_ERROR)
    })
  })

  describe("getFileKey", () => {
    it("creates key from name and size", () => {
      const file = createMockFile("test.txt", 100, "text/plain")
      const key = getFileKey(file)
      expect(key).toBe("test.txt:100:text/plain")
    })

    it("uses webkitRelativePath when available", () => {
      const file = createMockFile(
        "test.txt",
        100,
        "text/plain",
        "folder/test.txt"
      )
      const key = getFileKey(file)
      expect(key).toBe("folder/test.txt:100:text/plain")
    })

    it("handles unknown type", () => {
      const file = createMockFile("test.bin", 100, "")
      const key = getFileKey(file)
      expect(key).toContain("unknown")
    })
  })

  describe("filterDuplicateFiles", () => {
    it("returns all files when no duplicates", () => {
      const files = [
        createMockFile("file1.txt", 100),
        createMockFile("file2.txt", 200),
        createMockFile("file3.txt", 300),
      ]
      const result = filterDuplicateFiles(files)
      expect(result.unique).toHaveLength(3)
      expect(result.duplicates).toHaveLength(0)
    })

    it("filters out duplicate files by name and size", () => {
      const files = [
        createMockFile("file1.txt", 100),
        createMockFile("file1.txt", 100), // duplicate
        createMockFile("file2.txt", 200),
      ]
      const result = filterDuplicateFiles(files)
      expect(result.unique).toHaveLength(2)
      expect(result.duplicates).toHaveLength(1)
      expect(result.duplicates[0].name).toBe("file1.txt")
    })

    it("considers different sizes as unique", () => {
      const files = [
        createMockFile("file.txt", 100),
        createMockFile("file.txt", 200), // different size
      ]
      const result = filterDuplicateFiles(files)
      expect(result.unique).toHaveLength(2)
      expect(result.duplicates).toHaveLength(0)
    })

    it("handles empty array", () => {
      const result = filterDuplicateFiles([])
      expect(result.unique).toHaveLength(0)
      expect(result.duplicates).toHaveLength(0)
    })
  })

  describe("validateFiles", () => {
    it("returns all valid files when no issues", () => {
      const files = [
        createMockFile("file1.txt", 100),
        createMockFile("file2.txt", 200),
      ]
      const result = validateFiles(files)
      expect(result.valid).toHaveLength(2)
      expect(result.invalid).toHaveLength(0)
      expect(result.duplicates).toHaveLength(0)
    })

    it("detects zero-size files", () => {
      const files = [
        createMockFile("good.txt", 100),
        new File([], "empty.txt", { type: "text/plain" }),
      ]
      const result = validateFiles(files)
      expect(result.valid).toHaveLength(1)
      expect(result.valid[0].name).toBe("good.txt")
      expect(result.invalid).toHaveLength(1)
      expect(result.invalid[0].file.name).toBe("empty.txt")
      expect(result.invalid[0].error).toBe(FileValidationError.ZERO_SIZE)
    })

    it("detects duplicates and zero-size files together", () => {
      const files = [
        createMockFile("file1.txt", 100),
        createMockFile("file1.txt", 100), // duplicate
        new File([], "empty.txt", { type: "text/plain" }), // zero-size
      ]
      const result = validateFiles(files)
      expect(result.valid).toHaveLength(1)
      expect(result.duplicates).toHaveLength(1)
      expect(result.invalid).toHaveLength(1)
    })
  })

  describe("getValidationErrorMessage", () => {
    it("returns correct message for zero-size error", () => {
      const message = getValidationErrorMessage(FileValidationError.ZERO_SIZE)
      expect(message).toContain("empty")
      expect(message).toContain("file picker")
    })

    it("returns correct message for read error", () => {
      const message = getValidationErrorMessage(FileValidationError.READ_ERROR)
      expect(message).toContain("Could not read")
    })

    it("returns correct message for duplicate", () => {
      const message = getValidationErrorMessage(FileValidationError.DUPLICATE)
      expect(message).toContain("Duplicate")
    })
  })
})
