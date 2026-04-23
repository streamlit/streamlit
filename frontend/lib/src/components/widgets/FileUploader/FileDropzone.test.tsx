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

import {
  createEvent,
  fireEvent,
  screen,
  waitFor,
} from "@testing-library/react"

import { render } from "~lib/test_util"

import FileDropzone, { Props } from "./FileDropzone"
import { STREAMLIT_MIME_TYPE } from "./utils"

const getProps = (props: Partial<Props> = {}): Props => ({
  disabled: false,
  label: "LABEL",
  onDrop: vi.fn(),
  multiple: true,
  acceptedTypes: [],
  maxSizeBytes: 200,
  ...props,
})

describe("FileDropzone widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<FileDropzone {...props} />)

    expect(screen.getByTestId("stFileUploaderDropzone")).toBeInTheDocument()
  })

  it("renders dropzone without extensions", () => {
    const props = getProps({
      acceptedTypes: [],
    })
    render(<FileDropzone {...props} />)
    expect(
      screen.queryByTestId("stFileUploaderDropzoneInput")
    ).not.toHaveAttribute("accept")
  })

  it("renders dropzone with extensions", () => {
    const props = getProps({
      acceptedTypes: [".jpg"],
    })
    render(<FileDropzone {...props} />)
    expect(
      screen.queryByTestId("stFileUploaderDropzoneInput")
    ).toHaveAttribute("accept", [STREAMLIT_MIME_TYPE, ".jpg"].join(","))
  })

  it("renders directory upload button with correct text", () => {
    const props = getProps({
      acceptDirectory: true,
    })
    render(<FileDropzone {...props} />)

    const button = screen.getByRole("button")
    expect(button).toHaveTextContent("Upload directories")
  })

  it("renders regular file upload button text when not directory mode", () => {
    const props = getProps({
      acceptDirectory: false,
    })
    render(<FileDropzone {...props} />)

    const button = screen.getByRole("button")
    expect(button).toHaveTextContent("Upload")
  })

  it("sets webkitdirectory attribute for directory uploads", () => {
    const props = getProps({
      acceptDirectory: true,
    })
    render(<FileDropzone {...props} />)

    const input = screen.getByTestId("stFileUploaderDropzoneInput")
    expect(input).toHaveAttribute("webkitdirectory", "")
  })

  it("sets multiple attribute for directory uploads", () => {
    const props = getProps({
      acceptDirectory: true,
      multiple: false, // Even if multiple is false, directory mode should force it to true
    })
    render(<FileDropzone {...props} />)

    const input = screen.getByTestId("stFileUploaderDropzoneInput")
    expect(input).toHaveAttribute("multiple")
  })

  it("does not set webkitdirectory attribute for regular file uploads", () => {
    const props = getProps({
      acceptDirectory: false,
    })
    render(<FileDropzone {...props} />)

    const input = screen.getByTestId("stFileUploaderDropzoneInput")
    expect(input).not.toHaveAttribute("webkitdirectory")
  })

  it("disables directory upload button when disabled", () => {
    const props = getProps({
      acceptDirectory: true,
      disabled: true,
    })
    render(<FileDropzone {...props} />)

    const button = screen.getByRole("button")
    expect(button).toBeDisabled()
  })

  it("renders uploaded files when hasFiles is true", () => {
    const props = getProps({
      uploadedFiles: <div data-testid="mockUploadedFiles">files here</div>,
      hasFiles: true,
    })
    render(<FileDropzone {...props} />)

    expect(screen.getByTestId("mockUploadedFiles")).toBeInTheDocument()
    expect(
      screen.queryByTestId("stFileUploaderDropzoneInstructions")
    ).not.toBeInTheDocument()
  })

  it("renders instructions and upload button when hasFiles is false", () => {
    const props = getProps({
      uploadedFiles: <div data-testid="mockUploadedFiles">files here</div>,
      hasFiles: false,
    })
    render(<FileDropzone {...props} />)

    expect(screen.queryByTestId("mockUploadedFiles")).not.toBeInTheDocument()
    expect(
      screen.getByTestId("stFileUploaderDropzoneInstructions")
    ).toBeInTheDocument()
    expect(screen.getByRole("button")).toBeInTheDocument()
  })

  it("renders instructions when uploadedFiles is not provided", () => {
    const props = getProps()
    render(<FileDropzone {...props} />)

    expect(
      screen.getByTestId("stFileUploaderDropzoneInstructions")
    ).toBeInTheDocument()
    expect(screen.getByRole("button")).toBeInTheDocument()
  })

  it("shows drag overlay with plural text when multiple is true", async () => {
    const props = getProps({ multiple: true })
    render(<FileDropzone {...props} />)

    const dropzone = screen.getByTestId("stFileUploaderDropzone")

    const dragEvent = createEvent.dragEnter(dropzone)
    Object.defineProperty(dragEvent, "dataTransfer", {
      value: {
        types: ["Files"],
        items: [{ kind: "file", type: "text/plain" }],
      },
    })
    fireEvent(dropzone, dragEvent)

    await waitFor(() => {
      expect(screen.getByText("Drag and drop files here")).toBeInTheDocument()
    })
  })

  it("shows drag overlay with singular text when multiple is false", async () => {
    const props = getProps({ multiple: false })
    render(<FileDropzone {...props} />)

    const dropzone = screen.getByTestId("stFileUploaderDropzone")

    const dragEvent = createEvent.dragEnter(dropzone)
    Object.defineProperty(dragEvent, "dataTransfer", {
      value: {
        types: ["Files"],
        items: [{ kind: "file", type: "text/plain" }],
      },
    })
    fireEvent(dropzone, dragEvent)

    await waitFor(() => {
      expect(screen.getByText("Drag and drop a file here")).toBeInTheDocument()
    })
  })

  it("shows drag overlay with directories text when acceptDirectory is true", async () => {
    const props = getProps({ acceptDirectory: true })
    render(<FileDropzone {...props} />)

    const dropzone = screen.getByTestId("stFileUploaderDropzone")

    const dragEvent = createEvent.dragEnter(dropzone)
    Object.defineProperty(dragEvent, "dataTransfer", {
      value: {
        types: ["Files"],
        items: [{ kind: "file", type: "text/plain" }],
      },
    })
    fireEvent(dropzone, dragEvent)

    await waitFor(() => {
      expect(
        screen.getByText("Drag and drop directories here")
      ).toBeInTheDocument()
    })
  })

  it("does not show drag overlay by default", () => {
    const props = getProps()
    render(<FileDropzone {...props} />)

    expect(
      screen.queryByText("Drag and drop files here")
    ).not.toBeInTheDocument()
  })
})
