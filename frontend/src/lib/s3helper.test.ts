/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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

import { getReportObjectPath } from "./s3helper"

describe("getReportObjectPath", () => {
  test("handles no resource root", () => {
    mockWindowLocationHref("https://example.com")
    expect(getReportObjectPath("1", "test.pb")).toStrictEqual(
      "/reports/1/test.pb"
    )

    mockWindowLocationHref("https://example.com/")
    expect(getReportObjectPath("1", "test.pb")).toStrictEqual(
      "/reports/1/test.pb"
    )

    mockWindowLocationHref("https://example.com/index.html?1234")
    expect(getReportObjectPath("1", "test.pb")).toStrictEqual(
      "/reports/1/test.pb"
    )
  })

  test("handles resource root", () => {
    mockWindowLocationHref(
      "https://example.com/some/path/0.49.0/index.html?id=1234"
    )
    expect(getReportObjectPath("1", "test.pb")).toStrictEqual(
      "/some/path/0.49.0/reports/1/test.pb"
    )
  })
})

function mockWindowLocationHref(href: string): void {
  delete global.window.location
  global.window = Object.create(window)
  Object.defineProperty(window, "location", {
    value: { href },
    writable: true,
  })
}
