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

import { Mock } from "vitest"

import { FileUploadClient } from "./FileUploadClient"
import { mockSessionInfo } from "./mocks/mocks"
import { StreamlitEndpoints } from "./StreamlitEndpoints"

const MOCK_FILE_ID = -111
const MOCK_FILE = new File(["file1"], "file1.txt")

const makeMockEndpoints = (
  overrides: Partial<StreamlitEndpoints> = {}
): StreamlitEndpoints => ({
  setStaticConfigUrl: vi.fn(),
  sendClientErrorToHost: vi.fn(),
  checkSourceUrlResponse: vi.fn(),
  buildComponentURL: vi.fn(),
  buildBidiComponentURL: vi.fn(),
  buildMediaURL: vi.fn(),
  buildDownloadUrl: vi.fn(),
  buildFileUploadURL: vi.fn(),
  buildAppPageURL: vi.fn(),
  uploadFileUploaderFile: vi.fn(),
  ...overrides,
})

describe("FileUploadClient Upload", () => {
  let formsWithPendingRequestsChanged: Mock
  let requestFileURLs: Mock
  let uploadFileUploaderFile: Mock
  let deleteFileAtURL: Mock
  let uploader: FileUploadClient

  beforeEach(() => {
    formsWithPendingRequestsChanged = vi.fn()
    uploadFileUploaderFile = vi.fn()
    requestFileURLs = vi.fn()
    deleteFileAtURL = vi.fn()

    uploader = new FileUploadClient({
      sessionInfo: mockSessionInfo(),
      endpoints: makeMockEndpoints({
        uploadFileUploaderFile,
        deleteFileAtURL,
      }),
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

    const reqId = pendingReqs.keys().next().value as string

    expect(pendingReqs.get(reqId)?.promise).toBe(fileURLsPromise)
  })

  it("onFileURLsResponse rejects promise on errorMsg", async () => {
    void uploader.fetchFileURLs([])

    // @ts-expect-error
    const pendingReqs = uploader.pendingFileURLsRequests
    const reqId = pendingReqs.keys().next().value as string
    const promise = pendingReqs.get(reqId)?.promise

    uploader.onFileURLsResponse({
      responseId: reqId,
      errorMsg: "kaboom",
    })

    await expect(promise).rejects.toBe("kaboom")
  })

  it("onFileURLsResponse resolves promise on success", async () => {
    void uploader.fetchFileURLs([])

    // @ts-expect-error
    const pendingReqs = uploader.pendingFileURLsRequests
    const reqId = pendingReqs.keys().next().value as string
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

  it("deleteFile calls endpoints.deleteFileAtURL", async () => {
    deleteFileAtURL.mockResolvedValue(undefined)

    await uploader.deleteFile("/some/file/url")

    expect(deleteFileAtURL).toHaveBeenCalledTimes(1)
    expect(deleteFileAtURL).toHaveBeenCalledWith(
      "/some/file/url",
      expect.any(String)
    )
  })
})

describe("FileUploadClient without optional endpoints", () => {
  const makeUploader = (): FileUploadClient =>
    new FileUploadClient({
      sessionInfo: mockSessionInfo(),
      endpoints: makeMockEndpoints(),
      formsWithPendingRequestsChanged: vi.fn(),
    })

  it("deleteFile resolves to undefined when deleteFileAtURL is undefined", async () => {
    await expect(
      makeUploader().deleteFile("/some/url")
    ).resolves.toBeUndefined()
  })

  it("fetchFileURLs resolves to [] when requestFileURLs is not provided", async () => {
    await expect(makeUploader().fetchFileURLs([MOCK_FILE])).resolves.toEqual(
      []
    )
  })
})
