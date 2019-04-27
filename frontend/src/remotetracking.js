/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 *
 */

import {
  INSTALLATION_ID,
  IS_DEV_ENV,
  STREAMLIT_VERSION,
  BROWSER_IP_ADDRESS,
} from './baseconsts';
import { logAlways } from './log';

/**
 * Whether we should track usage remotely, for stats.
 * Defaults to true. See also lib/streamlit/config.py.
 */
let trackUsage = null;

/**
 * Queue of tracking events we tried sending before initRemoteTracker was
 * called.
 */
const preInitializationEventQueue = [];

/**
 * Params:
 *   gatherUsageStats: a boolean. If true, we'll track usage remotely.
 *   streamlitVersion: string.
 */
export function initRemoteTracker({gatherUsageStats, streamlitVersion}) {
  if (gatherUsageStats != null) { trackUsage = gatherUsageStats; }

  if (trackUsage) {
    window.mixpanel.identify(INSTALLATION_ID);
    window.mixpanel.opt_in_tracking();
  } else {
    window.mixpanel.opt_out_tracking();
  }

  logAlways('Track stats remotely: ', trackUsage);

  preInitializationEventQueue.forEach(([eventName, opts]) => {
    trackEventRemotely(eventName, opts);
  });
}

/**
 * Params:
 *   eventName: the event name as a string.
 *   opts: other stuff to track.
 */
export function trackEventRemotely(eventName, opts = {}) {
  if (trackUsage == null) {
    preInitializationEventQueue.push([eventName, opts]);
    return;
  }

  const data = {
    ...opts,
    browserIpAddress: BROWSER_IP_ADDRESS,
    dev: IS_DEV_ENV,
    source: 'browser',
    streamlitVersion: STREAMLIT_VERSION,
  };

  if (IS_DEV_ENV) {
    logAlways(
      `${trackUsage ? '' : 'NOT '}Tracking stat datapoint: `,
      eventName, data);
  }

  if (trackUsage === false) { return; }
  if (!window.mixpanel) { return; }

  window.mixpanel.track(eventName, data);
}
