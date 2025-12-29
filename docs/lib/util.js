Array.prototype.item = function(i) {return this[i < 0 ? i + this.length : i]}

function jeval(a) {return JSON.parse(`{"a": ${a}}`).a}

function jeval_frac(s) {
    s = s.split("/");
    return jeval(s[0]) / (s.length > 1 ? jeval(s[1]) : 1);
}

function click_cycle(e, n, ...f) {
    e.cycleStatus = n;
    $(e).click((ev) => {
        let back = ev.ctrlKey;
        let n = f.length;
        e.cycleStatus += back ? -1 : 1;
        if (e.cycleStatus < 0) e.cycleStatus = n - 1;
        else if (e.cycleStatus >= n) e.cycleStatus = 0;
        let i = back ? 0 : e.cycleStatus;
        while (i <= e.cycleStatus) f[i++]();
    });
}

click_cycle.toggle = (items, show, ...n) => {
    let svg;
    try {svg = items instanceof SVG2 ? items : null}
    catch(err) {}
    for (let i of n) {
        // console.log(i, show);
        let e = svg ? svg.$.find(`.Toggle${i}`) : $(items[i]);
        if (show) e.fadeIn();
        else if (show == null) e.fadeToggle();
        else e.fadeOut();
    }
}

const range = function*(x0, x1, dx) {
    // Generate a sequence like Python's range function
    if (x1 == null) {x1 = x0; x0 = 0}
    if (!dx) dx = x0 < x1 ? 1 : -1;
    while (dx > 0 && x0 < x1 || dx < 0 && x0 > x1) {
        yield x0;
        x0 += dx;
    }
}

function qs_args(key, str) {
    // Convert query string to object
    let args = {};
    for (let [k, v] of new URLSearchParams(str ? str : location.search)) args[k] = v;
    return key ? args[key] : args;
}

function item_aspect(ei, w) {
    // Adjust height(width) of element to maintain aspect ratio
    ei = $(ei);
    let a = jeval_frac(ei.attr("data-aspect"));
    if (w) {
        ei.css({width: ''});
        let w1 = Math.round(ei.height() * a);
        if (w1 != ei.width()) ei.width(w1);
    }
    else {
        ei.css({height: ''});
        let h = Math.round(ei.width() / a);
        if (h != ei.height()) ei.height(h);
    }
}

function aspect(w) {
    let e = $("[data-aspect]");
    for (let i=0;i<e.length;i++) item_aspect(e[i], w)
}


const random_string = (n, allowNum) => {
// allowNum = 1: numerals are allowed
// allowNum = 2: allowed except for first character
    let s = "";
    if (allowNum == 2) {
        s = random_string(1);
        n--;
    }
    while (n--) {
        let i = Math.floor((allowNum ? 62 : 52) * Math.random());
        i = (i < 26 ? 65 : (i < 52 ? 97 : 48)) + i % 26;
        s += String.fromCharCode(i);
    }
    return s;
}

function* _zip(x, y, rarray) {
    let xa = x instanceof Array;
    let ya = y instanceof Array;
    let n = xa ? x.length : y.length;
    for (let i=0;i<n;i++) {
        let xi = xa ? x[i] : x;
        let yi = ya ? y[i] : y;
        yield rarray ? new RArray(xi, yi) : [xi, yi];
    }
}

function zip(x, y, rarray) {return [..._zip(x, y, rarray)]}

function unzip(data, rarray) {
    let dim = data[0].length;
    let udata = new Array(dim);
    for (let i=0;i<udata.length;i++) udata[i] = rarray ? new RArray() : [];
    for (let j=0;j<data.length;j++)
        for (let i=0;i<dim;i++) udata[i].push(data[j][i]);
    return udata;
}

function unicode_to_base64(utext) {
    let data = new TextEncoder().encode(utext);
    return btoa(String.fromCharCode(...data));
}


/*** Math rendering with MathJax or KaTeX ***/

function katex_render(e, opt) {
    // Render TeX math with KaTeX
    e = $(e ? e : ".TeX").removeClass("TeX");
    for (let ei of e) {
        let e$ = $(ei);
        let tex = e$.text();
        e$.attr("data-latex", tex);
        let options = {displayMode: e$.is("p, div, .Display"), throwOnError: false};
        if (opt) Object.assign(options, opt);
        katex.render(tex, ei, options);
    }
    if (katex_render.hideEqNum) $("[data-latex]:is(p, div) .eqn-num").hide();
}

katex_render.hideEqNum = true;

async function mjax_render(e, mode) {
    // Render TeX math with MathJax
    // mode = 0 => <svg>
    // mode = 1 => <mjx-container><svg>
    e = $(e ? e : ".TeX").addClass("TeX_Pending").removeClass("TeX");
    let p = [];
    for (let ei of e) {
        let e$ = $(ei);
        let tex = e$.text();
        e$.attr("data-latex", tex);
        f = mode ? mj => $(mj) : mj => $(mj).find("svg");
        p.push(MathJax.tex2svgPromise(tex).then(mj => e$.removeClass("TeX_Pending").html(f(mj)[0])));
    };
    return new Promise(async res => {
        for (let i=0;i<p.length;i++) await p[i];
        res();
    });
}

async function mjax_wait(t) {
    // Wait until MathJax.typesetPromise is available
    while (!MathJax.typesetPromise) await SVG2.sleep(t ? t : 50);
    return new Promise(res => res());
}

