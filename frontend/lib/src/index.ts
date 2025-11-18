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

// We add some polyfills in order to support older browsers for the exports below
import "@streamlit/utils"
// These imports are each exported specifically in order to minimize public apis.
export type { LibConfig } from "@streamlit/connection"
export { AppRoot, BlockNode, ElementNode } from "./AppNode"
export {
  ContainerContentsWrapper,
  VerticalBlock,
} from "./components/core/Block"
export type { BlockPropsWithoutWidth } from "./components/core/Block"
export { default as ElementNodeRenderer } from "./components/core/Block/ElementNodeRenderer"
export type { ElementNodeRendererProps } from "./components/core/Block/ElementNodeRenderer"
export { FormsContext } from "./components/core/FormsContext"
export type { FormsContextProps } from "./components/core/FormsContext"
export { default as IsDialogContext } from "./components/core/IsDialogContext"
export { default as IsSidebarContext } from "./components/core/IsSidebarContext"
export { LibConfigContext } from "./components/core/LibConfigContext"
export type { LibConfigContextProps } from "./components/core/LibConfigContext"
export { NavigationContext } from "./components/core/NavigationContext"
export type { NavigationContextProps } from "./components/core/NavigationContext"
export { DownloadContext } from "./components/core/DownloadContext"
export type { DownloadContextProps } from "./components/core/DownloadContext"
export { PortalProvider } from "./components/core/Portal/PortalProvider"
export { ScriptRunContext } from "./components/core/ScriptRunContext"
export type { ScriptRunContextProps } from "./components/core/ScriptRunContext"
export { SidebarConfigContext } from "./components/core/SidebarConfigContext"
export type { SidebarConfigContextProps } from "./components/core/SidebarConfigContext"
export { ThemeContext } from "./components/core/ThemeContext"
export type { ThemeContextProps } from "./components/core/ThemeContext"
export { default as ThemeProvider } from "./components/core/ThemeProvider"
export { ViewStateContext } from "./components/core/ViewStateContext"
export type { ViewStateContextProps } from "./components/core/ViewStateContext"
export { default as AlertElement } from "./components/elements/AlertElement"
export { default as StreamlitSyntaxHighlighter } from "./components/elements/CodeBlock/StreamlitSyntaxHighlighter"
export { handleFavicon } from "./components/elements/Favicon"
export { default as TextElement } from "./components/elements/TextElement"
export {
  default as BaseButton,
  BaseButtonKind,
} from "./components/shared/BaseButton"
export { default as BaseColorPicker } from "./components/shared/BaseColorPicker"
export { default as UISelectbox } from "./components/shared/Dropdown/Selectbox"
export {
  DynamicIcon,
  EmojiIcon,
  default as Icon,
  isMaterialIcon,
} from "./components/shared/Icon"
export {
  default as Modal,
  ModalBody,
  ModalButton,
  ModalFooter,
  ModalHeader,
} from "./components/shared/Modal"
export { CircularBuffer, Profiler } from "./components/shared/Profiler"
export { default as StreamlitMarkdown } from "./components/shared/StreamlitMarkdown"
export { Placement, default as Tooltip } from "./components/shared/Tooltip"
export { WindowDimensionsContext } from "./components/shared/WindowDimensions"
export { WindowDimensionsProvider } from "./components/shared/WindowDimensions/Provider"
export type { WindowDimensions } from "./components/shared/WindowDimensions/useWindowDimensions"
export { useWindowDimensionsContext } from "./components/shared/WindowDimensions/useWindowDimensionsContext"
export { ComponentRegistry } from "./components/widgets/CustomComponent"
export { Quiver } from "./dataframes/Quiver"
export { FileUploadClient } from "./FileUploadClient"
export { useCopyToClipboard } from "./hooks/useCopyToClipboard"
export { useCrossOriginAttribute } from "./hooks/useCrossOriginAttribute"
export { useEmotionTheme } from "./hooks/useEmotionTheme"
export { useExecuteWhenChanged } from "./hooks/useExecuteWhenChanged"
export { useRequiredContext } from "./hooks/useRequiredContext"
export {
  measureScrollbarGutterSize,
  useScrollbarGutterSize,
} from "./hooks/useScrollbarGutterSize"
export { default as useScrollToBottom } from "./hooks/useScrollToBottom"
export { default as HostCommunicationManager } from "./hostComm"
export { HOST_COMM_VERSION } from "./hostComm/HostCommunicationManager"
export type {
  AppConfig,
  DeployedAppMetadata,
  IGuestToHostMessage,
  IMenuItem,
  IToolbarItem,
} from "./hostComm/types"
export {
  mockEndpoints,
  mockSessionInfo,
  mockSessionInfoProps,
} from "./mocks/mocks"
export { mockTheme } from "./mocks/mockTheme"
export { RootStyleProvider } from "./RootStyleProvider"
export { ScriptRunState } from "./ScriptRunState"
export { SessionInfo } from "./SessionInfo"
export { mockWindowLocation, render, renderWithContexts } from "./test_util"
export {
  AUTO_THEME_NAME,
  baseTheme,
  convertRemToPx,
  createAutoTheme,
  createCustomThemes,
  createPresetThemes,
  createSidebarTheme,
  createTheme,
  CUSTOM_THEME_AUTO_NAME,
  CUSTOM_THEME_DARK_NAME,
  CUSTOM_THEME_LIGHT_NAME,
  CUSTOM_THEME_NAME,
  customTheme,
  darkTheme,
  getCachedTheme,
  getDefaultTheme,
  getHostSpecifiedTheme,
  getSystemThemePreference,
  globalStyles,
  hasLightBackgroundColor,
  isPresetTheme,
  lightTheme,
  removeCachedTheme,
  setCachedTheme,
  toExportedTheme,
  toThemeInput,
} from "./theme"
export type { EmotionTheme, PresetThemeName, ThemeConfig } from "./theme"
export { default as emotionLightTheme } from "./theme/emotionLightTheme"
export { fonts, spacing } from "./theme/primitives"
export { ensureError } from "./util/ErrorHandling"
export { useIsOverflowing } from "./util/Hooks"
export { isMobile } from "./util/isMobile"
export {
  mark,
  measure,
  type StPerformanceMark,
  type StPerformanceMetric,
} from "./util/performance"
export { LocalStore } from "./util/storageUtils"
export { Timer } from "./util/Timer"
export { getCrossOriginAttribute } from "./util/UriUtil"
export {
  extractPageNameFromPathName,
  generateUID,
  getElementId,
  getEmbeddingIdClassName,
  getIFrameEnclosingApp,
  getLocaleLanguage,
  getTimezone,
  getTimezoneOffset,
  getUrl,
  hashString,
  isDarkThemeInQueryParams,
  isEmbed,
  isInChildFrame,
  isLightThemeInQueryParams,
  isPaddingDisplayed,
  isScrollingHidden,
  isToolbarDisplayed,
  makeElementWithInfoText,
  notUndefined,
  preserveEmbedQueryParams,
  setCookie,
} from "./util/utils"
export { createFormsData, WidgetStateManager } from "./WidgetStateManager"
export type { FormsData } from "./WidgetStateManager"
