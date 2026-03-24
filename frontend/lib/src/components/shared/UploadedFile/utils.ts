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

import { useEffect, useMemo } from "react"

import { EmotionIcon } from "@emotion-icons/emotion-icon"
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

// ── File extension helpers ──────────────────────────────────────────

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
  "bmp",
])

const PDF_EXTENSIONS = new Set(["pdf"])

const SPREADSHEET_EXTENSIONS = new Set(["csv", "tsv", "xlsx", "xls"])

const TEXT_EXTENSIONS = new Set(["txt", "md", "json", "xml", "yaml", "yml"])

const CODE_EXTENSIONS = new Set([
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
])

const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "ogg", "flac", "aac"])

const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "avi", "mkv", "wmv"])

const ARCHIVE_EXTENSIONS = new Set(["zip", "tar", "gz", "rar", "7z", "bz2"])

/** Extracts the file extension from a filename (case-insensitive). */
export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf(".")
  if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
    return ""
  }
  return filename.slice(lastDotIndex + 1).toLowerCase()
}

/**
 * Returns the appropriate icon component for a given filename based on its extension.
 *
 * @param filename - The name of the file (e.g., "document.pdf")
 * @returns The Material icon component to display for this file type
 */
export function getFileTypeIcon(filename: string): EmotionIcon {
  const extension = getFileExtension(filename)

  if (IMAGE_EXTENSIONS.has(extension)) {
    return Image
  }
  if (PDF_EXTENSIONS.has(extension)) {
    return Article
  }
  if (SPREADSHEET_EXTENSIONS.has(extension)) {
    return TableChart
  }
  if (TEXT_EXTENSIONS.has(extension)) {
    return Description
  }
  if (CODE_EXTENSIONS.has(extension)) {
    return Code
  }
  if (AUDIO_EXTENSIONS.has(extension)) {
    return MusicNote
  }
  if (VIDEO_EXTENSIONS.has(extension)) {
    return Videocam
  }
  if (ARCHIVE_EXTENSIONS.has(extension)) {
    return Folder
  }

  return InsertDriveFile
}

/** Checks if a filename corresponds to an image file based on its extension. */
export function isImageFile(filename: string): boolean {
  const extension = getFileExtension(filename)
  return IMAGE_EXTENSIONS.has(extension)
}

// ── Filename truncation ─────────────────────────────────────────────

const DEFAULT_MAX_LENGTH = 20

/**
 * Truncates a filename using middle truncation, preserving the file extension.
 *
 * @param filename - The filename to truncate
 * @param maxLength - Maximum length of the result (default: 20)
 *
 * @example
 * truncateFilename("very-long-filename.pdf") // "very-...me.pdf"
 * truncateFilename("short.txt") // "short.txt"
 */
export function truncateFilename(
  filename: string,
  maxLength = DEFAULT_MAX_LENGTH
): string {
  if (filename.length <= maxLength) {
    return filename
  }

  const lastDotIndex = filename.lastIndexOf(".")
  const hasExtension = lastDotIndex > 0 && lastDotIndex < filename.length - 1

  if (!hasExtension) {
    const half = Math.floor((maxLength - 3) / 2)
    const endPart = half > 0 ? filename.slice(-half) : ""
    return `${filename.slice(0, half)}...${endPart}`
  }

  const extension = filename.slice(lastDotIndex)
  const name = filename.slice(0, lastDotIndex)

  const availableForName = maxLength - extension.length - 3 // 3 for "..."

  if (availableForName <= 0) {
    const half = Math.floor((maxLength - 3) / 2)
    const endPart = half > 0 ? filename.slice(-half) : ""
    return `${filename.slice(0, half)}...${endPart}`
  }

  const startLength = Math.ceil(availableForName / 2)
  const endLength = Math.floor(availableForName / 2)

  const endPart = endLength > 0 ? name.slice(-endLength) : ""
  return `${name.slice(0, startLength)}...${endPart}${extension}`
}

// ── Image preview hook ──────────────────────────────────────────────

/**
 * Hook to create and manage a blob URL for image file previews.
 *
 * @param file - The File object to create a preview for (optional)
 * @param filename - The filename to check if it's an image
 * @returns The blob URL string if the file is an image, null otherwise
 */
export function useImagePreview(
  file: File | undefined,
  filename: string
): string | null {
  const previewUrl = useMemo(() => {
    if (!file || !isImageFile(filename)) {
      return null
    }
    return URL.createObjectURL(file)
  }, [file, filename])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  return previewUrl
}
