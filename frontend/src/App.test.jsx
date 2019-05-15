/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'

it('renders without crashing', () => {
  const mountPoint = document.createElement('div')
  mountPoint.setAttribute('id', 'ConnectionStatus')
  document.body.appendChild(mountPoint)
  ReactDOM.render(<App />, mountPoint)
  ReactDOM.unmountComponentAtNode(mountPoint)
})
