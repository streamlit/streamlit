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
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react"

import {
  DownloadButton as DownloadButtonProto,
  BackMsg,
} from "@streamlit/protobuf"

import { LibConfigContext } from "~lib/components/core/LibConfigContext"
import BaseButton, {
  BaseButtonKind,
  BaseButtonSize,
  BaseButtonTooltip,
  DynamicButtonLabel,
} from "~lib/components/shared/BaseButton"
import { StreamlitEndpoints } from "~lib/StreamlitEndpoints"
import createDownloadLinkElement from "~lib/util/createDownloadLinkElement"
import { WidgetStateManager } from "~lib/WidgetStateManager"

export interface Props {
  endpoints: StreamlitEndpoints
  disabled: boolean
  element: DownloadButtonProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
  sendBackMsg?: (msg: BackMsg) => void
}

function DownloadButton(props: Props): ReactElement {
  const { disabled, element, widgetMgr, endpoints, fragmentId, sendBackMsg } =
    props
  const {
    help,
    label,
    icon,
    ignoreRerun,
    type,
    url,
    isDeferred,
    deferredFileId,
  } = element

  // Default to false, if no libConfig, e.g. for tests
  const { enforceDownloadInNewTab = false } = useContext(LibConfigContext)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    // Only check URL for non-deferred downloads
    if (!isDeferred) {
      // Since we use a hidden link to download, we can't use the onerror event
      // to catch src url load errors. Catch with direct check instead.
      void endpoints.checkSourceUrlResponse(downloadUrl, "Download Button")
    }
  }, [downloadUrl, endpoints, isDeferred])

  // Listen for deferred file response
  useEffect(() => {
    if (!isDeferred || !deferredFileId) {
      return
    }

    const handleDeferredResponse = (event: Event): void => {
      const customEvent = event as CustomEvent
      const response = customEvent.detail

      if (response.fileId === deferredFileId) {
        setIsLoading(false)

        if (response.errorMsg) {
          setError(response.errorMsg)
        } else {
          // Download with returned URL
          const link = createDownloadLinkElement({
            filename: "",
            url: endpoints.buildDownloadUrl(response.url),
            enforceDownloadInNewTab,
          })
          link.click()
        }
      }
    }

    window.addEventListener("deferredFileResponse", handleDeferredResponse)
    return () => {
      window.removeEventListener(
        "deferredFileResponse",
        handleDeferredResponse
      )
    }
  }, [isDeferred, deferredFileId, endpoints, enforceDownloadInNewTab])

  const handleDownloadClick = useCallback((): void => {
    if (isDeferred && deferredFileId && sendBackMsg) {
      // Deferred download flow
      setIsLoading(true)
      setError(null)

      // Trigger widget state update if needed
      if (!ignoreRerun) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
        widgetMgr.setTriggerValue(element, { fromUi: true }, fragmentId)
      }

      // Send BackMsg to request file generation
      const backMsg = new BackMsg({
        deferredFileRequest: {
          fileId: deferredFileId,
          sessionId: "", // Will be filled by the connection manager
        },
      })
      sendBackMsg(backMsg)

      // Set timeout for request
      setTimeout(() => {
        setIsLoading(false)
        setError("Download request timed out. Please try again.")
      }, 60000) // 60 second timeout
    } else {
      // Regular immediate download flow
      if (!ignoreRerun) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
        widgetMgr.setTriggerValue(element, { fromUi: true }, fragmentId)
      }
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
    isDeferred,
    deferredFileId,
    sendBackMsg,
    ignoreRerun,
    widgetMgr,
    element,
    fragmentId,
    downloadUrl,
    enforceDownloadInNewTab,
  ])

  return (
    <div className="stDownloadButton" data-testid="stDownloadButton">
      {error && (
        <div
          style={{
            color: "red",
            fontSize: "0.875rem",
            marginBottom: "0.5rem",
          }}
        >
          {error}
        </div>
      )}
      <BaseButtonTooltip help={help} containerWidth={true}>
        <BaseButton
          kind={kind}
          size={BaseButtonSize.SMALL}
          disabled={disabled || isLoading}
          onClick={handleDownloadClick}
          containerWidth={true}
        >
          <DynamicButtonLabel
            icon={icon}
            label={isLoading ? "Generating..." : label}
          />
        </BaseButton>
      </BaseButtonTooltip>
    </div>
  )
}

export default memo(DownloadButton)
