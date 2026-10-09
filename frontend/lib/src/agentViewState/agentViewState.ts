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

/**
 * The user's current widget state, embedded in the page for an agent.
 *
 * A co-browsing agent reads the page the user is looking at, then answers in a
 * session of its own through the agent API. The rendered page shows what the
 * user sees, but not which values produced it, so the agent's session would
 * otherwise answer about the app's defaults. This module keeps a JSON document
 * in the DOM that says which values to send:
 *
 * ```html
 * <script id="streamlit-agent-view-state" type="application/json">
 *   {"version": 1, "page": "", "query_params": {}, "widget_state": {}, ...}
 * </script>
 * ```
 *
 * Every key and value uses the encoding the agent API's `widget_state`
 * request accepts, so `widget_state`, and each entry of `forms`, can be sent
 * back unchanged. See
 * `specs/2026-08-28-agent-app-interface/view-state-embedding.md`.
 */

import {
  type Block as BlockProto,
  Slider as SliderProto,
  TextInput as TextInputProto,
  type WidgetState,
} from "@streamlit/protobuf"

import type { AppRoot } from "~lib/render-tree/AppRoot"
import type { BlockNode } from "~lib/render-tree/BlockNode"
import type { ElementNode } from "~lib/render-tree/ElementNode"
import type { TransientNode } from "~lib/render-tree/TransientNode"
import type { AppNodeVisitor } from "~lib/render-tree/visitors/AppNodeVisitor.interface"
import {
  getElementId,
  isValidElementId,
  notNullOrUndefined,
} from "~lib/util/utils"
import {
  type DateType,
  microsToIsoString,
  requireNumberInt,
  type WidgetStateManager,
} from "~lib/WidgetStateManager"

/** The `id` of the `<script type="application/json">` that holds the state. */
export const AGENT_VIEW_STATE_ELEMENT_ID = "streamlit-agent-view-state"

/** A value longer than this, as JSON, is omitted as `too_large`. */
const MAX_VALUE_LENGTH = 4096

/** Once the values reach this length, as JSON, the rest are `too_large`. */
const MAX_TOTAL_LENGTH = 32768

/**
 * Element types whose value the agent API can set, and so can be handed over.
 * Anything else that holds a value is reported as `unsupported`.
 */
const SETTABLE_TYPES: ReadonlySet<string> = new Set([
  "buttonGroup",
  "checkbox",
  "colorPicker",
  "dateInput",
  "dateTimeInput",
  "feedback",
  "multiselect",
  "numberInput",
  "pagination",
  "radio",
  "selectbox",
  "slider",
  "textArea",
  "textInput",
  "timeInput",
  // Containers that are widgets when the app gives them an `on_change`.
  "expandable",
  "popover",
  "tabContainer",
])

const BINARY_TYPES: ReadonlySet<string> = new Set([
  "audioInput",
  "cameraInput",
  "fileUploader",
])

const TRIGGER_FIELDS: ReadonlySet<string> = new Set([
  "triggerValue",
  "stringTriggerValue",
  "jsonTriggerValue",
  "chatInputValue",
])

/**
 * Characters to escape in JSON written into a `<script>`: markup, and the two
 * line terminators older parsers reject inside a string. Built from a string
 * because a bundler may turn an escaped line terminator in a regex literal into
 * the raw character, which ends the literal.
 */
const SCRIPT_UNSAFE_CHARACTERS = new RegExp("[<>&\\u2028\\u2029]", "g")

const SLIDER_DATE_TYPES: Partial<Record<SliderProto.DataType, DateType>> = {
  [SliderProto.DataType.DATE]: "date",
  [SliderProto.DataType.DATETIME]: "datetime",
  [SliderProto.DataType.TIME]: "time",
}

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

/**
 * Why a value the user holds is not handed over.
 *
 * - `sensitive`: a password `st.text_input`. Never reported, like in the
 *   agent API's own snapshot.
 * - `binary`: an upload or a recording, which JSON cannot carry.
 * - `unsupported`: a value the agent API cannot set, such as a data editor's
 *   edits, a chart or dataframe selection, or a custom component's value.
 * - `disabled`: the agent API refuses to set a disabled widget.
 * - `in_dialog`: inside an open `st.dialog`, which the agent's session only
 *   shows after it fires whatever opened it.
 * - `no_submit_button`: in a form with no enabled submit button, so there is
 *   no trigger to send the form's fields with.
 * - `too_large`: over the size budget.
 */
type OmittedReason =
  | "sensitive"
  | "binary"
  | "unsupported"
  | "disabled"
  | "in_dialog"
  | "no_submit_button"
  | "too_large"

