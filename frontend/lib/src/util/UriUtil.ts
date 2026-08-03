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

// Remove once support for URLPattern is added to all major browsers
// https://caniuse.com/mdn-api_urlpattern
import "urlpattern-polyfill"

import { StreamlitConfig } from "@streamlit/utils"

/**
 * URI returned for blocked links. We use "#" instead of "" to prevent
 * navigation: an empty href combined with target="_blank" would open the
 * current page in a new tab.
 */
export const BLOCKED_LINK_URI = "#"

/** Dangerous URL schemes that can execute arbitrary code when clicked. */
const DANGEROUS_URL_SCHEMES = ["javascript:", "vbscript:"]

// C0 control characters (U+0000-U+001F) that browsers silently strip from URLs
// per the WHATWG URL spec. These must be removed before checking schemes to
// prevent bypass attacks like "\x01javascript:alert(1)".
// eslint-disable-next-line no-control-regex
const C0_CONTROL_CHARS_REGEX = /[\x00-\x1F]/g

/**
 * Returns true if the given URI uses a dangerous scheme (javascript:,
 * vbscript:) that can execute arbitrary code when clicked.
 *
 * We use a blocklist approach instead of an allowlist to preserve compatibility
 * with data: URLs and other custom schemes that Streamlit users rely on (e.g.,
 * inline images, PDFs). Note that data:text/html URLs can execute JavaScript
 * but run in a sandboxed null-origin context, making them less dangerous than
 * javascript: URLs.
 *
 * C0 control characters and surrounding whitespace are stripped before matching
 * so that obfuscated values like "\x01javascript:" or "java\nscript:" (which
 * browsers normalize before interpreting the scheme) are still detected.
 */
export function isDangerousLinkUri(uri: string): boolean {
  const normalizedUri = uri
    .replace(C0_CONTROL_CHARS_REGEX, "")
    .toLowerCase()
    .trim()

  return DANGEROUS_URL_SCHEMES.some(scheme => normalizedUri.startsWith(scheme))
}

/**
 * Check if the given origin follows the allowed origin pattern, which could
 * include wildcards.
 *
 * This function is used to check whether cross-origin messages received by the
 * withHostCommunication component come from an origin that we've listed as
 * trusted. If this function returns false against the origin being tested for
 * all trusted origins in our whitelist, the cross-origin message should be
 * ignored.
 */
export function isValidOrigin(
  allowedOriginPattern: string,
  testOrigin: string
): boolean {
  let allowedUrlPattern: URLPattern
  let allowedPortLessPattern: URLPattern
  let testUrl: URL

  try {
    allowedUrlPattern = new URLPattern(allowedOriginPattern)
    allowedPortLessPattern = new URLPattern({
      protocol: allowedUrlPattern.protocol,
      hostname: allowedUrlPattern.hostname,
    })
    testUrl = new URL(testOrigin)
  } catch {
    return false
  }

  // Allow localhost w/ any port for testing of host <-> guest communication
  // using hostframe.html (facilitates manual & e2e testing)
  if (
    testUrl.hostname === "localhost" &&
    allowedPortLessPattern.test(testUrl)
  ) {
    return true
  }

  return allowedUrlPattern.test(testUrl)
}

/**
 * Return the crossorigin attribute value for the given resourceCrossOriginMode and given url.
 */
export function getCrossOriginAttribute(
  resourceCrossOriginMode: undefined | "anonymous" | "use-credentials",
  url?: string
): undefined | "anonymous" | "use-credentials" {
  if (!url) {
    return undefined
  }

  try {
    const parsedUrl = new URL(url)

    // The passed URL is absolute and it's pointing to the same origin as the backend server,
    // so we should use the configured resourceCrossOriginMode. We don't check for requests going to the same
    // origin as window.location.origin because that's a same-origin request where the crossorigin attribute is ignored anyways.
    if (
      StreamlitConfig.BACKEND_BASE_URL &&
      parsedUrl.origin === new URL(StreamlitConfig.BACKEND_BASE_URL).origin
    ) {
      return resourceCrossOriginMode
    }

    return undefined
  } catch {
    // If the URL is not a full URL, it likely is a relative URL.
    // If StreamlitConfig.BACKEND_BASE_URL is set, return the resourceCrossOriginMode.
    // If it is not set, the request would go against the window's origin and is a same-origin request.
    // The browser would ignore the crossorigin attribute in this case, but to make it more explicit, we return undefined.
    // Note that www.example.com/some-image.png would also return the resourceCrossOriginMode as it is not a valid URL without the scheme.
    return StreamlitConfig.BACKEND_BASE_URL
      ? resourceCrossOriginMode
      : undefined
  }
}
