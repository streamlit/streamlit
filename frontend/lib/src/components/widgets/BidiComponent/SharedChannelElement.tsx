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

import { type FC, memo, useEffect, useMemo } from "react"

import type { BidiComponent as BidiComponentProto } from "@streamlit/protobuf"

import { parseBidiComponentData } from "~lib/components/widgets/BidiComponent/utils/parseBidiComponentData"
import { getSharedChannel } from "~lib/components/widgets/BidiComponent/utils/sharedChannels"
import type { WidgetStateManager } from "~lib/WidgetStateManager"

type SharedChannelElementProps = {
  element: BidiComponentProto
  widgetMgr: WidgetStateManager
  fragmentId: string | undefined
}

/**
 * The browser side of `st.components.v2.shared_state`. It renders nothing.
 * It connects the named channel to this element's widget value, so synced
 * channel values reach Python, and applies the values Python sends as data.
 *
 * Data is applied only when its serialized form changes, so an unchanged
 * dataset resent on a rerun (or replayed from the message cache) does not
 * notify subscribers again.
 */
const SharedChannelElement: FC<SharedChannelElementProps> = ({
  element,
  widgetMgr,
  fragmentId,
}) => {
  const { sharedChannel, id, formId, data, json, bytes, arrowData, mixed } =
    element
  const channel = getSharedChannel(sharedChannel)

  useEffect(() => {
    channel.bind({
      id,
      formId: formId || undefined,
      fragmentId,
      widgetMgr,
    })
    return () => channel.unbind(id)
  }, [channel, id, formId, fragmentId, widgetMgr])

  const seeded = useMemo(
    () =>
      parseBidiComponentData({
        arrowBlobs: mixed?.arrowBlobs ?? undefined,
        arrowData: arrowData?.data ?? undefined,
        bytes,
        data,
        json,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- blank JSON means no mixed payload
        mixedJson: mixed?.json || undefined,
      }),
    [data, json, arrowData?.data, bytes, mixed?.json, mixed?.arrowBlobs]
  )

  useEffect(() => {
    if (seeded && typeof seeded === "object" && !Array.isArray(seeded)) {
      channel.seed(seeded as Record<string, unknown>)
    }
  }, [channel, seeded])

  return (
    <div
      className="stSharedChannel"
      data-testid="stSharedChannel"
      data-channel={sharedChannel}
      hidden
    />
  )
}

export default memo(SharedChannelElement)
