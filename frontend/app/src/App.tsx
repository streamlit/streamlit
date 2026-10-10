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

import { createRef, type JSX, PureComponent, type ReactNode } from "react"

import { enableMapSet, enablePatches } from "immer"
import { getLogger } from "loglevel"
import { flushSync } from "react-dom"

import AppView from "@streamlit/app/src/components/AppView/AppView"
import DeployButton from "@streamlit/app/src/components/DeployButton/DeployButton"
import { GlobalHotkeys } from "@streamlit/app/src/components/GlobalHotkeys/GlobalHotkeys"
import MainMenu from "@streamlit/app/src/components/MainMenu/MainMenu"
import {
  isSkillsNudgeDismissed,
  isSkillsNudgeDroppedConnection,
  isSkillsNudgeSnoozed,
  setSkillsNudgeDismissed,
  setSkillsNudgeSnoozed,
  SKILLS_NUDGE_DROPPED_MESSAGE,
  skillsNudgeInstallFailureLabel,
  skillsNudgeInstallSuccessLabel,
  skillsNudgeSuppressedLabel,
} from "@streamlit/app/src/components/SkillsNudgeToast/skillsNudge"
import SkillsNudgeToast from "@streamlit/app/src/components/SkillsNudgeToast/SkillsNudgeToast"
import StatusWidget from "@streamlit/app/src/components/StatusWidget/StatusWidget"
import StreamlitContextProvider from "@streamlit/app/src/components/StreamlitContextProvider"
import { DialogType } from "@streamlit/app/src/components/StreamlitDialog/constants"
import DialogErrorMessage from "@streamlit/app/src/components/StreamlitDialog/DialogErrorMessage"
import {
  type ConnectionErrorProps,
  type DialogProps,
  type ScriptCompileErrorProps,
  StreamlitDialog,
  type WarningProps,
} from "@streamlit/app/src/components/StreamlitDialog/StreamlitDialog"
import type { UserSettings } from "@streamlit/app/src/components/StreamlitDialog/UserSettings"
import ToolbarActions from "@streamlit/app/src/components/ToolbarActions/ToolbarActions"
import withScreencast, {
  type ScreenCastHOC,
} from "@streamlit/app/src/hocs/withScreencast/withScreencast"
import { useViewportSize } from "@streamlit/app/src/hooks/useViewportSize"
import { MetricsManager } from "@streamlit/app/src/MetricsManager"
import { SessionEventDispatcher } from "@streamlit/app/src/SessionEventDispatcher"
import { StyledApp } from "@streamlit/app/src/styled-components"
import getBrowserInfo from "@streamlit/app/src/util/getBrowserInfo"
import {
  type AppConfig,
  ConnectionManager,
  ConnectionState,
  DefaultStreamlitEndpoints,
  type ErrorDetails,
  type IHostConfigProperties,
  isHostConfigBypassEnabled,
  type LibConfig,
  parseUriIntoBaseParts,
  type StreamlitEndpoints,
} from "@streamlit/connection"
import {
  AppRoot,
  BackendOperationClient,
  type CircularBuffer,
  ComponentRegistry,
  createAutoTheme,
  createCustomThemes,
  createFormsData,
  createPresetThemes,
  CUSTOM_THEME_AUTO_NAME,
  darkTheme,
  type DeployedAppMetadata,
  ensureError,
  ensureHotkeysFilterConfigured,
  extractPageNameFromPathName,
  FileUploadClient,
  type FormsData,
  generateUID,
  getElementId,
  getEmbeddingIdClassName,
  getIFrameEnclosingApp,
  getLocaleLanguage,
  getPreferredTheme,
  getQueryString,
  getScreencastTimestamp,
  getTimezone,
  getTimezoneOffset,
  getUrl,
  handleFavicon,
  hashString,
  hasLightBackgroundColor,
  HostCommunicationManager,
  type IMenuItem,
  INITIAL_SCRIPT_RUN_ID,
  isElementDialogOpen,
  isEmbed,
  isInChildFrame,
  isKeyboardEventFromEditableTarget,
  isPaddingDisplayed,
  isPresetTheme,
  isScrollingHidden,
  isToolbarDisplayed,
  type IToolbarItem,
  lightTheme,
  mark,
  measure,
  normalizeQueryString,
  notUndefined,
  preserveEmbedQueryParams,
  type PresetThemeName,
  ScriptRunState,
  SessionInfo,
  sortThemeInputKeys,
  type ThemeConfig,
  toExportedTheme,
  WidgetStateManager,
} from "@streamlit/lib"
import {
  type AppPage,
  type AuthRedirect,
  type AutoRerun,
  type BackendOperationResponse,
  BackMsg,
  Config,
  type CustomThemeConfig,
  type Delta,
  type FileURLsResponse,
  ForwardMsg,
  type ForwardMsgMetadata,
  type GitInfo,
  type Initialize,
  type Logo,
  Navigation,
  type NewSession,
  PageConfig,
  type PageInfo,
  type PageNotFound,
  PageProfile,
  type ParentMessage,
  type SessionEvent,
  type SessionStatus,
  type StopAutoRerun,
  type WidgetStates,
} from "@streamlit/protobuf"
import {
  isLocalhost,
  isNullOrUndefined,
  localStorageAvailable,
  notNullOrUndefined,
  StreamlitConfig,
} from "@streamlit/utils"

import { showDevelopmentOptions } from "./showDevelopmentOptions"
// Import @font-face rules for app and icon fonts
import "@streamlit/app/src/assets/css/fonts.css"
import { AppNavigation, type MaybeStateUpdate } from "./util/AppNavigation"
import {
  includeIfDefined,
  reconcileHostConfigValues,
} from "./util/hostConfigHelpers"
import type { ThemeManager } from "./util/useThemeManager"

// vite config builds global variable PACKAGE_METADATA
declare const PACKAGE_METADATA: {
  version: string
}

export interface Props {
  screenCast: ScreenCastHOC
  theme: ThemeManager
  streamlitExecutionStartedAt: number
  isMobileViewport: boolean
}

interface State {
  connectionState: ConnectionState
  elements: AppRoot
  isFullScreen: boolean
  scriptRunId: string
  scriptName: string
  appHash: string | null
  scriptRunState: ScriptRunState
  userSettings: UserSettings
  dialog?: DialogProps | null
  connectionErrorDismissed: boolean
  layout: PageConfig.Layout
  initialSidebarState: PageConfig.SidebarState
  initialSidebarWidth?: number
  menuItems?: PageConfig.MenuItems.$Properties | null
  allowRunOnSave: boolean
  scriptFinishedHandlers: (() => void)[]
  toolbarMode: Config.ToolbarMode
  showErrorLinks: Config.ShowErrorLinks
  disableDataExport: boolean
  themeHash: string
  gitInfo: GitInfo.$Properties | null
  formsData: FormsData
  hideTopBar: boolean
  hideSidebarNav: boolean
  expandSidebarNav: boolean
  sidebarNavVisibleItems?: number
  navigationPosition: Navigation.Position
  appPages: AppPage.$Properties[]
  navSections: string[]
  // The hash of the current page executing
  currentPageScriptHash: string
  // In MPAv2, the main page is executed before and after the current
  // page. The main page is the script the app is started with, and the current
  // page is the dynamically loaded page-script. In MPAv1, the main page holds
  // no relevance as only one page loads at a time.
  mainScriptHash: string
  latestRunTime: number
  fragmentIdsThisRun: Array<string>
  // Monotonic counter bumped on every scriptFinished message; lets widgets
  // detect that a run completed. Consumed by ChatInput.
  scriptRunFinishedSequence: number
  // Fragments that ran in the run that just finished; empty for full-script
  // runs, and may contain more than one. Consumed by ChatInput.
  scriptRunFinishedFragmentIds: Array<string>
  // host communication info
  isOwner: boolean
  hostMenuItems: IMenuItem[]
  hostToolbarItems: IToolbarItem[]
  hostHideSidebarNav: boolean
  sidebarChevronDownshift: number
  pageLinkBaseUrl: string
  queryParams: string
  deployedAppMetadata: DeployedAppMetadata
  libConfig: LibConfig
  appConfig: AppConfig
  inputsDisabled: boolean
  scriptChangedOnDisk: boolean
  // Whether the framework "install skills" nudge is currently shown. Set once
  // per page load in handleInitialization when the server recommends it (and
  // the localhost / dismissal / snooze gates pass), and cleared when the
  // developer installs, snoozes (✕), or picks "Don't show again".
  showSkillsNudge: boolean

  /**
   * Whether the server recommended installing the bundled agent skills this
   * session (agent present, skills not installed, not headless, no permanent
   * dismissal marker). Drives the in-error "install skills" callout, which
   * gates on it every render — independent of the one-shot toast logic above.
   */
  recommendSkillsInstall: boolean

  /**
   * Set once skills are installed this session (from any surface). The server
   * only re-detects an install on a new session, so this hides the in-error
   * callout (and any further nudge) for the rest of the current session.
   */
  skillsInstalledThisSession: boolean

  /**
   * Set once an install has genuinely failed this session (not merely dropped
   * its connection). The cause is environmental — a blocked target, a read-only
   * directory — so it will fail again, and without this every later error would
   * offer the same doomed install.
   */
  skillsInstallFailedThisSession: boolean
}

export const LOG = getLogger("App")

/**
 * Largest delay `setTimeout` / `setInterval` accept. The Web IDL `long` type
 * is a signed 32-bit integer, so a bigger delay wraps and can fire immediately.
 */
const MAX_TIMER_DELAY_MS = 2_147_483_647

declare global {
  interface Window {
    streamlitDebug: {
      clearForwardMsgCache: () => void
      disconnectWebsocket: () => void
      shutdownRuntime: () => void
    }
    iFrameResizer: {
      heightCalculationMethod: () => number
    }
    __streamlit_profiles__?: Record<
      string,
      CircularBuffer<{
        phase: "mount" | "update" | "nested-update"
        actualDuration: number
        baseDuration: number
        startTime: number
        commitTime: number
      }>
    >
  }
}

export class App extends PureComponent<Props, State> {
  private readonly endpoints: StreamlitEndpoints

  private readonly sessionInfo = new SessionInfo()

  private readonly metricsMgr = new MetricsManager(this.sessionInfo)

  private readonly sessionEventDispatcher = new SessionEventDispatcher()

  private connectionManager: ConnectionManager | null

  private readonly widgetMgr: WidgetStateManager

  private readonly hostCommunicationMgr: HostCommunicationManager

  private readonly uploadClient: FileUploadClient

  private readonly componentRegistry: ComponentRegistry

  private readonly embeddingId: string = generateUID()

  /**
   * Ref to the root app container element.
   * Used by components like Sidebar to detect clicks inside/outside the app.
   */
  private readonly appRootRef = createRef<HTMLDivElement>()

  /** Client for backend operation requests (lazy loading, validation, etc.) */
  private readonly backendOperationClient: BackendOperationClient

  private readonly appNavigation: AppNavigation

  private isInitializingConnectionManager: boolean = true

  // Whether we have received a NewSession message after the latest rerun request.
  // This is used to ensure that we only increment the message cache run count after
  // we have received a NewSession message after the latest rerun request.
  // This will allow us to ignore finished messages from previous script runs.
  private hasReceivedNewSession: boolean = false

  /**
   * History-navigation PageInfo should use replaceState, not pushState, so the
   * restored back/forward entry is not duplicated. Only relevant when the
   * backend changes the query string during a history rerun; an unchanged
   * query string never reaches the history API (see handlePageInfoChanged).
   *
   * Attribution is best-effort (PageInfo has no run id):
   * - {@link rerunEpoch}: increments on every rerun request the frontend sends.
   * - {@link historyNavigationEpoch}: set to that epoch on a history BackMsg;
   *   advanced with the epoch only for an auto-rerun that immediately follows
   *   a still-pending history BackMsg (no NewSession yet, no intervening
   *   non-history BackMsg) — matching backend sticky coalesce. Left unchanged
   *   on other non-history BackMsgs; cleared on a superseding NewSession
   *   (epoch mismatch) or on a successful finish for the latest run.
   * - PageInfo uses replaceState while historyNavigationEpoch !== null.
   * - FINISHED_EARLY_FOR_RERUN does not clear the epoch.
   *
   * Known limitation: a stale history NewSession after a newer non-history
   * BackMsg can clear the epoch early (same class as hasReceivedNewSession).
   * Closing that requires a run id on PageInfo.
   */
  private rerunEpoch: number = 0
  private historyNavigationEpoch: number | null = null

  // Active `run_every` auto-rerun timers. Fragment timers are keyed by fragment
  // id. These are imperative timer handles, so they live outside of React
  // state. Re-registering the same interval leaves the countdown alone. Full
  // reruns still restart the page countdown because `handleNewSession` clears
  // these timers first. The stored `interval` (in seconds) is what
  // re-registration compares against.
  /**
   * Timer id for `st.set_page_config(run_every=...)`. Protobuf sends an unset
   * `fragment_id` as "", which no real fragment uses.
   */
  private static readonly PAGE_AUTO_RERUN_ID = ""
  private readonly autoRerunIntervals: Map<
    string,
    {
      timer: ReturnType<typeof setInterval>
      interval: number
      /** False when `timer` is a chained `setTimeout` for a delay above the 32-bit limit. */
      repeating: boolean
      /** Identifies this registration. A queued callback must not fire after a clear or replace. */
      generation: object
    }
  > = new Map()

  // Whether the skills-install nudge has been shown this page load.
  // `handleInitialization` re-runs on websocket reconnect, so this guards
  // against enqueuing a duplicate nudge and against logging multiple
  // `skillsNudgeShown` events (which would inflate the adoption funnel). Reset
  // only by a full page reload (a new App instance).
  private skillsNudgeShown: boolean = false

  // A page tick that arrived while a script run was still active. It is sent
  // once that run finishes on its own, so a slow page is not preempted and
  // does not wait another full interval. Stop and a non-auto full rerun clear
  // it. An interrupted run does not send it in the idle gap before the
  // replacement: a full NewSession drops it, and a fragment replacement keeps
  // it until that fragment run finishes.
  private pageAutoRerunDeferred = false

  // Set while a replacement run is expected and the server has not reported
  // it yet: after an interrupt, a user or fragment rerun, or a page auto-rerun
  // that was just sent. Page ticks are dropped until that request is
  // acknowledged. A fragment rerun leaves the page timer and any held tick in
  // place. A user full rerun, and a deferred page-tick replay that was queued,
  // also clear the page timer.
  private pageAutoRerunAwaitingNextRun = false

  // Set only after a deferred page replay is queued. Reconnect retries that
  // replay. An ordinary widget rerun must not set this: retrying it would
  // stop the in-flight run and drop the click. That includes a widget rerun
  // that cleared the page timer. The script re-arms `run_every` when that
  // run is acknowledged.
  private pageAutoRerunReplayQueued = false

  // The BackMsg that set `pageAutoRerunAwaitingNextRun`. A full `NewSession`
  // for an older run must not drop a fragment guard at this epoch.
  private pageAutoRerunGuardEpoch: number | null = null

  // Set when the pending request is fragment-scoped. Empty for a full rerun.
  private pageAutoRerunGuardFragmentId: string | undefined = undefined

