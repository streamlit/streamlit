# Streamlit static site

## Developing

This site is built using Hugo, the static site generator. To develop and publish
this site to the world you must first install that.

On Ubuntu/Debian that's as simple as

```
sudo apt-get install hugo
```


## Folder structure

* `static/`
This is where images and CSS go. These things don't get compiled, they're just
copied over.

* `layouts/`
This is where our base code lives. This includes HTML-heavy pages such as
`index.html`, as well as templates for things like blog posts, etc.
Our site is fully custom, meaning we're not using a theme. So every file we
output is built from the templates defined here.


* `content/`
This is where we'll put blog posts, documentation, etc. Just plop markdown files
in this folder (or in subfolders) and they will be rendered using one of our
templates. For example, `content/hello/test.md` will be accessible at
`yoursite.foo/hello/test/`.
The cool thing is that you can mark certain posts as drafts, and they will not
be published when you build the site. Or you can mark them for auto-publish
after a certain date. And so on.

There's also a configuration file at `./config.toml`. That's where you enter
some basic metadata about your site. You can also add extra items to your config
file and read those values from your HTML templates. It's pretty cool, but we're
not really using that feature right now.


## Starting the dev server

For development, you can start a local server with auto-reload and all those
nice things with the following command:

```
hugo server -D
```

The `-D` tells Hugo to also serve drafts. This is useful when developing, since
you'll likely be putting your content in drafts and would like to be able to see
it in your browser.

The site will be accessible at `localhost:1313`.


## How to publish

When you're ready to build your site for reals, just run:

```
hugo
```

This compiles everything into `html` files that live inside the `public/`
folder. Once compilation is done, just copy the `public/` folder to your host
and you're done!
