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

import { enableMapSet } from "immer"

import {
  Block as BlockProto,
  Button as ButtonProto,
  Element,
  ForwardMsgMetadata,
  Slider as SliderProto,
  StringArray,
  TextInput as TextInputProto,
  WidgetState,
} from "@streamlit/protobuf"

import {
  type AppNode,
  NO_SCRIPT_RUN_ID,
} from "~lib/render-tree/AppNode.interface"
import type { AppRoot } from "~lib/render-tree/AppRoot"
import { BlockNode } from "~lib/render-tree/BlockNode"
import { ElementNode } from "~lib/render-tree/ElementNode"
import { FAKE_SCRIPT_HASH, makeProto } from "~lib/render-tree/test-utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  AGENT_VIEW_STATE_ELEMENT_ID,
  agentKeyFromElementId,
  type AgentViewState,
  AgentViewStatePublisher,
  buildAgentViewState,
  indexWidgets,
  toScriptSafeJson,
} from "./agentViewState"

// WidgetStateManager keeps its forms data in an Immer-produced Map.
enableMapSet()

const id = (key: string): string => `$$ID-0123abcd-${key}`

function element(properties: Element.$Properties): ElementNode {
  return new ElementNode(
    makeProto(Element, properties),
    ForwardMsgMetadata.create(),
    NO_SCRIPT_RUN_ID,
    FAKE_SCRIPT_HASH
  )
}

function container(
  properties: BlockProto.$Properties,
  children: AppNode[]
): BlockNode {
  return new BlockNode(
    FAKE_SCRIPT_HASH,
    children,
    makeProto(BlockProto, properties),
    NO_SCRIPT_RUN_ID
  )
}

function appRoot(main: AppNode[], sidebar: AppNode[] = []): AppRoot {
  return {
    main: container({}, main),
    sidebar: container({}, sidebar),
    event: container({}, []),
    bottom: container({}, []),
  } as unknown as AppRoot
}

function build(
  tree: AppRoot,
  states: WidgetState.$Properties[],
  {
    submittedFormIds = new Set<string>(),
    page = "",
    queryString = "",
  }: {
    submittedFormIds?: Set<string>
    page?: string
    queryString?: string
  } = {}
): AgentViewState {
  const committed = new Map(
    states.map(state => [state.id as string, new WidgetState(state)])
  )
  return buildAgentViewState({
    index: indexWidgets(tree),
    committed,
    submittedFormIds,
    page,
    queryString,
  })
}

describe("agentKeyFromElementId", () => {
  it.each([
    ["$$ID-0123abcd-region", "region"],
    ["$$ID-0123abcd-my-dashed-key", "my-dashed-key"],
    ["$$ID-0123abcd-None", "$$ID-0123abcd-None"],
  ])("maps %s to %s", (elementId, expected) => {
    expect(agentKeyFromElementId(elementId)).toBe(expected)
  })
})

