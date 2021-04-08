/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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

import axios, { AxiosRequestConfig, AxiosResponse } from "axios"
import { buildHttpUri, BaseUriParts } from "src/lib/UriUtil"
import { getCookie } from "src/lib/utils"

/**
 * Base class for HTTP Clients
 */
export default class HttpClient {
  protected readonly getServerUri: () => BaseUriParts | undefined

  protected readonly csrfEnabled: boolean

  public constructor(
    getServerUri: () => BaseUriParts | undefined,
    csrfEnabled: boolean
  ) {
    this.getServerUri = getServerUri
    this.csrfEnabled = csrfEnabled
  }

  /**
   * Wrapper around axios.request to update the request config with
   * CSRF headers if client has CSRF protection enabled.
   */
  public request<T = any, R = AxiosResponse<T>>(
    url: string,
    params: AxiosRequestConfig
  ): Promise<R> {
    const serverURI = this.getServerUri()
    if (serverURI === undefined) {
      throw new Error("Cannot complete request: not connected to a server")
    }
    params.url = buildHttpUri(serverURI, url)

    if (this.csrfEnabled) {
      const xsrfCookie = getCookie("_xsrf")
      if (xsrfCookie != null) {
        params.headers = {
          "X-Xsrftoken": xsrfCookie,
          ...(params.headers || {}),
        }
        params.withCredentials = true
      }
    }

    return axios.request<T, R>(params)
  }
}