  // True after a `NewSession` lists `pageAutoRerunGuardFragmentId`. The next
  // `scriptIsRunning` then belongs to that fragment request.
  private pageAutoRerunGuardAcked = false

  // `Date.now()` when the script became idle with this guard set. Null while a
  // run is still active: time spent inside that run does not age the guard, so
  // a slow script cannot be replaced by a page tick. Once idle, one full page
  // interval without acknowledgement expires a fragment request.
  private pageAutoRerunGuardIdleSince: number | null = null
  private pageAutoRerunGuardIntervalMs = 0

  // Kept after the page timer is cleared. A fragment click in that gap still
  // needs an interval, or the guard would never expire.
  private lastPageAutoRerunIntervalMs = 0

  // Whether a suppression reason has been reported this page load. Tracked
  // separately from `skillsNudgeShown` so recording a suppression does NOT
  // prevent the nudge from appearing later in the same page load: eligibility is
  // recomputed on every rerun, and `check_failed` in particular is transient (a
  // thrown eligibility check), so a single bad rerun must not withhold the nudge
  // until the user reloads. Deduping the two events independently still keeps a
  // reconnect from inflating either count.
  private skillsNudgeSuppressionReported: boolean = false

  // Same once-per-page-load guard for the in-error callout's impression: the
  // callout remounts whenever its error box remounts (across reruns), but the
  // adoption funnel should count one "shown" per session per surface — matching
  // the toast above — so a recurring error can't inflate the errorCallout count.
  private errorCalloutShown: boolean = false

  // Session-constant part of the in-error callout's gate. `isLocalhost()`,
  // `isEmbed()`, and `localStorageAvailable()` don't change within a session,
  // and `localStorageAvailable()` does a synchronous write probe — so compute
  // them once (lazily) instead of on every render. The callout gate reaches
  // this only after `recommendSkillsInstall` short-circuits, so apps without
  // the agent recommendation never pay for it. (The dismissal check stays
  // per-render, since a "don't show again" can flip it mid-session.)
  private cachedSkillsCalloutEnvEligible?: boolean

  // The install currently in flight, if any, so both surfaces share one
  // operation instead of racing two against the same target tree. Cleared when
  // it settles. See handleSkillsNudgeInstall.
  private inFlightSkillsInstall: Promise<string | undefined> | null = null

  private get skillsCalloutEnvEligible(): boolean {
    if (this.cachedSkillsCalloutEnvEligible === undefined) {
      this.cachedSkillsCalloutEnvEligible =
        isLocalhost() && !isEmbed() && localStorageAvailable()
    }
    return this.cachedSkillsCalloutEnvEligible
  }

  public constructor(props: Props) {
    super(props)

    // Register hotkey filter:
    ensureHotkeysFilterConfigured()

    // Initialize immerjs
    enablePatches()
    enableMapSet()

    this.state = {
      connectionState: ConnectionState.INITIAL,
      elements: AppRoot.empty("", true), // Blank Main Script Hash for initial render
      isFullScreen: false,
      scriptName: "",
      scriptRunId: INITIAL_SCRIPT_RUN_ID,
      appHash: null,
      scriptRunState: ScriptRunState.NOT_RUNNING,
      userSettings: {
        wideMode: false,
        runOnSave: false,
      },
      connectionErrorDismissed: false,
      layout: PageConfig.Layout.CENTERED,
      initialSidebarState: PageConfig.SidebarState.AUTO,
      initialSidebarWidth: undefined,
      menuItems: undefined,
      allowRunOnSave: true,
      scriptFinishedHandlers: [],
      showErrorLinks: Config.ShowErrorLinks.SHOW_ERROR_LINKS_AUTO,
      disableDataExport: false,
      // Initialize themeHash to empty string to ensure the first processThemeInput
      // call always processes the theme (whether null or custom theme from server).
      // This prevents the bug where a cached custom theme isn't cleared when the
      // server sends null, because null and undefined both hash to the same value.
      themeHash: "",
      gitInfo: null,
      formsData: createFormsData(),
      appPages: [],
      navSections: [],
      currentPageScriptHash: "",
      mainScriptHash: "",
      // We set hideTopBar to true by default because this information isn't
      // available on page load (we get it when the script begins to run), so
      // the user would see top bar elements for a few ms if this defaulted to
      // false. hideSidebarNav doesn't have this issue (app pages and the value
      // of the config option are received simultaneously), but we set it to
      // true as well for consistency.
      hideTopBar: true,
      hideSidebarNav: true,
      expandSidebarNav: false,
      toolbarMode: Config.ToolbarMode.MINIMAL,
      latestRunTime: performance.now(),
      fragmentIdsThisRun: [],
      scriptRunFinishedSequence: 0,
      scriptRunFinishedFragmentIds: [],
      // Information sent from the host
      isOwner: false,
      hostMenuItems: [],
      hostToolbarItems: [],
      hostHideSidebarNav: false,
      sidebarChevronDownshift: 0,
      pageLinkBaseUrl: "",
      // Initialize from URL so bound widget params from shared links are
      // preserved on first page navigation (before handlePageInfoChanged fires).
      queryParams: normalizeQueryString(window.location?.search ?? ""),
      deployedAppMetadata: {},
      libConfig: {},
      appConfig: {},
      inputsDisabled: false,
      navigationPosition: Navigation.Position.SIDEBAR,
      scriptChangedOnDisk: false,
      showSkillsNudge: false,
      recommendSkillsInstall: false,
      skillsInstalledThisSession: false,
      skillsInstallFailedThisSession: false,
    }

    this.connectionManager = null

    this.widgetMgr = new WidgetStateManager({
      sendRerunBackMsg: this.sendRerunBackMsg,
      formsDataChanged: formsData => this.setState({ formsData }),
    })

    // Sync widget URL changes to App state for page navigation preservation.
    this.widgetMgr.setQueryParamsChangeHandler(this.syncQueryParams)

    this.hostCommunicationMgr = new HostCommunicationManager({
      streamlitExecutionStartedAt: props.streamlitExecutionStartedAt,
      sendRerunBackMsg: (
        widgetStates?: WidgetStates,
        pageScriptHash?: string,
        queryStringOverride?: string
      ) => {
        // HostCommunicationManager omits fragmentId and isAutoRerun; App.sendRerunBackMsg
        // takes those before queryStringOverride.
        this.sendRerunBackMsg(
          widgetStates,
          undefined,
          pageScriptHash,
          undefined,
          queryStringOverride
        )
      },
      closeModal: this.closeDialog,
      stopScript: this.stopScript,
      rerunScript: this.rerunScript,
      clearCache: this.clearCache,
      sendAppHeartbeat: this.sendAppHeartbeat,
      setInputsDisabled: inputsDisabled => {
        this.setState({ inputsDisabled })
      },
      themeChanged: this.handleThemeMessage,
      pageChanged: pageScriptHash => this.onPageChange(pageScriptHash),
      isOwnerChanged: isOwner => this.setState({ isOwner }),
      fileUploadClientConfigChanged: config => {
        if (this.endpoints.setFileUploadClientConfig !== undefined) {
          this.endpoints.setFileUploadClientConfig(config)
        }
      },
      hostMenuItemsChanged: hostMenuItems => {
        this.setState({ hostMenuItems })
      },
      hostToolbarItemsChanged: hostToolbarItems => {
        this.setState({ hostToolbarItems })
      },
      hostHideSidebarNavChanged: hostHideSidebarNav => {
        this.setState({ hostHideSidebarNav })
      },
      sidebarChevronDownshiftChanged: sidebarChevronDownshift => {
        this.setState({ sidebarChevronDownshift })
      },
      pageLinkBaseUrlChanged: pageLinkBaseUrl => {
        this.setState({ pageLinkBaseUrl })
      },
      queryParamsChanged: queryParams => {
        this.setState({ queryParams })
      },
      deployedAppMetadataChanged: deployedAppMetadata => {
        this.setState({ deployedAppMetadata })
      },
      restartWebsocketConnection: () => {
        if (!this.connectionManager) {
          // Performing an intentional restart - we want the script to rerun on load
          // so setting RERUN_REQUESTED so handleConnectionStateChanged triggers it
          this.setState({ scriptRunState: ScriptRunState.RERUN_REQUESTED })
          this.initializeConnectionManager()
        }
      },
      terminateWebsocketConnection: () => {
        this.connectionManager?.disconnect()
        this.connectionManager = null
      },
      printApp: this.printCallback,
    })

    this.endpoints = new DefaultStreamlitEndpoints({
      getServerUri: this.getBaseUriParts,
      csrfEnabled: true,
      sendClientError: (
        component: string,
        error: string | number,
        message: string,
        source: string,
        customComponentName?: string
      ) => {
        this.hostCommunicationMgr.sendMessageToHost({
          type: "CLIENT_ERROR",
          component,
          error,
          message,
          source,
          customComponentName,
        })
      },
    })

    this.uploadClient = new FileUploadClient({
      sessionInfo: this.sessionInfo,
      endpoints: this.endpoints,
      // A form cannot be submitted if it contains a FileUploader widget
      // that's currently uploading. We write that state here, in response
      // to a FileUploadClient callback. The FormSubmitButton element
      // reads the state.
      formsWithPendingRequestsChanged: formIds =>
        this.widgetMgr.setFormsWithUploadsInProgress(formIds),
      requestFileURLs: this.requestFileURLs,
    })

    this.componentRegistry = new ComponentRegistry(this.endpoints)

    this.appNavigation = new AppNavigation(
      this.hostCommunicationMgr,
      this.maybeUpdatePageUrl,
      this.onPageNotFound,
      this.onPageIconChanged
    )

    this.backendOperationClient = new BackendOperationClient({
      sendRequest: request => {
        // Check connection before sending to fail fast instead of timing out
        if (!this.isServerConnected() || !this.sessionInfo.isSet) {
          throw new Error(
            "Cannot send backend operation request: not connected to server"
          )
        }
        const backMsg = new BackMsg({ backendOperationRequest: request })
        backMsg.type = "backendOperationRequest"
        this.sendBackMsg(backMsg)
      },
      getSessionId: () => this.sessionInfo.current.sessionId,
    })

    window.streamlitDebug = {
      clearForwardMsgCache: this.debugClearForwardMsgCache,
      disconnectWebsocket: this.debugDisconnectWebsocket,
      shutdownRuntime: this.debugShutdownRuntime,
    }
  }

  private applyInitialHostConfig(): void {
    // Apply window host configuration early when bypass mode is enabled.
    //
    // When bypass is enabled: WebSocket connects immediately (before host-config endpoint),
    // so we need to apply window config early to enable host communication & apply app/lib configs
    // for the first render.
    //
    // When bypass is disabled: WebSocket waits for host-config endpoint anyway,
    // so window config will be applied during reconciliation in onHostConfigResp.
    //
    // This ensures we only set state when necessary and keeps the logic clear:
    // - Bypass path: Apply ONLY provided window config early, reconcile when endpoint responds
    // - Default path: Wait for endpoint, apply reconciled config once
    //
    // Note: We only set values that are explicitly provided. Components
    // are designed to handle undefined config values gracefully.
    // The endpoint response will fill in any missing values during reconciliation.
    if (!isHostConfigBypassEnabled()) {
      return
    }

    // isHostConfigBypassEnabled() guarantees HOST_CONFIG exists and has valid
    // allowedOrigins (non-empty array) and useExternalAuthToken (boolean)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const hostConfig = StreamlitConfig.HOST_CONFIG!

    // Build AppConfig with only provided fields - don't set defaults
    // Required fields are guaranteed by isHostConfigBypassEnabled()
    const appConfig: AppConfig = includeIfDefined<AppConfig>({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      allowedOrigins: hostConfig.allowedOrigins!,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      useExternalAuthToken: hostConfig.useExternalAuthToken!,
      enableCustomParentMessages: hostConfig.enableCustomParentMessages,
      blockErrorDialogs: hostConfig.blockErrorDialogs,
    })

    // This can be called again later from onHostConfigResp during reconciliation.
    // HostCommunicationManager.openHostCommunication is intentionally idempotent,
    // so repeated setAllowedOrigins calls only update config values.
    this.hostCommunicationMgr.setAllowedOrigins(appConfig)
    this.setAppConfig(appConfig)

    // Build LibConfig with only provided fields
    // Note: Window config does not support deprecated setAnonymousCrossOriginPropertyOnMediaElements.
    // Use resourceCrossOriginMode instead. The deprecated field is only supported via endpoint.
    const libConfig: LibConfig = includeIfDefined<LibConfig>({
      mapboxToken: hostConfig.mapboxToken,
      disableFullscreenMode: hostConfig.disableFullscreenMode,
      enforceDownloadInNewTab: hostConfig.enforceDownloadInNewTab,
      resourceCrossOriginMode: hostConfig.resourceCrossOriginMode,
    })

    if (Object.keys(libConfig).length > 0) {
      this.setLibConfig(libConfig)
    }

    // Apply metrics config if provided
    if (hostConfig.metricsUrl !== undefined) {
      this.metricsMgr.setMetricsConfig(hostConfig.metricsUrl)
    }
  }

  initializeConnectionManager(): void {
    this.isInitializingConnectionManager = true

    this.applyInitialHostConfig()

    this.connectionManager = new ConnectionManager({
      getLastSessionId: () => this.sessionInfo.last?.sessionId,
      endpoints: this.endpoints,
      onMessage: this.handleMessage,
      onConnectionError: this.handleConnectionError,
      connectionStateChanged: this.handleConnectionStateChanged,
      claimHostAuthToken: this.hostCommunicationMgr.claimAuthToken,
      resetHostAuthToken: this.hostCommunicationMgr.resetAuthToken,
      sendClientError: (
        error: string | number,
        message: string,
        source: string
      ) => {
        this.hostCommunicationMgr.sendMessageToHost({
          type: "CLIENT_ERROR",
          component: "Websocket Connection",
          error,
          message,
          source,
        })
      },
      onHostConfigResp: (response: IHostConfigProperties) => {
        // Reconcile window config values with endpoint response.
        // All provided window config values take precedence over endpoint values:
        // AppConfig: allowedOrigins, useExternalAuthToken, enableCustomParentMessages, blockErrorDialogs
        // LibConfig: mapboxToken, disableFullscreenMode, enforceDownloadInNewTab, resourceCrossOriginMode
        // MetricsConfig: metricsUrl
        const reconciledConfig = reconcileHostConfigValues(
          StreamlitConfig.HOST_CONFIG,
          response
        )

        const {
          allowedOrigins,
          useExternalAuthToken,
          disableFullscreenMode,
          enableCustomParentMessages,
          mapboxToken,
          enforceDownloadInNewTab,
          metricsUrl,
          blockErrorDialogs,
          setAnonymousCrossOriginPropertyOnMediaElements,
          resourceCrossOriginMode,
        } = reconciledConfig

        const appConfig: AppConfig = {
          allowedOrigins,
          useExternalAuthToken,
          enableCustomParentMessages,
          blockErrorDialogs,
        }

        const libConfig: LibConfig = {
          mapboxToken,
          disableFullscreenMode,
          enforceDownloadInNewTab,
          // Use resourceCrossOriginMode if provided, otherwise fall back to
          // deprecated setAnonymousCrossOriginPropertyOnMediaElements (if true, use "anonymous")
          resourceCrossOriginMode:
            resourceCrossOriginMode ??
            (setAnonymousCrossOriginPropertyOnMediaElements
              ? "anonymous"
              : undefined),
        }

        // Set the metrics configuration:
        this.metricsMgr.setMetricsConfig(metricsUrl)
        // Set the allowed origins configuration for the host communication.
        // This is called even in bypass mode where applyInitialHostConfig may have
        // already called setAllowedOrigins. HostCommunicationManager handles this
        // safely by making openHostCommunication idempotent.
        this.hostCommunicationMgr.setAllowedOrigins(appConfig)
        // Set the streamlit-app specific config settings in AppContext:
        this.setAppConfig(appConfig)
        // Set the streamlit-lib specific config settings in LibConfigContext:
        this.setLibConfig(libConfig)
      },
    })

    this.isInitializingConnectionManager = false
  }

