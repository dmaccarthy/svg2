/*** (c) 2023-2025 by D. G. MacCarthy [https://github.com/dmaccarthy/svg2] ***/

/** util.js **/

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


/** math.js **/

const pi = Math.PI, DEG = pi / 180, RAD = 180 / pi;
const twoPi = 2 * pi, halfPi = pi / 2, quarterPi = pi / 4;


class RArray extends Array {

static add(...args) {
    let a = new RArray();
    let dim = args[0].length;
    for (let i=0;i<dim;i++) {
        let s = 0;
        for (let j=0;j<args.length;j++) s += args[j][i];
        a.push(s);
    }
    return a;
}

static convert(...args) {
    let c = [];
    for (let a of args) c.push(new RArray(...a));
    return c;
}

sum() {
    let n = this.length, s = 0;
    if (n) {
        s = this[0];
        for (let i=1; i<n; i++) s += this[i];
    }
    return s;
}

minmax() {
    let min = this[0];
    let max = min;
    for (let i=0;i<this.length;i++) {
        if (this[i] < min) min = this[i];
        if (this[i] > max) max = this[i];
    }
    return {min: min, max: max};
}

extend(a) {
    this.push.apply(this, a);
    return this;
}

remove(val, removeAll) {
    let loop = true;
    while (loop) {
        let i = this.indexOf(val);
        if (i >= 0) this.splice(i, 1);
        if ((i == -1) || (!removeAll)) loop = false;
    }
    return this;
}

times(s) {
    let sa = s instanceof Array;
    let a = new RArray();
    for (let i=0;i<this.length;i++)
        a.push(this[i] * (sa ? s[i] : s));
    return a;
}

neg() {return this.times(-1)}
plus(a) {return RArray.add(this, a)}

minus(a) {
    let d = new RArray();
    for (let i=0;i<this.length;i++) {
        d.push(this[i] - a[i]);
    }
    return d;
}

dot(a) {
    let s = 0
    for (let i=0;i<this.length;i++) s += this[i] * a[i];
    return s;
}

mag() {return Math.sqrt(this.dot(this))}

dir() {
    if (this.length != 2) throw("ValueError: operation applies only to arrays of length 2");
    return atan2(this[1], this[0]);
}

// get matrix() {return new Matrix([this])}

tr(p, scale) {
    if (!p) p = 4;
    let tr = $("<tr>");
    let nums = [this.mag(), this.dir(), this[0], this[1]];
    for (let n of nums) {
        if (scale) n *= scale;
        tr.append($("<td>").html(n.toPrecision(p)));
    }
    return tr;
}
    
}


function xy_limits(...vecs) {
/* Find maxima and minima coordinates for vector addition */
    let pt = new RArray(0, 0);
    let sums = [pt];
    for (let v of vecs) {
        pt = pt.plus(v);
        sums.push(pt);
    }
    let [x, y] = unzip(sums, true);
    x = x.minmax();
    y = y.minmax();
    return {x: x, y: y, center: [(x.min + x.max) / 2, (y.min + y.max) / 2], size: [x.max - x.min, y.max - y.min]};
}
    

function* fn_eval(f, x) {for (let xi of x) yield f(xi)}
function uniform(a, b) {return a + (b - a) * Math.random()}

function randint(a, b) {
    if (b == null) {b = a; a = 0}
    return a + Math.floor((b + 1 - a) * Math.random())}

