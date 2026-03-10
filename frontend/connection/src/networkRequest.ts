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

import { getCookie, notNullOrUndefined } from "@streamlit/utils"

const XSRF_COOKIE_NAME = "_streamlit_xsrf"
const XSRF_HEADER_NAME = "X-Xsrftoken"

export type RequestBody =
  | Blob
  | FormData
  | URLSearchParams
  | string
  | Record<string, string>

type SerializedRequestBody = Exclude<RequestBody, Record<string, string>>

export interface CsrfRequestParams {
  method: string
  headers?: Record<string, string>
  body?: RequestBody
  signal?: AbortSignal
  onUploadProgress?: (progressEvent: ProgressEvent) => void
}

interface SendCsrfRequestProps {
  url: string
  params: CsrfRequestParams
  csrfEnabled: boolean
}

/**
 * Execute an HTTP request with Streamlit CSRF behavior and upload progress support.
 */
export async function sendCsrfRequest({
  url,
  params,
  csrfEnabled,
}: SendCsrfRequestProps): Promise<void> {
  const headers: Record<string, string> = { ...params.headers }
  const includeCredentials = addCsrfHeaders({ headers, csrfEnabled })

  const body = serializeBody(params.body, headers)

  const shouldUseXmlHttpRequest =
    body instanceof FormData || notNullOrUndefined(params.onUploadProgress)

  if (shouldUseXmlHttpRequest) {
    await sendXmlHttpRequest({
      method: params.method,
      url,
      headers,
      body,
      signal: params.signal,
      includeCredentials,
      onUploadProgress: params.onUploadProgress,
    })
    return
  }

  const response = await fetch(url, {
    method: params.method,
    body,
    headers,
    signal: params.signal,
    credentials: includeCredentials ? "include" : undefined,
  })

  if (!response.ok) {
    throw createStatusCodeError(response.status)
  }
}

function addCsrfHeaders({
  headers,
  csrfEnabled,
}: {
  headers: Record<string, string>
  csrfEnabled: boolean
}): boolean {
  if (!csrfEnabled) {
    return false
  }

  const xsrfCookie = getCookie(XSRF_COOKIE_NAME)
  if (!notNullOrUndefined(xsrfCookie)) {
    return false
  }

  headers[XSRF_HEADER_NAME] = xsrfCookie
  return true
}

function createStatusCodeError(status: number): Error {
  return new Error(`Request failed with status code ${status}`)
}

function serializeBody(
  body: CsrfRequestParams["body"],
  headers: Record<string, string>
): SerializedRequestBody | undefined {
  if (body === undefined) {
    return undefined
  }

  if (
    typeof body === "string" ||
    body instanceof Blob ||
    body instanceof FormData ||
    body instanceof URLSearchParams
  ) {
    return body
  }

  const contentType = getHeaderValue(headers, "Content-Type")
  if (contentType?.includes("application/x-www-form-urlencoded")) {
    return new URLSearchParams(body).toString()
  }

  if (!contentType) {
    headers["Content-Type"] = "application/json"
  }

  return JSON.stringify(body)
}

function getHeaderValue(
  headers: Record<string, string>,
  headerName: string
): string | undefined {
  const lookupName = headerName.toLowerCase()
  const matchingHeader = Object.entries(headers).find(
    ([name]) => name.toLowerCase() === lookupName
  )
  return matchingHeader?.[1]
}

function sendXmlHttpRequest({
  method,
  url,
  headers,
  body,
  signal,
  includeCredentials,
  onUploadProgress,
}: {
  method: string
  url: string
  headers: Record<string, string>
  body?: SerializedRequestBody
  signal?: AbortSignal
  includeCredentials: boolean
  onUploadProgress?: (progressEvent: ProgressEvent) => void
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.open(method, url)
    xhr.withCredentials = includeCredentials
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value)
    })

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      reject(createStatusCodeError(xhr.status))
    }

    xhr.onerror = () => {
      reject(new Error("Network Error"))
    }

    xhr.onabort = () => {
      reject(new DOMException("Aborted", "AbortError"))
    }

    if (onUploadProgress) {
      xhr.upload.onprogress = onUploadProgress
    }

    if (signal) {
      if (signal.aborted) {
        xhr.abort()
        return
      }

      const handleAbort = (): void => xhr.abort()
      signal.addEventListener("abort", handleAbort, { once: true })

      const finalize = (): void => {
        signal.removeEventListener("abort", handleAbort)
      }
      xhr.onloadend = finalize
    }

    xhr.send(body ?? null)
  })
}
