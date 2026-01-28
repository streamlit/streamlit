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

const DEFAULT_MAX_LENGTH = 20

/**
 * Truncates a filename using middle truncation, preserving the file extension.
 *
 * @param filename - The filename to truncate
 * @param maxLength - Maximum length of the result (default: 16)
 *
 * @example
 * truncateFilename("very-long-filename.pdf") // "very-...me.pdf"
 * truncateFilename("short.txt") // "short.txt"
 * truncateFilename("long-name.txt", 20) // "long-...e.txt"
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
    // No extension: just truncate in the middle
    const half = Math.floor((maxLength - 3) / 2)
    const endPart = half > 0 ? filename.slice(-half) : ""
    return `${filename.slice(0, half)}...${endPart}`
  }

  const extension = filename.slice(lastDotIndex)
  const name = filename.slice(0, lastDotIndex)

  // Calculate available space for the name part
  const availableForName = maxLength - extension.length - 3 // 3 for "..."

  if (availableForName <= 0) {
    // Extension is too long, just do simple truncation
    const half = Math.floor((maxLength - 3) / 2)
    const endPart = half > 0 ? filename.slice(-half) : ""
    return `${filename.slice(0, half)}...${endPart}`
  }

  const startLength = Math.ceil(availableForName / 2)
  const endLength = Math.floor(availableForName / 2)

  const endPart = endLength > 0 ? name.slice(-endLength) : ""
  return `${name.slice(0, startLength)}...${endPart}${extension}`
}
