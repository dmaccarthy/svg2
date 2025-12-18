const css = SVG2.style;

function clearFeed() {
/** Reset to empty feed **/
    if ($("body").hasClass("Present")) return location.reload();
    loadFeed.data = {};
    for (let name of loadFeed._inits) delete loadFeed[name];
    loadFeed._inits = [];
    $("div.Message").remove();
    return $("#Main").html("");
}

function loadFeed(feed, noHist) {
/** Load feed via AJAX request or from cache **/
    clearTimeout(loadFeed.refresh);
    loadFeed.referer = loadFeed.current;
    if (feed == null) feed = loadFeed.current;
    else if (typeof(feed) != "string") {
        let action = $(feed).attr("data-id").toLowerCase();
        action = action == "today" ? loadFeed.current.split("/")[0] + "/cal" : loadFeed.data[action];
        if (action) feed = action;
        else return;
    }
    if (loadFeed.data.folder) feed = feed.replace("$", loadFeed.data.folder);
    loadFeed.opener = loadFeed.current;
    if (loadFeed.cache[feed]) onFeedLoaded(feed, true, noHist);
    else fetch(feed + ".htm", {cache: "reload"}).then(
        e => {
            e.text().then(a=> {
                if (!e.ok) a = loadFeed.error(e, feed);
                onFeedLoaded(feed, a, noHist);
                if (!e.ok) msg();
            });
        },
        e => {
            let a = loadFeed.error(e, feed);
            onFeedLoaded(feed, a, noHist);
            msg();
        });
    loadFeed.refresh = setTimeout(() => {
        location.reload();
    }, 3600 * 4000);
}

loadFeed.error = (e, feed) => {
    console.warn(e);
    return `<section class="Post">
        <h2 class="FeedLink">${e.status} — ${e.statusText}</h2>
        <p>${feed}</p>
        <p class="Center"><span class="Link" onclick="history.back()">Back</span> | <span class="Link" onclick="loadFeed('home')">Home</span></p>
        <script type="text/javascript">loadFeed.data = {title: 'Error'}</script>
    </section>`;
}

loadFeed.cache = {};
loadFeed._inits = [];

function feedURL(feed, qs) {
/** Compose a URL for a specific feed **/
    let query = "";
    if (qs === true) qs = qs_args();
    if (qs && qs.length) {
        query = "?";
        let k;
        for (k in qs) {
            if (query.length > 1) query += "&";
            query += `${encodeURIComponent(k)}=${encodeURIComponent(qs[k])}`;
        }
    }
    return location.origin + location.pathname + `${query}#${feed}`;
}

function mediaURL(key) {
/** Construct a URL for requested media **/
    if (key.indexOf("/") != -1) return key;
    if (key.slice(0, 4) == "http") return key;
    if (key.charAt(0) == "$") return data_images[key.substring(1)];
    let url = mediaURL.urls[key];
    let dot = key.indexOf(".") > -1;
    return url ? url : `./media/${key}` + (dot ? "" : ".png");
}

mediaURL.urls = {};


function apply(e, f) {
/** Apply a function to all matched elements **/
    $.each($(e), (i, ei) => {f($(ei))});
}

let teacher = () => {}
teacher.mode = false;

