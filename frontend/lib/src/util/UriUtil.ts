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

// Remove once support for URLPattern is added to all major browsers
// https://caniuse.com/mdn-api_urlpattern
import "urlpattern-polyfill"

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
      window.__streamlit?.BACKEND_BASE_URL &&
      parsedUrl.origin === new URL(window.__streamlit?.BACKEND_BASE_URL).origin
    ) {
      return resourceCrossOriginMode
    }

    return undefined
  } catch {
    // If the URL is not a full URL, it likely is a relative URL.
    // If window.__streamlit?.BACKEND_BASE_URL is set, return the resourceCrossOriginMode.
    // If it is not set, the request would go against the window's origin and is a same-origin request.
    // The browser would ignore the crossorigin attribute in this case, but to make it more explicit, we return undefined.
    // Note that www.example.com/some-image.png would also return the resourceCrossOriginMode as it is not a valid URL without the scheme.
    return window.__streamlit?.BACKEND_BASE_URL
      ? resourceCrossOriginMode
      : undefined
  }
}
