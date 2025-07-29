/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import React from "react"

import { screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import {
  ChatInput as ChatInputProto,
  FileURLs as FileURLsProto,
  IChatInputValue,
} from "@streamlit/protobuf"

import ChatInput, { Props } from "./ChatInput"

import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"
import * as UseResizeObserver from "~lib/hooks/useResizeObserver"

const getProps = (
  elementProps: Partial<ChatInputProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: ChatInputProto.create({
    id: "123",
    placeholder: "Enter Text Here",
    disabled: false,
    default: "",
    acceptFile: ChatInputProto.AcceptFile.NONE,
    ...elementProps,
  }),
  width: 300,
  disabled: elementProps.disabled ?? false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
  // @ts-expect-error
  uploadClient: {
    uploadFile: vi.fn().mockImplementation(() => {
      return Promise.resolve()
    }),
    fetchFileURLs: vi.fn().mockImplementation((acceptedFiles: File[]) => {
      return Promise.resolve(
        acceptedFiles.map(file => {
          return new FileURLsProto({
            fileId: file.name,
            uploadUrl: file.name,
            deleteUrl: file.name,
          })
        })
      )
    }),
    deleteFile: vi.fn(),
  },
  ...widgetProps,
})

const mockChatInputValue = (text: string): IChatInputValue => {
  return {
    data: text,
    fileUploaderState: {
      uploadedFileInfo: [],
    },
  }
}

