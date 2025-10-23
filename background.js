// Background service worker for Marshal - MANIFEST V3 COMPATIBLE
console.log("[Marshal Background] Service worker initialized (Manifest V3)")

const DEFAULT_MODEL = "deepseek/deepseek-chat"
// Other good free options:
// - "google/gemini-flash-1.5"
// - "mistralai/mistral-7b-instruct"
// - "gryphe/mythomax-l2-13b"

// api call function (via your deployed proxy)
async function handleAIAPICall(payload) {
  const API_URL = "https://marshal-proxy.vercel.app/api/ai" // deployed endpoint

  console.log("[Marshal] Calling proxy model:", DEFAULT_MODEL)

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: payload.model || DEFAULT_MODEL,
        prompt: payload.prompt,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("[Marshal] Proxy API error:", errorData)
      throw new Error(errorData.error?.message || "Unknown API error")
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || "No response"
    return text
  } catch (error) {
    console.error("[Marshal] Error calling proxy API:", error)
    throw error
  }
}


//message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "callGeminiAPI" || message.action === "callAIAPI") {
    handleAIAPICall(message.payload)
      .then((response) => sendResponse({ success: true, data: response }))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true // keep async channel open
  }
})


// Default blocked websites for study mode
const DEFAULT_BLOCKED_SITES = [
  "facebook.com",
  "twitter.com",
  "instagram.com",
  "tiktok.com",
  "youtube.com",
  "netflix.com",
  "reddit.com",
  "twitch.tv",
]

let studyModeActive = false
let customBlockedSites = []
let disabledDefaultSites = []

// Load study mode state and custom sites on startup
chrome.storage.local.get(["studyModeActive", "customBlockedSites", "disabledDefaultSites"], (result) => {
  studyModeActive = result.studyModeActive || false
  customBlockedSites = result.customBlockedSites || []
  disabledDefaultSites = result.disabledDefaultSites || []
  console.log("[Marshal Background] Study mode:", studyModeActive ? "ON" : "OFF")
  console.log("[Marshal Background] Custom blocked sites:", customBlockedSites)
  console.log("[Marshal Background] Disabled default sites:", disabledDefaultSites)
  updateBlockingRules()
})

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[Marshal Background] Message received:", message)
  
  if (message.action === "toggleStudyMode") {
    studyModeActive = message.active
    console.log("[Marshal Background] Study mode toggled:", studyModeActive ? "ON" : "OFF")
    
    // Reset stats when enabling study mode
    if (studyModeActive) {
      chrome.storage.local.set({
        studyStartTime: Date.now(),
        dailyBlockedAttempts: 0,
        hourlyAttempts: {},
        blockedSitesCount: {}
      })
    }
    
    updateBlockingRules()
    sendResponse({ success: true })
    return true
  } 
  
  if (message.action === "addCustomSite") {
    addCustomBlockedSite(message.site)
    sendResponse({ success: true })
    return true
  } 
  
  if (message.action === "removeCustomSite") {
    removeCustomBlockedSite(message.site)
    sendResponse({ success: true })
    return true
  } 
  
  if (message.action === "toggleDefaultSite") {
    toggleDefaultSite(message.site)
    sendResponse({ success: true })
    return true
  } 
  
  if (message.action === "getBlockedSites") {
    sendResponse({ 
      default: DEFAULT_BLOCKED_SITES,
      custom: customBlockedSites,
      disabledDefault: disabledDefaultSites
    })
    return true
  }
  
  if (message.action === "openStatsPage") {
    chrome.action.openPopup()
    sendResponse({ success: true })
    return true
  }
})

async function addCustomBlockedSite(site) {
  if (!customBlockedSites.includes(site)) {
    customBlockedSites.push(site)
    await chrome.storage.local.set({ customBlockedSites })
    console.log("[Marshal Background] Added custom site:", site)
    if (studyModeActive) {
      updateBlockingRules()
    }
  }
}

