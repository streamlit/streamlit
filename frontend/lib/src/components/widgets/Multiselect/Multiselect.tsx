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
  FC,
  memo,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react"

import { ChevronDown } from "baseui/icon"
import {
  type OnChangeParams,
  type Option,
  type SharedStylePropsArg,
  StyledValueContainer,
  TYPE,
  Select as UISelect,
} from "baseui/select"
import { without } from "lodash-es"

import { MultiSelect as MultiSelectProto } from "@streamlit/protobuf"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import {
  getBorderColor,
  getPopoverContainerStyle,
} from "~lib/components/shared/Base/styled-components"
import {
  GROUP_HEADER_PREFIX,
  GROUP_MATCHES_PREFIX,
  SELECT_ALL_ID,
  SELECT_MATCHES_ID,
  VirtualDropdown,
} from "~lib/components/shared/Dropdown"
import {
  WidgetLabel,
  WidgetLabelHelpIcon,
} from "~lib/components/widgets/BaseWidget"
import { StyledUISelect } from "~lib/components/widgets/Multiselect/styled-components"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import {
  GROUP_SEARCH_TYPES,
  useSelectCommon,
} from "~lib/hooks/useSelectCommon"
import { convertRemToPx } from "~lib/theme"
import { labelVisibilityProtoValueToEnum } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

