/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 *
 */

import { IS_DEV_ENV } from './baseconsts';

/**
 * Whether we should track usage remotely, for stats.
 * Defaults to true. See also lib/streamlit/config.py.
 */
let trackUsage = true;

/**
 * Params:
 *   gatherUsageStats: a boolean. If true, we'll track usage remotely.
 */
export function initRemoteTracker({gatherUsageStats}) {
  if (gatherUsageStats != null) trackUsage = gatherUsageStats;

  if (trackUsage) {
    window.mixpanel.opt_in_tracking();
  } else {
    window.mixpanel.opt_out_tracking();
  }

  console.log('Track stats remotely: ', trackUsage);
}

/**
 * Params:
 *   eventName: the event name as a string.
 *   opts: other stuff to track.
 */
export function trackEventRemotely(eventName, opts = {}) {
  if (!trackUsage) return;
  if (!window.mixpanel) return;

  // Print to console, for transparency.
  console.log('Tracking stat datapoint: ', eventName, opts);

  window.mixpanel.track(eventName, {
    ...opts,
    source: 'browser',
    dev: IS_DEV_ENV,
  });
}
