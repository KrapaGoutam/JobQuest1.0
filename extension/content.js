// JobQuest Capture Extension — Content Script Runner
// Injected into the active tab on demand to extract job posting details.

;(() => {
  function cleanText(raw) {
    if (!raw) return ""
    return String(raw)
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  }

  function normalizeWorkArrangement(val, contextText = "") {
    const combined = `${val || ""} ${contextText || ""}`.toLowerCase()
    if (combined.includes("remote") || combined.includes("telecommute")) return "Remote"
    if (combined.includes("hybrid")) return "Hybrid"
    if (combined.includes("on-site") || combined.includes("onsite") || combined.includes("in-office"))
      return "Onsite"
    return ""
  }

  function normalizeEmploymentType(val) {
    if (!val) return ""
    const str = Array.isArray(val) ? val.join(" ") : String(val)
    const upper = str.toUpperCase()
    if (upper.includes("FULL_TIME") || upper.includes("FULL-TIME") || upper.includes("FULL TIME"))
      return "Full-time"
    if (upper.includes("PART_TIME") || upper.includes("PART-TIME") || upper.includes("PART TIME"))
      return "Part-time"
    if (upper.includes("CONTRACT") || upper.includes("FREELANCE")) return "Contract"
    if (upper.includes("INTERN")) return "Internship"
    if (upper.includes("TEMPORARY") || upper.includes("TEMP")) return "Temporary"
    return ""
  }

  function findJobPostings(obj, results = []) {
    if (!obj || typeof obj !== "object") return results
    if (Array.isArray(obj)) {
      for (const item of obj) findJobPostings(item, results)
      return results
    }
    const type = obj["@type"]
    if (
      type === "JobPosting" ||
      (Array.isArray(type) && type.includes("JobPosting")) ||
      (typeof type === "string" && type.endsWith("/JobPosting"))
    ) {
      results.push(obj)
    }
    if (obj["@graph"]) {
      findJobPostings(obj["@graph"], results)
    }
    return results
  }

  function extractJsonLd(doc, pageUrl) {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]')
    const postings = []

    for (const script of scripts) {
      try {
        const parsed = JSON.parse(script.textContent || "{}")
        findJobPostings(parsed, postings)
      } catch {
        // ignore
      }
    }

    if (postings.length === 0) return null
    const job = postings[0]

    const jobTitle = cleanText(job.title || job.name || "")

    let company = ""
    if (job.hiringOrganization) {
      if (typeof job.hiringOrganization === "string") {
        company = cleanText(job.hiringOrganization)
      } else if (typeof job.hiringOrganization === "object") {
        company = cleanText(
          job.hiringOrganization.name || job.hiringOrganization.legalName || "",
        )
      }
    }

    let location = ""
    if (job.jobLocation) {
      const loc = Array.isArray(job.jobLocation) ? job.jobLocation[0] : job.jobLocation
      if (typeof loc === "string") {
        location = cleanText(loc)
      } else if (loc && loc.address) {
        if (typeof loc.address === "string") {
          location = cleanText(loc.address)
        } else if (typeof loc.address === "object") {
          const parts = [
            loc.address.addressLocality,
            loc.address.addressRegion,
            loc.address.addressCountry,
          ].filter(Boolean)
          location = parts.join(", ")
        }
      }
    }
    if (!location && job.applicantLocationRequirements) {
      location = cleanText(
        job.applicantLocationRequirements.name || job.applicantLocationRequirements,
      )
    }

    let workArrangement = ""
    if (
      job.jobLocationType === "TELECOMMUTE" ||
      String(job.jobLocationType || "").toUpperCase().includes("TELECOMMUTE")
    ) {
      workArrangement = "Remote"
    } else {
      workArrangement = normalizeWorkArrangement(location, `${jobTitle} ${job.description || ""}`)
    }

    const employmentType = normalizeEmploymentType(job.employmentType)

    let salaryMin = null
    let salaryMax = null
    let salaryCurrency = ""
    let salaryRange = ""

    const salaryObj = job.baseSalary || job.estimatedSalary
    if (salaryObj && typeof salaryObj === "object") {
      salaryCurrency = String(salaryObj.currency || "").toUpperCase()
      const val = salaryObj.value
      if (typeof val === "number") {
        salaryMin = val
        salaryMax = val
      } else if (val && typeof val === "object") {
        if (val.minValue !== undefined) salaryMin = Number(val.minValue) || null
        if (val.maxValue !== undefined) salaryMax = Number(val.maxValue) || null
        if (val.value !== undefined && salaryMin === null) {
          salaryMin = Number(val.value) || null
          salaryMax = salaryMin
        }
      }
      if (salaryMin !== null || salaryMax !== null) {
        const sym = salaryCurrency ? `${salaryCurrency} ` : "$"
        if (salaryMin !== null && salaryMax !== null && salaryMin !== salaryMax) {
          salaryRange = `${sym}${salaryMin.toLocaleString()} - ${sym}${salaryMax.toLocaleString()}`
        } else {
          salaryRange = `${sym}${(salaryMin || salaryMax).toLocaleString()}`
        }
      }
    }

    const description = cleanText(job.description || "")

    return {
      jobTitle,
      company,
      location,
      workArrangement,
      employmentType,
      salaryMin,
      salaryMax,
      salaryCurrency,
      salaryRange,
      description,
      jobUrl: pageUrl,
      source: company ? "" : "JobPosting",
      confidence: "jsonld",
    }
  }

  function extractGreenhouse(doc, pageUrl) {
    if (!/greenhouse\.io/i.test(pageUrl) && !doc.querySelector("#grnhse_app, .app-title")) {
      return null
    }

    const titleEl = doc.querySelector(
      ".app-title, #app-body h1.app-title, h1.job-title, .job-name, h1",
    )
    const jobTitle = cleanText(titleEl?.textContent || "")

    const companyEl = doc.querySelector(
      ".company-name, .logo-container img[alt], #header .company-name",
    )
    let company = cleanText(companyEl?.textContent || companyEl?.getAttribute("alt") || "")
    if (!company) {
      try {
        const m = new URL(pageUrl).pathname.match(/^\/([^/]+)\/jobs/i)
        if (m && m[1]) company = m[1].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      } catch {}
    }

    const locationEl = doc.querySelector(".location, .body--metadata, .job-location")
    const location = cleanText(locationEl?.textContent || "")

    let workArrangement = ""
    const fullLoc = location.toLowerCase()
    if (fullLoc.includes("remote")) workArrangement = "Remote"
    else if (fullLoc.includes("hybrid")) workArrangement = "Hybrid"
    else if (fullLoc.includes("on-site") || fullLoc.includes("onsite")) workArrangement = "Onsite"

    const descEl = doc.querySelector("#content, #app-body, .job-description")
    const description = cleanText(descEl?.textContent || "")

    return {
      jobTitle,
      company,
      location,
      workArrangement,
      employmentType: "",
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: "",
      salaryRange: "",
      description,
      jobUrl: pageUrl,
      source: "Greenhouse",
      confidence: "ats_greenhouse",
    }
  }

  function extractLever(doc, pageUrl) {
    if (!/jobs\.lever\.co/i.test(pageUrl) && !doc.querySelector(".posting-headline")) {
      return null
    }

    const titleEl = doc.querySelector(
      ".posting-headline h2, .posting-headline h1, h2.posting-headline",
    )
    const jobTitle = cleanText(titleEl?.textContent || "")

    const logoEl = doc.querySelector(".main-header-logo img")
    let company = cleanText(logoEl?.getAttribute("alt") || "")
    if (!company) {
      try {
        const m = new URL(pageUrl).pathname.match(/^\/([^/]+)/i)
        if (m && m[1]) company = m[1].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      } catch {}
    }

    const locationEl = doc.querySelector(".posting-categories .location, .location")
    const location = cleanText(locationEl?.textContent || "")

    const workplaceEl = doc.querySelector(".workplaceTypes, .workplace-type")
    const workplaceText = cleanText(workplaceEl?.textContent || "").toLowerCase()
    let workArrangement = ""
    const combLoc = `${location} ${workplaceText}`.toLowerCase()
    if (combLoc.includes("remote")) workArrangement = "Remote"
    else if (combLoc.includes("hybrid")) workArrangement = "Hybrid"
    else if (combLoc.includes("on-site") || combLoc.includes("onsite")) workArrangement = "Onsite"

    const commitmentEl = doc.querySelector(".posting-categories .commitment, .commitment")
    const commitmentText = cleanText(commitmentEl?.textContent || "").toLowerCase()
    let employmentType = ""
    if (commitmentText.includes("full-time") || commitmentText.includes("full time"))
      employmentType = "Full-time"
    else if (commitmentText.includes("part-time") || commitmentText.includes("part time"))
      employmentType = "Part-time"
    else if (commitmentText.includes("contract")) employmentType = "Contract"
    else if (commitmentText.includes("intern")) employmentType = "Internship"

    const descEl = doc.querySelector(".section.page-centered, .posting-page, #content")
    const description = cleanText(descEl?.textContent || "")

    return {
      jobTitle,
      company,
      location,
      workArrangement,
      employmentType,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: "",
      salaryRange: "",
      description,
      jobUrl: pageUrl,
      source: "Lever",
      confidence: "ats_lever",
    }
  }

  function extractIndeed(doc, pageUrl) {
    if (!/indeed\.com/i.test(pageUrl) && !doc.querySelector(".jobsearch-JobInfoHeader-title")) {
      return null
    }

    const titleEl = doc.querySelector(
      "h1.jobsearch-JobInfoHeader-title, [data-testid='simpler-jobTitle'], h1",
    )
    const jobTitle = cleanText(titleEl?.textContent || "")

    const companyEl = doc.querySelector(
      "[data-testid='inlineHeader-companyName'], .jobsearch-CompanyInfoContainer a, [data-company-name='true']",
    )
    const company = cleanText(companyEl?.textContent || "")

    const locationEl = doc.querySelector(
      "[data-testid='inlineHeader-companyLocation'], [data-testid='jobsearch-JobInfoHeader-companyLocation']",
    )
    const location = cleanText(locationEl?.textContent || "")

    let workArrangement = ""
    const combLoc = location.toLowerCase()
    if (combLoc.includes("remote")) workArrangement = "Remote"
    else if (combLoc.includes("hybrid")) workArrangement = "Hybrid"

    const salaryEl = doc.querySelector(
      "#salaryInfoAndJobType, [data-testid='attribute_snippet_testid']",
    )
    const salaryText = cleanText(salaryEl?.textContent || "")
    let salaryRange = ""
    let salaryMin = null
    let salaryMax = null
    const salaryMatch = salaryText.match(/\$([\d,]+)(?:\s*-\s*\$([\d,]+))?/)
    if (salaryMatch) {
      salaryMin = Number(salaryMatch[1].replace(/,/g, "")) || null
      if (salaryMatch[2]) {
        salaryMax = Number(salaryMatch[2].replace(/,/g, "")) || null
        salaryRange = `$${salaryMin?.toLocaleString()} - $${salaryMax?.toLocaleString()}`
      } else if (salaryMin) {
        salaryMax = salaryMin
        salaryRange = `$${salaryMin.toLocaleString()}`
      }
    }

    const descEl = doc.querySelector("#jobDescriptionText, .jobsearch-jobDescriptionText")
    const description = cleanText(descEl?.textContent || "")

    return {
      jobTitle,
      company,
      location,
      workArrangement,
      employmentType: "",
      salaryMin,
      salaryMax,
      salaryCurrency: "USD",
      salaryRange,
      description,
      jobUrl: pageUrl,
      source: "Indeed",
      confidence: "ats_indeed",
    }
  }

  function extractGeneric(doc, pageUrl) {
    const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute("content") || ""
    const twitterTitle =
      doc.querySelector('meta[name="twitter:title"]')?.getAttribute("content") || ""
    const docTitle = doc.title || ""
    const rawTitle = ogTitle || twitterTitle || docTitle

    let jobTitle = cleanText(rawTitle)
    let company = ""

    const atMatch = jobTitle.match(/^(.+?)\s+(?:at|@)\s+([^-–|•]+)(?:[-–|•].*)?$/i)
    if (atMatch) {
      jobTitle = atMatch[1].trim()
      company = atMatch[2].trim()
    } else {
      const splitMatch = jobTitle.split(/\s+[-–|•]\s+/)
      if (splitMatch.length >= 2) {
        jobTitle = splitMatch[0].trim()
        company = splitMatch[1].trim()
      }
    }

    if (!jobTitle || jobTitle.length < 3) {
      const h1 = doc.querySelector("h1")
      jobTitle = cleanText(h1?.textContent || "")
    }

    const siteName =
      doc.querySelector('meta[property="og:site_name"]')?.getAttribute("content") || ""
    if (!company) company = siteName

    const ogDesc =
      doc.querySelector('meta[property="og:description"]')?.getAttribute("content") || ""
    const metaDesc =
      doc.querySelector('meta[name="description"]')?.getAttribute("content") || ""
    const description = cleanText(ogDesc || metaDesc || "")

    let workArrangement = ""
    const bodyText = (doc.body?.textContent || "").slice(0, 4000).toLowerCase()
    if (bodyText.includes("fully remote") || bodyText.includes("100% remote")) {
      workArrangement = "Remote"
    } else if (bodyText.includes("hybrid")) {
      workArrangement = "Hybrid"
    }

    let source = ""
    try {
      source = new URL(pageUrl).hostname.replace(/^www\./, "")
    } catch {}

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

  function extractAll(doc, pageUrl) {
    const candidates = []
    try {
      const jsonLd = extractJsonLd(doc, pageUrl)
      if (jsonLd) candidates.push(jsonLd)
    } catch {}

    try {
      const gh = extractGreenhouse(doc, pageUrl)
      if (gh) candidates.push(gh)
      const lever = extractLever(doc, pageUrl)
      if (lever) candidates.push(lever)
      const indeed = extractIndeed(doc, pageUrl)
      if (indeed) candidates.push(indeed)
    } catch {}

    try {
      const generic = extractGeneric(doc, pageUrl)
      if (generic) candidates.push(generic)
    } catch {}

    const result = {
      jobTitle: "",
      company: "",
      location: "",
      workArrangement: "",
      employmentType: "",
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: "",
      salaryRange: "",
      description: "",
      jobUrl: pageUrl,
      source: "",
      confidence: "none",
    }

    for (const item of candidates) {
      if (!item) continue
      if (result.confidence === "none" && item.confidence) result.confidence = item.confidence
      if (!result.jobTitle && item.jobTitle) result.jobTitle = item.jobTitle
      if (!result.company && item.company) result.company = item.company
      if (!result.location && item.location) result.location = item.location
      if (!result.workArrangement && item.workArrangement)
        result.workArrangement = item.workArrangement
      if (!result.employmentType && item.employmentType)
        result.employmentType = item.employmentType
      if (result.salaryMin === null && item.salaryMin !== null)
        result.salaryMin = item.salaryMin
      if (result.salaryMax === null && item.salaryMax !== null)
        result.salaryMax = item.salaryMax
      if (!result.salaryCurrency && item.salaryCurrency)
        result.salaryCurrency = item.salaryCurrency
      if (!result.salaryRange && item.salaryRange)
        result.salaryRange = item.salaryRange
      if (!result.description && item.description)
        result.description = item.description
      if (!result.source && item.source) result.source = item.source
    }

    if (!result.source && result.jobUrl) {
      try {
        result.source = new URL(result.jobUrl).hostname.replace(/^www\./, "")
      } catch {}
    }

    return result
  }

  const extracted = extractAll(document, window.location.href)
  window.__jobquest_last_extracted = extracted
  return extracted
})()