export interface Props {
  disabled: boolean
  element: MultiSelectProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

type MultiselectValue = string[]

const getStateFromWidgetMgr = (
  widgetMgr: WidgetStateManager,
  element: MultiSelectProto
): MultiselectValue | undefined => {
  return widgetMgr.getStringArrayValue(element)
}

const getDefaultStateFromProto = (
  element: MultiSelectProto
): MultiselectValue => {
  return element.default.map(i => element.options[i]) ?? null
}

const getCurrStateFromProto = (
  element: MultiSelectProto
): MultiselectValue => {
  return element.rawValues ?? null
}

const updateWidgetMgrState = (
  element: MultiSelectProto,
  widgetMgr: WidgetStateManager,
  valueWithSource: ValueWithSource<MultiselectValue>,
  fragmentId?: string
): void => {
  widgetMgr.setStringArrayValue(
    element,
    valueWithSource.value,
    { fromUi: valueWithSource.fromUi },
    fragmentId
  )
}

interface InsertGroupHeadersResult {
  options: Option[]
  /** Per-group map of filtered option values (group index → string[]) */
  groupBucketValues: Map<number, string[]>
}

/**
 * Insert "Select all {group}" options and group dividers into the filtered list.
 * Groups with 2+ visible items get a "Select all {label}" or "Select {n} {label}"
 * item prepended. Non-first groups also get a divider (::before separator).
 * Options that don't belong to any group (e.g. from accept_new_options) are appended.
 * Also returns per-group filtered values so click handlers can select them.
 */
function insertGroupHeaders(
  filteredOptions: readonly Option[],
  optionGroupMap: Map<string, number> | null,
  groupLabels: string[],
  filterValue: string
): InsertGroupHeadersResult {
  const groupBucketValues = new Map<number, string[]>()

  if (!optionGroupMap || groupLabels.length === 0) {
    return { options: [...filteredOptions], groupBucketValues }
  }

  // Bucket filtered options by group index
  const buckets = new Map<number, Option[]>()
  const ungrouped: Option[] = []

  for (const opt of filteredOptions) {
    const groupIdx = optionGroupMap.get(opt.value as string)
    if (groupIdx !== undefined) {
      const bucket = buckets.get(groupIdx) ?? []
      if (!buckets.has(groupIdx)) {
        buckets.set(groupIdx, bucket)
      }
      bucket.push(opt)
    } else {
      ungrouped.push(opt)
    }
  }

  // Capture per-group filtered values for click handlers
  for (const [g, items] of buckets) {
    groupBucketValues.set(
      g,
      items.map(opt => opt.value as string)
    )
  }

  const isSearching = filterValue.trim().length > 0

  // Reassemble in group order with "Select all/N {group}" items.
  // Use different ID prefixes for no-search vs search so the click handler
  // knows whether to compute group members from element data or from the ref.
  const result: Option[] = []
  let isFirstGroup = true
  for (let g = 0; g < groupLabels.length; g++) {
    const items = buckets.get(g)
    if (items && items.length > 0) {
      // Only show group select option when there are 2+ items
      if (items.length > 1) {
        const prefix = isSearching ? GROUP_MATCHES_PREFIX : GROUP_HEADER_PREFIX
        const label = isSearching
          ? `Select ${items.length} ${groupLabels[g]}`
          : `Select all ${groupLabels[g]}`
        result.push({
          label,
          value: `${prefix}${g}`,
          id: `${prefix}${g}`,
          isGroupDivider: !isFirstGroup,
        })
      } else if (!isFirstGroup) {
        // Single-item group still needs the divider on its first real option
        result.push({ ...items[0], isGroupDivider: true })
        result.push(...items.slice(1))
        isFirstGroup = false
        continue
      }
      result.push(...items)
      isFirstGroup = false
    }
  }

  // Append ungrouped options (e.g. user-created from accept_new_options)
  result.push(...ungrouped)
  return { options: result, groupBucketValues }
}

const Multiselect: FC<Props> = props => {
  const { element, widgetMgr, fragmentId } = props

  const theme = useEmotionTheme()
  const isInSidebar = useContext(IsSidebarContext)
  const valueContainerRef = useRef<HTMLDivElement>(null)
  const scrollTopRef = useRef(0)

  const queryParamBinding = element.queryParamKey
    ? {
        paramKey: element.queryParamKey,
        valueType: "string_array_value" as const,
        clearable: true,
        urlFormat: "repeated" as const,
      }
    : undefined

  // Ref to store filtered matches for "Select X matches" option
  const selectMatchesRef = useRef<string[]>([])
  // Ref to store per-group filtered matches for "Select all {group}" options
  const groupMatchesRef = useRef<Map<number, string[]>>(new Map())
  const [value, setValueWithSource] = useBasicWidgetState<
    MultiselectValue,
    MultiSelectProto
  >({
    getStateFromWidgetMgr,
    getDefaultStateFromProto,
    getCurrStateFromProto,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
    queryParamBinding,
  })

  const overMaxSelections =
    element.maxSelections > 0 && value.length >= element.maxSelections

  const getNoResultsMsg = useMemo(() => {
    if (element.maxSelections === 0) {
      return "No results"
    } else if (value.length === element.maxSelections) {
      const option = element.maxSelections !== 1 ? "options" : "option"
      return `You can only select up to ${element.maxSelections} ${option}. Remove an option first.`
    }
    return "No results"
  }, [element.maxSelections, value.length])

  const generateNewState = useCallback(
    (data: OnChangeParams): MultiselectValue => {
      switch (data.type) {
        case "remove": {
          return without(value, data.option?.value)
        }
        case "clear": {
          return []
        }
        case "select": {
          // Handle "Select all" option (no search) - compute from element.options
          if (data.option?.value === SELECT_ALL_ID) {
            const unselectedValues = element.options.filter(
              opt => !value.includes(opt)
            )

            // Respect maxSelections limit
            if (element.maxSelections > 0) {
              const remainingSlots = element.maxSelections - value.length
              return [...value, ...unselectedValues.slice(0, remainingSlots)]
            }

            return [...value, ...unselectedValues]
          }

          // Handle "Select X matches" option (with search) - values stored in ref
          if (data.option?.value === SELECT_MATCHES_ID) {
            const filteredValues = selectMatchesRef.current

            // Respect maxSelections limit
            if (element.maxSelections > 0) {
              const remainingSlots = element.maxSelections - value.length
              return [...value, ...filteredValues.slice(0, remainingSlots)]
            }

            return [...value, ...filteredValues]
          }

          // Handle "Select all {group}" (no search) — compute from element data
          const optionValue = data.option?.value as string
          if (optionValue?.startsWith(GROUP_HEADER_PREFIX)) {
            const groupIdx = parseInt(
              optionValue.slice(GROUP_HEADER_PREFIX.length),
              10
            )
            // Compute unselected members of this group from element metadata
            let offset = 0
            for (let i = 0; i < groupIdx; i++) {
              offset += element.groupSizes[i] ?? 0
            }
            const size = element.groupSizes[groupIdx] ?? 0
            const groupValues = element.options
              .slice(offset, offset + size)
              .filter(opt => !value.includes(opt))

            if (element.maxSelections > 0) {
              const remainingSlots = element.maxSelections - value.length
              return [...value, ...groupValues.slice(0, remainingSlots)]
            }

            return [...value, ...groupValues]
          }

          // Handle "Select N {group}" (with search) — values stored in ref
          if (optionValue?.startsWith(GROUP_MATCHES_PREFIX)) {
            const groupIdx = parseInt(
              optionValue.slice(GROUP_MATCHES_PREFIX.length),
              10
            )
            const groupValues = groupMatchesRef.current.get(groupIdx) ?? []

            if (element.maxSelections > 0) {
              const remainingSlots = element.maxSelections - value.length
              return [...value, ...groupValues.slice(0, remainingSlots)]
            }

            return [...value, ...groupValues]
          }

          return value.concat([data.option?.value])
        }
        default: {
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          throw new Error(`State transition is unknown: ${data.type}`)
        }
      }
    },
    [value, element.maxSelections, element.options, element.groupSizes]
  )

  /**
   * This is the onChange handler for the baseweb Select component.
   * It is called whenever the user selects an option or removes an option.
   * When the user starts to modify an option by typing in the input field and
   * pressing backspace, a single `type="remove"` event is fired with the value set
   * to the option that is being removed. The same type of event is fired when the
   * user removes an option by clicking the X icon.
   *
   * If we wanted to prevent an immediate rerun when starting to delete characters,
   * we would need to introduce two new states, e.g. `localValue` and `aboutToDelete`,
   * and commit that state to the backend upon an onBlur event.
   * To keep it simple, we just accept the rerun happening for now.
   */
  const onChange = useCallback(
    (params: OnChangeParams) => {
      if (
        element.maxSelections &&
        params.type === "select" &&
        value.length >= element.maxSelections
      ) {
        return
      }
      setValueWithSource({
        value: generateNewState(params),
        fromUi: true,
      })
    },
    [element.maxSelections, generateNewState, setValueWithSource, value.length]
  )

  const { options } = element

  const {
    placeholder,
    disabled: shouldDisable,
    selectOptions,
    inputReadOnly,
    valuesToUiMulti,
    createFilterOptions,
  } = useSelectCommon({
    options,
    isMulti: true,
    acceptNewOptions: element.acceptNewOptions ?? false,
    placeholderInput: element.placeholder,
    searchType: element.searchType,
  })

  // Build a mapping from option value to its group index, derived from proto fields.
  // Returns null when no groups are present.
  const isGroupSearchType = GROUP_SEARCH_TYPES.has(element.searchType)
  const optionGroupMap = useMemo((): Map<string, number> | null => {
    const { groupLabels, groupSizes } = element
    if (!groupLabels || groupLabels.length === 0) {
      return null
    }

    const map = new Map<string, number>()
    let offset = 0
    for (let g = 0; g < groupLabels.length; g++) {
      const size = groupSizes[g] ?? 0
      for (let i = 0; i < size; i++) {
        if (offset + i < options.length) {
          map.set(options[offset + i], g)
        }
      }
      offset += size
    }
    return map
  }, [element, options])

  const filterOptions = useCallback(
    (options: readonly Option[], filterValue: string): readonly Option[] => {
      if (overMaxSelections) {
        return []
      }

      // Get filtered options (excluding already selected ones) for the dropdown
      const filteredOptions = createFilterOptions(value)(options, filterValue)

      // Insert group headers when groups are present.
      // Non-group search types show groups when browsing but flatten during search.
      const isSearching = filterValue.trim().length > 0
      const effectiveGroupMap =
        !isGroupSearchType && isSearching ? null : optionGroupMap
      const { options: withGroups, groupBucketValues } = insertGroupHeaders(
        filteredOptions,
        effectiveGroupMap,
        element.groupLabels,
        filterValue
      )

      // Store per-group filtered values only when searching (same pattern as
      // selectMatchesRef) to avoid stale data from no-search filterOptions calls.
      if (filterValue.trim()) {
        groupMatchesRef.current = groupBucketValues
      }

      // Add "Select all" or "Select X matches" option when multiple selectable options.
      // Count only non-group-header options for the threshold.
      const isGroupOption = (id: unknown): boolean =>
        typeof id === "string" &&
        (id.startsWith(GROUP_HEADER_PREFIX) ||
          id.startsWith(GROUP_MATCHES_PREFIX))
      const selectableCount = withGroups.filter(
        opt => !isGroupOption(opt.id)
      ).length

      if (selectableCount > 1) {
        if (filterValue.trim()) {
          selectMatchesRef.current = filteredOptions.map(
            (opt: Option) => opt.value as string
          )
          const selectMatchesOption: Option = {
            label: `Select ${selectableCount} matches`,
            value: SELECT_MATCHES_ID,
            id: SELECT_MATCHES_ID,
          }
          return [selectMatchesOption, ...withGroups]
        }

        const selectAllOption: Option = {
          label: "Select all",
          value: SELECT_ALL_ID,
          id: SELECT_ALL_ID,
        }
        return [selectAllOption, ...withGroups]
      }

      return withGroups
    },
    [
      createFilterOptions,
      element.groupLabels,
      isGroupSearchType,
      optionGroupMap,
      overMaxSelections,
      value,
    ]
  )

  const disabled = props.disabled || shouldDisable
  const valueFromState = useMemo(
    () => valuesToUiMulti(value),
    [valuesToUiMulti, value]
  )

  // Calculate the max height of the selectbox based on the baseFontSize
  // to better support advanced theming
  const maxHeight = useMemo(() => {
    // Set max height to cut through fifth row of options so the scroll state is apparent
    const rowHeight = `calc(${theme.sizes.elementHighlightHeight} + ${theme.sizes.tagMarginInsideBorder})`
    const maxHeight = `calc(4.5 * ${rowHeight} + ${theme.sizes.tagMarginInsideBorder} + 2 * ${theme.sizes.borderWidth})`
    return maxHeight
  }, [
    theme.sizes.elementHighlightHeight,
    theme.sizes.tagMarginInsideBorder,
    theme.sizes.borderWidth,
  ])

  // Runs every render to capture BaseWeb's internal DOM updates that can reset scroll position.
  // Performance is acceptable since this is a leaf component with no children to re-render.
  useLayoutEffect(() => {
    if (valueContainerRef.current) {
      valueContainerRef.current.scrollTop = scrollTopRef.current
    }
  })

  const handleValueContainerScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Safe: layout already computed during scroll event
      scrollTopRef.current = e.currentTarget.scrollTop
    },
    []
  )

  // Memoized to prevent BaseWeb from remounting on every render
  const ValueContainer = useMemo(
    () =>
      // eslint-disable-next-line @eslint-react/no-nested-component-definitions -- Required for baseweb component override with refs
      function ValueContainer(
        props: SharedStylePropsArg & { children: React.ReactNode }
      ): React.ReactElement {
        return (
          <StyledValueContainer
            {...props}
            ref={valueContainerRef}
            onScroll={handleValueContainerScroll}
          />
        )
      },
    [handleValueContainerScroll]
  )

  return (
    <div className="stMultiSelect" data-testid="stMultiSelect">
      <WidgetLabel
        label={element.label}
        disabled={disabled}
        labelVisibility={labelVisibilityProtoValueToEnum(
          element.labelVisibility?.value
        )}
      >
        {element.help && (
          <WidgetLabelHelpIcon content={element.help} label={element.label} />
        )}
      </WidgetLabel>
      <StyledUISelect>
        <UISelect
          creatable={element.acceptNewOptions ?? false}
          options={selectOptions}
          labelKey="label"
          valueKey="value"
          aria-label={element.label}
          placeholder={placeholder}
          type={TYPE.select}
          multi
          onChange={onChange}
          value={valueFromState}
          disabled={disabled}
          size={"compact"}
          noResultsMsg={getNoResultsMsg}
          filterOptions={filterOptions}
          closeOnSelect={false}
          ignoreCase={false}
          overrides={{
            DropdownContainer: {
              style: () => ({
                ...getPopoverContainerStyle(theme),

                // Height constraint - VirtualDropdown handles scrolling internally
                maxHeight: `min(${theme.sizes.maxDropdownHeight}, 70vh)`,
                overflow: "hidden",
              }),
            },
            Popover: {
              props: {
                ignoreBoundary: isInSidebar,
                popoverMargin: convertRemToPx(theme.spacing.twoXS),
                overrides: {
                  Body: {
                    style: () => ({
                      // Scrolling is handled by the VirtualDropdown component
                      overflow: "hidden",
                    }),
                  },
                },
              },
            },
            SelectArrow: {
              component: ChevronDown,
              props: {
                style: {
                  cursor: "pointer",
                },
                overrides: {
                  Svg: {
                    style: () => ({
                      width: theme.iconSizes.xl,
                      height: theme.iconSizes.xl,
                    }),
                  },
                },
              },
            },

            IconsContainer: {
              style: () => ({
                paddingRight: theme.spacing.sm,
              }),
            },
            ControlContainer: {
              style: ({ $isFocused }: { $isFocused: boolean }) => {
                const borderColor = getBorderColor(theme.colors, $isFocused)
                return {
                  maxHeight: maxHeight,
                  minHeight: theme.sizes.minElementHeight,
                  // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                  borderLeftWidth: theme.sizes.borderWidth,
                  borderRightWidth: theme.sizes.borderWidth,
                  borderTopWidth: theme.sizes.borderWidth,
                  borderBottomWidth: theme.sizes.borderWidth,

                  borderTopColor: borderColor,
                  borderRightColor: borderColor,
                  borderBottomColor: borderColor,
                  borderLeftColor: borderColor,
                }
              },
            },
            Placeholder: {
              style: () => ({
                flex: "inherit",
                color: disabled
                  ? theme.colors.fadedText40
                  : theme.colors.fadedText60,
                // Position absolute so Input can overlay it
                position: "absolute",
                // Vertically center in the container
                top: "50%",
                transform: "translateY(-50%)",
                // Left padding aligns with tag text
                paddingLeft: theme.spacing.sm,
                // Allow clicks to pass through to input
                pointerEvents: "none",
              }),
            },
            ValueContainer: {
              component: ValueContainer,
              style: () => ({
                overflowY: "auto",
                // Uniform top and left padding - placeholder/input/tags are sized
                paddingLeft: theme.sizes.tagMarginInsideBorder,
                paddingTop: theme.sizes.tagMarginInsideBorder,
                // Right and bottom gaps are deferred to items
                paddingBottom: theme.spacing.none,
                paddingRight: theme.spacing.none,
              }),
            },
            ClearIcon: {
              props: {
                overrides: {
                  Svg: {
                    style: {
                      color: theme.colors.grayTextColor,
                      // setting this width and height makes the clear-icon align with dropdown arrows of other input fields
                      padding: theme.spacing.threeXS,
                      height: theme.sizes.clearIconSize,
                      width: theme.sizes.clearIconSize,
                      cursor: "pointer",
                      ":hover": {
                        fill: theme.colors.bodyText,
                      },
                    },
                  },
                },
              },
            },
            SearchIcon: {
              style: {
                color: theme.colors.grayTextColor,
              },
            },
            Tag: {
              props: {
                overrides: {
                  Root: {
                    style: {
                      fontWeight: theme.fontWeights.normal,
                      borderTopLeftRadius: theme.radii.md2,
                      borderTopRightRadius: theme.radii.md2,
                      borderBottomRightRadius: theme.radii.md2,
                      borderBottomLeftRadius: theme.radii.md2,
                      fontSize: theme.fontSizes.md,
                      paddingLeft: theme.spacing.sm,
                      // Top and left margins are deferred to ValueContainer padding
                      marginTop: theme.spacing.none,
                      marginLeft: theme.spacing.none,
                      // Right and bottom margins to handle tag spacing and row gap
                      marginRight: theme.spacing.twoXS,
                      marginBottom: theme.sizes.tagMarginInsideBorder,
                      height: theme.sizes.elementHighlightHeight,
                      maxWidth: `calc(100% - ${theme.spacing.lg})`,
                      // Using !important because the alternative would be
                      // uglier: we'd have to put it under a selector like
                      // "&[role="button"]:not(:disabled)" in order to win in
                      // the order of the precedence.
                      cursor: "default !important",
                      // Allow clicks to pass through to the container/input
                      pointerEvents: "none",
                    },
                  },
                  Action: {
                    style: {
                      paddingLeft: theme.spacing.none,
                      // Re-enable pointer events for the close button
                      pointerEvents: "auto",
                    },
                  },
                  ActionIcon: {
                    props: {
                      overrides: {
                        Svg: {
                          style: {
                            // The action icon should be around 0.625% of the parent font size.
                            width: "0.625em",
                            height: "0.625em",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            MultiValue: {
              props: {
                overrides: {
                  Root: {
                    style: {
                      fontSize: theme.fontSizes.sm,
                    },
                  },
                },
              },
            },
            InputContainer: {
              style: ({ $isFocused }: { $isFocused: boolean }) => ({
                // Height matches tags
                height: theme.sizes.elementHighlightHeight,
                // Alignment and left margin to match tags (ValueContainer padding)
                alignSelf: "flex-start",
                marginLeft: theme.spacing.none,
                marginTop: theme.spacing.none,
                // Bottom margin required to size the container correctly if the
                // input is orphaned on a new line (in focus)
                marginBottom: theme.sizes.tagMarginInsideBorder,
                // Stack input when not focused to prevent premature line wrap
                position: $isFocused ? "relative" : "absolute",
                width: "fit-content",
                flexGrow: 0,
                // Center input vertically
                display: "flex",
              }),
            },
            Input: {
              props: {
                readOnly: inputReadOnly,
              },
              style: () => ({
                color: theme.colors.bodyText,
                caretColor: theme.colors.bodyText,
                // Left padding aligns cursor with tag/placeholder text (only when focused)
                paddingLeft: theme.spacing.sm,
                fieldSizing: "content",
              }),
            },
            Dropdown: { component: VirtualDropdown },
          }}
        />
      </StyledUISelect>
    </div>
  )
}

export default memo(Multiselect)
