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

import type {
  SharedChannel,
  SharedChannelListener,
  SharedChannelSetOptions,
  SharedChannelSync,
} from "@streamlit/component-v2-lib"

import { LOG } from "~lib/components/widgets/BidiComponent/utils/logger"
import type { WidgetStateManager } from "~lib/WidgetStateManager"

/** The `st.components.v2.shared_state` element that owns a channel's Python side. */
interface ChannelBinding {
  id: string
  formId: string | undefined
  fragmentId: string | undefined
  widgetMgr: WidgetStateManager
}

const SYNC_RANK: Record<SharedChannelSync, number> = {
  none: 0,
  defer: 1,
  rerun: 2,
}

/**
 * Browser state shared by every component on the page that joins the channel
 * by name, whatever bundle it comes from.
 *
 * Values live for the lifetime of the page. Keys set with `python: "defer"` or
 * `python: "rerun"` are also written to the widget value of the channel's
 * `shared_state` element, which is how Python reads them. Until that element
 * mounts, those writes are held and delivered when it does.
 */
class Channel implements SharedChannel {
  readonly name: string

  private readonly values = new Map<string, unknown>()

  private readonly listeners = new Set<SharedChannelListener>()

  private readonly synced: Record<string, unknown> = {}

  private binding: ChannelBinding | undefined

  private held: SharedChannelSync = "none"

  constructor(name: string) {
    this.name = name
  }

  get<T = unknown>(key: string): T | undefined {
    return this.values.get(key) as T | undefined
  }

  keys(): string[] {
    return [...this.values.keys()]
  }

  set(key: string, value: unknown, options?: SharedChannelSetOptions): void {
    this.update({ [key]: value }, options)
  }

  update(
    values: Record<string, unknown>,
    options?: SharedChannelSetOptions
  ): void {
    const python = options?.python ?? "none"
    const changed = Object.keys(values)
    for (const key of changed) {
      this.values.set(key, values[key])
      if (python !== "none") {
        this.synced[key] = values[key]
      }
    }
    if (python !== "none") {
      this.sendToPython(python)
    }
    this.notify(changed)
  }

  subscribe(listener: SharedChannelListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Apply values sent by Python in the `shared_state` element's data. */
  seed(values: Record<string, unknown>): void {
    const changed = Object.keys(values)
    for (const key of changed) {
      this.values.set(key, values[key])
    }
    if (changed.length > 0) {
      this.notify(changed)
    }
  }

  bind(binding: ChannelBinding): void {
    this.binding = binding
    if (this.held !== "none") {
      const held = this.held
      this.held = "none"
      this.sendToPython(held)
    }
  }

  unbind(id: string): void {
    if (this.binding?.id === id) {
      this.binding = undefined
    }
  }

  private sendToPython(mode: SharedChannelSync): void {
    const { binding } = this
    if (!binding) {
      if (SYNC_RANK[mode] > SYNC_RANK[this.held]) {
        this.held = mode
      }
      return
    }
    binding.widgetMgr.setJsonValue(
      binding.id,
      { ...this.synced },
      {
        formId: binding.formId,
        fragmentId: binding.fragmentId,
        fromUser: true,
        triggerRerun: mode === "rerun",
      }
    )
  }

  private notify(changedKeys: string[]): void {
    for (const listener of Array.from(this.listeners)) {
      try {
        listener(changedKeys)
      } catch (error) {
        LOG.error(`Shared channel "${this.name}" listener failed`, error)
      }
    }
  }
}

const channels = new Map<string, Channel>()

/** The page's channel with this name, created on first use. */
export function getSharedChannel(name: string): Channel {
  let channel = channels.get(name)
  if (!channel) {
    channel = new Channel(name)
    channels.set(name, channel)
  }
  return channel
}

/**
 * A handle on a channel for one component instance. Subscriptions made through
 * it end when the instance unmounts.
 */
export function makeScopedChannelHandle(
  name: string,
  ownedUnsubscribes: Set<() => void>
): SharedChannel {
  const channel = getSharedChannel(name)
  return {
    name,
    get: key => channel.get(key),
    keys: () => channel.keys(),
    set: (key, value, options) => channel.set(key, value, options),
    update: (values, options) => channel.update(values, options),
    subscribe: listener => {
      const unsubscribe = channel.subscribe(listener)
      const owned = (): void => {
        unsubscribe()
        ownedUnsubscribes.delete(owned)
      }
      ownedUnsubscribes.add(owned)
      return owned
    },
  }
}