describe("ChatInput widget", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [250],
    })
  })

  it("renders without crashing", () => {
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).toBeInTheDocument()
  })

  it("shows a placeholder", () => {
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).toHaveAttribute("placeholder", props.element.placeholder)
  })

  it("sets the aria label to the placeholder", () => {
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).toHaveAttribute("aria-label", props.element.placeholder)
  })

  it("sets the value initially to the element default", () => {
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).toHaveTextContent(props.element.default)
  })

  it("sets the value when values are typed in", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    await user.type(chatInput, "Sample text")
    expect(chatInput).toHaveTextContent("Sample text")
  })

  it("does not increase text value when maxChars is set", async () => {
    const user = userEvent.setup()
    const props = getProps({ maxChars: 10 })
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    await user.type(chatInput, "1234567890")
    expect(chatInput).toHaveTextContent("1234567890")
    await user.type(chatInput, "1")
    expect(chatInput).toHaveTextContent("1234567890")
  })

  it("sends and resets the value on enter", async () => {
    const user = userEvent.setup()
    const props = getProps()
    const spy = vi.spyOn(props.widgetMgr, "setChatInputValue")
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    await user.type(chatInput, "1234567890{enter}")
    expect(spy).toHaveBeenCalledWith(
      props.element,
      mockChatInputValue("1234567890"),
      {
        fromUi: true,
      },
      undefined
    )
    expect(chatInput).toHaveTextContent("")
  })

  it("ensures chat input has focus on submit by keyboard", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    await user.type(chatInput, "1234567890{enter}")
    expect(chatInput).toHaveFocus()
  })

  it("ensures chat input has focus on submit by button click", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    const chatButton = screen.getByTestId("stChatInputSubmitButton")
    await user.type(chatInput, "1234567890")
    await user.click(chatButton)
    expect(chatInput).toHaveFocus()
  })

  it("can set fragmentId when sending value", async () => {
    const user = userEvent.setup()
    const props = getProps(undefined, { fragmentId: "myFragmentId" })
    const spy = vi.spyOn(props.widgetMgr, "setChatInputValue")
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    await user.type(chatInput, "1234567890{enter}")
    expect(spy).toHaveBeenCalledWith(
      props.element,
      mockChatInputValue("1234567890"),
      {
        fromUi: true,
      },
      "myFragmentId"
    )
  })

  it("will not send an empty value on enter if empty", async () => {
    const user = userEvent.setup()
    const props = getProps()
    const spy = vi.spyOn(props.widgetMgr, "setChatInputValue")
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    await user.type(chatInput, "{enter}")
    expect(spy).not.toHaveBeenCalledWith(props.element, "", {
      fromUi: true,
    })
    expect(chatInput).toHaveTextContent("")
  })

  it("will not show instructions when the text has changed", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    const instructions = screen.getByTestId("InputInstructions")
    expect(instructions).toHaveTextContent("")

    await user.type(chatInput, "1234567890")
    expect(instructions).toHaveTextContent("")
  })

  it("does not send/clear on shift + enter", async () => {
    const user = userEvent.setup()
    const props = getProps()
    const spy = vi.spyOn(props.widgetMgr, "setChatInputValue")
    render(<ChatInput {...props} />)
    const chatInput = screen.getByTestId("stChatInputTextArea")

    await user.type(chatInput, "1234567890")
    expect(chatInput).toHaveTextContent("1234567890")
    await user.type(chatInput, "{shift>}{enter}{/shift}")
    expect(chatInput).not.toHaveTextContent("")
    expect(spy).not.toHaveBeenCalled()
  })

  it("does not send/clear on ctrl + enter", async () => {
    const user = userEvent.setup()
    const props = getProps()
    const spy = vi.spyOn(props.widgetMgr, "setChatInputValue")
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    await user.type(chatInput, "1234567890")
    expect(chatInput).toHaveTextContent("1234567890")

    await user.keyboard("{Control>}{Enter}{/Control}")

    // We cannot test the value to be changed cause that is essentially a
    // change event.
    expect(screen.getByTestId("stChatInputTextArea")).not.toHaveTextContent("")
    expect(spy).not.toHaveBeenCalled()
  })

  it("does not send/clear on meta + enter", async () => {
    const user = userEvent.setup()
    const props = getProps()
    const spy = vi.spyOn(props.widgetMgr, "setChatInputValue")
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    await user.type(chatInput, "1234567890")
    expect(chatInput).toHaveTextContent("1234567890")
    await user.type(chatInput, "{meta>}{enter}{/meta}")
    expect(chatInput).not.toHaveTextContent("")
    expect(spy).not.toHaveBeenCalled()
  })

  it("does sets the value if specified from protobuf to set it", () => {
    const props = getProps({ value: "12345", setValue: true })
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).toHaveTextContent("12345")
  })

  it("does not set the value if protobuf does not specify to set it", () => {
    const props = getProps({ value: "12345", setValue: false })
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).toHaveTextContent("")
  })

  it("disables the textarea and button", () => {
    const props = getProps({
      disabled: true,
      acceptFile: ChatInputProto.AcceptFile.SINGLE,
    })
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).toBeDisabled()

    screen.getAllByRole("button").forEach(button => {
      expect(button).toBeDisabled()
    })
  })

  it("not disable the textarea by default", () => {
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).not.toBeDisabled()

    const button = screen.getByRole("button")
    expect(button).toBeDisabled()
  })

  it("disables the send button by default since there's no text", () => {
    const props = getProps()
    render(<ChatInput {...props} />)

    const button = screen.getByRole("button")
    expect(button).toBeDisabled()
  })

  it("enables the send button when text is set, disables it when removed", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    await user.type(chatInput, "Sample text")

    const button = screen.getByRole("button")
    expect(button).not.toBeDisabled()

    await user.clear(chatInput)
    expect(button).toBeDisabled()
  })

  describe("dirty state behavior", () => {
    it("disables submit button when there are no files and no text", () => {
      const props = getProps()
      render(<ChatInput {...props} />)

      const button = screen.getByTestId("stChatInputSubmitButton")
      expect(button).toBeDisabled()
    })

    it("enables submit button when there is text", async () => {
      const user = userEvent.setup()
      const props = getProps()
      render(<ChatInput {...props} />)

      const chatInput = screen.getByTestId("stChatInputTextArea")
      await user.type(chatInput, "Hello")

      const button = screen.getByTestId("stChatInputSubmitButton")
      expect(button).not.toBeDisabled()
    })

    it("disables submit button when files are uploading", async () => {
      const user = userEvent.setup()
      const props = getProps({
        acceptFile: ChatInputProto.AcceptFile.SINGLE,
        maxUploadSizeMb: 1,
      })

      // Mock the uploadClient to simulate an uploading file
      props.uploadClient.uploadFile = vi.fn().mockImplementation(() => {
        return new Promise(() => {}) // Never resolves to simulate ongoing upload
      })

      render(<ChatInput {...props} />)

      // Add text to make the button enabled
      const chatInput = screen.getByTestId("stChatInputTextArea")
      await user.type(chatInput, "Text with uploading file")

      // Verify button is enabled before file upload
      const submitButton = screen.getByTestId("stChatInputSubmitButton")
      expect(submitButton).not.toBeDisabled()

      // Simulate file upload
      const file = new File(["file content"], "test.txt", {
        type: "text/plain",
      })
      const fileUploadButton = screen.getByTestId(
        "stChatInputFileUploadButton"
      )
      // The `input` element isn't accessible, so we need to access it directly via the DOM
      const fileUploadInput = fileUploadButton.querySelector("input")
      if (!fileUploadInput) {
        throw new Error("File upload input not found")
      }
      await user.upload(fileUploadInput, file)

      // Button should be disabled during upload - no need to wait for upload to finish
      // since we're specifically testing the in-between state
      expect(submitButton).toBeDisabled()

      // Verify the upload was attempted
      expect(props.uploadClient.uploadFile).toHaveBeenCalled()
    })

    it("does not submit when dirty is false", async () => {
      const user = userEvent.setup()
      const props = getProps()
      const spy = vi.spyOn(props.widgetMgr, "setChatInputValue")
      render(<ChatInput {...props} />)

      const chatInput = screen.getByTestId("stChatInputTextArea")
      const button = screen.getByTestId("stChatInputSubmitButton")

      // Button should be disabled initially
      expect(button).toBeDisabled()

      // Try to submit by clicking the button
      await user.click(button)
      expect(spy).not.toHaveBeenCalled()

      // Try to submit by pressing Enter
      await user.type(chatInput, "{enter}")
      expect(spy).not.toHaveBeenCalled()
    })
  })

  it("renders directory upload UI correctly", () => {
    const props = getProps({
      acceptFile: ChatInputProto.AcceptFile.DIRECTORY,
      fileType: ["txt", "py", "md"],
    })

    render(<ChatInput {...props} />)

    // Check that file upload button is visible for directory uploads
    const uploadButton = screen.getByTestId("stChatInputFileUploadButton")
    expect(uploadButton).toBeInTheDocument()

    // Verify aria labels and accessibility
    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).toBeInTheDocument()
  })

  it("handles directory upload with multiple files", async () => {
    const user = userEvent.setup()
    const mockSetChatInputValue = vi.fn()
    const mockWidgetMgr = new WidgetStateManager({
      sendRerunBackMsg: vi.fn(),
      formsDataChanged: vi.fn(),
    })
    mockWidgetMgr.setChatInputValue = mockSetChatInputValue

    const props = getProps(
      {
        acceptFile: ChatInputProto.AcceptFile.DIRECTORY,
        fileType: ["txt", "py", "md"],
      },
      {
        widgetMgr: mockWidgetMgr,
      }
    )

    render(<ChatInput {...props} />)

    // Simulate directory file upload
    const directoryFiles = [
      new File(["print('hello')"], "project/main.py", {
        type: "text/plain",
        lastModified: 0,
      }),
      new File(["def test(): pass"], "project/tests/test_main.py", {
        type: "text/plain",
        lastModified: 0,
      }),
      new File(["# Project"], "project/README.md", {
        type: "text/plain",
        lastModified: 0,
      }),
    ]

    // Find the file input and simulate file selection
    const fileInput = screen
      .getByTestId("stChatInputTextArea")
      .querySelector('input[type="file"]')
    expect(fileInput).toBeInTheDocument()

    if (fileInput) {
      // Upload files using userEvent
      await user.upload(fileInput as HTMLElement, directoryFiles)
    }

    await waitFor(() => {
      // Files should be processed for upload
      expect(props.uploadClient.uploadFile).toHaveBeenCalledTimes(3)
    })

    // Verify files are displayed in UI
    const uploadedFiles = screen.getByTestId("stChatUploadedFiles")
    expect(uploadedFiles).toBeInTheDocument()

    // Type a message
    const textarea = screen.getByTestId("stChatInputTextArea")
    await user.type(textarea, "Here are the project files")

    // Submit the chat input
    const submitButton = screen.getByTestId("stChatInputSubmitButton")
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockSetChatInputValue).toHaveBeenCalledWith(
        props.element,
        expect.objectContaining({
          data: "Here are the project files",
          fileUploaderState: expect.any(Object),
        }),
        { fromUi: true },
        undefined
      )
    })

    // Verify input is cleared after submission
    expect(textarea).toHaveTextContent("")
  })

  it("filters directory files by allowed types", async () => {
    const user = userEvent.setup()
    const consoleSpy = vi.spyOn(console, "log")

    const props = getProps({
      acceptFile: ChatInputProto.AcceptFile.DIRECTORY,
      fileType: ["txt"], // Only allow .txt files
    })

    render(<ChatInput {...props} />)

    // Mix of valid and invalid files
    const mixedFiles = [
      new File(["Valid content"], "docs/valid.txt", {
        type: "text/plain",
        lastModified: 0,
      }),
      new File(["Another valid"], "docs/another.txt", {
        type: "text/plain",
        lastModified: 0,
      }),
      new File(["Invalid"], "docs/image.jpg", {
        type: "image/jpeg",
        lastModified: 0,
      }),
      new File(["Also invalid"], "docs/script.py", {
        type: "text/plain",
        lastModified: 0,
      }),
    ]

    const fileInput = screen
      .getByTestId("stChatInputTextArea")
      .querySelector('input[type="file"]')

    if (fileInput) {
      // Upload files using userEvent
      await user.upload(fileInput as HTMLElement, mixedFiles)
    }

    await waitFor(() => {
      // Only 2 valid .txt files should be uploaded
      expect(props.uploadClient.uploadFile).toHaveBeenCalledTimes(2)
    })

    // Verify console message about filtering
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Directory upload: 2 files accepted, 2 files rejected"
      )
    )

    consoleSpy.mockRestore()
  })

  it("handles empty directory upload", async () => {
    const user = userEvent.setup()
    const props = getProps({
      acceptFile: ChatInputProto.AcceptFile.DIRECTORY,
    })

    render(<ChatInput {...props} />)

    const fileInput = screen
      .getByTestId("stChatInputTextArea")
      .querySelector('input[type="file"]')

    if (fileInput) {
      // Simulate empty directory upload
      await user.upload(fileInput as HTMLElement, [])
    }

    await waitFor(() => {
      // No uploads should occur for empty directory
      expect(props.uploadClient.uploadFile).not.toHaveBeenCalled()
    })

    // Should still be able to type and submit message
    const textarea = screen.getByTestId("stChatInputTextArea")
    await user.type(textarea, "No files to share")

    const submitButton = screen.getByTestId("stChatInputSubmitButton")
    expect(submitButton).toBeEnabled()
  })

  it("displays directory upload instructions correctly", () => {
    const props = getProps({
      acceptFile: ChatInputProto.AcceptFile.DIRECTORY,
    })

    render(<ChatInput {...props} />)

    // Check for directory-specific UI elements
    const uploadButton = screen.getByTestId("stChatInputFileUploadButton")
    expect(uploadButton).toBeInTheDocument()

    // Verify file input has directory attributes
    const fileInput = screen
      .getByTestId("stChatInputTextArea")
      .querySelector('input[type="file"]')
    expect(fileInput).toHaveAttribute("webkitdirectory")
    expect(fileInput).toHaveAttribute("multiple")
  })

  it("removes directory files when deleted individually", async () => {
    const user = userEvent.setup()
    const props = getProps({
      acceptFile: ChatInputProto.AcceptFile.DIRECTORY,
    })

    render(<ChatInput {...props} />)

    // Upload directory files
    const directoryFiles = [
      new File(["File 1"], "dir/file1.txt", { type: "text/plain" }),
      new File(["File 2"], "dir/file2.txt", { type: "text/plain" }),
    ]

    const fileInput = screen
      .getByTestId("stChatInputTextArea")
      .querySelector('input[type="file"]')

    if (fileInput) {
      // Upload directory files
      await user.upload(fileInput as HTMLElement, directoryFiles)
    }

    await waitFor(() => {
      expect(props.uploadClient.uploadFile).toHaveBeenCalledTimes(2)
    })

    // Delete one file
    const deleteButtons = screen.getAllByTestId("stChatInputDeleteBtn")
    expect(deleteButtons).toHaveLength(2)

    await user.click(deleteButtons[0])

    await waitFor(() => {
      // Should have one less delete button
      const remainingDeleteButtons = screen.getAllByTestId(
        "stChatInputDeleteBtn"
      )
      expect(remainingDeleteButtons).toHaveLength(1)
    })
  })
})