  override componentDidMount(): void {
    // Initialize connection manager here, to avoid
    // "Can't call setState on a component that is not yet mounted." error.
    this.initializeConnectionManager()

    mark(this.state.scriptRunState)
    this.hostCommunicationMgr.sendMessageToHost({
      type: "SCRIPT_RUN_STATE_CHANGED",
      scriptRunState: this.state.scriptRunState,
    })

    if (isScrollingHidden()) {
      document.body.classList.add("embedded")
    }

    // Iframe resizer allows parent pages to get the height of the iframe
    // contents. The parent page can then reset the height to match and
    // avoid unnecessary scrollbars or large embeddings
    if (isInChildFrame()) {
      window.iFrameResizer = {
        heightCalculationMethod: () => {
          const taggedEls = document.querySelectorAll("[data-iframe-height]")
          // Use ceil to avoid fractional pixels creating scrollbars.
          const lowestBounds = Array.from(taggedEls).map(el =>
            // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
            Math.ceil(el.getBoundingClientRect().bottom)
          )

          // The higher the value, the further down the page it is.
          // Use maximum value to get the lowest of all tagged elements.
          return Math.max(0, ...lowestBounds)
        },
      }

      // @ts-expect-error - iframe-resizer contentWindow path has no type declarations
      void import("iframe-resizer/js/iframeResizer.contentWindow")
    }

    this.hostCommunicationMgr.sendMessageToHost({
      type: "SET_THEME_CONFIG",
      themeInfo: toExportedTheme(this.props.theme.activeTheme.emotion),
    })

    this.metricsMgr.enqueue("viewReport")

    window.addEventListener("popstate", this.onHistoryChange, false)
  }

  override componentDidUpdate(
    _prevProps: Readonly<Props>,
    prevState: Readonly<State>
  ): void {
    // @ts-expect-error - prerenderReady flag is missing from Window
    if (window.prerenderReady === false && this.isAppInReadyState(prevState)) {
      // @ts-expect-error - prerenderReady flag is missing from Window
      window.prerenderReady = true
    }
    if (this.state.scriptRunState !== prevState.scriptRunState) {
      mark(this.state.scriptRunState)

      if (this.state.scriptRunState === ScriptRunState.NOT_RUNNING) {
        try {
          measure(
            "script-run-cycle",
            ScriptRunState.RUNNING,
            ScriptRunState.NOT_RUNNING
          )
        } catch {
          // It's okay if this fails, the `measure` call is for debugging/profiling
        }
        if (prevState.scriptRunState === ScriptRunState.RUNNING) {
          if (
            this.pageAutoRerunGuardFragmentId &&
            !this.pageAutoRerunGuardAcked &&
            this.pageAutoRerunGuardIdleSince === null
          ) {
            // Idle time starts now. A fragment request queued behind this run
            // is not stale just because the run itself was long.
            this.pageAutoRerunGuardIdleSince = Date.now()
          }
          // Send a page tick held during the run that just finished, unless that run
          // was interrupted and a replacement run is still pending.
          if (!this.pageAutoRerunAwaitingNextRun) {
            this.flushDeferredPageAutoRerun()
          }
        }
      }

      this.hostCommunicationMgr.sendMessageToHost({
        type: "SCRIPT_RUN_STATE_CHANGED",
        scriptRunState: this.state.scriptRunState,
      })
    }
  }

  override componentWillUnmount(): void {
    // Needing to disconnect our connection manager + websocket connection is
    // only needed here to handle the case in dev mode where react hot-reloads
    // the client as a result of a source code change. In this scenario, the
    // previous websocket connection is still connected, and the client and
    // server end up in a reconnect loop because the server rejects attempts to
    // connect to an already-connected session.
    //
    // This situation doesn't exist outside of dev mode because the whole App
    // unmounting is either a page refresh or the browser tab closing.
    //
    // The optional chaining on connectionManager is needed to make typescript
    // happy since connectionManager's type is `ConnectionManager | null`,
    // but at this point it should always be set.
    this.connectionManager?.disconnect()

    this.hostCommunicationMgr.closeHostCommunication()

    window.removeEventListener("popstate", this.onHistoryChange, false)
  }

  /**
   * Checks whether to show error dialog or send error info
   * to be handled by the host.
   */
  maybeShowErrorDialog(
    newDialog: WarningProps | ConnectionErrorProps | ScriptCompileErrorProps,
    errorMsg: string
  ): void {
    // Show dialog only if blockErrorDialogs host config is false
    const { blockErrorDialogs } = this.state.appConfig
    if (!blockErrorDialogs) {
      this.openDialog(newDialog)
    }

    const isScriptCompileError =
      newDialog.type === DialogType.SCRIPT_COMPILE_ERROR
    // script compile error has no title
    const error = isScriptCompileError ? newDialog.type : newDialog.title

    // Send error info to host via postMessage
    this.hostCommunicationMgr.sendMessageToHost({
      type: "CLIENT_ERROR_DIALOG",
      error,
      message: errorMsg,
    })
  }

  showError(
    title: string,
    errorDetails: ErrorDetails,
    dialogType:
      | DialogType.WARNING
      | DialogType.CONNECTION_ERROR = DialogType.WARNING
  ): void {
    LOG.error(errorDetails.message)

    const newDialog: WarningProps | ConnectionErrorProps = {
      type: dialogType,
      title,
      msg: (
        <DialogErrorMessage
          message={errorDetails.message}
          codeBlock={errorDetails.codeBlock}
        />
      ),
      onClose: () => {},
    }
    this.maybeShowErrorDialog(newDialog, errorDetails.message)
  }

  showDeployError = (
    title: string,
    errorNode: ReactNode,
    onContinue?: () => void
  ): void => {
    const newDialog: DialogProps = {
      type: DialogType.DEPLOY_ERROR,
      title,
      msg: errorNode,
      onContinue,
      onClose: () => {},
      onTryAgain: this.sendLoadGitInfoBackMsg,
    }
    this.openDialog(newDialog)
  }

  /**
   * Checks if the code version from the backend is different than the frontend
   */
  private hasStreamlitVersionChanged(initializeMsg: Initialize): boolean {
    let currentStreamlitVersion: string | undefined = undefined

    if (
      StreamlitConfig.ENABLE_RELOAD_BASED_ON_HARDCODED_STREAMLIT_VERSION ===
      true
    ) {
      currentStreamlitVersion = PACKAGE_METADATA.version
    } else if (this.sessionInfo.isSet) {
      currentStreamlitVersion = this.sessionInfo.current.streamlitVersion
    }

    if (currentStreamlitVersion) {
      const { environmentInfo } = initializeMsg

      if (
        notNullOrUndefined(environmentInfo) &&
        notNullOrUndefined(environmentInfo.streamlitVersion)
      ) {
        return currentStreamlitVersion !== environmentInfo.streamlitVersion
      }
    }

    return false
  }

  /**
   * Handles theme changes from host communication.
   */
  handleThemeMessage = (
    themeName?: PresetThemeName,
    theme?: CustomThemeConfig.$Properties
  ): void => {
    const [, lightTheme, darkTheme] = createPresetThemes()
    const isUsingPresetTheme = isPresetTheme(this.props.theme.activeTheme)

    if (themeName === lightTheme.name && isUsingPresetTheme) {
      this.props.theme.setTheme(lightTheme)
    } else if (themeName === darkTheme.name && isUsingPresetTheme) {
      this.props.theme.setTheme(darkTheme)
    } else if (theme) {
      this.props.theme.setImportedTheme(theme)
    }
  }
  /**
   * Called by ConnectionManager when our connection state changes
   */
  handleConnectionStateChanged = (newState: ConnectionState): void => {
    LOG.info(
      `Connection state changed from ${this.state.connectionState} to ${newState}`
    )

    if (newState === ConnectionState.CONNECTED) {
      LOG.info("Reconnected to server.")
      // Reset the connection error dismissed state when we reconnect
      if (this.state.connectionErrorDismissed) {
        this.setState({ connectionErrorDismissed: false })
      }

      // We request a script rerun if:
      //   1. this is the first time we establish a websocket connection to the
      //      server, or
      //   2. our last script run attempt was interrupted by the websocket
      //      connection dropping, or
      //   3. the host explicitly requested a reconnect (we trigger scriptRunState to be RERUN_REQUESTED)
      //   4. there is an indication that the script is using fragments (fragments in last run or auto-rerun),
      //      which might need a rerun to be reinitialized if a new app session got created.

      const lastRunWasInterrupted =
        this.state.scriptRunState === ScriptRunState.RUNNING
      const wasRerunRequested =
        this.state.scriptRunState === ScriptRunState.RERUN_REQUESTED

      if (
        !this.sessionInfo.last ||
        lastRunWasInterrupted ||
        wasRerunRequested ||
        // Script is using fragments (fragments in last run or
        // fragment auto-reruns configured):
        this.state.fragmentIdsThisRun.length > 0 ||
        this.autoRerunIntervals.size > 0 ||
        // A deferred page replay was queued and cleared the timer before the
        // server acknowledged it. Reconnect must rerun so the page can re-arm.
        // Do not also retry a widget rerun that cleared the page timer: that
        // message already consumed the trigger, and a second full rerun would
        // stop the in-flight click.
        this.pageAutoRerunReplayQueued
      ) {
        LOG.info("Requesting a script run.")
        this.widgetMgr.sendUpdateWidgetsMessage(undefined)
        this.setState({ dialog: null })
      } else if (this.state.dialog?.type === DialogType.CONNECTION_ERROR) {
        // Rescind the "Connection error" dialog if currently shown.
        this.setState({ dialog: null })
      }

      this.hostCommunicationMgr.sendMessageToHost({
        type: "WEBSOCKET_CONNECTED",
      })
    } else {
      // If we're starting from the CONNECTED state and going to any other
      // state, we must be disconnecting.
      if (this.state.connectionState === ConnectionState.CONNECTED) {
        this.hostCommunicationMgr.sendMessageToHost({
          type: "WEBSOCKET_DISCONNECTED",
          attemptingToReconnect:
            newState !== ConnectionState.DISCONNECTED_FOREVER,
        })
      }

      if (this.sessionInfo.isSet) {
        this.sessionInfo.disconnect()
      }

      // Clean up pending backend operation requests on disconnect
      this.backendOperationClient.cleanup()
    }

    if (this.isInitializingConnectionManager) {
      // If we use `flushSync` while the component is mounting, we will see a warning about
      // "Warning: flushSync was called from inside a lifecycle method."
      // The setState will be applied in the expected render cycle in this case.
      this.setState({ connectionState: newState })
    } else {
      /* eslint-disable-next-line @eslint-react/dom-no-flush-sync --
       * We are using `flushSync` here because there is code that expects every
       * state to be observed. With React batched updates, it is possible that
       * multiple `connectionState` changes are applied in 1 render cycle, leading
       * to the last state change being the only one observed. Utilizing
       * `flushSync` ensures that we apply every state change.
       */
      flushSync(() => {
        this.setState({ connectionState: newState })
      })
    }
  }

  handleGitInfoChanged = (gitInfo: GitInfo.$Properties): void => {
    this.setState({
      gitInfo,
    })
  }

  handleCustomParentMessage = (parentMessage: ParentMessage): void => {
    if (this.state.appConfig.enableCustomParentMessages) {
      this.hostCommunicationMgr.sendMessageToHost({
        type: "CUSTOM_PARENT_MESSAGE",
        message: parentMessage.message,
      })
    } else {
      LOG.error(
        "Sending messages to the host is disabled in line with the platform policy."
      )
    }
  }

  /**
   * Callback when we get a message from the server.
   */
  handleMessage = (msgProto: ForwardMsg): void => {
    // We don't have an immutableProto here, so we can't use
    // the dispatchOneOf helper

    const dispatchProto = (
      obj: ForwardMsg,
      name: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
      funcs: Record<string, (value: any) => void>
    ): void => {
      const whichOne = (obj as unknown as Record<string, unknown>)[
        name
      ] as string
      if (whichOne in funcs) {
        return funcs[whichOne](
          (obj as unknown as Record<string, unknown>)[whichOne]
        )
      }
      throw new Error(`Cannot handle ${name} "${whichOne}".`)
    }
    try {
      dispatchProto(msgProto, "type", {
        newSession: (newSessionMsg: NewSession) =>
          this.handleNewSession(newSessionMsg),
        sessionStatusChanged: (msg: SessionStatus) =>
          this.handleSessionStatusChanged(msg),
        sessionEvent: (evtMsg: SessionEvent) =>
          this.handleSessionEvent(evtMsg),
        delta: (deltaMsg: Delta) =>
          this.handleDeltaMsg(
            deltaMsg,
            msgProto.metadata as ForwardMsgMetadata,
            msgProto.hash
          ),
        pageConfigChanged: (pageConfig: PageConfig) =>
          this.handlePageConfigChanged(pageConfig),
        pageInfoChanged: (pageInfo: PageInfo) =>
          this.handlePageInfoChanged(pageInfo),
        pageNotFound: (pageNotFound: PageNotFound) =>
          this.handlePageNotFound(pageNotFound),
        gitInfoChanged: (gitInfo: GitInfo) =>
          this.handleGitInfoChanged(gitInfo),
        scriptFinished: (status: ForwardMsg.ScriptFinishedStatus) =>
          this.handleScriptFinished(status),
        pageProfile: (pageProfile: PageProfile) =>
          this.handlePageProfileMsg(pageProfile),
        autoRerun: (autoRerun: AutoRerun) => this.handleAutoRerun(autoRerun),
        stopAutoRerun: (stopAutoRerun: StopAutoRerun) =>
          this.handleStopAutoRerun(stopAutoRerun),
        fileUrlsResponse: (fileURLsResponse: FileURLsResponse) =>
          this.uploadClient.onFileURLsResponse(fileURLsResponse),
        parentMessage: (parentMessage: ParentMessage) =>
          this.handleCustomParentMessage(parentMessage),
        logo: (logo: Logo) =>
          this.handleLogo(logo, msgProto.metadata as ForwardMsgMetadata),
        navigation: (navigation: Navigation) =>
          this.handleNavigation(navigation),
        authRedirect: (authRedirect: AuthRedirect) => {
          if (isInChildFrame()) {
            this.hostCommunicationMgr.sendMessageToSameOriginHost({
              type: "REDIRECT_TO_URL",
              url: authRedirect.url,
            })
          } else {
            window.location.href = authRedirect.url
          }
        },
        heartbeatAck: () => this.handleHeartbeatAck(),
        backendOperationResponse: (response: BackendOperationResponse) =>
          this.backendOperationClient.onResponse(response),
      })
    } catch (e) {
      const err = ensureError(e)
      LOG.error(err)
      this.showError("Bad message format", { message: err.message })
    }
  }

