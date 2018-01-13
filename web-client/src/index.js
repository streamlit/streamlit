import React from 'react';
import ReactDOM from 'react-dom';

import 'bootstrap/dist/css/bootstrap.css';
import './index.css';

import WebClient from './WebClient';

// Disabling this magic for now because we want
// to test without caching on the production build:
/* import registerServiceWorker from './registerServiceWorker'; */

ReactDOM.render(<WebClient />, document.getElementById('root'));

// Disabling this magic for now because we want
// to test without caching on the production build:
/* registerServiceWorker(); */


// Start playing around with websockets here...
const wsUri = "ws://echo.websocket.org/";
let websocket = new WebSocket(wsUri);
websocket.onopen = onOpen;
websocket.onclose = onClose;
websocket.onmessage = onMessage;
websocket.onerror = onError;


function onOpen(evt)
{
  console.log('in onOpen');
  console.log(evt)

  // const messages = [
  //   'hello',
  //   'world',
  //   'this',
  //   'is',
  //   'truly',
  //   'a',
  //   'great',
  //   'world',
  // ]
  // function* msgGenerator() {
  //   for (let msg of messages)
  //     yield msg;
  // }
  //
  // let msgs = msgGenerator()
  // function sendMsg() {
  //   let {value, done} = msgs.next()
  //   if (!done) {
  //     websocket.send(value);
  //     setTimeout(sendMsg, 10);
  //   }
  // }
  //
  //
  // console.log('playing with msgGenerator');
  // setTimeout(sendMsg, 10);
}

function onClose(evt)
{
  console.log('in onClose');
  console.log(evt)
}

function onMessage(evt)
{
  console.log(`in onMessage: "${evt.data}"`);
}

function onError(evt)
{
  console.log('in onError')
  console.log(evt)
}
