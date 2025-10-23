// Background service worker for Marshal - MANIFEST V3 COMPATIBLE
console.log("[Marshal Background] Service worker initialized (Manifest V3)")

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
const autoSyncAlarmName = "marshal-auto-sync"

// Declare chrome variable
const chrome = window.chrome

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

  if (message.action === "setupAutoSync") {
    setupAutoSyncAlarm(message.intervalMs, message.frequency)
    sendResponse({ success: true })
    return true
  }

  if (message.action === "stopAutoSync") {
    stopAutoSyncAlarm()
    sendResponse({ success: true })
    return true
  }

  if (message.action === "toggleStudyMode") {
    studyModeActive = message.active
    console.log("[Marshal Background] Study mode toggled:", studyModeActive ? "ON" : "OFF")

    // Reset stats when enabling study mode
    if (studyModeActive) {
      chrome.storage.local.set({
        studyStartTime: Date.now(),
        dailyBlockedAttempts: 0,
        hourlyAttempts: {},
        blockedSitesCount: {},
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
      disabledDefault: disabledDefaultSites,
    })
    return true
  }

  if (message.action === "openStatsPage") {
    chrome.action.openPopup()
    sendResponse({ success: true })
    return true
  }
})

function setupAutoSyncAlarm(intervalMs, frequency) {
  const intervalMinutes = intervalMs / (60 * 1000)
  console.log(`[Marshal Background] Setting up auto-sync alarm: ${intervalMinutes} minutes`)

  chrome.alarms.clear(autoSyncAlarmName, () => {
    chrome.alarms.create(autoSyncAlarmName, {
      periodInMinutes: intervalMinutes,
    })
  })
}

function stopAutoSyncAlarm() {
  console.log("[Marshal Background] Stopping auto-sync alarm")
  chrome.alarms.clear(autoSyncAlarmName)
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === autoSyncAlarmName) {
    console.log("[Marshal Background] Auto-sync alarm triggered!")

    chrome.storage.local.set({ lastSyncTime: Date.now() })

    // Notify all open popups to show sync loading screen and perform sync
    chrome.runtime
      .sendMessage({
        action: "performAutoSync",
      })
      .catch(() => {
        // Popup might not be open, that's okay
        console.log("[Marshal Background] No popup open to receive sync message")
      })
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
  customBlockedSites = customBlockedSites.filter((s) => s !== site)
  await chrome.storage.local.set({ customBlockedSites })
  console.log("[Marshal Background] Removed custom site:", site)
  if (studyModeActive) {
    updateBlockingRules()
  }
}

async function toggleDefaultSite(site) {
  if (disabledDefaultSites.includes(site)) {
    disabledDefaultSites = disabledDefaultSites.filter((s) => s !== site)
  } else {
    disabledDefaultSites.push(site)
  }
  await chrome.storage.local.set({ disabledDefaultSites })
  console.log("[Marshal Background] Toggled default site:", site, "Disabled:", disabledDefaultSites.includes(site))
  if (studyModeActive) {
    updateBlockingRules()
  }
}