describe("buildAgentViewState", () => {
  it("reports values in the agent API's encoding, in document order", () => {
    const tree = appRoot(
      [
        element({ multiselect: { id: id("products") } }),
        element({ checkbox: { id: id("only_active") } }),
        element({ numberInput: { id: id("min_units") } }),
        element({ slider: { id: id("price") } }),
      ],
      [element({ selectbox: { id: id("None") } })]
    )

    const state = build(tree, [
      { id: id("None"), stringValue: "EU" },
      { id: id("price"), doubleArrayValue: { data: [10, 20.5] } },
      { id: id("min_units"), intValue: 3 },
      { id: id("only_active"), boolValue: false },
      {
        id: id("products"),
        stringArrayValue: new StringArray({ data: ["A", "B"] }),
      },
    ])

    expect(state.widget_state).toEqual({
      // A keyless widget is addressed by its generated element ID.
      [id("None")]: "EU",
      products: ["A", "B"],
      only_active: false,
      min_units: 3,
      price: [10, 20.5],
    })
    // The sidebar first, then the main area, each top to bottom, regardless
    // of the order the values were written in.
    expect(Object.keys(state.widget_state)).toEqual([
      id("None"),
      "products",
      "only_active",
      "min_units",
      "price",
    ])
    expect(state.omitted).toEqual({})
  })

  it("reports a cleared widget as null", () => {
    const tree = appRoot([element({ selectbox: { id: id("region") } })])

    const state = build(tree, [{ id: id("region") }])

    expect(state.widget_state).toEqual({ region: null })
  })

  it("leaves out a widget with no committed value", () => {
    const tree = appRoot([element({ selectbox: { id: id("region") } })])

    expect(build(tree, []).widget_state).toEqual({})
  })

  it("never reports a password, only that it was left out", () => {
    const tree = appRoot([
      element({
        textInput: {
          id: id("token"),
          type: TextInputProto.Type.PASSWORD,
        },
      }),
      element({ textInput: { id: id("name") } }),
    ])

    const state = build(tree, [
      { id: id("token"), stringValue: "hunter2" },
      { id: id("name"), stringValue: "Ada" },
    ])

    expect(state.widget_state).toEqual({ name: "Ada" })
    expect(state.omitted).toEqual({ token: "sensitive" })
    expect(JSON.stringify(state)).not.toContain("hunter2")
  })

  it("marks values the agent API cannot set", () => {
    const tree = appRoot([
      element({ fileUploader: { id: id("upload") } }),
      element({ dataframe: { id: id("table") } }),
      element({ selectbox: { id: id("locked"), disabled: true } }),
      container({ dialog: { title: "Edit" } }, [
        element({ textInput: { id: id("in_dialog") } }),
      ]),
    ])

    const state = build(tree, [
      {
        id: id("upload"),
        fileUploaderStateValue: { uploadedFileInfo: [] },
      },
      { id: id("table"), stringValue: '{"selection":{"rows":[1]}}' },
      { id: id("locked"), stringValue: "EU" },
      { id: id("in_dialog"), stringValue: "draft" },
    ])

    expect(state.widget_state).toEqual({})
    expect(state.omitted).toEqual({
      upload: "binary",
      table: "unsupported",
      locked: "disabled",
      in_dialog: "in_dialog",
    })
  })

  it("leaves out triggers, which are not state", () => {
    const tree = appRoot([element({ button: { id: id("go") } })])

    const state = build(tree, [{ id: id("go"), triggerValue: true }])

    expect(state.widget_state).toEqual({})
    expect(state.omitted).toEqual({})
  })

  it.each([
    [SliderProto.DataType.DATE, Date.UTC(2024, 2, 5), "2024-03-05"],
    [
      SliderProto.DataType.DATETIME,
      Date.UTC(2024, 2, 5, 13, 30),
      "2024-03-05T13:30",
    ],
    [SliderProto.DataType.TIME, Date.UTC(2000, 0, 1, 9, 15), "09:15"],
  ])(
    "reports a temporal slider (data type %s) as ISO text",
    (dataType, millis, expected) => {
      const tree = appRoot([element({ slider: { id: id("when"), dataType } })])

      const state = build(tree, [
        { id: id("when"), doubleArrayValue: { data: [millis * 1000] } },
      ])

      expect(state.widget_state).toEqual({ when: [expected] })
    }
  )

  it.each([
    ["3", 3],
    ["", null],
  ])("reports st.feedback's %j as its index %j", (wire, expected) => {
    const tree = appRoot([element({ feedback: { id: id("rating") } })])

    const state = build(tree, [{ id: id("rating"), stringValue: wire }])

    expect(state.widget_state).toEqual({ rating: expected })
  })

  it("marks a cleared st.feedback that has a default as unsupported", () => {
    // `null` would read as the default, and the agent API refuses `""`.
    const tree = appRoot([
      element({ feedback: { id: id("rating"), default: 2 } }),
      element({ feedback: { id: id("picked"), default: 2 } }),
    ])

    const state = build(tree, [
      { id: id("rating"), stringValue: "" },
      { id: id("picked"), stringValue: "4" },
    ])

    expect(state.widget_state).toEqual({ picked: 4 })
    expect(state.omitted).toEqual({ rating: "unsupported" })
  })

  it("marks a disabled stateful popover as disabled", () => {
    const tree = appRoot([
      container({ popover: { id: id("menu"), disabled: true } }, []),
      container({ popover: { id: id("help") } }, []),
    ])

    const state = build(tree, [
      { id: id("menu"), boolValue: true },
      { id: id("help"), boolValue: true },
    ])

    expect(state.widget_state).toEqual({ help: true })
    expect(state.omitted).toEqual({ menu: "disabled" })
  })

  it("reports a stateful container by its widget ID", () => {
    const tree = appRoot([
      container({ tabContainer: { id: id("view") } }, []),
      container({ expandable: { id: id("details") } }, []),
    ])

    const state = build(tree, [
      { id: id("view"), stringValue: "Chart" },
      { id: id("details"), boolValue: true },
    ])

    expect(state.widget_state).toEqual({ view: "Chart", details: true })
  })

  it("marks a value over the size budget instead of truncating it", () => {
    const tree = appRoot([
      element({ textArea: { id: id("notes") } }),
      element({ textInput: { id: id("name") } }),
    ])

    const state = build(tree, [
      { id: id("notes"), stringValue: "x".repeat(5000) },
      { id: id("name"), stringValue: "Ada" },
    ])

    expect(state.widget_state).toEqual({ name: "Ada" })
    expect(state.omitted).toEqual({ notes: "too_large" })
  })

  it("stops adding values once the total budget is spent", () => {
    const fields = Array.from({ length: 12 }, (_, i) => `note_${i}`)
    const tree = appRoot(
      fields.map(field => element({ textArea: { id: id(field) } }))
    )

    const state = build(
      tree,
      fields.map(field => ({ id: id(field), stringValue: "x".repeat(3000) }))
    )

    // Ten 3002-character values fit in 32768 characters; the rest do not.
    expect(Object.keys(state.widget_state)).toEqual(fields.slice(0, 10))
    expect(state.omitted).toEqual({
      note_10: "too_large",
      note_11: "too_large",
    })
  })

  describe("forms", () => {
    const formTree = (submitDisabled = false): AppRoot =>
      appRoot([
        container({ form: { formId: "filters" } }, [
          element({ selectbox: { id: id("region"), formId: "filters" } }),
          element({ slider: { id: id("None"), formId: "filters" } }),
          element({
            button: {
              id: id("FormSubmitter:filters-Apply"),
              formId: "filters",
              isFormSubmitter: true,
              disabled: submitDisabled,
            },
          }),
        ]),
        element({ checkbox: { id: id("outside") } }),
      ])

    const formStates: WidgetState.$Properties[] = [
      { id: id("region"), stringValue: "EU" },
      { id: id("None"), doubleArrayValue: { data: [5] } },
      { id: id("outside"), boolValue: true },
    ]

    it("pairs a submitted form's fields with its submit trigger", () => {
      const state = build(formTree(), formStates, {
        submittedFormIds: new Set(["filters"]),
      })

      expect(state.widget_state).toEqual({ outside: true })
      expect(state.forms).toEqual([
        {
          widget_state: { region: "EU", [id("None")]: [5] },
          trigger: { key: "FormSubmitter:filters-Apply" },
        },
      ])
    })

    it("leaves out a form the user never submitted", () => {
      const state = build(formTree(), formStates)

      expect(state.forms).toEqual([])
      expect(state.widget_state).toEqual({ outside: true })
      expect(state.omitted).toEqual({})
    })

    it("marks fields that have no enabled submit button to go with", () => {
      const state = build(formTree(true), formStates, {
        submittedFormIds: new Set(["filters"]),
      })

      expect(state.forms).toEqual([])
      expect(state.omitted).toEqual({
        region: "no_submit_button",
        [id("None")]: "no_submit_button",
      })
    })
  })

  it("reports the page and the query string in the request's shape", () => {
    const state = build(appRoot([]), [], {
      page: "sales",
      queryString: "?region=EU&product=A&product=B&empty=",
    })

    expect(state.page).toBe("sales")
    expect(state.query_params).toEqual({
      region: ["EU"],
      product: ["A", "B"],
      empty: [""],
    })
  })
})

