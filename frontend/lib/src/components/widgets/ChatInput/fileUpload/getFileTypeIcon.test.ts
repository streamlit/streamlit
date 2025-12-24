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

import {
  Article,
  Code,
  Description,
  Folder,
  Image,
  InsertDriveFile,
  MusicNote,
  TableChart,
  Videocam,
} from "@emotion-icons/material-outlined"
import { describe, expect, it } from "vitest"

import { getFileTypeIcon } from "./getFileTypeIcon"

describe("getFileTypeIcon", () => {
  describe("image files", () => {
    it.each(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"])(
      "returns Image icon for .%s files",
      extension => {
        expect(getFileTypeIcon(`photo.${extension}`)).toBe(Image)
      }
    )

    it("handles uppercase extensions", () => {
      expect(getFileTypeIcon("photo.JPG")).toBe(Image)
      expect(getFileTypeIcon("photo.PNG")).toBe(Image)
    })
  })

  describe("PDF files", () => {
    it("returns Article icon for .pdf files", () => {
      expect(getFileTypeIcon("document.pdf")).toBe(Article)
    })

    it("handles uppercase PDF extension", () => {
      expect(getFileTypeIcon("document.PDF")).toBe(Article)
    })
  })

  describe("spreadsheet files", () => {
    it.each(["csv", "tsv", "xlsx", "xls"])(
      "returns TableChart icon for .%s files",
      extension => {
        expect(getFileTypeIcon(`data.${extension}`)).toBe(TableChart)
      }
    )
  })

  describe("text files", () => {
    it.each(["txt", "md", "json", "xml", "yaml", "yml"])(
      "returns Description icon for .%s files",
      extension => {
        expect(getFileTypeIcon(`readme.${extension}`)).toBe(Description)
      }
    )
  })

  describe("code files", () => {
    it.each([
      "py",
      "js",
      "ts",
      "jsx",
      "tsx",
      "css",
      "html",
      "java",
      "cpp",
      "c",
      "go",
      "rs",
      "rb",
      "php",
      "swift",
      "kt",
      "scala",
      "sh",
      "bash",
      "sql",
    ])("returns Code icon for .%s files", extension => {
      expect(getFileTypeIcon(`script.${extension}`)).toBe(Code)
    })
  })

  describe("audio files", () => {
    it.each(["mp3", "wav", "m4a", "ogg", "flac", "aac"])(
      "returns MusicNote icon for .%s files",
      extension => {
        expect(getFileTypeIcon(`song.${extension}`)).toBe(MusicNote)
      }
    )
  })

  describe("video files", () => {
    it.each(["mp4", "webm", "mov", "avi", "mkv", "wmv"])(
      "returns Videocam icon for .%s files",
      extension => {
        expect(getFileTypeIcon(`movie.${extension}`)).toBe(Videocam)
      }
    )
  })

  describe("archive files", () => {
    it.each(["zip", "tar", "gz", "rar", "7z", "bz2"])(
      "returns Folder icon for .%s files",
      extension => {
        expect(getFileTypeIcon(`archive.${extension}`)).toBe(Folder)
      }
    )
  })

  describe("unknown files", () => {
    it("returns InsertDriveFile icon for unknown extensions", () => {
      expect(getFileTypeIcon("file.unknown")).toBe(InsertDriveFile)
      expect(getFileTypeIcon("file.xyz")).toBe(InsertDriveFile)
    })

    it("returns InsertDriveFile icon for files without extension", () => {
      expect(getFileTypeIcon("Makefile")).toBe(InsertDriveFile)
      expect(getFileTypeIcon("README")).toBe(InsertDriveFile)
    })

    it("returns InsertDriveFile icon for files ending with dot", () => {
      expect(getFileTypeIcon("file.")).toBe(InsertDriveFile)
    })
  })

  describe("edge cases", () => {
    it("handles files with multiple dots", () => {
      expect(getFileTypeIcon("archive.tar.gz")).toBe(Folder)
      expect(getFileTypeIcon("my.file.name.pdf")).toBe(Article)
    })

    it("handles mixed case extensions", () => {
      expect(getFileTypeIcon("Document.Pdf")).toBe(Article)
      expect(getFileTypeIcon("photo.JpEg")).toBe(Image)
    })

    it("handles directory-style paths", () => {
      expect(getFileTypeIcon("uploads/folder/document.pdf")).toBe(Article)
    })
  })
})
