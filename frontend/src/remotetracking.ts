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

import {logAlways} from './log';
import mixpanel, {Dict} from 'mixpanel-browser';

/** Our Mixpanel Token */
const TOKEN = '77c8dd3e3266a6133f74207d7924bab4';
mixpanel.init(TOKEN);

/**
 * Whether we should track usage remotely, for stats.
 * Defaults to true. See also lib/streamlit/config.py.
 */
let trackUsage: boolean | undefined;

/**
 * Queue of tracking events we tried sending before initRemoteTracker was
 * called.
 */
type Event = [string, Dict];
const preInitializationEventQueue: Event[] = [];

/**
 * Params:
 *   gatherUsageStats: a boolean. If true, we'll track usage remotely.
 */
export function initRemoteTracker({gatherUsageStats}: {gatherUsageStats?: boolean}): void {
  if (gatherUsageStats != null) {
    trackUsage = gatherUsageStats;
  }

  if (trackUsage) {
    mixpanel.identify(INSTALLATION_ID);
    mixpanel.opt_in_tracking();
  } else {
    mixpanel.opt_out_tracking();
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
export function trackEventRemotely(eventName: string, opts: Dict = {}): void {
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

  if (trackUsage !== false) {
    mixpanel.track(eventName, data);
  }
}
