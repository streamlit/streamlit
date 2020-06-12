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

import axiosLib, { AxiosInstance } from "axios"
import { BaseUriParts } from "lib/UriUtil"
import { getCookie } from "lib/utils"

/**
 * Base class for HTTP Clients
 */
export default class HttpClient {
  protected readonly getServerUri: () => BaseUriParts | undefined
  protected axiosInstance: AxiosInstance
  protected readonly csrfEnabled: boolean

  public constructor(getServerUri: () => BaseUriParts | undefined) {
    const xsrf_cookie = getCookie("_xsrf")
    this.getServerUri = getServerUri
    this.csrfEnabled = !!xsrf_cookie
    this.axiosInstance = axiosLib.create(
      this.csrfEnabled
        ? {
            withCredentials: true,
            headers: {
              "X-Xsrftoken": xsrf_cookie,
            },
          }
        : {}
    )
  }

  public updateCsrfToken(): void {
    const csrfCookie = getCookie("_xsrf")
    if (csrfCookie) {
      this.axiosInstance.defaults.headers["X-Xsrftoken"] = csrfCookie
      this.axiosInstance.defaults.withCredentials = true
    } else {
      delete this.axiosInstance.defaults.headers["X-Xsrftoken"]
      this.axiosInstance.defaults.withCredentials = false
    }
  }
}
