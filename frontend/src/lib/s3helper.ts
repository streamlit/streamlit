/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
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

// For historical reasons, this follows S3's GetObject API.
interface GetObjectRequest {
  Bucket: string
  Key: string
}

/**
 * Parses the S3 data bucket name and the resource root for the current
 * report from the window location href.
 */
export function getBucketAndResourceRoot(): {
  bucket: string
  resourceRoot: string
} {
  const { hostname, pathname } = url.parse(window.location.href, true)

  // Bucket name is always equal to the hostname
  const bucket = String(hostname)

  // We may not have a pathname
  if (pathname == null || pathname === "/") {
    return { bucket, resourceRoot: "" }
  }

  // Our pathname will look something like /some/s3/path/0.49.0-HdbX/index.html?id=9zttR9BsCpG6YP1fMD8rjj
  // Everything after that initial '/ and before the final '/' is the resource root.
  const startIdx = pathname.startsWith("/") ? 1 : 0
  const endIdx = pathname.lastIndexOf("/")
  const resourceRoot = pathname.substring(startIdx, endIdx)

  return { bucket, resourceRoot }
}

/**
 * Get an Object from S3. This smartly chooses whether hit the HTTP server in
 * front of S3 or whether to hit the S3 API server based.
 *
 * The reason why you'd want to do this is to make setup easier for clients who
 * have their own S3 setups but do not want to use auth (maybe because they're
 * in a VPN). This way there's no need for them to mess with things like
 * Cognito, IAM, roles, and so on -- which would be required if using the S3
 * API.
 *
 * So you should *always* use this instead of s3.getObject.
 *
 * Arguments: {Key: string, Bucket: string}
 */
export async function getObject(args: GetObjectRequest): Promise<Response> {
  const response = await fetch(`/${args.Key}`, FETCH_PARAMS)

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
