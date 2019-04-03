/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import App from './StreamlitApp';

it('renders without crashing', () => {
  const div = document.createElement('div');
  div.setAttribute('id', 'ConnectionStatus');
  document.body.appendChild(div);
  ReactDOM.render(<App />, div);
});
