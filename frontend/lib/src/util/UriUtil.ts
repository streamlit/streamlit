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
