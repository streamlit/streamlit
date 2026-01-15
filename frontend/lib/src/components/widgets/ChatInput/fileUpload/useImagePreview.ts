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

import { useEffect, useState } from "react"

import { isImageFile } from "./getFileTypeIcon"

/**
 * Hook to create and manage a blob URL for image file previews.
 *
 * Uses useState + useEffect to properly handle React 18 Strict Mode's
 * double-invocation behavior. Each effect invocation creates its own
 * blob URL and only revokes that specific URL on cleanup.
 *
 * Note: We disable the set-state-in-effect lint rule here because this is
 * a legitimate use case - we're synchronizing with an external system
 * (the browser's Blob URL API) that requires explicit resource management.
 * The blob URL must be created and revoked together in the same effect to
 * ensure proper cleanup in Strict Mode.
 *
 * @param file - The File object to create a preview for (optional)
 * @param filename - The filename to check if it's an image
 * @returns The blob URL string if the file is an image, null otherwise
 */
export function useImagePreview(
  file: File | undefined,
  filename: string
): string | null {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    // Don't create URL if no file or not an image
    if (!file || !isImageFile(filename)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronizing with Blob URL API; see docstring
      setPreviewUrl(null)
      return
    }

    // Create the blob URL
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)

    // Cleanup: revoke the URL when the effect re-runs or unmounts
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [file, filename])

  return previewUrl
}