/** One form's committed fields, as a complete agent API request body. */
interface FormRequest {
  widget_state: Record<string, JsonValue>
  trigger: { key: string }
}

/** The document embedded in the page. Field names follow the agent API. */
export interface AgentViewState {
  version: 1
  /** The current page's `url_path`, for the request's `page`. */
  page: string
  /** The address bar's query string, in the request's `query_params` shape. */
  query_params: Record<string, string[]>
  /** Values outside any form, for one `widget_state` request. */
  widget_state: Record<string, JsonValue>
  /** Each submitted form's fields, with the trigger that submits them. */
  forms: FormRequest[]
  /** Values the user holds that are not handed over, and why. */
  omitted: Record<string, OmittedReason>
}

/** What the page says about one widget, beyond its value. */
interface IndexedWidget {
  /** The element's or container's proto type, such as `selectbox`. */
  type: string
  formId: string
  disabled: boolean
  inDialog: boolean
  isPassword: boolean
  /** For a date, time, or datetime slider: what its microseconds denote. */
  dateType?: DateType
  /**
   * For `st.feedback`: whether it has a default. A cleared value is `""` on the
   * wire, but the agent API can only send `null`, which reads as the default.
   */
  hasDefault?: boolean
}

/** The widgets on the page in document order, and each form's submit button. */
export interface WidgetIndex {
  widgets: Map<string, IndexedWidget>
  submitButtonIds: Map<string, string>
}

interface WidgetPayload {
  formId?: string | null
  disabled?: boolean | null
}

/**
 * The key the agent API addresses an element by: the author's `key=`, or the
 * generated element ID for a keyless one. The same rule as the runtime's
 * `user_key_from_element_id`, which splits `$$ID-<hash>-<user key>` at its
 * first two dashes, so a user key may itself contain dashes.
 */
export function agentKeyFromElementId(elementId: string): string {
  const hashStart = elementId.indexOf("-") + 1
  const userKey = elementId.slice(elementId.indexOf("-", hashStart) + 1)
  return userKey === "None" ? elementId : userKey
}

/** Collects every widget in the tree, in document order. */
class WidgetIndexVisitor implements AppNodeVisitor<void> {
  public readonly widgets = new Map<string, IndexedWidget>()

  public readonly submitButtonIds = new Map<string, string>()

  private dialogDepth = 0

  visitElementNode(node: ElementNode): void {
    const { element } = node
    const type = element.type
    const elementId = getElementId(element)
    if (!type || !elementId) {
      return
    }

    const payload = element[type] as WidgetPayload
    const formId = payload.formId ?? ""
    if (element.button?.isFormSubmitter) {
      if (formId && !payload.disabled && !this.submitButtonIds.has(formId)) {
        this.submitButtonIds.set(formId, elementId)
      }
      return
    }

    this.widgets.set(elementId, {
      type,
      formId,
      disabled: Boolean(payload.disabled),
      inDialog: this.dialogDepth > 0,
      isPassword: element.textInput?.type === TextInputProto.Type.PASSWORD,
      dateType:
        SLIDER_DATE_TYPES[
          element.slider?.dataType ?? SliderProto.DataType.INT
        ],
      hasDefault: notNullOrUndefined(element.feedback?.default),
    })
  }

  visitBlockNode(node: BlockNode): void {
    const block = node.deltaBlock
    const widgetId = containerWidgetId(block)
    if (block.type && widgetId) {
      this.widgets.set(widgetId, {
        type: block.type,
        formId: "",
        disabled: Boolean(block.popover?.disabled),
        inDialog: this.dialogDepth > 0,
        isPassword: false,
      })
    }

    const isDialog = block.type === "dialog"
    if (isDialog) {
      this.dialogDepth += 1
    }
    node.children.forEach(child => child.accept(this))
    if (isDialog) {
      this.dialogDepth -= 1
    }
  }

  visitTransientNode(node: TransientNode): void {
    node.transientNodes.forEach(child => child.accept(this))
    node.anchor?.accept(this)
  }
}

/** The widget ID of a container the app made stateful, if it did. */
function containerWidgetId(block: BlockProto): string | undefined {
  const widgetId =
    block.tabContainer?.id ?? block.expandable?.id ?? block.popover?.id
  return widgetId && isValidElementId(widgetId) ? widgetId : undefined
}

/**
 * Index the widgets of every root container, top to bottom. The sidebar comes
 * first: it is where an app usually puts the filters its main area depends on.
 */
export function indexWidgets(appRoot: AppRoot): WidgetIndex {
  const visitor = new WidgetIndexVisitor()
  appRoot.sidebar.accept(visitor)
  appRoot.main.accept(visitor)
  appRoot.event.accept(visitor)
  appRoot.bottom.accept(visitor)
  return {
    widgets: visitor.widgets,
    submitButtonIds: visitor.submitButtonIds,
  }
}

