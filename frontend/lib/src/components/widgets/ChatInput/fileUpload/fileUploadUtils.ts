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

import { AcceptFileValue, AcceptImageValue } from "~lib/util/utils"

/**
 * Configures input props for file upload based on the accept file type.
 * Handles special attributes needed for directory uploads.
 */
export const configureFileInputProps = (
  inputProps: Record<string, unknown>,
  acceptType: AcceptImageValue | AcceptFileValue
): Record<string, unknown> => {
  // Apply webkitdirectory attribute for directory uploads
  if (
    acceptType === AcceptImageValue.Directory ||
    acceptType === AcceptFileValue.Directory
  ) {
    return {
      ...inputProps,
      webkitdirectory: "",
      multiple: true,
    }
  }
  return inputProps
}

/**
 * Checks if a file type is allowed based on the accepted extensions.
 */
export const isFileTypeAllowed = (
  file: File,
  acceptedExtensions?: string[]
): boolean => {
  // If no extensions are specified, allow all files
  if (!acceptedExtensions || acceptedExtensions.length === 0) {
    return true
  }

  // Extract the actual file extension (after the last dot)
  const fileName = file.name.toLowerCase()
  const lastDotIndex = fileName.lastIndexOf(".")

  // If there's no extension, check if empty extension is allowed
  if (lastDotIndex === -1 || lastDotIndex === fileName.length - 1) {
    return acceptedExtensions.some(ext => ext === "" || ext === ".")
  }

  const fileExtension = fileName.substring(lastDotIndex) // includes the dot
  const fileExtWithoutDot = fileName.substring(lastDotIndex + 1) // without the dot

  // Check if the file extension matches any of the accepted extensions
  return acceptedExtensions.some(ext => {
    const extLower = ext.toLowerCase()
    // Handle both formats: with dot (e.g., ".txt") and without (e.g., "txt")
    if (extLower.startsWith(".")) {
      return fileExtension === extLower
    }
    return fileExtWithoutDot === extLower
  })
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
export const getUploadDescription = (
  acceptType: AcceptImageValue | AcceptFileValue
): string => {
  // Handle AcceptImageValue cases
  if (
    Object.values(AcceptImageValue).includes(acceptType as AcceptImageValue)
  ) {
    switch (acceptType as AcceptImageValue) {
      case AcceptImageValue.None:
        return "an image"
      case AcceptImageValue.Single:
        return "an image"
      case AcceptImageValue.Multiple:
        return "images"
      case AcceptImageValue.Directory:
        return "a directory"
      default:
        return "an image"
    }
  }

  // Handle AcceptFileValue cases
  switch (acceptType as AcceptFileValue) {
    case AcceptFileValue.None:
      return "a file"
    case AcceptFileValue.Single:
      return "a file"
    case AcceptFileValue.Multiple:
      return "files"
    case AcceptFileValue.Directory:
      return "a directory"
    default:
      return "a file"
  }
}