  handleLogo = (logo: Logo, metadata: ForwardMsgMetadata): void => {
    this.setState(prevState => {
      return {
        elements: prevState.elements.appRootWithLogo(logo, {
          // Pass the current page & run ID for cleanup
          activeScriptHash: metadata.activeScriptHash,
          scriptRunId: prevState.scriptRunId,
        }),
      }
    })
  }

  handlePageConfigChanged = (pageConfig: PageConfig): void => {
    const {
      title,
      favicon,
      layout,
      initialSidebarState,
      initialSidebarWidth,
      menuItems,
    } = pageConfig

    this.appNavigation.handlePageConfigChanged(pageConfig)

    if (title) {
      this.hostCommunicationMgr.sendMessageToHost({
        type: "SET_PAGE_TITLE",
        title,
      })

      document.title = title
    }

    if (favicon) {
      this.onPageIconChanged(favicon)
    }

    // Only change layout/sidebar when the page config has changed.
    // This preserves the user's previous choice/default, and prevents extra re-renders.
    if (
      layout !== this.state.layout &&
      layout !== PageConfig.Layout.LAYOUT_UNSET
    ) {
      this.setState((prevState: State) => ({
        layout,
        userSettings: {
          ...prevState.userSettings,
          wideMode: layout === PageConfig.Layout.WIDE,
        },
      }))
    }

    if (
      initialSidebarState !== this.state.initialSidebarState &&
      initialSidebarState !== PageConfig.SidebarState.SIDEBAR_UNSET
    ) {
      this.setState(() => ({
        initialSidebarState,
      }))
    }

    // Extract pixelWidth from SidebarWidthConfig message
    const sidebarWidthPixels =
      initialSidebarWidth?.pixelWidth !== undefined
        ? initialSidebarWidth.pixelWidth
        : undefined

    if (
      notNullOrUndefined(sidebarWidthPixels) &&
      sidebarWidthPixels !== this.state.initialSidebarWidth
    ) {
      this.setState(() => ({
        initialSidebarWidth: sidebarWidthPixels,
      }))
    }

    // Check if menu items defined to prevent unnecessary state updates.
    if (menuItems) {
      // Now that we allow multiple set page config calls, menu items are additive
      // for behavior consistency with other page config properties.
      this.setState((prevState: State) => {
        if (menuItems.clearAboutMd) {
          menuItems.aboutSectionMd = ""
        }
        return {
          menuItems: { ...prevState.menuItems, ...menuItems },
        }
      })
    }
  }

  /** Update local query-param state and notify the host. */
  syncQueryParams = (queryString: string): void => {
    this.setState({ queryParams: queryString })

    this.hostCommunicationMgr.sendMessageToHost({
      type: "SET_QUERY_PARAM",
      queryParams: queryString ? `?${queryString}` : "",
    })
  }

  handlePageInfoChanged = (pageInfo: PageInfo): void => {
    const { queryString } = pageInfo
    const targetUrl =
      document.location.pathname + (queryString ? `?${queryString}` : "")
    const currentSearch = normalizeQueryString(document.location.search)

    // `pushState` always adds a history entry, even when the resulting URL is
    // identical, so reruns that re-assign the same query params would otherwise
    // fill the back stack with no-op entries. React state and the host message
    // below are still updated so embeds stay in sync.
    if (queryString !== currentSearch) {
      if (this.historyNavigationEpoch !== null) {
        // PageInfo can arrive in multiple messages during one history rerun.
        // replaceState keeps the address bar and host query params aligned
        // without polluting the back stack.
        window.history.replaceState({}, "", targetUrl)
      } else {
        window.history.pushState({}, "", targetUrl)
      }
    }

    this.setState({ queryParams: queryString })

    this.hostCommunicationMgr.sendMessageToHost({
      type: "SET_QUERY_PARAM",
      queryParams: queryString ? `?${queryString}` : "",
    })
  }

  onPageNotFound = (pageName?: string): void => {
    const errMsg = pageName
      ? `You have requested page /${pageName}, but no corresponding file was found in the app's pages/ directory`
      : "The page that you have requested does not seem to exist"
    this.showError("Page not found", {
      message: `${errMsg}. Running the app's main page.`,
    })
  }

  handlePageNotFound = (pageNotFound: PageNotFound): void => {
    const { pageName } = pageNotFound
    this.maybeSetState(this.appNavigation.handlePageNotFound(pageName))
  }

  onPageIconChanged = (iconUrl: string): void => {
    handleFavicon(
      iconUrl,
      this.hostCommunicationMgr.sendMessageToHost,
      this.endpoints
    )
  }

  handleNavigation = (navigation: Navigation): void => {
    this.setState({ navigationPosition: navigation.position })
    this.maybeSetState(this.appNavigation.handleNavigation(navigation))
  }

  handlePageProfileMsg = (pageProfile: PageProfile): void => {
    const pageProfileObj = PageProfile.toObject(pageProfile)
    const browserInfo = getBrowserInfo()

    this.metricsMgr.enqueue("pageProfile", {
      ...pageProfileObj,
      isFragmentRun: Boolean(pageProfileObj.isFragmentRun),
      numPages: this.state.appPages?.length,
      pageScriptHash: this.state.currentPageScriptHash,
      activeTheme: this.props.theme?.activeTheme?.name,
      totalLoadTime: Math.round(
        (performance.now() - this.state.latestRunTime) * 1000
      ),
      browserInfo,
    })
  }

  handleAutoRerun = (autoRerun: AutoRerun): void => {
    const { fragmentId, interval } = autoRerun
    const timerId = fragmentId || App.PAGE_AUTO_RERUN_ID

    // Re-registering the same interval must not restart the countdown.
    // Ancestor reruns would otherwise starve a fragment timer, and a fragment
    // tick that repeats the current page interval would reset that countdown.
    // Full reruns still restart the page timer: handleNewSession clears it
    // before this message arrives. A changed interval replaces the timer.
    if (this.autoRerunIntervals.get(timerId)?.interval === interval) {
      return
    }

    this.startAutoRerunTimer(timerId, interval, () => {
      // Page ticks are full reruns. Skip one while an st.dialog is open.
      // A tick during an active run is held until that run finishes on its
      // own. Stop and a user rerun clear it. An interrupted run delays it
      // until the replacement is known.
      if (!fragmentId) {
        // A callback queued before the page timer was cleared must not send.
        if (!this.autoRerunIntervals.has(App.PAGE_AUTO_RERUN_ID)) {
          return
        }
        if (
          isElementDialogOpen() ||
          this.state.scriptRunState === ScriptRunState.STOP_REQUESTED
        ) {
          return
        }
        if (this.pageAutoRerunAwaitingNextRun) {
          // A fragment request the server never starts must not stall the
          // page. One full interval of idle time releases the guard so a
          // later tick can run. This tick does not send: the server may
          // still acknowledge the fragment, and a full rerun here would
          // stop that run and drop its trigger. Time inside an active run
          // does not count.
          if (!this.isFragmentAutoRerunGuardStale()) {
            return
          }
          this.clearPageAutoRerunGuard()
          return
        }
        if (this.isScriptRunActive()) {
          this.pageAutoRerunDeferred = true
          return
        }
        // This tick is sent now, so a later finish must not send it again.
        this.pageAutoRerunDeferred = false
      }
      this.widgetMgr.sendUpdateWidgetsMessage(fragmentId || undefined, true)
    })
  }

  /**
   * Arm an auto-rerun timer, replacing any timer already stored for `id`.
   *
   * Intervals that fit in a signed 32-bit millisecond delay use `setInterval`.
   * Longer intervals are chained `setTimeout`s. Passing the raw delay to the
   * browser wraps it and can fire on every turn.
   */
  private startAutoRerunTimer(
    id: string,
    intervalSeconds: number,
    onTick: () => void,
    preserveDeferredPageTick = false
  ): void {
    this.clearAutoRerunInterval(id)
    // Replacing the page timer drops a held tick. Chaining the next cycle of
    // the same long interval must not, because that tick is still waiting for
    // the current run to finish. Do not clear pageAutoRerunAwaitingNextRun:
    // navigation clears the timer and then sets that guard, and an autoRerun
    // still in flight from the previous page must not drop it.
    if (id === App.PAGE_AUTO_RERUN_ID && !preserveDeferredPageTick) {
      this.pageAutoRerunDeferred = false
    }

    const intervalMs = intervalSeconds * 1000
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      return
    }

    if (id === App.PAGE_AUTO_RERUN_ID) {
      this.lastPageAutoRerunIntervalMs = intervalMs
      // The timer was already gone when the fragment request was sent, so the
      // guard has no interval yet. The one being armed is the window.
      if (
        this.pageAutoRerunGuardFragmentId &&
        !this.pageAutoRerunGuardAcked &&
        this.pageAutoRerunGuardIntervalMs <= 0
      ) {
        this.pageAutoRerunGuardIntervalMs = intervalMs
        if (!this.isScriptRunActive()) {
          this.pageAutoRerunGuardIdleSince = Date.now()
        }
      }
    }

    // A callback queued before clearInterval/clearTimeout can still run.
    // NewSession may clear this timer and arm another before that happens,
    // so identity — not map membership alone — decides.
    const generation = {}
    const guardedOnTick = (): void => {
      if (this.autoRerunIntervals.get(id)?.generation !== generation) {
        return
      }
      onTick()
    }

    if (intervalMs <= MAX_TIMER_DELAY_MS) {
      const timer = setInterval(guardedOnTick, intervalMs)
      this.autoRerunIntervals.set(id, {
        timer,
        interval: intervalSeconds,
        repeating: true,
        generation,
      })
      return
    }

