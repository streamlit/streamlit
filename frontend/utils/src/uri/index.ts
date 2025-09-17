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

const FINAL_SLASH_RE = /\/+$/
const INITIAL_SLASH_RE = /^\/+/

/**
 * Create an HTTP URI for the given path.
 */
export function buildHttpUri(
  { hostname, port, pathname, protocol }: URL,
  path: string
): string {
  const fullPath = makePath(pathname, path)
  return `${protocol}//${hostname}${port ? `:${port}` : ""}/${fullPath}`
}

export function makePath(basePath: string, subPath: string): string {
  basePath = basePath.replace(FINAL_SLASH_RE, "").replace(INITIAL_SLASH_RE, "")
  subPath = subPath.replace(FINAL_SLASH_RE, "").replace(INITIAL_SLASH_RE, "")

  if (basePath.length === 0) {
    return subPath
  }

  return `${basePath}/${subPath}`
}

export const isLocalhost = (): boolean => {
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  )
}
