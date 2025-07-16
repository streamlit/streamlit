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

import { screen } from "@testing-library/react"
import createFetchMock from "vitest-fetch-mock"

import {
  CameraInput as CameraInputProto,
  FileURLs as FileURLsProto,
  LabelVisibilityMessage as LabelVisibilityMessageProto,
} from "@streamlit/protobuf"

import * as UseResizeObserver from "~lib/hooks/useResizeObserver"
import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import CameraInput, { Props } from "./CameraInput"

vi.mock("react-webcam")
const fetchMocker = createFetchMock(vi)

const getProps = (
  elementProps: Partial<CameraInputProto> = {},
  props: Partial<Props> = {}
): Props => {
  return {
    element: CameraInputProto.create({
      id: "id",
      label: "test_label",
      help: "help",
      formId: "",
      ...elementProps,
    }),
    width: 0,
    disabled: false,
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
    ...props,
  }
}

describe("CameraInput widget", () => {
  fetchMocker.enableMocks()

  beforeEach(() => {
    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [250],
    })
  })

  it("renders without crashing", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setFileUploaderStateValue")
    render(<CameraInput {...props} />)
    const cameraInput = screen.getByTestId("stCameraInput")
    expect(cameraInput).toBeInTheDocument()
    expect(cameraInput).toHaveClass("stCameraInput")

    expect(screen.getByText("Take Photo")).toBeInTheDocument()
    // WidgetStateManager should have been called on mounting
    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledTimes(1)
  })

  it("shows a label", () => {
    const props = getProps()
    render(<CameraInput {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveTextContent(
      props.element.label
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    render(<CameraInput {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle(
      "visibility: hidden"
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    render(<CameraInput {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle("display: none")
  })
})
