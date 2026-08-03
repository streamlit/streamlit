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

import {
  memo,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react"

import { Selection } from "react-aria-components"

import {
  ButtonGroup as ButtonGroupProto,
  LabelVisibility,
  streamlit,
} from "@streamlit/protobuf"

import { shouldWidthStretch } from "~lib/components/core/Layout/utils"
import { DynamicButtonLabel } from "~lib/components/shared/BaseButton/DynamicButtonLabel"
import {
  StyledButtonGroup,
  StyledPillsToggleButton,
  StyledSegmentedControlToggleButton,
  StyledToggleButtonGroup,
} from "~lib/components/shared/BaseButton/styled-components"
import { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIconInline } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIconInline"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { labelVisibilityProtoValueToEnum } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

export interface Props {
  disabled: boolean
  element: ButtonGroupProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
  widthConfig: streamlit.IWidthConfig | undefined | null
}

/**
 * Get the base content string for an option.
 */
function getOptionBaseContent(option: ButtonGroupProto.IOption): string {
  const icon = option.contentIcon
  const content = option.content ?? ""
  return icon ? `${icon} ${content}`.trim() : content
}

/**
 * Find the index of an option by its content string.
 * Returns the last matching index (to match backend "last wins" behavior
 * for duplicate labels), or -1 if not found.
 */
function findOptionIndex(
  options: ButtonGroupProto.IOption[],
  content: string
): number {
  for (let i = options.length - 1; i >= 0; i--) {
    if (getOptionBaseContent(options[i]) === content) {
      return i
    }
  }
  return -1
}

/**
 * Convert content strings to indices based on current options.
 */
function contentStringsToIndices(
  options: ButtonGroupProto.IOption[],
  contentStrings: string[]
): number[] {
  const indices: number[] = []
  for (const content of contentStrings) {
    const index = findOptionIndex(options, content)
    if (index >= 0) {
      indices.push(index)
    }
  }
  return indices
}

/** The value stored in React state: array of content strings. */
type ButtonGroupValue = string[]

function getInitialValue(
  widgetMgr: WidgetStateManager,
  element: ButtonGroupProto
): ButtonGroupValue | undefined {
  return widgetMgr.getStringArrayValue(element)
}

function getDefaultStateFromProto(
  element: ButtonGroupProto
): ButtonGroupValue {
  const defaultIndices = element.default ?? []
  return defaultIndices
    .map(index => {
      const option = element.options[index]
      return option ? getOptionBaseContent(option) : ""
    })
    .filter(s => s !== "")
}

function getCurrStateFromProto(element: ButtonGroupProto): ButtonGroupValue {
  return element.rawValues ?? []
}

function syncWithWidgetManager(
  element: ButtonGroupProto,
  widgetMgr: WidgetStateManager,
  valueWithSource: ValueWithSource<ButtonGroupValue>,
  fragmentId: string | undefined
): void {
  widgetMgr.setStringArrayValue(
    element,
    valueWithSource.value,
    { fromUi: valueWithSource.fromUi },
    fragmentId
  )
}

function ButtonGroup(props: Readonly<Props>): ReactElement {
  const { disabled, element, fragmentId, widgetMgr, widthConfig } = props
  const { clickMode, options, style, label, labelVisibility, help, required } =
    element

  const queryParamBinding = element.queryParamKey
    ? {
        paramKey: element.queryParamKey,
        valueType: "string_array_value" as const,
        clearable: true,
        urlFormat: "repeated" as const,
      }
    : undefined

  const [value, setValueWithSource] = useBasicWidgetState<
    ButtonGroupValue,
    ButtonGroupProto
  >({
    getStateFromWidgetMgr: getInitialValue,
    getDefaultStateFromProto,
    getCurrStateFromProto,
    updateWidgetMgrState: syncWithWidgetManager,
    element,
    widgetMgr,
    fragmentId,
    formClearBehavior: "resetValueOnly",
    queryParamBinding,
  })

  const containerWidth = shouldWidthStretch(widthConfig)

  // React Aria's ToggleButtonGroup does not forward aria-required to the DOM
  // element. Imperatively set it on the group root so screen readers can
  // announce that the field is mandatory.
  const groupRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!groupRef.current) return
    if (required) {
      groupRef.current.setAttribute("aria-required", "true")
    } else {
      groupRef.current.removeAttribute("aria-required")
    }
  }, [required])

  // When options change and the currently stored value no longer matches any
  // option (e.g. because format_func changed dynamically due to a language
  // switch, making the stored formatted strings stale), reset the widget so
  // it stays visually consistent. An explicit user deselection always produces
  // value=[], which short-circuits this guard immediately.
  //
  // Reset target priority:
  //   1. element.rawValues (non-empty) — the backend detected the stale wire
  //      value via session_state_fallback and sent back the correct
  //      serialization with set_value=True (e.g. "naranja" for option "B" in
  //      ES mode). Using rawValues ensures non-default selections are preserved
  //      and the widgetMgr stores the fresh label for the next rerun.
  //   2. getDefaultStateFromProto — fallback for the brief window before the
  //      first backend response, where only the proto default is known.
  useEffect(() => {
    if (value.length === 0) return
    const validIndices = contentStringsToIndices(options, value)
    if (validIndices.length > 0) return
    const backendValue = getCurrStateFromProto(element)
    setValueWithSource({
      value:
        backendValue.length > 0
          ? backendValue
          : getDefaultStateFromProto(element),
      fromUi: false,
    })
  }, [options, value, setValueWithSource, element])

  const selectionMode =
    clickMode === ButtonGroupProto.ClickMode.MULTI_SELECT
      ? "multiple"
      : "single"

  // Each ToggleButton's `id` doubles as its React Aria selection key.
  // Namespace with element.id so identical-index keys from sibling widgets
  // are never the same DOM `id`, which would violate the HTML uniqueness spec.
  const buttonId = useCallback(
    (index: number) => `${element.id}-${index}`,
    [element.id]
  )

  const selectedKeys = useMemo(
    () =>
      new Set(contentStringsToIndices(options, value).map(i => buttonId(i))),
    [options, value, buttonId]
  )

  const handleSelectionChange = useCallback(
    (keys: Selection): void => {
      if (keys === "all") return
      const idPrefix = `${element.id}-`
      const newSelection = [...keys].map(k =>
        getOptionBaseContent(options[Number(String(k).slice(idPrefix.length))])
      )
      // Avoid redundant state updates (e.g., when disallowEmptySelection blocks
      // deselection of the last item, React Aria still fires onSelectionChange
      // with the unchanged selection set). Use set-equality so insertion-order
      // differences in the React Aria Set do not cause spurious updates.
      const valueSet = new Set(value)
      if (
        newSelection.length === value.length &&
        newSelection.every(v => valueSet.has(v))
      ) {
        return
      }
      setValueWithSource({ value: newSelection, fromUi: true })
    },
    [options, value, setValueWithSource, element.id]
  )

  const isPills = style === ButtonGroupProto.Style.PILLS

  const optionElements = useMemo(() => {
    const ButtonEl = isPills
      ? StyledPillsToggleButton
      : StyledSegmentedControlToggleButton
    const dataVariant = isPills ? "pills" : "segmented_control"
    return options.map((option, index) => (
      <ButtonEl
        // eslint-disable-next-line @eslint-react/no-array-index-key
        key={`${getOptionBaseContent(option)}-${index}`}
        id={buttonId(index)}
        data-variant={dataVariant}
        $containerWidth={containerWidth}
      >
        <DynamicButtonLabel
          icon={option.contentIcon ?? undefined}
          label={option.content ?? ""}
          iconSize="base"
        />
      </ButtonEl>
    ))
  }, [options, isPills, containerWidth, buttonId])

  return (
    <StyledButtonGroup
      className="stButtonGroup"
      data-testid="stButtonGroup"
      containerWidth={containerWidth}
    >
      <WidgetLabel
        label={label}
        disabled={disabled}
        labelVisibility={labelVisibilityProtoValueToEnum(
          labelVisibility?.value ??
            LabelVisibility.LabelVisibilityOptions.COLLAPSED
        )}
      >
        {help && (
          <WidgetLabelHelpIconInline
            content={help}
            placement={Placement.TOP}
            label={label}
          />
        )}
      </WidgetLabel>
      <StyledToggleButtonGroup
        ref={groupRef}
        selectionMode={selectionMode}
        selectedKeys={selectedKeys}
        onSelectionChange={handleSelectionChange}
        isDisabled={disabled}
        disallowEmptySelection={required && selectionMode === "single"}
        aria-label={element.label}
        $isPills={isPills}
        $containerWidth={containerWidth}
      >
        {optionElements}
      </StyledToggleButtonGroup>
    </StyledButtonGroup>
  )
}

export default memo(ButtonGroup)
