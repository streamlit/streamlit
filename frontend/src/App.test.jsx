/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import ReactDOM from 'react-dom'
import { SessionInfo } from './lib/SessionInfo'
import { MetricsManager } from './lib/MetricsManager'
import { getMetricsManagerForTest } from './lib/MetricsManagerTestUtils'
import App from './App'


beforeEach(() => {
  SessionInfo.current = new SessionInfo({
    streamlitVersion: 'sv',
    installationId: 'iid',
    authorEmail: 'ae',
  })
  MetricsManager.current = getMetricsManagerForTest()
})


afterEach(() => {
  SessionInfo['singleton'] = null
})


it('renders without crashing', () => {
  const mountPoint = document.createElement('div')
  mountPoint.setAttribute('id', 'ConnectionStatus')
  document.body.appendChild(mountPoint)
  ReactDOM.render(<App />, mountPoint)
  ReactDOM.unmountComponentAtNode(mountPoint)
})
