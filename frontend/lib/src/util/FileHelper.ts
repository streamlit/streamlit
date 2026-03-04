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

import { type FileRejection } from "react-dropzone"

import { UploadFileInfo } from "~lib/components/widgets/FileUploader/UploadFileInfo"
import { isFromWindows } from "~lib/util/utils"

export enum FileSize {
  Gigabyte = "gb",
  Megabyte = "mb",
  Kilobyte = "kb",
  Byte = "b",
}

// There is a shift towards displaying storage in base 10 vs base 2
// but Windows is still displaying things in base 2. This does not handle
// all cases but for simplicity general rule is to use base 2 for Windows.
export const BYTE_CONVERSION_SIZE = isFromWindows() ? 1024 : 1000
const sizeUnitSequence = [
  FileSize.Gigabyte,
  FileSize.Megabyte,
  FileSize.Kilobyte,
  FileSize.Byte,
]

export const getSizeDisplay = (
  size: number,
  unit: FileSize,
  rounding = 1
): string => {
  if (!unit) {
    unit = FileSize.Byte
  }

  if (rounding < 0) {
    rounding = 0
  }

  if (size < 0) {
    throw new Error("Size must be greater than or equal to 0")
  }

  const sizeIndex = sizeUnitSequence.indexOf(unit)
  const nextUnitSize = size / BYTE_CONVERSION_SIZE
  if (sizeIndex && size > BYTE_CONVERSION_SIZE / 2) {
    return getSizeDisplay(
      nextUnitSize,
      sizeUnitSequence[sizeIndex - 1],
      rounding
    )
  }
  return `${size.toFixed(rounding)}${unit.toUpperCase()}`
}

export const sizeConverter = (
  size: number,
  inputUnit: FileSize,
  outputUnit: FileSize
): number => {
  if (size < 0) {
    throw Error("Size must be 0 or greater")
  }

  const inputLevel = sizeUnitSequence.findIndex(unit => unit === inputUnit)
  const outputLevel = sizeUnitSequence.findIndex(unit => unit === outputUnit)

  if (inputLevel === -1 || outputLevel === -1) {
    // Should not ever occur
    throw Error("Unexpected byte unit provided")
  }

  if (inputLevel === outputLevel) {
    return size
  }

  const levelsBetween = Math.abs(inputLevel - outputLevel)
  const byteDifference = BYTE_CONVERSION_SIZE ** levelsBetween

  if (inputLevel > outputLevel) {
    // Going from smaller to bigger
    return size / byteDifference
  }
  // Going from bigger to smaller
  return size * byteDifference
}

/**
 * Check if a type specifier is a MIME type (contains "/").
 * Examples: "image/*", "image/jpeg", "application/pdf"
 */
export const isMimeType = (type: string): boolean => type.includes("/")

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

  // Check extensions (supports multi-part extensions like .tar.gz)
  if (extensions.length > 0) {
    const fileName = file.name.toLowerCase()

    // If there's no extension (no dot or ends with dot), check if empty extension is allowed
    const lastDotIndex = fileName.lastIndexOf(".")
    if (lastDotIndex === -1 || lastDotIndex === fileName.length - 1) {
      return extensions.some(ext => ext === "" || ext === ".")
    }

    // Check if the filename ends with any of the accepted extensions
    // This handles both single extensions (.pdf) and multi-part extensions (.tar.gz)
    const matchesExt = extensions.some(ext => {
      const extLower = ext.toLowerCase()
      // Handle both formats: with dot (e.g., ".tar.gz") and without (e.g., "tar.gz")
      if (extLower.startsWith(".")) {
        return fileName.endsWith(extLower)
      }
      return fileName.endsWith("." + extLower)
    })
    if (matchesExt) {
      return true
    }
  }

  return false
}

/**
 * Format a single file type specifier for display.
 * - MIME wildcards (image/*) -> "image"
 * - MIME types (image/jpeg) -> "image/jpeg"
 * - Extensions (.jpg) -> "JPG"
 */
export const formatTypeForDisplay = (type: string): string => {
  // MIME wildcard: "image/*" -> "image"
  if (type.endsWith("/*")) {
    return type.slice(0, -2)
  }

  // MIME type: keep as is (e.g., "image/jpeg")
  if (type.includes("/")) {
    return type
  }

  // Extension: remove dot and uppercase (e.g., ".jpg" -> "JPG")
  return type.replace(/^\./, "").toUpperCase()
}

/**
 * Format a list of file type specifiers for display.
 * Returns a comma-separated string of formatted types.
 */
export const formatTypesForDisplay = (types: string[]): string =>
  types.map(formatTypeForDisplay).join(", ")

/**
 * Return a human-readable message for the given error.
 */
const getErrorMessage = (
  errorCode: string,
  file: File,
  maxUploadSizeInBytes: number
): string => {
  switch (errorCode) {
    case "file-too-large":
      return `File must be ${getSizeDisplay(
        maxUploadSizeInBytes,
        FileSize.Byte
      )} or smaller.`
    case "file-invalid-type":
      return `${file.type} files are not allowed.`
    case "file-too-small":
      // This should not fire.
      return `File size is too small.`
    case "too-many-files":
      return "Only one file is allowed."
    default:
      return "Unexpected error. Please try again."
  }
}

/**
 * Returns an `UploadFileInfo` object for a rejected file
 */
export const getRejectedFileInfo = (
  rejected: FileRejection,
  fileId: number,
  maxUploadSizeInBytes: number
): UploadFileInfo => {
  const { file, errors } = rejected

  // For directory uploads, use the relative path to preserve directory structure
  const fileName = file.webkitRelativePath || file.name

  return new UploadFileInfo(
    fileName,
    file.size,
    fileId,
    {
      type: "error",
      errorMessage: errors
        .map(error => getErrorMessage(error.code, file, maxUploadSizeInBytes))
        .join(" "),
    },
    file
  )
}
