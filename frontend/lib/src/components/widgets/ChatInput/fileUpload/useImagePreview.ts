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

import { isImageFile } from "./getFileTypeIcon"

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
  // Derive the preview URL during render - createObjectURL is synchronous
  const previewUrl = useMemo(() => {
    if (!file || !isImageFile(filename)) {
      return null
    }
    return URL.createObjectURL(file)
  }, [file, filename])

  // Effect only for cleanup - revoke the blob URL when it changes or unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  return previewUrl
}
