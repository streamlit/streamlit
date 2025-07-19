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

import { GridCell, GridCellKind } from "@glideapps/glide-data-grid"
import { MultiSelectCellType } from "@glideapps/glide-data-grid-cells"
import { unique } from "vega-lite"

import {
  blend,
  convertRemToPx,
  EmotionTheme,
  getMarkdownBgColors,
} from "~lib/theme"
import { isNullOrUndefined } from "~lib/util/utils"

import {
  arrayToCopyValue,
  BaseColumn,
  BaseColumnProps,
  getErrorCell,
  mergeColumnParameters,
  toSafeArray,
  toSafeString,
} from "./utils"

type SelectOption = { value: string; label?: string; color?: string }

const getColorMapping = (theme: EmotionTheme): Map<string, string> => {
  const textBackgroundColors = getMarkdownBgColors(theme)

  return new Map(
    Object.entries({
      red: textBackgroundColors.redbg,
      blue: textBackgroundColors.bluebg,
      green: textBackgroundColors.greenbg,
      yellow: textBackgroundColors.yellowbg,
      violet: textBackgroundColors.violetbg,
      purple: textBackgroundColors.purplebg,
      orange: textBackgroundColors.orangebg,
      gray: textBackgroundColors.graybg,
      grey: textBackgroundColors.graybg,
      primary: textBackgroundColors.primarybg,
    })
  )
}
/**
 * Unifies the options into the format required by the multi-select cell.
 *
 * @param options The options to prepare.
 * @returns The prepared options in the format required by the multi-select cell.
 */
export const prepareOptions = (
  options: readonly (string | SelectOption)[],
  theme: EmotionTheme
): { value: string; label?: string; color?: string }[] => {
  if (isNullOrUndefined(options)) {
    return []
  }

  const colorMapping = getColorMapping(theme)

  return options
    .filter(opt => opt !== null && opt !== "")
    .map(option => {
      if (typeof option === "string") {
        return {
          value: toSafeString(option).trim(),
          label: undefined,
          color: undefined,
        }
      }

      // The upstream implemenation has some issues with the alpha channel.
      // Therefore, we are blending the color with the background to remove the alpha channel.

      const optionColor = option.color
        ? blend(
            colorMapping.get(option.color) ?? option.color,
            theme.colors.bgColor
          )
        : undefined

      return {
        value: toSafeString(option.value).trim(),
        label: option.label ?? undefined,
        color: optionColor,
      }
    })
}

export interface MultiSelectColumnParams {
  readonly options: (string | SelectOption)[]
  readonly accept_new_options?: boolean
}

function MultiSelectColumn(
  props: BaseColumnProps,
  theme: EmotionTheme
): BaseColumn {
  const parameters = mergeColumnParameters(
    // Default parameters:
    {
      options: [],
      accept_new_options: false,
    },
    // User parameters:
    props.columnTypeOptions
  ) as MultiSelectColumnParams

  const preparedOptions = prepareOptions(parameters.options, theme)
  const uniqueOptions = unique(
    preparedOptions.map(opt => opt.value),
    x => x
  )

  const cellTemplate = {
    kind: GridCellKind.Custom,
    readonly: !props.isEditable,
    allowOverlay: true,
    contentAlign: props.contentAlignment,
    style: props.isIndex ? "faded" : "normal",
    data: {
      kind: "multi-select-cell",
      values: [],
      options: preparedOptions,
      allowCreation: parameters.accept_new_options ?? false,
      allowDuplicates: false,
    },
    copyData: "",
  } as MultiSelectCellType

  const badgeBackgroundColors = getMarkdownBgColors(theme)

  return {
    ...props,
    kind: "multiselect",
    sortMode: "default",
    typeIcon: ":material/checklist:",
    themeOverride: {
      roundingRadius: Math.round(convertRemToPx(theme.radii.md)),
      bgBubble: badgeBackgroundColors.primarybg,
      bgBubbleSelected: badgeBackgroundColors.primarybg,
      textBubble: theme.colors.bodyText,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    getCell(data?: any, validate?: boolean): GridCell {
      if (isNullOrUndefined(data)) {
        return {
          ...cellTemplate,
          data: {
            ...cellTemplate.data,
            values: null,
          },
          isMissingValue: true,
          copyData: "",
        } as MultiSelectCellType
      }

      let cellData = toSafeArray(data)

      cellData = cellData.map((x: object) => toSafeString(x).trim())

      if (
        validate &&
        cellData.length > 0 &&
        parameters.accept_new_options === false
      ) {
        // Filter out values that are not in the options list:
        cellData = cellData.filter((x: string) => uniqueOptions.includes(x))
        if (cellData.length === 0) {
          return getErrorCell(
            toSafeString(data),
            "The values could not be matched with the configured options."
          )
        }
      }

      return {
        ...cellTemplate,
        data: {
          ...cellTemplate.data,
          values: cellData,
        },
        copyData: arrayToCopyValue(cellData),
      } as MultiSelectCellType
    },
    getCellValue(cell: MultiSelectCellType): string[] | null {
      if (isNullOrUndefined(cell.data?.values)) {
        return null
      }

      return cell.data.values
    },
  }
}

MultiSelectColumn.isEditableType = true

export default MultiSelectColumn