function onFeedLoaded(feed, e, noHist) {
/** Render page once the feed has been loaded **/

    // Save feed to cache
    let cache = loadFeed.cache;
    if (e === true && cache) e = loadFeed.cache[feed];
    else {
        cache[feed] = e;
        if (teacher.mode) {
            let k, i = 0, n = 0;
            for (k in cache) {
                n += cache[k].length;
                i++
            }
            console.log(`Cache: ${i} feed(s) [${(n/1024).toFixed(1)} kb]`);           
        }
    }
    if (collapse.toggled[feed] == null) collapse.toggled[feed] = [];

    // Update browser history
    loadFeed.current = feed;
    let hash = location.hash;
    if (hash.slice(1) != feed && !noHist) {
        let url = feedURL(feed, true);
        if (hash) history.pushState({}, "", url);
        else history.replaceState({}, "", url);
    }

    // Add content to page
    let a, title, i;
    $("#Main").css("visibility", "hidden");
    clearFeed().prepend(e);
    try {loadFeed.data = process_loadData(feed)}
    catch(err) {loadFeed.data = Object.assign({up: "home"}, loadFeed.data)}
    try {
        handouts(loadFeed.data.handouts);
        calendar(loadFeed.data.cal);
    }
    catch(err) {}
    if (!teacher.mode) {
        apply("[data-answers]", (ei) => {
            let d = ei.attr("data-answers");
            if (d == "1") d = loadFeed.data.answerDate;
            if (!is_after(d)) ei.find(".Answer").remove();
        });
        apply("[data-show]", (ei) => {
            let d = ei.attr("data-show");
            if (d == "1") d = loadFeed.data.showDate;
            if (!is_after(d)) ei.remove();
        });
    }

    // Add titles and icons to posts
    apply("section.Post[data-title]", (ei) => {
        ei.prepend($("<h2>").html(ei.attr("data-title")));       
    });
    apply("button[data-icon]", (ei) => {
        ei.html($("<p>").html(ei.html()));
    });
    apply("[data-icon]", (ei) => {
        let a = {src: mediaURL(ei.attr("data-icon"))};
        ei.prepend($("<img>").attr(a).addClass("Icon"));
    });

    // Add print icons and get image source URLs
    printIcons();
    apply("img[data-src]", (ei) => {
         ei.attr({src: mediaURL(ei.attr("data-src"))});       
    });

    // Embed videos
    try {apply("[data-yt], [data-video]", video)}
    catch(err) {}

    // Enable collapsible posts
    let h2 = $("section.Post").find(".Collapse:not(div)");
    h2.addClass("Link").on("click", collapse).attr({title: "Click to expand or collapse"});
    $("section.Post > img.Icon:first-child").click((e) => {
        $(e.currentTarget).next().trigger("click");
    }).addClass("Link");

    // Feed title
    let data = loadFeed.data;
    title = data.title;
    if (!title) title = "Untitled Feed";
    document.title = $("<p>").html(data.title).text();
    h2 = $("#TopTitle").html(title);
    if (data.up)
        h2.addClass("FeedLink").attr({title: "Click to go up one level"});
    else
        h2.removeClass("FeedLink").removeAttr("title");

    // Page and site variables
    apply(".Var", (ei) => {
        let html = ei.html();
        html = data[html] ? data[html] : siteData[html];
        ei.html(html);
    });

    // Display active buttons
    let btn = ["prev", "next"];
    if (window.calendar) btn.splice(0, 0, "today");
    let j = -1;
    a = $("#Buttons > a").removeClass("Last");
    for (i=0;i<btn.length;i++) {
        if (data[btn[i]]) {
            $(a[i]).show();
            j = i;
        }
        else $(a[i]).hide();
    }
    if (j > -1) $(a[j]).addClass("Last");

    // Create feed hyperlinks
    apply("[data-feed]", (ei) => {
        let tag = ei[0].tagName;
        let feed = ei.attr('data-feed');
        if (tag == "A") {
            let f = data.folder;
            f = feedURL(f ? feed.replace("$", f) : feed, true);        
            ei.attr({href: f}).click(clickLink);
        }
       else {
            if (tag == "SECTION") ei = $(ei.find("h2")[0]);
            ei.addClass("FeedLink").attr({title: "Click to open this feed"}).click(() => {loadFeed(feed)});
        }
    });

    // Create other hyperlinks
    apply("[data-gdrv], [data-gdoc], [data-doc], [data-link], [data-open]", (ei) => {
        let url = ei.attr("data-link"), tab = false;
        if (!url) {
            tab = true;
            url = ei.attr("data-gdrv");
            if (url) url = "https://drive.google.com/file/d/" + url;
            else {
                url = ei.attr("data-gdoc");
                if (url) url = "https://docs.google.com/document/d/" + url;
                else {
                    url = ei.attr("data-doc");
                    if (url) url = "media/" + url;
                    else url = ei.attr("data-open");
                }
            }
        }
        if (ei[0].tagName == "A") {
            ei.attr({href: url});
            if (tab) ei.attr({target: random_string(12, 2)});
        }
        else ei.addClass("FeedLink").click(() => {
            if (tab) window.open(url);
            else location.href = url;
        });
    });

    // Enable copy/open operation on .Code elements
    $(".IO").removeClass("IO").addClass("Code");
    $("pre.Code, pre.CodeScroll").attr({spellcheck: false});
    $("[data-echo=copy]").attr("data-echo", "text");
    apply("[data-echo]", copy_or_open);

    // Add event listeners
    $("#Top").remove().appendTo("body").show();
    $("#Buttons > a").on("click", (e) => {
        loadFeed(e.currentTarget);
    });

    // Remove unnecessary MathJax elements
    setTimeout(() => $("div:is(.MJX_ToolTip, .MJX_LiveRegion, .MJX_HoverRegion)").remove(), 2000);

    // Finish up
    $("tr.NoBold th:not(.Bold)").addClass("NoBold");
    $("#Main, #Copy").show();
    drawChevrons();
    renderTeX();
    SVG2.load(initFeed);
}

function printIcons() {
    for (let e of $("section.Post:not(.NoPrintIcon)")) {
        e = $(e).children("h2:not(.NoPrintIcon)");
        if (e.length) {
            e = $(e[0]);
            e.children("span[data-print]").remove();
            let span = $("<span>").addClass("Action");
            e.append(span);
            $("<img>").attr({"data-src": "$print", title: "Print this section"}).appendTo(span).on("click", (ev) => {
                $("section.Post").hide();
                e.closest("section.Post").show();
                let div = $(ev.currentTarget).closest("h2").next("div.Collapse");
                div.show().find(".Collapse").show();
                print();
                return false;
            });
        }
    }
}

