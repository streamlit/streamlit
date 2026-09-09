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

import { waitFor } from "@testing-library/react"

import { FileUploadClient } from "~lib/FileUploadClient"

import { createUploadFileHandler } from "./createFileUploadHandler"

const FILE_URLS = {
  fileId: "file-1",
  uploadUrl: "/upload",
  deleteUrl: "/delete",
}

const createFile = (name: string, webkitRelativePath?: string): File => {
  const file = new File(["file-bytes"], name, { type: "text/plain" })
  if (webkitRelativePath) {
    Object.defineProperty(file, "webkitRelativePath", {
      value: webkitRelativePath,
    })
  }
  return file
}

describe("createUploadFileHandler", () => {
  it("prefers webkitRelativePath for the displayed file name", async () => {
    const addFiles = vi.fn()
    const onUploadComplete = vi.fn()
    const uploadClient = {
      uploadFile: vi.fn().mockResolvedValue(undefined),
    }

    const handler = createUploadFileHandler({
      getNextLocalFileId: () => 7,
      addFiles,
      updateFile: vi.fn(),
      uploadClient: uploadClient as unknown as FileUploadClient,
      element: { id: "chat-input", formId: "" },
      onUploadProgress: vi.fn(),
      onUploadComplete,
    })

    handler(FILE_URLS, createFile("notes.txt", "docs/notes.txt"))

    expect(addFiles).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 7,
        name: "docs/notes.txt",
        status: expect.objectContaining({ type: "uploading" }),
      }),
    ])
    await waitFor(() => {
      expect(onUploadComplete).toHaveBeenCalledWith(7, FILE_URLS)
    })
  })

  it("does not mark the file as failed when the upload is aborted", async () => {
    const updateFile = vi.fn()
    const uploadClient = {
      uploadFile: vi
        .fn()
        .mockRejectedValue(new DOMException("aborted", "AbortError")),
    }

    const handler = createUploadFileHandler({
      getNextLocalFileId: () => 1,
      addFiles: vi.fn(),
      updateFile,
      uploadClient: uploadClient as unknown as FileUploadClient,
      element: { id: "chat-input", formId: "" },
      onUploadProgress: vi.fn(),
      onUploadComplete: vi.fn(),
    })

    handler(FILE_URLS, createFile("notes.txt"))

    await expect(
      uploadClient.uploadFile.mock.results[0].value
    ).rejects.toMatchObject({ name: "AbortError" })
    expect(updateFile).not.toHaveBeenCalled()
  })

  it("records a non-abort upload failure on the file", async () => {
    const updateFile = vi.fn()
    const uploadClient = {
      uploadFile: vi.fn().mockRejectedValue(new Error("network down")),
    }

    const handler = createUploadFileHandler({
      getNextLocalFileId: () => 3,
      addFiles: vi.fn(),
      updateFile,
      uploadClient: uploadClient as unknown as FileUploadClient,
      element: { id: "chat-input", formId: "" },
      onUploadProgress: vi.fn(),
      onUploadComplete: vi.fn(),
    })

    handler(FILE_URLS, createFile("notes.txt"))

    await waitFor(() => {
      expect(updateFile).toHaveBeenCalledWith(
        3,
        expect.objectContaining({
          status: {
            type: "error",
            errorMessage: expect.stringContaining("network down"),
          },
        })
      )
    })
  })
})
