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
import { isFileTypeAllowed } from "~lib/util/FileHelper"
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
