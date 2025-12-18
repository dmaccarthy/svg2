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
