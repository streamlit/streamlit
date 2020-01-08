/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { FETCH_PARAMS } from "./baseconsts"
import url from "url"

/**
 * Returns the local path for a static report resource.
 * @param reportId the report ID of the resource to fetch
 * @param objName the name of the resource to fetch
 */
export function getReportObjectPath(
  reportId: string,
  objName: string
): string {
  const { pathname } = url.parse(window.location.href, true)

  let resourceRoot = ""
  if (pathname != null) {
    // If we have a pathname, it will look like either
    // 1) /some/s3/path/0.49.0-HdbX/index.html?id=1234 OR
    // 2) /index.html?id=1234
    // We want everything after the leading '/', and before the final '/'.

    // Strip the trailing "/" and everything after it
    resourceRoot = pathname.substring(0, pathname.lastIndexOf("/"))

    // Strip the leading slash, if it exists
    if (resourceRoot.startsWith("/")) {
      resourceRoot = resourceRoot.substring(1)
    }
  }

  const objectPath = `reports/${reportId}/${objName}`
  return resourceRoot === ""
    ? `/${objectPath}`
    : `/${resourceRoot}/${objectPath}`
}

/**
 * Fetch a static report resource from S3. Error if it doesn't exist.
 *
 * @param reportId the report ID of the resource to fetch
 * @param objName the name of the resource to fetch
 */
export async function getReportObject(
  reportId: string,
  objName: string
): Promise<Response> {
  const response = await fetch(
    getReportObjectPath(reportId, objName),
    FETCH_PARAMS
  )

  if (!response.ok) {
    if (response.status === 403) {
      // Can't subclass Error class in Babel, so this is my crappy solution.
      throw new Error("PermissionError")
    } else {
      const responseText = await response.text()
      throw new Error(
        `HTTP status code: ${response.status}\n` +
          `Response text: ${responseText}`
      )
    }
  }

  return response
}
