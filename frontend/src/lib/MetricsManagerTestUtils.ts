/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import { MetricsManager } from './MetricsManager'
import jest from 'jest-mock'


export function getMetricsManagerForTest(): MetricsManager {
  const mm = new MetricsManager()
  mm['track'] = jest.fn()
  mm['identify'] = jest.fn()
  return mm
}
