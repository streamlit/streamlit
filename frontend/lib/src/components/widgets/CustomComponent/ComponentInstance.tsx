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
  useRef,
  useState,
} from "react"

import { getLogger } from "loglevel"
import queryString from "query-string"
import { flushSync } from "react-dom"

import {
  ComponentInstance as ComponentInstanceProto,
  ISpecialArg,
  Skeleton as SkeletonProto,
} from "@streamlit/protobuf"

import { withCalculatedWidth } from "~lib/components/core/Layout/withCalculatedWidth"
import { LibContext } from "~lib/components/core/LibContext"
import AlertElement from "~lib/components/elements/AlertElement"
import { Skeleton } from "~lib/components/elements/Skeleton"
import { Kind } from "~lib/components/shared/AlertContainer"
import ErrorElement from "~lib/components/shared/ErrorElement"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import useTimeout from "~lib/hooks/useTimeout"
import { COMMUNITY_URL, COMPONENT_DEVELOPER_URL } from "~lib/urls"
import { ensureError } from "~lib/util/ErrorHandling"
import {
  DEFAULT_IFRAME_FEATURE_POLICY,
  DEFAULT_IFRAME_SANDBOX_POLICY,
} from "~lib/util/IFrameUtil"
import { isNullOrUndefined, notNullOrUndefined } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { ComponentRegistry } from "./ComponentRegistry"
import {
  Args,
  createIframeMessageHandler,
  DataframeArg,
  IframeMessageHandlerProps,
  parseArgs,
  sendRenderMessage,
} from "./componentUtils"
import { StyledComponentIframe } from "./styled-components"

const LOG = getLogger("ComponentInstance")
/**
 * If we haven't received a COMPONENT_READY message this many seconds
 * after the component has been created, explain to the user that there
 * may be a problem with their component, and offer troubleshooting advice.
 */
export const COMPONENT_READY_WARNING_TIME_MS = 60000 // 60 seconds

export interface Props {
  widgetMgr: WidgetStateManager
  disabled: boolean
  element: ComponentInstanceProto
  width: number
  fragmentId?: string
}

/**
 * Create the iFrame `src` based on the passed `url` or, if missing, from the ComponentRegistry. Adds a `streamlitUrl` query parameter.
 * @param componentName name of the component. Only used when `url` is empty
 * @param componentRegistry component registry to get the `url` for the passed component name if `url` is empty
 * @param url used as the `src` if passed
 * @returns the iFrame src including a `streamlitUrl` query parameter
 */
function getSrc(
  componentName: string,
  componentRegistry: ComponentRegistry,
  url?: string
): string {
  let src: string
  if (notNullOrUndefined(url) && url !== "") {
    src = url
  } else {
    src = componentRegistry.getComponentURL(componentName, "index.html")
  }

  // Add streamlitUrl query parameter to src
  const customComponentClientId =
    window.__streamlit?.CUSTOM_COMPONENT_CLIENT_ID
  const currentUrl = new URL(window.location.href)
  src = queryString.stringifyUrl({
    url: src,
    query: {
      streamlitUrl: currentUrl.origin + currentUrl.pathname,
      ...(customComponentClientId && {
        __streamlit_parent_client_id: customComponentClientId,
      }),
    },
  })
  return src
}

/**
 * Creates a warn message. The message is different based on whether or not a `url` is provided.
 * @param componentName
 * @param url
 * @returns the created warn message
 */
function getWarnMessage(componentName: string, url?: string): string {
  let message: string
  if (url && url !== "") {
    message =
      `Your app is having trouble loading the **${componentName}** component.` +
      `\nThe app is attempting to load the component from **${url}**,` +
      `\nand hasn't received its \`Streamlit.setComponentReady()\` message.` +
      `\n\nIf this is a development build, have you started the dev server?` +
      `\n\nFor more troubleshooting help, please see the [Streamlit Component docs](${COMPONENT_DEVELOPER_URL}) or visit our [forums](${COMMUNITY_URL}).`
  } else {
    message =
      `Your app is having trouble loading the **${componentName}** component.` +
      `\n\nIf this is an installed component that works locally, the app may be having trouble accessing the component frontend assets due to network latency or proxy settings in your app deployment.` +
      `\n\nFor more troubleshooting help, please see the [Streamlit Component docs](${COMPONENT_DEVELOPER_URL}) or visit our [forums](${COMMUNITY_URL}).`
  }
  return message
}

function tryParseArgs(
  jsonArgs: string,
  specialArgs: ISpecialArg[],
  setComponentError: (e: Error) => void,
  componentError?: Error
): [newArgs: Args, dataframeArgs: DataframeArg[]] {
  if (!componentError) {
    try {
      return parseArgs(jsonArgs, specialArgs)
    } catch (e) {
      const error = ensureError(e)
      setComponentError(error)
    }
  }

  return [{}, []]
}

/**
 * Compare the two DataframeArg arrays
 *
 * @param previousDataframeArgs
 * @param newDataframeArgs
 * @returns true if the two DataframeArg arrays are equal or if all their key-value pairs (first level only) are equal
 */
