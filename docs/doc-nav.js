/* ================================================================
   Shop Inventory — Documentation Navigation UX
   Shared JS for all doc pages
   Auto-injects: sticky topbar, TOC drawer, back-to-top button
   ================================================================ */
(function () {
  "use strict";

  // ── Detect page context ──────────────────────────────
  const isHub = document.querySelector(".hub-hero") !== null;
  const tocItems = [];
  const docTitle = document.title
    .replace("ระบบจัดการสต็อกสินค้า — ", "")
    .replace("Shop Inventory — ", "");

  // Collect TOC links from the page's .toc-list
  document.querySelectorAll(".toc-list a").forEach(function (a) {
    tocItems.push({ href: a.getAttribute("href"), text: a.textContent.trim() });
  });

  // Detect language links
  const langLink = document.querySelector(
    '.doc-inline-nav a[href*="-th.html"], .doc-inline-nav a[href$=".html"]:nth-child(2)',
  );

  // ── Sticky Topbar ────────────────────────────────────
  var topbar = document.createElement("div");
  topbar.className = "doc-topbar";

  // Back link
  var backLink = document.createElement("a");
  backLink.href = "index.html";
  backLink.innerHTML = "&#8592; Hub";
  backLink.setAttribute("aria-label", "Back to Documentation Hub");

  // Title
  var title = document.createElement("span");
  title.className = "topbar-title";
  title.textContent = docTitle;

  // Right section
  var rightSection = document.createElement("div");
  rightSection.className = "topbar-right";

  // Language toggle in topbar
  var inlineNav = document.querySelector(".doc-inline-nav");
  if (inlineNav) {
    var links = inlineNav.querySelectorAll("a");
    links.forEach(function (link) {
      if (link.href.indexOf("index.html") === -1) {
        var langBtn = document.createElement("a");
        langBtn.href = link.href;
        langBtn.textContent = link.textContent;
        langBtn.style.fontSize = "0.78rem";
        rightSection.appendChild(langBtn);
      }
    });
  }

  // TOC toggle button (only if we have toc items)
  if (tocItems.length > 0) {
    var tocBtn = document.createElement("button");
    tocBtn.className = "toc-toggle";
    tocBtn.innerHTML = "&#9776; TOC";
    tocBtn.setAttribute("aria-label", "Open table of contents");
    tocBtn.addEventListener("click", openDrawer);
    rightSection.appendChild(tocBtn);
  }

  if (!isHub) {
    topbar.appendChild(backLink);
    topbar.appendChild(title);
    topbar.appendChild(rightSection);
    document.body.insertBefore(topbar, document.body.firstChild);

    // Hide the old inline nav
    if (inlineNav) inlineNav.style.display = "none";
  }

  // Shadow on scroll
  window.addEventListener(
    "scroll",
    function () {
      if (topbar) {
        topbar.classList.toggle("scrolled", window.scrollY > 10);
      }
    },
    { passive: true },
  );

  // ── TOC Drawer ───────────────────────────────────────
  var overlay, drawer;

  if (tocItems.length > 0 && !isHub) {
    overlay = document.createElement("div");
    overlay.className = "toc-drawer-overlay";
    overlay.addEventListener("click", closeDrawer);

    drawer = document.createElement("div");
    drawer.className = "toc-drawer";

    var drawerHeader = document.createElement("div");
    drawerHeader.className = "toc-drawer-header";

    var drawerTitle = document.createElement("h3");
    var lang = document.documentElement.lang;
    drawerTitle.textContent = lang === "th" ? "สารบัญ" : "Contents";

    var closeBtn = document.createElement("button");
    closeBtn.className = "toc-drawer-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.addEventListener("click", closeDrawer);

    drawerHeader.appendChild(drawerTitle);
    drawerHeader.appendChild(closeBtn);
    drawer.appendChild(drawerHeader);

    var drawerBody = document.createElement("div");
    drawerBody.className = "toc-drawer-body";

    tocItems.forEach(function (item) {
      var a = document.createElement("a");
      a.href = item.href;
      a.textContent = item.text;
      a.addEventListener("click", function () {
        closeDrawer();
      });
      drawerBody.appendChild(a);
    });

    drawer.appendChild(drawerBody);
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
  }

  function openDrawer() {
    if (overlay && drawer) {
      overlay.classList.add("open");
      drawer.classList.add("open");
      document.body.style.overflow = "hidden";
    }
  }

  function closeDrawer() {
    if (overlay && drawer) {
      overlay.classList.remove("open");
      drawer.classList.remove("open");
      document.body.style.overflow = "";
    }
  }

  // Close drawer on Escape
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeDrawer();
  });

  // ── Back to Top Button ───────────────────────────────
  var btt = document.createElement("button");
  btt.className = "back-to-top";
  btt.innerHTML = "&#8593;";
  btt.setAttribute("aria-label", "Back to top");
  btt.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  document.body.appendChild(btt);

  window.addEventListener(
    "scroll",
    function () {
      btt.classList.toggle("visible", window.scrollY > 400);
    },
    { passive: true },
  );
})();
