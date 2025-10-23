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
chrome.storage.local.get(["studyModeActive", "customBlockedSites", "disabledDefaultSites", "disabledDefault"], (result) => {
  studyModeActive = result.studyModeActive || false
  customBlockedSites = result.customBlockedSites || []
  // Merge legacy/UI key 'disabledDefault' with canonical 'disabledDefaultSites'
  const fromCanonical = result.disabledDefaultSites || []
  const fromUiKey = result.disabledDefault || []
  disabledDefaultSites = Array.from(new Set([...(fromCanonical || []), ...(fromUiKey || [])]))
  // Persist merged state back to both keys for consistency
  chrome.storage.local.set({ disabledDefaultSites, disabledDefault: disabledDefaultSites })

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
  
  if (message.action === "disableDefaultSite") {
    disableDefaultSite(message.site)
    sendResponse({ success: true })
    return true
  }
  
  if (message.action === "enableDefaultSite") {
    enableDefaultSite(message.site)
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
  await chrome.storage.local.set({ disabledDefaultSites, disabledDefault: disabledDefaultSites })
  console.log("[Marshal Background] Toggled default site:", site, "Disabled:", disabledDefaultSites.includes(site))
  if (studyModeActive) {
    updateBlockingRules()
  }
}

async function disableDefaultSite(site) {
  if (!disabledDefaultSites.includes(site)) {
    disabledDefaultSites.push(site)
    await chrome.storage.local.set({ disabledDefaultSites, disabledDefault: disabledDefaultSites })
    console.log("[Marshal Background] Disabled default site:", site)
    if (studyModeActive) {
      updateBlockingRules()
    }
  }
}

async function enableDefaultSite(site) {
  if (disabledDefaultSites.includes(site)) {
    disabledDefaultSites = disabledDefaultSites.filter(s => s !== site)
    await chrome.storage.local.set({ disabledDefaultSites, disabledDefault: disabledDefaultSites })
    console.log("[Marshal Background] Enabled default site:", site)
    if (studyModeActive) {
      updateBlockingRules()
    }
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

  // Calculate time saved (5 minutes per block)
  const timeSaved = (result.totalTimeSaved || 0) + 5

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

// Google Classroom sync (keeping your existing code)
async function syncGoogleClassroomData() {
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
  })
})