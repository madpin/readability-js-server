// Ensure console.log spits out timestamps
require("log-timestamp");

// Express
const app = require("express")();
const bodyParser = require("body-parser").json();
const port = 3000;

// HTTP client
const { request } = require("undici");

// Readability, dom and dom purify
const { parseHTML } = require("linkedom");
const { Readability } = require("@mozilla/readability");
const createDOMPurify = require("dompurify");
const DOMPurify = createDOMPurify(parseHTML("").window);

// Not too happy to allow iframe, but it's the only way to get youtube vids
const domPurifyOptions = {
  ADD_TAGS: ["iframe", "video"],
};

app.get("/", (req, res) => {
  return res.status(400).send({
    error: 'POST (not GET) JSON, like so: {"url": "https://url/to/whatever"}',
  }).end;
});

app.post("/", bodyParser, async (req, res) => {
  const url = req.body.url;

  if (url === undefined || url === "") {
    return res
      .status(400)
      .send({
        error: 'Send JSON, like so: {"url": "https://url/to/whatever"}',
      })
      .end();
  }

  console.log("Fetching " + url + "...");

  try {
    const response = await request(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
      },
    });
    const body = await response.body.text();
    const sanitized = DOMPurify.sanitize(body, domPurifyOptions);
    const { document } = parseHTML(sanitized);

    // We are not going to use the url from the request, but the one from the response
    // as it may have been redirected
    const responseUrl = response.headers["location"] || url;
    document.baseURI = responseUrl;

    const parsed = new Readability(document).parse();

    console.log("Fetched and parsed " + url + " successfully");

    return res
      .status(200)
      .send({
        url,
        ...parsed,
      })
      .end();
  } catch (error) {
    return res
      .status(500)
      .send({
        error: "Some weird error fetching the content",
        details: error,
      })
      .end();
  }
});

// Start server and dump current server version
const version = require("fs")
  .readFileSync("./release")
  .toString()
  .split(" ")[0];

app.listen(port, () =>
  console.log(`Readability.js server v${version} listening on port ${port}!`)
);