describe("toScriptSafeJson", () => {
  it("cannot end the script element it is written into", () => {
    const state = build(
      appRoot([element({ textInput: { id: id("name") } })]),
      [{ id: id("name"), stringValue: "</script><b>&" }]
    )

    const json = toScriptSafeJson(state)

    expect(json).not.toMatch(/[<>&]/)
    expect((JSON.parse(json) as AgentViewState).widget_state.name).toBe(
      "</script><b>&"
    )
  })
})

describe("AgentViewStatePublisher", () => {
  const readDocument = (): AgentViewState | null => {
    const script = document.getElementById(AGENT_VIEW_STATE_ELEMENT_ID)
    return script?.textContent
      ? (JSON.parse(script.textContent) as AgentViewState)
      : null
  }

  const submitButton = ButtonProto.create({
    id: id("FormSubmitter:f-Go"),
    formId: "f",
    isFormSubmitter: true,
  })

  const formTree = (): AppRoot =>
    appRoot([
      element({ selectbox: { id: id("region") } }),
      container({ form: { formId: "f" } }, [
        element({ textInput: { id: id("q"), formId: "f" } }),
        element({ button: submitButton }),
      ]),
    ])

  const outsideForm = {
    formId: undefined,
    fragmentId: undefined,
    fromUser: true,
  }

  let publisher: AgentViewStatePublisher | undefined
  let tree: AppRoot

  afterEach(() => {
    publisher?.dispose()
  })

  function setUp(initialTree: AppRoot = formTree()): WidgetStateManager {
    tree = initialTree
    const widgetMgr: WidgetStateManager = new WidgetStateManager({
      sendRerunBackMsg: vi.fn(),
      formsDataChanged: vi.fn(),
      widgetStatesChanged: () => publisher?.scheduleUpdate(),
    })
    publisher = new AgentViewStatePublisher({
      widgetMgr,
      getAppRoot: () => tree,
      getLocation: () => ({ page: "sales", queryString: "?year=2024" }),
    })
    publisher.scheduleUpdate()
    return widgetMgr
  }

  it("writes the document as a JSON script element", async () => {
    setUp()
    await Promise.resolve()

    const script = document.getElementById(AGENT_VIEW_STATE_ELEMENT_ID)
    expect(script).toBeInstanceOf(HTMLScriptElement)
    expect(script?.getAttribute("type")).toBe("application/json")
    expect(readDocument()).toEqual({
      version: 1,
      page: "sales",
      query_params: { year: ["2024"] },
      widget_state: {},
      forms: [],
      omitted: {},
    })
  })

  it("updates on a value change, without waiting for a rerun", async () => {
    const widgetMgr = setUp()

    widgetMgr.setStringValue(id("region"), "EU", outsideForm)
    await Promise.resolve()

    expect(readDocument()?.widget_state).toEqual({ region: "EU" })
  })

  it("reads the tree as it is now, so a new password field is never stale", async () => {
    const field = (type: TextInputProto.Type): AppRoot =>
      appRoot([element({ textInput: { id: id("secret"), type } })])
    const widgetMgr = setUp(field(TextInputProto.Type.DEFAULT))
    widgetMgr.setStringValue(id("secret"), "visible", outsideForm)
    await Promise.resolve()
    expect(readDocument()?.widget_state).toEqual({ secret: "visible" })

    // The same widget re-rendered as a password field, before any run ends.
    tree = field(TextInputProto.Type.PASSWORD)
    widgetMgr.setStringValue(id("secret"), "hunter2", outsideForm)
    await Promise.resolve()

    expect(readDocument()?.omitted).toEqual({ secret: "sensitive" })
    expect(
      document.getElementById(AGENT_VIEW_STATE_ELEMENT_ID)?.textContent
    ).not.toContain("hunter2")
  })

  it("reports a form field only once the form is submitted", async () => {
    const widgetMgr = setUp()
    widgetMgr.addSubmitButton("f", submitButton)

    widgetMgr.setStringValue(id("q"), "pending", {
      ...outsideForm,
      formId: "f",
    })
    await Promise.resolve()
    expect(readDocument()?.forms).toEqual([])

    widgetMgr.submitForm("f", undefined)
    await Promise.resolve()
    expect(readDocument()?.forms).toEqual([
      {
        widget_state: { q: "pending" },
        trigger: { key: "FormSubmitter:f-Go" },
      },
    ])
  })

  it("removes the document when disposed, and does not write it again", async () => {
    const widgetMgr = setUp()
    await Promise.resolve()

    widgetMgr.setStringValue(id("region"), "EU", outsideForm)
    publisher?.dispose()
    await Promise.resolve()

    expect(document.getElementById(AGENT_VIEW_STATE_ELEMENT_ID)).toBeNull()
  })
})
