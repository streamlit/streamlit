/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
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

import { getBucketAndResourceRoot } from "./s3helper"

describe("getBucketAndResourceRoot", () => {
  test("handles no resource root", () => {
    mockWindowLocationHref("https://example.com")
    expect(getBucketAndResourceRoot()).toStrictEqual({
      bucket: "example.com",
      resourceRoot: "",
    })

    mockWindowLocationHref("https://example.com/")
    expect(getBucketAndResourceRoot()).toStrictEqual({
      bucket: "example.com",
      resourceRoot: "",
    })
  })

  test("handles resource root", () => {
    mockWindowLocationHref(
      "https://example.com/some/path/0.49.0/index.html?id=1234"
    )
    expect(getBucketAndResourceRoot()).toStrictEqual({
      bucket: "example.com",
      resourceRoot: "some/path/0.49.0",
    })
  })
})

function mockWindowLocationHref(href: string): void {
  delete global.window.location
  global.window = Object.create(window)
  Object.defineProperty(window, "location", {
    value: { href: href },
    writable: true,
  })
}
