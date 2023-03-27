/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
import { shallow } from "src/lib/test_util"

import { ImageList as ImageListProto } from "src/autogen/proto"
import { mockEndpoints } from "src/lib/mocks/mocks"
import { ImageList, ImageListProps } from "./ImageList"

describe("ImageList Element", () => {
  const buildMediaURL = jest.fn().mockReturnValue("https://mock.media.url")

  const getProps = (
    elementProps: Partial<ImageListProto> = {}
  ): ImageListProps => ({
    element: ImageListProto.create({
      imgs: [
        {
          caption: "a",
          url: "/media/mockImage1.jpeg",
        },
        {
          caption: "b",
          url: "/media/mockImage2.jpeg",
        },
      ],
      width: -1,
      ...elementProps,
    }),
    endpoints: mockEndpoints({ buildMediaURL: buildMediaURL }),
    width: 0,
    isFullScreen: false,
  })

  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<ImageList {...props} />)

    expect(wrapper.find("StyledImageContainer").length).toBe(2)
  })

  it("renders explicit width for each image", () => {
    const props = getProps({ width: 300 })
    const wrapper = shallow(<ImageList {...props} />)

    expect(wrapper.find("StyledImageContainer").length).toEqual(2)
  })

  it("creates its `src` attribute using buildMediaURL", () => {
    const props = getProps()
    const wrapper = shallow(<ImageList {...props} />)

    expect(wrapper.find("StyledImageContainer").length).toEqual(2)
    expect(buildMediaURL).toHaveBeenNthCalledWith(1, "/media/mockImage1.jpeg")
    expect(buildMediaURL).toHaveBeenNthCalledWith(2, "/media/mockImage2.jpeg")
    wrapper
      .find("StyledImageContainer")
      .find("img")
      .forEach(imgWrapper => {
        expect(imgWrapper.prop("src")).toBe("https://mock.media.url")
      })
  })

  it("has a caption", () => {
    const props = getProps()
    const wrapper = shallow(<ImageList {...props} />)

    const { imgs } = props.element
    expect(wrapper.find("StyledCaption").length).toEqual(2)
    wrapper.find("StyledCaption").forEach((captionWrapper, id) => {
      expect(captionWrapper.text()).toBe(` ${imgs[id].caption} `)
    })
  })

  it("renders explicit width for each caption", () => {
    const props = getProps({ width: 300 })
    const captionWidth = { width: 300 }
    const wrapper = shallow(<ImageList {...props} />)

    wrapper.find("StyledCaption").forEach(captionWrapper => {
      expect(captionWrapper.prop("style")).toStrictEqual(captionWidth)
    })
  })

  describe("fullScreen", () => {
    const props = { ...getProps(), isFullScreen: true, height: 100 }
    const wrapper = shallow(<ImageList {...props} />)

    it("has a caption", () => {
      expect(wrapper.find("StyledCaption").length).toBe(2)
    })

    it("has the proper style", () => {
      const fullScreenAppearance = { maxHeight: 100, "object-fit": "contain" }

      expect(wrapper.find("StyledImageContainer").length).toEqual(2)
      wrapper
        .find("StyledImageContainer")
        .find("img")
        .forEach(imgWrapper => {
          expect(imgWrapper.prop("style")).toStrictEqual(fullScreenAppearance)
        })
    })
  })
})
