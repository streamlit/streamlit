# create a folder and cd into it
mkdir -p public/vendor/bokeh
cd public/vendor/bokeh

# download CSS
wget "https://cdn.pydata.org/bokeh/release/bokeh-1.1.0.min.css" -O "bokeh-1.1.0.min.css"
wget "https://cdn.pydata.org/bokeh/release/bokeh-widgets-1.1.0.min.css" -O "bokeh-widgets-1.1.0.min.css"
wget "https://cdn.pydata.org/bokeh/release/bokeh-tables-1.1.0.min.css" -O "bokeh-tables-1.1.0.min.css"

# download JS
wget "https://cdn.pydata.org/bokeh/release/bokeh-1.1.0.min.js" -O "bokeh-1.1.0.min.js"
wget "https://cdn.pydata.org/bokeh/release/bokeh-widgets-1.1.0.min.js" -O "bokeh-widgets-1.1.0.min.js"
wget "https://cdn.pydata.org/bokeh/release/bokeh-tables-1.1.0.min.js" -O "bokeh-tables-1.1.0.min.js"
wget "https://cdn.pydata.org/bokeh/release/bokeh-api-1.1.0.min.js" -O "bokeh-api-1.1.0.min.js"
