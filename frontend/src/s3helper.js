/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import AWS from 'aws-sdk';
import { FETCH_PARAMS, AWS_REGION, COGNITO_IDENTITY_POOL_ID } from './baseconsts';
import { logError } from './log';


let s3 = null;
let haveCredentials = false;


/**
 * Set up AWS credentials, given an OAuth ID token from Google.
 * Only needs to be called once ever.
 */
export async function configureCredentials(idToken) {
  if (haveCredentials) {
    logError('Grabbing credentials again. This should never happen.');
  }

  AWS.config.region = AWS_REGION;

  AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    // These keys are capitalized funnily on purpose. That's the actual API.
    IdentityPoolId: COGNITO_IDENTITY_POOL_ID,
    Logins: {
      'accounts.google.com': idToken,
    },
  });

  await AWS.config.credentials.getPromise();
  haveCredentials = true;
}


/**
 * Get an Object from S3. This smartly chooses whether hit the HTTP server in
 * front of S3 or whether to hit the S3 API server based.
 *
 * The reason why you'd want to do this is to make setup easier for clients who
 * have their own S3 setups but do not want to use auth (maybe because they're
 * in a VPN). This way there's no need for them to mess with things like
 * Cognito, IAM, roles, and so on -- which would be required if using the S3
 * API.
 *
 * So you should *always* use this instead of s3.getObject.
 *
 * Arguments: {Key: string, Bucket: string}
 */
export async function getObject(args) {
  if (haveCredentials) {
    return getObjectViaS3API(args);
  } else {
    return getObjectViaFetchAPI(args);
  }
}


async function getObjectViaFetchAPI(args) {
  const response = await fetch(`/${args.Key}`, FETCH_PARAMS);

  if (!response.ok) {
    if (response.status === 403) {
      // Can't subclass Error class in Babel, so this is my crappy solution.
      throw new Error('PermissionError');
    } else {
      const responseText = await response.text();
      throw new Error(
        `HTTP status code: ${response.status}\n` +
        `Response text: ${responseText}`);
    }
  }

  return response;
}


async function getObjectViaS3API(args) {
  if (!s3) {
    s3 = new AWS.S3();
  }

  const data = await s3.getObject(args).promise();
  return {
    json: () => Promise.resolve(JSON.parse(data.Body.toString('utf-8'))),
    text: () => Promise.resolve(data.Body.toString('utf-8')),
    arrayBuffer: () => Promise.resolve(data.Body),
  };
}
