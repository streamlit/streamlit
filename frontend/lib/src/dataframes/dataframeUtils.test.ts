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

import { Arrow as ArrowProto, IArrow } from "@streamlit/protobuf"

import { TEN_BY_TEN, UNICODE } from "~lib/mocks/arrow"

import {
  createQuiverFromProto,
  createQuiverOrNull,
  mergeQuiverData,
} from "./dataframeUtils"

describe("dataframes/dataframeUtils", () => {
  it("createQuiverFromProto creates a Quiver with expected data", () => {
    const proto = ArrowProto.create({ data: UNICODE })

    const quiver = createQuiverFromProto(proto as IArrow)

    expect(quiver.dimensions.numDataRows).toBeGreaterThan(0)
  })

  it("createQuiverOrNull returns null for null or undefined proto", () => {
    expect(createQuiverOrNull(null)).toBeNull()
    expect(createQuiverOrNull(undefined)).toBeNull()
  })

  it("mergeQuiverData merges rows from additional into base", () => {
    const baseProto = ArrowProto.create({ data: TEN_BY_TEN })
    const additionalProto = ArrowProto.create({ data: TEN_BY_TEN })

    const baseQuiver = createQuiverFromProto(baseProto as IArrow)
    const merged = mergeQuiverData(baseQuiver, additionalProto as IArrow)

    expect(merged.dimensions.numDataRows).toBe(
      baseQuiver.dimensions.numDataRows * 2
    )
    expect(merged.dimensions.numDataColumns).toBe(
      baseQuiver.dimensions.numDataColumns
    )
  })
})
