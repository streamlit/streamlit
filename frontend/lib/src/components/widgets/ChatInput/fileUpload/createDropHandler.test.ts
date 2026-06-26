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

import { ErrorCode as FileErrorCode, type FileRejection } from "react-dropzone"

import {
  ChatInput as ChatInputProto,
  FileURLs as FileURLsProto,
  type IFileURLs,
} from "@streamlit/protobuf"

import type { UploadFileInfo } from "~lib/components/shared/UploadedFile/UploadFileInfo"
import type { FileUploadClient } from "~lib/FileUploadClient"
import { createTestFile } from "~lib/test_util"
import { getRejectedFileInfo } from "~lib/util/FileHelper"

import { createDropHandler } from "./createDropHandler"
import { validateFileType } from "./fileUploadUtils"

vi.mock("./fileUploadUtils", () => ({
  validateFileType: vi.fn(() => ({ isValid: true })),
}))

vi.mock("~lib/util/FileHelper", () => ({
  getRejectedFileInfo: vi.fn(
    (rejected: FileRejection, id: number) =>
      ({
        id,
        mockRejectedInfo: true,
        name: rejected.file.name,
      }) as unknown as UploadFileInfo
  ),
}))

type DropHandlerParams = Parameters<typeof createDropHandler>[0]

const createMockParams = (
  overrides?: Partial<DropHandlerParams>
): DropHandlerParams => ({
  acceptMultipleFiles: true,
  maxFileSize: 1024 * 1024,
  uploadClient: {
    fetchFileURLs: vi
      .fn()
      .mockImplementation((files: File[]) =>
        Promise.resolve(files.map(() => FileURLsProto.create({})))
      ),
  } as unknown as FileUploadClient,
  uploadFile: vi.fn(),
  addFiles: vi.fn(),
  getNextLocalFileId: vi.fn().mockReturnValue(1),
  deleteExistingFiles: vi.fn(),
  onUploadComplete: vi.fn(),
  element: ChatInputProto.create({ fileType: [] }),
  ...overrides,
})

