// stats.js - Focus Mode Statistics Page Logic with Real-Time Updates

document.addEventListener('DOMContentLoaded', () => {
  // Initial load
  loadStatistics()
  
  // Refresh stats every 3 seconds for real-time updates
  setInterval(loadStatistics, 3000)
  
  // Event listeners
  document.getElementById('closeBtn')?.addEventListener('click', () => {
    window.close()
  })
  
  document.getElementById('backToHomeBtn')?.addEventListener('click', () => {
    window.location.href = 'popup.html'
  })
})

async function loadStatistics() {
  console.log('[Stats] Loading statistics...')
  
  // Set current date
  const now = new Date()
  const dateOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
  document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', dateOptions)
  
  // Load all stats from storage
  const result = await chrome.storage.local.get([
    'dailyBlockedAttempts',
    'totalTimeSaved',
    'hourlyAttempts',
    'blockedSitesCount',
    'weeklyStats',
    'studyStartTime',
    'focusStreak'
  ])
  
  console.log('[Stats] Data loaded:', result)
  
  // Display today's stats
  displayTodayStats(result)
  
  // Display hourly breakdown
  displayHourlyChart(result.hourlyAttempts || {})
  
  // Display weekly stats
  displayWeeklyStats(result.weeklyStats || {}, result.totalTimeSaved || 0)
  
  // Display most blocked sites
  displayBlockedSites(result.blockedSitesCount || {})
  
  // Display motivation message
  displayMotivation(result.dailyBlockedAttempts || 0, result.totalTimeSaved || 0)
}

function displayTodayStats(data) {
  // Time saved
  const timeSaved = data.totalTimeSaved || 0
  const hours = Math.floor(timeSaved / 60)
  const minutes = timeSaved % 60
  
  const timeSavedEl = document.getElementById('timeSavedToday')
  if (timeSavedEl) {
    if (hours > 0) {
      timeSavedEl.textContent = `${hours}h ${minutes}m`
    } else {
      timeSavedEl.textContent = `${minutes}m`
    }
  }
  
  // Blocks count
  const blocksTodayEl = document.getElementById('blocksToday')
  if (blocksTodayEl) {
    blocksTodayEl.textContent = data.dailyBlockedAttempts || 0
  }
  
  // Peak time
  const hourlyAttempts = data.hourlyAttempts || {}
  const peakTimeEl = document.getElementById('peakTime')
  
  if (peakTimeEl) {
    if (Object.keys(hourlyAttempts).length > 0) {
      const peakHour = Object.keys(hourlyAttempts).reduce((a, b) => 
        hourlyAttempts[a] > hourlyAttempts[b] ? a : b
      )
      const hour12 = peakHour % 12 || 12
      const ampm = peakHour < 12 ? 'AM' : 'PM'
      peakTimeEl.textContent = `${hour12}${ampm}`
    } else {
      peakTimeEl.textContent = '--'
    }
  }
  
  // Streak days
  const streakEl = document.getElementById('streakDays')
  if (streakEl) {
    const streak = Object.keys(data.weeklyStats || {}).length || 0
    streakEl.textContent = streak
  }
}

function displayHourlyChart(hourlyAttempts) {
  const chartBars = document.getElementById('hourlyChart')
  const chartLabels = document.getElementById('hourlyLabels')
  
  if (!chartBars || !chartLabels) {
    console.error('[Stats] Chart containers not found')
    return
  }
  
  // If no data, show all hours with 0 height
  if (Object.keys(hourlyAttempts).length === 0) {
    const hoursToShow = [9, 12, 15, 18, 21]
    
    chartBars.innerHTML = hoursToShow.map(() => `
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
        <div class="chart-bar" style="height: 4px;"></div>
      </div>
    `).join('')
    
    chartLabels.innerHTML = hoursToShow.map(hour => `
      <div class="chart-label" style="flex: 1;">${hour % 12 || 12}${hour < 12 ? 'AM' : 'PM'}</div>
    `).join('')
    
    return
  }
  
  // Get all hours that have attempts, or use default hours
  const allHours = Object.keys(hourlyAttempts).map(h => parseInt(h))
  const hoursToShow = allHours.length > 0 ? allHours.sort((a, b) => a - b) : [9, 12, 15, 18, 21]
  const maxAttempts = Math.max(...Object.values(hourlyAttempts), 1)
  
  chartBars.innerHTML = ''
  chartLabels.innerHTML = ''
  
  hoursToShow.forEach(hour => {
    const attempts = hourlyAttempts[hour] || 0
    const heightPercent = Math.max((attempts / maxAttempts) * 100, 4) // Minimum 4% height
    
    // Create bar wrapper
    const barWrapper = document.createElement('div')
    barWrapper.style.flex = '1'
    barWrapper.style.display = 'flex'
    barWrapper.style.flexDirection = 'column'
    barWrapper.style.alignItems = 'center'
    barWrapper.style.justifyContent = 'flex-end'
    
    const bar = document.createElement('div')
    bar.className = 'chart-bar'
    bar.style.height = `${heightPercent}%`
    bar.style.minHeight = '4px'
    bar.title = `${attempts} attempt${attempts !== 1 ? 's' : ''} at ${hour % 12 || 12}${hour < 12 ? 'AM' : 'PM'}`
    
    // Add count label inside bar if there are attempts
    if (attempts > 0) {
      bar.innerHTML = `<span style="color: white; font-size: 11px; font-weight: 700; padding: 4px;">${attempts}</span>`
    }
    
    barWrapper.appendChild(bar)
    chartBars.appendChild(barWrapper)
    
    // Create label
    const label = document.createElement('div')
    label.className = 'chart-label'
    label.style.flex = '1'
    label.textContent = `${hour % 12 || 12}${hour < 12 ? 'AM' : 'PM'}`
    chartLabels.appendChild(label)
  })
}

