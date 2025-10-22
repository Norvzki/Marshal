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

// Listen for study mode toggle
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
  } else if (message.action === "addCustomSite") {
    addCustomBlockedSite(message.site)
    sendResponse({ success: true })
  } else if (message.action === "removeCustomSite") {
    removeCustomBlockedSite(message.site)
    sendResponse({ success: true })
  } else if (message.action === "toggleDefaultSite") {
    toggleDefaultSite(message.site)
    sendResponse({ success: true })
  } else if (message.action === "getBlockedSites") {
    sendResponse({ 
      default: DEFAULT_BLOCKED_SITES,
      custom: customBlockedSites,
      disabledDefault: disabledDefaultSites
    })
  } else if (message.action === "openStatsPage") {
    chrome.action.openPopup()
    sendResponse({ success: true })
  }
  return true
})

async function addCustomBlockedSite(site) {
  if (!customBlockedSites.includes(site)) {
    customBlockedSites.push(site)
    await chrome.storage.local.set({ customBlockedSites })
    if (studyModeActive) {
      updateBlockingRules()
    }
  }
}

async function removeCustomBlockedSite(site) {
  customBlockedSites = customBlockedSites.filter(s => s !== site)
  await chrome.storage.local.set({ customBlockedSites })
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

// ⚡ MANIFEST V3: Use declarativeNetRequest for instant blocking
async function updateBlockingRules() {
  console.log("[Marshal Background] Updating blocking rules (Manifest V3)...")
  
  // Remove existing listeners
  chrome.webNavigation.onBeforeNavigate.removeListener(blockNavigationInstantly)
  chrome.webNavigation.onCommitted.removeListener(blockCommittedNavigation)
  
  if (studyModeActive) {
    // Get enabled default sites
    const enabledDefaultSites = DEFAULT_BLOCKED_SITES.filter(
      site => !disabledDefaultSites.includes(site)
    )
    
    const allBlockedSites = [...enabledDefaultSites, ...customBlockedSites]
    
    console.log("[Marshal Background] Active blocked sites:", allBlockedSites)
    
    // Use declarativeNetRequest to create blocking rules
    try {
      // First, remove all existing dynamic rules
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules()
      const ruleIdsToRemove = existingRules.map(rule => rule.id)
      
      if (ruleIdsToRemove.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIdsToRemove
        })
      }
      
      // Create new rules for each blocked site
      const rules = []
      allBlockedSites.forEach((site, index) => {
        // Rule for main domain
        rules.push({
          id: index * 2 + 1,
          priority: 1,
          action: {
            type: "redirect",
            redirect: { url: chrome.runtime.getURL("blocked.html") }
          },
          condition: {
            urlFilter: `*://${site}/*`,
            resourceTypes: ["main_frame"]
          }
        })
        
        // Rule for www subdomain
        rules.push({
          id: index * 2 + 2,
          priority: 1,
          action: {
            type: "redirect",
            redirect: { url: chrome.runtime.getURL("blocked.html") }
          },
          condition: {
            urlFilter: `*://www.${site}/*`,
            resourceTypes: ["main_frame"]
          }
        })
        
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
      })
      
      // Add the new rules
      if (rules.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          addRules: rules
        })
        console.log(`[Marshal Background] ✅ Added ${rules.length} declarativeNetRequest rules`)
      }
    } catch (error) {
      console.error("[Marshal Background] ❌ Error setting declarativeNetRequest rules:", error)
      console.log("[Marshal Background] ⚠️ Falling back to webNavigation listeners")
    }
    
    // Also add webNavigation listeners as backup
    chrome.webNavigation.onBeforeNavigate.addListener(blockNavigationInstantly)
    chrome.webNavigation.onCommitted.addListener(blockCommittedNavigation)
    
    console.log("[Marshal Background] Blocking rules activated")
  } else {
    // Remove all dynamic rules when study mode is off
    try {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules()
      const ruleIdsToRemove = existingRules.map(rule => rule.id)
      
      if (ruleIdsToRemove.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIdsToRemove
        })
      }
      console.log("[Marshal Background] All blocking rules removed")
    } catch (error) {
      console.error("[Marshal Background] Error removing rules:", error)
    }
  }
}

// Backup: Block at navigation level
function blockNavigationInstantly(details) {
  // Only process main frame navigations
  if (details.frameId !== 0) return
  
  if (shouldBlockUrl(details.url)) {
    console.log("[Marshal Background] 🚫 BLOCK (Navigation):", details.url)
    trackBlockAttempt(new URL(details.url).hostname)
    
    chrome.tabs.update(details.tabId, {
      url: chrome.runtime.getURL("blocked.html")
    })
  }
}

// Backup: Block after navigation commits
function blockCommittedNavigation(details) {
  // Only process main frame navigations
  if (details.frameId !== 0) return
  
  if (shouldBlockUrl(details.url)) {
    console.log("[Marshal Background] 🚫 BLOCK (Committed):", details.url)
    trackBlockAttempt(new URL(details.url).hostname)
    
    chrome.tabs.update(details.tabId, {
      url: chrome.runtime.getURL("blocked.html")
    })
  }
}

// Track block attempts for stats
async function trackBlockAttempt(hostname) {
  const now = new Date()
  const hour = now.getHours()
  const date = now.toDateString()
  
  const result = await chrome.storage.local.get([
    'dailyBlockedAttempts',
    'hourlyAttempts',
    'blockedSitesCount',
    'weeklyStats',
    'studyStartTime',
    'totalTimeSaved'
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
  
  // Calculate time saved (assume 5 minutes per block)
  const timeSaved = (result.totalTimeSaved || 0) + 5
  
  await chrome.storage.local.set({
    dailyBlockedAttempts: dailyAttempts,
    hourlyAttempts: hourlyAttempts,
    blockedSitesCount: siteCounts,
    weeklyStats: weeklyStats,
    totalTimeSaved: timeSaved,
    lastBlockTime: Date.now()
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
          submissionPromises.push(
            fetchSubmissionStatus(token, course.id, work.id).then(submission => ({
              course,
              work,
              submission
            }))
          )
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