async function removeCustomBlockedSite(site) {
  customBlockedSites = customBlockedSites.filter(s => s !== site)
  await chrome.storage.local.set({ customBlockedSites })
  console.log("[Marshal Background] Removed custom site:", site)
  if (studyModeActive) {
    updateBlockingRules()
  }
}

async function toggleDefaultSite(site) {
  if (disabledDefaultSites.includes(site)) {
    disabledDefaultSites = disabledDefaultSites.filter(s => s !== site)
  } else {
    disabledDefaultSites.push(site)
  }
  await chrome.storage.local.set({ disabledDefaultSites })
  console.log("[Marshal Background] Toggled default site:", site, "Disabled:", disabledDefaultSites.includes(site))
  if (studyModeActive) {
    updateBlockingRules()
  }
}

// Helper function to check if URL should be blocked
function shouldBlockUrl(url) {
  if (!studyModeActive) return false
  
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()
    
    // Get enabled default sites
    const enabledDefaultSites = DEFAULT_BLOCKED_SITES.filter(
      site => !disabledDefaultSites.includes(site)
    )
    
    const allBlockedSites = [...enabledDefaultSites, ...customBlockedSites]
    
    // Check if hostname matches any blocked site (including subdomains)
    return allBlockedSites.some(blockedSite => {
      // Remove www. for comparison
      const cleanHostname = hostname.replace(/^www\./, '')
      const cleanBlockedSite = blockedSite.replace(/^www\./, '')
      
      // Check exact match or subdomain match
      return cleanHostname === cleanBlockedSite || 
             cleanHostname.endsWith('.' + cleanBlockedSite)
    })
  } catch (e) {
    console.error("[Marshal Background] Error checking URL:", e)
    return false
  }
}

// âš¡ MANIFEST V3: Use declarativeNetRequest for blocking
async function updateBlockingRules() {
  console.log("[Marshal Background] 🔄 Updating blocking rules...")

  try {
    // Remove all existing dynamic rules first
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules()
    const ruleIdsToRemove = existingRules.map(rule => rule.id)

    if (ruleIdsToRemove.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIdsToRemove
      })
      console.log("[Marshal Background] ✅ Removed", ruleIdsToRemove.length, "existing rules")
    }

    if (!studyModeActive) {
      console.log("[Marshal Background] ❌ Study mode OFF - no rules added")
      return
    }

    // Get enabled default sites
    const enabledDefaultSites = DEFAULT_BLOCKED_SITES.filter(
      site => !disabledDefaultSites.includes(site)
    )

    const allBlockedSites = [...enabledDefaultSites, ...customBlockedSites]

    if (allBlockedSites.length === 0) {
      console.log("[Marshal Background] ⚠️ No sites to block")
      return
    }

    console.log("[Marshal Background] 🚫 Blocking sites:", allBlockedSites)

    // Create blocking rules
    const rules = []
    let ruleId = 1

    for (const site of allBlockedSites) {
      const cleanSite = site.replace(/^www\./, '')
      
      // Rule 1: Block http://example.com/*
      rules.push({
        id: ruleId++,
        priority: 1,
        action: {
          type: "redirect",
          redirect: { url: chrome.runtime.getURL("blocked.html") }
        },
        condition: {
          urlFilter: `*://${cleanSite}/*`,
          resourceTypes: ["main_frame"]
        }
      })

      // Rule 2: Block http://www.example.com/*
      rules.push({
        id: ruleId++,
        priority: 1,
        action: {
          type: "redirect",
          redirect: { url: chrome.runtime.getURL("blocked.html") }
        },
        condition: {
          urlFilter: `*://www.${cleanSite}/*`,
          resourceTypes: ["main_frame"]
        }
      })

      // Rule 3: Block http://*.example.com/*
      rules.push({
        id: ruleId++,
        priority: 1,
        action: {
          type: "redirect",
          redirect: { url: chrome.runtime.getURL("blocked.html") }
        },
        condition: {
          urlFilter: `*://*.${cleanSite}/*`,
          resourceTypes: ["main_frame"]
        }
      })
    }

    //Rule for all subdomains
    // Rule for all subdomains
        rules.push({
          id: index * 2 + 3 + 1000,
          priority: 1,
          action: {
            type: "redirect",
            redirect: { url: chrome.runtime.getURL("blocked.html") }
          },
          condition: {
            urlFilter: `*://*.${site}/*`,
            resourceTypes: ["main_frame"]
          }
        })

    // Add all rules at once
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: rules
    })

    console.log("[Marshal Background] ✅ Added", rules.length, "blocking rules")
    console.log("[Marshal Background] 🎯 Study Mode is now ACTIVE and blocking!")

  } catch (error) {
    console.error("[Marshal Background] ❌ Error updating rules:", error)
  }
}

