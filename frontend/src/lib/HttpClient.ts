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
