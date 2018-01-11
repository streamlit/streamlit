import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import WebClient from './WebClient';
import registerServiceWorker from './registerServiceWorker';

ReactDOM.render(<WebClient />, document.getElementById('root'));
registerServiceWorker();
