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
  Fragment,
  memo,
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { FloatingPortal } from "@floating-ui/react"

import {
  FilterBar as FilterBarProto,
  FilterType,
  IFilterColumnMeta,
} from "@streamlit/protobuf"

import { FLOATING_OVERLAY_PORTAL_ID } from "~lib/components/core/Portal/constants"
import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useFloatingOverlay } from "~lib/hooks/useFloatingOverlay"
import { useOverlayDismissal } from "~lib/hooks/useOverlayDismissal"
import useTimeout from "~lib/hooks/useTimeout"
import { convertRemToPx } from "~lib/theme/utils"
import { labelVisibilityProtoValueToEnum } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import ColumnPicker from "./ColumnPicker"
import FilterPill, { type FilterValue } from "./FilterPill"
import DateRangeFilter from "./filters/DateRangeFilter"
import MultiselectFilter from "./filters/MultiselectFilter"
import RangeFilter from "./filters/RangeFilter"
import TextFilter from "./filters/TextFilter"
import TimeRangeFilter from "./filters/TimeRangeFilter"
import ToggleFilter from "./filters/ToggleFilter"
import {
  StyledActiveCountBadge,
  StyledAddFilterButton,
  StyledClearAllButton,
  StyledDisclosureButton,
  StyledEmptyMessage,
  StyledFilterBarContainer,
  StyledFilterBarHeader,
  StyledLogicToggle,
  StyledOrSeparator,
  StyledPillRow,
  StyledPopoverContainer,
} from "./styled-components"

