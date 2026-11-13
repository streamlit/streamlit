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

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/

/**
 * Returns true if the hostname is local to the user's machine or network:
 * `localhost` (and its subdomains), a loopback address (`127.*`, `[::1]`),
 * `0.0.0.0`, or a private-network IPv4 address (`10.*`, `192.168.*`,
 * `172.16.*`-`172.31.*`). Hostnames are expected in `URL.hostname` form, so
 * IPv6 addresses are bracketed.
 */
export function isLocalOrPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "[::1]" ||
    host === "0.0.0.0"
  ) {
    return true
  }

  const match = IPV4_RE.exec(host)
  if (!match) return false

  const first = Number(match[1])
  const second = Number(match[2])
  return (
    first === 127 ||
    first === 10 ||
    (first === 192 && second === 168) ||
    (first === 172 && second >= 16 && second <= 31)
  )
}
