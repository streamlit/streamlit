# App is not loading when running remotely

Below are a few common errors that occur when users spin up their own solution
to host a Streamlit app remotely.

To learn about a deceptively simple way to host Streamlit apps that avoids all
the issues below, check out [Streamlit for
Teams](https://www.streamlit.io/for-teams).

### Symptom #1: The app never loads

When you enter the app's URL in a browser and all you see is a **blank page, a
"Page not found" error, a "Conection refused" error**, or anything like that,
first check that Streamlit is actually running on the remote server. On a Linux
server you can SSH into it and then run:

```bash
ps -Al | grep streamlit
```

If you see Streamlit running, the most likely culprit is the Streamlit port not
being exposed. The fix depends on your exact setup. Below are three example
fixes:

- **Try port 80:** Some hosts expose port 80 by default. To
  set Streamlit to use that port, start Streamlit with the `--server.port`
  option:

  ```bash
  streamlit run my_app.py --server.port=80
  ```

- **AWS EC2 server**: First, click on your instance in the [AWS Console](https://us-west-2.console.aws.amazon.com/ec2/v2/home).
  Then scroll down and click on _Security Groups_ → _Inbound_ → _Edit_. Next, add
  a _Custom TCP_ rule that allows the _Port Range_ `8501` with _Source_
  `0.0.0.0/0`.

- **Other types of server**: Check the firewall settings.

If that still doesn't solve the problem, try running a simple HTTP server
instead of Streamlit, and seeing if _that_ works correctly. If it does, then
you know the problem lies somewhere in your Streamlit app or configuration (in
which case you should ask for help in our
[forums](https://discuss.streamlit.io)!) If not, then it's definitely unrelated
to Streamlit.

How to start a simple HTTP server:

```bash
python -m http.server [port]
```

### Symptom #2: The app says "Please wait..." forever

If when you try to load your app in a browser you see a blue box in the center
of the page with the text "Please wait...", the underlying cause is likely one
of the following:

- Misconfigured [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
  protection.
- Server is stripping headers from the Websocket connection, thereby breaking
  compression.

To diagnose the issue, try temporarily disabling CORS protection by running
Streamlit with the `--server.enableCORS` flag set to `false`:

```bash
streamlit run my_app.py --server.enableCORS=false
```

If this fixes your issue, **you should re-enable CORS protection** and then set
`browser.serverPort` and `browser.serverAddress` to the URL and port of your
Streamlit app.

If the issue persists, try disabling websocket compression by running Streamlit with the
`--server.enableWebsocketCompression` flag set to `false`

```bash
streamlit run my_app.py --server.enableWebsocketCompression=false
```

If this fixes your issue, your server setup is likely stripping the
`Sec-WebSocket-Extensions` HTTP header that is used to negotiate Websocket compression.

Compression is not required for Streamlit to work, but it's strongly recommended as it
improves performance. If you'd like to turn it back on, you'll need to find which part
of your infrastructure is stripping the `Sec-WebSocket-Extensions` HTTP header and
change that behavior.

### Symptom #3: Unable to upload files when running in multiple replicas

If the file uploader widget returns an error with status code 403, this is probably
due to a misconfiguration in your app's
[XSRF](https://en.wikipedia.org/wiki/Cross-site_request_forgery) protection logic.

To diagnose the issue, try temporarily disabling XSRF protection by running Streamlit
with the `--server.enableXsrfProtection` flag set to `false`:

```bash
streamlit run my_app.py --server.enableXsrfProtection=false
```

If this fixes your issue, **you should re-enable XSRF protection** and then
configure your app to use the same secret across every replica by setting the
`server.cookieSecret` config option to the same hard-to-guess string everywhere.