    const cycleStartedAt = performance.now()
    const scheduleChunk = (): void => {
      const remaining = intervalMs - (performance.now() - cycleStartedAt)
      if (remaining <= 0) {
        guardedOnTick()
        this.startAutoRerunTimer(id, intervalSeconds, onTick, true)
        return
      }

      // eslint-disable-next-line no-restricted-globals -- Class-owned auto-rerun timers cannot use the useTimeout hook.
      const timer = setTimeout(
        () => {
          // The initial call below runs before this entry exists. Later chunks
          // must not reschedule after the timer was cleared or replaced.
          if (this.autoRerunIntervals.get(id)?.generation !== generation) {
            return
          }
          scheduleChunk()
        },
        Math.min(remaining, MAX_TIMER_DELAY_MS)
      )
      this.autoRerunIntervals.set(id, {
        timer,
        interval: intervalSeconds,
        repeating: false,
        generation,
      })
    }
    scheduleChunk()
  }

  /**
   * Handler for ForwardMsg.stopAutoRerun messages. The server sends this when
   * it evicts fragments (e.g. a nested ``run_every`` fragment whose ancestor
   * stopped rendering it), so we cancel their pending auto-rerun timers.
   */
  handleStopAutoRerun = (stopAutoRerun: StopAutoRerun): void => {
    stopAutoRerun.fragmentIds.forEach(fragmentId => {
      this.clearAutoRerunInterval(fragmentId)
      if (!fragmentId) {
        this.clearHeldPageAutoRerun()
      }
    })
  }

  /**
   * Handler for ForwardMsg.sessionStatusChanged messages
   * @param statusChangeProto a SessionStatus protobuf
   */
  handleSessionStatusChanged = (statusChangeProto: SessionStatus): void => {
    if (
      statusChangeProto.scriptIsRunning &&
      this.state.scriptRunState !== ScriptRunState.STOP_REQUESTED
    ) {
      // `scriptIsRunning` is not tied to the BackMsg that set the guard. A
      // fragment click can land before this status for an older full run.
      // Only an acknowledged fragment request, or a non-fragment guard, ends
      // here. A later finish may replay a tick that a fragment interrupt kept.
      if (!this.pageAutoRerunGuardFragmentId || this.pageAutoRerunGuardAcked) {
        this.clearPageAutoRerunGuard()
      } else {
        // This status belongs to an older run. Pause the idle clock so that
        // run's duration cannot expire the fragment request.
        this.pageAutoRerunGuardIdleSince = null
      }
    }

    this.setState((prevState: State) => {
      // Determine our new ScriptRunState
      let { scriptRunState } = prevState
      let { dialog } = prevState

      if (
        statusChangeProto.scriptIsRunning &&
        prevState.scriptRunState !== ScriptRunState.STOP_REQUESTED
      ) {
        // If the script is running, we change our ScriptRunState only
        // if we don't have a pending stop request
        scriptRunState = ScriptRunState.RUNNING

        // If the scriptCompileError dialog is open and the script starts
        // running, close it.
        if (
          notNullOrUndefined(dialog) &&
          dialog.type === DialogType.SCRIPT_COMPILE_ERROR
        ) {
          dialog = undefined
        }
      } else if (
        !statusChangeProto.scriptIsRunning &&
        prevState.scriptRunState !== ScriptRunState.RERUN_REQUESTED &&
        prevState.scriptRunState !== ScriptRunState.COMPILATION_ERROR
      ) {
        // If the script is not running, we change our ScriptRunState only
        // if we don't have a pending rerun request, and we don't have
        // a script compilation failure
        scriptRunState = ScriptRunState.NOT_RUNNING
      }

      return {
        userSettings: {
          ...prevState.userSettings,
          runOnSave: Boolean(statusChangeProto.runOnSave),
        },
        dialog,
        scriptRunState,
        // Reset scriptChangedOnDisk when script starts running
        scriptChangedOnDisk: statusChangeProto.scriptIsRunning
          ? false
          : prevState.scriptChangedOnDisk,
      }
    })
  }

  /**
   * Handler for ForwardMsg.sessionEvent messages
   * @param sessionEvent a SessionEvent protobuf
   */
  handleSessionEvent = (sessionEvent: SessionEvent): void => {
    this.sessionEventDispatcher.handleSessionEventMsg(sessionEvent)
    if (sessionEvent.type === "scriptCompilationException") {
      this.setState({ scriptRunState: ScriptRunState.COMPILATION_ERROR })
      const newDialog: DialogProps = {
        type: DialogType.SCRIPT_COMPILE_ERROR,
        exception: sessionEvent.scriptCompilationException,
        onClose: () => {},
      }
      this.maybeShowErrorDialog(
        newDialog,
        sessionEvent.scriptCompilationException?.message ?? "No message"
      )
    } else if (sessionEvent.type === "scriptChangedOnDisk") {
      this.setState({ scriptChangedOnDisk: true })
    }
  }

  /**
   * Updates the page url if the page has changed
   * @param mainPageName the name of the main page
   * @param newPageName the name of the new page
   * @param isViewingMainPage whether the user is viewing the main page
   */
  maybeUpdatePageUrl = (
    mainPageName: string,
    newPageName: string,
    isViewingMainPage: boolean
  ): void => {
    const baseUriParts = this.getBaseUriParts()

    if (baseUriParts) {
      let pathname
      if (StreamlitConfig.MAIN_PAGE_BASE_URL) {
        pathname = parseUriIntoBaseParts(
          StreamlitConfig.MAIN_PAGE_BASE_URL
        ).pathname
      } else {
        pathname = baseUriParts.pathname
      }

      const prevPageNameInPath = extractPageNameFromPathName(
        document.location.pathname,
        pathname
      )
      const prevPageName =
        prevPageNameInPath === "" ? mainPageName : prevPageNameInPath
      // It is important to compare `newPageName` with the previous one encoded in the URL
      // to handle new session runs triggered by URL changes through the `onHistoryChange()` callback,
      // e.g. the case where the user clicks the back button.
      // See https://github.com/streamlit/streamlit/pull/6271#issuecomment-1465090690 for the discussion.
      if (prevPageName !== newPageName) {
        const pagePath = isViewingMainPage ? "" : newPageName
        const queryString =
          this.state.queryParams || preserveEmbedQueryParams()
        const qs = queryString ? `?${queryString}` : ""

        const basePathPrefix = pathname === "/" ? "" : pathname

        const pageUrl = `${basePathPrefix}/${pagePath}${qs}`

        window.history.pushState({}, "", pageUrl)
      }
    }
  }

  maybeSetState(stateUpdate: MaybeStateUpdate): void {
    if (stateUpdate) {
      const [newState, callback] = stateUpdate

      this.setState(newState as State, callback)
    }
  }

  /**
   * Handler for ForwardMsg.newSession messages. This runs on each rerun
   * @param newSessionProto a NewSession protobuf
   */
  handleNewSession = (newSessionProto: NewSession): void => {
    const initialize = newSessionProto.initialize as Initialize

    if (this.hasStreamlitVersionChanged(initialize)) {
      window.location.reload()
      return
    }

    // Set this flag to indicate that we have received a NewSession message
    // after the latest rerun request:
    this.hasReceivedNewSession = true

    // NewSession is attributed to the latest BackMsg (rerunEpoch). Keep
    // history replaceState only when that BackMsg was history navigation;
    // otherwise end it so this run's PageInfo can pushState.
    if (this.historyNavigationEpoch !== this.rerunEpoch) {
      this.historyNavigationEpoch = null
    }

    // First, handle initialization logic. Each NewSession message has
    // initialization data. If this is the _first_ time we're receiving
    // the NewSession message (or the first time since disconnect), we
    // perform some one-time initialization.
    if (!this.sessionInfo.isSet || !this.sessionInfo.current.isConnected) {
      // We're not initialized (this is our first time, or we are reconnected)
      this.handleInitialization(newSessionProto)
    }

    const { appHash, currentPageScriptHash: prevPageScriptHash } = this.state
    const {
      scriptRunId,
      name: scriptName,
      mainScriptPath,
      fragmentIdsThisRun,
      pageScriptHash: newPageScriptHash,
      mainScriptHash,
    } = newSessionProto

    if (!fragmentIdsThisRun.length) {
      // This is a normal rerun, remove all the auto reruns intervals.
      // A fragment request sent before this full session arrived is still
      // waiting. Keep that guard so a page tick cannot replace it.
      const keepFragmentGuard =
        Boolean(this.pageAutoRerunGuardFragmentId) &&
        !this.pageAutoRerunGuardAcked &&
        this.pageAutoRerunGuardEpoch === this.rerunEpoch
      this.cleanupAutoReruns(keepFragmentGuard)

      const config = newSessionProto.config as Config
      const themeInput = newSessionProto.customTheme as CustomThemeConfig

      this.processThemeInput(themeInput)
      this.setState({
        allowRunOnSave: config.allowRunOnSave,
        hideTopBar: config.hideTopBar,
        toolbarMode: config.toolbarMode,
        showErrorLinks: config.showErrorLinks,
        disableDataExport: config.disableDataExport,
        latestRunTime: performance.now(),
        mainScriptHash,
        // If we're here, the fragmentIdsThisRun variable is always the
        // empty array.
        fragmentIdsThisRun,
      })
      this.maybeSetState(this.appNavigation.handleNewSession(newSessionProto))

      // Only set default favicon once per page load, and only if no custom icon has been set
      if (
        !this.appNavigation.hasSetDefaultFavicon &&
        !this.appNavigation.isPageIconSet
      ) {
        this.appNavigation.hasSetDefaultFavicon = true
        this.onPageIconChanged(`${import.meta.env.BASE_URL}favicon.png`)
      }
    } else {
      // Fragment reruns keep the page timer. A page tick held across the
      // interrupt is sent when this fragment run finishes. This NewSession
      // acknowledges a fragment request only when it names that fragment.
      if (
        this.pageAutoRerunGuardFragmentId &&
        fragmentIdsThisRun.includes(this.pageAutoRerunGuardFragmentId)
      ) {
        this.pageAutoRerunGuardAcked = true
      }
      this.setState({
        fragmentIdsThisRun,
        latestRunTime: performance.now(),
      })
    }

    const newSessionHash = hashString(
      this.sessionInfo.current.installationId + mainScriptPath
    )

    this.metricsMgr.setMetadata(this.state.deployedAppMetadata)
    this.metricsMgr.setAppHash(newSessionHash)

    this.metricsMgr.enqueue("updateReport")

    if (
      appHash === newSessionHash &&
      prevPageScriptHash === newPageScriptHash
    ) {
      this.setState(prevState => ({
        // Clear the transient nodes before executing everything else.
        elements: prevState.elements.clearTransientNodes(fragmentIdsThisRun),
        scriptRunId,
      }))
    } else {
      this.clearAppState(
        newSessionHash,
        scriptRunId,
        scriptName,
        mainScriptHash
      )
    }
  }

  /**
   * Performs initialization based on first connection and reconnection.
   * This is called from `handleNewSession`.
   */
  handleInitialization = (newSessionProto: NewSession): void => {
    const initialize = newSessionProto.initialize as Initialize
    const config = newSessionProto.config as Config

    this.sessionInfo.setCurrent(
      SessionInfo.propsFromNewSessionMessage(newSessionProto)
    )

    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
    this.metricsMgr.initialize({
      gatherUsageStats: config.gatherUsageStats,
      sendMessageToHost: this.hostCommunicationMgr.sendMessageToHost,
    })

    // Protobuf typing cannot handle complex types, so we need to cast to what
    // we know it should be
    this.handleSessionStatusChanged(initialize.sessionStatus as SessionStatus)

    // Show the framework "install skills" nudge when the server recommends it
    // (agent present, skills not installed, not headless, no server-side marker)
    // and we're on localhost, not embedded, not permanently dismissed, and not
    // snoozed. Require localStorage: it's where a snooze / "don't show again" is
    // remembered browser-side, so if it's unavailable we fail closed and skip
    // the nudge rather than show one the user can't make stick. Skip embedded
    // (?embed=true) apps: they're meant to be chromeless, so a CTA card pinned
    // over the host page's content is inappropriate (and the developer can't
    // act on it inside someone else's page anyway).
    // Store the server's recommendation so the in-error "install skills"
    // callout (a separate, non-dismissable surface) can gate on it every
    // render, independent of the one-shot toast-impression logic below.
    this.setState({
      recommendSkillsInstall: Boolean(initialize.recommendSkillsInstall),
    })

    if (
      initialize.recommendSkillsInstall &&
      isLocalhost() &&
      !isEmbed() &&
      localStorageAvailable() &&
      !isSkillsNudgeDismissed() &&
      !isSkillsNudgeSnoozed() &&
      // Don't re-raise the toast for an install this session already settled.
      // `skillsNudgeShown` below only stops a SECOND showing — a toast skipped
      // on first connect (snoozed) leaves it false, so a reconnect once the
      // snooze lapses would raise the toast even though the callout has since
      // installed, or tried and failed. Failure matters most: the errored
      // callout is exempt from the eligibility hide (an error report isn't a
      // transaction that finishes), so without this the toast would appear
      // beside it — offering the install that just failed, and breaking the
      // mutual exclusion the two surfaces otherwise keep.
      !this.state.skillsInstalledThisSession &&
      !this.state.skillsInstallFailedThisSession &&
      // `handleInitialization` re-runs on reconnect; show + log the impression
      // only once per page load so a reconnect can't enqueue a duplicate nudge
      // or inflate the funnel's numerator.
      !this.skillsNudgeShown
    ) {
      this.skillsNudgeShown = true
      this.setState({ showSkillsNudge: true })
      this.trackSkillsNudge("skillsNudgeShown", "toast")
    } else if (
      initialize.skillsNudgeSuppressedReason &&
      !this.skillsNudgeSuppressionReported &&
      !this.skillsNudgeShown
    ) {
      // The nudge was eligible server-side but the server withheld it — because
      // the browser isn't on a direct-loopback connection (Docker/VM/tunnel),
      // because a one-click install would only conflict, or because the
      // eligibility check itself failed. Record the reason once per page load so
      // suppression is measurable instead of silent, and so a reconnect can't
      // double-count it. Also skipped once the nudge HAS been shown, since the
      // funnel treats shown and suppressed as mutually exclusive per session.
      this.skillsNudgeSuppressionReported = true
      this.trackSkillsNudge(
        skillsNudgeSuppressedLabel(initialize.skillsNudgeSuppressedReason),
        "toast"
      )
    }
  }

  /**
   * Record a skills-nudge interaction for telemetry. Routed through the
   * existing ``menuClick`` event (like the deploy button), so it is only sent
   * when usage stats are enabled. ``surface`` attributes the event to the UI
   * that emitted it (the nudge ``toast`` vs the in-error ``errorCallout``) so
   * the shown → installed funnel can be sliced per surface.
   */
  private readonly trackSkillsNudge = (
    label: string,
    surface: "toast" | "errorCallout"
  ): void => {
    this.metricsMgr.enqueue("menuClick", { label, surface })
  }

  /** Install the bundled skills via a backend operation (no script rerun). */
  private readonly handleSkillsNudgeInstall = (
    surface: "toast" | "errorCallout"
  ): Promise<string | undefined> => {
    // Both surfaces can be on screen at once (the sticky callout slot lets them
    // transiently coexist), and each owns its own button. Hand a second clicker
    // the install already in flight rather than starting another: two concurrent
    // installs race on the same target tree, and the loser doesn't fail
    // cleanly — on the symlink path it falls back to a GLOBAL install into the
    // user's home dir that nobody asked for, and on the copy path it reports
    // "could not write" for skills that are in fact installed. No second
    // `skillsNudgeInstall` event either: it's one install, not two attempts.
    //
    // This covers one browser client. Two tabs still race, because the guard
    // that would have to stop that lives in the server's InstallSkillsHandler.
    //
    // `surface` is whoever STARTED the install, not whoever joined it, so a
    // joiner's click lands on the initiator's telemetry and confirmation. In the
    // one case that reaches this — callout starts, user then clicks the toast —
    // the toast is dismissed by the success below and the confirmation appears on
    // the callout. A slightly odd frame in an already-rare race; not worth
    // threading a second surface through for.
    if (this.inFlightSkillsInstall) {
      return this.inFlightSkillsInstall
    }
    this.trackSkillsNudge("skillsNudgeInstall", surface)
    const install = this.backendOperationClient
      .requestInstallSkills()
      .then(result => {
        // The server has re-detected the now-installed skills (it clears its
        // detection cache), so a later session won't recommend the nudge again
        // — no need to also write the permanent "don't show again" flag here,
        // which would conflate "installed" with a permanent opt-out. The card
        // shows its own success confirmation and auto-dismisses.
        this.trackSkillsNudge(
          skillsNudgeInstallSuccessLabel(result.fallbackReason),
          surface
        )
        // Within this session the server won't re-run detection, so suppress
        // any further install offer (notably the in-error callout, which can
        // recur on every error) now that skills are installed.
        this.setState(prevState => ({
          skillsInstalledThisSession: true,
          // An install from the in-error callout also clears the proactive
          // toast if it happens to be up — the two can transiently coexist via
          // the sticky callout slot — so it can't keep advertising an install
          // that just completed. A toast-surface install leaves showSkillsNudge
          // alone so the toast shows its own success confirmation before
          // self-dismissing via onClose.
          showSkillsNudge:
            surface === "errorCallout" ? false : prevState.showSkillsNudge,
        }))
        return result.detail ?? undefined
      })
      .catch((error: unknown) => {
        // A dropped or timed-out connection during a long install rejects the
        // request even though the server install may have completed. Count it
        // separately — not as a failure, which would over-count the funnel —
        // and surface a reassuring, retry-friendly message; re-install is
        // idempotent.
        if (isSkillsNudgeDroppedConnection(error)) {
          this.trackSkillsNudge("skillsNudgeInstallDropped", surface)
          throw new Error(SKILLS_NUDGE_DROPPED_MESSAGE)
        }
        // Append the server's machine-readable reason as a label suffix, and
        // count a safety-gate refusal under its own event rather than as a
        // failure. See skillsNudgeInstallFailureLabel.
        this.trackSkillsNudge(skillsNudgeInstallFailureLabel(error), surface)
        // Stop offering the install on NEW callouts for the rest of the session.
        // A failure here is a property of the machine (a blocked target, a
        // read-only dir), not of this error, so every later error would offer the
        // same doomed install — a fresh red box each time, none of them
        // dismissable. The callout already showing keeps its Retry, since a
        // non-idle callout ignores this gate. Deliberately NOT set for a dropped
        // connection above: that one really is worth retrying.
        this.setState({ skillsInstallFailedThisSession: true })
        // Re-throw so the card / callout renders its error state.
        throw error
      })
      // Clear the slot whatever the outcome, so a later Retry (or a genuinely
      // new install after a dropped connection) isn't handed a settled promise.
      .finally(() => {
        this.inFlightSkillsInstall = null
      })
    this.inFlightSkillsInstall = install
    return install
  }

  /** Toast's Install button — installs and tags telemetry with the toast surface. */
  private readonly handleToastInstall = (): Promise<string | undefined> => {
    return this.handleSkillsNudgeInstall("toast")
  }

  /**
   * In-error callout's Install button — installs and tags telemetry with the
   * errorCallout surface. Stable reference so the SkillsInstallContext value
   * doesn't change every render.
   */
  private readonly handleErrorCalloutInstall = (): Promise<
    string | undefined
  > => {
    return this.handleSkillsNudgeInstall("errorCallout")
  }

  /** Record the in-error callout's impression (tagged with the errorCallout surface). */
  private readonly handleErrorCalloutShown = (): void => {
    // Once per page load (see `errorCalloutShown`) so reruns that remount the
    // error box don't re-log the impression.
    if (this.errorCalloutShown) {
      return
    }
    this.errorCalloutShown = true
    this.trackSkillsNudge("skillsNudgeShown", "errorCallout")
  }

  /** Close (✕): snooze the nudge for ~24h. The card removes itself via onClose. */
  private readonly handleSkillsNudgeSnooze = (): void => {
    setSkillsNudgeSnoozed()
    this.trackSkillsNudge("skillsNudgeSnoozed", "toast")
  }

  /**
   * "Don't show again": dismiss permanently by writing both the browser
   * localStorage flag and the server-side marker, so it won't show again from
   * either signal. The card removes itself via onClose.
   */
  private readonly handleSkillsNudgeDontShowAgain = (): void => {
    setSkillsNudgeDismissed()
    // Best-effort durable suppression: the localStorage flag already suppresses
    // the nudge in this browser, so a failed marker write only means a fresh
    // browser could see it again — log it rather than failing the dismissal.
    this.backendOperationClient
      .requestDismissSkillsNudge()
      .catch((error: unknown) => {
        LOG.warn("Failed to persist skills nudge dismissal", error)
      })
    this.trackSkillsNudge("skillsNudgeDontShowAgain", "toast")
  }

  /**
   * Remove the nudge from view. Called by the nudge card after a snooze /
   * "Don't show again" and by its post-install auto-dismiss. Only toggles
   * visibility; the persistence (localStorage / server marker) is handled by
   * the snooze / don't-show-again / install handlers.
   */
  private readonly handleSkillsNudgeClose = (): void => {
    this.setState({ showSkillsNudge: false })
  }

  /**
   * Handler called when the history state changes, e.g. `popstate` event.
   */
  onHistoryChange = (): void => {
    const { currentPageScriptHash, queryParams } = this.state
    const targetAppPage = this.appNavigation.findPageByUrlPath(
      document.location.pathname
    )

    // Before Navigation metadata arrives, findPageByUrlPath returns null.
    // Fall back to the current page hash so query-only back/forward still reruns
    // instead of being ignored as unknown-page navigation.
    const pageScriptHash =
      targetAppPage?.pageScriptHash ?? currentPageScriptHash
    if (!pageScriptHash) {
      return
    }

    const hasAnchor = document.location.toString().includes("#")
    const isSamePage =
      isNullOrUndefined(targetAppPage) ||
      targetAppPage.pageScriptHash === currentPageScriptHash
    const queryString = normalizeQueryString(document.location.search)
    const stateQueryString = normalizeQueryString(queryParams)

    // Do not rerun for anchor-only navigation on the same page.
    if (hasAnchor && isSamePage && queryString === stateQueryString) {
      return
    }

    // After popstate the URL is the source of truth. Pass its query string
    // explicitly to onPageChange because syncQueryParams' setState has not
    // flushed yet, and preserve it across page changes.
    this.syncQueryParams(queryString)
    const preserveQueryParams = true
    const isHistoryNavigation = true
    this.onPageChange(
      pageScriptHash,
      queryString,
      preserveQueryParams,
      isHistoryNavigation
    )
  }

  /**
   * Both sets the given theme locally and sends it to the host.
   */
  setAndSendTheme = (themeConfig: ThemeConfig): void => {
    this.props.theme.setTheme(themeConfig)
    this.hostCommunicationMgr.sendMessageToHost({
      type: "SET_THEME_CONFIG",
      themeInfo: toExportedTheme(themeConfig.emotion),
    })
  }

  createThemeHash = (themeInput?: CustomThemeConfig): string => {
    if (!themeInput) {
      // If themeInput is null, then we didn't receive a custom theme for this
      // app from the server. We use a hardcoded string literal for the
      // themeHash in this case.
      return "hash_for_undefined_custom_theme"
    }

    // Convert to JSON and back to get a plain JS object without protobuf methods/metadata.
    // JSON.stringify automatically filters out functions and non-enumerable properties.
    // This ensures we hash only the actual theme data, not the protobuf object structure.
    const plainObject = JSON.parse(JSON.stringify(themeInput))

    // Recursively sort all keys (including nested objects like sidebar, light, dark)
    // to ensure consistent hashing regardless of key order
    const sorted = sortThemeInputKeys(plainObject)

    // Hash the sorted representation
    return hashString(JSON.stringify(sorted))
  }

  processThemeInput(themeInput: CustomThemeConfig): void {
    const themeHash = this.createThemeHash(themeInput)
    if (themeHash === this.state.themeHash) {
      return
    }
    this.setState({ themeHash })

    const usingCustomTheme = !isPresetTheme(this.props.theme.activeTheme)
    if (themeInput) {
      // createCustomThemes can return either 1 theme ("Custom Theme")
      // or 3 themes ("Custom Theme Light", "Custom Theme Dark", and "Custom Theme Auto")
      const customThemes = createCustomThemes(themeInput)

      // Add the new custom themes to the theme manager and remove the preset themes
      this.props.theme.addThemes(customThemes, { keepPresetThemes: false })

      const mappedTheme = getPreferredTheme(customThemes)
      if (mappedTheme) {
        // User has a mappable preference - apply the full server config
        // while preserving their light/dark selection
        this.setAndSendTheme(mappedTheme)
      } else {
        // No mappable preference - set to default custom theme
        // This handles cases where:
        // - No user preference exists (userPreference === null)
        // - User has a preset theme cached but custom themes are now available
        // - User has an old custom theme that no longer matches
        if (customThemes.length > 1) {
          // When Custom Theme Light & Custom Theme Dark present, we create an auto theme based
          // on the system preference and set this as the active theme
          const autoThemeIndex = customThemes.findIndex(
            theme => theme.name === CUSTOM_THEME_AUTO_NAME
          )
          this.setAndSendTheme(customThemes[autoThemeIndex])
        } else {
          // Set to singular Custom Theme
          this.setAndSendTheme(customThemes[0])
        }
      }
    } else {
      // Remove the custom theme menu option.
      this.props.theme.addThemes([])

      if (usingCustomTheme) {
        const presetThemes = [lightTheme, darkTheme]
        const mappedTheme = getPreferredTheme(presetThemes)

        if (mappedTheme) {
          // User had a custom theme preference that maps to a preset - preserve their choice
          this.setAndSendTheme(mappedTheme)
        } else {
          // Reset to the auto theme
          this.setAndSendTheme(createAutoTheme())
        }
      }
    }

    if (
      (themeInput?.fontFaces && themeInput.fontFaces.length > 0) ||
      (themeInput?.fontSources && themeInput.fontSources.length > 0)
    ) {
      // If font faces or font sources are provided, we need to set the imported
      // theme with the theme manager to make the fonts available.
      this.props.theme.setFonts(themeInput)
    }
  }

  /**
   * Handler for ForwardMsg.scriptFinished messages
   * @param status the ScriptFinishedStatus that the script finished with
   */
  handleScriptFinished(status: ForwardMsg.ScriptFinishedStatus): void {
    // An interrupted run is replaced by another execution. The server reports
    // that stop before the next NewSession. Skip the idle gap so a held page
    // tick is not sent there. A full NewSession drops the tick; a fragment
    // replacement keeps it until that run finishes.
    if (status === ForwardMsg.ScriptFinishedStatus.FINISHED_EARLY_FOR_RERUN) {
      this.pageAutoRerunAwaitingNextRun = true
      // This status does not say whether the replacement is a full rerun or a
      // fragment. The next NewSession or scriptIsRunning resolves the guard.
      this.pageAutoRerunGuardFragmentId = undefined
      this.pageAutoRerunGuardAcked = false
    }

    // Bump a monotonic counter and snapshot the fragment IDs of the run that
    // just finished, so widgets (e.g. ChatInput) can react to the completion of
    // the specific full-script or fragment run they triggered. This runs before
    // the status-conditional handling below on purpose: the counter must bump
    // for every finish status (including FINISHED_WITH_COMPILE_ERROR) so widgets
    // re-enable even when a run ends with a compilation error.
    this.setState(prevState => ({
      scriptRunFinishedSequence: prevState.scriptRunFinishedSequence + 1,
      scriptRunFinishedFragmentIds: prevState.fragmentIdsThisRun,
    }))

    // Clear history replaceState only on a real finish for the latest
    // requested run. An interrupt (FINISHED_EARLY_FOR_RERUN) from an older
    // history run must not drop the flag for a newer history request that is
    // still pending.
    if (
      this.hasReceivedNewSession &&
      status !== ForwardMsg.ScriptFinishedStatus.FINISHED_EARLY_FOR_RERUN
    ) {
      this.historyNavigationEpoch = null
    }

    if (
      status === ForwardMsg.ScriptFinishedStatus.FINISHED_SUCCESSFULLY ||
      status === ForwardMsg.ScriptFinishedStatus.FINISHED_EARLY_FOR_RERUN ||
      status ===
        ForwardMsg.ScriptFinishedStatus.FINISHED_FRAGMENT_RUN_SUCCESSFULLY
    ) {
      // Notify subscribers on the next microtask so this finish handler can
      // return before widgets react to the completion of this run. Isolate
      // handler failures so one throw does not skip later handlers or surface
      // as an uncaught error.
      queueMicrotask(() => {
        this.state.scriptFinishedHandlers.forEach(handler => {
          try {
            handler()
          } catch (error) {
            LOG.error("Script finished handler failed", error)
          }
        })
      })

      if (
        status === ForwardMsg.ScriptFinishedStatus.FINISHED_SUCCESSFULLY ||
        status ===
          ForwardMsg.ScriptFinishedStatus.FINISHED_FRAGMENT_RUN_SUCCESSFULLY
      ) {
        // Clear any stale elements left over from the previous run.
        // We only do that for completed runs, not for runs that were finished early
        // due to reruns; this is to avoid flickering of elements where they disappear for
        // a moment and then are readded by a new session. After the new session finished,
        // leftover elements will be cleared after finished successfully.
        // We also don't do this if our script had a compilation error and didn't
        // finish successfully.
        this.setState(
          ({ scriptRunId, fragmentIdsThisRun, elements }) => {
            return {
              // Apply any pending elements that haven't been applied.
              elements: elements.clearStaleNodes(
                scriptRunId,
                fragmentIdsThisRun
              ),
            }
          },
          () => {
            this.removeInactiveWidgetState()
          }
        )
      }

      // Tell the ConnectionManager to increment the message cache run
      // count. This will result in expired ForwardMsgs being removed from
      // the cache. We expect the sessionInfo to be populated at this point,
      // but we have observed race conditions tied to a rerun occurring
      // before a NewSession message is processed. This issue should not
      // disrupt users and is not a critical need for the message cache
      if (
        this.connectionManager !== null &&
        status !== ForwardMsg.ScriptFinishedStatus.FINISHED_EARLY_FOR_RERUN &&
        this.sessionInfo.isSet &&
        // We only increment the message cache run count if we have received
        // a NewSession message after the latest rerun request. This is done
        // to ignore finished messages from previous script runs, which would
        // cause issues with deleting cached messages that are needed for the
        // current script run.
        this.hasReceivedNewSession
      ) {
        this.connectionManager.incrementMessageCacheRunCount(
          this.sessionInfo.current.maxCachedMessageAge,
          this.state.fragmentIdsThisRun
        )
      }
    }
  }

  /*
   * Clear all elements from the state.
   */
  clearAppState(
    appHash: string,
    scriptRunId: string,
    scriptName: string,
    mainScriptHash: string
  ): void {
    this.setState(
      prevState => {
        const nextElements = this.appNavigation.clearPageElements(
          prevState.elements,
          mainScriptHash
        )

        return {
          scriptRunId,
          scriptName,
          appHash,
          elements: nextElements,
        }
      },
      () => {
        this.removeInactiveWidgetState()
      }
    )
  }

  /**
   * Remove widget and element state for items no longer present in the
   * current render tree. Called from setState callbacks where this.state
   * access is a false positive (the callback runs after the update is
   * committed). Converting App to a functional component would let us
   * use useEffect and remove this suppress entirely.
   */
  private removeInactiveWidgetState(): void {
    const { elements, blockIds } = this.state.elements.getActiveIds()
    const activeIds = new Set([
      ...Array.from(elements)
        .map(element => getElementId(element))
        .filter(notUndefined),
      ...blockIds,
    ])
    this.widgetMgr.removeInactive(activeIds)
  }

  /**
   * Opens a dialog with the specified state.
   */
  openDialog(dialogProps: DialogProps): void {
    this.setState({ dialog: dialogProps })
  }

  /**
   * Closes the upload dialog if it's open.
   */
  closeDialog = (): void => {
    // If we're closing a connection error dialog, mark it as dismissed
    if (this.state.dialog?.type === DialogType.CONNECTION_ERROR) {
      this.setState({
        dialog: undefined,
        connectionErrorDismissed: true,
      })
    } else {
      this.setState({ dialog: undefined })
    }
  }

  /**
   * Saves a UserSettings object.
   */
  saveSettings = (newSettings: UserSettings): void => {
    const { runOnSave: prevRunOnSave } = this.state.userSettings
    const { runOnSave } = newSettings

    this.setState({ userSettings: newSettings })

    if (prevRunOnSave !== runOnSave && this.isServerConnected()) {
      const backMsg = new BackMsg({ setRunOnSave: runOnSave })
      backMsg.type = "setRunOnSave"
      this.sendBackMsg(backMsg)
    }
  }

  handleRunOnSaveChange = (newRunOnSave: boolean): void => {
    this.saveSettings({
      ...this.state.userSettings,
      runOnSave: newRunOnSave,
    })
  }

  /**
   * Update pendingElementsBuffer with the given Delta and set up a timer to
   * update state.elements. This buffer allows us to process Deltas quickly
   * without spamming React with too many of render() calls.
   */
  handleDeltaMsg = (
    deltaMsg: Delta,
    metadataMsg: ForwardMsgMetadata,
    elementHash?: string
  ): void => {
    // Use functional state update to ensure we have latest elements
    this.setState(prevState => ({
      elements: prevState.elements.applyDelta(
        prevState.scriptRunId,
        deltaMsg,
        metadataMsg,
        elementHash
      ),
    }))
  }

  /**
   * Test-only method used by e2e tests to test disabling widgets.
   */
  debugShutdownRuntime = (): void => {
    if (this.isServerConnected()) {
      const backMsg = new BackMsg({ debugShutdownRuntime: true })
      backMsg.type = "debugShutdownRuntime"
      this.sendBackMsg(backMsg)
    }
  }

  /**
   * Test-only method used by e2e tests to test reconnect behavior.
   */
  debugDisconnectWebsocket = (): void => {
    if (this.isServerConnected()) {
      const backMsg = new BackMsg({ debugDisconnectWebsocket: true })
      backMsg.type = "debugDisconnectWebsocket"
      this.sendBackMsg(backMsg)
    }
  }

  /**
   * Test-only method used by e2e tests to test fetching cached ForwardMsgs
   * from the server.
   */
  debugClearForwardMsgCache = (): void => {
    if (!isLocalhost()) {
      return
    }

    // It's not a problem that we're mucking around with private fields since
    // this is a test-only method anyway.
    // @ts-expect-error - test-only access to the private websocket message cache
    this.connectionManager?.websocketConnection?.cache.messages.clear()
  }

  /**
   * Clear all auto reruns that were registered. This should be called whenever
   * the content of the auto rerun function might not be valid anymore and could
   * lead to issues, e.g. when a new full app-rerun session is started or the active page changed.
   */
  cleanupAutoReruns = (keepFragmentGuard = false): void => {
    this.autoRerunIntervals.forEach(entry => {
      this.clearStoredAutoRerunTimer(entry)
    })
    this.autoRerunIntervals.clear()
    if (keepFragmentGuard) {
      this.pageAutoRerunDeferred = false
    } else {
      this.clearHeldPageAutoRerun()
    }
  }

  /**
   * Clear the auto-rerun interval for a single fragment, if one exists.
   */
  private clearAutoRerunInterval(fragmentId: string): void {
    const existing = this.autoRerunIntervals.get(fragmentId)
    if (existing !== undefined) {
      this.clearStoredAutoRerunTimer(existing)
      this.autoRerunIntervals.delete(fragmentId)
    }
  }

  private isScriptRunActive(): boolean {
    return (
      this.state.scriptRunState === ScriptRunState.RUNNING ||
      this.state.scriptRunState === ScriptRunState.RERUN_REQUESTED
    )
  }

  /**
   * Drop a held page tick and forget that a run is awaiting acknowledgement.
   * The page timer itself stays armed.
   */
  private clearHeldPageAutoRerun(): void {
    this.pageAutoRerunDeferred = false
    this.clearPageAutoRerunGuard()
  }

  private markPageAutoRerunPending(fragmentId?: string): void {
    const intervalSeconds = this.autoRerunIntervals.get(
      App.PAGE_AUTO_RERUN_ID
    )?.interval
    this.pageAutoRerunAwaitingNextRun = true
    this.pageAutoRerunGuardEpoch = this.rerunEpoch
    this.pageAutoRerunGuardFragmentId = fragmentId
    this.pageAutoRerunGuardAcked = false
    this.pageAutoRerunGuardIntervalMs =
      intervalSeconds !== undefined
        ? intervalSeconds * 1000
        : this.lastPageAutoRerunIntervalMs
    this.pageAutoRerunGuardIdleSince = this.isScriptRunActive()
      ? null
      : Date.now()
  }

  private clearPageAutoRerunGuard(): void {
    this.pageAutoRerunAwaitingNextRun = false
    this.pageAutoRerunGuardEpoch = null
    this.pageAutoRerunGuardFragmentId = undefined
    this.pageAutoRerunGuardAcked = false
    this.pageAutoRerunGuardIntervalMs = 0
    this.pageAutoRerunGuardIdleSince = null
    this.pageAutoRerunReplayQueued = false
  }

  private isFragmentAutoRerunGuardStale(): boolean {
    if (
      !this.pageAutoRerunGuardFragmentId ||
      this.pageAutoRerunGuardAcked ||
      this.pageAutoRerunGuardIntervalMs <= 0 ||
      this.isScriptRunActive() ||
      this.pageAutoRerunGuardIdleSince === null
    ) {
      return false
    }
    return (
      Date.now() - this.pageAutoRerunGuardIdleSince >=
      this.pageAutoRerunGuardIntervalMs
    )
  }

  /**
   * Send one page tick that was skipped while a script run was active.
   * Stop, a non-auto full rerun, and clearing the page timer drop it.
   * The idle gap after an interrupted run does not call this.
   */
  private flushDeferredPageAutoRerun(): void {
    if (!this.pageAutoRerunDeferred) {
      return
    }
    if (
      isElementDialogOpen() ||
      !this.autoRerunIntervals.has(App.PAGE_AUTO_RERUN_ID)
    ) {
      this.pageAutoRerunDeferred = false
      return
    }
    // A fragment request is still unacknowledged. Replaying a full tick here
    // would replace it and drop the widget trigger already sent.
    if (this.pageAutoRerunGuardFragmentId && !this.pageAutoRerunGuardAcked) {
      return
    }
    const queued = this.widgetMgr.sendUpdateWidgetsMessage(undefined, true)
    if (!queued) {
      // The websocket was already gone. Leave the timer and the held tick so
      // reconnect can retry. Do not record a pending run that was never sent.
      return
    }
    this.pageAutoRerunDeferred = false
    // The message is queued. Suspend the page timer so the interval cannot
    // send a second full rerun before the server reports this one. Remember
    // the replay itself so a reconnect can retry it without retrying every
    // widget click.
    this.pageAutoRerunReplayQueued = true
    this.clearAutoRerunInterval(App.PAGE_AUTO_RERUN_ID)
  }

  private clearStoredAutoRerunTimer(entry: {
    timer: ReturnType<typeof setInterval>
    repeating: boolean
  }): void {
    if (entry.repeating) {
      clearInterval(entry.timer)
      return
    }
    clearTimeout(entry.timer)
  }

  /**
   * Reruns the script.
   *
   * @param alwaysRunOnSave a boolean. If true, UserSettings.runOnSave
   * will be set to true, which will result in a request to the Server
   * to enable runOnSave for this session.
   */
  rerunScript = (alwaysRunOnSave = false): void => {
    this.closeDialog()

    if (!this.isServerConnected()) {
      LOG.error("Cannot rerun script when disconnected from server.")
      return
    }

    if (
      this.state.scriptRunState === ScriptRunState.RUNNING ||
      this.state.scriptRunState === ScriptRunState.RERUN_REQUESTED
    ) {
      // Don't queue up multiple rerunScript requests
      return
    }

    this.setState({ scriptRunState: ScriptRunState.RERUN_REQUESTED })

    // Note: `rerunScript` is incorrectly called in some places.
    // We can remove `=== true` after adding type information
    if (alwaysRunOnSave === true) {
      // Update our run-on-save setting *before* calling rerunScript.
      // The rerunScript message currently blocks all BackMsgs from
      // being processed until the script has completed executing.
      this.saveSettings({ ...this.state.userSettings, runOnSave: true })
    }

    // Trigger a full app rerun:
    this.widgetMgr.sendUpdateWidgetsMessage(undefined)
  }

  sendLoadGitInfoBackMsg = (): void => {
    if (!this.isServerConnected()) {
      LOG.error("Cannot load git information when disconnected from server.")
      return
    }

    this.sendBackMsg(
      new BackMsg({
        loadGitInfo: true,
      })
    )
  }

  onPageChange = (
    pageScriptHash: string,
    queryString?: string,
    preserveQueryParams?: boolean,
    isHistoryNavigation?: boolean
  ): void => {
    const { elements, mainScriptHash } = this.state

    // We are about to change the page, so clear all auto reruns
    // This also happens in handleNewSession, but it might be too late compared
    // to small interval values, which might trigger a rerun before the new
    // session message is processed
    this.cleanupAutoReruns()

    // We want to keep widget states for widgets that are still active
    // from the common script
    const nextPageElements = this.appNavigation.clearPageElements(
      elements,
      mainScriptHash
    )
    const activeWidgetIds = new Set(
      Array.from(nextPageElements.getElements())
        .map(element => getElementId(element))
        .filter(notUndefined)
    )

    this.sendRerunBackMsg(
      this.widgetMgr.getActiveWidgetStates(activeWidgetIds),
      undefined,
      pageScriptHash,
      undefined,
      queryString,
      preserveQueryParams,
      isHistoryNavigation
    )
  }

  isAppInReadyState = (prevState: Readonly<State>): boolean => {
    return (
      this.state.connectionState === ConnectionState.CONNECTED &&
      this.state.scriptRunState === ScriptRunState.NOT_RUNNING &&
      prevState.scriptRunState === ScriptRunState.RUNNING &&
      prevState.connectionState === ConnectionState.CONNECTED
    )
  }

  sendRerunBackMsg = (
    widgetStates?: WidgetStates,
    fragmentId?: string,
    pageScriptHash?: string,
    isAutoRerun?: boolean,
    queryStringOverride?: string,
    preserveQueryParams?: boolean,
    isHistoryNavigation?: boolean
  ): boolean => {
    const baseUriParts = this.getBaseUriParts()
    if (!baseUriParts) {
      // If we don't have a connectionManager or if it doesn't have an active
      // websocket connection to the server (in which case
      // connectionManager.getBaseUriParts() returns undefined), we can't send a
      // rerun backMessage so just return early.
      LOG.error("Cannot send rerun backMessage when disconnected from server.")
      return false
    }

    const { currentPageScriptHash } = this.state
    let queryString = queryStringOverride ?? this.getQueryString()
    let pageName = ""

    const contextInfo = {
      timezone: getTimezone(),
      timezoneOffset: getTimezoneOffset(),
      locale: getLocaleLanguage(),
      url: getUrl(),
      isEmbedded: isEmbed(),
      colorScheme: this.getThemeColorScheme(),
    }

    if (pageScriptHash) {
      // The user specified exactly which page to run. We can simply use this
      // value in the BackMsg we send to the server.
      if (pageScriptHash !== currentPageScriptHash && !preserveQueryParams) {
        // When switching pages, preserve only embed params and widget-bound params.
        // All other params (like ?foo=bar) should be cleared.
        const filteredParams = this.widgetMgr.filterParamsForPageChange(
          preserveEmbedQueryParams()
        )
        queryString = getQueryString(queryStringOverride, filteredParams)
        this.setState({ queryParams: queryString })
        this.hostCommunicationMgr.sendMessageToHost({
          type: "SET_QUERY_PARAM",
          queryParams: queryString ? `?${queryString}` : "",
        })
      }
    } else if (currentPageScriptHash) {
      // The user didn't specify which page to run, which happens when they
      // click the "Rerun" button in the main menu. In this case, we
      // rerun the current page.
      pageScriptHash = currentPageScriptHash
    } else {
      let pathname
      if (StreamlitConfig.MAIN_PAGE_BASE_URL) {
        pathname = parseUriIntoBaseParts(
          StreamlitConfig.MAIN_PAGE_BASE_URL
        ).pathname
      } else {
        pathname = baseUriParts.pathname
      }

      // We must be in the case where the user is navigating directly to a
      // non-main page of this app. Since we haven't received the list of the
      // app's pages from the server at this point, we fall back to requesting
      // the page to run via pageName, which we extract from
      // document.location.pathname.
      pageName = extractPageNameFromPathName(
        document.location.pathname,
        pathname
      )
      pageScriptHash = ""
    }

    const cachedMessageHashes =
      this.connectionManager?.getCachedMessageHashes() ?? []

    this.rerunEpoch += 1
    if (isHistoryNavigation) {
      this.historyNavigationEpoch = this.rerunEpoch
    } else if (
      isAutoRerun &&
      // Only re-stick while a history BackMsg is still awaiting NewSession
      // (backend pending coalesce). Do not re-stick after the history run's
      // NewSession (a later auto-rerun is a separate interrupt) or after a
      // superseding widget BackMsg (epoch gap — last-wins already dropped the
      // history bit on the backend).
      !this.hasReceivedNewSession &&
      this.historyNavigationEpoch === this.rerunEpoch - 1
    ) {
      this.historyNavigationEpoch = this.rerunEpoch
    }

    // scriptRunState stays idle until the server reports the new run. Record
    // that a run is pending so a page tick in that gap cannot preempt this
    // request. A user full rerun also suspends the page timer until the next
    // run re-arms it. A fragment rerun keeps the countdown and any held tick,
    // because set_page_config outside the fragment does not run again. A page
    // auto-rerun leaves the timer armed; a deferred replay clears it after
    // this message is queued.
    if (fragmentId || isAutoRerun) {
      this.markPageAutoRerunPending(fragmentId || undefined)
    } else {
      this.clearAutoRerunInterval(App.PAGE_AUTO_RERUN_ID)
      this.clearHeldPageAutoRerun()
      this.markPageAutoRerunPending()
    }

    this.sendBackMsg(
      new BackMsg({
        rerunScript: {
          queryString,
          widgetStates,
          pageScriptHash,
          pageName,
          fragmentId,
          isAutoRerun,
          isHistoryNavigation,
          cachedMessageHashes,
          contextInfo,
        },
      })
    )
    // Reset hasReceivedNewSession to false to ensure that we are aware
    // if a finished message is from a previous script run.
    this.hasReceivedNewSession = false
    return true
  }

  /** Requests that the server stop running the script */
  stopScript = (): void => {
    if (!this.isServerConnected()) {
      LOG.error("Cannot stop app when disconnected from server.")
      return
    }

    if (
      this.state.scriptRunState === ScriptRunState.NOT_RUNNING ||
      this.state.scriptRunState === ScriptRunState.STOP_REQUESTED
    ) {
      // Don't queue up multiple stopScript requests
      return
    }

    const backMsg = new BackMsg({ stopScript: true })
    backMsg.type = "stopScript"
    this.sendBackMsg(backMsg)
    // Drop a tick held during this run. The timer stays armed for the next interval.
    this.clearHeldPageAutoRerun()
    this.setState({ scriptRunState: ScriptRunState.STOP_REQUESTED })
  }

  /**
   * Shows a dialog asking the user to confirm they want to clear the cache
   */
  openClearCacheDialog = (): void => {
    if (this.isServerConnected()) {
      const newDialog: DialogProps = {
        type: DialogType.CLEAR_CACHE,
        confirmCallback: this.clearCache,
        onClose: () => {},
      }
      this.openDialog(newDialog)
    } else {
      LOG.error("Cannot clear cache: disconnected from server")
    }
  }

  /**
   * Shows a dialog with Deployment instructions
   */
  openDeployDialog = (): void => {
    const deployDialogProps: DialogProps = {
      type: DialogType.DEPLOY_DIALOG,
      onClose: this.closeDialog,
      showDeployError: this.showDeployError,
      isDeployErrorModalOpen:
        this.state.dialog?.type === DialogType.DEPLOY_ERROR,
      metricsMgr: this.metricsMgr,
      gitInfo: this.state.gitInfo,
    }
    this.openDialog(deployDialogProps)
  }

  /**
   * Asks the server to clear st.cache_data and st.cache_resource caches.
   */
  clearCache = (): void => {
    this.closeDialog()
    if (this.isServerConnected()) {
      const backMsg = new BackMsg({ clearCache: true })
      backMsg.type = "clearCache"
      this.sendBackMsg(backMsg)
    } else {
      LOG.error("Cannot clear cache: disconnected from server")
    }
  }

  /**
   * Sends an app heartbeat message through the websocket.
   * @param ackTimeoutMilliseconds - If non-zero, starts a timeout expecting a
   *   heartbeat_ack from the server within the specified milliseconds. If the
   *   ack is not received in time, the frontend will attempt to reconnect.
   *   This allows hosts to opt-in to connection health monitoring and configure
   *   the timeout.
   */
  sendAppHeartbeat = (ackTimeoutMilliseconds: number): void => {
    if (this.isServerConnected()) {
      const backMsg = new BackMsg({ appHeartbeat: true })
      backMsg.type = "appHeartbeat"
      this.sendBackMsg(backMsg)
      this.connectionManager?.onHeartbeatSent(ackTimeoutMilliseconds)
    } else {
      LOG.error("Cannot send app heartbeat: disconnected from server")
    }
  }

  /**
   * Handles heartbeat acknowledgment from the server.
   * This confirms the connection is healthy.
   */
  handleHeartbeatAck = (): void => {
    this.connectionManager?.onHeartbeatAckReceived()
  }

  /**
   * Sends a message back to the server.
   */
  private readonly sendBackMsg = (msg: BackMsg): void => {
    if (this.connectionManager) {
      LOG.info(msg)
      this.connectionManager.sendMessage(msg)
    } else {
      LOG.error(
        `Not connected. Cannot send back message: ${msg.type ?? "unknown"}`
      )
    }
  }

  /**
   * Updates the app body when there's a connection error.
   */
  handleConnectionError = (errDetails: ErrorDetails): void => {
    // Don't show the error dialog if it has been dismissed for this session
    if (this.state.connectionErrorDismissed) {
      return
    }

    // This is just a regular error dialog, but with type CONNECTION_ERROR
    // instead of WARNING, so we can rescind the dialog later when reconnected.
    this.showError("Connection error", errDetails, DialogType.CONNECTION_ERROR)
  }

  /**
   * Indicates whether we're connected to the server.
   */
  isServerConnected = (): boolean => {
    return this.connectionManager
      ? this.connectionManager.isConnected()
      : false
  }

  aboutCallback = (): void => {
    const { menuItems } = this.state
    const newDialog: DialogProps = {
      type: DialogType.ABOUT,
      onClose: this.closeDialog,
      aboutSectionMd: menuItems?.aboutSectionMd,
    }
    this.openDialog(newDialog)
  }

  /**
   * Prints the app, if the app is in IFrame
   * it prints the content of the IFrame.
   * Before printing this function ensures the app has fully loaded,
   * by checking if we're in ScriptRunState.NOT_RUNNING state.
   */
  printCallback = (): void => {
    const { scriptRunState } = this.state
    if (scriptRunState !== ScriptRunState.NOT_RUNNING) {
      // eslint-disable-next-line no-restricted-globals -- Class component callback polling cannot use React hooks.
      setTimeout(this.printCallback, 500)
      return
    }
    let windowToPrint
    try {
      const htmlIFrameElement = getIFrameEnclosingApp(this.embeddingId)
      if (htmlIFrameElement?.contentWindow) {
        windowToPrint = htmlIFrameElement.contentWindow.window
      } else {
        windowToPrint = window
      }
    } catch {
      windowToPrint = window
    } finally {
      if (!windowToPrint) windowToPrint = window
      windowToPrint.print()
    }
  }

  screencastCallback = (): void => {
    const { scriptName } = this.state
    const { startRecording } = this.props.screenCast
    const date = getScreencastTimestamp()

    startRecording(`streamlit-${scriptName}-${date}`)
  }

  handleFullScreen = (isFullScreen: boolean): void => {
    this.setState({ isFullScreen })
  }

  /**
   * Set streamlit-lib specific configurations.
   */
  setLibConfig = (libConfig: LibConfig): void => {
    this.setState({ libConfig })
  }

  /**
   * Set streamlit-app specific configurations.
   */
  setAppConfig = (appConfig: AppConfig): void => {
    this.setState({ appConfig })
  }

  addScriptFinishedHandler = (func: () => void): void => {
    this.setState((prevState, _) => {
      return {
        scriptFinishedHandlers: prevState.scriptFinishedHandlers.concat(func),
      }
    })
  }

  removeScriptFinishedHandler = (func: () => void): void => {
    this.setState((prevState, _) => {
      return {
        scriptFinishedHandlers: prevState.scriptFinishedHandlers.filter(
          h => h !== func
        ),
      }
    })
  }

  getBaseUriParts = (): URL | undefined =>
    this.connectionManager
      ? this.connectionManager.getBaseUriParts()
      : undefined

  getQueryString = (): string => {
    const { queryParams } = this.state

    const queryString =
      queryParams && queryParams.length > 0
        ? queryParams
        : document.location.search

    return normalizeQueryString(queryString)
  }

  getThemeColorScheme = (): string => {
    const { activeTheme } = this.props.theme

    if (hasLightBackgroundColor(activeTheme.emotion)) {
      return "light"
    }
    return "dark"
  }

  showDeployButton = (): boolean => {
    return (
      isLocalhost() &&
      showDevelopmentOptions(this.state.isOwner, this.state.toolbarMode) &&
      this.sessionInfo.isSet &&
      !this.sessionInfo.isHello
    )
  }

  deployButtonClicked = (): void => {
    this.metricsMgr.enqueue("menuClick", {
      label: "deployButtonInApp",
    })
    this.sendLoadGitInfoBackMsg()
    this.openDeployDialog()
  }

  requestFileURLs = (requestId: string, files: File[]): void => {
    const isConnected = this.isServerConnected()
    const isSessionInfoSet = this.sessionInfo.isSet
    if (isConnected && isSessionInfoSet) {
      const backMsg = new BackMsg({
        fileUrlsRequest: {
          requestId,
          fileNames: files.map(f => f.name),
          sessionId: this.sessionInfo.current.sessionId,
        },
      })
      backMsg.type = "fileUrlsRequest"
      this.sendBackMsg(backMsg)
    } else {
      // Reject the request immediately with an error. This can happen on mobile
      // browsers when the file picker is open for an extended period causing
      // the WebSocket connection to time out.
      //
      // We can't queue and retry because reconnection triggers a script rerun,
      // which remounts the FileUploader component and invalidates the promise
      // callback. The user needs to re-select the file after reconnection.
      LOG.warn(
        `Cannot request file URLs (isServerConnected: ${isConnected}, isSessionInfoSet: ${isSessionInfoSet})`
      )
      this.uploadClient.onFileURLsResponse({
        responseId: requestId,
        errorMsg:
          "Connection lost. Please wait for the app to reconnect, then try again.",
      })
    }
  }

  handleKeyDown = (keyName: string, keyboardEvent?: KeyboardEvent): void => {
    // See `isKeyboardEventFromEditableTarget` for editable/shadow DOM behavior.
    // We never fire global single-letter shortcuts while the user is typing.
    if (
      (keyName === "c" || keyName === "r") &&
      isKeyboardEventFromEditableTarget(keyboardEvent)
    ) {
      return
    }

    switch (keyName) {
      case "c":
        // CLEAR CACHE
        if (
          showDevelopmentOptions(this.state.isOwner, this.state.toolbarMode)
        ) {
          this.openClearCacheDialog()
        }
        break
      case "r":
        // RERUN
        this.rerunScript()
        break
    }
  }

  handleKeyUp = (keyName: string): void => {
    if (keyName === "esc") {
      this.props.screenCast.stopRecording()
    }
  }

  /**
   * Checks if there are any app-defined menu items configured via st.set_page_config
   */
  private readonly hasAppDefinedMenuItems = (): boolean => {
    const { menuItems } = this.state
    return Boolean(
      menuItems?.aboutSectionMd ||
      (menuItems?.getHelpUrl && !menuItems?.hideGetHelp) ||
      (menuItems?.reportABugUrl && !menuItems?.hideReportABug)
    )
  }

  /**
   * Determines whether the toolbar should be visible based on embed mode,
   * toolbar mode settings, and availability of host menu/toolbar items.
   */
  private readonly shouldShowToolbar = (
    hostMenuItems: IMenuItem[],
    hostToolbarItems: IToolbarItem[]
  ): boolean => {
    // Show toolbar if not embedded or if specifically configured to display in embed mode
    const isToolbarAllowedInEmbed = !isEmbed() || isToolbarDisplayed()

    // Determine if toolbar has content to show based on toolbar mode
    let hasContentToShow: boolean
    if (this.state.toolbarMode === Config.ToolbarMode.MINIMAL) {
      // In minimal mode, only show toolbar if there are menu items to display
      hasContentToShow =
        hostMenuItems.length > 0 ||
        hostToolbarItems.length > 0 ||
        this.hasAppDefinedMenuItems()
    } else {
      // In non-minimal modes, always show the toolbar
      hasContentToShow = true
    }

    return isToolbarAllowedInEmbed && hasContentToShow
  }

  override render(): JSX.Element {
    const {
      allowRunOnSave,
      connectionState,
      dialog,
      elements,
      initialSidebarState,
      menuItems,
      isFullScreen,
      scriptRunId,
      scriptRunState,
      userSettings,
      hideTopBar,
      hideSidebarNav,
      expandSidebarNav,
      sidebarNavVisibleItems,
      currentPageScriptHash,
      hostHideSidebarNav,
      pageLinkBaseUrl,
      sidebarChevronDownshift,
      hostMenuItems,
      hostToolbarItems,
      libConfig,
      inputsDisabled,
      appPages,
      navSections,
      navigationPosition,
      scriptChangedOnDisk,
    } = this.state

    // Always use sidebar navigation on mobile, regardless of the server setting
    const effectiveNavigationPosition = this.props.isMobileViewport
      ? Navigation.Position.SIDEBAR
      : navigationPosition

    const developmentMode = showDevelopmentOptions(
      this.state.isOwner,
      this.state.toolbarMode
    )

    const outerDivClass = [
      "stApp",
      getEmbeddingIdClassName(this.embeddingId),
      isEmbed() && "streamlit-embedded",
      userSettings.wideMode && "streamlit-wide",
    ]
      .filter(Boolean)
      .join(" ")

    const renderedDialog: React.ReactNode = dialog
      ? StreamlitDialog({
          ...dialog,
          onClose: this.closeDialog,
        })
      : null

    // Determine toolbar visibility using helper method
    const showToolbar = this.shouldShowToolbar(hostMenuItems, hostToolbarItems)
    const showPadding = !isEmbed() || isPaddingDisplayed()
    const disableScrolling = isScrollingHidden()

    return (
      <StreamlitContextProvider
        initialSidebarState={initialSidebarState}
        initialSidebarWidth={this.state.initialSidebarWidth}
        appRootRef={this.appRootRef}
        pageLinkBaseUrl={pageLinkBaseUrl}
        currentPageScriptHash={currentPageScriptHash}
        onPageChange={this.onPageChange}
        navSections={navSections}
        appPages={appPages}
        appLogo={elements.logo}
        sidebarChevronDownshift={sidebarChevronDownshift}
        expandSidebarNav={expandSidebarNav}
        sidebarNavVisibleItems={sidebarNavVisibleItems}
        hideSidebarNav={
          hideSidebarNav ||
          hostHideSidebarNav ||
          effectiveNavigationPosition === Navigation.Position.TOP
        }
        isFullScreen={isFullScreen}
        setFullScreen={this.handleFullScreen}
        activeTheme={this.props.theme.activeTheme}
        setTheme={this.setAndSendTheme}
        availableThemes={this.props.theme.availableThemes}
        fragmentIdsThisRun={this.state.fragmentIdsThisRun}
        scriptRunFinishedSequence={this.state.scriptRunFinishedSequence}
        scriptRunFinishedFragmentIds={this.state.scriptRunFinishedFragmentIds}
        locale={window.navigator.language}
        formsData={this.state.formsData}
        scriptRunState={scriptRunState}
        scriptRunId={scriptRunId}
        stopScript={this.stopScript}
        // LibConfig properties
        mapboxToken={libConfig.mapboxToken}
        enforceDownloadInNewTab={libConfig.enforceDownloadInNewTab}
        resourceCrossOriginMode={libConfig.resourceCrossOriginMode}
        showErrorLinks={this.state.showErrorLinks}
        disableDataExport={this.state.disableDataExport}
        backendOperationClient={this.backendOperationClient}
        // In-error "install skills" callout. Gated on the server's
        // recommendation plus localhost/embed (consistent with the exception
        // box's own AI-links gate), not-yet-installed-this-session, and not
        // permanently dismissed. `localStorageAvailable()` matches the toast's
        // fail-closed behavior: without storage we can't remember a dismissal,
        // so don't offer something the user can't make stick.
        //
        // Mutually exclusive with the proactive nudge toast (`!showSkillsNudge`):
        // the two never show at once. The 24h snooze is intentionally NOT checked
        // here — once the toast is snoozed/closed (`showSkillsNudge` flips false),
        // an error is a higher-intent moment than a snoozed proactive nudge, so
        // the callout may then appear. A permanent "don't show again" (or an
        // install) from either surface suppresses both.
        skillsInstallEnabled={
          this.state.recommendSkillsInstall &&
          this.skillsCalloutEnvEligible &&
          !this.state.skillsInstalledThisSession &&
          !this.state.skillsInstallFailedThisSession &&
          !isSkillsNudgeDismissed() &&
          !this.state.showSkillsNudge
        }
        onInstallSkills={this.handleErrorCalloutInstall}
        onSkillsCalloutShown={this.handleErrorCalloutShown}
      >
        <GlobalHotkeys
          keyName="r,c,esc"
          onKeyDown={this.handleKeyDown}
          onKeyUp={this.handleKeyUp}
        >
          <StyledApp
            ref={this.appRootRef}
            className={outerDivClass}
            data-testid="stApp"
            data-test-script-state={
              scriptRunId === INITIAL_SCRIPT_RUN_ID
                ? "initial"
                : scriptRunState
            }
            data-test-connection-state={connectionState}
          >
            <AppView
              endpoints={this.endpoints}
              sendMessageToHost={this.hostCommunicationMgr.sendMessageToHost}
              elements={elements}
              widgetMgr={this.widgetMgr}
              uploadClient={this.uploadClient}
              navigationPosition={effectiveNavigationPosition}
              wideMode={userSettings.wideMode}
              embedded={isEmbed()}
              showPadding={showPadding}
              disableScrolling={disableScrolling}
              addScriptFinishedHandler={this.addScriptFinishedHandler}
              removeScriptFinishedHandler={this.removeScriptFinishedHandler}
              widgetsDisabled={
                inputsDisabled || connectionState !== ConnectionState.CONNECTED
              }
              showToolbar={showToolbar}
              disableFullscreenMode={libConfig.disableFullscreenMode}
              componentRegistry={this.componentRegistry}
              skillsNudge={
                this.state.showSkillsNudge ? (
                  <SkillsNudgeToast
                    onInstall={this.handleToastInstall}
                    onSnooze={this.handleSkillsNudgeSnooze}
                    onDontShowAgain={this.handleSkillsNudgeDontShowAgain}
                    onClose={this.handleSkillsNudgeClose}
                  />
                ) : undefined
              }
              topRightContent={
                <>
                  {!hideTopBar && (
                    <StatusWidget
                      connectionState={connectionState}
                      scriptRunState={scriptRunState}
                      rerunScript={this.rerunScript}
                      stopScript={this.stopScript}
                      allowRunOnSave={allowRunOnSave}
                      showScriptChangedActions={scriptChangedOnDisk}
                    />
                  )}
                  {!hideTopBar && (
                    <ToolbarActions
                      hostToolbarItems={hostToolbarItems}
                      sendMessageToHost={
                        this.hostCommunicationMgr.sendMessageToHost
                      }
                      metricsMgr={this.metricsMgr}
                    />
                  )}
                  {this.showDeployButton() && !scriptChangedOnDisk && (
                    <DeployButton onClick={this.deployButtonClicked} />
                  )}
                  {!hideTopBar && (
                    <MainMenu
                      isServerConnected={this.isServerConnected()}
                      quickRerunCallback={this.rerunScript}
                      clearCacheCallback={this.openClearCacheDialog}
                      aboutCallback={this.aboutCallback}
                      printCallback={this.printCallback}
                      screencastCallback={this.screencastCallback}
                      screenCastState={this.props.screenCast.currentState}
                      hostMenuItems={hostMenuItems}
                      developmentMode={developmentMode}
                      sendMessageToHost={
                        this.hostCommunicationMgr.sendMessageToHost
                      }
                      menuItems={menuItems}
                      metricsMgr={this.metricsMgr}
                      toolbarMode={this.state.toolbarMode}
                      runOnSave={this.state.userSettings.runOnSave}
                      onRunOnSaveChange={this.handleRunOnSaveChange}
                      allowRunOnSave={allowRunOnSave && developmentMode}
                      streamlitVersion={
                        this.sessionInfo.isSet
                          ? this.sessionInfo.current.streamlitVersion
                          : undefined
                      }
                    />
                  )}
                </>
              }
            />
            {renderedDialog}
          </StyledApp>
        </GlobalHotkeys>
      </StreamlitContextProvider>
    )
  }
}

const AppWithScreenCast = withScreencast(App)

// Wrapper component to handle viewport size
const AppWrapper: React.FC<
  Omit<Props, "isMobileViewport" | "screenCast">
> = props => {
  const { isMobile } = useViewportSize()
  return <AppWithScreenCast {...props} isMobileViewport={isMobile} />
}

export default AppWrapper
