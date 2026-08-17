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

import { memo, type ReactElement, useCallback, useMemo, useState } from "react"

import { FilterType, IFilterColumnMeta } from "@streamlit/protobuf"

import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"

import {
  StyledColumnPickerIcon,
  StyledColumnPickerItem,
  StyledColumnPickerSearch,
  StyledColumnPickerSearchIcon,
  StyledColumnPickerSearchInput,
  StyledEmptyMessage,
} from "./styled-components"

const SEARCH_THRESHOLD = 7

const FILTER_TYPE_ICONS: Record<number, string> = {
  [FilterType.FILTER_TYPE_MULTISELECT]: ":material/list:",
  [FilterType.FILTER_TYPE_TEXT]: ":material/text_fields:",
  [FilterType.FILTER_TYPE_RANGE]: ":material/tag:",
  [FilterType.FILTER_TYPE_DATE_RANGE]: ":material/calendar_today:",
  [FilterType.FILTER_TYPE_DATETIME_RANGE]: ":material/schedule:",
  [FilterType.FILTER_TYPE_TIME_RANGE]: ":material/access_time:",
  [FilterType.FILTER_TYPE_TOGGLE]: ":material/toggle_on:",
  [FilterType.FILTER_TYPE_UNSPECIFIED]: ":material/filter_list:",
}

interface ColumnPickerProps {
  availableColumns: IFilterColumnMeta[]
  onSelect: (columnName: string) => void
}

function ColumnPicker({
  availableColumns,
  onSelect,
}: Readonly<ColumnPickerProps>): ReactElement {
  const [search, setSearch] = useState("")

  const showSearch = availableColumns.length > SEARCH_THRESHOLD

  const filteredColumns = useMemo(() => {
    if (!search) return availableColumns
    const lower = search.toLowerCase()
    return availableColumns.filter(col =>
      (col.customLabel ?? col.name ?? "").toLowerCase().includes(lower)
    )
  }, [availableColumns, search])

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      setSearch(e.target.value)
    },
    []
  )

  if (availableColumns.length === 0) {
    return <StyledEmptyMessage>All columns have filters</StyledEmptyMessage>
  }

  return (
    <div>
      {showSearch && (
        <StyledColumnPickerSearch>
          <StyledColumnPickerSearchIcon aria-hidden="true">
            <DynamicIcon iconValue=":material/search:" size="md" />
          </StyledColumnPickerSearchIcon>
          <StyledColumnPickerSearchInput
            type="text"
            value={search}
            onChange={handleSearchChange}
            placeholder="Filter by..."
            aria-label="Search columns"
            autoFocus
          />
        </StyledColumnPickerSearch>
      )}
      <div role="listbox" aria-label="Available columns">
        {filteredColumns.map(col => {
          const icon =
            FILTER_TYPE_ICONS[
              col.filterType ?? FilterType.FILTER_TYPE_UNSPECIFIED
            ] ?? FILTER_TYPE_ICONS[FilterType.FILTER_TYPE_UNSPECIFIED]
          return (
            <StyledColumnPickerItem
              key={col.name}
              role="option"
              aria-selected={false}
              onClick={(): void => onSelect(col.name ?? "")}
            >
              <StyledColumnPickerIcon aria-hidden="true">
                <DynamicIcon iconValue={icon} size="md" />
              </StyledColumnPickerIcon>
              {col.customLabel ?? col.name}
            </StyledColumnPickerItem>
          )
        })}
        {filteredColumns.length === 0 && (
          <StyledEmptyMessage>No matching columns</StyledEmptyMessage>
        )}
      </div>
    </div>
  )
}

export default memo(ColumnPicker)