// Track blocked attempts when tabs navigate to blocked.html
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && changeInfo.url.includes(chrome.runtime.getURL("blocked.html"))) {
    console.log("[Marshal Background] 🚫 Site blocked, tracking attempt")
    
    // Get the original URL from tab history if possible
  }
})

// Alternative: Track using webNavigation as backup
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) return // Only main frame
  
  if (studyModeActive && shouldBlockUrl(details.url)) {
    console.log("[Marshal Background] 🚫 Navigation blocked:", details.url)
    
    try {
      const hostname = new URL(details.url).hostname
      trackBlockAttempt(hostname)
    } catch (e) {
      console.error("[Marshal Background] Error tracking:", e)
    }
  }
})

function shouldBlockUrl(url) {
  if (!studyModeActive) return false

  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()

    // Get enabled default sites
    const enabledDefaultSites = DEFAULT_BLOCKED_SITES.filter(
      site => !disabledDefaultSites.includes(site)
    )

    const allBlockedSites = [...enabledDefaultSites, ...customBlockedSites]

    // Check if hostname matches any blocked site
    return allBlockedSites.some(blockedSite => {
      const cleanHostname = hostname.replace(/^www\./, '')
      const cleanBlockedSite = blockedSite.replace(/^www\./, '')

      return cleanHostname === cleanBlockedSite || 
             cleanHostname.endsWith('.' + cleanBlockedSite)
    })
  } catch (e) {
    return false
  }
}

// Track block attempts for stats
async function trackBlockAttempt(hostname) {
  const now = new Date()
  const hour = now.getHours()
  const date = now.toDateString()

  const result = await chrome.storage.local.get([
    "dailyBlockedAttempts",
    "hourlyAttempts",
    "blockedSitesCount",
    "weeklyStats",
    "totalTimeSaved"
  ])

  // Increment daily attempts
  const dailyAttempts = (result.dailyBlockedAttempts || 0) + 1

  // Track hourly attempts
  const hourlyAttempts = result.hourlyAttempts || {}
  hourlyAttempts[hour] = (hourlyAttempts[hour] || 0) + 1

  // Track per-site attempts
  const siteCounts = result.blockedSitesCount || {}
  siteCounts[hostname] = (siteCounts[hostname] || 0) + 1

  // Track weekly stats
  const weeklyStats = result.weeklyStats || {}
  weeklyStats[date] = (weeklyStats[date] || 0) + 1

  // Calculate time saved (0.1 seconds per block)
  const timeSaved = (result.totalTimeSaved || 0) + 0.1

  await chrome.storage.local.set({
    dailyBlockedAttempts: dailyAttempts,
    hourlyAttempts: hourlyAttempts,
    blockedSitesCount: siteCounts,
    weeklyStats: weeklyStats,
    totalTimeSaved: timeSaved,
    lastBlockTime: Date.now()
  })

  console.log("[Marshal Background] 📊 Stats updated:", {
    dailyAttempts,
    timeSaved,
    hostname
  })
}

