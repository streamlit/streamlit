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

import { NO_SCRIPT_RUN_ID } from "./AppNode.interface"
import { block, text } from "./test-utils"

// prettier-ignore
const BLOCK = block([
  text("1"),
  block([
    text("2"),
  ]),
])

describe("BlockNode", () => {
  describe("BlockNode.getIn", () => {
    it("handles shallow paths", () => {
      const node = BLOCK.getIn([0])
      expect(node).toBeTextNode("1")
    })

    it("handles deep paths", () => {
      const node = BLOCK.getIn([1, 0])
      expect(node).toBeTextNode("2")
    })

    it("returns undefined for invalid paths", () => {
      const node = BLOCK.getIn([2, 3, 4])
      expect(node).toBeUndefined()
    })
  })

  describe("BlockNode.setIn", () => {
    it("handles shallow paths", () => {
      const newBlock = BLOCK.setIn([0], text("new"), NO_SCRIPT_RUN_ID)
      expect(newBlock.getIn([0])).toBeTextNode("new")

      // Check BLOCK..newBlock diff is as expected.
      expect(newBlock).not.toStrictEqual(BLOCK)
      expect(newBlock.getIn([1])).toStrictEqual(BLOCK.getIn([1]))
    })

    it("handles deep paths", () => {
      const newBlock = BLOCK.setIn([1, 1], text("new"), NO_SCRIPT_RUN_ID)
      expect(newBlock.getIn([1, 1])).toBeTextNode("new")

      // Check BLOCK..newBlock diff is as expected
      expect(newBlock).not.toStrictEqual(BLOCK)
      expect(newBlock.getIn([0])).toStrictEqual(BLOCK.getIn([0]))
      expect(newBlock.getIn([1])).not.toStrictEqual(BLOCK.getIn([1]))
      expect(newBlock.getIn([1, 0])).toStrictEqual(BLOCK.getIn([1, 0]))
      expect(newBlock.getIn([1, 1])).not.toStrictEqual(BLOCK.getIn([1, 1]))
    })

    it("throws an error for invalid paths", () => {
      expect(() => BLOCK.setIn([1, 2], text("new"), NO_SCRIPT_RUN_ID)).toThrow(
        "Bad 'setIn' index 2 (should be between [0, 1])"
      )
    })
  })
})
