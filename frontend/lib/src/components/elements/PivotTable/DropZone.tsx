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

import React, { memo, ReactElement } from "react"

import { Close } from "@emotion-icons/material-outlined"

import Icon from "~lib/components/shared/Icon"

import { ValueField } from "./pivotTransform"
import {
  StyledDroppedField,
  StyledDropZone,
  StyledDropZoneContent,
  StyledDropZoneLabel,
  StyledFieldName,
  StyledRemoveButton,
} from "./styled-components"

interface DropZoneProps {
  label: string
  fields?: string[]
  valueFields?: ValueField[]
  onRemove: (fieldName: string) => void
  onUpdateAggregation?: (
    fieldName: string,
    aggregation: ValueField["aggregation"]
  ) => void
  showAggregation?: boolean
}

const AGGREGATION_OPTIONS = [
  { label: "Sum", value: "sum" },
  { label: "Mean", value: "mean" },
  { label: "Count", value: "count" },
  { label: "Min", value: "min" },
  { label: "Max", value: "max" },
]

export default function DropZone({
  label,
  fields = [],
  valueFields = [],
  onRemove,
  onUpdateAggregation,
  showAggregation = false,
}: DropZoneProps): ReactElement {
  const displayFields = showAggregation
    ? valueFields
    : fields.map(f => ({ field: f }))

  return (
    <StyledDropZone>
      <StyledDropZoneLabel>{label}</StyledDropZoneLabel>
      <StyledDropZoneContent>
        {displayFields.length === 0 ? (
          <div style={{ color: "#888", fontSize: "0.875rem" }}>
            Select fields from the left panel
          </div>
        ) : (
          displayFields.map((item, index) => {
            const fieldName = "field" in item ? item.field : item
            return (
              <StyledDroppedField key={index}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <StyledFieldName>{fieldName}</StyledFieldName>
                  {showAggregation && "aggregation" in item && (
                    <span style={{ fontSize: "0.75rem", color: "#888" }}>
                      ({item.aggregation})
                    </span>
                  )}
                </div>
                <StyledRemoveButton
                  onClick={() => onRemove(fieldName)}
                  title={`Remove ${fieldName}`}
                >
                  <Icon content={Close} size="sm" />
                </StyledRemoveButton>
              </StyledDroppedField>
            )
          })
        )}
      </StyledDropZoneContent>
    </StyledDropZone>
  )
}