function displayWeeklyStats(weeklyStats, totalTimeSaved) {
  // Calculate week totals
  const weekBlocks = Object.values(weeklyStats).reduce((sum, val) => sum + val, 0)
  
  // Time saved this week
  const weekHours = Math.floor(totalTimeSaved / 60)
  const weekMinutes = totalTimeSaved % 60
  
  const weekTimeSavedEl = document.getElementById('weekTimeSaved')
  if (weekTimeSavedEl) {
    weekTimeSavedEl.textContent = `${weekHours}h ${weekMinutes}m`
  }
  
  // Total blocks this week
  const weekBlocksEl = document.getElementById('weekBlocks')
  if (weekBlocksEl) {
    weekBlocksEl.textContent = weekBlocks
  }
  
  // Find most productive day (day with least blocks)
  const mostProductiveDayEl = document.getElementById('mostProductiveDay')
  const peakDayEl = document.getElementById('peakDay')
  
  if (Object.keys(weeklyStats).length > 0) {
    // Most productive day (fewest blocks)
    const sortedDays = Object.entries(weeklyStats).sort((a, b) => a[1] - b[1])
    const mostProductiveDate = new Date(sortedDays[0][0])
    const mostProductiveDay = mostProductiveDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    
    if (mostProductiveDayEl) {
      mostProductiveDayEl.textContent = mostProductiveDay
    }
    
    // Peak day (most blocks)
    const peakDayData = Object.entries(weeklyStats).reduce((a, b) => a[1] > b[1] ? a : b)
    const peakDate = new Date(peakDayData[0])
    const peakDayName = peakDate.toLocaleDateString('en-US', { weekday: 'short' })
    
    if (peakDayEl) {
      peakDayEl.textContent = peakDayName
    }
  } else {
    if (mostProductiveDayEl) mostProductiveDayEl.textContent = '--'
    if (peakDayEl) peakDayEl.textContent = '--'
  }
}

function displayBlockedSites(blockedSitesCount) {
  const container = document.getElementById('blockedSitesList')
  
  if (!container) {
    console.error('[Stats] Blocked sites container not found')
    return
  }
  
  if (Object.keys(blockedSitesCount).length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No sites blocked yet today!</p></div>'
    return
  }
  
  // Sort sites by count
  const sortedSites = Object.entries(blockedSitesCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5) // Top 5 sites
  
  const maxCount = sortedSites[0][1]
  
  container.innerHTML = sortedSites.map(([site, count], index) => {
    const percentage = (count / maxCount) * 100
    const cleanSite = site.replace('www.', '')
    
    return `
      <div class="blocked-site-item">
        <span class="site-rank">${index + 1}.</span>
        <div class="site-info">
          <div class="site-name">${cleanSite}</div>
          <div class="site-bar-container">
            <div class="site-bar-fill" style="width: ${percentage}%"></div>
          </div>
        </div>
        <span class="site-count">${count}</span>
      </div>
    `
  }).join('')
}

function displayMotivation(blocks, timeSaved) {
  const motivationEl = document.getElementById('motivationText')
  
  if (!motivationEl) return
  
  const hours = Math.floor(timeSaved / 60)
  const minutes = timeSaved % 60
  
  let message = ''
  
  if (timeSaved === 0 && blocks === 0) {
    message = "Great start! Enable Focus Mode to start tracking your productivity."
  } else if (blocks === 0) {
    message = "Perfect focus today! You haven't been distracted at all! 🎯"
  } else if (blocks === 1) {
    message = "One slip-up, but you're back on track! Stay strong! 💪"
  } else if (blocks <= 3) {
    message = `You've resisted ${blocks} distractions today! That's amazing willpower! 🌟`
  } else if (blocks <= 5) {
    message = `${blocks} distractions blocked. You're saving time for what matters! ⏰`
  } else if (timeSaved >= 60) {
    message = `Wow! You've saved ${hours} hour${hours > 1 ? 's' : ''} this week! That's enough time to finish ${Math.floor(hours / 2)} assignments! 📚`
  } else if (timeSaved >= 30) {
    message = `You've saved ${minutes} minutes today! That's like finishing a whole assignment! 🎓`
  } else {
    message = `Every block brings you closer to your goals! Keep going! 🚀`
  }
  
  motivationEl.textContent = message
}