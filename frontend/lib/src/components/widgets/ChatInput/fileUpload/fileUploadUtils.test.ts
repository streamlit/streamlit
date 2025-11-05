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

import { createTestFile } from "~lib/test_util"
import { AcceptImageValue } from "~lib/util/utils"

import {
  configureFileInputProps,
  getUploadDescription,
  isFileTypeAllowed,
  validateFileType,
} from "./fileUploadUtils"

describe("fileUploadUtils", () => {
  describe("isFileTypeAllowed", () => {
    it("allows all files when no extensions are specified", () => {
      const file = createTestFile("test.txt")
      expect(isFileTypeAllowed(file, undefined)).toBe(true)
      expect(isFileTypeAllowed(file, [])).toBe(true)
    })

    it("correctly matches file extensions with dot", () => {
      const txtFile = createTestFile("document.txt")
      expect(isFileTypeAllowed(txtFile, [".txt"])).toBe(true)
      expect(isFileTypeAllowed(txtFile, [".pdf"])).toBe(false)
      expect(isFileTypeAllowed(txtFile, [".txt", ".pdf"])).toBe(true)
    })

    it("correctly matches file extensions without dot", () => {
      const txtFile = createTestFile("document.txt")
      expect(isFileTypeAllowed(txtFile, ["txt"])).toBe(true)
      expect(isFileTypeAllowed(txtFile, ["pdf"])).toBe(false)
      expect(isFileTypeAllowed(txtFile, ["txt", "pdf"])).toBe(true)
    })

    it("handles mixed format extensions", () => {
      const txtFile = createTestFile("document.txt")
      expect(isFileTypeAllowed(txtFile, [".txt", "pdf"])).toBe(true)
      expect(isFileTypeAllowed(txtFile, ["txt", ".pdf"])).toBe(true)
    })

    it("is case insensitive", () => {
      const file = createTestFile("Document.TXT")
      expect(isFileTypeAllowed(file, [".txt"])).toBe(true)
      expect(isFileTypeAllowed(file, ["txt"])).toBe(true)
      expect(isFileTypeAllowed(file, [".TXT"])).toBe(true)
      expect(isFileTypeAllowed(file, ["TXT"])).toBe(true)
    })

    it("does not match partial extensions (avoids false positives)", () => {
      // File with compound extension should not match partial extension
      const backupFile = createTestFile(
        "test.txt.backup",
        "content",
        "text/plain"
      )
      expect(isFileTypeAllowed(backupFile, [".txt"])).toBe(false)
      expect(isFileTypeAllowed(backupFile, ["txt"])).toBe(false)
      expect(isFileTypeAllowed(backupFile, [".backup"])).toBe(true)
      expect(isFileTypeAllowed(backupFile, ["backup"])).toBe(true)
    })

    it("handles files with multiple dots correctly", () => {
      const file = createTestFile("my.document.v2.pdf")
      expect(isFileTypeAllowed(file, [".pdf"])).toBe(true)
      expect(isFileTypeAllowed(file, ["pdf"])).toBe(true)
      expect(isFileTypeAllowed(file, [".v2"])).toBe(false)
      expect(isFileTypeAllowed(file, ["v2"])).toBe(false)
    })

    it("handles files without extensions", () => {
      const file = createTestFile("README", "content", "text/plain")
      expect(isFileTypeAllowed(file, [".txt"])).toBe(false)
      expect(isFileTypeAllowed(file, ["txt"])).toBe(false)
      expect(isFileTypeAllowed(file, [""])).toBe(true)
      expect(isFileTypeAllowed(file, ["."])).toBe(true)
    })

    it("handles files ending with a dot", () => {
      const file = createTestFile("test.", "content", "text/plain")
      expect(isFileTypeAllowed(file, [".txt"])).toBe(false)
      expect(isFileTypeAllowed(file, [""])).toBe(true)
      expect(isFileTypeAllowed(file, ["."])).toBe(true)
    })
  })

  describe("validateFileType", () => {
    it("returns valid for allowed file types", () => {
      const file = createTestFile("test.txt")
      const result = validateFileType(file, ["txt"])
      expect(result.isValid).toBe(true)
      expect(result.errorMessage).toBeUndefined()
    })

    it("returns error for disallowed file types", () => {
      const file = createTestFile("test.exe")
      const result = validateFileType(file, ["txt", "pdf"])
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toContain("files are not allowed")
    })

    it("returns valid when no restrictions", () => {
      const file = createTestFile("test.anything")
      const result = validateFileType(file, [])
      expect(result.isValid).toBe(true)
    })
  })

  describe("getUploadDescription", () => {
    it("returns correct description for single image", () => {
      expect(getUploadDescription(AcceptImageValue.Single)).toBe("an image")
    })

    it("returns correct description for multiple images", () => {
      expect(getUploadDescription(AcceptImageValue.Multiple)).toBe("images")
    })

    it("returns correct description for directory", () => {
      expect(getUploadDescription(AcceptImageValue.Directory)).toBe(
        "a directory"
      )
    })

    it("returns correct description for none", () => {
      expect(getUploadDescription(AcceptImageValue.None)).toBe("an image")
    })
  })

  describe("configureFileInputProps", () => {
    it("adds webkitdirectory for directory uploads", () => {
      const inputProps = { accept: ".txt" }
      const result = configureFileInputProps(
        inputProps,
        AcceptImageValue.Directory
      )
      expect(result.webkitdirectory).toBe("")
      expect(result.multiple).toBe(true)
      expect(result.accept).toBe(".txt")
    })

    it("preserves original props for non-directory uploads", () => {
      const inputProps = { accept: ".pdf", multiple: false }
      const result = configureFileInputProps(
        inputProps,
        AcceptImageValue.Single
      )
      expect(result).toEqual(inputProps)
      expect(result.webkitdirectory).toBeUndefined()
    })

    it("preserves original props for multiple image uploads", () => {
      const inputProps = { accept: ".jpg,.png", multiple: true }
      const result = configureFileInputProps(
        inputProps,
        AcceptImageValue.Multiple
      )
      expect(result).toEqual(inputProps)
      expect(result.webkitdirectory).toBeUndefined()
    })
  })
})