describe("createDropHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(validateFileType).mockReturnValue({ isValid: true })
  })

  it("calls onUploadComplete after handling files", () => {
    const params = createMockParams()
    const handler = createDropHandler(params)
    const file = createTestFile("doc.txt")

    handler([file], [])

    expect(params.onUploadComplete).toHaveBeenCalledTimes(1)
  })

  it("does not call uploadFile when all files are rejected", () => {
    const maxFileSize = 100
    const fetchFileURLs = vi.fn().mockResolvedValue([])
    const params = createMockParams({
      maxFileSize,
      uploadClient: { fetchFileURLs } as unknown as FileUploadClient,
    })
    const handler = createDropHandler(params)
    const oversized = createTestFile("big.txt", "x".repeat(maxFileSize + 1))

    handler([oversized], [])

    expect(fetchFileURLs).toHaveBeenCalledWith([])
    expect(params.uploadFile).not.toHaveBeenCalled()
  })

  it("filters out files exceeding maxFileSize and adds rejected file info", () => {
    const maxFileSize = 100
    const params = createMockParams({ maxFileSize })
    const handler = createDropHandler(params)
    const oversized = createTestFile("big.txt", "x".repeat(maxFileSize + 1))

    handler([oversized], [])

    expect(getRejectedFileInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        file: oversized,
        errors: expect.arrayContaining([
          expect.objectContaining({ code: FileErrorCode.FileTooLarge }),
        ]),
      }),
      expect.any(Number),
      maxFileSize
    )
    expect(params.addFiles).toHaveBeenCalledWith([
      expect.objectContaining({
        mockRejectedInfo: true,
        name: "big.txt",
      }),
    ])
    expect(params.onUploadComplete).toHaveBeenCalled()
  })

  it("filters out invalid file types via validateFileType", () => {
    vi.mocked(validateFileType).mockImplementation(file =>
      file.name === "invalid.bin"
        ? { isValid: false, errorMessage: "Type not allowed" }
        : { isValid: true }
    )
    const params = createMockParams()
    const handler = createDropHandler(params)
    const badFile = createTestFile(
      "invalid.bin",
      "data",
      "application/octet-stream"
    )

    handler([badFile], [])

    expect(validateFileType).toHaveBeenCalledWith(
      badFile,
      params.element.fileType
    )
    expect(getRejectedFileInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        file: badFile,
        errors: expect.arrayContaining([
          expect.objectContaining({ code: FileErrorCode.FileInvalidType }),
        ]),
      }),
      expect.any(Number),
      params.maxFileSize
    )
    expect(params.addFiles).toHaveBeenCalledWith([
      expect.objectContaining({ name: "invalid.bin", mockRejectedInfo: true }),
    ])
  })

  it("deletes existing files when single file mode and there is an accepted file", () => {
    const params = createMockParams({ acceptMultipleFiles: false })
    const handler = createDropHandler(params)
    const file = createTestFile("solo.txt")

    handler([file], [])

    expect(params.deleteExistingFiles).toHaveBeenCalledTimes(1)
  })

  it("does not delete existing files in multi-file mode", () => {
    const params = createMockParams({ acceptMultipleFiles: true })
    const handler = createDropHandler(params)
    const file = createTestFile("one.txt")

    handler([file], [])

    expect(params.deleteExistingFiles).not.toHaveBeenCalled()
  })

  it("recovers the file from a TooManyFiles rejection when single-file mode and nothing else was accepted", () => {
    const fetchFileURLs = vi.fn().mockResolvedValue([] as IFileURLs[])
    const params = createMockParams({
      acceptMultipleFiles: false,
      uploadClient: { fetchFileURLs } as unknown as FileUploadClient,
    })
    const handler = createDropHandler(params)
    const recoveredFile = createTestFile("first.txt")
    const otherFile = createTestFile("second.txt")
    const rejected: FileRejection[] = [
      {
        file: recoveredFile,
        errors: [
          { code: FileErrorCode.TooManyFiles, message: "Too many files" },
        ],
      },
      {
        file: otherFile,
        errors: [{ code: FileErrorCode.FileInvalidType, message: "bad type" }],
      },
    ]

    handler([], rejected)

    expect(fetchFileURLs).toHaveBeenCalledWith([recoveredFile])
    expect(params.deleteExistingFiles).toHaveBeenCalledTimes(1)
  })

  it("keeps only the first file and rejects the rest in single-file mode when multiple files bypass react-dropzone", () => {
    const fetchFileURLs = vi.fn().mockResolvedValue([] as IFileURLs[])
    const params = createMockParams({
      acceptMultipleFiles: false,
      uploadClient: { fetchFileURLs } as unknown as FileUploadClient,
    })
    const handler = createDropHandler(params)
    const firstFile = createTestFile("first.txt")
    const secondFile = createTestFile("second.txt")

    handler([firstFile, secondFile], [])

    expect(fetchFileURLs).toHaveBeenCalledWith([firstFile])
    expect(getRejectedFileInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        file: secondFile,
        errors: expect.arrayContaining([
          expect.objectContaining({ code: FileErrorCode.TooManyFiles }),
        ]),
      }),
      expect.any(Number),
      params.maxFileSize
    )
  })

  it("keeps all files in multi-file mode when several bypass react-dropzone", () => {
    const fetchFileURLs = vi.fn().mockResolvedValue([] as IFileURLs[])
    const params = createMockParams({
      acceptMultipleFiles: true,
      uploadClient: { fetchFileURLs } as unknown as FileUploadClient,
    })
    const handler = createDropHandler(params)
    const firstFile = createTestFile("first.txt")
    const secondFile = createTestFile("second.txt")

    handler([firstFile, secondFile], [])

    expect(fetchFileURLs).toHaveBeenCalledWith([firstFile, secondFile])
  })

  it("calls uploadClient.fetchFileURLs with accepted files", async () => {
    const file = createTestFile("up.txt")
    const fileURLs = FileURLsProto.create({})
    const fetchFileURLs = vi.fn().mockResolvedValue([fileURLs] as IFileURLs[])
    const params = createMockParams({
      uploadClient: { fetchFileURLs } as unknown as FileUploadClient,
    })
    const handler = createDropHandler(params)

    handler([file], [])

    expect(fetchFileURLs).toHaveBeenCalledWith([file])
    await vi.waitFor(() => {
      expect(params.uploadFile).toHaveBeenCalledWith(fileURLs, file)
    })
  })

  it("handles fetch error by adding error file infos", async () => {
    const file = createTestFile("fail.txt", "body")
    const fetchFileURLs = vi.fn().mockRejectedValue("Upload URLs failed")
    const getNextLocalFileId = vi.fn().mockReturnValue(42)
    const params = createMockParams({
      uploadClient: { fetchFileURLs } as unknown as FileUploadClient,
      getNextLocalFileId,
    })
    const handler = createDropHandler(params)

    handler([file], [])

    await vi.waitFor(() => {
      expect(params.addFiles).toHaveBeenCalledWith([
        expect.objectContaining({
          name: "fail.txt",
          size: file.size,
          id: 42,
          status: { type: "error", errorMessage: "Upload URLs failed" },
          file,
        }),
      ])
    })
  })

  it("adds rejected file infos from react-dropzone rejections", () => {
    const params = createMockParams()
    const handler = createDropHandler(params)
    const rejectedFile = createTestFile("no.txt")
    const rejected: FileRejection[] = [
      {
        file: rejectedFile,
        errors: [
          { code: FileErrorCode.FileInvalidType, message: "not allowed" },
        ],
      },
    ]

    handler([], rejected)

    expect(getRejectedFileInfo).toHaveBeenCalledWith(
      rejected[0],
      expect.any(Number),
      params.maxFileSize
    )
    expect(params.addFiles).toHaveBeenCalledWith([
      expect.objectContaining({
        mockRejectedInfo: true,
        name: "no.txt",
      }),
    ])
  })
})
