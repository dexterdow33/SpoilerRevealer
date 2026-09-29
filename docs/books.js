/*
 * DexterDow.com — book catalog.
 * Edit this file to add, fix, or publish a book. Nothing else needs to change.
 *
 * Fields
 *   title     Exact title as it appears on the cover / KDP listing.
 *   subtitle  Exact subtitle. Leave "" if not confirmed.
 *   asin      Amazon ASIN or ISBN-10. The buy link is built from it.
 *   blurb     One or two sentences. Leave "" rather than guess.
 *   live      true = shown on the site. false = held until confirmed.
 *   verify    Note on what still needs checking. Not shown on the site.
 *
 * Source for every entry: web search results for Dexter Dow's Amazon author
 * page (amazon.com/stores/author/B0G961TFG9) and Amazon product listings,
 * run 2026-09-29. Amazon itself could not be opened from the build machine,
 * so subtitles, blurbs, and ASINs are unconfirmed until checked against KDP.
 */
window.AUTHOR_STORE = "https://www.amazon.com/stores/author/B0G961TFG9";

window.BOOKS = [
  {
    title: "The 48 Laws of Politics",
    subtitle: "",
    asin: "B0GGLZKTPL",
    blurb:
      "An unsentimental guide to how political power is acquired, exercised, defended, and preserved, written in the tradition of Robert Greene's The 48 Laws of Power.",
    live: true,
    verify:
      "Subtitle appeared truncated in search ('Master the Game of Power, ...'). Paste the full subtitle from KDP. Blurb condensed from the Amazon description as quoted by search.",
  },
  {
    title: "Political Power",
    subtitle: "A Comprehensive Guide to How Power Actually Works",
    asin: "B0GBZ2THMP",
    blurb:
      "A clear-eyed guide to how power is built, hidden, abused, restrained, lost, and renewed.",
    live: true,
    verify: "Blurb condensed from the Amazon description as quoted by search.",
  },
  {
    title: "Escaping the Matrix",
    subtitle: "How to Escape Capitalism",
    asin: "B0G4JQR7ZS",
    blurb: "",
    live: true,
    verify:
      "Found on amazon.fr under 'Dow, Dexter'. Confirm the ASIN resolves on amazon.com. Add blurb.",
  },
  {
    title: "America Is a Third World Country",
    subtitle: "",
    asin: "B0GJS1WY4N",
    blurb: "",
    live: true,
    verify:
      "Found on amazon.ca under 'Dow, Dexter'. Confirm subtitle and that the ASIN resolves on amazon.com. Add blurb.",
  },

  // Held: titles named in the Amazon author bio as quoted by search, with no
  // product listing found. Add the ASIN and set live: true once confirmed.
  { title: "Sincerely, America", subtitle: "", asin: "", blurb: "", live: false, verify: "Title only. Need ASIN, subtitle." },
  { title: "The Poverty Engine", subtitle: "", asin: "", blurb: "", live: false, verify: "Title only. Need ASIN, subtitle." },
  { title: "The AI Arms Race", subtitle: "", asin: "", blurb: "", live: false, verify: "Title only. Need ASIN, subtitle." },
  { title: "The Obsolescence Engine", subtitle: "", asin: "", blurb: "", live: false, verify: "Title only. Need ASIN, subtitle." },
  { title: "The Business of Belief", subtitle: "", asin: "", blurb: "", live: false, verify: "Title only. Need ASIN, subtitle." },
  { title: "The Beautiful Lie", subtitle: "", asin: "", blurb: "", live: false, verify: "Title only. A different book by this name exists (Tobin Crenshaw); confirm yours." },
  { title: "Common Ground", subtitle: "", asin: "", blurb: "", live: false, verify: "Title only. Common title; confirm yours." },
  {
    title: "The AI Newsroom Revolution",
    subtitle: "",
    asin: "B0GGM5C1W9",
    blurb: "",
    live: false,
    verify: "Surfaced in a Dexter Dow search but authorship not confirmed. Confirm it is yours before publishing.",
  },
];
