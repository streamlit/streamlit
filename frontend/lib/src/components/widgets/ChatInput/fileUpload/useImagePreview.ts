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

import { useEffect, useMemo, useRef } from "react"

import { isImageFile } from "./getFileTypeIcon"

/**
 * Hook to create and manage a blob URL for image file previews.
 *
 * Uses useMemo for synchronous URL creation during render, with useEffect
 * solely for cleanup. A counter ref forces useMemo to create a fresh URL
 * after Strict Mode cleanup revokes the previous one.
 *
 * @param file - The File object to create a preview for (optional)
 * @param filename - The filename to check if it's an image
 * @returns The blob URL string if the file is an image, null otherwise
 */
export function useImagePreview(
  file: File | undefined,
  filename: string
): string | null {
  // Counter to force useMemo recalculation after cleanup revokes the URL.
  // This handles React 18 Strict Mode's double-invocation behavior.
  const revocationCounterRef = useRef(0)

  const previewUrl = useMemo(() => {
    if (!file || !isImageFile(filename)) {
      return null
    }
    return URL.createObjectURL(file)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revocationCounterRef.current forces recalc after cleanup
  }, [file, filename, revocationCounterRef.current])

  // Effect solely for cleanup - revoke the blob URL on unmount or dependency change
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        // Increment counter to force useMemo to create a new URL on next render
        revocationCounterRef.current += 1
      }
    }
  }, [previewUrl])

  return previewUrl
}
