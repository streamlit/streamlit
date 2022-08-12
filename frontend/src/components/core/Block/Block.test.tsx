import React from "react"
import { Block as BlockProto } from "src/autogen/proto"
import { mount } from "src/lib/test_util"
import { BlockNode } from "src/lib/AppNode"
import { ScriptRunState } from "src/lib/ScriptRunState"

import VerticalBlock from "./Block"

function makeColumn(weight: number, children: BlockNode[] = []): BlockNode {
  return new BlockNode(
    children,
    new BlockProto({ allowEmpty: true, column: { weight } })
  )
}

function makeHorizontalBlock(numColumns: number): BlockNode {
  const weight = 1 / numColumns

  return new BlockNode(
    Array.from({ length: numColumns }, () => makeColumn(weight)),
    new BlockProto({ allowEmpty: true, horizontal: { gap: "small" } })
  )
}

function makeVerticalBlock(children: BlockNode[] = []): BlockNode {
  return new BlockNode(children, new BlockProto({ allowEmpty: true }))
}

describe("Vertical Block Component", () => {
  it("should render a horizontal block with empty columns", () => {
    const block: BlockNode = makeVerticalBlock([makeHorizontalBlock(4)])
    const wrapper = mount(
      <VerticalBlock
        node={block}
        scriptRunId={""}
        scriptRunState={ScriptRunState.NOT_RUNNING}
        widgetsDisabled={false}
        // @ts-ignore
        widgetMgr={undefined}
        // @ts-ignore
        uploadClient={undefined}
        // @ts-ignore
        componentRegistry={undefined}
        // @ts-ignore
        formsData={undefined}
      />
    )

    expect(wrapper.find("StyledColumn")).toHaveLength(4)
  })
})
