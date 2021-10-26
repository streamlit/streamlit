mkdir -p public/vendor/bokeh
cd public/vendor/bokeh

curl "https://cdn.bokeh.org/bokeh/release/bokeh-2.4.1.min.js" -o "bokeh-2.4.1.min.js"
curl "https://cdn.bokeh.org/bokeh/release/bokeh-widgets-2.4.1.min.js" -o "bokeh-widgets-2.4.1.min.js"
curl "https://cdn.bokeh.org/bokeh/release/bokeh-tables-2.4.1.min.js" -o "bokeh-tables-2.4.1.min.js"
curl "https://cdn.bokeh.org/bokeh/release/bokeh-api-2.4.1.min.js" -o "bokeh-api-2.4.1.min.js"
curl "https://cdn.bokeh.org/bokeh/release/bokeh-gl-2.4.1.min.js" -o "bokeh-gl-2.4.1.min.js"
curl "https://cdn.bokeh.org/bokeh/release/bokeh-mathjax-2.4.1.min.js" -o "bokeh-mathjax-2.4.1.min.js"