function initFeed() {
    // Run scripts
    $("._Present").removeClass("_Present").addClass("Present");
    for (let s of $("script[data-init]")) {
        let name = $(s).attr("data-init");
        try {loadFeed[name]()} catch(err) {console.error(err)};
        loadFeed._inits.push(name);
    }

    // Restore collapsed/expanded state
    $("section.Post div.Collapse:not(.Expand)").hide();
    let div = $("div.Collapse");
    let toggle = collapse.toggled[loadFeed.current];
    for (let i of toggle) $(div[i]).toggle();

    // Finalize layout
    $("#Main").css("visibility", "visible");
    layoutWidth();
    $(window).scrollTop(0);
}

function copy_or_open(ei) {
/** Enable copy/open operation on [data-echo] elements **/
    let echo = ei.attr("data-echo");
    let p = $("<p>").addClass("EchoControl").insertBefore(ei);
    let title  = ei.attr("data-title");
    if (title == "1") title = echo;
    echo = echo.split(".");
    echo = echo[echo.length - 1];
    if (!title) title = {
        html: "HTML Code",
        htm: "HTML Code",
        xml: "XML Code",
        py: "Python Code",
        text: "Plain Text",
        css: "CSS Code",
        js: "Javascript Code",
        json: "JSON Data",
        svg: "SVG Code",
        csv: "CSV Data",
        io: "Program Output",
    }[echo];
    if (!title) title = "Plain Text";
    p.html($("<span>").html(title).addClass("CodeTitle"));
    let s = $("<span>").addClass("Buttons").appendTo(p);
    let img = ["copy", "open_tab", "download"];
    for (i=0;i<3;i++) {
        btn = $("<img>").addClass("Icon").attr({
            src: data_images[img[i]], alt: img[i],
            title: ["Copy to clipboard", "Open in new browser tab", "Download"][i]
        }).appendTo(s);
        btn[0].action = i;
        btn.click((e) => {
            e = e.currentTarget;
            code_echo($(e).closest(".EchoControl").next("[data-echo]"), e.action);
        });
    }
}

function drawChevrons() {
/** Draw ^ or > chevrons to indicate expanded/collapsed state **/
    let div = $("div.Collapse");
    for (let i=0;i<div.length;i++) {
        let e = $(div[i]);
        let h2 = e.prev(".Collapse");
        if (h2.find(".Chevron").length == 0) for (let c of "dr")
            h2.prepend($("<img>").addClass("Chevron").attr({src: data_images[`chevron_${c}`]}));
        let j = e.is(":visible") ? 0 : 1;
        e = h2.find(".Chevron");
        $(e[j]).hide();
        $(e[1-j]).show();
     }
}

function clickLink(ev) {
/** Handle click event on feed link **/
    let url = location.origin + location.pathname;
    let a = $(ev.currentTarget);
    let href = a.attr("href");
    let n = url.length;
    if (href.slice(0, n) == url) {
        let feed = href.slice(n + 1);
        loadFeed(feed);
        return false;
    }    
}

function goUp(ev) {
/** Event handler for "up" command **/
    let feed = loadFeed.data.up;
    if (feed) loadFeed(feed);        
}

function layoutWidth() {
/** Adjust page metrics when body width or content changes **/
    let body = $("body");
    let w = body.width();
    let x = ($(window).width() - w) / 2;
    let top = $("#Top");
    let marg = body.hasClass("Present") ? "0px" : `calc(0.7em + ${top.outerHeight()}px)` ;
    body.css("margin-top", marg);
    top.width(w - (w < 780 ? 21.6 : 0 * 25.2)).css({left: `${x}px`});
    for (let e of $("section.Post p[data-latex]").filter(":visible").removeClass("AutoScroll"))
        if (e.scrollWidth > e.clientWidth) $(e).addClass("AutoScroll");
    aspect();
}

function loadHash(init) {
/** Load feed identified by URL fragment/"hash" **/
    clearFeed();
    let feed = location.hash;
    if (feed == "#~") feed = "";
    loadFeed(feed ? feed.slice(1) : "home", !init);    
}

function collapse(e) {
/** Toggle collapsible sections **/
    let alt = e.altKey && e.ctrlKey;
    if ($(e.target).closest(".Action").length) return;
    // if (e.target != e.currentTarget) return;
    let div = $(e.currentTarget).next("div.Collapse");
    if (!alt || div.is(":hidden")) {
        div.fadeToggle(250, () => {
            drawChevrons();
            layoutWidth();
        });
        let t = collapse.toggled;
        let k = loadFeed.current;
        let i = $("div.Collapse").index(div[0]);
        let j = t[k].indexOf(i);
        if (j == -1) t[k].push(i);
        else t[k].splice(j, 1);
    }
    if (alt) slideShow(div);
}

collapse.toggled = {};

let siteData = {};

function msg(html, time) {
/** Display a message to the user **/
    if (!html) html = "Unable to load page."
    let b = $("body"), w = $(window);
    let e = $("<div>").addClass("Message").html(html).appendTo(b);
    let x = (w.width() - e.outerWidth()) / 2;
    e.css({left: `${x}px`});
    e.fadeIn(500);
    setTimeout(() => {
        e.fadeOut(1500);
        setTimeout(() => {e.remove()}, 1600);
    }, time ? time : 2500);
}



// Other event handlers

$(window).on("resize", layoutWidth).on("popstate", loadHash);
