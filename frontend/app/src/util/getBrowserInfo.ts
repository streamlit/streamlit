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

import UAParser from "ua-parser-js"

function getBrowserInfo(): {
  browserName: string
  browserVersion: string
  deviceType: string
  os: string
} {
  const parser = new UAParser()
  const result = parser.getResult()

  return {
    browserName: result.browser.name || "Unknown",
    browserVersion: result.browser.version || "Unknown",
    /**
     * 'desktop' is not a valid value for device.type in ua-parser-js.
     * We default to 'desktop' if the value is not present.
     * Possible options from ua-parser-js are:
     * 'mobile', 'tablet', 'smarttv', 'wearable', 'embedded', 'console'
     */
    deviceType: result.device.type || "desktop",
    os: result.os.name || "Unknown",
  }
}

export default getBrowserInfo