export interface Props {
  disabled: boolean
  element: FilterBarProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

type FilterState = Record<string, FilterValue>

const COLUMN_PICKER_KEY = "__column_picker__"

function getFilterTypeString(
  filterType: FilterType | null | undefined
): string {
  switch (filterType) {
    case FilterType.FILTER_TYPE_MULTISELECT:
      return "multiselect"
    case FilterType.FILTER_TYPE_TEXT:
      return "text"
    case FilterType.FILTER_TYPE_RANGE:
      return "range"
    case FilterType.FILTER_TYPE_TOGGLE:
      return "toggle"
    case FilterType.FILTER_TYPE_DATE_RANGE:
    case FilterType.FILTER_TYPE_DATETIME_RANGE:
      return "date_range"
    case FilterType.FILTER_TYPE_TIME_RANGE:
      return "time_range"
    default:
      return "multiselect"
  }
}

function getInitialState(
  element: FilterBarProto,
  widgetMgr: WidgetStateManager
): FilterState {
  const widgetValue = widgetMgr.getStringValue({
    id: element.id,
    formId: element.formId,
  })
  if (widgetValue) {
    try {
      return JSON.parse(widgetValue) as FilterState
    } catch {
      return {}
    }
  }

  if (element.value) {
    try {
      return JSON.parse(element.value) as FilterState
    } catch {
      return {}
    }
  }

  return {}
}

function FilterBar({
  element,
  disabled,
  widgetMgr,
  fragmentId,
}: Readonly<Props>): ReactElement {
  const theme = useEmotionTheme()
  const [filterState, setFilterState] = useState<FilterState>(() =>
    getInitialState(element, widgetMgr)
  )
  const [openPopover, setOpenPopover] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(element.expanded)
  const [focusedPillIndex, setFocusedPillIndex] = useState(0)

  const pillRefsRef = useRef<Map<number, HTMLButtonElement>>(new Map())
  const pendingStateRef = useRef<FilterState | null>(null)

  const commitState = useCallback(
    (state: FilterState): void => {
      const json = JSON.stringify(state)
      widgetMgr.setStringValue(
        { id: element.id, formId: element.formId },
        json,
        { fromUi: true },
        fragmentId
      )
    },
    [element.id, element.formId, widgetMgr, fragmentId]
  )

  const { restart: restartDebounce } = useTimeout(
    () => {
      if (pendingStateRef.current) {
        commitState(pendingStateRef.current)
        pendingStateRef.current = null
      }
    },
    150,
    { autoStart: false }
  )

  const debouncedCommit = useCallback(
    (state: FilterState): void => {
      pendingStateRef.current = state
      restartDebounce()
    },
    [restartDebounce]
  )

  useEffect(() => {
    commitState(filterState)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { refs, floatingStyles } = useFloatingOverlay({
    open: openPopover !== null,
    placement: "bottom-start",
    offsetPx: convertRemToPx(theme.spacing.twoXS),
  })

  const { setFloatingRef } = useOverlayDismissal({
    isOpen: openPopover !== null,
    onClose: () => setOpenPopover(null),
    floatingSetFn: refs.setFloating,
  })

  const columnMap = useMemo(() => {
    const map = new Map<string, IFilterColumnMeta>()
    for (const col of element.columns) {
      if (col.name) {
        map.set(col.name, col)
      }
    }
    return map
  }, [element.columns])

  const displayMaps = useMemo(() => {
    const maps = new Map<string, Map<string, string>>()
    for (const col of element.columns) {
      if (
        col.name &&
        (col.displayOptions?.length ?? 0) > 0 &&
        col.options &&
        col.displayOptions?.length === col.options.length
      ) {
        const m = new Map<string, string>()
        for (let i = 0; i < col.options.length; i++) {
          m.set(col.options[i], col.displayOptions[i])
        }
        maps.set(col.name, m)
      }
    }
    return maps
  }, [element.columns])

  const validColumnNames = useMemo(
    () => new Set(element.columns.map(c => c.name)),
    [element.columns]
  )

  useEffect(() => {
    const pruned: FilterState = {}
    let changed = false
    for (const [key, val] of Object.entries(filterState)) {
      if (key.startsWith("_") || validColumnNames.has(key)) {
        pruned[key] = val
      } else {
        changed = true
      }
    }
    if (changed) {
      setFilterState(pruned)
      commitState(pruned)
    }
  }, [validColumnNames]) // eslint-disable-line react-hooks/exhaustive-deps

  const availableColumns = useMemo(() => {
    return element.columns.filter(
      col => col.name && !(col.name in filterState) && !col.disabled
    )
  }, [element.columns, filterState])

  const handlePillMounted = useCallback(
    (node: HTMLButtonElement | null): void => {
      if (node) {
        refs.setReference(node)
      }
    },
    [refs]
  )

  const handlePillToggle = useCallback(
    (columnName: string, e: React.MouseEvent<HTMLButtonElement>): void => {
      if (disabled) return
      refs.setReference(e.currentTarget)
      setOpenPopover(prev => (prev === columnName ? null : columnName))
    },
    [disabled, refs]
  )

  const handleAddFilterClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>): void => {
      if (disabled) return
      refs.setReference(e.currentTarget)
      setOpenPopover(prev =>
        prev === COLUMN_PICKER_KEY ? null : COLUMN_PICKER_KEY
      )
    },
    [disabled, refs]
  )

  const syncGroupColumns = useCallback((state: FilterState): FilterState => {
    const groups = (state as Record<string, unknown>)._groups
    if (!Array.isArray(groups) || groups.length === 0) return state
    const activeColumns = Object.keys(state).filter(k => !k.startsWith("_"))
    return {
      ...state,
      _groups: [
        { ...(groups[0] as Record<string, unknown>), columns: activeColumns },
      ],
    } as unknown as FilterState
  }, [])

  const handleColumnSelect = useCallback(
    (columnName: string): void => {
      const col = columnMap.get(columnName)
      const filterType = getFilterTypeString(col?.filterType)
      const defaultOperator = col?.operators?.[0] ?? undefined
      const initial: FilterValue = { type: filterType }
      if (defaultOperator) {
        initial.operator = defaultOperator
      }
      if (filterType === "text") {
        initial.query = ""
      } else {
        initial.values = []
      }
      const newState = syncGroupColumns({
        ...filterState,
        [columnName]: initial,
      })
      setFilterState(newState)
      setOpenPopover(columnName)
    },
    [filterState, columnMap, syncGroupColumns]
  )

  const handleRemoveFilter = useCallback(
    (columnName: string): void => {
      const entries = Object.keys(filterState).filter(k => !k.startsWith("_"))
      const removedIndex = entries.indexOf(columnName)
      const intermediate = { ...filterState }
      delete intermediate[columnName]
      const newState = syncGroupColumns(intermediate)
      setFilterState(newState)
      debouncedCommit(newState)
      if (openPopover === columnName) {
        setOpenPopover(null)
      }
      const remainingCount = entries.length - 1
      if (remainingCount > 0) {
        const nextFocus = Math.min(removedIndex, remainingCount - 1)
        setFocusedPillIndex(nextFocus)
        requestAnimationFrame(() => {
          pillRefsRef.current.get(nextFocus)?.focus()
        })
      }
    },
    [filterState, debouncedCommit, openPopover, syncGroupColumns]
  )

  const handleClearAll = useCallback((): void => {
    const newState: FilterState = {}
    // Preserve _groups structure but clear columns
    const groups = (filterState as Record<string, unknown>)._groups
    if (Array.isArray(groups) && groups.length > 0) {
      ;(newState as Record<string, unknown>)._groups = [
        { ...(groups[0] as Record<string, unknown>), columns: [] },
      ]
    }
    setFilterState(newState)
    commitState(newState)
    setOpenPopover(null)
  }, [commitState, filterState])

  const filterLogic = useMemo((): "and" | "or" => {
    const groups = (filterState as Record<string, unknown>)._groups
    if (Array.isArray(groups) && groups.length > 0) {
      return (groups[0] as Record<string, unknown>).logic === "or"
        ? "or"
        : "and"
    }
    // Backward compat: flat _logic key
    return (filterState as Record<string, unknown>)._logic === "or"
      ? "or"
      : "and"
  }, [filterState])

  const handleLogicToggle = useCallback((): void => {
    const newLogic = filterLogic === "and" ? "or" : "and"
    const activeColumns = Object.keys(filterState).filter(
      k => !k.startsWith("_")
    )
    const newState = {
      ...filterState,
      _groups: [{ logic: newLogic, columns: activeColumns }],
    } as unknown as FilterState
    // Remove legacy _logic key if present
    delete (newState as Record<string, unknown>)._logic
    setFilterState(newState)
    commitState(newState)
  }, [filterState, filterLogic, commitState])

  const handleMultiselectToggle = useCallback(
    (columnName: string, value: string): void => {
      const current = filterState[columnName]
      if (!current) return
      const values = current.values?.includes(value)
        ? current.values.filter(v => v !== value)
        : [...(current.values ?? []), value]

      const newState: FilterState = {
        ...filterState,
        [columnName]: { ...current, values },
      }
      setFilterState(newState)
      debouncedCommit(newState)
    },
    [filterState, debouncedCommit]
  )

  const handleMultiselectAll = useCallback(
    (columnName: string): void => {
      const col = columnMap.get(columnName)
      if (!col) return
      const current = filterState[columnName]
      const newState: FilterState = {
        ...filterState,
        [columnName]: { ...current, values: [...(col.options ?? [])] },
      }
      setFilterState(newState)
      debouncedCommit(newState)
    },
    [filterState, columnMap, debouncedCommit]
  )

  const handleMultiselectClear = useCallback(
    (columnName: string): void => {
      const current = filterState[columnName]
      const newState: FilterState = {
        ...filterState,
        [columnName]: { ...current, values: [] },
      }
      setFilterState(newState)
      debouncedCommit(newState)
    },
    [filterState, debouncedCommit]
  )

  const handleRangeChange = useCallback(
    (columnName: string, min: number | null, max: number | null): void => {
      const current = filterState[columnName]
      const newState: FilterState = {
        ...filterState,
        [columnName]: { ...current, type: "range", min, max },
      }
      setFilterState(newState)
      debouncedCommit(newState)
    },
    [filterState, debouncedCommit]
  )

  const handleToggleChange = useCallback(
    (columnName: string, value: boolean | null): void => {
      const current = filterState[columnName]
      const newState: FilterState = {
        ...filterState,
        [columnName]: { ...current, type: "toggle", value },
      }
      setFilterState(newState)
      commitState(newState)
    },
    [filterState, commitState]
  )

  const handleDateRangeChange = useCallback(
    (columnName: string, start: string | null, end: string | null): void => {
      const current = filterState[columnName]
      const newState: FilterState = {
        ...filterState,
        [columnName]: { ...current, type: "date_range", start, end },
      }
      setFilterState(newState)
      commitState(newState)
    },
    [filterState, commitState]
  )

  const handleOperatorChange = useCallback(
    (columnName: string, operator: string): void => {
      const current = filterState[columnName]
      if (!current) return
      const newState: FilterState = {
        ...filterState,
        [columnName]: { ...current, operator },
      }
      setFilterState(newState)
      commitState(newState)
    },
    [filterState, commitState]
  )

  const handleTextChange = useCallback(
    (columnName: string, operator: string, query: string): void => {
      const current = filterState[columnName]
      const newState: FilterState = {
        ...filterState,
        [columnName]: { ...current, type: "text", operator, query },
      }
      setFilterState(newState)
      debouncedCommit(newState)
    },
    [filterState, debouncedCommit]
  )

  const activeFilterEntries = Object.entries(filterState).filter(
    ([key]) => !key.startsWith("_")
  )

  const clampedFocusIndex = Math.min(
    focusedPillIndex,
    Math.max(0, activeFilterEntries.length - 1)
  )

  const renderPopoverContent = (): ReactElement | null => {
    if (openPopover === COLUMN_PICKER_KEY) {
      return (
        <ColumnPicker
          availableColumns={availableColumns}
          onSelect={handleColumnSelect}
        />
      )
    }

    const col = openPopover ? columnMap.get(openPopover) : undefined
    if (openPopover && col) {
      const filterValue = filterState[openPopover]
      const operators = col.operators ?? []
      const currentOperator = filterValue?.operator ?? operators[0] ?? ""

      switch (filterValue?.type) {
        case "text":
          return (
            <TextFilter
              columnName={openPopover}
              operators={operators}
              currentOperator={currentOperator}
              currentQuery={filterValue.query ?? ""}
              onChange={(op, query): void =>
                handleTextChange(openPopover, op, query)
              }
              onDelete={(): void => handleRemoveFilter(openPopover)}
              disabled={disabled}
            />
          )
        case "range":
          return (
            <RangeFilter
              columnName={openPopover}
              columnMin={col.minValue}
              columnMax={col.maxValue}
              currentMin={filterValue.min}
              currentMax={filterValue.max}
              operators={operators}
              currentOperator={currentOperator}
              onOperatorChange={(op): void =>
                handleOperatorChange(openPopover, op)
              }
              onChange={(min, max): void =>
                handleRangeChange(openPopover, min, max)
              }
              onDelete={(): void => handleRemoveFilter(openPopover)}
              disabled={disabled}
            />
          )
        case "toggle":
          return (
            <ToggleFilter
              columnName={openPopover}
              currentValue={filterValue.value ?? null}
              operators={operators}
              currentOperator={currentOperator}
              onOperatorChange={(op): void =>
                handleOperatorChange(openPopover, op)
              }
              onChange={(value): void =>
                handleToggleChange(openPopover, value)
              }
              onDelete={(): void => handleRemoveFilter(openPopover)}
              disabled={disabled}
            />
          )
        case "time_range":
          return (
            <TimeRangeFilter
              columnName={openPopover}
              currentStart={filterValue.start ?? null}
              currentEnd={filterValue.end ?? null}
              operators={operators}
              currentOperator={currentOperator}
              onOperatorChange={(op): void =>
                handleOperatorChange(openPopover, op)
              }
              onChange={(start, end): void =>
                handleDateRangeChange(openPopover, start, end)
              }
              onDelete={(): void => handleRemoveFilter(openPopover)}
              disabled={disabled}
            />
          )
        case "date_range":
        case "datetime_range":
          return (
            <DateRangeFilter
              columnName={openPopover}
              currentStart={filterValue.start ?? null}
              currentEnd={filterValue.end ?? null}
              operators={operators}
              currentOperator={currentOperator}
              onOperatorChange={(op): void =>
                handleOperatorChange(openPopover, op)
              }
              onChange={(start, end): void =>
                handleDateRangeChange(openPopover, start, end)
              }
              onDelete={(): void => handleRemoveFilter(openPopover)}
              disabled={disabled}
            />
          )
        case "multiselect":
        default:
          return (
            <MultiselectFilter
              columnName={openPopover}
              options={col.options ?? []}
              displayOptions={
                col.displayOptions?.length ? col.displayOptions : undefined
              }
              selectedValues={filterValue?.values ?? []}
              operators={operators}
              currentOperator={currentOperator}
              onOperatorChange={(op): void =>
                handleOperatorChange(openPopover, op)
              }
              onToggleValue={(value): void =>
                handleMultiselectToggle(openPopover, value)
              }
              onSelectAll={(): void => handleMultiselectAll(openPopover)}
              onClearAll={(): void => handleMultiselectClear(openPopover)}
              onDelete={(): void => handleRemoveFilter(openPopover)}
              disabled={disabled}
            />
          )
      }
    }

    return null
  }

  const labelVisibility = labelVisibilityProtoValueToEnum(
    element.labelVisibility?.value
  )
  const activeCount = activeFilterEntries.length
  const containerStyle = element.width
    ? { maxWidth: `${element.width}px` }
    : undefined

  const isColumnDisabled = useCallback(
    (columnName: string): boolean => {
      return columnMap.get(columnName)?.disabled ?? false
    },
    [columnMap]
  )

  const getPillRef = useCallback(
    (index: number) =>
      (node: HTMLButtonElement | null): void => {
        if (node) {
          pillRefsRef.current.set(index, node)
        } else {
          pillRefsRef.current.delete(index)
        }
      },
    []
  )

  const handlePillRowKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>): void => {
      const count = activeFilterEntries.length
      if (count === 0) return

      let nextIndex: number
      switch (e.key) {
        case "ArrowRight":
          nextIndex = (clampedFocusIndex + 1) % count
          break
        case "ArrowLeft":
          nextIndex = (clampedFocusIndex - 1 + count) % count
          break
        case "Home":
          nextIndex = 0
          break
        case "End":
          nextIndex = count - 1
          break
        default:
          return
      }

      e.preventDefault()
      setFocusedPillIndex(nextIndex)
      pillRefsRef.current.get(nextIndex)?.focus()
    },
    [activeFilterEntries.length, clampedFocusIndex]
  )

  const handlePillFocus = useCallback((index: number): void => {
    setFocusedPillIndex(prev => (prev === index ? prev : index))
  }, [])

  return (
    <StyledFilterBarContainer data-testid="stFilterBar" style={containerStyle}>
      <StyledFilterBarHeader>
        {element.label && (
          <WidgetLabel
            label={element.label}
            disabled={disabled}
            labelVisibility={labelVisibility}
          >
            {element.help && (
              <WidgetLabelHelpIcon
                content={element.help}
                label={element.label}
              />
            )}
          </WidgetLabel>
        )}

        <StyledDisclosureButton
          onClick={(): void => setIsExpanded(prev => !prev)}
          aria-label={isExpanded ? "Collapse filters" : "Expand filters"}
          aria-expanded={isExpanded}
        >
          <DynamicIcon iconValue=":material/filter_list:" size="base" />
          {activeCount > 0 && !isExpanded && (
            <StyledActiveCountBadge>{activeCount}</StyledActiveCountBadge>
          )}
          <span
            style={{
              display: "inline-flex",
              transition: "transform 150ms ease",
              transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)",
            }}
          >
            <DynamicIcon iconValue=":material/expand_more:" size="base" />
          </span>
        </StyledDisclosureButton>
      </StyledFilterBarHeader>

      {isExpanded && element.columns.length === 0 && (
        <StyledEmptyMessage>No filterable columns</StyledEmptyMessage>
      )}

      {isExpanded && element.columns.length > 0 && (
        <>
          <StyledPillRow
            role="toolbar"
            aria-label="Active filters"
            onKeyDown={handlePillRowKeyDown}
          >
            {activeCount === 0 && !disabled && (
              <StyledEmptyMessage>
                Click &ldquo;{element.placeholder || "Add filter"}&rdquo; to
                get started
              </StyledEmptyMessage>
            )}

            {activeCount >= 2 && !disabled && (
              <StyledLogicToggle
                $isOr={filterLogic === "or"}
                onClick={handleLogicToggle}
                tabIndex={-1}
                aria-label={`Filter logic: ${filterLogic === "or" ? "Match any" : "Match all"}. Click to toggle.`}
              >
                {filterLogic === "or" ? "OR" : "AND"}
              </StyledLogicToggle>
            )}

            {activeFilterEntries.map(([columnName, filterValue], index) => (
              <Fragment key={columnName}>
                {filterLogic === "or" && index > 0 && (
                  <StyledOrSeparator>or</StyledOrSeparator>
                )}
                <FilterPill
                  columnName={columnName}
                  filterValue={filterValue}
                  displayOptions={displayMaps.get(columnName)}
                  isOpen={openPopover === columnName}
                  disabled={disabled || isColumnDisabled(columnName)}
                  tabIndex={index === clampedFocusIndex ? 0 : -1}
                  pillRef={getPillRef(index)}
                  onToggle={(e): void => handlePillToggle(columnName, e)}
                  onPillMounted={handlePillMounted}
                  onFocus={(): void => handlePillFocus(index)}
                />
              </Fragment>
            ))}

            {activeCount >= 2 && !disabled && (
              <StyledClearAllButton
                onClick={handleClearAll}
                aria-label="Clear all filters"
              >
                Clear all
              </StyledClearAllButton>
            )}

            {!disabled && (
              <StyledAddFilterButton
                onClick={handleAddFilterClick}
                aria-label={element.placeholder || "Add filter"}
                aria-expanded={openPopover === COLUMN_PICKER_KEY}
                aria-haspopup="listbox"
              >
                <DynamicIcon iconValue=":material/add:" size="sm" />
                {element.placeholder || "Add filter"}
              </StyledAddFilterButton>
            )}
          </StyledPillRow>

          {openPopover !== null && (
            <FloatingPortal id={FLOATING_OVERLAY_PORTAL_ID}>
              <StyledPopoverContainer
                ref={setFloatingRef}
                style={floatingStyles}
                data-testid="stFilterBarPopover"
                onKeyDown={(e: React.KeyboardEvent): void => {
                  if (e.key === "Enter" && !e.defaultPrevented) {
                    e.preventDefault()
                    setOpenPopover(null)
                  }
                }}
              >
                {renderPopoverContent()}
              </StyledPopoverContainer>
            </FloatingPortal>
          )}
        </>
      )}
    </StyledFilterBarContainer>
  )
}

export default memo(FilterBar)
