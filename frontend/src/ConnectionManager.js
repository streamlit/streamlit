/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import url from 'url';

import ConnectionState from './ConnectionState';
import ConnectionStatus from './ConnectionStatus';
import StaticConnection from './StaticConnection';
import WebsocketConnection from './WebsocketConnection';
import { IS_DEV_ENV, WEBSOCKET_PORT_DEV } from './baseconsts';
import { getObject, configureCredentials } from './s3helper';


export default class ConnectionManager extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      connectionState: ConnectionState.INITIAL,
    };

    this.connection = null;
    this.getUserLogin = props.getUserLogin;
    this.onMessage = props.onMessage;
    this.onConnectionError = props.onConnectionError;
    this.setReportName = props.setReportName;

    this.setConnectionState = this.setConnectionState.bind(this);

    // The method below returns a promise, but no need to "await" it.
    this.connect();
  }

  static get propTypes() {
    return {
      /**
       * Function that shows the user a login box and returns a promise which
       * gets resolved when the user goes through the login flow.
       * Arguments: none.
       */
      getUserLogin: PropTypes.func.isRequired,

      /**
       * Function that should be called when we receive a message from the
       * proxy.
       * Arguments: the message object.
       */
      onMessage: PropTypes.func.isRequired,

      /**
       * Function that should be called when the connection errors out.
       * Arguments: the error message as a string.
       */
      onConnectionError: PropTypes.func.isRequired,

      /**
       * Function that should called to set the current report's name in the
       * parent component.
       * Arguments: the report name as a string.
       */
      setReportName: PropTypes.func.isRequired,
    };
  }

  render() {
    return (
      <ConnectionStatus connectionState={this.state.connectionState} />
    );
  }

  // Public methods.

  /**
   * Indicates whether we're connected to the proxy.
   */
  isConnected() {
    return this.state.connectionState === ConnectionState.CONNECTED;
  }

  sendMessage(obj) {
    if (this.connection instanceof WebsocketConnection &&
        this.isConnected()) {
      this.connection.sendMessage(obj);
    } else {
      // Don't need to make a big deal out of this. Just print to console.
      console.warn(`Cannot send message when proxy is disconnected: ${obj}`);
    }
  }

  // Private methods.

  async connect() {
    const { query } = url.parse(window.location.href, true);
    const reportName = query.name;
    const reportId = query.id;

    try {
      if (reportName !== undefined) {
        this.setReportName(reportName);
        this.connection = await this.connectBasedOnWindowUrl(reportName);

      } else if (reportId !== undefined) {
        this.connection = await this.connectBasedOnManifest(reportId);

      } else {
        throw new Error('URL must contain either a report name or an ID.');
      }
    } catch (err) {
      this.setConnectionState({
        connectionState: ConnectionState.ERROR,
        errMsg: err.message,
      });
    }
  }

  setConnectionState({ connectionState, errMsg }) {
    this.setState({ connectionState });
    if (connectionState === ConnectionState.ERROR) {
      this.onConnectionError(errMsg);
    }
  }

  connectBasedOnWindowUrl(reportName) {
    // If dev, always connect to 8501, since window.location.port is the Node
    // server's port 3000.
    // If changed, also change config.py
    const port = IS_DEV_ENV ? WEBSOCKET_PORT_DEV : +window.location.port;
    const uri = getWsUrl(window.location.hostname, port, reportName);

    return new WebsocketConnection({
      uriList: [
        //getWsUrl('1.1.1.1', '9999', 'bad'),  // Uncomment to test timeout.
        //getWsUrl('1.1.1.1', '9999', 'bad2'),  // Uncomment to test timeout.
        uri,
      ],
      onMessage: this.onMessage,
      setConnectionState: this.setConnectionState.bind(this),
    });
  }

  /**
   * Opens either a static connection or a websocket connection, based on what
   * the manifest says.
   */
  async connectBasedOnManifest(reportId) {
    const manifest = await this.fetchManifestWithPossibleLogin(reportId);

    const connection = manifest.proxyStatus === 'running' ?
      this.connectToRunningProxyFromManifest(manifest) :
      this.connectToStaticReportFromManifest(reportId, manifest);

    return connection;
  }

  connectToRunningProxyFromManifest(manifest) {
    const {
      name, configuredProxyAddress, internalProxyIP, externalProxyIP,
      proxyPort,
    } = manifest;

    const uriList = configuredProxyAddress ?
      [getWsUrl(configuredProxyAddress, proxyPort, name)] :
      [
        getWsUrl(externalProxyIP, proxyPort, name),
        getWsUrl(internalProxyIP, proxyPort, name),
      ];

    return new WebsocketConnection({
      uriList,
      onMessage: this.onMessage,
      setConnectionState: this.setConnectionState,
    });
  }

  connectToStaticReportFromManifest(reportId, manifest) {
    return new StaticConnection({
      manifest,
      reportId,
      onMessage: this.onMessage,
      setConnectionState: this.setConnectionState,
      setReportName: this.setReportName,
    });
  }

  async fetchManifestWithPossibleLogin(reportId) {
    let manifest;
    let permissionError = false;

    try {
      manifest = await fetchManifest(reportId);
    } catch (err) {
      if (err.message === 'PermissionError') {
        permissionError = true;
      } else {
        console.error(err);
        throw new Error('Unable to fetch report.');
      }
    }

    if (permissionError) {
      const idToken = await this.getUserLogin();
      try {
        await configureCredentials(idToken);
        manifest = await fetchManifest(reportId);
      } catch (err) {
        console.error(err);
        throw new Error('Unable to log in.');
      }
    }

    if (!manifest) {
      throw new Error('Unknown error fetching report.');
    }

    return manifest;
  }
}


async function fetchManifest(reportId) {
  const { hostname, pathname } = url.parse(window.location.href, true);
  // IMPORTANT: The bucket name must match the host name!
  const bucket = hostname;
  const version = pathname.split('/')[1];
  const manifestKey = `${version}/reports/${reportId}/manifest.json`;
  const data = await getObject({ Bucket: bucket, Key: manifestKey });
  return data.json();
}


function getWsUrl(host, port, reportName) {
  //return `ws://${host}:${port}/stream/${encodeURIComponent(reportName)}`;
  //XXX
  return `ws://${host}:${port}/stream`;
}
