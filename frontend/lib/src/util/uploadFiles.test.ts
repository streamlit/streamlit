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

import { describe, expect, it, vi } from "vitest"

import { FileUploadClient } from "~lib/FileUploadClient"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { uploadFiles } from "./uploadFiles"

describe("uploadFiles", () => {
  const createMockFile = (name: string): File =>
    new File(["content"], name, { type: "text/plain" })

  const createMocks = (): {
    uploadClient: FileUploadClient
    widgetMgr: WidgetStateManager
    widgetInfo: { id: string; formId: string }
  } => {
    const uploadClient = {
      fetchFileURLs: vi.fn(),
      uploadFile: vi.fn(),
    } as unknown as FileUploadClient

    const widgetMgr = {
      setFileUploaderStateValue: vi.fn(),
    } as unknown as WidgetStateManager

    const widgetInfo = { id: "widget-1", formId: "" }

    return { uploadClient, widgetMgr, widgetInfo }
  }

  it("records failed uploads when fetchFileURLs throws", async () => {
    const { uploadClient, widgetMgr, widgetInfo } = createMocks()
    const file = createMockFile("test.txt")

    vi.mocked(uploadClient.fetchFileURLs).mockRejectedValue(
      new Error("Network error")
    )

    const result = await uploadFiles({
      files: [file],
      uploadClient,
      widgetMgr,
      widgetInfo,
    })

    expect(result.successfulUploads).toHaveLength(0)
    expect(result.failedUploads).toHaveLength(1)
    expect(result.failedUploads[0].file).toBe(file)
    expect(result.failedUploads[0].error.message).toBe("Network error")
  })

  it("records failed uploads when file URL is missing uploadUrl", async () => {
    const { uploadClient, widgetMgr, widgetInfo } = createMocks()
    const file = createMockFile("test.txt")

    // Return a file URL without uploadUrl - this should trigger the failedUploads path
    vi.mocked(uploadClient.fetchFileURLs).mockResolvedValue([
      { fileId: "file-1", uploadUrl: undefined, deleteUrl: "delete-url" },
    ])

    const result = await uploadFiles({
      files: [file],
      uploadClient,
      widgetMgr,
      widgetInfo,
    })

    expect(result.successfulUploads).toHaveLength(0)
    expect(result.failedUploads).toHaveLength(1)
    expect(result.failedUploads[0].file).toBe(file)
    expect(result.failedUploads[0].error.message).toBe("No upload URL found")
    expect(uploadClient.uploadFile).not.toHaveBeenCalled()
  })

  it("records failed uploads when file URL is missing fileId", async () => {
    const { uploadClient, widgetMgr, widgetInfo } = createMocks()
    const file = createMockFile("test.txt")

    vi.mocked(uploadClient.fetchFileURLs).mockResolvedValue([
      { fileId: undefined, uploadUrl: "upload-url", deleteUrl: "delete-url" },
    ])

    const result = await uploadFiles({
      files: [file],
      uploadClient,
      widgetMgr,
      widgetInfo,
    })

    expect(result.successfulUploads).toHaveLength(0)
    expect(result.failedUploads).toHaveLength(1)
    expect(result.failedUploads[0].error.message).toBe("No upload URL found")
  })

  it("successfully uploads files with valid URLs", async () => {
    const { uploadClient, widgetMgr, widgetInfo } = createMocks()
    const file = createMockFile("test.txt")

    vi.mocked(uploadClient.fetchFileURLs).mockResolvedValue([
      { fileId: "file-1", uploadUrl: "upload-url", deleteUrl: "delete-url" },
    ])
    vi.mocked(uploadClient.uploadFile).mockResolvedValue(undefined)

    const result = await uploadFiles({
      files: [file],
      uploadClient,
      widgetMgr,
      widgetInfo,
    })

    expect(result.successfulUploads).toHaveLength(1)
    expect(result.failedUploads).toHaveLength(0)
    expect(uploadClient.uploadFile).toHaveBeenCalledOnce()
    expect(widgetMgr.setFileUploaderStateValue).toHaveBeenCalledOnce()
  })

  it("handles mixed success and failure when some URLs are missing", async () => {
    const { uploadClient, widgetMgr, widgetInfo } = createMocks()
    const file1 = createMockFile("good.txt")
    const file2 = createMockFile("bad.txt")

    vi.mocked(uploadClient.fetchFileURLs).mockResolvedValue([
      { fileId: "file-1", uploadUrl: "upload-url-1", deleteUrl: "delete-url" },
      { fileId: "file-2", uploadUrl: undefined, deleteUrl: "delete-url" }, // Missing uploadUrl
    ])
    vi.mocked(uploadClient.uploadFile).mockResolvedValue(undefined)

    const result = await uploadFiles({
      files: [file1, file2],
      uploadClient,
      widgetMgr,
      widgetInfo,
    })

    expect(result.successfulUploads).toHaveLength(1)
    expect(result.successfulUploads[0].file).toBe(file1)
    expect(result.failedUploads).toHaveLength(1)
    expect(result.failedUploads[0].file).toBe(file2)
    expect(result.failedUploads[0].error.message).toBe("No upload URL found")
  })

  it("records failed uploads when uploadFile throws", async () => {
    const { uploadClient, widgetMgr, widgetInfo } = createMocks()
    const file = createMockFile("test.txt")

    vi.mocked(uploadClient.fetchFileURLs).mockResolvedValue([
      { fileId: "file-1", uploadUrl: "upload-url", deleteUrl: "delete-url" },
    ])
    vi.mocked(uploadClient.uploadFile).mockRejectedValue(
      new Error("Upload failed")
    )

    const result = await uploadFiles({
      files: [file],
      uploadClient,
      widgetMgr,
      widgetInfo,
    })

    expect(result.successfulUploads).toHaveLength(0)
    expect(result.failedUploads).toHaveLength(1)
    expect(result.failedUploads[0].error.message).toBe("Upload failed")
  })
})
