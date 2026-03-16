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

import { describe, expect, it } from "vitest"

import { createTestFile } from "~lib/test_util"
import { isFileTypeAllowed } from "~lib/util/FileHelper"
import { AcceptFileValue } from "~lib/util/utils"

import {
  configureFileInputProps,
  getUploadDescription,
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

    // MIME type tests
    it("correctly matches exact MIME types", () => {
      const jpegFile = createTestFile("photo.jpg", "content", "image/jpeg")
      expect(isFileTypeAllowed(jpegFile, ["image/jpeg"])).toBe(true)
      expect(isFileTypeAllowed(jpegFile, ["image/png"])).toBe(false)
      expect(isFileTypeAllowed(jpegFile, ["image/jpeg", "image/png"])).toBe(
        true
      )
    })

    it("correctly matches MIME type wildcards", () => {
      const jpegFile = createTestFile("photo.jpg", "content", "image/jpeg")
      const pngFile = createTestFile("photo.png", "content", "image/png")
      const audioFile = createTestFile("song.mp3", "content", "audio/mpeg")

      expect(isFileTypeAllowed(jpegFile, ["image/*"])).toBe(true)
      expect(isFileTypeAllowed(pngFile, ["image/*"])).toBe(true)
      expect(isFileTypeAllowed(audioFile, ["image/*"])).toBe(false)
      expect(isFileTypeAllowed(audioFile, ["audio/*"])).toBe(true)
    })

    it("handles mixed MIME types and extensions", () => {
      const jpegFile = createTestFile("photo.jpg", "content", "image/jpeg")
      const jsonFile = createTestFile(
        "data.json",
        "content",
        "application/json"
      )

      // MIME type matches
      expect(isFileTypeAllowed(jpegFile, ["image/*", ".json"])).toBe(true)
      // Extension matches
      expect(isFileTypeAllowed(jsonFile, ["image/*", ".json"])).toBe(true)
    })

    it("is case insensitive for MIME types", () => {
      const jpegFile = createTestFile("photo.jpg", "content", "image/jpeg")
      expect(isFileTypeAllowed(jpegFile, ["IMAGE/JPEG"])).toBe(true)
      expect(isFileTypeAllowed(jpegFile, ["Image/Jpeg"])).toBe(true)
      expect(isFileTypeAllowed(jpegFile, ["IMAGE/*"])).toBe(true)
    })

    it("rejects files with non-matching MIME type when only MIME types specified", () => {
      // File has application/octet-stream MIME type (default for unknown extensions)
      const file = createTestFile("unknown.xyz")
      // Doesn't match image/* so should be rejected
      expect(isFileTypeAllowed(file, ["image/*"])).toBe(false)
    })

    it("validates extension when MIME not available but extensions specified", () => {
      const pngFile = createTestFile("image.png", "content", "")
      const txtFile = createTestFile("doc.txt", "content", "")
      expect(isFileTypeAllowed(pngFile, [".png"])).toBe(true)
      expect(isFileTypeAllowed(txtFile, [".png"])).toBe(false)
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
    it.each([
      [AcceptFileValue.Single, "a file"],
      [AcceptFileValue.Multiple, "files"],
      [AcceptFileValue.Directory, "a directory"],
      [AcceptFileValue.None, "a file"],
    ])("returns correct description for %s", (acceptFile, expected) => {
      expect(getUploadDescription(acceptFile)).toBe(expected)
    })
  })

  describe("configureFileInputProps", () => {
    it("adds webkitdirectory for directory uploads", () => {
      const inputProps = { accept: ".txt" }
      const result = configureFileInputProps(
        inputProps,
        AcceptFileValue.Directory
      )
      expect(result.webkitdirectory).toBe("")
      expect(result.multiple).toBe(true)
      expect(result.accept).toBe(".txt")
    })

    it("preserves original props for non-directory uploads", () => {
      const inputProps = { accept: ".pdf", multiple: false }
      const result = configureFileInputProps(
        inputProps,
        AcceptFileValue.Single
      )
      expect(result).toEqual(inputProps)
      expect(result.webkitdirectory).toBeUndefined()
    })

    it("preserves original props for multiple file uploads", () => {
      const inputProps = { accept: ".jpg,.png", multiple: true }
      const result = configureFileInputProps(
        inputProps,
        AcceptFileValue.Multiple
      )
      expect(result).toEqual(inputProps)
      expect(result.webkitdirectory).toBeUndefined()
    })
  })
})
