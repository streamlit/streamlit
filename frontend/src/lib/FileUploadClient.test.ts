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

import axios, { AxiosRequestConfig } from "axios"
import MockAdapter from "axios-mock-adapter"
import { FileUploadClient } from "lib/FileUploadClient"
import { SessionInfo } from "lib/SessionInfo"
import { buildHttpUri } from "lib/UriUtil"
import { getCookie } from "lib/utils"

const MOCK_SERVER_URI = {
  host: "streamlit.mock",
  port: 80,
  basePath: "",
}

describe("FileUploadClient Upload", () => {
  let axiosMock: MockAdapter

  beforeEach(() => {
    axiosMock = new MockAdapter(axios)
    SessionInfo.current = new SessionInfo({
      sessionId: "sessionId",
      streamlitVersion: "sv",
      pythonVersion: "pv",
      installationId: "iid",
      installationIdV1: "iid1",
      installationIdV2: "iid2",
      authorEmail: "ae",
      maxCachedMessageAge: 2,
      commandLine: "command line",
      userMapboxToken: "mockUserMapboxToken",
    })
  })

  afterEach(() => {
    axiosMock.restore()
    // @ts-ignore
    SessionInfo.singleton = undefined
  })

  function mockUploadResponseStatus(status: number): void {
    axiosMock
      .onPost(buildHttpUri(MOCK_SERVER_URI, "upload_file"))
      .reply((config: AxiosRequestConfig): any[] => {
        if (status === 200) {
          // Validate that widgetId and sessionId are present on
          // outgoing requests.
          const data = config.data as FormData
          if (data.get("widgetId") == null) {
            return [400]
          }
          if (data.get("sessionId") == null) {
            return [400]
          }

          if (getCookie("_xsrf")) {
            if (!("X-Xsrftoken" in config.headers)) {
              return [403]
            }
            if (!("withCredentials" in config)) {
              return [403]
            }
          }
        }

        return [status]
      })
  }

  test("it uploads files correctly", async () => {
    const uploader = new FileUploadClient(() => MOCK_SERVER_URI, true)

    mockUploadResponseStatus(200)

    const files = [
      { file: new File(["file1"], "file1.txt"), id: "id1" },
      { file: new File(["file2"], "file2.txt"), id: "id2" },
    ]

    await expect(
      uploader.uploadFiles("widgetId", files)
    ).resolves.toBeUndefined()
  })

  test("it handles errors", async () => {
    const uploader = new FileUploadClient(() => MOCK_SERVER_URI, true)

    mockUploadResponseStatus(400)

    const files = [
      { file: new File(["file1"], "file1.txt"), id: "id1" },
      { file: new File(["file2"], "file2.txt"), id: "id2" },
    ]

    await expect(uploader.uploadFiles("widgetId", files)).rejects.toEqual(
      new Error("Request failed with status code 400")
    )
  })
})

describe("FileUploadClient delete", () => {
  beforeEach(() => {
    axios.request = jest.fn()
    SessionInfo.current = new SessionInfo({
      sessionId: "sessionId",
      streamlitVersion: "sv",
      pythonVersion: "pv",
      installationId: "iid",
      installationIdV1: "iid1",
      installationIdV2: "iid2",
      authorEmail: "ae",
      maxCachedMessageAge: 2,
      commandLine: "command line",
      userMapboxToken: "mockUserMapboxToken",
    })
  })

  afterEach(() => {
    // @ts-ignore
    SessionInfo.singleton = undefined
  })

  test("it deletes file", async () => {
    const uploader = new FileUploadClient(() => MOCK_SERVER_URI, true)

    await expect(uploader.delete("widgetId", "123")).resolves.toEqual(
      undefined
    )

    expect(axios.request).toHaveBeenCalledWith({
      method: "DELETE",
      url: buildHttpUri(
        MOCK_SERVER_URI,
        `upload_file/${SessionInfo.current.sessionId}/widgetId/123`
      ),
    })
  })
})
