// JobQuest Capture Extension — Generic Meta & DOM Extractor

function cleanText(raw) {
  if (!raw) return ""
  return String(raw)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function parseTitleString(titleStr) {
  if (!titleStr) return { title: "", company: "" }
  const clean = cleanText(titleStr)

  // Pattern: "Job Title at Company" or "Job Title @ Company"
  const atMatch = clean.match(/^(.+?)\s+(?:at|@)\s+([^-–|•]+)(?:[-–|•].*)?$/i)
  if (atMatch) {
    return { title: atMatch[1].trim(), company: atMatch[2].trim() }
  }

  // Pattern: "Company - Job Title" or "Job Title - Company"
  const splitMatch = clean.split(/\s+[-–|•]\s+/)
  if (splitMatch.length >= 2) {
    return { title: splitMatch[0].trim(), company: splitMatch[1].trim() }
  }

  return { title: clean, company: "" }
}

export function extractGeneric(doc, pageUrl = "") {
  // 1. Meta tags
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute("content") || ""
  const twitterTitle =
    doc.querySelector('meta[name="twitter:title"]')?.getAttribute("content") || ""
  const docTitle = doc.title || ""
  const rawTitle = ogTitle || twitterTitle || docTitle

  const parsed = parseTitleString(rawTitle)
  let jobTitle = parsed.title

  // If parsed title looks like a generic site title or empty, try first h1
  const h1 = doc.querySelector("h1")
  if (!jobTitle || jobTitle.length < 3) {
    jobTitle = cleanText(h1?.textContent || "")
  }

  // Company
  const siteName =
    doc.querySelector('meta[property="og:site_name"]')?.getAttribute("content") || ""
  let company = parsed.company || siteName

  // Description
  const ogDesc =
    doc.querySelector('meta[property="og:description"]')?.getAttribute("content") || ""
  const metaDesc =
    doc.querySelector('meta[name="description"]')?.getAttribute("content") || ""
  const description = cleanText(ogDesc || metaDesc || "")

  // Work arrangement heuristic
  let workArrangement = ""
  const bodyText = (doc.body?.textContent || "").slice(0, 4000).toLowerCase()
  if (bodyText.includes("fully remote") || bodyText.includes("100% remote")) {
    workArrangement = "Remote"
  } else if (bodyText.includes("hybrid")) {
    workArrangement = "Hybrid"
  }

  // Domain as source
  let source = ""
  try {
    const parsedUrl = new URL(pageUrl)
    source = parsedUrl.hostname.replace(/^www\./, "")
  } catch {
    // ignore
  }

  return {
    jobTitle,
    company,
    location: "",
    workArrangement,
    employmentType: "",
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: "",
    salaryRange: "",
    description,
    jobUrl: pageUrl,
    source,
    confidence: "generic",
  }
}