type WireValue =
  | { kind: "value"; value: JsonValue }
  | { kind: "trigger" }
  // JSON blobs, bytes, Arrow tables, and uploads.
  | { kind: "opaque" }

/** Read a committed widget value as the JSON the agent API accepts for it. */
function readWireValue(state: WidgetState): WireValue {
  const field = state.value
  if (field === undefined) {
    // No arm set is how a cleared widget is represented, and a `null` in a
    // request clears it.
    return { kind: "value", value: null }
  }
  if (TRIGGER_FIELDS.has(field)) {
    return { kind: "trigger" }
  }
  switch (field) {
    case "boolValue":
      return { kind: "value", value: Boolean(state.boolValue) }
    case "doubleValue":
      return { kind: "value", value: state.doubleValue ?? null }
    case "intValue":
      return {
        kind: "value",
        value: requireNumberInt(state.intValue ?? 0),
      }
    case "stringValue":
      return { kind: "value", value: state.stringValue ?? null }
    case "stringArrayValue":
      return {
        kind: "value",
        value: [...(state.stringArrayValue?.data ?? [])],
      }
    case "doubleArrayValue":
      return {
        kind: "value",
        value: [...(state.doubleArrayValue?.data ?? [])],
      }
    case "intArrayValue":
      return {
        kind: "value",
        value: (state.intArrayValue?.data ?? []).map(requireNumberInt),
      }
    default:
      return { kind: "opaque" }
  }
}

/**
 * Convert the few wire values the agent API reads differently.
 *
 * A temporal slider carries microseconds but the agent API takes only ISO
 * text, which its own serializer turns back into the same microseconds.
 * `st.feedback` carries its index as text, with `""` for no selection, while
 * the agent API takes the index or `null`.
 */
function toRequestValue(widget: IndexedWidget, value: JsonValue): JsonValue {
  if (widget.dateType && Array.isArray(value)) {
    const { dateType } = widget
    return value.map(micros => microsToIsoString(Number(micros), dateType))
  }
  if (widget.type === "feedback" && typeof value === "string") {
    return value === "" ? null : Number(value)
  }
  return value
}

function omissionReason(widget: IndexedWidget): OmittedReason | undefined {
  if (widget.isPassword) {
    return "sensitive"
  }
  if (BINARY_TYPES.has(widget.type)) {
    return "binary"
  }
  if (!SETTABLE_TYPES.has(widget.type)) {
    return "unsupported"
  }
  if (widget.disabled) {
    return "disabled"
  }
  if (widget.inDialog) {
    return "in_dialog"
  }
  return undefined
}

interface BuildArgs {
  index: WidgetIndex
  /** Committed widget values, keyed by widget ID. */
  committed: ReadonlyMap<string, WidgetState>
  /** Forms the user has submitted at least once. */
  submittedFormIds: ReadonlySet<string>
  page: string
  queryString: string
}

/**
 * Build the document from the committed widget values.
 *
 * Committed values are what the app last ran with, plus a change still on its
 * way to the server. A form field the user edited but did not submit is not
 * committed, so it is left out: the app has not seen it. The fields of a form
 * the user never submitted are left out too, because the app ran with their
 * defaults, and submitting them would show the app's submitted branch, which
 * the user never saw.
 *
 * Keys follow the order of `indexWidgets`, which is usually the order widgets'
 * options depend on each other's values.
 */
export function buildAgentViewState({
  index,
  committed,
  submittedFormIds,
  page,
  queryString,
}: BuildArgs): AgentViewState {
  const widgetState: Record<string, JsonValue> = {}
  const forms = new Map<string, FormRequest>()
  const omitted: Record<string, OmittedReason> = {}
  let totalLength = 0

  index.widgets.forEach((widget, widgetId) => {
    const state = committed.get(widgetId)
    if (!state) {
      return
    }
    const wire = readWireValue(state)
    if (wire.kind === "trigger") {
      // A trigger resets after the run that observed it, so it is not state.
      return
    }
    if (widget.formId && !submittedFormIds.has(widget.formId)) {
      return
    }

    const key = agentKeyFromElementId(widgetId)
    const reason = omissionReason(widget)
    if (reason || wire.kind === "opaque") {
      omitted[key] = reason ?? "unsupported"
      return
    }
    if (widget.type === "feedback" && widget.hasDefault && wire.value === "") {
      // Cleared by the user, which `null` would turn back into the default.
      omitted[key] = "unsupported"
      return
    }

    const submitButtonId = index.submitButtonIds.get(widget.formId)
    if (widget.formId && !submitButtonId) {
      omitted[key] = "no_submit_button"
      return
    }

    const value = toRequestValue(widget, wire.value)
    // JSON is never shorter than the string it encodes, so a huge string is
    // refused without serializing it.
    const length =
      typeof value === "string" && value.length > MAX_VALUE_LENGTH
        ? value.length
        : JSON.stringify(value).length
    if (length > MAX_VALUE_LENGTH || totalLength + length > MAX_TOTAL_LENGTH) {
      omitted[key] = "too_large"
      return
    }
    totalLength += length

    if (!submitButtonId) {
      widgetState[key] = value
      return
    }
    const form = forms.get(widget.formId) ?? {
      widget_state: {},
      trigger: { key: agentKeyFromElementId(submitButtonId) },
    }
    form.widget_state[key] = value
    forms.set(widget.formId, form)
  })

  return {
    version: 1,
    page,
    query_params: parseQueryParams(queryString),
    widget_state: widgetState,
    forms: [...forms.values()],
    omitted,
  }
}

