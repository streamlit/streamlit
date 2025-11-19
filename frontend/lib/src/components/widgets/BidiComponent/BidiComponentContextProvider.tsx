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

import { FC, memo, PropsWithChildren, useCallback, useMemo } from "react"

import type { BidiComponent as BidiComponentProto } from "@streamlit/protobuf"

import {
  BidiComponentContext,
  BidiComponentContextShape,
} from "~lib/components/widgets/BidiComponent/BidiComponentContext"
import { LOG } from "~lib/components/widgets/BidiComponent/utils/logger"
import { parseBidiComponentData } from "~lib/components/widgets/BidiComponent/utils/parseBidiComponentData"
import { extractComponentsV2Theme } from "~lib/components/widgets/BidiComponent/utils/theme"
import { ComponentRegistry } from "~lib/components/widgets/CustomComponent"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { ensureError } from "~lib/util/ErrorHandling"
import { WidgetInfo, WidgetStateManager } from "~lib/WidgetStateManager"

export type BidiComponentContextProviderProps = PropsWithChildren<{
  element: BidiComponentProto
  widgetMgr: WidgetStateManager
  fragmentId: string | undefined
  componentRegistry: ComponentRegistry
}>

export const BidiComponentContextProvider: FC<BidiComponentContextProviderProps> =
  memo(({ element, children, widgetMgr, fragmentId, componentRegistry }) => {
    const {
      arrowData,
      bytes,
      componentName,
      cssContent,
      cssSourcePath,
      data,
      htmlContent,
      id,
      jsContent,
      json,
      jsSourcePath,
      mixed,
    } = element

    const widgetInfo = useMemo<WidgetInfo>(() => {
      return {
        id: element.id,
        formId: element.formId,
      }
    }, [element.id, element.formId])

    const getWidgetValue = useCallback(() => {
      const raw = widgetMgr.getJsonValue(widgetInfo)

      if (!raw) {
        return {}
      }

      try {
        return JSON.parse(raw)
      } catch (e) {
        const err = ensureError(e)
        LOG.warn(
          "Failed to parse widget JSON value; returning empty object.",
          {
            widgetId: widgetInfo.id,
            formId: widgetInfo.formId,
            error: err.message,
          }
        )
        return {}
      }
    }, [widgetInfo, widgetMgr])

    // We depend on primitive values and the inner payloads of protobuf wrappers
    // (e.g. `arrowData?.data`, `mixed?.json`, `mixed?.arrowBlobs`) instead of
    // the wrapper objects themselves.
    // Protobuf may recreate wrapper objects on each update, which would
    // invalidate memoization even when the actual payloads are unchanged.
    // Narrowing deps reduces false invalidations.
    // Note: this does not fully guarantee stability for reference-typed values
    // like `Uint8Array` (e.g. `arrowData?.data`), whose references may still
    // change across updates. It does guarantee stability for primitives/strings
    // (e.g. `mixed?.json`), since Object.is compares them by value.
    // Overall, this avoids unnecessary JSON.parse and mixed-data reconstruction
    // when the payloads haven't changed, even if wrappers are re-instantiated.
    const parsedData = useMemo(() => {
      return parseBidiComponentData({
        arrowBlobs: mixed?.arrowBlobs || undefined,
        arrowData: arrowData?.data || undefined,
        bytes,
        data,
        json,
        mixedJson: mixed?.json || undefined,
      })
    }, [data, json, arrowData?.data, bytes, mixed?.json, mixed?.arrowBlobs])

    const emotionTheme = useEmotionTheme()
    const theme = useMemo(() => {
      return extractComponentsV2Theme(emotionTheme)
    }, [emotionTheme])

    const contextValue = useMemo<BidiComponentContextShape>(() => {
      return {
        componentName,
        componentRegistry,
        cssContent: cssContent?.trim(),
        cssSourcePath: cssSourcePath || undefined,
        data: parsedData,
        fragmentId,
        getWidgetValue,
        htmlContent: htmlContent?.trim(),
        id,
        formId: element.formId || undefined,
        jsContent: jsContent || undefined,
        jsSourcePath: jsSourcePath || undefined,
        theme,
        widgetMgr,
      }
    }, [
      componentName,
      componentRegistry,
      cssContent,
      cssSourcePath,
      fragmentId,
      getWidgetValue,
      htmlContent,
      id,
      element.formId,
      jsContent,
      jsSourcePath,
      parsedData,
      theme,
      widgetMgr,
    ])

    return (
      <BidiComponentContext.Provider value={contextValue}>
        {children}
      </BidiComponentContext.Provider>
    )
  })
