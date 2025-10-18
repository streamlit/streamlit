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

import { AppNode, NO_SCRIPT_RUN_ID } from "./AppNode.interface"
import { block, text } from "./test-utils"
import { GetNodeByDeltaPathVisitor } from "./visitors/GetNodeByDeltaPathVisitor"

// prettier-ignore
const BLOCK = block([
  text("1"),
  block([
    text("2"),
  ]),
])

function getIn(node: AppNode, path: number[]): AppNode | undefined {
  return GetNodeByDeltaPathVisitor.getNodeAtPath(node, path)
}

describe("BlockNode", () => {
  describe("BlockNode.setIn", () => {
    it("handles shallow paths", () => {
      const newBlock = BLOCK.setIn([0], text("new"), NO_SCRIPT_RUN_ID)
      expect(getIn(newBlock, [0])).toBeTextNode("new")

      // Check BLOCK..newBlock diff is as expected.
      expect(newBlock).not.toStrictEqual(BLOCK)
      expect(getIn(newBlock, [1])).toStrictEqual(getIn(BLOCK, [1]))
    })

    it("handles deep paths", () => {
      const newBlock = BLOCK.setIn([1, 1], text("new"), NO_SCRIPT_RUN_ID)
      expect(getIn(newBlock, [1, 1])).toBeTextNode("new")

      // Check BLOCK..newBlock diff is as expected
      expect(newBlock).not.toStrictEqual(BLOCK)
      expect(getIn(newBlock, [0])).toStrictEqual(getIn(BLOCK, [0]))
      expect(getIn(newBlock, [1])).not.toStrictEqual(getIn(BLOCK, [1]))
      expect(getIn(newBlock, [1, 0])).toStrictEqual(getIn(BLOCK, [1, 0]))
      expect(getIn(newBlock, [1, 1])).not.toStrictEqual(getIn(BLOCK, [1, 1]))
    })

    it("throws an error for invalid paths", () => {
      expect(() => BLOCK.setIn([1, 2], text("new"), NO_SCRIPT_RUN_ID)).toThrow(
        "Bad 'setIn' index 2 (should be between [0, 1])"
      )
    })
  })

  describe("BlockNode.accept", () => {
    it("calls visitBlockNode on the visitor", () => {
      const node = block([text("child1"), text("child2")])
      const mockVisitor = {
        visitElementNode: vi.fn().mockReturnValue("element-result"),
        visitBlockNode: vi.fn().mockReturnValue("block-result"),
      }

      const result = node.accept(mockVisitor)

      expect(mockVisitor.visitBlockNode).toHaveBeenCalledWith(node)
      expect(mockVisitor.visitElementNode).not.toHaveBeenCalled()
      expect(result).toEqual("block-result")
    })

    it("allows visitor to return the same node", () => {
      const node = block([text("child")])
      const identityVisitor = {
        visitElementNode: vi.fn(),
        visitBlockNode: vi.fn().mockReturnValue(node),
      }

      const result = node.accept(identityVisitor)

      expect(result).toBe(node)
    })

    it("can return a modified BlockNode through visitor", () => {
      const originalNode = block([text("child1"), text("child2")])
      const transformVisitor = {
        visitElementNode: vi.fn(),
        visitBlockNode: vi.fn().mockReturnValue(block([text("transformed")])),
      }

      const result = originalNode.accept(transformVisitor)

      expect(result).not.toBe(originalNode)
      expect(result.children).toHaveLength(1)
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [0])
      ).toBeTextNode("transformed")
    })
  })
})
