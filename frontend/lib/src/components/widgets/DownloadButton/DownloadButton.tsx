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

import React, {
  memo,
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import { DownloadButton as DownloadButtonProto } from "@streamlit/protobuf"

import { DownloadContext } from "~lib/components/core/DownloadContext"
import { LibConfigContext } from "~lib/components/core/LibConfigContext"
import BaseButton, {
  BaseButtonKind,
  BaseButtonSize,
  BaseButtonTooltip,
  DynamicButtonLabel,
} from "~lib/components/shared/BaseButton"
import { StreamlitEndpoints } from "~lib/StreamlitEndpoints"
import { StyledErrorMessage } from "~lib/styled-components"
import createDownloadLinkElement from "~lib/util/createDownloadLinkElement"
import { WidgetStateManager } from "~lib/WidgetStateManager"

export interface Props {
  endpoints: StreamlitEndpoints
  disabled: boolean
  element: DownloadButtonProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

function DownloadButton(props: Props): ReactElement {
  const { disabled, element, widgetMgr, endpoints, fragmentId } = props
  const { help, label, icon, ignoreRerun, type, url, deferredFileId } = element

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Default to false, if no libConfig, e.g. for tests
  const { enforceDownloadInNewTab = false } = useContext(LibConfigContext)
  const { requestDeferredFile } = useContext(DownloadContext)

  let kind = BaseButtonKind.SECONDARY
  if (type === "primary") {
    kind = BaseButtonKind.PRIMARY
  } else if (type === "tertiary") {
    kind = BaseButtonKind.TERTIARY
  }

  const downloadUrl = useMemo(
    () => endpoints.buildDownloadUrl(url),
    [endpoints, url]
  )

  useEffect(() => {
    const isDeferred = Boolean(deferredFileId?.length)
    if (!isDeferred) {
      // Since we use a hidden link to download, we can't use the onerror event
      // to catch src url load errors. Catch with direct check instead.
      void endpoints.checkSourceUrlResponse(downloadUrl, "Download Button")
    }
  }, [downloadUrl, endpoints, deferredFileId])

  const handleDeferredDownload = useCallback(async (): Promise<void> => {
    if (!requestDeferredFile || !deferredFileId) {
      setError("Deferred download not properly configured")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await requestDeferredFile(deferredFileId)

      if (response.errorMsg) {
        setError(response.errorMsg)
        setIsLoading(false)
        return
      }

      const resolvedDownloadUrl = endpoints.buildDownloadUrl(response.url)

      // Proactively check the resolved URL for load errors to surface metrics.
      void endpoints.checkSourceUrlResponse(
        resolvedDownloadUrl,
        "Download Button"
      )

      // Trigger download with the returned URL
      const link = createDownloadLinkElement({
        filename: "",
        url: resolvedDownloadUrl,
        enforceDownloadInNewTab,
      })
      link.click()
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Download failed"
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [requestDeferredFile, deferredFileId, endpoints, enforceDownloadInNewTab])

  const handleDownloadClick = useCallback((): void => {
    if (!ignoreRerun) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
      widgetMgr.setTriggerValue(element, { fromUi: true }, fragmentId)
    }

    const isDeferred = Boolean(deferredFileId?.length)
    if (isDeferred) {
      // Handle deferred download
      void handleDeferredDownload()
    } else {
      // Downloads are only done on links, so create a hidden one and click it
      // for the user.
      const link = createDownloadLinkElement({
        filename: "",
        url: downloadUrl,
        enforceDownloadInNewTab,
      })
      link.click()
    }
  }, [
    ignoreRerun,
    widgetMgr,
    element,
    fragmentId,
    deferredFileId,
    handleDeferredDownload,
    downloadUrl,
    enforceDownloadInNewTab,
  ])

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return (): void => clearTimeout(timer)
    }
    return undefined
  }, [error])

  return (
    <div className="stDownloadButton" data-testid="stDownloadButton">
      <BaseButtonTooltip help={help} containerWidth={true}>
        <BaseButton
          kind={kind}
          size={BaseButtonSize.SMALL}
          disabled={disabled || isLoading}
          onClick={handleDownloadClick}
          containerWidth={true}
        >
          <DynamicButtonLabel
            icon={isLoading ? "spinner" : icon}
            label={label}
          />
        </BaseButton>
      </BaseButtonTooltip>
      {error && (
        <StyledErrorMessage data-testid="stDownloadButtonError">
          {error}
        </StyledErrorMessage>
      )}
    </div>
  )
}

export default memo(DownloadButton)
