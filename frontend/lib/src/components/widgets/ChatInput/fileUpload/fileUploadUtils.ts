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

import { assertNever } from "~lib/util/assertNever"
import { AcceptFileValue } from "~lib/util/utils"

/**
 * Configures input props for file upload based on the accept file type.
 * Handles special attributes needed for directory uploads.
 */
export const configureFileInputProps = (
  inputProps: Record<string, unknown>,
  acceptFile: AcceptFileValue
): Record<string, unknown> => {
  // Apply webkitdirectory attribute for directory uploads
  if (acceptFile === AcceptFileValue.Directory) {
    return {
      ...inputProps,
      webkitdirectory: "",
      multiple: true,
    }
  }
  return inputProps
}

/**
 * Check if a type specifier is a MIME type (contains "/").
 * Examples: "image/*", "image/jpeg", "application/pdf"
 */
const isMimeType = (type: string): boolean => type.includes("/")

/**
 * Check if a file's MIME type matches a given MIME type specifier.
 * Handles wildcards like "image/*" matching "image/jpeg".
 */
const matchesMimeType = (
  fileMimeType: string,
  allowedMime: string
): boolean => {
  if (!fileMimeType) {
    return false
  }

  const fileMimeLower = fileMimeType.toLowerCase()
  const allowedLower = allowedMime.toLowerCase()

  // Handle wildcards like "image/*"
  if (allowedLower.endsWith("/*")) {
    const category = allowedLower.slice(0, -2) // Remove "/*"
    return fileMimeLower.startsWith(category + "/")
  }

  // Exact MIME type match
  return fileMimeLower === allowedLower
}

/**
 * Checks if a file type is allowed based on the accepted types.
 *
 * Supports:
 * - MIME types: "image/jpeg", "application/pdf"
 * - MIME wildcards: "image/*", "audio/*"
 * - Extensions: ".jpg", "pdf"
 */
export const isFileTypeAllowed = (
  file: File,
  acceptedTypes?: string[]
): boolean => {
  // If no types are specified, allow all files
  if (!acceptedTypes || acceptedTypes.length === 0) {
    return true
  }

  // Separate MIME types and extensions
  const mimeTypes = acceptedTypes.filter(isMimeType)
  const extensions = acceptedTypes.filter(t => !isMimeType(t))

  // Check MIME types first (more reliable than extensions for browser files)
  if (mimeTypes.length > 0 && file.type) {
    const matchesMime = mimeTypes.some(mime =>
      matchesMimeType(file.type, mime)
    )
    if (matchesMime) {
      return true
    }
  }

  // Check extensions
  if (extensions.length > 0) {
    // Extract the actual file extension (after the last dot)
    const fileName = file.name.toLowerCase()
    const lastDotIndex = fileName.lastIndexOf(".")

    // If there's no extension, check if empty extension is allowed
    if (lastDotIndex === -1 || lastDotIndex === fileName.length - 1) {
      return extensions.some(ext => ext === "" || ext === ".")
    }

    const fileExtension = fileName.substring(lastDotIndex) // includes the dot
    const fileExtWithoutDot = fileName.substring(lastDotIndex + 1) // without the dot

    // Check if the file extension matches any of the accepted extensions
    const matchesExt = extensions.some(ext => {
      const extLower = ext.toLowerCase()
      // Handle both formats: with dot (e.g., ".txt") and without (e.g., "txt")
      if (extLower.startsWith(".")) {
        return fileExtension === extLower
      }
      return fileExtWithoutDot === extLower
    })
    if (matchesExt) {
      return true
    }
  }

  return false
}

/**
 * Validates a file against allowed types and returns rejection info if invalid.
 * This is the shared validation logic used by both regular uploads and directory uploads.
 */
export const validateFileType = (
  file: File,
  allowedTypes: string[]
): { isValid: boolean; errorMessage?: string } => {
  if (isFileTypeAllowed(file, allowedTypes)) {
    return { isValid: true }
  }

  return {
    isValid: false,
    errorMessage: `${file.type || "This type of"} files are not allowed.`,
  }
}

/**
 * Gets a human-readable description for the upload type.
 */
export const getUploadDescription = (acceptFile: AcceptFileValue): string => {
  switch (acceptFile) {
    case AcceptFileValue.None:
      return "a file"
    case AcceptFileValue.Single:
      return "a file"
    case AcceptFileValue.Multiple:
      return "files"
    case AcceptFileValue.Directory:
      return "a directory"
    default:
      assertNever(acceptFile)
      return "a file"
  }
}
