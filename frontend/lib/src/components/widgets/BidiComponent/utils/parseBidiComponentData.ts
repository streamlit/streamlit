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

import type {
  BidiComponent as BidiComponentProto,
  IArrowData,
} from "@streamlit/protobuf"

import { assertNever } from "~lib/util/assertNever"

import { reconstructMixedData } from "./reconstructMixedData"

type BaseParseArgs = Pick<BidiComponentProto, "json" | "bytes">

type BidiComponentDataField = BidiComponentProto["data"]

export type ParseBidiComponentDataArgs = BaseParseArgs & {
  arrowBlobs?: Record<string, IArrowData>
  arrowData?: IArrowData["data"] | undefined
  data?: BidiComponentDataField | "mixed"
  mixedJson?: string
}

export type ParsedComponentData = unknown

/**
 * Parses the data payload provided to a Custom Component v2 instance.
 */
export const parseBidiComponentData = ({
  arrowBlobs,
  arrowData,
  bytes,
  data,
  json,
  mixedJson,
}: ParseBidiComponentDataArgs): ParsedComponentData => {
  switch (data) {
    case "json":
      return json ? JSON.parse(json) : null
    case "arrowData":
      return arrowData ?? null
    case "bytes":
      return bytes ?? null
    case "mixed": {
      if (mixedJson && arrowBlobs) {
        if (mixedJson) {
          const jsonData = JSON.parse(mixedJson)

          const arrowBlobsMap: Record<string, Uint8Array> = {}
          if (arrowBlobs) {
            Object.entries(arrowBlobs).forEach(([key, arrowProto]) => {
              if (arrowProto?.data) {
                arrowBlobsMap[key] = arrowProto.data
              }
            })
          }

          return reconstructMixedData(jsonData, arrowBlobsMap)
        }
      }
      return null
    }
    // `any` and `undefined` data types are artifacts of the Protobuf, and are
    // not necessary to be handled by the component.
    case "any":
    case undefined:
      return null
    default:
      assertNever(data)
  }

  return undefined
}
