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

/**
 * File type categories with their associated extensions
 */
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

/**
 * Extracts the file extension from a filename (case-insensitive).
 */
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

  // Default fallback for unknown file types
  return InsertDriveFile
}

/**
 * Checks if a filename corresponds to an image file based on its extension.
 */
export function isImageFile(filename: string): boolean {
  const extension = getFileExtension(filename)
  return IMAGE_EXTENSIONS.has(extension)
}