// âš¡ MANIFEST V3: Use declarativeNetRequest for blocking
async function updateBlockingRules() {
  console.log("[Marshal Background] 🔄 Updating blocking rules...")

  try {
    // Remove all existing dynamic rules first
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules()
    const ruleIdsToRemove = existingRules.map((rule) => rule.id)

    if (ruleIdsToRemove.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIdsToRemove,
      })
      console.log("[Marshal Background] ✅ Removed", ruleIdsToRemove.length, "existing rules")
    }

    if (!studyModeActive) {
      console.log("[Marshal Background] ❌ Study mode OFF - no rules added")
      return
    }

    // Get enabled default sites
    const enabledDefaultSites = DEFAULT_BLOCKED_SITES.filter((site) => !disabledDefaultSites.includes(site))

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
      const cleanSite = site.replace(/^www\./, "")

      // Rule 1: Block http://example.com/*
      rules.push({
        id: ruleId++,
        priority: 1,
        action: {
          type: "redirect",
          redirect: { url: chrome.runtime.getURL("blocked.html") },
        },
        condition: {
          urlFilter: `*://${cleanSite}/*`,
          resourceTypes: ["main_frame"],
        },
      })

      // Rule 2: Block http://www.example.com/*
      rules.push({
        id: ruleId++,
        priority: 1,
        action: {
          type: "redirect",
          redirect: { url: chrome.runtime.getURL("blocked.html") },
        },
        condition: {
          urlFilter: `*://www.${cleanSite}/*`,
          resourceTypes: ["main_frame"],
        },
      })

      // Rule 3: Block http://*.example.com/*
      rules.push({
        id: ruleId++,
        priority: 1,
        action: {
          type: "redirect",
          redirect: { url: chrome.runtime.getURL("blocked.html") },
        },
        condition: {
          urlFilter: `*://*.${cleanSite}/*`,
          resourceTypes: ["main_frame"],
        },
      })
    }

    // Add all rules at once
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: rules,
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
    const enabledDefaultSites = DEFAULT_BLOCKED_SITES.filter((site) => !disabledDefaultSites.includes(site))

    const allBlockedSites = [...enabledDefaultSites, ...customBlockedSites]

    // Check if hostname matches any blocked site
    return allBlockedSites.some((blockedSite) => {
      const cleanHostname = hostname.replace(/^www\./, "")
      const cleanBlockedSite = blockedSite.replace(/^www\./, "")

      return cleanHostname === cleanBlockedSite || cleanHostname.endsWith("." + cleanBlockedSite)
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
    "totalTimeSaved",
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

  // Calculate time saved (5 minutes per block)
  const timeSaved = (result.totalTimeSaved || 0) + 5

  await chrome.storage.local.set({
    dailyBlockedAttempts: dailyAttempts,
    hourlyAttempts: hourlyAttempts,
    blockedSitesCount: siteCounts,
    weeklyStats: weeklyStats,
    totalTimeSaved: timeSaved,
    lastBlockTime: Date.now(),
  })

  console.log("[Marshal Background] 📊 Stats updated:", {
    dailyAttempts,
    timeSaved,
    hostname,
  })
}

// Google Classroom sync (keeping your existing code)
async function syncGoogleClassroomData() {
<<<<<<< HEAD
  console.log("[Marshal Background] ⚡ Starting sync...")
  // ... rest of your sync code ...
}

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log("[Marshal Background] Extension installed/updated")
  chrome.storage.local.get(["studyModeActive"], (result) => {
    studyModeActive = result.studyModeActive || false
    if (studyModeActive) {
      updateBlockingRules()
    }
=======
  console.log("[Marshal Background] ⚡ Starting FAST sync...")
  const startTime = Date.now()

  try {
    const token = await getAuthToken()
    const coursesData = await fetchCourses(token)

    if (!coursesData.courses || coursesData.courses.length === 0) {
      console.log("[Marshal Background] No courses found")
      return
    }

    console.log(`[Marshal Background] Found ${coursesData.courses.length} courses`)

    // OPTIMIZATION: Fetch all coursework in parallel
    const courseWorkPromises = coursesData.courses.map(course =>
      fetchCourseWork(token, course.id).then(courseWorkData => ({
        course,
        courseWorkData
      }))
    )

    const courseWorkResults = await Promise.all(courseWorkPromises)

    // OPTIMIZATION: Fetch all submissions in parallel
    const submissionPromises = []

    for (const { course, courseWorkData } of courseWorkResults) {
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
            link: work.alternateLink,
          }

          allAssignments.push(assignment)
        }
      }
    }

    console.log(`[Marshal Background] Fetching ${submissionPromises.length} submissions in parallel...`)
    const submissionResults = await Promise.all(submissionPromises)

    // Build assignments array
    const allAssignments = submissionResults.map(({ course, work, submission }) => {
      const submissionState = submission?.state || "NEW"
      const isTurnedIn =
        submissionState === "TURNED_IN" ||
        submissionState === "RETURNED" ||
        submissionState === "RECLAIMED_BY_STUDENT"

      return {
        courseId: course.id,
        courseName: course.name,
        title: work.title,
        dueDate: work.dueDate,
        dueTime: work.dueTime,
        turnedIn: isTurnedIn,
        link: work.alternateLink
      }
    })

    await categorizeAndSaveAssignments(allAssignments)
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`[Marshal Background] ✅ Sync completed in ${elapsed}s`)
  } catch (error) {
    console.error("[Marshal Background] ❌ Sync error:", error)
  }
}

async function fetchWithRetry(fetchFn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchFn()
    } catch (error) {
      if (i === maxRetries - 1) throw error
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, i), 5000)
      console.log(`[Marshal] Retry ${i + 1}/${maxRetries} after ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

// OPTIMIZATION: Batch submissions fetching (optional, for even more speed)
async function fetchSubmissionStatusBatch(token, courseId, courseWorkIds) {
  // Fetch multiple submissions in parallel chunks to avoid overwhelming the API
  const CHUNK_SIZE = 10
  const results = []
  
  for (let i = 0; i < courseWorkIds.length; i += CHUNK_SIZE) {
    const chunk = courseWorkIds.slice(i, i + CHUNK_SIZE)
    const chunkResults = await Promise.all(
      chunk.map(id => fetchSubmissionStatus(token, courseId, id))
    )
    results.push(...chunkResults)
    
    // Small delay between chunks to respect rate limits
    if (i + CHUNK_SIZE < courseWorkIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  return results
}

// Helper functions
function getAuthToken() {
  return new Promise((resolve, reject) => {
    window.chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (window.chrome.runtime.lastError) {
        reject(window.chrome.runtime.lastError)
      } else {
        resolve(token)
      }
    })
>>>>>>> 299877b29e4f10467226156c37b3251f41d2a483
  })
})
