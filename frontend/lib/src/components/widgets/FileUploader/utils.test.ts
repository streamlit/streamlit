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

import { isMimeType } from "~lib/util/FileHelper"

import { getAccept, STREAMLIT_MIME_TYPE } from "./utils"

describe("FileUploader utils", () => {
  describe("isMimeType", () => {
    it.each([
      // MIME types
      ["image/jpeg", true],
      ["application/pdf", true],
      ["text/plain", true],
      // MIME wildcards
      ["image/*", true],
      ["audio/*", true],
      ["video/*", true],
      // Extensions (not MIME types)
      [".jpg", false],
      [".pdf", false],
      ["png", false],
    ])("isMimeType(%s) returns %s", (input, expected) => {
      expect(isMimeType(input)).toBe(expected)
    })
  })

  describe("getAccept", () => {
    it("returns undefined when no types provided", () => {
      expect(getAccept([])).toBeUndefined()
    })

    it("returns accept object with MIME type when extensions only provided", () => {
      const extensions = [".jpg", ".png"]
      const result = getAccept(extensions)

      expect(result).toEqual({
        [STREAMLIT_MIME_TYPE]: extensions,
      })
    })

    it("handles MIME types as direct keys", () => {
      const result = getAccept(["image/jpeg", "application/pdf"])

      expect(result).toEqual({
        "image/jpeg": [],
        "application/pdf": [],
      })
    })

    it("handles MIME wildcards as direct keys", () => {
      const result = getAccept(["image/*", "audio/*"])

      expect(result).toEqual({
        "image/*": [],
        "audio/*": [],
      })
    })

    it("handles mixed MIME types and extensions", () => {
      const result = getAccept(["image/*", ".json", "application/pdf", ".txt"])

      expect(result).toEqual({
        "image/*": [],
        "application/pdf": [],
        [STREAMLIT_MIME_TYPE]: [".json", ".txt"],
      })
    })

    it("handles MIME types only without extensions", () => {
      const result = getAccept(["video/*"])

      expect(result).toEqual({
        "video/*": [],
      })
    })
  })
})