function shuffle(a) { // Re-order array randomly, in-place
    for (let i=a.length-1; i>0;i--) {
        let j = randint(i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
}

function arrow_points(L, opt) {
    /* Calculate the vertices of an arrow. See: www.desmos.com/calculator/kr61ws62tm
       opt = {tail, head, angle, shape, double} */
    if (!opt) opt = {};
    let A = (opt.angle ? opt.angle : 35) * DEG;
    let T = opt.tail ? opt.tail : L/14;
    if (T < 0) T *= -L;
    let H = opt.head ? opt.head : 4 * T;
    let c = Math.cos(A), s = Math.sin(A);
    let T2 = T / 2;
    let x1 = -H * c, x2 = x1 - T * s;
    let y1 = H * s, y2 = y1 - T * c;
    let x3 = x2 - (T2 - y2) * c / s;
    if (x3 < x2 || opt.shape == 2) x3 = x2;
    if (y2 < T2) y2 = T2;
    let pts = RArray.convert([0,0], [x1, y1], [x2, y2], [x3, T2], [-L, T2],
        [-L, -T2], [x3, -T2], [x2, -y2], [x1, -y1]);
    if (opt.shape || y1 < T2) {
        pts.splice(8, 1);
        pts.splice(1, 1);
    }
    L /= 2;
    for (let i=0;i<pts.length;i++) pts[i][0] += L;
    if (opt.double) {
        let n = Math.floor(pts.length / 2);
        let dpts = pts.slice(0, n);
        let flip = (i) => {
            let [x, y] = pts[i];
            return new RArray(-x, y);
        }
        for (let i=0;i<n;i++) dpts.push(flip(n - 1 - i));
        n = dpts.length - 2;
        flip = (i) => {
            let [x, y] = dpts[i];
            return new RArray(x, -y);
        }
        for (let i=n;i>0;i--) dpts.push(flip(i));
        pts = dpts;
    }
    return pts;
}

function star_points(sides, big, small) {
/* Calculate the vertices of a star */
    if (!small) small = 3 * big / 7;
    return [...fn_eval((i) => vec2d(i % 2 ? small : big, 90 * (1 + 2 * i / sides)), range(0, 2 * sides))];
}

function sq(x) {return x*x}
function root(x, n) {return Math.pow(x, 1 / (n == null ? 2 : n))}
function sin(d) {return Math.sin(d*DEG)}
function cos(d) {return Math.cos(d*DEG)}
function tan(d) {return Math.tan(d*DEG)}
function asin(d) {return Math.asin(d)*RAD}
function acos(d) {return Math.acos(d)*RAD}
function atan(d) {return Math.atan(d)*RAD}
function atan2(y,x) {return Math.atan2(y,x)*RAD}
function hypot(x,y) {return Math.sqrt(x*x+y*y)}

const log = (x, b) => {
    x = Math.log(x);
    return b ? x / Math.log(b) : x;
}

const vec2d = (r, a, rad) => {
    if (!rad) a *= DEG;
    return new RArray(r * Math.cos(a), r * Math.sin(a));
}

const vec = (...xy) => {return new RArray(...xy)}

const adjust_angle = (a, min, max) => {
    if (min == null) min = 0;
    if (max == null) max = min + 360;
    while (a < min) a += 360;
    while (a >= max) a -= 360;
    return a;
}


class Segment {

constructor(x1, y1, x2, y2) {
    if (x2 == null) {
        x2 = x1;
        y2 = y1;
        x1 = y1 = 0;
    }
    let dx = x2 - x1;
    let dy = y2 - y1;
    let r = Math.sqrt(dx*dx + dy*dy);
    let u = new RArray(dx / r, dy / r);
    let a = Math.atan2(dy, dx);
    let t = this;
    Object.assign(this, {
        point1: new RArray(x1, y1),
        point2: new RArray(x2, y2),
        length: r, rad: a, deg: a * RAD, slope: u[1] / u[0],
        midpoint: new RArray(x1 + dx/2, y1 + dy/2),
        unitVector: u, vector: new RArray(dx, dy),
        normal: new RArray(-u[1], u[0]),
        point: (s) => {return new RArray(x1 + u[0] * s, y1 + u[1] * s)}, 
        params: (x, y) => {
            let p = (x - x1) * u[0] + (y - y1) * u[1];
            let q = (x1 - x) * u[1] + (y - y1) * u[0];
            return new RArray(p, q)
        },
        closest: (x, y) => {return t.point((x - x1) * u[0] + (y - y1) * u[1])}
    });
}

static point_slope(point, length, slope, middle) {
    let [dx, dy] = Math.abs(slope) == Infinity ? new RArray(0, slope < 0 ? -length : length) : 
        new RArray(1, slope).times(length / hypot(1, slope));
    let [x1, y1] = middle ? new RArray(-dx/2, -dy/2).plus(point) : point;
    return new Segment(x1, y1, x1+dx, y1+dy);
}

}


function _SSS(a, b, c) {
    // Calculate angle C from sides a, b, c
    return acos((c*c - a*a - b*b) / (-2*a*b));
}

function SSS(a, b, c) {
    // Calculate angles A, B, C from sides a, b, c
    return [_SSS(b, c, a), _SSS(a, c, b), _SSS(a, b, c)];
}

function SAS(a, C, b) {
    // Calculate angle A, side c, angle B from others
    let c = root(a*a + b*b - 2*a*b*cos(C));
    let A = _SSS(b, c, a);
    return [A, c, 180-(A+C)];
}

function ASA(A, b, C) {
    // Calculate side a, angle B, side c from others
    let B = 180 - (A + C);
    b /= sin(B);
    let a = b * sin(A);
    let c = b * sin(C);
    return [a, B, c];
}

function SSA(a, b, A, ambig) {
    // Calculate side c, angle C, angle B
    let B = asin(b * sin(A) / a);
    if (ambig) B = 180 - B;
    let C = 180 - (A + B);
    if (C >= 0)
        return [root(a*a + b*b - 2*a*b*cos(C)), C, B];
}

function quad_form(a, b, c) {return [(-b + root(b*b-4*a*c))/(2*a), (-b - root(b*b-4*a*c))/(2*a)]}

const transform = (opt, ...pts) => { // 2D transformation
/* 
    opt.angle = rotation angle
    opt.deg = degrees(true) / radians(false)
    opt.center = center of rotation
    opt.shift = shift after rotation
    pts = array of points
*/
    let a = opt.angle ? opt.angle : 0;
    if (opt.deg) a *= DEG;
    let c = Math.cos(a);
    let s = Math.sin(a);
    let xc = 0, yc = 0;
    if (opt.center) {
        xc = opt.center[0];
        yc = opt.center[1];
    }
    let dx = xc;
    let dy = yc;
    if (opt.shift) {
        dx += opt.shift[0];
        dy += opt.shift[1];
    }
    let t = [];
    for (let i=0;i<pts.length;i++) {
        let x = pts[i][0] - xc;
        let y = pts[i][1] - yc;
        t.push(new RArray(x * c - y * s + dx, x * s + y * c + dy));
    }
    return t;
}

function lin_reg_xy(x, y) {
    let n = x.length;
    if (y.length != n) throw("Dimension error");
    x = new RArray(...x);
    y = new RArray(...y);
    let sx = x.sum();
    let sy = y.sum();
    let m = (n * x.dot(y) - sx * sy) / (n * x.dot(x) - sx * sx);
    let b = (sy - m * sx) / n;
    return {m: m, b: b, fn: (x) => m * x + b}
}

function exp_reg_xy(x, y) {
    let n = y.length;
    let ln_y = new Array(n);
    for (let i=0;i<n;i++) ln_y[i] = Math.log(y[i]);
    let reg = lin_reg_xy(x, ln_y);
    let a = Math.exp(reg.b);
    let k = reg.m;
    return {a:a, k:k, fn: (x) => a * Math.exp(k * x)}
}

function pwr_reg_xy(x, y) {
    let n = x.length;
    let ln_x = new Array(x);
    let ln_y = new Array(n);
    for (let i=0;i<n;i++) {
        ln_x[i] = Math.log(x[i]);
        ln_y[i] = Math.log(y[i]);
    }
    let reg = lin_reg_xy(ln_x, ln_y);
    let a = Math.exp(reg.b);
    n = reg.m;
    // console.log(a, n);
    return {a:a, n:n, fn: (x) => a * Math.pow(x, n)}
}

function lin_reg(...data) {return lin_reg_xy(...unzip(data))}
function exp_reg(...data) {return exp_reg_xy(...unzip(data))}
function pwr_reg(...data) {return pwr_reg_xy(...unzip(data))}

function gcf(a, b) {
    let a1 = parseInt(a);
    let b1 = parseInt(b);
    if (a != a1 || b != b1 || isNaN(a1) || isNaN(b1) || a < 1 || b < 1)
        throw("Invald argument");
    [a, b] = [Math.min(a1, b1), Math.max(a1, b1)];
    if (b % a == 0) return a;
    let g = 1, f = 2;
    while (2 * f <= a) {
        if (a % f == 0 && b % f == 0) g = f;
        f++;
    }
    return g;
}

function lcm(a, b) {
    return Math.round(a / gcf(a, b) * b);
}


/** svg2.js **/

/**
Simple JavaScript animations rendered in an <svg> element
(c) 2023-2025 by D.G. MacCarthy <sc8pr.py@gmail.com>
**/


class SVG2g {

constructor(parent, g) {
    if (parent) {
        this.element = g ? $(g)[0] : document.createElementNS(SVG2.nsURI, "g");
        this.element.graphic = this;
        this.$ = $(this.element);
        this.$.appendTo(g ? g.$ : parent.$);
        this.svg = parent.svg;
        this._pivot = new RArray(0, 0);
        this._shift = new RArray(0, 0);
        this._vel = new RArray(0, 0);
        this._acc = new RArray(0, 0);
        this.thetaMode = 1;
        this._theta = 0;
        this.omega = 0;
        this.alpha = 0;
    }
}

find(sel, n) {
    let e = this.$.find(sel)[n ? n : 0];
    return e ? e.graphic : null;
}

find_all(selector) {
    let g = [];
    for (let e of this.$.find(selector))
        if (e.graphic instanceof SVG2g) g.push(e.graphic);
    return g;
}

config(attr) {
/* Encapsulate multiple attributes */
    for (let k in attr) this[k] = attr[k];
    return this.update_transform();
}

addClass(...args) {
/* Call jQuery.addClass */
    this.$.addClass(...args);
    return this;
}

css(...rules) {
/* Apply CSS rules to <g> */
    SVG2.style(this.$, ...rules);
    return this;
}

ralign(pos, dim) {
/* Align the element based on its bounding box */
    let svg = this.svg;
    let x, y;
    let box = this.element.getBBox();
    let [w, h] = [box.width, box.height];
    if (w * h == 0) console.warn("Aligning group with 0 width or height:", this);
    [w, h, x, y] = this.rect_xy([w.toFixed(2), h.toFixed(2)], pos);
    if (dim == "x") y = box.y;
    else if (dim == "y") x = box.x;
    let [dx, dy] = new RArray(x,y).minus([box.x, box.y]);
    this.shift_by([dx / svg.scale[0], dy / svg.scale[1]]);
    return this.update_transform();
}

align(xy, x, y) {
/* Align the element based on its bounding box */
    let box = this.element.getBBox();
    let [w, h] = [box.width, box.height];
    if (w * h == 0) console.warn("Aligning group with 0 width or height:", this);
    if (typeof(xy) == "number") xy = [xy, xy];
    if (y == null) {
        if (x == null) x = y = 0.5;
        else if (typeof(x) == "string")
            [x, y] = {top: [0.5, 0], bottom: [0.5, 1], left: [0, 0.5], right: [1, 0.5]}[x];
    }
    let nx = x == null;
    let ny = y == null;
    let dxy = this.svg.p2a(box.x + (nx ? 0 : x) * w, box.y + (ny ? 0 : y) * h).plus(this._shift);
    dxy = this._cs(xy).minus(dxy);
    if (nx) dxy[0] = 0;
    if (ny) dxy[1] = 0;
    this._shift = this._shift.plus(dxy);
    return this.update_transform();
}


/** Kinematics getters and setters **/

get pivot() {return this._pivot};
get shift() {return this._shift};
get vel() {return this._vel}
get acc() {return this._acc}
get theta() {return this._theta}

set pivot(xy) {this._pivot = new RArray(...this._cs(xy))}
set shift(xy) {this._shift = new RArray(...this._cs(xy))}
set vel(xy) {this._vel = new RArray(...this._cs(xy))}
set acc(xy) {this._acc = new RArray(...this._cs(xy))}

set theta(a) {
    if (this.thetaMode) {
        while (a >= 360) a -= 360;
        while (a < 0) a += 360;
    }
    this._theta = a;
}

shift_by(xy) {
    this._shift = this._shift.plus(this._cs(xy));
    return this.update_transform();
}


/** Clipping **/

clip_path(id, clone) {
/* Clone or move the <g> content to a <clip_path> */
    let e = this.$;
    let cp = $(document.createElementNS(SVG2.nsURI, "clip_path")).attr({id: id});
    cp.appendTo(this.svg.defs[0]);
    if (clone) cp.html(e.html());
    else e.children().appendTo(cp);
    let tr = e.attr("transform");
    if (tr) cp.children().attr({"transform": tr});
    return cp;
}

clip(id) {
/* Set the clip-path attribute */
    this.$.attr({"clip-path": `url(#${id})`});
    return this;
}


/** Coordinate transformations **/

get parent() {
    let p = this.$.parent().closest("g, svg");
    return p.length ? p[0].graphic : null;
}

gpath() {
/* Return a path array from the <svg> element to the current <g> */
    let p = this.parent;
    let a = [this];
    return p ? p.gpath().concat(a) : a;
}

coord_from_parent(xy) {
/* Apply rotation and shift to convert parent <g> coordinates xy relative to child */
    let a = this.theta * this.svg.angleDir;
    xy = this._shift.neg().plus(xy);
    return transform({angle: a, deg: true, center: this._pivot}, xy)[0];
}

coord_to_parent(xy) {
/* Apply rotation and shift to convert child <g> coordinates xy relative to parent */
    let a = this.theta * this.svg.angleDir;
    return transform({angle: -a, deg: true, center: this._pivot, shift: this._shift}, xy)[0];
}

coord_to_svg(xy) {
/* Apply rotation and shift to convert <g> coordinates xy relative to <svg> */
    let g = this;
    while (g.parent) {
        xy = g.coord_to_parent(xy);
        g = g.parent;
    }
    return xy;
}

coord_from_svg(xy) {
/* Apply rotation and shift to convert <svg> coordinates xy relative to <g> */
    let p = this.gpath();
    for (let i=1;i<p.length;i++) {
        xy = p[i].coord_from_parent(xy);
    }
    return xy;
}


/** Update animated <g> elements **/

update_transform() {
/* Calculate and set the transform attribute */
    let svg = this.svg;
    let a = this.theta * svg.angleDir;
    let [x, y] = svg.scale.times(this.shift);
    let f = (x) => x.toFixed(svg.decimals);
    let t = x || y ? `translate(${f(x)} ${f(y)})` : "";
    if (a) {
        let [px, py] = svg.a2p(...this.pivot);
        t += ` rotate(${f(a)} ${f(px)} ${f(py)})`;
    }
    t = t.trim();
    if (t.length) this.$.attr("transform", t);
    else this.$.removeAttr("transform");
    return this;
}

update(dt) {
/* Update kinematics */
    let alpha = this.alpha;
    let omega = this.omega;
    if (alpha) {
        this.omega += dt * alpha;
        omega += dt / 2 * alpha;
    }
    if (omega) this.theta = this.theta + dt * omega;
    let v = this._vel;
    let a = this._acc;
    if (v || a) {
        let dv = a.times(dt / 2);
        v = v.plus(dv);
        this._vel = v.plus(dv);
        this._shift = this._shift.plus(v.times(dt));
    }
    return this.update_transform();
}

get animated() {return this.svg.items.indexOf(this) > -1}
set animated(a) {SVG2.set_animated(this, a)}


/** Create child elements within <svg> or <g> element **/

create_child(tag, attr) {
/* Create a child element of the <g> element */
    let c = $(document.createElementNS(SVG2.nsURI, tag));
    return c.attr(attr ? attr : {}).appendTo(this.element);
}

group(...css) {
    let g = new SVG2g(this.svg, this.create_child("g"));
    if (css) g.css(...css);
    return g;
}

scaled(s) {return new SVG2scaled(this.svg, this.create_child("g"), s)}

_px(x, i) {return Math.abs(typeof(x) == "string" ? parseFloat(x) : x * this.svg.scale[i])}

_cs(xy) {
    let [x, y] = xy == null ? [0, 0] : xy;
    let svg = this.svg;
    let [sx, sy] = svg.scale;
    if (typeof(x) == "string") x = parseFloat(x) / Math.abs(sx);
    if (typeof(y) == "string") y = parseFloat(y) / Math.abs(sy);
    return new RArray(x, y);
}

circle(r, posn, selector) {
/* Modify or append a <circle> to the <g> element */
    let e = selector ? $($(selector)[0]) : this.create_child("circle");
    let svg = this.svg;
    let f = (x) => x.toFixed(svg.decimals);
    r = svg._px_size(r);
    let d = `${f(2*r)}`;
    let [w, h, x, y] = this.rect_xy([d, d], posn);
    return e.attr({r: f(r), cx: f(x + w / 2), cy: f(y + h / 2)});
}

ellipse(r, posn, selector) {
/* Modify or append an <ellipse> to the <g> element */
    let e = selector ? $($(selector)[0]) : this.create_child("ellipse");
    let svg = this.svg;
    let f = (x) => x.toFixed(svg.decimals);
    let rx = this._px(r[0], 0);
    let ry = this._px(r[1], 1);
    let [w, h, x, y] = this.rect_xy([f(2*rx), f(2*ry)], posn);
    return e.attr({rx: f(rx), ry: f(ry), cx: f(x + w / 2), cy: f(y + h / 2)});
}

static _anchor(posn) {
    if (posn == null) posn = [0, 0];
    if (posn.length == 4) return posn;
    if (posn[0] instanceof Array) return [...posn[0], ...posn[1]];
    return [...posn, 0.5, 0.5];
}

rect_xy(size, posn) {
    let [x, y, ax, ay] = SVG2._anchor(posn);
    let svg = this.svg;
    let w = this._px(size[0], 0);
    let h = this._px(size[1], 1);
    [x, y] = svg.a2p(...this._cs([x, y]));
    return [w, h, x - ax * w, y - ay * h];
}

rect(size, posn, selector) {
/* Modify or append a <rect> to the <g> element */
    let e = selector ? $($(selector)[0]) : this.create_child("rect");
    let f = (x) => x.toFixed(this.svg.decimals);
    let [w, h, x, y] = this.rect_xy(size, posn);
    return e.attr({width: f(w), height: f(h), x: f(x), y: f(y)});
}

async image_promise(href, selector) {
/* Modify or append an <image> to the <g> element */
    href = new URL(href, location.href).href;
    let e = selector ? $($(selector)[0]) : this.create_child("image");
    return load_img(href).then(img => {
        let img$ = $(img).appendTo("body");
        let bbox = {width: img$.width(), height: img$.height()};
        img$.remove();
        return [e.attr({href: href, x: 0, y: 0}), bbox];
    })
}

_img_size(size, bbox) {
    if (!size) size = {scale: 1};
    let s = size.scale;
    if (s) {
        let [w, h] = [bbox.width, bbox.height];
        if (!(w && h)) console.warn("Sizing image with a dimension of 0")
        size = [(s * w).toFixed(2), (s * h).toFixed(2)];
    }
    else if (!(size instanceof Array)) size = [size, size];
    return size;
}

async image(href, size, posn, selector) {
    return this.image_promise(href, selector).then(e => {
        let bbox = e[1];
        e = e[0];
        size = this._img_size(size, bbox);
        let [w, h, x, y] = this.rect_xy(size, posn);
        let f = (x) => x.toFixed(this.svg.decimals);
        return e.attr({width: f(w), height: f(h), x: f(x), y: f(y)});
    });
}

async mjax(tex, size, posn, color) {
/* Asynchronously render LaTeX to <image> with MathJax */
    let g = this.group();
    let img = g.create_child("image");
    if (size == null) size = {scale: 1};
    if (size.scale) size = {scale: size.scale / 32};
    if (color) tex = `\\color{${color}}{${tex}}`;
    return mjax_svg(tex).then(svg => {
        svg.appendTo("body");
        let bbox = svg[0].getBBox();
        svg.remove();
        size = this._img_size(size, bbox);
        let [w, h, x, y] = this.rect_xy(size, posn);
        let f = (x) => x.toFixed(this.svg.decimals);
        let url = "data:image/svg+xml;base64," + unicode_to_base64(svg[0].outerHTML);
        img.attr({href: url, width: f(w), height: f(h), x: f(x), y: f(y)});
        return g;
    });
}

plot(points, size, href, theta) {
/* Plot an array of points as circles, rectangles, or images */
    let g = this.group(".Plot", "black@1", "#0065fe");
    let svg = this.svg;
    let f = (x) => x.toFixed(svg.decimals);
    if (theta) theta *= svg.angleDir;
    if (!(points instanceof Array)) points = zip(points.x, points.y);
    for (let pt of points) {
        let e;
        if (href) {
            e = g.group().config({pivot: pt});
            e.image(href, size, pt);
            e = e.$;
        }
        else if (size instanceof Array) e = g.rect(size, pt);
        else e = g.circle(size, pt);
        if (theta) {
            let [x, y] = svg.a2p(...pt);
            e.attr({transform: `rotate(${f(theta)} ${f(x)},${f(y)})`});
        }
    }
    return g;
}

label(fn, x, y) {
/** Add a <g> containing <text> labels or tick marks as <line>, Usage:
 .label(["-5", "3"], [...range(-15, 31, 5)], 1); // Draw ticks from 5 pixels below x=1 to 3 pixels above
 .label(1, [...range(-15, 31, 5)], 2);           // Label x-axis to 1 decimal place at y=2
 .label(0, 0, [...range(-5, 5, 1)]);             // Label y-axis to 0 decimal places at x=0
 .label(f, 0, [...range(-5, 5, 1)]);             // Label y-axis at x=0 with function f generating text
**/
    let g = this.group();
    let xa = x instanceof Array;
    let ya = y instanceof Array;
    let tm, tp;
    if (fn instanceof Array) {
        [tm, tp] = fn;
        [tm, tp] = xa ? [this._cs([0, tm])[1], this._cs([0, tp])[1]] : [this._cs([tm, 0])[0], this._cs([tp, 0])[0]];
    }
    else if (typeof(fn) == "number") {
        let dec = fn;
        fn = xa ? (x) => x.toFixed(dec) : (x, y) => y.toFixed(dec);
    }
    let tick = tm || tp;
    let n = xa ? x.length : y.length;
    for (let i=0;i<n;i++) {
        let x0 = xa ? x[i] : x;
        let y0 = ya ? y[i] : y;
        let [xc, yc] = this._cs([x0, y0]);
        if (tick) {
            if (!ya) g.line([xc, yc + tm], [xc, yc + tp]);
            else if (!xa) g.line([xc + tm, yc], [xc + tp, yc]);
        }
        else {
            let txt = g.text(fn(x0, y0, i), [xc, yc]);
            if (parseFloat(txt.html()) == 0) txt.addClass("Zero");
            // let txt = g.gtext(fn(x0, y0, i), [], [xc, yc]);
            // if (parseFloat(txt.$.children("text").html()) == 0) txt.addClass("Zero");
        }
    }
    if (tick) g.css("black@1").$.addClass(`Ticks Tick${ya ? 'Y' : 'X'}`);
    else {
        g.css("text", 15).$.addClass(`Labels Label${ya ? 'Y' : 'X'}`);
        if (ya) g.css({"text-anchor": "end"});
    }
    return g;
}

tick_label(fn, x, y, tick, offset) {
/* Draw and label tick marks along axis */
    let t = ["number", "string"].indexOf(typeof(tick)) >= 0;
    let xa = x instanceof Array;
    if (tick) this.label(t ? [0, tick] : tick, x, y);
    if (offset == null) offset = 0;
    if (xa) this.label(fn, x, offset);
    else this.label(fn, offset, y);
    return this;
}

poly(points, closed) {
/* Modify or append a <polygon> or <polyline> to the <g> element */
    let attr = {points: this.svg.pts_str(points)};
    return $(closed)[0] instanceof SVGElement ? $(closed).attr(attr) :
        this.create_child(closed ? "polygon" : "polyline", attr);
}

_cs_size(r) {return typeof(r) == "string" ? parseFloat(r) / this.svg.unit : r}
_px_size(r) {return typeof(r) == "string" ? parseFloat(r) : r * this.svg.unit}

star(n, far, near) {
    let pts = star_points(n, this._cs_size(far), near == null ? null : this._cs_size(near));
    return this.poly(pts, 1);
}

arrow(pts, options, anchor) {return new SVG2arrow(this, pts, options, anchor)}
locus(eq, param, args) {return new SVG2locus(this, eq, param, args)}
path(start) {return new SVG2path(this, start)}

line(p1, p2, selector) {
/* Modify or append a <line> to the <g> element */
    let e = selector ? $($(selector)[0]) : this.create_child("line");
    let svg = this.svg;
    let f = (x) => x.toFixed(svg.decimals);
    let [x1, y1] = svg.a2p(...this._cs(p1));
    let [x2, y2] = svg.a2p(...this._cs(p2));
    return e.attr({x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2)});
}

chevron(xy, dir, size) {
    if (size == null) size = "7";
    let ratio = size.ratio;
    if (!ratio) ratio = 1;
    else size = size.size;
    let svg = this.svg;
    let s = svg.scale;
    size = this._px_size(size);
    let dx = -size / s[0], dy = ratio * size / s[1];
    let g = this.group();
    g.poly([[dx, dy], [0, 0], [dx, -dy]]);
    return g.config({shift: xy, theta: dir ? dir : 0});
}

ray(p1, p2, size, ...pos) {
/* Draw a directed segment */
    let g = this.group();
    g.$.addClass("Ray");
    g.line(p1, p2);
    let seg = g.seg = new Segment(...p1, ...p2);
    let svg = this.svg;
    let L = seg.length;
    if (pos.length == 0) pos = [0.5];
    for (let pt of pos) g.chevron(seg.point(pt * L), svg.adjust_angle(seg.deg), size);
    return g;
}

grid(x, y, appendAxes) {
/* Draw a coordinate grid */
    let g = this.group("grid");
    this._grid(g, x, y);
    this._grid(g, y, x, 1);
    let e = g.$.addClass("Grid");
    if (appendAxes == null || appendAxes) // Modified!
        e.find(".Axis").appendTo(e);
    return g;
}

_grid(g, x, y, swap) {
/* Draw the x (swap=false) OR y (swap=true) portion of the coordinate grid */
    if (x.length == 3) {
        let [x0, x1, dx] = x;
        let [y0, y1] = y;
        [x0, x1] = [Math.min(x0, x1), Math.max(x0, x1)];
        [y0, y1] = [Math.min(y0, y1), Math.max(y0, y1)];
        if (dx < 0) dx = -dx;
        let ddx = dx / 1000;
        x1 += ddx;
        while (x0 <= x1) {
            let pts = swap ? [[y0, x0], [y1, x0]] : [[x0, y0], [x0, y1]];
            let line = g.line(...pts);
            if (Math.abs(x0) < ddx) line.addClass("Axis").css({stroke: "black", "stroke-width": "1px"});
            x0 += dx;
        }
    }
}

text(data, xy, selector) {
/* Add a <text> element to the group */
    let svg = this.svg;
    let e = selector ? $($(selector)[0]) : this.create_child("text");
    let f = (x) => x.toFixed(svg.decimals);
    let [x, y] = svg.a2p(...this._cs(xy));
    return e.attr({x: f(x), y: f(y)}).html(data);
}

gtext(data, css, posn) {
/* Create a <g> element with an aligned <text> child */
    if (!(css instanceof Array)) css = [css];
    let g = this.group(...css);
    g.text(data);
    return g.ralign(posn);
}

// symbol(...args) { // Deprecated!
//     let g = this.group(".Symbol");
//     for (let [s, f, xy, opt] of args) {
//         let txt = g.text(s, xy);
//         if (f & 4) txt.addClass("Small");
//         if (f & 2) txt.css(SVG2._style.ital);
//         if (f & 1) txt.css(SVG2._style.bold);
//         if (opt) {
//             if (opt.size) txt.css({"font-size": `${opt.size}px`});
//         }
//     }
//     return g;
// }

symb(...args) { // Deprecated!!
/* Render a symbol from a list of text elements */
//  BOLD = 1, ITAL = 2, SMALL = 4
    let g = this.group(".Symbol");
    let szStr = (s) => typeof(s) == "number" ? `${size}px` : s;
    // if (size) g.css("symbol", {"font-size": szStr(size)});
    for (let [s, opt, pos] of args) {
        let f = 0;
        if (typeof(opt) == "number") [f, opt] = [opt, null];
        let txt = g.text(s, pos);
        if (f & 4) txt.css({"font-size": "60%"});
        if (f & 1) txt.css(SVG2._style.bold);
        if (f & 2) txt.css(SVG2._style.ital);
        if (opt) {
            if (opt.size) txt.css({"font-size": szStr(opt.size)});
            if (opt.css) txt.css(opt.css);
        }
    }
    return g;
}

ctext(...args) {
/* Render multiple aligned <g> elements with <text> child nodes */
    let gs = [];
    for (let [t, posn, options] of args) {
        if (options == null) options = {};
        if (typeof(options) == "string") options = {css: options};
        let g = this.gtext(t, options.css ? options.css : [], posn);
        if (options.config) g.config(options.config);
        gs.push(g);
    }
    return gs;
}

// multiline(text, space) {
// /* Render multiple lines of text */
//     if (!space) space = "20";
// 	let g = this.group();
// 	let y = 0;
// 	if (typeof(space) == "string") space = parseFloat(space) / Math.abs(this.svg.scale[1]);
// 	for (let t of text.split("\n")) {
// 		g.text(t, [0, y]);
// 		y -= space;
// 	}
// 	return g;
// }

// flow(text, shape, options) {
// /* Render a flow chart element */
// 	let g = this.group();
// 	if (shape == "d") {
// 		let [sx, sy] = this.svg.scale;
// 		let w = this._cs([options.width, 0])[0] / Math.sqrt(2);
// 		g.group().config({theta: 45}).rect([w, w * Math.abs(sx/sy)]);
// 	}
// 	else {
// 		let wh = new RArray(...this._cs(options.size));
// 		if (shape == "r") g.rect(wh);
// 		else if (shape == "e") g.ellipse(wh.times(0.5));
// 		else if (shape == "p") {
// 			let [x, y] = wh.times(0.5);
// 			let d = (options.slant ? options.slant : 0.15) * x;
// 			g.poly([[d-x, y], [x+d, y], [x-d, -y], [-x-d, -y]], 1);
// 		}
// 	}
// 	g.multiline(text, options.space).align([0, 0]);
// 	return g;
// }

ruler(n, tick, opt) { //width, big, offset, tickSmall, tickBig) {
/* Draw a ruler */
    if (typeof(tick) == "string") tick = parseFloat(tick) / Math.abs(this.svg.scale[1]);
    opt = Object.assign({big: 10, offset: 0, tickSmall: 0.25, tickBig: 0.5}, opt);
    let g = this.group(".Ruler");
    let length = g.rulerLength = tick * (n + 2 * opt.offset);
    let width = opt.width ? opt.width : g.rulerLength / 25;
    g.rect([length, width]);
    let x = tick * opt.offset - length / 2;
    width /= 2;
    for (let i=0;i<=n;i++) {
        g.line([x, -width], [x, width * (2 * (i % opt.big ? opt.tickSmall : opt.tickBig) - 1)]);
        x += tick;
    }
    return g;
}

cylinder(r, L) {
/* Draw a cylinder; pivot is center of the elliptical "top" */
    let g = this.group(".Cylinder");
    let p1 = new RArray(r[0], 0);
    let p2 = p1.neg().minus([0, L]);
    let c = g.svg.angleDir == -1 ? 2 : 0;
    g.path(p1).ver(-L).arc_to(p2, r, c).ver(0).arc_to(p1, r).close().update();
    g.ellipse(r);
    return g;
}

pm(s, plus, xy) {
/* Draw a plus or minus */
    let g = this.group();
    if (plus) g.rect([s/6, s], xy);
    g.rect([s, s/6], xy);
    return g;
}

stickman(h) {
/* Add a stick man as an SVG2g instance */
    let g = this.group(".Stickman", "none", "black@3");
    let r = h / 8;
    g.circle(r, [0, 7 * r]);
    g.line([0, 6 * r], [0, 3 * r]);
    let w = 1.2 * r;
    g.poly([[-w, 0], [0, 3 * r], [w, 0]]);
    let pt = new RArray(0, 5 * r);
    r *= 1.5;
    g.poly([pt.plus(vec2d(r, uniform(150, 210))), pt, pt.plus(vec2d(r, uniform(-30, 30)))]);
    return g;
}

edot(n, r) {
/* Electron dot diagram */
    if (!r) r = 1;
    let d = 0.25 * r;
    let pts = [[-r, d], [-r, -d]];
    if (n == -1) n = 2;
    else {
        pts = [[-r, 0], [0, r], [r, 0], [0, -r], [-r, 0], [0, r], [r, 0], [0, -r]];
        if (n > 4) {
            for (let i=0;i<n-4;i++) {
                pts[i][1 - i % 2] = d;
                pts[i + 4][1 - i % 2] = -d;
            }
        }
    }
    let g = this.group({stroke: "none"});
    for (let i=0;i<n;i++) g.circle(0.125 * r, pts[i]);
    return g;
}

graph(options) {
/* Add common scatter plot / line graph elements */
    let svg = this.svg;
    let x = options.x, y = options.y;
    if (options.grid) {
        let [dx, dy] = options.grid;
        let [l, r, b, t] = svg.lrbt;
        l = dx * Math.round(l / dx);
        r = dx * Math.round(r / dx);
        b = dy * Math.round(b / dy);
        t = dy * Math.round(t / dy);
        this.grid([l, r, dx], [b, t, dy], options.appendAxes);
    }

    if (x || y) {
        let txt = this.group(".AxisTitle", "text");
        let xy = (i) => {
            let pos = (i ? y : x).title[1];
            if (!(pos instanceof Array)) pos = i ? [pos, svg.center[1]] : [svg.center[0], pos];
            return pos;
        }
        if (x) {
            let dy = [0, x.y ? x.y : 0];
            if (x.tick) {
                this.tick_label(x.dec ? x.dec : 0, [...range(...x.tick)], 0, x.tickSize ? x.tickSize : "-6");
                this.find("g.LabelX").config({shift: x.shift}).shift_by(dy);
                this.find("g.TickX").shift_by(dy);
            }
            if (x.title) txt.group().shift_by(dy).text(x.title[0], xy(0));
        }
        if (y) {
            let dx = [y.x ? y.x : 0, 0];
            if (y.tick) {
                this.tick_label(y.dec ? y.dec : 0, 0, [...range(...y.tick)], y.tickSize ? y.tickSize : "-6");
                this.find("g.LabelY").config({shift: y.shift}).shift_by(dx);
                this.find("g.TickY").shift_by(dx);
            }
            if (y.title) txt.group().config({theta: 90, shift: xy(1)}).shift_by(dx).text(y.title[0]);  
        }  
    }

    let data = options.data;
    if (data) {
        let g = this.group(".Series"), s = [];
        for (let series of data) {
            if (series.plot) s.push(g.plot(...series.plot));
            else {
                let gs = g.group(".Locus", "#0065fe@2", "none");
                s.push(gs);
                if (series.connect) {
                    let pts = series.connect;
                    if (!(pts instanceof Array)) pts = zip(pts.x, pts.y);
                    gs.poly(pts);
                }
                else if (series.locus) gs.locus(...series.locus);
            }
        }
        this.series = s;
    }
    return this;
}

error_bar_y(x, y0, y1, dx, _swap) {
    /* Draw x or y error bars */
    dx = this._cs_size(dx);
    let g = this.group().addClass("ErrorBar");
    if (_swap) {
        g.line([y0, x], [y1, x]);
        x -= dx / 2;
        g.line([y0, x], [y0, x + dx]);
        g.line([y1, x], [y1, x + dx]);    
    }
    else {
        g.line([x, y0], [x, y1]);
        x -= dx / 2;
        g.line([x, y0], [x + dx, y0]);
        g.line([x, y1], [x + dx, y1]);    
    }
    return g;
}

error_bar_x(x0, x1, y, dy) {return this.error_bar_y(y, x0, x1, dy, 1)}


tip_to_tail(vecs, options) {
/* Draw a 2D "tip-to-tail" vector diagram */
    if (options == null) options = {};
    let g = this.group(".TipToTail2D");
    let pt = new RArray(0, 0);
    let opt = Object.assign({tail: "7"}, options);
    for (let v of vecs) {
        let pt0 = pt;
        let tmp = pt0.plus([v[0], 0]);
        pt = pt.plus(v);
        if (v[0] || v[1]) {
            if (v[0]) g.arrow({tail: pt0, tip: tmp}, opt).css(".Component");
            if (v[1]) g.arrow({tail: tmp, tip: pt}, opt).css(".Component");
            g.arrow({tail: pt0, tip: pt}, opt);
        }
    }
    if (vecs.length > 1) {
        if (pt[0] && pt[1]) {
            let tmp = [pt[0], 0];
            g.arrow({tail: [0, 0], tip: tmp}, opt).$.addClass("Component Resultant");
            g.arrow({tail: tmp, tip: pt}, opt).$.addClass("Component Resultant");
        }
        g.arrow({tail: [0, 0], tip: pt}, opt).$.addClass("Resultant");    
    }
    return g;
}

energy_flow(data) {
/* Draw an energy flow diagram */
    SVG2.style(this.circle(data.radius), "none", "#0065fe@3");
    let g = this.group("text", 24);
    let getTeX = (t) => t.charAt(0) == '$' ? t.substring(1) : (SVG2.eq[t] ? SVG2.eq[t] : null);
    for (let item of data.labels) {
        let [txt, pos, color, shift] = item;
        let tex = getTeX(txt);
        if (tex && txt.charAt(0) != "$") console.log(txt, tex);
        if (!color) color = "#0065fe";
        if (tex) this.mjax(tex, {scale: 1}, pos, color);
        else g.gtext(txt, color, pos);
    }
    g = this.group("arrow");
    for (let item of data.arrows) {
        let [l, pos, angle, txt, color] = item;
        if (!color) color = "#0065fe";
        let a = this.arrow(l, {tail: "6"}).css(color).config({theta: angle, shift: pos});
        if (txt) {
            if (!(txt instanceof Array)) txt = [txt, [l > 0 ? "-6": "6", "12"]];
            a.label(...txt).css({stroke: "none"});
        }
    }
    return this;
}

coil(size, n, reverse, r, axle) {
/* Draw a coil frame with turns of wire and axle */
    let g0 = this.group();
    g0.$.addClass("Coil");
    let g = reverse ? g0.scaled([-1, 1]) : g0;
    let [w, h] = size;
    if (!n) n = 15;
    if (!r) r = h / n / 4;
    g.rect(size);
    for (let i=0;i<n+0.5;i++) {
        let y = (h - 6 * r) * (i - n / 2) / n;
        let path = g._turn(size[0], r, i == n ? 2 : 3).config({shift: [0, y]});
        path.$.addClass("Wire");
        if (i == 0 || i == n) {
            y += r * (i ? 2 : -2);
            g.line([w / 2, y], [w / 2 + 2 * r, y]).addClass("Wire");
        }
    }
    if (axle == null) axle = 0.7 * r;
    if (axle) g.circle(axle);
    return g0;
}

_turn(w, r, circ) {
/* Render a turn of wire as a path */
    let g = this.group();
    if (circ == null) circ = 0;
    w /= 2;
    let p = g.path([w, circ & 1 ? 4 * r : 2 * r]);
    if (circ & 1) p.arc([w, 3 * r], -90);
    p.line_to([-w, -2 * r]);
    if (circ & 2) p. arc([-w, -r], 90, 2);
    p.update();
    return g;
}

}


class SVG2scaled extends SVG2g {

constructor(parent, g, scale) {
    super(parent, g);
    let svg = this.svg;
    let f = (x) => x.toFixed(svg.decimals);
    let [x, y] = svg.a2p(0, 0);
    x = f(x); y = f(y);
    let xn = f(-x), yn = f(-y);
    let [sx, sy] = this.scale = typeof(scale) == "number" ? [scale, scale] : scale;
    this.$.attr({transform: `translate(${x} ${y}) scale(${sx} ${sy}) translate(${xn} ${yn}) `});
}

get pivot() {return new RArray(0, 0)};
get shift() {return new RArray(0, 0)};
get theta() {return 0}

update_transform() {return this}

coord_to_parent(xy) {
    let [sx, sy] = this.scale;
    return new RArray(xy[0] * sx, xy[1] * sy);
}

coord_from_parent(xy) {
    let [sx, sy] = this.scale;
    return new RArray(xy[0] / sx, xy[1] / sy);
}

}


class SVG2arrow extends SVG2g {

constructor(g, info, options, anchor) {
    super(g);
    this.$.addClass("Arrow");
    this._poly = this.poly([], 1);
    this.reshape(info, options, anchor);
}

reshape(info, options, anchor) {
    let tail_and_tip = (info) => {
        if (typeof(info) == "number") return [[-info / 2, 0], [info / 2, 0]];
        else {
            let tail = info.tail;
            let tip = info.tip;
            if (tail == null) tail = [0, 0];
            if (tip == null) {
                let angle = info.angle;
                tip = vec2d(info.length, angle ? angle : 0).plus(tail);
            }
            return [tail, tip];
        }
    }

    let svg = this.svg;
    let [tail, tip] = tail_and_tip(info);
    tail = svg._cs(tail);
    tip = svg._cs(tip);
    let seg = this.seg = new Segment(...tail, ...tip);
    if (!anchor) anchor = 0;
    else if (typeof(anchor) == "string") anchor = ["tail", "center", "tip"].indexOf(anchor) - 1;
    this.pivot = seg[anchor == -1 ? "point1" : (anchor == 1 ? "point2" : "midpoint")];
    let f = (x) => Math.abs(typeof(x) == "string" ? parseFloat(x) : x * svg.scale[1]);
    let opt = {};
    if (options) {
        opt = Object.assign(opt, options);
        if (opt.tail) opt.tail = f(opt.tail);
        if (opt.head) opt.head = f(opt.head);    
    }
    seg = new Segment(...svg.a2p(...tail), ...svg.a2p(...tip));
    let pts = arrow_points(seg.length, opt);
    pts = transform({angle: seg.deg, deg: true, shift: seg.midpoint}, ...pts);
    for (let i=0;i<pts.length;i++) pts[i] = svg.p2a(...pts[i]);
    this.poly(pts, this._poly);
    return this;
}

label(text, shift) {
/* Add text relative to arrow midpoint */
    return this.gtext(text, ["text", "none@"], this.seg.midpoint.plus(this._cs(shift)));
}

}


class SVG2locus {

constructor(g, eq, param, args) {
    let svg = this.svg = g.svg;
    this.eq = eq;
    if (!param) param = [svg.lrbt[0], svg.lrbt[1]];
    this.param = param.length > 2 ? param : param.concat([svg.$.width() / 3]);
    this.args = args;
    this.$ = g.create_child("polyline", {}).addClass("Locus");
    this.css("none");
    this.element = this.$[0];
    this.element.graphic = this;
    this.update();
}

css = SVG2g.prototype.css;

config(attr) {
/* Encapsulate multiple attributes */
    for (let k in attr) this[k] = attr[k];
    return this;
}

update() {
    let svg = this.svg;
    let t = svg.time;
    let [eq, args] = [this.eq, this.args];
    let [x0, x1, dx] = this.param;
    dx = (x1 - x0) / Math.round(dx);
    x1 += dx / 2;
    let pts = [];
    while (x0 <= x1) {
        let y = eq(x0, t, args);
        if (y === false) return;
        pts.push(typeof(y) == "number" ? [x0, y] : y);
        x0 += dx;
    }
    this.$.attr({points: svg.pts_str(pts)});
    return this;
}

get animated() {return this.svg.items.indexOf(this) > -1}
set animated(a) {SVG2.set_animated(this, a)}

}


class SVG2path {

constructor(g, xy) {
    this.g = g;
    this.svg = g.svg;
    this.$ = g.create_child("path", {});
    this.d = "";
    this.move_to(xy == null ? [0, 0] : xy);
}

move_to(xy, c) {
    let svg = this.svg;
    let f = (x) => x.toFixed(svg.decimals);
    let [x, y] = xy;        
    this.x = x;
    this.y = y;
    [x, y] = svg.a2p(...xy);
    this.d += `${c ? c : 'M'} ${f(x)} ${f(y)} `;
    return this;
}

line_to(xy) {return this.move_to(xy, "L")}

lines_to(...points) {
    for (let xy of points)
        this.line_to(xy);
    return this;
}

hor(x) { // Move horizontally
    let svg = this.svg;
    let f = (x) => x.toFixed(svg.decimals);
    this.x = x;
    x = svg.a2p(x, 0)[0];
    this.d += `H ${f(x)} `;
    return this;
}

ver(y) { // Move vertically
    let svg = this.svg;
    let f = (x) => x.toFixed(svg.decimals);
    this.y = y;
    y = svg.a2p(0, y)[1];
    this.d += `V ${f(y)} `;
    return this;
}

arc_to(xy, r, choice, rotn) { // Draw a circular or elliptical arc to the specified point
    let svg = this.svg;
    let f = (x) => x.toFixed(svg.decimals);
    let rx, ry;
    if (r instanceof Array) [rx, ry] = r;
    else rx = ry = r;
    rx = svg._px(rx, 0);
    ry = svg._px(ry, 1);
    rotn = rotn ? f(rotn * svg.angleDir) : "0";
    let [x, y] = xy;        
    this.x = x;
    this.y = y;
    [x, y] = svg.a2p(x, y);
    let large = 0, sweep = 0;
    if (choice) {
        large = choice & 1;
        sweep = choice & 2 ? 1 : 0;
    }
    this.d += `A ${f(rx)} ${f(ry)} ${rotn} ${large} ${sweep} ${f(x)} ${f(y)} `;
    return this;
}

arc(c, a, choice) { // Draw a circular arc to the specified angle
    c = new RArray(...c);
    let d = c.minus([this.x, this.y]).neg();
    let r = d.mag();
    let a0 = d.dir();
    if (choice == null) {
        choice = Math.max(a, a0) - Math.min(a, a0) >= 180 ? 1 : 0;
        if (a < a0) choice += 2;
    }
    let p1 = c.plus([r * cos(a), r * sin(a)]);
    return this.arc_to(p1, r, choice);
}

curve_to(xy, p1, p2) { // Bezier curve to the specified point using two reference points
    let svg = this.svg;
    let f = (x) => x.toFixed(svg.decimals);
    let [x, y] = xy;
    this.x = x;
    this.y = y;
    [x, y] = svg.a2p(x, y);
    let [x1, y1] = svg.a2p(...p1);
    let [x2, y2] = svg.a2p(...p2);
    this.d += `C ${f(x1)} ${f(y1)}, ${f(x2)} ${f(y2)}, ${f(x)} ${f(y)} `;
    return this;
}

quad_to(xy, p) { // Quadratic Bezier curve to the specified point
    let svg = this.svg;
    let f = (x) => x.toFixed(svg.decimals);
    let [x, y] = xy;
    this.x = x;
    this.y = y;
    [x, y] = svg.a2p(x, y);
    let [x1, y1] = svg.a2p(...p);
    this.d += `Q ${f(x1)} ${f(y1)}, ${f(x)} ${f(y)} `;
    return this;
}

close() {
    this.d += "Z ";
    delete this.x;
    delete this.y;
    return this;
}

update() {return this.$.attr({d: this.d.trim()})}

}


class SVG2 extends SVG2g {

constructor(selector, options) {
    super();
    this.svg = this;
    this.element = $(selector).filter("svg")[0];
    selector = this.$ = $(this.element).attr("xmlns", SVG2.nsURI);
    this.element.graphic = this;
    this.items = [];
    this.decimals = 2;

    /* <svg> element size */
    let margin = options.margin ? options.margin : 0;
    if (typeof(margin) == "number") margin = [margin, margin, margin, margin];
    let lrbt = options.lrbt;
    let s = options.scale;
    if (s && !(s instanceof Array)) s = [s, s];
    let [w, h] = options.size ? options.size :
        (s && lrbt.length > 3 ? [s[0] * (lrbt[1] - lrbt[0]) + margin[0] + margin[1] + 1, s[1] * (lrbt[3] - lrbt[2]) + margin[2] + margin[3] + 1] :
            [selector.width(), selector.height()]);
    w = Math.abs(Math.round(w));
    h = Math.abs(Math.round(h));
    selector.attr({width: w, height: h, "data-aspect": w/h, viewBox: `0 0 ${w} ${h}`});

    /* Coordinate system */
    if (lrbt) {
        let [l, r, b, t] = margin;
        if (lrbt.length < 4)
            lrbt = SVG2.auto_lrbt(w - margin[0] - margin[1], h - margin[2] - margin[3], ...lrbt);
        this.coords_by_map([l, h - 1 - b], [lrbt[0], lrbt[2]], [w - 1 - r, t], [lrbt[1], lrbt[3]]);
    }
    else {
        lrbt = [0, w - 1, 0, h - 1];
        this.coords_by_map([0, 0], [0, 0], [1, 1], [1, 1]);
        this.p2a = this.a2p = (x, y) => new RArray(x, y);
    }
    this.lrbt = lrbt;

    /* Draw coordinate grid */
    let grid = options.grid;
    if (grid) {
        let [gx, gy] = typeof(grid) == "number" ? [grid, grid] : grid;
        let x0 = gx * Math.round(lrbt[0] / gx);
        let y0 = gy * Math.round(lrbt[2] / gy);
        let g = this.grid([x0, lrbt[1], gx], [y0, lrbt[3], gy], options.appendAxes);
        if (options.noAxes) g.$.find(".Axis").removeClass("Axis").css(SVG2._style.grid);
    }

    /* Animation data */
    this.playing = false;
    this.frameRate = 60;
    this.frameCount = 0;
    this.timeFactor = 1;
    this.time = 0;
}

static async sleep(t) {await new Promise(r => setTimeout(r, t))}

static arr(dy) {return ["→", 5, [0, dy == null ? "20" : dy]]}

get size() {
    let e = this.$;
    return [parseFloat(e.attr("width")), parseFloat(e.attr("height"))];
}

get url() {return "data:image/svg+xml;base64," + unicode_to_base64(this.element.outerHTML)}

static async cleanup_svg(svg, bg) {
    // Make new SVGElement without class or style attributes
    svg = $(svg).removeAttr("class style");

    // Remove all data-* attributes
    let attr = svg[0].attributes;
    let keys = [];
    for (let i=0;i<attr.length;i++) {
        let a = attr.item(i);
        if (a.name.split("-")[0] == "data") keys.push(a.name);
    }
    for (let k of keys) svg.removeAttr(k);

    // Add background
    if (bg) {
        svg.appendTo("body");
        let r = $(document.createElementNS(SVG2.nsURI, "rect")).prependTo(svg);
        // console.log(r);
        r.attr({x:0, y:0, width: svg.width(), height: svg.height(), style: `fill: ${bg}`});
        svg.remove();
    }

    // Get <image> list
    let hrefs = [];
    let imgs = [];
    for (let img of svg.find("image")) {
        let href = $(img).attr("href");
        if (href.substring(0, 5) != "data:") {
            imgs.push(img);
            hrefs.push(href);
        }
    }

    // Load images as data URLs
    return load_dataURLs(...hrefs).then(map => {
        for (let i=0;i<hrefs.length;i++) {
            let href = map[hrefs[i]];
            $(imgs[i]).attr({href: href});
        }
        return svg[0];
    });
}

static async svg_to_cv(svg, scale) {
    /* Convert and scale <svg> to <canvas> */
    return load_img("data:image/svg+xml;base64," + unicode_to_base64(svg.outerHTML)).then(img => {
        let j = $(img).appendTo("body");
        let cv = img2canvas(img, scale);
        j.remove();
        return cv;
    });
}

async image_cv(scale, bg) {
    /* Return scaled drawing as <canvas> */
    return SVG2.cleanup_svg(this.element.outerHTML, bg).then(svg => SVG2.svg_to_cv(svg, scale));
}

async save(fn) {
    /* Save as SVG file */
    return SVG2.cleanup_svg(this.element.outerHTML).then(svg => blobify(svg.outerHTML, "image/svg+xml")).then(b => b.save(fn));
}

async save_image(fn, scale, bg) {
    /* Save scaled drawing as PNG/WebP/JPEG file*/
    if (fn == true) fn = `${random_string(12, 1)}.png`;
    let format = fn ? fn.split(".").item(-1).toLowerCase() : "png";
    if (format == "jpg") format = "jpeg";
    return this.image_cv(scale, bg).then(cv => blobify(cv, "image/" + format)).then(b => b.save(fn));
}

get defs() {
    let d = this.$.find("defs");
    if (d.length == 0) d = this.create_child("defs").prependTo(this.$);
    return d;
}

get center() {
    let [l, r, b, t] = this.lrbt;
    return new RArray((l + r) / 2, (b + t) / 2);
}

clip_rect(xy, id) {
/* Create a clip path that excludes the margin */
    if (xy == null) xy = 0;
    xy = this._cs(xy instanceof Array ? xy : [xy, xy]).times(2);
    let clip = this.group();
    let [l, r, b, t] = this.lrbt;
    clip.rect([Math.abs(r - l) + xy[0], Math.abs(t - b) + xy[1]], this.center);
    clip.clip_path(id ? id : "lrbt");
    return this;
}

gradient(id, c1, c2, x1, x2, y1, y2) {
/* Create a <linearGradient> */
    let elem = (t, a) => {
        let e = document.createElementNS(SVG2.nsURI, t);
        if (a != null) $(e).attr(a);
        return e;
    }

    let e = $(elem("linearGradient", {
        id: id,
        x1 : `${x1 == null ? 0 : x1}%`,
        x2 : `${x2 == null ? 100 : x2}%`,
        y1 : `${y1 == null ? 0 : y1}%`,
        y2 : `${y2 == null ? 0 : y2}%`
    })).appendTo(this.defs[0]);
    e.append(elem("stop", {offset: "0%", "stop-color" : c1}));
    e.append(elem("stop", {offset: "100%", "stop-color" : c2}));
    return this;
}

static create(options) {return new SVG2(document.createElementNS(SVG2.nsURI, "svg"), options)}

static auto_lrbt(w, h, l, r, b, t) {
/* Calculate coordinate limits so axes have the same scale */
    if (t == null) {
        let dy = (h - 1) * (r - l) / (w - 1);
        if (b == null) {
            t = dy / 2;
            b = -t;
        }
        else t = b + dy;
    }
    return [l, r, b, t];
}

update_transform() {return this}

coords_by_map(p1, a1, p2, a2) {
/* Assign an abstract coordinate system to the drawing */
    let [adx, ady] = new RArray(...a2).minus(a1);
    let [pdx, pdy] = new RArray(...p2).minus(p1);
    let sx = pdx / adx;
    let sy = pdy / ady;
    let s = this.scale = new RArray(sx, sy);
    this.unit = Math.sqrt((sx*sx + sy*sy) / 2);
    this.angleDir = sx * sy < 0 ? -1 : 1;
    let t = new RArray(-1/sx, -1/sy);
    p1 = new RArray(...p1).minus(s.times(a1));
    this.a2p = (x, y) => p1.plus(s.times([x,y]));
    this.p2a = (x, y) => p1.minus([x,y]).times(t);
}

event_coords(ev) {
/* Calculate the coordinates of a mouse event in pixels and using the SVG2 coordinate system */
    let e = this.$;
    let dx = parseFloat(e.css("padding-left")) + parseFloat(e.css("border-left-width"));
    let dy = parseFloat(e.css("padding-top")) + parseFloat(e.css("border-top-width"));
    let r = this.element.getBoundingClientRect();
    let px = new RArray(ev.clientX - (r.x + dx), ev.clientY - (r.y + dy));
    px[0] *= parseFloat(e.attr("width")) / e.width();
    px[1] *= parseFloat(e.attr("height")) / e.height();
    return {pixels: px, coords: this.p2a(...px)};
}

adjust_angle(a, invert) {
/* Adjust rotation angle when x and y scales differ */
    let [sx, sy] = this.scale;
    if (invert) {sx = 1 / sx; sy = 1 / sy}
    return atan2(sy * this.angleDir * sin(a), sx * cos(a));
}

group(...css) {
    let g = new SVG2g(this);
    if (css) g.css(...css);
    return g;
}

pts_str(pts) {
/* Create a string from an array of ordered pairs*/
    let s = "";
    let f = (x) => x.toFixed(this.decimals);
    for (let i=0;i<pts.length;i++) {
        let [x, y] = this.a2p(...this._cs(pts[i]));
        s += (s.length ? " " : "") + `${f(x)},${f(y)}`;
    }
    return s;
}


/** Animation methods **/

static set_animated(g, a) {
    let svg = g.svg;
    let items = svg.items;
    let i = items.indexOf(g);
    if (a) {if (i == -1) svg.animate(g)}
    else if (i > -1) items.splice(i, 1);
}

animate(...args) {
/* Append an array of animated SVG2g instances */
    for (let arg of args) {
        if (!arg.update) arg = $(arg)[0].graphic;
        if (this.items.indexOf(arg) == -1) this.items.push(arg);
    }
    return this;
}

unanimate(...args) {
/* Remove items from animation */
    let items = this.items;
    for (let i = items.length-1;  i >= 0; i--)
        if (args.indexOf(items[i]) > -1) items.splice(i, 1);
    return this;
}

update(dt) {
/* Update the drawing each frame */
    clearTimeout(this._animate);
    let anim = dt == null;
    if (anim) dt = this.timeFactor / this.frameRate;
    if (this.beforeupdate) this.beforeupdate.call(this);
    for (let item of this.items) {
        try {
            if (item.beforeupdate) item.beforeupdate(item);
            item.update(dt);
            if (item.afterupdate) item.afterupdate(item);
        } catch(err) {console.warn(err)}
    }
    this.time += dt;
    dt = 1000 / this.frameRate;
    let ft = this._nextFrame - Date.now();
    if (ft <= 0) {
        ft = 1;
        this._nextFrame = Date.now() + dt - 1;
    }
    else this._nextFrame += dt;
    if (anim) this.frameCount++;
    if (this.afterupdate) this.afterupdate.call(this);
    if (this.playing) this._animate = setTimeout(() => {this.update()}, ft);
    return this;
}

play() {
/* Start or resume the animation */
    this.playing = true;
    this._nextFrame = Date.now() + 1000 / this.frameRate;
    if (this._fpsDebug) this._fpsDebug = [this.frameCount, Date.now()];
    return this.update();
}

pause() {
/* Pause the animation */
    clearTimeout(this._animate);
    this.playing = false;
    if (this._fpsDebug) {
        let [n, t] = this._fpsDebug;
        n = this.frameCount - n;
        t = (Date.now() - t) / 1000;
        console.log(`${n} frames / ${t} sec = ${n/t} fps`);
    }
    return this;
}

toggle() {return this.playing ? this.pause() : this.play()}

click_toggle(n, click, init) {
    let a = [() => click_cycle.toggle(this, false, ...range(n))];
    for (let i=0;i<n;i++) a.push(() => click_cycle.toggle(this, true, i));
    click_cycle(this.element, init == null ? -1 : init, ...a);
    if (click) for (let i=0;i<click;i++)
        this.$.trigger("click");
    return this;
}


/** Load and run SVG2 JavaScripts **/

static async load(cb) {
/* Send AJAX requests for SVG2 scripts */
    let svgs = $("svg[data-svg2]");
    let pending = {};
    let ts = Date.now();
    for (let svg of svgs) {
        let [url, id, args] = $(svg).attr("data-svg2").split("#");
        url = new URL(url, SVG2.url).href;
        svg.info = [url, id, args];
        if (pending[url] == null && SVG2._cache[url] == null)
            pending[url] = fetch(`${url}?_=${ts}`).then((a) => a.text()).then(eval);
    }
    for (let p in pending) await pending[p];
    for (let svg of svgs) {
        let [url, id, args] = svg.info;
        delete svg.info;
        let data = `${url}#${id}`;
        if (args) data += `#${args}`;
        $(svg).removeAttr("data-svg2").attr("data-svg2x", data);
        if (args) {
            try {args = jeval(args)}
            catch(err) {console.warn(err)}
            if (!(args instanceof Array)) args = [args];
        }
        else args = [];
        try {SVG2._cache[url][id](svg, ...args)}
        catch(err) {console.warn(err)}
    }
    return cb ? cb() : null;
}

static cache_run(url, id, ...arg) {
    let js = SVG2._cache[new URL(url, SVG2.url).href];
    return js[id](...arg);
}

static cache(url, obj) {
/* Load SVG2 JavaScript into cache */
    SVG2._cache[new URL(url, SVG2.url).href] = obj;
}

static make_URL(url) {return new URL(url, SVG2.url).href}
static cached(url) {return SVG2._cache[new URL(url, SVG2.url).href]}


/** Vector diagram helpers **/

static vec_diag(sel, vecs, opt) {
/* Draw a vector diagram in an <svg> tag */
    let svg = new SVG2(sel, opt);
    if (!opt) opt = {};
    let g = svg.tip_to_tail(vecs);
    if (opt.shift) g.config({shift: opt.shift});
    if (opt.label) {
        let [space, n, x, y] = opt.label;
        let [l, r, b, t] = svg.lrbt;
        l = space * Math.ceil(l / space);
        b = space * Math.ceil(b / space);
        let tick = opt.tick;
        if (tick) {
            svg.tick_label(n, 0, [...range(b, t + space / 10, space)], tick, x);
            svg.tick_label(n, [...range(l, r + space / 10, space)], 0, tick, y);
        }
        else {
            svg.label(n, x, [...range(b, t + space / 10, space)]);
            svg.label(n, [...range(l, r + space / 10, space)], y);
        }
    }
    g.$.appendTo(svg.$);
    for (let s of "XY") {
        let e = svg.find(`g.Label${s}`);
        if (e) e.shift_by([0, "-5"]);
    }
    svg.$.find(".Zero").hide();
    if (opt.cycle == -1) g.$.find(".Component").hide();
    else if (opt.cycle) svg.vec_cycle(g.$, vecs.length > 1);
    g.$.find(".Arrow").css(SVG2._style.arrow);
    g.$.find(".Resultant").css({fill: "#0065fe"});
    g.$.find(".Component").css({fill: "yellow"});
    return svg;
}

vec_cycle(g, res) {
/* Default 'click_cycle' for vector diagrams */
    g.find(".Component").hide();
    if (res) click_cycle(this.element, 0,
        () => {g.find(".Component").fadeOut()},
        () => {g.find(".Resultant").fadeOut(); g.find(".Component:not(.Resultant)").fadeIn()},
        () => {g.find(".Component:not(.Resultant)").fadeOut(); g.find(".Component.Resultant").fadeIn()},
        () => {g.find(".Resultant").fadeIn()},
    );
    else this.$.on("click", () => g.find(".Component").fadeToggle());
    return this;
}

static vec_diag_table(sym, vecs, prec, scale) {
/* Compose a table showing vector addition */
    let tbl = $("<table>").addClass("VectorTable");
    let thead = $("<thead>").appendTo(tbl);
    let tr = $("<tr>").appendTo(thead);
    let v = sym.charAt(0) == "Δ" ? `\\Delta\\vec{\\bf ${sym.substring(1)}}` : `\\vec{\\bf ${sym}}`;
    for (let x of [`|${v}|`, `\\theta`, `${v}_x`, `${v}_y`])
        tr.append($("<th>").addClass("TeX").html(x));
    tr = $("<tr>").appendTo(thead);
    for (let x of [`\\sqrt{(${v}_x)^2 + (${v}_y)^2}`, `\\tan^{-1}\\frac{${v}_y}{${v}_x}`, `|${v}| \\cos\\theta`, `|${v}| \\sin\\theta`])
        tr.append($("<th>").html($("<p>").html(x).addClass("TeX")));
    let tbody = $("<tbody>").appendTo(tbl);
    let pt = new RArray(0, 0);
    for (let v of vecs) {
        if (scale) v = new RArray(...v).times(scale);
        pt = pt.plus(v);
        tbody.append(new RArray(...v).tr(prec ? prec : 4));
    }
    tbody.append(new RArray(...pt).tr(prec ? prec : 4).addClass("Resultant"));
    renderTeX(thead.find(".TeX"));
    return tbl;
}

static ebg(sel, Emax, step, data, options) {
/* Create an animated energy bar graph */
    options = Object.assign({size: [512, 384], width: 0.5, duration: 0, unit: "J", margin: [32, 4, 44, 16]}, options);
    let n = data.length;
    let svg = new SVG2(sel, {size: options.size, lrbt: [0, n, 0, Emax], margin: options.margin});
    svg.grid([0, n], [0, Emax, step]).grid([0, 1, 2], [0, Emax]);

    let bars = [];
    let sym = svg.group(".MJax");
    for (let i=0;i<n;i++) {
        let d = data[i];
        let c = d[2] ? d[2] : "#0065fe"
        bars.push(svg.rect([options.width, 1], [i + 0.5, 1]).css({fill: c}));
        let tex = d[0];
        if (SVG2.eq[tex]) tex = SVG2.eq[tex];
        sym.mjax(tex, {scale: 1}, [[i + 0.5, "-8"], [0.5, 0]], c);
    }
    svg.config({data: data, options: options});
    svg.$.find("g.Grid line.Axis").appendTo(svg.$);

    if (options.E) svg.line([0, options.E], [n, options.E]).addClass("TotalEnergy").css({stroke: "black", "stroke-width": "2px"});
    if (options.label) {
        let [dec, x, skip] = options.label;
        let g = svg.label(dec, x, [...range(0, Emax + step, skip ? skip * step : step)]);
        let dy = options.yShift;
        g.shift_by([0, dy != null ? dy : "-6"]);
        if (options.unit) g.text(options.unit, ["6", Emax]).css({"text-anchor" : "start"});
        g.$.find(".Zero").removeClass("Zero");
        g.$.find("text").css({"font-size": "16px"});
    }

    svg.beforeupdate = function() {
        let t = this.time;
        let opt = this.options;
        if (opt.duration && t > opt.duration) {
            this.pause();
            this.time = opt.duration;
        }
        else {
            let E = 0, calc = 0;
            let w = opt.width;
            let n = bars.length;
            if (opt.duration) t /= opt.duration;
            for (let i=0;i<n;i++) {
                let f = this.data[i][1];
                if (f === true) calc += 1;
                else {
                    let Ei = typeof(f) == "number" ? f : f(t);
                    E += Ei;
                    svg.rect([w, Ei], [i + 0.5, Ei / 2], bars[i]);
                }
            }
            let Ei = (opt.E - E) / calc;
            for (let i=0;i<n;i++) {
                let f = this.data[i][1];
                if (f === true) svg.rect([w, Ei], [i + 0.5, Ei / 2], bars[i]);
            }
        }
    }

    svg.$.on("click", () => {
        if (svg.time >= svg.options.duration && !svg.playing) {
            svg.time = 0;
            svg.update(0);
        }
        else svg.toggle();
    });

    return svg.update(0);
}

static* spring_points(p0, p1, n, dx, dy) {
    let seg = new Segment(...p0, ...p1);
    let L = seg.length;
    if (!dx) dx = L / 10;
    if (!dy) dy = L / 10;
    let dL = (L - 2 * dx) / (2 * n);
    let norm = seg.normal.times(dy);
    yield seg.point(0);
    let x = dx;
    for (let i=0;i<=n;i++) {
        yield seg.point(x).plus(norm.times(i ? (i % 2 ? 1 : -1) : 0));
        x += (i ? 2 : 1) * dL;
    }
    yield seg.point(L - dx);
    yield seg.point(L);
}

static style(e, ...rules) {
    let unit = (s) => isNaN(s) ? s : `${s}px`;
    for (let r of rules) {
        let s = ["string", "number"].indexOf(typeof(r));
        if (s == -1) e.css(r);
        else if (s == 0) {
            if (r.charAt(0) == ".") e.addClass(r.substring(1));
            else if (SVG2._style[r]) e.css(SVG2._style[r]);
            else {
                r = r.split("@");
                if (r.length == 1) e.css({fill: r[0]});
                else {
                    if (r[0]) e.css({stroke: r[0]});
                    if (r[1]) e.css({"stroke-width": unit(r[1])});
                }
            }
        }
        else if (s == 1) e.css({"font-size": unit(r)});
    }
    return e;
};


}


SVG2.nsURI = "http://www.w3.org/2000/svg";
SVG2._cache = {};
SVG2.load.pending = [];

SVG2.url = location.origin;
if (SVG2.url.substring(0, 16) != "http://localhost") SVG2.url += "/sci/";

SVG2.sans = "'Noto Sans', 'Open Sans', 'Droid Sans', Oxygen, sans-serif";
SVG2.mono = "Inconsolata, 'Droid Sans Mono', monospace";
SVG2.symbol = SVG2.serif = "'Noto Serif', 'Open Serif', 'Droid Serif', serif";
// SVG2.symbol = "KaTeX_Main, 'Latin Modern Roman', 'Droid Serif', 'Noto Serif', serif";

SVG2._style = {
    grid: {stroke: "lightgrey", "stroke-width": "0.5px"},
    text: {"font-family": SVG2.sans, "font-size": "18px", "text-anchor": "middle"},
    start: {"text-anchor": "start"},
    middle: {"text-anchor": "middle"},
    end: {"text-anchor": "end"},
    symbol: {"font-family": SVG2.symbol, "font-size": "18px", "text-anchor": "middle"},
    arrow: {fill: "red", stroke: "black", "stroke-width": "0.5px", "fill-opacity": 0.8},
    ital: {"font-style": "italic"},
    bold: {"font-weight": "bold"},
    nostroke: {stroke: "none"},
    nofill: {fill: "none"},
    sans: {"font-family": SVG2.sans},
    serif: {"font-family": SVG2.serif},
    mono: {"font-family": SVG2.mono},
};

SVG2.eq = {Ek: "E_k", Eg: "E_g"}