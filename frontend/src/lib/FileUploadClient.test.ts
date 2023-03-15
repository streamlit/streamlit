/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import axios, { AxiosRequestConfig } from "axios"
import MockAdapter from "axios-mock-adapter"
import { FileUploadClient } from "src/lib/FileUploadClient"
import { buildHttpUri } from "src/lib/UriUtil"
import { getCookie } from "src/lib/utils"
import { mockSessionInfo } from "./mocks/mocks"

const MOCK_SERVER_URI = {
  host: "streamlit.mock",
  port: 80,
  basePath: "",
}

const MOCK_FILE_ID = -111
const MOCK_FILE = new File(["file1"], "file1.txt")

describe("FileUploadClient Upload", () => {
  let axiosMock: MockAdapter
  let formsWithPendingRequestsChanged: jest.Mock
  let uploader: FileUploadClient

  beforeEach(() => {
    axiosMock = new MockAdapter(axios)

    formsWithPendingRequestsChanged = jest.fn()
    uploader = new FileUploadClient({
      sessionInfo: mockSessionInfo(),
      getServerUri: () => MOCK_SERVER_URI,
      formsWithPendingRequestsChanged,
      csrfEnabled: true,
    })
  })

  afterEach(() => {
    axiosMock.restore()
  })

  function mockUploadResponseStatus(status: number): void {
    axiosMock
      .onPost(buildHttpUri(MOCK_SERVER_URI, "_stcore/upload_file"))
      .reply((config: AxiosRequestConfig): any[] => {
        if (status !== 200) {
          return [status]
        }

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
          // @ts-expect-error - TS errors that config.headers is possibly 'undefined`
          if (!("X-Xsrftoken" in config.headers)) {
            return [403]
          }
          if (!("withCredentials" in config)) {
            return [403]
          }
        }

        return [status, MOCK_FILE_ID]
      })
  }

  it("uploads files outside a form", async () => {
    mockUploadResponseStatus(200)

    await expect(
      uploader.uploadFile({ id: "widgetId", formId: "" }, MOCK_FILE)
    ).resolves.toBe(MOCK_FILE_ID)

    expect(formsWithPendingRequestsChanged).not.toHaveBeenCalled()
  })

  it("uploads files inside a form", async () => {
    mockUploadResponseStatus(200)

    // Upload a file with an attached form ID.
    const uploadFilePromise = uploader.uploadFile(
      { id: "widgetId", formId: "mockFormId" },
      MOCK_FILE
    )

    // `formsWithPendingRequestsChanged` should be called with our mockFormId
    // when the upload kicks off.
    expect(formsWithPendingRequestsChanged).toHaveBeenCalledTimes(1)
    expect(formsWithPendingRequestsChanged).toHaveBeenLastCalledWith(
      new Set(["mockFormId"])
    )

    // Wait for the upload to complete
    await expect(uploadFilePromise).resolves.toBeDefined()

    // `formsWithPendingRequestsChanged` should be called a second time, with
    // an empty set
    expect(formsWithPendingRequestsChanged).toHaveBeenCalledTimes(2)
    expect(formsWithPendingRequestsChanged).toHaveBeenLastCalledWith(new Set())
  })

  it("handles errors outside a form", async () => {
    mockUploadResponseStatus(400)

    await expect(
      uploader.uploadFile({ id: "widgetId", formId: "" }, MOCK_FILE)
    ).rejects.toEqual(new Error("Request failed with status code 400"))

    expect(formsWithPendingRequestsChanged).not.toHaveBeenCalled()
  })

  it("handles errors inside a form", async () => {
    mockUploadResponseStatus(400)

    // Upload a file with an attached form ID.
    const uploadFilePromise = uploader.uploadFile(
      { id: "widgetId", formId: "mockFormId" },
      MOCK_FILE
    )

    // `formsWithPendingRequestsChanged` should be called with our mockFormId
    // when the upload kicks off.
    expect(formsWithPendingRequestsChanged).toHaveBeenCalledTimes(1)
    expect(formsWithPendingRequestsChanged).toHaveBeenLastCalledWith(
      new Set(["mockFormId"])
    )

    // Wait for the upload to error
    await expect(uploadFilePromise).rejects.toBeDefined()

    // `formsWithPendingRequestsChanged` should be called a second time, with
    // an empty set
    expect(formsWithPendingRequestsChanged).toHaveBeenCalledTimes(2)
    expect(formsWithPendingRequestsChanged).toHaveBeenLastCalledWith(new Set())
  })
})
