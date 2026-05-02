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

import { Accept } from "react-dropzone"

import { isMimeType } from "~lib/util/FileHelper"

/**
 * Custom MIME type for file extensions that don't have a standard MIME type mapping.
 * This acts as a fallback to allow any file with matching extensions.
 */
export const STREAMLIT_MIME_TYPE = "application/streamlit"

/**
 * Build the accept configuration for react-dropzone from a list of file types.
 *
 * Accepts:
 * - MIME types: "image/jpeg", "application/pdf" (used as accept keys)
 * - MIME wildcards: "image/*", "audio/*" (used as accept keys)
 * - Extensions: ".jpg", ".pdf" (grouped under fallback MIME type)
 *
 * Returns undefined if no types are specified (accept all files).
 */
export function getAccept(acceptedTypes: string[]): Accept | undefined {
  if (!acceptedTypes.length) {
    return undefined
  }

  const accept: Accept = {}
  const extensions: string[] = []

  for (const type of acceptedTypes) {
    if (isMimeType(type)) {
      // MIME types and wildcards are used directly as accept keys.
      // react-dropzone uses these to filter the file picker.
      accept[type] = []
    } else {
      // Extensions are collected and grouped under the fallback MIME type.
      extensions.push(type)
    }
  }

  // Add extensions under the fallback MIME type if any exist
  if (extensions.length > 0) {
    accept[STREAMLIT_MIME_TYPE] = extensions
  }

  return accept
}
