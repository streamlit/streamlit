/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react"
import { shallow } from "enzyme"
import { fromJS } from "immutable"

import { ImageList, Props } from "./ImageList"

const getProps = (elementProps: object = {}): Props => ({
  element: fromJS({
    imgs: [
      {
        caption: "a",
        url:
          "/media/e275965f8926e17fa8c92c6530be58be11cf5a55474619c16f5442f9.jpeg",
      },
      {
        caption: "b",
        url:
          "/media/e275965f8926e17fa8c92c6530be58be11cf5a55474619c16f5442f9.jpeg",
      },
    ],
    width: -1,
    ...elementProps,
  }),
  width: 0,
})

describe("ImageList Element", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<ImageList {...props} />)

    expect(wrapper.find(".stImage").length).toBe(2)
  })

  it("should overwrite the image width from props", () => {
    const props = {
      ...getProps({
        width: -2,
      }),
      width: 200,
    }
    const wrapper = shallow(<ImageList {...props} />)

    wrapper.find(".stImage").forEach(imageWrapper => {
      // @ts-ignore
      expect(imageWrapper.prop("style").width).toBe(200)
    })
  })

  it("should render explicit width for each image", () => {
    const props = {
      ...getProps({
        width: 300,
      }),
      width: 1,
    }
    const wrapper = shallow(<ImageList {...props} />)

    wrapper.find(".stImage").forEach(imageWrapper => {
      // @ts-ignore
      expect(imageWrapper.prop("style").width).toBe(300)
    })
  })

  it("should have a src", () => {
    const props = getProps()
    const wrapper = shallow(<ImageList {...props} />)

    const imgs = props.element.get("imgs").toJS()
    wrapper.find(".stImage img").forEach((imgWrapper, id) => {
      // @ts-ignore
      expect(imgWrapper.prop("src")).toBe(`http://localhost:80${imgs[id].url}`)
    })
  })

  it("should have a caption", () => {
    const props = getProps()
    const wrapper = shallow(<ImageList {...props} />)

    const imgs = props.element.get("imgs").toJS()
    wrapper.find(".stImage .caption").forEach((captionWrapper, id) => {
      // @ts-ignore
      expect(captionWrapper.text()).toBe(` ${imgs[id].caption} `)
    })
  })

  it("should render absolute src", () => {
    const props = getProps({
      imgs: [
        {
          caption: "a",
          url: "https://streamlit.io/path/test.jpg",
        },
      ],
    })
    const wrapper = shallow(<ImageList {...props} />)

    const imgs = props.element.get("imgs").toJS()
    wrapper.find(".stImage img").forEach((imgWrapper, id) => {
      // @ts-ignore
      expect(imgWrapper.prop("src")).toBe(imgs[id].url)
    })
  })
})
