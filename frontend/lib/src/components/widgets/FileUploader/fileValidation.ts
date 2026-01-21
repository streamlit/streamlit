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

/**
 * Utilities for validating files before upload, particularly for detecting
 * Android picker issues where files may be returned but not readable.
 */

export interface FileValidationResult {
  file: File
  isValid: boolean
  error?: string
}

/**
 * Error code constants for file validation errors.
 */
export const FileValidationError = {
  ZERO_SIZE: "file-zero-size",
  READ_ERROR: "file-read-error",
  DUPLICATE: "file-duplicate",
} as const

export type FileValidationErrorCode =
  (typeof FileValidationError)[keyof typeof FileValidationError]

/**
 * Check if a file has zero size, which may indicate an Android picker issue
 * where the file was selected but cannot be read.
 */
export function validateFileNotEmpty(file: File): FileValidationResult {
  if (file.size === 0) {
    return {
      file,
      isValid: false,
      error: FileValidationError.ZERO_SIZE,
    }
  }
  return { file, isValid: true }
}

/**
 * Attempt to read the first few bytes of a file to verify it's actually readable.
 * This helps detect Android picker issues where a File object exists but
 * the underlying file cannot be read due to permissions or other issues.
 *
 * @param file The file to validate
 * @param timeoutMs Timeout for the read operation (default 5000ms)
 * @returns Promise that resolves to a validation result
 */
export async function validateFileReadable(
  file: File,
  timeoutMs = 5000
): Promise<FileValidationResult> {
  // Skip validation for empty files (caught by validateFileNotEmpty)
  if (file.size === 0) {
    return { file, isValid: true }
  }

  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      resolve({
        file,
        isValid: false,
        error: FileValidationError.READ_ERROR,
      })
    }, timeoutMs)

    // Try to read just the first byte to verify the file is accessible
    const slice = file.slice(0, 1)
    const reader = new FileReader()

    reader.onload = () => {
      clearTimeout(timeout)
      resolve({ file, isValid: true })
    }

    reader.onerror = () => {
      clearTimeout(timeout)
      resolve({
        file,
        isValid: false,
        error: FileValidationError.READ_ERROR,
      })
    }

    reader.readAsArrayBuffer(slice)
  })
}

/**
 * Create a unique key for a file based on name and size.
 * Used for duplicate detection.
 */
export function getFileKey(file: File): string {
  // Use webkitRelativePath if available (for directory uploads)
  const name = file.webkitRelativePath || file.name
  return `${name}:${file.size}:${file.type || "unknown"}`
}

/**
 * Filter out duplicate files from a list.
 * Returns both the unique files and the duplicates.
 */
export function filterDuplicateFiles(files: File[]): {
  unique: File[]
  duplicates: File[]
} {
  const seen = new Set<string>()
  const unique: File[] = []
  const duplicates: File[] = []

  for (const file of files) {
    const key = getFileKey(file)
    if (seen.has(key)) {
      duplicates.push(file)
    } else {
      seen.add(key)
      unique.push(file)
    }
  }

  return { unique, duplicates }
}

/**
 * Validate a batch of files for common issues.
 * This performs synchronous validation only (zero-size check, duplicate check).
 */
export function validateFiles(files: File[]): {
  valid: File[]
  invalid: Array<{ file: File; error: string }>
  duplicates: File[]
} {
  const valid: File[] = []
  const invalid: Array<{ file: File; error: string }> = []

  // First, filter duplicates
  const { unique, duplicates } = filterDuplicateFiles(files)

  // Then validate remaining files
  for (const file of unique) {
    const result = validateFileNotEmpty(file)
    if (result.isValid) {
      valid.push(file)
    } else {
      invalid.push({ file, error: result.error as string })
    }
  }

  return { valid, invalid, duplicates }
}

/**
 * Get a human-readable error message for a file validation error.
 */
export function getValidationErrorMessage(
  errorCode: FileValidationErrorCode
): string {
  switch (errorCode) {
    case FileValidationError.ZERO_SIZE:
      return "File appears to be empty or could not be read. This may be a file picker issue on your device."
    case FileValidationError.READ_ERROR:
      return "Could not read file. Please try selecting the file again or use a different file picker."
    case FileValidationError.DUPLICATE:
      return "Duplicate file ignored."
    default:
      return "Unknown file validation error."
  }
}
