// blocked.js - External JavaScript for blocked.html
console.log("[Blocked Page] Script loaded")

// Load the logo using chrome.runtime.getURL
const logoImg = document.getElementById('logoImg');
if (logoImg) {
  logoImg.src = chrome.runtime.getURL('icons/marshal-logo.png');
  console.log("[Blocked Page] Logo loaded")
}

async function loadDailyQuote() {
  try {
    const response = await fetch(chrome.runtime.getURL('quotes.json'))
    const data = await response.json()
    const quotes = data.quotes

    const now = new Date()
    const start = new Date(now.getFullYear(), 0, 0)
    const diff = now - start
    const oneDay = 1000 * 60 * 60 * 24
    const dayOfYear = Math.floor(diff / oneDay)

    const quoteIndex = dayOfYear % quotes.length
    document.getElementById('dailyQuote').textContent = `"${quotes[quoteIndex]}"`
    console.log("[Blocked Page] Quote loaded")
  } catch (error) {
    console.error('[Blocked Page] Error loading quote:', error)
  }
}

function loadStats() {
  chrome.storage.local.get([
    'dailyBlockedAttempts',
    'totalTimeSaved'
  ], (result) => {
    const attempts = result.dailyBlockedAttempts || 0
    const timeSavedMinutes = result.totalTimeSaved || 0

    const hours = Math.floor(timeSavedMinutes / 60)
    const minutes = timeSavedMinutes % 60
    let timeDisplay = ''
    if (hours > 0) {
      timeDisplay = `${hours}h ${minutes}m`
    } else if (minutes > 0) {
      timeDisplay = `${minutes}m`
    } else {
      timeDisplay = '0m'
    }

    document.getElementById('timeSavedStat').textContent = timeDisplay
    document.getElementById('blocksMadeStat').textContent = attempts
    
    console.log("[Blocked Page] Stats loaded - Attempts:", attempts, "Time Saved:", timeSavedMinutes)
  })
}

document.getElementById('viewAnalyticsBtn').addEventListener('click', () => {
  console.log("[Blocked Page] View Analytics clicked")
  chrome.storage.local.set({ openStatsOnPopup: true }, () => {
    chrome.runtime.sendMessage({ action: 'openStatsPage' })
  })
})

document.getElementById('openMarshalBtn').addEventListener('click', () => {
  console.log("[Blocked Page] Open Marshal clicked")
  chrome.runtime.sendMessage({ action: 'openStatsPage' })
})

// Add click handler for remove site buttons
document.addEventListener('click', async (e) => {
  if (e.target.closest('.remove-site-btn')) {
    const btn = e.target.closest('.remove-site-btn')
    const site = btn.dataset.site
    const kind = btn.dataset.kind
    
    if (kind === 'custom') {
      await chrome.runtime.sendMessage({ action: 'removeCustomSite', site })
    } else {
      await chrome.runtime.sendMessage({ action: 'toggleDefaultSite', site })
    }
    
    loadBlockedSites()
    showNotification(`${site} removed from blocked list`, 'success')
  }
})

// Initialize on page load
loadDailyQuote()
loadStats()
setInterval(loadStats, 3000)

