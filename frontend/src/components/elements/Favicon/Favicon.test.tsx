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
import { mount } from "enzyme"
import { fromJS } from "immutable"

import { Favicon, Props } from "./Favicon"

const getProps = (elementProps: object = {}): Props => ({
  element: fromJS({
    url: "https://streamlit.io/path/to/favicon.png",
    ...elementProps,
  }),
})

// Overwrite bounding box code for testing (https://stackoverflow.com/a/52146902)
const mockedRect = {
  x: 0,
  y: 0,
  bottom: 0,
  left: 0,
  right: 0,
  top: 0,
  width: 10,
  height: 10,
  toJSON: () => "",
}
const originalGetBBox = SVGElement.prototype.getBBox
beforeEach(() => (SVGElement.prototype.getBBox = () => mockedRect))
afterEach(() => (SVGElement.prototype.getBBox = originalGetBBox))

function getFaviconHref() {
  const faviconElement: HTMLLinkElement | null = document.querySelector(
    "link[rel='shortcut icon']"
  )
  return faviconElement ? faviconElement.href : ""
}

document.head.innerHTML = `<link rel="shortcut icon" href="default.png">`

test("is set up with the default favicon", () => {
  expect(getFaviconHref()).toBe("http://localhost/default.png")
})

describe("Favicon element", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = mount(<Favicon {...props} />)

    expect(wrapper.find(".stHidden")).toBeTruthy()
  })

  it("should update the favicon", () => {
    const props = getProps()
    mount(<Favicon {...props} />)

    expect(getFaviconHref()).toBe("https://streamlit.io/path/to/favicon.png")
  })

  it("should accept /media urls from backend", () => {
    const props = getProps({ url: "/media/1234567890.png" })
    mount(<Favicon {...props} />)

    expect(getFaviconHref()).toBe("http://localhost/media/1234567890.png")
  })

  const PIZZA_EMOJI_SVG = `data:image/svg+xml,
  <svg version="1.2" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <text
      style="transform: translate(50%, 50%) scale(10)"
      dominant-baseline="central"
      text-anchor="middle">
      %F0%9F%8D%95
    </text>
  </svg>`.replace(/\n/g, "")

  it("should accept emojis directly", () => {
    const props = getProps({ url: "🍕" })
    mount(<Favicon {...props} />)

    expect(getFaviconHref()).toBe(PIZZA_EMOJI_SVG)
  })

  it("should accept emoji shortcodes", () => {
    const props = getProps({ url: ":pizza:" })
    mount(<Favicon {...props} />)

    expect(getFaviconHref()).toBe(PIZZA_EMOJI_SVG)
  })
})
