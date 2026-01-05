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
 * BlobUrlManager is responsible for creating and caching Blob URLs for inline
 * JavaScript content. It provides:
 * - Content-addressed caching keyed by a 32-bit FNV-1a hash of the content
 * - Automatic addition of a //# sourceURL comment to improve stack traces
 * - A simple API that returns both the blob URL and the content hash
 *
 * Notes:
 * - Blob URLs are cached for the lifetime of the page to avoid module cache
 *   churn when the same content is re-evaluated (e.g., re-renders).
 * - Revoking Blob URLs is intentionally omitted because imported ESM modules
 *   remain cached by URL; revoking would not unload them and can cause errors
 *   if attempted while still referenced.
 */
export class BlobUrlManager {
  private readonly hashSeed = 0x811c9dc5 >>> 0
  private readonly hashPrime = 0x01000193
  private readonly cache: Map<string, string> = new Map()

  /**
   * Compute a fast, deterministic 32-bit FNV-1a hash for the provided string.
   * The result is returned as an unsigned hexadecimal string.
   */
  private computeHash(input: string): string {
    let hash = this.hashSeed

    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i)
      hash = Math.imul(hash >>> 0, this.hashPrime) >>> 0
    }

    return (hash >>> 0).toString(16)
  }

  /**
   * Return a cached Blob URL for the given JavaScript content, or create a new
   * Blob if it does not exist yet.
   *
   * - Appends a sourceURL comment derived from labelBase and a content hash to
   *   improve debugging and stack traces in devtools.
   * - The returned object contains both the Blob URL and the computed hash.
   */
  public getOrCreateUrlForJs(
    content: string,
    labelBase: string
  ): { url: string; hash: string } {
    const hash = this.computeHash(content)
    const cachedUrl = this.cache.get(hash)

    if (cachedUrl) {
      return { url: cachedUrl, hash }
    }

    const labeledContent = `${content}\n//# sourceURL=${labelBase}-${hash}.js`
    const blob = new Blob([labeledContent], { type: "text/javascript" })
    const url = URL.createObjectURL(blob)

    this.cache.set(hash, url)

    return { url, hash }
  }
}

export const blobUrlManager = new BlobUrlManager()
