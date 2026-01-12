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

import { screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { UploadFileInfo } from "~lib/components/widgets/FileUploader/UploadFileInfo"
import { render } from "~lib/test_util"

import ChatUploadedFile, { Props } from "./ChatUploadedFile"

const mockCreateObjectURL = vi.fn()
const mockRevokeObjectURL = vi.fn()

vi.stubGlobal("URL", {
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL,
})

const createUploadedFileInfo = (
  name: string,
  size: number,
  id: number,
  file?: File
): UploadFileInfo =>
  new UploadFileInfo(
    name,
    size,
    id,
    {
      type: "uploaded",
      fileId: "file-123",
      fileUrls: {},
    },
    file
  )

const createErrorFileInfo = (
  name: string,
  size: number,
  id: number,
  errorMessage: string,
  file?: File
): UploadFileInfo =>
  new UploadFileInfo(
    name,
    size,
    id,
    {
      type: "error",
      errorMessage,
    },
    file
  )

const createUploadingFileInfo = (
  name: string,
  size: number,
  id: number
): UploadFileInfo =>
  new UploadFileInfo(name, size, id, {
    type: "uploading",
    abortController: new AbortController(),
    progress: 50,
  })

describe("ChatUploadedFile", () => {
  beforeEach(() => {
    mockCreateObjectURL.mockReturnValue("blob:http://localhost/mock-blob-url")
  })

  afterEach(() => {
    mockCreateObjectURL.mockClear()
    mockRevokeObjectURL.mockClear()
  })

  const defaultProps: Props = {
    fileInfo: createUploadedFileInfo("test.txt", 1024, 1),
    onDelete: vi.fn(),
  }

  it("renders uploaded file with correct aria-label", () => {
    render(<ChatUploadedFile {...defaultProps} />)

    const fileChip = screen.getByTestId("stChatInputFile")
    expect(fileChip).toHaveAttribute("aria-label", "test.txt, 1.0KB")
  })

  it("does not have aria-invalid when file is uploaded successfully", () => {
    render(<ChatUploadedFile {...defaultProps} />)

    const fileChip = screen.getByTestId("stChatInputFile")
    expect(fileChip).not.toHaveAttribute("aria-invalid")
    expect(fileChip).not.toHaveAttribute("aria-describedby")
  })

  describe("error state accessibility", () => {
    const errorMessage = "File type not allowed"
    const errorProps: Props = {
      fileInfo: createErrorFileInfo("test.json", 512, 2, errorMessage),
      onDelete: vi.fn(),
    }

    it("sets aria-invalid=true when file has error", () => {
      render(<ChatUploadedFile {...errorProps} />)

      const fileChip = screen.getByTestId("stChatInputFile")
      expect(fileChip).toHaveAttribute("aria-invalid", "true")
    })

    it("keeps aria-label stable with file size (not error) to avoid double announcements", () => {
      render(<ChatUploadedFile {...errorProps} />)

      const fileChip = screen.getByTestId("stChatInputFile")
      expect(fileChip).toHaveAttribute("aria-label", "test.json, 0.5KB")
    })

    it("has aria-describedby linking to visually hidden error message", () => {
      render(<ChatUploadedFile {...errorProps} />)

      const fileChip = screen.getByTestId("stChatInputFile")
      const describedById = fileChip.getAttribute("aria-describedby")
      expect(describedById).toBeTruthy()

      // Verify the linked element exists and contains the error message
      const errorElement = document.getElementById(describedById as string)
      expect(errorElement).toBeInTheDocument()
      expect(errorElement).toHaveTextContent(`Error: ${errorMessage}`)
    })

    it("renders visually hidden error message with role=alert", () => {
      render(<ChatUploadedFile {...errorProps} />)

      const alertElement = screen.getByRole("alert")
      expect(alertElement).toBeInTheDocument()
      expect(alertElement).toHaveTextContent(`Error: ${errorMessage}`)
    })

    it("does not render alert element when file is not in error state", () => {
      render(<ChatUploadedFile {...defaultProps} />)

      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })
  })

  describe("retry functionality", () => {
    it("makes error chip clickable when onRetry is provided and file exists", async () => {
      const user = userEvent.setup()
      const onRetry = vi.fn()
      const file = new File(["content"], "test.json", {
        type: "application/json",
      })
      const props: Props = {
        fileInfo: createErrorFileInfo(
          "test.json",
          512,
          2,
          "File type not allowed",
          file
        ),
        onDelete: vi.fn(),
        onRetry,
      }

      render(<ChatUploadedFile {...props} />)

      const fileChip = screen.getByTestId("stChatInputFile")
      expect(fileChip).toHaveAttribute("role", "button")
      expect(fileChip).toHaveAttribute("tabindex", "0")
      expect(fileChip).toHaveAttribute("title", "Click to retry upload")

      await user.click(fileChip)
      expect(onRetry).toHaveBeenCalledWith(props.fileInfo)
    })

    it("supports keyboard activation for retry", async () => {
      const user = userEvent.setup()
      const onRetry = vi.fn()
      const file = new File(["content"], "test.json", {
        type: "application/json",
      })
      const props: Props = {
        fileInfo: createErrorFileInfo(
          "test.json",
          512,
          2,
          "File type not allowed",
          file
        ),
        onDelete: vi.fn(),
        onRetry,
      }

      render(<ChatUploadedFile {...props} />)

      const fileChip = screen.getByTestId("stChatInputFile")
      fileChip.focus()

      await user.keyboard("{Enter}")
      expect(onRetry).toHaveBeenCalledTimes(1)

      await user.keyboard(" ")
      expect(onRetry).toHaveBeenCalledTimes(2)
    })
  })

  describe("delete button", () => {
    it("has correct aria-label for uploaded file", () => {
      render(<ChatUploadedFile {...defaultProps} />)

      const deleteButton = screen.getByRole("button", { name: /remove/i })
      expect(deleteButton).toHaveAttribute("aria-label", "Remove test.txt")
    })

    it("has correct aria-label for uploading file", () => {
      const props: Props = {
        fileInfo: createUploadingFileInfo("uploading.txt", 2048, 3),
        onDelete: vi.fn(),
      }

      render(<ChatUploadedFile {...props} />)

      const deleteButton = screen.getByRole("button", {
        name: /cancel upload/i,
      })
      expect(deleteButton).toHaveAttribute(
        "aria-label",
        "Cancel upload of uploading.txt"
      )
    })

    it("calls onDelete when clicked", async () => {
      const user = userEvent.setup()
      const onDelete = vi.fn()
      const props: Props = {
        ...defaultProps,
        onDelete,
      }

      render(<ChatUploadedFile {...props} />)

      const deleteButton = screen.getByRole("button", { name: /remove/i })
      await user.click(deleteButton)

      expect(onDelete).toHaveBeenCalledWith(1)
    })
  })

  describe("image preview", () => {
    it("renders image preview with correct src and alt for image files", () => {
      const imageFile = new File(["test"], "photo.jpg", { type: "image/jpeg" })
      const props: Props = {
        fileInfo: createUploadedFileInfo("photo.jpg", 2048, 1, imageFile),
        onDelete: vi.fn(),
      }

      render(<ChatUploadedFile {...props} />)

      const imagePreview = screen.getByTestId("stChatInputFileImagePreview")
      expect(imagePreview).toBeVisible()
      expect(imagePreview).toHaveAttribute(
        "src",
        "blob:http://localhost/mock-blob-url"
      )
      expect(imagePreview).toHaveAttribute("alt", "photo.jpg")
    })

    it("does not render image preview for non-image files", () => {
      const pdfFile = new File(["test"], "document.pdf", {
        type: "application/pdf",
      })
      const props: Props = {
        fileInfo: createUploadedFileInfo("document.pdf", 2048, 1, pdfFile),
        onDelete: vi.fn(),
      }

      render(<ChatUploadedFile {...props} />)

      expect(
        screen.queryByTestId("stChatInputFileImagePreview")
      ).not.toBeInTheDocument()
    })

    it("does not render image preview when file object is not provided", () => {
      // This can happen for files that were uploaded in a previous session
      // where we only have the file metadata, not the actual File object
      const props: Props = {
        fileInfo: createUploadedFileInfo("photo.jpg", 2048, 1),
        onDelete: vi.fn(),
      }

      render(<ChatUploadedFile {...props} />)

      expect(
        screen.queryByTestId("stChatInputFileImagePreview")
      ).not.toBeInTheDocument()
    })

    it("revokes blob URL on unmount to prevent memory leaks", () => {
      const imageFile = new File(["test"], "photo.jpg", { type: "image/jpeg" })
      const props: Props = {
        fileInfo: createUploadedFileInfo("photo.jpg", 2048, 1, imageFile),
        onDelete: vi.fn(),
      }

      const { unmount } = render(<ChatUploadedFile {...props} />)

      expect(mockRevokeObjectURL).not.toHaveBeenCalled()

      unmount()

      expect(mockRevokeObjectURL).toHaveBeenCalledWith(
        "blob:http://localhost/mock-blob-url"
      )
    })
  })
})
