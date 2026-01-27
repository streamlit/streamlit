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

import { Element, ForwardMsgMetadata } from "@streamlit/protobuf"

import { ElementNode, NO_SCRIPT_RUN_ID, TransientNode } from "~lib/AppNode"
import { block, FAKE_SCRIPT_HASH, text } from "~lib/render-tree/test-utils"

import { DebugVisitor, MAX_HASH_LENGTH } from "./DebugVisitor"

// Helper to create an ElementNode with optional overrides that are not exposed by test-utils.
function makeElementNode({
  element,
  scriptRunId = NO_SCRIPT_RUN_ID,
  activeScriptHash = FAKE_SCRIPT_HASH,
  fragmentId,
}: {
  element: Element
  scriptRunId?: string
  activeScriptHash?: string
  fragmentId?: string
}): ElementNode {
  return new ElementNode(
    element,
    ForwardMsgMetadata.create(),
    scriptRunId,
    activeScriptHash,
    fragmentId
  )
}

describe("DebugVisitor.visitElementNode", () => {
  it("prints basic element info with type", () => {
    const node = text("hello")
    const out = node.accept(new DebugVisitor())
    expect(out).toBe(
      `└── ElementNode [text] "hello" (activeScriptHash: ${FAKE_SCRIPT_HASH.substring(0, MAX_HASH_LENGTH)})\n`
    )
  })

  it("prints text body and truncates when longer than 30 chars", () => {
    const long = "a".repeat(35)
    const element = new Element({ text: { body: long } })
    const node = makeElementNode({ element })

    const out = node.accept(new DebugVisitor())
    expect(out).toContain('ElementNode [text] "')
    expect(out).toContain(`${"a".repeat(30)}...`) // truncated
  })

  it("includes scriptRunId hash when not NO_SCRIPT_RUN_ID", () => {
    const runId = "1234567890abcdef"
    const node = text("x", runId)
    const out = node.accept(new DebugVisitor())
    expect(out).toContain(`(run: ${runId.substring(0, MAX_HASH_LENGTH)})`)
  })

  it("includes fragmentId and activeScriptHash (shortened)", () => {
    const element = new Element({ text: { body: "frag" } })
    const node = makeElementNode({
      element,
      fragmentId: "abcdef123456",
      activeScriptHash: "deadbeefcafefeed",
    })

    const out = node.accept(new DebugVisitor())
    expect(out).toContain("(fragment: abcdef)")
    expect(out).toContain("(activeScriptHash: deadbe)")
  })

  it("respects prefix and connector for non-last child", () => {
    const node = text("middle")
    const out = node.accept(new DebugVisitor("│   ", false))
    expect(out.startsWith("│   ├── ElementNode")).toBe(true)
  })
})

describe("DebugVisitor.visitBlockNode", () => {
  it("prints child count and iterates children with proper connectors", () => {
    const tree = block([
      text("one"),
      block([text("two-a"), text("two-b")]),
      text("three"),
    ])

    const out = tree.accept(new DebugVisitor())

    // Root line
    expect(out.split("\n")[0]).toBe("└── BlockNode [3 children]")

    // Check connectors and indentation for children
    expect(out).toContain('├── ElementNode [text] "one"')
    expect(out).toContain("├── BlockNode [2 children]")
    expect(out).toContain('│   ├── ElementNode [text] "two-a"')
    expect(out).toContain('│   └── ElementNode [text] "two-b"')
    expect(out).toContain('└── ElementNode [text] "three"')
  })

  it("includes run hash when scriptRunId is set on block", () => {
    const runId = "1234567890abcdef"
    const b = block([text("c")], runId)
    const out = b.accept(new DebugVisitor())
    expect(out.split("\n")[0]).toContain(
      `(run: ${runId.substring(0, MAX_HASH_LENGTH)})`
    )
  })
})

describe("DebugVisitor.generateDebugString", () => {
  it("delegates to visitor with provided prefix and isLast", () => {
    const root = block([text("a"), text("b")])

    const out = DebugVisitor.generateDebugString(root, "X   ", false)

    // Root should start with provided prefix and non-last connector
    expect(out.startsWith("X   ├── BlockNode")).toBe(true)
  })
})

describe("DebugVisitor.visitTransientNode", () => {
  it("prints anchor and transient nodes with proper structure and truncated run id", () => {
    const anchor = text("anchor")
    const t1 = text("one")
    const t2 = text("two")
    const runId = "abcdef012345"

    const transient = new TransientNode(runId, anchor, [t1, t2], 1)

    const out = transient.accept(new DebugVisitor())

    // Root line with truncated run id
    expect(out.split("\n")[0]).toBe(
      `└── TransientNode [2 transient] (run: ${runId.substring(0, MAX_HASH_LENGTH)})`
    )

    // Contains anchor section and its rendered element
    expect(out).toContain("anchor:")
    expect(out).toContain('ElementNode [text] "anchor"')

    // Contains transient nodes section and both elements
    expect(out).toContain("transient nodes:")
    expect(out).toContain('ElementNode [text] "one"')
    expect(out).toContain('ElementNode [text] "two"')
  })
})