// Listen for navigation to blocked sites (for stats tracking)
chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((details) => {
  console.log("[Marshal Background] 🚫 Rule matched:", details)
  // Track the block attempt
  try {
    const url = new URL(details.request.url)
    trackBlockAttempt(url.hostname)
  } catch (e) {
    console.error("[Marshal Background] Error tracking block:", e)
  }
})


// Sync Google Classroom data periodically
async function syncGoogleClassroomData() {
  console.log("[Marshal Background] Starting Google Classroom sync...")

  try {
    const token = await getAuthToken()
    const coursesData = await fetchCourses(token)

    if (!coursesData.courses || coursesData.courses.length === 0) {
      console.log("[Marshal Background] No courses found")
      return
    }

    const allAssignments = []

    for (const course of coursesData.courses) {
      const courseWorkData = await fetchCourseWork(token, course.id)

      if (courseWorkData.courseWork) {
        for (const work of courseWorkData.courseWork) {
          const submission = await fetchSubmissionStatus(token, course.id, work.id)

          const submissionState = submission?.state || "NEW"
          const isTurnedIn =
            submissionState === "TURNED_IN" ||
            submissionState === "RETURNED" ||
            submissionState === "RECLAIMED_BY_STUDENT"

          const assignment = {
            courseId: course.id,
            courseName: course.name,
            title: work.title,
            dueDate: work.dueDate,
            dueTime: work.dueTime,
            turnedIn: isTurnedIn,
            link: work.alternateLink
          }

          allAssignments.push(assignment)
        }
      }
    }

    await categorizeAndSaveAssignments(allAssignments)
    console.log("[Marshal Background] Sync completed successfully")
  } catch (error) {
    console.error("[Marshal Background] Sync error:", error)
  }
}

// Helper functions
function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError)
      } else {
        resolve(token)
      }
    })
  })
}

async function fetchCourses(token) {
  const response = await fetch("https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE", {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch courses: ${response.statusText}`)
  }

  return response.json()
}

async function fetchCourseWork(token, courseId) {
  const response = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    if (response.status === 404) {
      return { courseWork: [] }
    }
    throw new Error(`Failed to fetch coursework: ${response.statusText}`)
  }

  return response.json()
}

async function fetchSubmissionStatus(token, courseId, courseWorkId) {
  try {
    const response = await fetch(
      `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    )

    if (!response.ok) return null

    const data = await response.json()
    const submissions = data.studentSubmissions || []

    let submission = submissions.find(
      (s) => s.state === "TURNED_IN" || s.state === "RETURNED" || s.state === "RECLAIMED_BY_STUDENT",
    )

    if (!submission && submissions.length > 0) {
      submission = submissions[0]
    }

    return submission
  } catch (e) {
    return null
  }
}

async function categorizeAndSaveAssignments(assignments) {
  const now = new Date()
  const urgentTasks = []
  const missedTasks = []

  for (const assignment of assignments) {
    if (assignment.turnedIn) continue

    if (!assignment.dueDate) continue

    const dueDate = new Date(
      assignment.dueDate.year,
      assignment.dueDate.month - 1,
      assignment.dueDate.day,
      assignment.dueTime?.hours || 23,
      assignment.dueTime?.minutes || 59,
    )

    const diffTime = dueDate - now
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    const task = {
      title: assignment.title,
      subject: assignment.courseName,
      dueDate: dueDate.toISOString(),
      urgency: diffDays <= 1 ? "high" : diffDays <= 3 ? "medium" : "low",
      link: assignment.link
    }

    if (diffTime < 0) {
      missedTasks.push(task)
    } else if (diffDays <= 7) {
      urgentTasks.push(task)
    }
  }

  await chrome.storage.local.set({
    urgentTasks: urgentTasks,
    missedTasks: missedTasks,
  })
}

// Sync every 15 minutes
setInterval(syncGoogleClassroomData, 15 * 60 * 1000)

// Initial sync after 5 seconds
setTimeout(syncGoogleClassroomData, 5000)