async function mjax_svg(tex) {
    // Use MathJax to render LaTeX as SVG; return jquery object containing <svg>
    return MathJax.tex2svgPromise(tex).then(a => $($(a).find("svg")[0]));
}

async function mjax_url(tex) {
    // Use MathJax to render LaTeX as an SVG data URL
    return mjax_svg(tex).then(svg => "data:image/svg+xml;base64," + unicode_to_base64(svg[0].outerHTML));
}

function mjax_img(tex) {
    // Use MathJax to render LaTeX as SVG; return jquery object containing <img>
    return mjax_url(tex).then(u => $("<img>").attr({src: u}));
}

renderTeX = mjax_render;


async function load_img(url) {
    return new Promise(res => {
        let img = new Image();
        img.addEventListener("load", () => res(img));
        img.src = url;
    });
}


/*** Convert data to a Blob instance and give it a save method...
 * 
 *  blobify("Hello, world!", "text/plain").then(b => b.save("hello.txt"))
 *  blobify(canvas, "image/jpeg").then(b => b.save("image1.jpg"))
 *  blobify(img2canvas(img, [512, 288]), "image/png").then(b => b.save("image2.png"))
 *  blobify(blob).then(b => b.save())
 ***/

async function blobify(data, ...args) {return new Promise(res => {
    if (data instanceof Blob) {
        data.save = blobify._save;
        res(data);
    }
    else if (data.toBlob) data.toBlob(blob => {
        blob.save = blobify._save;
        res(blob);
    }, ...args);
    else {
        let blob = new Blob([data], {"type": args.length ? args[0] : "text/plain"});
        blob.save = blobify._save;
        res(blob);
    }
})}

blobify._save = function(filename) {
    let url = URL.createObjectURL(this);
    if (filename) $("<a>").attr({href: url, download: filename})[0].click();
    else window.open(url);
    URL.revokeObjectURL(url);
}

blobify.mime = (f) => {
    let m = {
        "html": "text/html",
        "htm": "text/html",
        "js": "text/javascript",
        "css": "text/css",
        "csv": "text/csv",
        "py": "text/python",
        "svg": "image/svg+xml",
        "png": "image/png",
        "jpg": "image/jpeg",
        "webp": "image/webp",
        "json": "application/json",
        "xml": "application/xml",
        "pdf": "application/pdf",
        "zip": "application/zip",
    }[f.split(".").pop().toLowerCase()];
    return m ? m : "text/plain";
}

function img2canvas(img, size) {
    /* Scale an image (if requested) and draw it to a new canvas */
    if (!size) size = 1;
    if (!(size instanceof Array)) {
        let j = $(img);
        size = [Math.round(size * j.width()), Math.round(size * j.height())];
    }
    let [w, h] = size;
    if (w * h == 0) throw("Image has a dimension of 0");
    let cv = $("<canvas>").attr({width: w, height: h})[0];
    let cx = cv.getContext("2d");
    cx.drawImage(img, 0, 0, w, h);
    return cv;
}

/*** Fetch images or other data as blobs or data URLs... 
*
* load_blobs("video.png", "print.svg").then(console.log);
* load_dataURLs("video.png", "print.svg").then(console.log);  
*
***/

async function load_one_blob(url, dataURL) {
    return new Promise((resolve, reject) => {
        fetch(url).then(r => r.blob().then(b => {
            if (!r.ok) reject(b);
            else {
                if (dataURL) {
                    const reader = new FileReader();
                    reader.onloadend = r => resolve(r.target.result);
                    reader.readAsDataURL(b);            
                }
                else resolve(b);                
            }
        }));
    });  
}

async function _load_blobs(dataURL, ...args) {
    let data = {}, promises = {};
    for (let a of args)
        promises[a] = load_one_blob(a, dataURL).then(b => data[a] = b, () => data[a] = null);
    for (let a of args) await promises[a];
    return new Promise((resolve) => {resolve(data)});
}

async function load_blobs(...args) {return _load_blobs(0, ...args)}
async function load_dataURLs(...args) {return _load_blobs(1, ...args)}

function code_echo(e, action) {
    /** Preview code in browser or copy to clipboard **/
    let text = e.text();
    if (!action) navigator.clipboard.writeText(text).then(
        () => msg("Text copied to clipboard"), () => msg("Unable to copy text"));
    else {
        let echo = e.attr("data-echo");
        let fExt = echo.split('.').pop();
        if (echo == fExt) echo = random_string(12, 1) + '.' + fExt;
        if (fExt == "html" || fExt == "htm") {
            if (text.search("</body>") == -1) text = `<body>\n${text}\n</body>`;
            if (text.search("</head>") == -1) text = `${code_echo.head}\n${text}\n`;
            if (text.search("</html>") == -1) text = `${code_echo.html}\n${text}\n</html>`;
        }
        blobify(text, blobify.mime(fExt)).then(b => b.save(action == 2 ? echo : null));
    }
}

code_echo.html = `<!DOCTYPE html>
<html lang="en-ca">`;

code_echo.head = `<head>
<meta charset="utf8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>HTML Document</title>
<link rel="shortcut icon" type="image/svg+xml" href="https://upload.wikimedia.org/wikipedia/commons/6/61/HTML5_logo_and_wordmark.svg"/>
</head>`;
