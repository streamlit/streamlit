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

import { Block as BlockProto, streamlit } from "@streamlit/protobuf"

import { BlockNode, ElementNode } from "~lib/AppNode"
import { ScriptRunState } from "~lib/ScriptRunState"

import {
  backwardsCompatibleColumnGapSize,
  checkFlexContainerBackwardsCompatibile,
  convertKeyToClassName,
  getActivateScrollToBottomBackwardsCompatible,
  getBorderBackwardsCompatible,
  getKeyFromId,
  isElementStale,
} from "./utils"

describe("isElementStale", () => {
  const node = new ElementNode(
    // @ts-expect-error
    null,
    null,
    "myScriptRunId",
    "activeScriptHash",
    "myFragmentId"
  )

  it("returns true if scriptRunState is RERUN_REQUESTED", () => {
    expect(
      isElementStale(
        node,
        ScriptRunState.RERUN_REQUESTED,
        "someScriptRunId",
        []
      )
    ).toBe(true)
  })

  // When running in a fragment, the only elements that should be set to stale
  // are those belonging to the fragment that's currently running and only if the script run id is different.
  // If the script run id is the same, the element has just been updated and is not stale.
  it("if running and currentFragmentId is set, compares with node's fragmentId and scriptrunId", () => {
    expect(
      isElementStale(node, ScriptRunState.RUNNING, "myScriptRunId", [
        "myFragmentId",
      ])
    ).toBe(false)

    expect(
      isElementStale(node, ScriptRunState.RUNNING, "otherScriptRunId", [
        "myFragmentId",
      ])
    ).toBe(true)

    expect(
      isElementStale(node, ScriptRunState.RUNNING, "myScriptRunId", [
        "someFragmentId",
        "someOtherFragmentId",
      ])
    ).toBe(false)
  })

  // When not running in a fragment, all elements from script runs aside from
  // the current one should be set to stale.
  it("if running and currentFragmentId is not set, compares with node's scriptRunId", () => {
    expect(
      isElementStale(node, ScriptRunState.RUNNING, "someOtherScriptRunId", [])
    ).toBe(true)

    expect(
      isElementStale(node, ScriptRunState.RUNNING, "myScriptRunId", [])
    ).toBe(false)
  })

  it("returns false for all other script run states", () => {
    const states = [
      ScriptRunState.NOT_RUNNING,
      ScriptRunState.STOP_REQUESTED,
      ScriptRunState.COMPILATION_ERROR,
    ]
    states.forEach(s => {
      expect(isElementStale(node, s, "someOtherScriptRunId", [])).toBe(false)
    })
  })
})

describe("convertKeyToClassName", () => {
  const testCases = [
    { input: undefined, expected: "" },
    { input: null, expected: "" },
    { input: "", expected: "" },
    { input: "helloWorld", expected: "st-key-helloWorld" },
    { input: "hello world!", expected: "st-key-hello-world-" },
    { input: "123Start", expected: "st-key-123Start" },
    { input: "My_Class-Name", expected: "st-key-My_Class-Name" },
    {
      input: "invalid#characters$here",
      expected: "st-key-invalid-characters-here",
    },
    { input: "another$Test_case", expected: "st-key-another-Test_case" },
  ]

  test.each(testCases)(
    "converts $input to $expected",
    ({ input, expected }) => {
      expect(convertKeyToClassName(input)).toBe(expected)
    }
  )
})

describe("getKeyFromId", () => {
  const testCases = [
    {
      input: "",
      expected: undefined,
    },
    {
      input: undefined,
      expected: undefined,
    },
    {
      input: "$ID-899e9b72e1539f21f8e82565d36609d0-foo",
      expected: undefined,
    },
    {
      input: "$$ID-899e9b72e1539f21f8e82565d36609d0-None",
      expected: undefined,
    },
    {
      input: "$$ID-899e9b72e1539f21f8e82565d36609d0",
      expected: undefined,
    },
    { input: "helloWorld", expected: undefined },
    {
      input: "$$ID-899e9b72e1539f21f8e82565d36609d0-first container",
      expected: "first container",
    },
    {
      input: "$$ID-foo-bar",
      expected: "bar",
    },
    {
      input: "$$ID-899e9b72e1539f21f8e82565d36609d0-bar-baz",
      expected: "bar-baz",
    },
  ]

  test.each(testCases)(
    "extracts the key from $input",
    ({ input, expected }) => {
      expect(getKeyFromId(input)).toBe(expected)
    }
  )
})

