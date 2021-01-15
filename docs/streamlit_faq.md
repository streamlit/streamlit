# Streamlit Frequently Asked Questions

Here are some frequently asked questions about Streamlit and Streamlit Components. If you feel something important is missing that everyone needs to know, please [open an issue](https://github.com/streamlit/streamlit/issues) or [submit a pull request](https://github.com/streamlit/streamlit/pulls) and we'll be happy to review it!

## Using Streamlit

1. **How can I make `st.pydeck_chart` use custom Mapbox styles?**

   If you are supplying a Mapbox token, but the resulting `pydeck_chart` doesn't show your custom Mapbox styles, please check that you are adding the Mapbox token to the Streamlit `config.toml` configuration file. Streamlit DOES NOT read Mapbox tokens from inside of a PyDeck specification (i.e. from inside of the Streamlit app). Please see this [forum thread](https://discuss.streamlit.io/t/deprecation-warning-deckgl-pydeck-maps-to-require-mapbox-token-for-production-usage/2982/10) for more information.

## Manually deploying Streamlit

1. **How do I deploy Streamlit on a domain so it appears to run on a regular port (i.e. port 80)?**

   - You should use a **reverse proxy** to forward requests from a webserver like [Apache](https://httpd.apache.org/) or [Nginx](https://www.nginx.com/) to the port where your Streamlit app is running. You can accomplish this in several different ways. The simplest way is to [forward all requests sent to your domain](https://discuss.streamlit.io/t/permission-denied-in-ec2-port-80/798/3) so that your Streamlit app appears as the content of your website.

   - Another approach is to configure your webserver to forward requests to designated subfolders (e.g. _http://awesomestuff.net/streamlitapp_) to different Streamlit apps on the same domain, as in this [example config for Nginx](https://discuss.streamlit.io/t/how-to-use-streamlit-with-nginx/378/7) submitted by a Streamlit community member.

2. **How can I deploy multiple Streamlit apps on different subdomains?**

   Like running your Streamlit app on more common ports such as 80, subdomains are handled by a web server like Apache or Nginx:

   - Set up a web server on a machine with a public IP address, then use a DNS server to point all desired subdomains to your webserver's IP address

   - Configure your web server to route requests for each subdomain to the different ports that your Streamlit apps are running on

   For example, let’s say you had two Streamlit apps called `Calvin` and `Hobbes`. App `Calvin` is running on port **8501**. You set up app `Hobbes` to run on port **8502**. Your webserver would then be set up to "listen" for requests on subdomains `calvin.somedomain.com` and `hobbes.subdomain.com`, and route requests to port **8501** and **8502**, respectively.

   Check out these two tutorials for Apache2 and Nginx that deal with setting up a webserver to redirect subdomains to different ports:

   - [Apache2 subdomains](https://stackoverflow.com/questions/8541182/apache-redirect-to-another-port)
   - [NGinx subdomains](https://gist.github.com/soheilhy/8b94347ff8336d971ad0)

3. **How do I deploy Streamlit on Heroku, AWS, Google Cloud, etc...?**

   Here are some user-submitted tutorials for different cloud services:

   - [How to Deploy Streamlit to a Free Amazon EC2 instance](https://towardsdatascience.com/how-to-deploy-a-streamlit-app-using-an-amazon-free-ec2-instance-416a41f69dc3), by Rahul Agarwal
   - [Host Streamlit on Heroku](https://towardsdatascience.com/quickly-build-and-deploy-an-application-with-streamlit-988ca08c7e83), by Maarten Grootendorst
   - [Host Streamlit on Azure](https://towardsdatascience.com/deploying-a-streamlit-web-app-with-azure-app-service-1f09a2159743), by Richard Peterson
   - [Host Streamlit on 21YunBox](https://www.21yunbox.com/docs/#/deploy-streamlit), by Toby Lei

4. **Does Streamlit support the WSGI Protocol? (aka Can I deploy Streamlit with gunicorn?)**

   Streamlit does not support the WSGI protocol at this time, so deploying Streamlit with (for example) gunicorn is not currently possible. Check out this [thread regarding deploying Streamlit in a gunicorn-like manner](https://discuss.streamlit.io/t/how-do-i-set-the-server-to-0-0-0-0-for-deployment-using-docker/216) to see how other users have accomplished this.

---

## Streamlit Components

Below are some selected questions we've received about Streamlit Components. If you don't find your question here, take a look on the Streamlit community forum via the [Components tag](https://discuss.streamlit.io/tag/custom-components).

1. **How do Streamlit Components differ from functionality provided in the base Streamlit package?**

   - Streamlit Components are wrapped up in an iframe, which gives you the ability to do whatever you want (within the iframe) using any web technology you like.

   - There is a strict message protocol between Components and Streamlit, which makes possible for Components to act as widgets. As Streamlit Components are wrapped in iframe, they cannot modify their parent’s DOM (a.k.a the Streamlit report), which ensures that Streamlit is always secure even with user-written components.

2. **What types of things _*aren't possible*_ with Streamlit Components?**

   Because each Streamlit Component gets mounted into its own sandboxed iframe, this implies a few limitations on what is possible with Components:

   - **Can't communicate with other Components**: Components can’t contain (or otherwise communicate with) other components, so Components cannot be used to build something like `grid_layout`
   - **Can't modify CSS**: A Component can’t modify the CSS that the rest of the Streamlit app uses, so you can't create something like `dark_mode`
   - **Can't add/remove elements**: A Component can’t add or remove other elements of a Streamlit app, so you couldn't make something like `remove_streamlit_hamburger_menu`

3. **How do I add a Component to the sidebar?**

   You can add a component to st.sidebar using the `with` syntax. For example:
   ```
   with st.sidebar:
       my_component(greeting="hello")
   ```
   In fact, you can add your component to _any_ [layout container](./api.html#lay-out-your-app) (eg st.beta_columns, st.beta_expander),  using the `with` syntax!
   ```
   col1, col2 = st.beta_columns(2)
   with col2:
       my_component(greeting="hello")
   ```

4. **My Component seems to be blinking/stuttering...how do I fix that?**

   Currently, no automatic debouncing of Component updates is performed within Streamlit. The Component creator themselves can decide to rate-limit the updates they send back to Streamlit.
