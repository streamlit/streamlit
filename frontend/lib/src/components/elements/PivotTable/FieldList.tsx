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

import React, { memo, ReactElement, useState } from "react"

import {
  StyledFieldItem,
  StyledFieldList,
  StyledFieldMenu,
} from "./styled-components"

interface FieldListProps {
  fields: string[]
  onAddToRows: (fieldName: string) => void
  onAddToColumns: (fieldName: string) => void
  onAddToValues: (fieldName: string) => void
}

export default function FieldList({
  fields,
  onAddToRows,
  onAddToColumns,
  onAddToValues,
}: FieldListProps): ReactElement {
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  const handleFieldClick = (field: string) => {
    if (activeMenu === field) {
      setActiveMenu(null)
    } else {
      setActiveMenu(field)
    }
  }

  const handleAddTo = (
    field: string,
    target: "rows" | "columns" | "values"
  ) => {
    if (target === "rows") {
      onAddToRows(field)
    } else if (target === "columns") {
      onAddToColumns(field)
    } else {
      onAddToValues(field)
    }
    setActiveMenu(null)
  }

  return (
    <StyledFieldList>
      {fields.map((field, index) => (
        <div key={index} style={{ position: "relative" }}>
          <StyledFieldItem
            onClick={() => handleFieldClick(field)}
            title={`Click to choose where to add ${field}`}
          >
            {field}
          </StyledFieldItem>
          {activeMenu === field && (
            <StyledFieldMenu>
              <button onClick={() => handleAddTo(field, "rows")}>
                Add to Rows
              </button>
              <button onClick={() => handleAddTo(field, "columns")}>
                Add to Columns
              </button>
              <button onClick={() => handleAddTo(field, "values")}>
                Add to Values
              </button>
            </StyledFieldMenu>
          )}
        </div>
      ))}
    </StyledFieldList>
  )
}