/** A query string in the agent API's `query_params` shape. */
function parseQueryParams(queryString: string): Record<string, string[]> {
  const params = new URLSearchParams(queryString)
  const result: Record<string, string[]> = {}
  params.forEach((_value, name) => {
    result[name] ??= params.getAll(name)
  })
  return result
}

/**
 * Serialize for a `<script>` body. A `</script>` inside a value would end the
 * element for anything that parses the page's HTML, and the escapes below are
 * still valid JSON.
 */
export function toScriptSafeJson(state: AgentViewState): string {
  return JSON.stringify(state).replace(
    SCRIPT_UNSAFE_CHARACTERS,
    character => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`
  )
}

interface PublisherProps {
  widgetMgr: WidgetStateManager
  /** The render tree as it is now. */
  getAppRoot: () => AppRoot
  /** The current page's `url_path` and query string. */
  getLocation: () => { page: string; queryString: string }
}

/**
 * Keeps the embedded document current.
 *
 * Values are re-read on every widget change, so the document never waits for
 * a rerun. The widget index is rebuilt from the tree as it is at that moment,
 * only when the tree has changed since the last write. A stale index could
 * report a field that has just become a password field, so it is never
 * reused across trees.
 */
export class AgentViewStatePublisher {
  private readonly props: PublisherProps

  private index: WidgetIndex = {
    widgets: new Map(),
    submitButtonIds: new Map(),
  }

  private indexedAppRoot: AppRoot | undefined

  private isUpdateScheduled = false

  private isDisposed = false

  private lastJson = ""

  constructor(props: PublisherProps) {
    this.props = props
  }

  /**
   * Rewrite the document once the current task is done, so a burst of value
   * changes, such as every widget writing its default on mount, is one write.
   */
  public scheduleUpdate(): void {
    if (this.isUpdateScheduled || this.isDisposed) {
      return
    }
    this.isUpdateScheduled = true
    queueMicrotask(() => {
      this.isUpdateScheduled = false
      this.publish()
    })
  }

  /** Remove the document from the page, and stop writing it. */
  public dispose(): void {
    this.isDisposed = true
    document.getElementById(AGENT_VIEW_STATE_ELEMENT_ID)?.remove()
  }

  private publish(): void {
    if (this.isDisposed) {
      return
    }
    const { widgetMgr, getAppRoot, getLocation } = this.props
    const appRoot = getAppRoot()
    if (appRoot !== this.indexedAppRoot) {
      this.index = indexWidgets(appRoot)
      this.indexedAppRoot = appRoot
    }

    const committed = new Map<string, WidgetState>()
    widgetMgr
      .getActiveWidgetStates(new Set(this.index.widgets.keys()))
      .widgets.forEach(state => {
        if (state.id) {
          committed.set(state.id, state as WidgetState)
        }
      })

    const json = toScriptSafeJson(
      buildAgentViewState({
        index: this.index,
        committed,
        submittedFormIds: widgetMgr.getSubmittedFormIds(),
        ...getLocation(),
      })
    )
    if (json === this.lastJson) {
      return
    }
    this.lastJson = json
    getOrCreateScriptElement().textContent = json
  }
}

function getOrCreateScriptElement(): HTMLScriptElement {
  const existing = document.getElementById(AGENT_VIEW_STATE_ELEMENT_ID)
  if (existing instanceof HTMLScriptElement) {
    return existing
  }
  const script = document.createElement("script")
  script.id = AGENT_VIEW_STATE_ELEMENT_ID
  script.type = "application/json"
  document.body.appendChild(script)
  return script
}
