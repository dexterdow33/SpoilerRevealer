/*
 * Ninth State Software — site settings and product catalog.
 * Edit the two blocks below. Everything else renders from them.
 */

// ---- 1. Site settings ------------------------------------------------------
const SITE = {
  // Public contact address. Leave "" until the mailbox exists and you have tested it.
  contactEmail: "",

  // Optional: a form service URL that accepts POSTed email sign-ups
  // (Formspree, Buttondown, Kit, etc.). Leave "" to fall back to the contact email.
  notifyEndpoint: "",
};

// ---- 2. Product catalog ----------------------------------------------------
// One object per app. Remove the example comment and add real listings.
// buyUrl: a hosted checkout link (Stripe Payment Link, Gumroad, Lemon Squeezy).
// While this array is empty, the page shows a clearly stamped sample card.
const PRODUCTS = [
  /*
  {
    name: "App Name",
    category: "Productivity",
    price: "$19",              // shown as written; include "/mo" for subscriptions
    summary: "One or two plain sentences on what it does and who it's for.",
    platform: "Windows · macOS",
    version: "1.0",
    buyUrl: "https://buy.stripe.com/your-link",
    infoUrl: "",               // optional: a detail page or demo video
  },
  */
];

// ---- Rendering (no edits needed below) -------------------------------------
const SAMPLE = {
  name: "Your App Name",
  category: "Category",
  price: "$00",
  summary: "This is how a listing will look. Add your first app to PRODUCTS in site.js and this sample disappears.",
  platform: "Platform",
  version: "1.0",
  sample: true,
};

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
}

function listingCard(p) {
  const card = el("article", { class: "listing" + (p.sample ? " is-sample" : "") });
  if (p.sample) card.append(el("span", { class: "stamp" }, "Sample listing"));

  const top = el("div", { class: "listing-top" });
  top.append(el("span", { class: "listing-tag" }, p.category || "App"));
  if (p.price) top.append(el("span", { class: "listing-price" }, p.price));

  const foot = el("div", { class: "listing-foot" });
  const meta = [p.platform, p.version && "v" + p.version].filter(Boolean).join(" · ");
  foot.append(el("span", { class: "listing-meta" }, meta));
  if (p.buyUrl) {
    foot.append(el("a", { class: "btn", href: p.buyUrl, rel: "noopener" }, "Buy"));
  } else if (p.infoUrl) {
    foot.append(el("a", { class: "btn btn-ghost", href: p.infoUrl, rel: "noopener" }, "Details"));
  }

  card.append(top, el("h3", {}, p.name), el("p", {}, p.summary || ""), foot);
  return card;
}

function renderCatalog() {
  const grid = document.getElementById("catalog");
  if (!grid) return;
  grid.textContent = "";
  if (PRODUCTS.length) {
    PRODUCTS.forEach((p) => grid.append(listingCard(p)));
    return;
  }
  const empty = el("div", { class: "catalog-empty" });
  empty.append(
    el("h3", {}, "The catalog is being stocked."),
    el("p", {}, "No apps are for sale yet. Leave your email below and you'll hear when the first one is listed.")
  );
  grid.append(empty, listingCard(SAMPLE));
}

function renderContact() {
  const line = document.getElementById("email-line");
  if (!line) return;
  if (!SITE.contactEmail) {
    line.hidden = true;
    return;
  }
  const link = el("a", { href: "mailto:" + SITE.contactEmail }, SITE.contactEmail);
  const copy = el("button", { type: "button", class: "copy-btn", id: "copy-email" }, "Copy");
  copy.addEventListener("click", () => {
    navigator.clipboard?.writeText(SITE.contactEmail)
      .then(() => { copy.textContent = "Copied"; })
      .catch(() => {
        const r = document.createRange();
        r.selectNodeContents(link);
        const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      });
  });
  line.textContent = "";
  line.append(link, copy);
}

function wireNotify() {
  const form = document.getElementById("notify-form");
  const status = document.getElementById("notify-status");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.elements.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      status.textContent = "Enter a full email address, like name@example.com.";
      return;
    }
    if (!SITE.notifyEndpoint) {
      status.textContent = SITE.contactEmail
        ? "Sign-ups open soon. For now, email " + SITE.contactEmail + " and ask to be on the list."
        : "Sign-ups aren't open yet. Check back soon.";
      return;
    }
    status.textContent = "Sending…";
    try {
      const res = await fetch(SITE.notifyEndpoint, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form),
      });
      if (!res.ok) throw new Error(res.status);
      form.reset();
      status.textContent = "You're on the list. We'll email you when the first app ships.";
    } catch {
      status.textContent = "That didn't go through. Try again in a minute.";
    }
  });
}

document.getElementById("year").textContent = new Date().getFullYear();
renderCatalog();
renderContact();
wireNotify();