function compareDataframeArgs(
  previousDataframeArgs: DataframeArg[],
  newDataframeArgs: DataframeArg[]
): boolean {
  return (
    previousDataframeArgs === newDataframeArgs ||
    (previousDataframeArgs.length === newDataframeArgs.length &&
      previousDataframeArgs.every((previousDataframeArg, i) => {
        const newDataframeArg = newDataframeArgs[i]
        return (
          previousDataframeArg.key === newDataframeArg.key &&
          previousDataframeArg.value === newDataframeArg.value
        )
      }))
  )
}

/**
 * Render the component element. If an error occurs when parsing the arguments,
 * an error element is rendered instead. If the component assets take too long to load as specified
 * by {@link COMPONENT_READY_WARNING_TIME_MS}, a warning element is rendered instead.
 */
function ComponentInstance(props: Props): ReactElement {
  const theme = useEmotionTheme()
  const { componentRegistry: registry } = useContext(LibContext)

  const [componentError, setComponentError] = useState<Error>()

  const { disabled, element, widgetMgr, width, fragmentId } = props
  const { componentName, jsonArgs, specialArgs, url } = element

  const [parsedNewArgs, parsedDataframeArgs] = tryParseArgs(
    jsonArgs,
    specialArgs,
    setComponentError,
    componentError
  )

  const componentSourceUrl = useMemo(
    () => getSrc(componentName, registry, url),
    [componentName, registry, url]
  )

  // Use a ref for the args so that we can use them inside the useEffect calls without the linter complaining
  // as in the useEffect dependencies array, we don't use the parsed arg objects, but their string representation
  // and a comparing function result for the jsonArgs and dataframeArgs, respectively, for deep-equal checks and to
  // prevent calling useEffect too often
  const parsedArgsRef = useRef<{ args: Args; dataframeArgs: DataframeArg[] }>({
    args: {},
    dataframeArgs: [],
  })
  const haveDataframeArgsChanged = compareDataframeArgs(
    parsedArgsRef.current.dataframeArgs,
    parsedDataframeArgs
  )
  parsedArgsRef.current.args = parsedNewArgs
  parsedArgsRef.current.dataframeArgs = parsedDataframeArgs

  const [isReadyTimeout, setIsReadyTimeout] = useState<boolean>()
  // By passing the args.height here, we can derive the initial height for
  // custom components that define a height property, e.g. in Python
  // my_custom_component(height=100). undefined means no explicit height
  // was specified, but will be set to the default height of 0.
  const [frameHeight, setFrameHeight] = useState<number | undefined>(() =>
    isNaN(parsedNewArgs.height) ? undefined : parsedNewArgs.height
  )

  // Use a ref for the ready-state so that we can differentiate between sending renderMessages due to props-changes
  // and when the componentReady callback is called (for the first time)
  const isReadyRef = useRef<boolean>(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const onBackMsgRef = useRef<IframeMessageHandlerProps>()

  // Show a log in the console as a soft-warning to the developer before showing the more disrupting warning element
  const { clear: clearTimeoutLog } = useTimeout(
    () => LOG.warn(getWarnMessage(componentName, url)),
    COMPONENT_READY_WARNING_TIME_MS / 4
  )
  const { clear: clearTimeoutWarningElement } = useTimeout(() => {
    /* eslint-disable-next-line @eslint-react/dom/no-flush-sync -- To keep
     * behavior the same as before introducing `createRoot` and after, we ensure
     * that the state updates are flushed immediately.
     */
    flushSync(() => {
      setIsReadyTimeout(true)
    })
  }, COMPONENT_READY_WARNING_TIME_MS)

  useEffect(() => {
    // Iframe onerror event unreliable - check custom component
    // src on mount to catch iframe load errors
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    registry.checkSourceUrlResponse(componentSourceUrl, componentName)
  }, [componentSourceUrl, componentName, registry])

  useEffect(() => {
    if (isReadyTimeout && !isReadyRef.current) {
      // Send timeout error if we've timed out waiting for the READY message from the component
      LOG.error(
        `Client Error: Custom Component ${componentName} timeout error`
      )
      registry.sendTimeoutError(componentSourceUrl, componentName)
    }
  }, [isReadyTimeout, componentSourceUrl, componentName, registry])

  // Send a render message to the custom component everytime relevant props change, such as the
  // input args or the theme / width
  useEffect(() => {
    if (!isReadyRef.current) {
      return
    }
    sendRenderMessage(
      parsedArgsRef.current.args,
      parsedArgsRef.current.dataframeArgs,
      disabled,
      theme,
      iframeRef.current ?? undefined
    )
  }, [disabled, frameHeight, haveDataframeArgsChanged, jsonArgs, theme, width])

  useEffect(() => {
    const handleSetFrameHeight = (height: number | undefined): void => {
      if (height === undefined) {
        LOG.warn(`handleSetFrameHeight: missing 'height' prop`)
        return
      }

      if (height === frameHeight) {
        // Nothing to do!
        return
      }

      if (isNullOrUndefined(iframeRef.current)) {
        // This should not be possible.
        LOG.warn(`handleSetFrameHeight: missing our iframeRef!`)
        return
      }

      // We shove our new frameHeight directly into our iframe, to avoid
      // triggering a re-render. Otherwise, components will receive the RENDER
      // event several times during startup (because they will generally
      // immediately change their frameHeight after mounting). This is wasteful,
      // and it also breaks certain components.
      iframeRef.current.height = height.toString()
      /* eslint-disable-next-line @eslint-react/dom/no-flush-sync -- To keep
       * behavior the same as before introducing `createRoot` and after, we ensure
       * that the state updates are flushed immediately.
       */
      flushSync(() => {
        setFrameHeight(height)
      })
    }

    const componentReadyCallback = (): void => {
      // Send a render message whenever the custom component sends a ready message
      sendRenderMessage(
        parsedArgsRef.current.args,
        parsedArgsRef.current.dataframeArgs,
        disabled,
        theme,
        iframeRef.current ?? undefined
      )
      clearTimeoutLog()
      clearTimeoutWarningElement()
      isReadyRef.current = true
      /* eslint-disable-next-line @eslint-react/dom/no-flush-sync -- To keep
       * behavior the same as before introducing `createRoot` and after, we ensure
       * that the state updates are flushed immediately.
       */
      flushSync(() => {
        setIsReadyTimeout(false)
      })
    }

    // Update the reference fields for the callback that we
    // passed to the componentRegistry
    onBackMsgRef.current = {
      // isReady is a callback to ensure the caller receives the latest value
      isReady: () => isReadyRef.current,
      element,
      widgetMgr,
      setComponentError,
      componentReadyCallback,
      frameHeightCallback: handleSetFrameHeight,
      fragmentId,
    }
  }, [
    componentName,
    disabled,
    element,
    frameHeight,
    haveDataframeArgsChanged,
    isReadyTimeout,
    jsonArgs,
    theme,
    widgetMgr,
    clearTimeoutWarningElement,
    clearTimeoutLog,
    fragmentId,
  ])

  useEffect(() => {
    const contentWindow: Window | undefined =
      iframeRef.current?.contentWindow ?? undefined
    if (!contentWindow) {
      return
    }
    // By creating the callback using the reference variable, we
    // can access up-to-date information from the component when the callback
    // is called without the need to re-register the callback
    registry.registerListener(
      contentWindow,
      createIframeMessageHandler(onBackMsgRef)
    )

    // De-register component when unmounting and when effect is re-running
    return () => {
      if (!contentWindow) {
        return
      }

      registry.deregisterListener(contentWindow)
    }
  }, [registry, componentName])

  if (componentError) {
    return (
      <ErrorElement
        name={componentError.name}
        message={componentError.message}
      />
    )
  }

  // Show the loading Skeleton while we have not received the ready message from the custom component
  // but while we also have not waited until the ready timeout
  // TODO: Update to match React best practices

  const loadingSkeleton = !isReadyRef.current &&
    !isReadyTimeout &&
    // if height is explicitly set to 0, we don’t want to show the skeleton at all
    frameHeight !== 0 && (
      // Skeletons will have a default height if no frameHeight was specified
      <Skeleton
        element={SkeletonProto.create({
          height: frameHeight,
          style: SkeletonProto.SkeletonStyle.ELEMENT,
        })}
      />
    )

  // If we've timed out waiting for the READY message from the component,
  // display a warning.
  const warns =
    // TODO: Update to match React best practices

    !isReadyRef.current && isReadyTimeout ? (
      <AlertElement
        body={getWarnMessage(componentName, url)}
        kind={Kind.WARNING}
      />
    ) : null

  // Render the iframe. We set scrolling="no", because we don't want
  // scrollbars to appear; instead, we want components to properly auto-size
  // themselves.
  //
  // Without this, there is a potential for a scrollbar to
  // appear for a brief moment after an iframe's content gets bigger,
  // and before it sends the "setFrameHeight" message back to Streamlit.
  //
  // We may ultimately want to give components control over the "scrolling"
  // property.
  //
  // While the custom component is not in ready-state, show the loading Skeleton instead
  //
  // TODO: make sure horizontal scrolling still works!
  return (
    <>
      {loadingSkeleton}
      {warns}
      <StyledComponentIframe
        className="stCustomComponentV1"
        data-testid="stCustomComponentV1"
        allow={DEFAULT_IFRAME_FEATURE_POLICY}
        ref={iframeRef}
        src={componentSourceUrl}
        width={width}
        // for undefined height we set the height to 0 to avoid inconsistent behavior
        height={frameHeight ?? 0}
        scrolling="no"
        sandbox={DEFAULT_IFRAME_SANDBOX_POLICY}
        title={componentName}
        // TODO: Update to match React best practices

        componentReady={isReadyRef.current}
        tabIndex={element.tabIndex ?? undefined}
      />
    </>
  )
}

export default withCalculatedWidth(memo(ComponentInstance))
