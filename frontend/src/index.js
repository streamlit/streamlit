/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import React from 'react';
import ReactDOM from 'react-dom';

import './theme.scss';

import StreamlitApp from './StreamlitApp';

// Disabling this magic for now because we want
// to test without caching on the production build:
/* import registerServiceWorker from './registerServiceWorker'; */

ReactDOM.render(<StreamlitApp />, document.getElementById('root'));

// Disabling this magic for now because we want
// to test without caching on the production build:
/* registerServiceWorker(); */