describe("backwardsCompatibleColumnGapSize", () => {
  it("returns gapSize when it exists", () => {
    const columnProto = {
      gapConfig: {
        gapSize: streamlit.GapSize.MEDIUM,
      },
    }
    expect(backwardsCompatibleColumnGapSize(columnProto)).toBe(
      streamlit.GapSize.MEDIUM
    )
  })

  it("returns default gapSize when gapSize is undefined", () => {
    const columnProto = {
      gapConfig: {
        gapSize: streamlit.GapSize.GAP_UNDEFINED,
      },
    }
    expect(backwardsCompatibleColumnGapSize(columnProto)).toBe(
      streamlit.GapSize.SMALL
    )
  })

  const gapStringCases = [
    { gap: "small", expected: streamlit.GapSize.SMALL },
    { gap: "medium", expected: streamlit.GapSize.MEDIUM },
    { gap: "large", expected: streamlit.GapSize.LARGE },
  ]

  test.each(gapStringCases)(
    "converts '$gap' gap to corresponding GapSize",
    ({ gap, expected }) => {
      const columnProto = { gap }
      expect(backwardsCompatibleColumnGapSize(columnProto)).toBe(expected)
    }
  )

  const fallbackCases = [
    {
      description: "when neither gapSize nor gap exists",
      proto: {},
      expected: streamlit.GapSize.SMALL,
    },
    {
      description: "with unrecognized gap string",
      proto: { gap: "unrecognized" },
      expected: streamlit.GapSize.SMALL,
    },
  ]

  test.each(fallbackCases)(
    "returns GapSize.SMALL $description",
    ({ proto, expected }) => {
      expect(backwardsCompatibleColumnGapSize(proto)).toBe(expected)
    }
  )

  it("prioritizes gapSize when both gapSize and gap exist", () => {
    const columnProto = {
      gapConfig: {
        gapSize: streamlit.GapSize.LARGE,
      },
      gap: "small",
    }
    expect(backwardsCompatibleColumnGapSize(columnProto)).toBe(
      streamlit.GapSize.LARGE
    )
  })
})

describe("checkFlexContainerBackwardsCompatibile", () => {
  const testCases = [
    {
      description: "returns true when flexContainer exists",
      blockProto: { flexContainer: {} },
      expected: true,
    },
    {
      description: "returns true when vertical exists",
      blockProto: { vertical: {} },
      expected: true,
    },
    {
      description: "returns true when horizontal exists",
      blockProto: { horizontal: {} },
      expected: true,
    },
    {
      description: "returns false when none of the container types exist",
      blockProto: {},
      expected: false,
    },
  ]

  test.each(testCases)("$description", ({ blockProto, expected }) => {
    expect(
      checkFlexContainerBackwardsCompatibile(blockProto as BlockProto)
    ).toBe(expected)
  })
})

describe("getBorderBackwardsCompatible", () => {
  const testCases = [
    {
      description: "returns true when flexContainer.border is true",
      blockProto: { flexContainer: { border: true } },
      expected: true,
    },
    {
      description: "returns true when vertical.border is true",
      blockProto: { vertical: { border: true } },
      expected: true,
    },
    {
      description: "returns false when both are false",
      blockProto: {
        flexContainer: { border: false },
        vertical: { border: false },
      },
      expected: false,
    },
    {
      description: "returns false when none exist",
      blockProto: {},
      expected: false,
    },
    {
      description: "prioritizes flexContainer.border when both exist",
      blockProto: {
        flexContainer: { border: true },
        vertical: { border: false },
      },
      expected: true,
    },
  ]

  test.each(testCases)("$description", ({ blockProto, expected }) => {
    expect(getBorderBackwardsCompatible(blockProto as BlockProto)).toBe(
      expected
    )
  })
})

describe("getActivateScrollToBottomBackwardsCompatible", () => {
  // Helper function to create a proper BlockNode instance for testing
  const createBlockNode = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parentDeltaBlock: any,
    hasChatMessageChild: boolean = false
  ): BlockNode => {
    const children = []

    // Add either a chat message child or a form child
    if (hasChatMessageChild) {
      children.push(
        new BlockNode(
          "test-script-hash",
          [],
          new BlockProto({ chatMessage: {} }),
          "test-script-run-id" // scriptRunId
        )
      )
    }
    children.push(
      new BlockNode(
        "test-script-hash",
        [],
        new BlockProto({ form: {} }),
        "test-script-run-id"
      )
    )

    // Create the parent BlockNode with the given parameters
    const parentBlock = new BlockProto(parentDeltaBlock)

    return new BlockNode(
      "test-script-hash", // activeScriptHash
      children, // children with proper types
      parentBlock, // parent's deltaBlock as BlockProto
      "test-script-run-id" // scriptRunId
    )
  }

  it("returns true when flexContainer has heightConfig and has chatMessage child", () => {
    const mockNode = createBlockNode(
      { heightConfig: { pixelHeight: 100 } },
      true // Has chatMessage child
    )

    expect(getActivateScrollToBottomBackwardsCompatible(mockNode)).toBe(true)
  })

  it("returns true when vertical has height and has chatMessage child", () => {
    const mockNode = createBlockNode(
      { vertical: { height: 100 } },
      true // Has chatMessage child
    )

    expect(getActivateScrollToBottomBackwardsCompatible(mockNode)).toBe(true)
  })

  it("returns false when has height but no chatMessage child", () => {
    const mockNode = createBlockNode(
      { heightConfig: { pixelHeight: 100 } },
      false // No chatMessage child
    )

    expect(getActivateScrollToBottomBackwardsCompatible(mockNode)).toBe(false)
  })

  it("returns false when has chatMessage child but no height", () => {
    const mockNode = createBlockNode(
      {}, // No height config
      true // Has chatMessage child
    )

    expect(getActivateScrollToBottomBackwardsCompatible(mockNode)).toBe(false)
  })

  it("returns false when vertical has height but no children", () => {
    // Create parent node directly without children for this test
    const parentBlock = new BlockProto({ vertical: { height: 100 } })

    const mockNode = new BlockNode(
      "test-script-hash",
      [], // No children
      parentBlock,
      "test-script-run-id"
    )

    expect(getActivateScrollToBottomBackwardsCompatible(mockNode)).toBe(false)
  })
})
