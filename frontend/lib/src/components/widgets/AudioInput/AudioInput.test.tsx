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

import React from "react"

import "@testing-library/jest-dom"
import { screen } from "@testing-library/react"
import AudioInput, { Props } from "./AudioInput"
import {
  AudioInput as AudioInputProto,
  FileURLs as FileURLsProto,
} from "src/proto"
import { render } from "@streamlit/lib/src/test_util"

const getProps = (
  elementProps: Partial<AudioInputProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: AudioInputProto.create({
    id: "1",
    label: "Label",
    ...elementProps,
  }),
  // @ts-expect-error
  uploadClient: {
    uploadFile: jest.fn().mockImplementation(() => {
      return Promise.resolve()
    }),
    fetchFileURLs: jest.fn().mockImplementation((acceptedFiles: File[]) => {
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
    deleteFile: jest.fn(),
  },
  ...widgetProps,
})

beforeAll(() => {
  global.MediaStream = jest.fn()

  Object.defineProperty(global.navigator, "mediaDevices", {
    value: {
      getUserMedia: jest.fn().mockResolvedValue(new MediaStream()),
    },
  })
})

describe("Audio Input widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<AudioInput {...props} />)

    const audioInputWidget = screen.getByTestId("stAudioInput")
    expect(audioInputWidget).toBeInTheDocument()
  })
})
