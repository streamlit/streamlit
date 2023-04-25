/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import React from "react"
import { Block as BlockProto } from "src/lib/proto"
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
        // @ts-expect-error
        widgetMgr={undefined}
        // @ts-expect-error
        uploadClient={undefined}
        // @ts-expect-error
        componentRegistry={undefined}
        // @ts-expect-error
        formsData={undefined}
      />
    )

    expect(wrapper.find("StyledColumn")).toHaveLength(4)
  })
})
