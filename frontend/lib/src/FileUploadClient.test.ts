/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { FileUploadClient } from "./FileUploadClient"
import { mockSessionInfo } from "./mocks/mocks"

const MOCK_FILE_ID = -111
const MOCK_FILE = new File(["file1"], "file1.txt")

describe("FileUploadClient Upload", () => {
  let formsWithPendingRequestsChanged: jest.Mock
  let requestFileURLs: jest.Mock
  let uploadFileUploaderFile: jest.Mock
  let uploader: FileUploadClient

  beforeEach(() => {
    formsWithPendingRequestsChanged = jest.fn()
    uploadFileUploaderFile = jest.fn()
    requestFileURLs = jest.fn()

    uploader = new FileUploadClient({
      sessionInfo: mockSessionInfo(),
      endpoints: {
        buildComponentURL: jest.fn(),
        buildMediaURL: jest.fn(),
        buildFileUploadURL: jest.fn(),
        buildAppPageURL: jest.fn(),
        uploadFileUploaderFile: uploadFileUploaderFile,
        deleteFileAtURL: jest.fn(),
      },
      formsWithPendingRequestsChanged,
      requestFileURLs,
    })
  })

  it("uploads files outside a form", async () => {
    uploadFileUploaderFile.mockResolvedValue(MOCK_FILE_ID)

    await expect(
      uploader.uploadFile(
        { id: "widgetId", formId: "" },
        "/_stcore/upload_file/file_1",
        MOCK_FILE
      )
    ).resolves.toBe(MOCK_FILE_ID)

    expect(formsWithPendingRequestsChanged).not.toHaveBeenCalled()
  })

  it("uploads files inside a form", async () => {
    uploadFileUploaderFile.mockResolvedValue(MOCK_FILE_ID)

    // Upload a file with an attached form ID.
    const uploadFilePromise = uploader.uploadFile(
      { id: "widgetId", formId: "mockFormId" },
      "/_stcore/upload_file/file_1",
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
    uploadFileUploaderFile.mockRejectedValue(new Error("oh no!"))

    await expect(
      uploader.uploadFile(
        { id: "widgetId", formId: "" },
        "/_stcore/upload_file/file_1",
        MOCK_FILE
      )
    ).rejects.toEqual(new Error("oh no!"))

    expect(formsWithPendingRequestsChanged).not.toHaveBeenCalled()
  })

  it("handles errors inside a form", async () => {
    uploadFileUploaderFile.mockRejectedValue(new Error("oh no!"))

    // Upload a file with an attached form ID.
    const uploadFilePromise = uploader.uploadFile(
      { id: "widgetId", formId: "mockFormId" },
      "/_stcore/upload_file/file_1",
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

  it("fetchFileURLs calls requestFileURLs and returns a promise", () => {
    const fileURLsPromise = uploader.fetchFileURLs([])
    expect(requestFileURLs).toHaveBeenCalledTimes(1)

    // @ts-expect-error
    const pendingReqs = uploader.pendingFileURLsRequests
    expect(pendingReqs.size).toBe(1)

    const reqId = pendingReqs.keys().next().value

    expect(pendingReqs.get(reqId)?.promise).toBe(fileURLsPromise)
  })

  it("onFileURLsResponse rejects promise on errorMsg", async () => {
    uploader.fetchFileURLs([])

    // @ts-expect-error
    const pendingReqs = uploader.pendingFileURLsRequests
    const reqId = pendingReqs.keys().next().value
    const promise = pendingReqs.get(reqId)?.promise

    uploader.onFileURLsResponse({
      responseId: reqId,
      errorMsg: "kaboom",
    })

    await expect(promise).rejects.toBe("kaboom")
  })

  it("onFileURLsResponse resolves promise on success", async () => {
    uploader.fetchFileURLs([])

    // @ts-expect-error
    const pendingReqs = uploader.pendingFileURLsRequests
    const reqId = pendingReqs.keys().next().value
    const promise = pendingReqs.get(reqId)?.promise

    uploader.onFileURLsResponse({
      responseId: reqId,
      fileUrls: [],
    })

    await expect(promise).resolves.toEqual([])
  })

  it("onFileURLsResponse does not error when given an invalid responseId", () => {
    // No need to do anything other than check that no error is thrown.
    expect(() => {
      uploader.onFileURLsResponse({
        responseId: "noCorrespondingId",
        fileUrls: [],
      })
    }).not.toThrow()
  })
})
