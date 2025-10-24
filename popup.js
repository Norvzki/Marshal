/* eslint-disable no-undef */
/* global chrome */
/** @type {typeof chrome} */
// @ts-ignore - chrome is a global API provided by the browser extension runtime
const chrome_api = chrome

// popup.js
// ===========================
// PAGE NAVIGATION SYSTEM
// ===========================
let currentPage = "homePage"
let currentPlanId = null
let currentTasks = []
let currentSortBy = "date"
let editingTaskIndex = null
let deletingTaskIndex = null
let deletingPlanId = null
let planToDelete = null
let expandedSection = null
let taskCount = 0
let isSyncing = false
let syncIntervalId = null
const lastSyncTime = 0
let filterMode = "all"
let isAddingTask = false

const SYNC_INTERVALS = {
  15: 15 * 60 * 1000,
  30: 30 * 60 * 1000,
  60: 60 * 60 * 1000,
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return "Never synced"
  const diffMs = Date.now() - timestamp
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}

async function updateSyncStatus() {
  try {
    const { lastSyncAt } = await chrome.storage.local.get("lastSyncAt")
    const btn = document.getElementById("syncStatusBtn")
    if (btn) {
      const label = formatTimeAgo(lastSyncAt)
      btn.textContent = label
      // Make it look like the Sync Now button
      btn.classList.add("sync-now-btn")
      // Non-interactive
      btn.disabled = true
      btn.style.pointerEvents = "none"
      btn.title = ""
      // When never synced, show red; otherwise show green (Just now or time ago)
      if (!lastSyncAt) {
        btn.style.background = "#ef4444"
        btn.style.borderColor = "#ef4444"
        btn.style.color = "#ffffff"
      } else {
        btn.style.background = "#10b981"
        btn.style.borderColor = "#10b981"
        btn.style.color = "#ffffff"
      }
    }
  } catch (e) {
    console.error("[Marshal] Failed to update sync status:", e)
  }
}

// Global variables for AI analysis state
let currentAnalyzedTask = null
let lastAiAnalysis = null
let aiSourcePage = null

// Declare originalShowPage here to fix linting error
const originalShowPage = (pageId) => {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.add("hidden")
  })
  document.getElementById(pageId)?.classList.remove("hidden")
  currentPage = pageId
}

function showPage(pageId) {
  originalShowPage(pageId)

  if (pageId === "optionsPage") {
    loadOptionsPage()
  } else if (pageId === "urgentTasksPage") {
    loadUrgentTasksPage()
  } else if (pageId === "missedTasksPage") {
    loadMissedTasksPage()
  } else if (pageId === "studyPlansPage") {
    loadStudyPlans()
  } else if (pageId === "planDetailPage") {
    loadPlanDetails()
  }
}

function showSyncLoadingScreen() {
  isSyncing = true
  const overlay = document.getElementById("syncLoadingOverlay")
  if (overlay) {
    overlay.classList.remove("hidden")
    const container = overlay.querySelector(".sync-loading-container")
    container.classList.remove("success")
  }
}

function hideSyncLoadingScreen() {
  const overlay = document.getElementById("syncLoadingOverlay")
  if (overlay) {
    const loadingContainer = overlay.querySelector(".sync-loading-container:not(.sync-success-container)")
    const successContainer = document.getElementById("syncSuccessContainer")

    // Hide the loading container
    if (loadingContainer) {
      loadingContainer.classList.add("hidden")
    }

    // Show the success container
    if (successContainer) {
      successContainer.classList.remove("hidden")
    }

    // Wait for success animation to complete, then hide overlay and show home page
    setTimeout(() => {
      overlay.classList.add("hidden")
      isSyncing = false
      showPage("homePage")
    }, 1500)
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const syncOverlay = document.getElementById("syncLoadingOverlay")
  if (syncOverlay) {
    syncOverlay.classList.add("hidden")
  }

  // Check if we need to open stats page (from blocked.html)
  const result = await chrome.storage.local.get("openStatsOnPopup")
  if (result.openStatsOnPopup) {
    await chrome.storage.local.remove("openStatsOnPopup")
    showPage("focusModeStatsPage")
    loadFocusModeStats()
  }

  // Back button navigation
  document.querySelectorAll(".back-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const targetPage = e.currentTarget.dataset.page
      if (targetPage) {
        showPage(targetPage)
      }
    })
  })

  // View Focus Mode Stats
  document.getElementById("viewFocusStatsBtn")?.addEventListener("click", () => {
    showPage("focusModeStatsPage")
    loadFocusModeStats()
  })

  // Manage Blocked Sites
  document.getElementById("manageBlockedSitesBtn")?.addEventListener("click", () => {
    showPage("manageSitesPage")
    loadBlockedSites()
  })

  // Close button
  document.querySelectorAll(".close-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.close()
    })
  })

  initialize()
})

// ===========================
// HOME PAGE FUNCTIONS
// ===========================
async function initialize() {
  console.log("[Marshal] Initializing...")
  
  // Load dark mode preference first
  const result = await chrome.storage.local.get("darkMode")
  if (result.darkMode !== false) {
    document.body.classList.add('dark-mode')
  }
  
  loadDailyQuote()
  loadStudyModeState()
  loadTasks()

  setInterval(loadTasks, 30000)
}

function startAutoSync(frequency) {
  // Clear existing interval
  if (syncIntervalId) {
    clearInterval(syncIntervalId)
  }

  let intervalMs = SYNC_INTERVALS[frequency]

  // Handle custom frequency
  if (!intervalMs && frequency !== "custom") {
    intervalMs = SYNC_INTERVALS[30] // Default to 30 mins
  } else if (frequency === "custom") {
    const result = chrome.storage.local.get("customSyncInterval")
    intervalMs = (result.customSyncInterval || 30) * 60 * 1000
  }

  console.log(`[Marshal] Auto-sync started with interval: ${intervalMs}ms`)

  syncIntervalId = setInterval(() => {
    performSync()
  }, intervalMs)
}

function stopAutoSync() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId)
    syncIntervalId = null
    console.log("[Marshal] Auto-sync stopped")
  }
}

async function performSync() {
  console.log("[Marshal] performSync called")

  try {
    await new Promise((resolve) => setTimeout(resolve, 500)) // Wait for loading screen to show

    console.log("[Marshal] About to call loadGoogleClassroomData")
    await loadGoogleClassroomData()

    console.log("[Marshal] Sync completed successfully")
    await chrome.storage.local.set({ lastSyncAt: Date.now() })
    // Update sync status label if settings page is open
    updateSyncStatus()
    await new Promise((resolve) => setTimeout(resolve, 1000)) // Show success message
  } catch (error) {
    console.error("[Marshal] Sync error in performSync:", error)
    console.error("[Marshal] Error details:", error.message)

    alert("Sync failed: " + error.message + "\n\nPlease check the console (F12) for more details.")

    throw error
  }
}

async function loadDailyQuote() {
  try {
    const response = await fetch("quotes.json")
    const data = await response.json()
    const quotes = data.quotes

    const now = new Date()
    const start = new Date(now.getFullYear(), 0, 0)
    const diff = now - start
    const oneDay = 1000 * 60 * 60 * 24
    const dayOfYear = Math.floor(diff / oneDay)

    const quoteIndex = dayOfYear % quotes.length
    document.getElementById("dailyQuote").textContent = quotes[quoteIndex]
  } catch (error) {
    console.error("[Marshal] Error loading quote:", error)
    document.getElementById("dailyQuote").textContent = "Stay focused and keep learning!"
  }
}

async function loadStudyModeState() {
  const result = await chrome.storage.local.get("studyModeActive")
  const isActive = result.studyModeActive || false
  const studyModeBtn = document.getElementById("studyModeBtn")
  studyModeBtn.dataset.active = isActive
  studyModeBtn.querySelector(".status-text").textContent = isActive ? "ON" : "OFF"
}

document.getElementById("studyModeBtn")?.addEventListener("click", async () => {
  const studyModeBtn = document.getElementById("studyModeBtn")
  const isActive = studyModeBtn.dataset.active === "true"
  const newState = !isActive

  studyModeBtn.dataset.active = newState
  studyModeBtn.querySelector(".status-text").textContent = newState ? "ON" : "OFF"

  await chrome.storage.local.set({ studyModeActive: newState })
  chrome.runtime.sendMessage({ action: "toggleStudyMode", active: newState })
})

async function loadTasks() {
  try {
    const result = await chrome.storage.local.get(["urgentTasks", "missedTasks"])

    const urgentTasksList = document.getElementById("urgentTasksList")
    const missedTasksList = document.getElementById("missedTasksList")

    let filteredUrgentTasks = []
    if (result.urgentTasks && result.urgentTasks.length > 0) {
      const highUrgency = result.urgentTasks.filter((task) => task.urgency === "high")
      const mediumUrgency = result.urgentTasks.filter((task) => task.urgency === "medium")
      const lowUrgency = result.urgentTasks.filter((task) => task.urgency === "low")

      filteredUrgentTasks = [...highUrgency, ...mediumUrgency, ...lowUrgency]
    }

    if (filteredUrgentTasks.length > 0) {
      urgentTasksList.innerHTML = filteredUrgentTasks
        .slice(0, 3)
        .map((task) => {
          const linkHtml = task.link
            ? `<a href="${task.link}" class="task-link" target="_blank" title="View in Google Classroom">🔗</a>`
            : ""
          return `<div class="task-item urgent">${task.title} ${linkHtml}</div>`
        })
        .join("")
    } else {
      urgentTasksList.innerHTML = '<p class="no-tasks">No urgent tasks</p>'
    }

    if (result.missedTasks && result.missedTasks.length > 0) {
      missedTasksList.innerHTML = result.missedTasks
        .slice(0, 3)
        .map((task) => {
          const linkHtml = task.link
            ? `<a href="${task.link}" class="task-link" target="_blank" title="View in Google Classroom">🔗</a>`
            : ""
          return `<div class="task-item missed">${task.title} ${linkHtml}</div>`
        })
        .join("")
    } else {
      missedTasksList.innerHTML = '<p class="no-tasks">No missed tasks</p>'
    }
  } catch (error) {
    console.error("[Marshal] Error loading tasks:", error)
  }
}

// Navigation from home page
document.getElementById("viewAllBtn")?.addEventListener("click", () => {
  showPage("studyPlansPage")
})

document.getElementById("incompleteBtn")?.addEventListener("click", () => {
  filterMode = "incomplete"
  showPage("studyPlansPage")
})

document.getElementById("completedBtn")?.addEventListener("click", () => {
  filterMode = "complete"
  showPage("studyPlansPage")
})

document.getElementById("urgentTasksBtn")?.addEventListener("click", () => {
  showPage("urgentTasksPage")
})

document.getElementById("missedTasksBtn")?.addEventListener("click", () => {
  showPage("missedTasksPage")
})

document.getElementById("gwaBtn")?.addEventListener("click", () => {
  showPage("gwaPage")
})

// Generate study plan options
const optionsCard = document.getElementById("optionsCard")
const generateBtn = document.getElementById("generateBtn")

generateBtn?.addEventListener("click", () => {
  const isActive = optionsCard.classList.contains("active")
  if (isActive) {
    optionsCard.classList.remove("active")
  } else {
    optionsCard.classList.add("active")
  }
})

document.getElementById("aiGenerateBtn")?.addEventListener("click", () => {
  // Go straight to naming page; loading will occur after user submits the name
  showPage("aiPlanNamingPage")
})

document.getElementById("manualGenerateBtn")?.addEventListener("click", () => {
  showPage("manualPlanPage")
})

document.getElementById("optionsBtn")?.addEventListener("click", () => {
  showPage("optionsPage")
})

document.getElementById("backFromOptionsBtn")?.addEventListener("click", () => {
  showPage("homePage")
})

document.getElementById("autoSyncToggle")?.addEventListener("change", async (e) => {
  const isEnabled = e.target.checked
  await chrome.storage.local.set({ autoSync: isEnabled })

  if (isEnabled) {
    // Start auto-sync
    const result = await chrome.storage.local.get("syncFrequency")
    const frequency = result.syncFrequency || "30"
    startAutoSync(frequency)
  } else {
    // Stop auto-sync and show Sync Now button
    stopAutoSync()
  }

  console.log("[Marshal] Auto-Sync toggled:", isEnabled)
})

document.getElementById("syncNowBtn")?.addEventListener("click", async () => {
  if (isSyncing) {
    console.log("[Marshal] Sync already in progress, ignoring click")
    return
  }

  console.log("[Marshal] Manual sync triggered")
  showSyncLoadingScreen()

  await new Promise((resolve) => setTimeout(resolve, 500))

  try {
    console.log("[v0] About to call performSync")
    await performSync()
    console.log("[v0] performSync completed successfully")
    console.log("[Marshal] Sync completed, showing success")
    await loadTasks()
    await new Promise((resolve) => setTimeout(resolve, 1000))
  } catch (error) {
    console.error("[v0] SYNC FAILED - Error:", error)
    console.error("[v0] Error message:", error.message)
    alert("Sync failed: " + error.message)
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  hideSyncLoadingScreen()
})
// Home page Sync button
document.getElementById("homeSyncBtn")?.addEventListener("click", async () => {
  if (isSyncing) {
    console.log("[Marshal] Sync already in progress, ignoring click")
    return
  }

  console.log("[Marshal] Home manual sync triggered")
  showSyncLoadingScreen()

  await new Promise((resolve) => setTimeout(resolve, 500))

  try {
    await performSync()
    await loadTasks()
    await new Promise((resolve) => setTimeout(resolve, 1000))
  } catch (error) {
    console.error("[v0] SYNC FAILED - Error:", error)
    alert("Sync failed: " + error.message)
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  hideSyncLoadingScreen()
})

document.getElementById("syncFrequencySelect")?.addEventListener("change", async (e) => {
  const frequency = e.target.value

  if (frequency === "custom") {
    // Show custom input
    document.getElementById("customSyncContainer")?.classList.remove("hidden")
  } else {
    // Hide custom input
    document.getElementById("customSyncContainer")?.classList.add("hidden")
    await chrome.storage.local.set({ syncFrequency: frequency })

    // Restart auto-sync with new frequency if enabled
    const result = await chrome.storage.local.get("autoSync")
    if (result.autoSync !== false) {
      startAutoSync(frequency)
    }
  }

  console.log("[Marshal] Sync frequency changed to:", frequency)
})

document.getElementById("customSyncInput")?.addEventListener("change", async (e) => {
  const minutes = Number.parseInt(e.target.value)

  if (minutes && minutes > 0 && minutes <= 1440) {
    await chrome.storage.local.set({ customSyncInterval: minutes })

    // Restart auto-sync with custom interval if enabled
    const result = await chrome.storage.local.get("autoSync")
    if (result.autoSync !== false) {
      startAutoSync("custom")
    }

    console.log("[Marshal] Custom sync interval set to:", minutes, "minutes")
  }
})

document.getElementById("darkModeToggle")?.addEventListener("change", async (e) => {
  const isDarkMode = e.target.checked
  await chrome.storage.local.set({ darkMode: isDarkMode })
  console.log("[Marshal] Dark mode toggled:", isDarkMode)
  
  // Apply dark mode class to body
  if (isDarkMode) {
    document.body.classList.add('dark-mode')
  } else {
    document.body.classList.remove('dark-mode')
  }
})

document.getElementById("exitAccountBtn")?.addEventListener("click", async () => {
  try {
    console.log("[Marshal] Signing out...")
    // Try to get current token silently to revoke
    chrome.identity.getAuthToken({ interactive: false }, async (token) => {
      try {
        if (token) {
          await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`)
        }
      } catch (_) {}
      chrome.identity.clearAllCachedAuthTokens(() => {
        console.log("[Marshal] Auth tokens cleared")
        location.reload()
      })
    })
  } catch (e) {
    console.error("[Marshal] Error during sign out:", e)
    location.reload()
  }
})

async function loadOptionsPage() {
  const result = await chrome.storage.local.get(["autoSync", "syncFrequency", "darkMode", "customSyncInterval"]) 

  const autoSyncToggle = document.getElementById("autoSyncToggle")
  const syncFrequencySelect = document.getElementById("syncFrequencySelect")
  const darkModeToggle = document.getElementById("darkModeToggle")
  const syncNowContainer = document.getElementById("syncNowContainer")
  const customSyncContainer = document.getElementById("customSyncContainer")
  const customSyncInput = document.getElementById("customSyncInput")

  if (autoSyncToggle) {
    autoSyncToggle.checked = result.autoSync !== false
  }

  if (syncFrequencySelect) {
    syncFrequencySelect.value = result.syncFrequency || "30"
  }

  if (darkModeToggle) {
    darkModeToggle.checked = result.darkMode !== false
  }
  
  // Apply dark mode class to body based on saved preference
  if (result.darkMode !== false) {
    document.body.classList.add('dark-mode')
  } else {
    document.body.classList.remove('dark-mode')
  }

  // Always show manual Sync Now button regardless of auto-sync setting
  if (syncNowContainer) {
    syncNowContainer.classList.remove("hidden")
  }

  if (customSyncContainer && syncFrequencySelect?.value === "custom") {
    customSyncContainer.classList.remove("hidden")
    if (customSyncInput && result.customSyncInterval) {
      customSyncInput.value = result.customSyncInterval
    }
  }

  await loadUserProfile()
  await updateSyncStatus()
}

async function loadUserProfile() {
  try {
    const token = await getAuthToken()

    // Fetch user profile from Google API
    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch user profile")
    }

    const userInfo = await response.json()

    // Update profile picture
    const profilePic = document.getElementById("userProfilePic")
    if (profilePic && userInfo.picture) {
      profilePic.src = userInfo.picture
    }

    // Update user name
    const userName = document.getElementById("userName")
    if (userName && userInfo.name) {
      userName.textContent = userInfo.name
    }

    // Update email
    const userEmail = document.getElementById("userEmail")
    if (userEmail && userInfo.email) {
      userEmail.textContent = userInfo.email
    }

    console.log("[Marshal] User profile loaded:", userInfo.name)
  } catch (error) {
    console.error("[Marshal] Error loading user profile:", error)
  }
}

// ===========================
// GOOGLE CLASSROOM INTEGRATION
// ===========================
let allAssignments = []

function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
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
    console.error("Error fetching submission:", e)
    return null
  }
}

async function loadGoogleClassroomData() {
  try {
    console.log("[Marshal] ⚡ Starting FAST sync...")
    const startTime = Date.now()
    
    const token = await getAuthToken()
    const coursesData = await fetchCourses(token)
    console.log("[v0] Fetched courses:", coursesData.courses ? coursesData.courses.length : 0)

    if (!coursesData.courses || coursesData.courses.length === 0) {
      console.log("[Marshal] No courses found")
      return
    }

    console.log(`[Marshal] Found ${coursesData.courses.length} courses`)
    
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
    
    console.log(`[Marshal] Fetching ${submissionPromises.length} submissions in parallel...`)
    const submissionResults = await Promise.all(submissionPromises)
    
    // Build assignments array
    allAssignments = submissionResults.map(({ course, work, submission }) => {
      const submissionState = submission?.state || "NEW"
      const isTurnedIn =
        submissionState === "TURNED_IN" ||
        submissionState === "RETURNED" ||
        submissionState === "RECLAIMED_BY_STUDENT"

      return {
        courseId: course.id,
        courseName: course.name,
        courseWorkId: work.id,
        title: work.title,
        description: work.description || "No description",
        dueDate: work.dueDate,
        dueTime: work.dueTime,
        link: work.alternateLink,
        maxPoints: work.maxPoints,
        state: work.state,
        submissionState: submissionState,
        turnedIn: isTurnedIn,
        submissionTime: submission?.updateTime || submission?.creationTime,
        creationTime: work.creationTime,
      }
    })

    console.log("[v0] Total assignments fetched:", allAssignments.length)
    await categorizeAssignments()
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`[Marshal] ✅ Sync completed in ${elapsed}s (${allAssignments.length} assignments)`)
  } catch (error) {
    console.error("[Marshal] ❌ Sync error:", error)
  }
}

async function categorizeAssignments() {
  const now = new Date()
  const urgentTasks = []
  const missedTasks = []

  for (const assignment of allAssignments) {
    // UPDATED: Skip turned-in assignments
    if (assignment.turnedIn) {
      console.log('[Marshal] Skipping turned-in assignment:', assignment.title)
      continue
    }

    // UPDATED: Skip assignments without due dates
    if (!assignment.dueDate) {
      console.log('[Marshal] Skipping assignment without due date:', assignment.title)
      continue
    }

    const dueDate = new Date(
      assignment.dueDate.year,
      assignment.dueDate.month - 1,
      assignment.dueDate.day,
      assignment.dueTime?.hours || 23,
      assignment.dueTime?.minutes || 59,
    )

    const diffTime = dueDate - now
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    const isSameDay =
      dueDate.getFullYear() === now.getFullYear() &&
      dueDate.getMonth() === now.getMonth() &&
      dueDate.getDate() === now.getDate()

    const task = {
      title: assignment.title,
      subject: assignment.courseName,
      dueDate: dueDate.toISOString(),
      urgency: diffDays <= 1 ? "high" : diffDays <= 3 ? "medium" : "low",
      link: assignment.link,
    }

    if (isSameDay) {
      task.urgency = "high"
      urgentTasks.push(task)
    } else if (diffTime < 0) {
      missedTasks.push(task)
    } else if (diffDays <= 7) {
      urgentTasks.push(task)
    }
  }

  await chrome.storage.local.set({
    urgentTasks: urgentTasks,
    missedTasks: missedTasks,
  })

  console.log(`[Marshal] Categorized: ${urgentTasks.length} urgent, ${missedTasks.length} missed (turned-in assignments excluded)`)
}
// ===========================
// GWA PAGE
// ===========================
async function loadGrades() {
  console.log("[Marshal] Loading grades...")
  try {
    const result = await chrome.storage.local.get("grades")
    const grades = result.grades || []
    console.log("[Marshal] Grades loaded:", grades)

    if (grades.length === 0) {
      document.getElementById("gwaDisplay").textContent = "--"
      return
    }

    const total = grades.reduce((sum, grade) => sum + grade.value, 0)
    const gwa = (total / grades.length).toFixed(2)
    document.getElementById("gwaDisplay").textContent = gwa

    const gradesList = document.getElementById("gradesList")
    gradesList.innerHTML = grades
      .map(
        (grade) => `
      <div class="grade-item">
        <span class="grade-subject">${grade.subject}</span>
        <span class="grade-value">${grade.value.toFixed(2)}</span>
      </div>
    `,
      )
      .join("")
  } catch (error) {
    console.error("[Marshal] Error loading grades:", error)
  }
}

// ===========================
// STUDY PLANS PAGE
// ===========================
async function loadStudyPlans() {
  try {
    const result = await chrome.storage.local.get("studyPlans")
    const plans = result.studyPlans || []

    let incompletePlans = plans.filter((plan) => !plan.completed)
    let completePlans = plans.filter((plan) => plan.completed)

    const currentFilterMode = filterMode

    if (filterMode === "incomplete") {
      completePlans = []
    } else if (filterMode === "complete") {
      incompletePlans = []
    }
    // Reset filter mode after applying it
    filterMode = "all"

    const incompleteSection = document.getElementById("incompleteSection")
    const completeSection = document.getElementById("completeSection")

    if (currentFilterMode === "incomplete" || (incompletePlans.length > 0 && completePlans.length === 0)) {
      incompleteSection.style.display = "block"
      completeSection.style.display = "none"
    } else if (currentFilterMode === "complete" || (completePlans.length > 0 && incompletePlans.length === 0)) {
      incompleteSection.style.display = "none"
      completeSection.style.display = "block"
    } else {
      incompleteSection.style.display = "block"
      completeSection.style.display = "block"
    }

    document.getElementById("incompleteCount").textContent =
      `${incompletePlans.length} Study Plan${incompletePlans.length !== 1 ? "s" : ""}`
    document.getElementById("completeCount").textContent =
      `${completePlans.length} Study Plan${completePlans.length !== 1 ? "s" : ""}`

    renderPlans("incompleteList", incompletePlans)
    renderPlans("completeList", completePlans)
  } catch (error) {
    console.error("[Marshal] Error loading study plans:", error)
  }
}

function renderPlans(containerId, plans) {
  const container = document.getElementById(containerId)

  if (plans.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p class="empty-state-text">There's nothing to see here! ._.</p>
      </div>
    `
    return
  }

  container.innerHTML = plans
    .map((plan) => {
      const date = new Date(plan.createdAt)

      const taskSource = Array.isArray(plan.tasks) && plan.tasks.length > 0 ? plan.tasks : (plan.schedule || [])
      const incompleteTasks = taskSource.filter((t) => !t.completed).length
      const completedTasks = taskSource.filter((t) => t.completed).length

      return `
      <div class="plan-card" data-plan-id="${plan.id}">
        <div class="plan-card-header">
          <h3 class="plan-card-title">${plan.title}</h3>
        </div>
        <div class="plan-card-info">
          <div class="plan-card-details">
            <p class="plan-card-date">Created at ${date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}</p>
            <p class="plan-card-tasks">${incompleteTasks} incomplete, ${completedTasks} completed</p>
          </div>
          <button class="delete-btn" data-plan-id="${plan.id}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    `
    })
    .join("")

  document.querySelectorAll(".plan-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".delete-btn")) return
      const planId = card.dataset.planId
      currentPlanId = planId
      showPage("planDetailPage")
    })
  })

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation()
      const planId = btn.dataset.planId
      showDeleteModal(planId)
    })
  })
}

function showDeleteModal(planId) {
  planToDelete = planId
  document.getElementById("deleteModal").classList.add("show")
}

function hideDeleteModal() {
  planToDelete = null
  document.getElementById("deleteModal").classList.remove("show")
}

async function deletePlan() {
  if (!planToDelete) return

  try {
    const result = await chrome.storage.local.get("studyPlans")
    const plans = result.studyPlans || []
    const updatedPlans = plans.filter((plan) => plan.id !== Number.parseInt(planToDelete))
    await chrome.storage.local.set({ studyPlans: updatedPlans })
    hideDeleteModal()
    loadStudyPlans()
  } catch (error) {
    console.error("[Marshal] Error deleting plan:", error)
  }
}

// removed addPlanBtn and expand section handlers as '+' UI was removed

// removed

document.getElementById("confirmDeleteBtn")?.addEventListener("click", deletePlan)
document.getElementById("cancelDeleteBtn")?.addEventListener("click", hideDeleteModal)

document.getElementById("deleteModal")?.addEventListener("click", (e) => {
  if (e.target.id === "deleteModal") {
    hideDeleteModal()
  }
})

// ===========================
// URGENT TASKS PAGE
// ===========================
async function loadUrgentTasksPage() {
  try {
    const result = await chrome.storage.local.get("urgentTasks")
    let tasks = result.urgentTasks || []

    const tasksList = document.getElementById("urgentTasksListPage")

    if (tasks.length > 0) {
      const highUrgency = tasks.filter((task) => task.urgency === "high")
      const mediumUrgency = tasks.filter((task) => task.urgency === "medium")
      const lowUrgency = tasks.filter((task) => task.urgency === "low")

      tasks = [...highUrgency, ...mediumUrgency, ...lowUrgency]
    }

    if (tasks.length === 0) {
      tasksList.innerHTML = `
        <div class="empty-state">
          <p class="empty-state-text">No urgent tasks found!</p>
        </div>
      `
      return
    }

    tasksList.innerHTML = tasks
      .map((task) => {
        const dueDate = new Date(task.dueDate)
        return `
        <div class="task-item-card">
          <h3 class="task-item-title">${task.title}</h3>
          <p class="task-item-subject">${task.subject || "No subject"}</p>
          <p class="task-item-due">Due: ${dueDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
          ${task.link ? `<a href="${task.link}" class="view-in-classroom-btn" target="_blank">View in Google Classroom →</a>` : ""}
          <button class="analyze-btn small" data-index="0">Analyze Task</button>
        </div>
      `
      })
      .join("")

    // Attach analyze handlers using closure over tasks
    document.querySelectorAll("#urgentTasksListPage .analyze-btn").forEach((btn, idx) => {
      btn.dataset.index = String(idx)
      btn.addEventListener("click", () => {
        const t = tasks[idx]
        aiSourcePage = 'urgentTasksPage'
        analyzeTask(t)
      })
    })
  } catch (error) {
    console.error("[Marshal] Error loading urgent tasks:", error)
  }
}

// ===========================
// MISSED TASKS PAGE
// ===========================
async function loadMissedTasksPage() {
  try {
    const result = await chrome.storage.local.get("missedTasks")
    const tasks = result.missedTasks || []

    const tasksList = document.getElementById("missedTasksListPage")

    if (tasks.length === 0) {
      tasksList.innerHTML = `
        <div class="empty-state">
          <p class="empty-state-text">No missed tasks found!</p>
        </div>
      `
      return
    }

    tasksList.innerHTML = tasks
      .map((task) => {
        const dueDate = new Date(task.dueDate)
        return `
        <div class="task-item-card">
          <h3 class="task-item-title">${task.title}</h3>
          <p class="task-item-subject">${task.subject || "No subject"}</p>
          <p class="task-item-due">Due: ${dueDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
          ${task.link ? `<a href="${task.link}" class="view-in-classroom-btn" target="_blank">View in Google Classroom →</a>` : ""}
          <button class="analyze-btn small" data-index="0">Analyze Task</button>
        </div>
      `
      })
      .join("")

    // Attach analyze handlers using closure over tasks
    document.querySelectorAll("#missedTasksListPage .analyze-btn").forEach((btn, idx) => {
      btn.dataset.index = String(idx)
      btn.addEventListener("click", () => {
        const t = tasks[idx]
        aiSourcePage = 'missedTasksPage'
        analyzeTask(t)
      })
    })
  } catch (error) {
    console.error("[Marshal] Error loading missed tasks:", error)
  }
}

// ===========================
// MANUAL PLAN PAGE
// ===========================
function initManualPlanPage() {
  taskCount = 0
  document.getElementById("tasksList").innerHTML = ""
  document.getElementById("planName").value = ""
  addTask()
}

function addTask() {
  taskCount++
  const tasksList = document.getElementById("tasksList")

  const taskEntry = document.createElement("div")
  taskEntry.className = "task-entry"
  taskEntry.dataset.taskId = taskCount

  taskEntry.innerHTML = `
    <div class="task-entry-header">
      <span class="task-number">Task ${taskCount}</span>
      <button class="remove-task-btn" data-task-id="${taskCount}">✕</button>
    </div>
    <input type="text" class="task-input" placeholder="Task title" data-field="title">
    <input type="text" class="task-input" placeholder="Subject" data-field="subject">
    <div class="task-row">
      <input type="date" class="task-input" data-field="dueDate">
      <select class="task-select" data-field="urgency">
        <option value="low">Low Priority</option>
        <option value="medium">Medium Priority</option>
        <option value="high">High Priority</option>
      </select>
    </div>
  `

  tasksList.appendChild(taskEntry)

  const removeBtn = taskEntry.querySelector(".remove-task-btn")
  removeBtn.addEventListener("click", () => removeTask(taskCount))
}

function removeTask(taskId) {
  const taskEntry = document.querySelector(`[data-task-id="${taskId}"]`)
  if (taskEntry) {
    taskEntry.closest(".task-entry").remove()
  }
}

function generateScheduleFromTasks(tasks) {
  return tasks.map((task, index) => {
    const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No date set"
    const priorityMap = {
      high: "High",
      medium: "Medium",
      low: "Low",
    }

    return {
      task: task.title,
      subject: task.subject || "General",
      date: dueDate,
      duration: "1-2 hours",
      priority: priorityMap[task.urgency] || "Medium",
    }
  })
}

document.getElementById("addTaskBtn")?.addEventListener("click", addTask)

document.getElementById("savePlanBtn")?.addEventListener("click", async () => {
  const planName = document.getElementById("planName").value.trim()

  if (!planName) {
    alert("Please enter a plan name")
    return
  }

  const taskEntries = document.querySelectorAll(".task-entry")
  if (taskEntries.length === 0) {
    alert("Please add at least one task")
    return
  }

  const tasks = []
  taskEntries.forEach((entry) => {
    const title = entry.querySelector('[data-field="title"]').value.trim()
    const subject = entry.querySelector('[data-field="subject"]').value.trim()
    const dueDate = entry.querySelector('[data-field="dueDate"]').value
    const urgency = entry.querySelector('[data-field="urgency"]').value

    if (title) {
      tasks.push({ title, subject, dueDate, urgency, taskLength: "1 hour" })
    }
  })

  if (tasks.length === 0) {
    alert("Please fill in at least one task")
    return
  }

  const studyPlan = {
    id: Date.now(),
    title: planName,
    createdAt: new Date().toISOString(),
    tasks: tasks,
    schedule: generateScheduleFromTasks(tasks),
    type: "manual",
    completed: false,
  }

  const result = await chrome.storage.local.get("studyPlans")
  const studyPlans = result.studyPlans || []
  studyPlans.unshift(studyPlan)

  await chrome.storage.local.set({ studyPlans })

  showPage("studyPlansPage")
})

// ===========================
// LOADING / AI GENERATE PAGE
// ===========================
async function generateStudyPlan() {
  console.log("[Marshal] Starting study plan generation...")

  try {
    console.log("[Marshal] Fetching tasks from storage...")
    const result = await chrome.storage.local.get(["urgentTasks", "missedTasks"])
    console.log("[Marshal] Tasks retrieved:", result)

    const urgentTasks = result.urgentTasks || []
    const missedTasks = result.missedTasks || []
    const allTasks = [...urgentTasks, ...missedTasks]

    console.log("[Marshal] Total tasks:", allTasks.length)

    if (allTasks.length === 0) {
      console.log("[Marshal] No tasks found, creating sample tasks...")
      allTasks.push(
        {
          title: "Math Assignment - Chapter 5",
          subject: "Mathematics",
          dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          urgency: "high",
          taskLength: "2 hours",
        },
        {
          title: "English Essay Draft",
          subject: "English",
          dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
          urgency: "high",
          taskLength: "1 hour",
        },
        {
          title: "Science Lab Report",
          subject: "Science",
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          urgency: "medium",
          taskLength: "3 hours",
        },
      )
    }

    console.log("[Marshal] Simulating AI processing...")
    await new Promise((resolve) => setTimeout(resolve, 2000))

    await chrome.storage.local.set({ tempAiTasks: allTasks })
    showPage("aiPlanNamingPage")
  } catch (error) {
    console.error("[Marshal] Error generating study plan:", error)
    alert("Failed to generate study plan. Error: " + error.message)
    setTimeout(() => {
      showPage("homePage")
    }, 1000)
  }
}

document.getElementById("backFromAiNamingBtn")?.addEventListener("click", () => {
  showPage("homePage")
})

document.getElementById("generateAiPlanBtn")?.addEventListener("click", async () => {
  const planName = document.getElementById("aiPlanName").value.trim()

  if (!planName) {
    alert("Please enter a plan name")
    return
  }

  try {
    // Show loading while generating tasks
    showPage("loadingPage")

    // Collect tasks from storage (urgent + missed). If none, use samples
    const storage = await chrome.storage.local.get(["urgentTasks", "missedTasks"]) 
    const urgentTasks = storage.urgentTasks || []
    const missedTasks = storage.missedTasks || []
    const allTasks = [...urgentTasks, ...missedTasks]

    if (allTasks.length === 0) {
      allTasks.push(
        {
          title: "Math Assignment - Chapter 5",
          subject: "Mathematics",
          dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          urgency: "high",
          taskLength: "2 hours",
        },
        {
          title: "English Essay Draft",
          subject: "English",
          dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
          urgency: "high",
          taskLength: "1 hour",
        },
        {
          title: "Science Lab Report",
          subject: "Science",
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          urgency: "medium",
          taskLength: "3 hours",
        },
      )
    }

    // Simulate AI processing
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const studyPlan = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      title: planName,
      tasks: allTasks,
      schedule: generateSchedule(allTasks),
      completed: false,
      type: "ai",
    }

    const existingPlans = await chrome.storage.local.get("studyPlans")
    const plans = existingPlans.studyPlans || []
    plans.unshift(studyPlan)
    await chrome.storage.local.set({ studyPlans: plans })

    // Reset input and navigate to plans
    document.getElementById("aiPlanName").value = ""
    showPage("studyPlansPage")
  } catch (error) {
    console.error("[Marshal] Error creating AI plan:", error)
    alert("Failed to create study plan. Error: " + error.message)
    // In case of error, send back to home to avoid stuck state
    showPage("homePage")
  }
})

document.getElementById("backToPlansBtn")?.addEventListener("click", () => {
  showPage("studyPlansPage")
})

// ===========================
// PLAN DETAIL PAGE
// ===========================
async function loadPlanDetails() {
  try {
    const result = await chrome.storage.local.get("studyPlans")
    const plans = result.studyPlans || []
    const plan = plans.find((p) => p.id === Number.parseInt(currentPlanId))

    if (!plan) {
      alert("Study plan not found")
      showPage("studyPlansPage")
      return
    }

    currentTasks = plan.tasks || []

    // ensure sort label matches default sort
    const sortLabelEl = document.getElementById("sortLabel")
    if (sortLabelEl) sortLabelEl.textContent = "Date of Deadline"

    document.getElementById("planTitle").textContent = plan.title
    const date = new Date(plan.createdAt)
    document.getElementById("planCreated").textContent =
      `Created at ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`

    const totalHours = currentTasks.reduce((sum, task) => {
      const hours = Number.parseInt(task.taskLength) || 0
      return sum + hours
    }, 0)
    document.getElementById("planDuration").textContent = `${totalHours} hours to finish`

    const completedCount = currentTasks.filter((t) => t.completed).length
    const incompleteCount = currentTasks.length - completedCount
    document.getElementById("completedCount").textContent = completedCount
    document.getElementById("incompleteCountDetail").textContent = incompleteCount

    const badge = document.getElementById("planTypeBadge")
    badge.textContent = plan.type === "manual" ? "Manual" : "AI-Generated"
    badge.className = plan.type === "manual" ? "plan-type-badge manual" : "plan-type-badge ai"

    const planDetailContainer = document.querySelector(".plan-detail-container")
    if (plan.completed) {
      planDetailContainer.style.background =
        "linear-gradient(180deg, rgba(134, 239, 172, 0.4) 0%, rgba(187, 247, 208, 0.2) 100%)"
    } else {
      planDetailContainer.style.background =
        "linear-gradient(180deg, rgba(165, 230, 255, 0.4) 0%, rgba(200, 240, 255, 0.2) 100%)"
    }

    renderTasks()
  } catch (error) {
    console.error("[Marshal] Error loading plan details:", error)
  }
}

function sortTasks(tasks, sortBy) {
  const sorted = [...tasks]

  switch (sortBy) {
    case "urgency":
      const urgencyOrder = { high: 0, medium: 1, low: 2 }
      sorted.sort((a, b) => (urgencyOrder[a.urgency] || 2) - (urgencyOrder[b.urgency] || 2))
      break
    case "date":
      sorted.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      break
    case "subject":
      sorted.sort((a, b) => (a.subject || "").localeCompare(b.subject || ""))
      break
    case "length":
      sorted.sort((a, b) => (Number.parseInt(a.taskLength) || 0) - (Number.parseInt(b.taskLength) || 0))
      break
  }

  return sorted
}

function renderTasks() {
  const allTasks = [...currentTasks]
  const incompleteTasks = allTasks.filter((t) => !t.completed)
  const completedTasks = allTasks.filter((t) => t.completed)

  const sortedIncompleteTasks = sortTasks(incompleteTasks, currentSortBy)
  // Completed tasks stay in their original order
  const sortedTasks = [...sortedIncompleteTasks, ...completedTasks]

  const container = document.getElementById("tasksContainer")

  if (sortedTasks.length === 0) {
    container.innerHTML = '<p class="no-tasks">No tasks in this plan</p>'
    return
  }

  container.innerHTML = sortedTasks
    .map((task, index) => {
      const originalIndex = currentTasks.indexOf(task)
      const completedClass = task.completed ? "completed" : ""
      
      // ✨ NEW CODE ADDED HERE ✨
      const urgencyBadgeClass = task.completed ? "finished" : task.urgency
      const urgencyBadgeText = task.completed ? "FINISHED" : `${task.urgency.charAt(0).toUpperCase() + task.urgency.slice(1)} Urgency`
      
        return `
          <div class="task-item ${completedClass}">
            <div class="task-content">
              <div class="task-name-row">
                <div class="task-name">${task.title}</div>
                <span class="task-urgency ${urgencyBadgeClass}">${urgencyBadgeText}</span>
              </div>
            <div class="task-meta">
              <span class="task-meta-item">${task.subject || "No subject"}</span>
              <span class="task-meta-item">•</span>
              <span class="task-meta-item">${task.taskLength || "1 hour"} to finish</span>
              <span class="task-meta-item">Due on ${new Date(task.dueDate).toLocaleDateString()}</span>
            </div>
          </div>
          <div class="task-actions-inline">
            <button class="task-action-btn edit" data-index="${originalIndex}" title="Edit task">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="task-action-btn delete" data-index="${originalIndex}" title="Delete task">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h12zM10 11v6M14 11v6"/>
              </svg>
            </button>
            <button class="task-action-btn done" data-index="${originalIndex}" title="Mark as done">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </button>
          </div>
        </div>
      `
    })
    .join("")

  document.querySelectorAll(".task-action-btn.edit").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const index = Number.parseInt(e.currentTarget.dataset.index)
      openEditModal(index)
    })
  })

  document.querySelectorAll(".task-action-btn.delete").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const index = Number.parseInt(e.currentTarget.dataset.index)
      showDeleteConfirmation("task", index)
    })
  })

  document.querySelectorAll(".task-action-btn.done").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const index = Number.parseInt(e.currentTarget.dataset.index)
      showRevertModal(index)
    })
  })
}

let revertingTaskIndex = null

function showRevertModal(index) {
  revertingTaskIndex = index
  const task = currentTasks[index]

  if (task.completed) {
    document.getElementById("revertTaskModal").classList.add("active")
  } else {
    // Mark as done
    markTaskAsDone(index)
  }
}

async function markTaskAsDone(index) {
  currentTasks[index].completed = true
  await savePlanToStorage()
  await checkAndUpdatePlanCompletion()
  renderTasks()
  updatePlanStats()
}

async function revertTaskToIncomplete() {
  if (revertingTaskIndex !== null) {
    currentTasks[revertingTaskIndex].completed = false
    await savePlanToStorage()
    await checkAndUpdatePlanCompletion()
    renderTasks()
    updatePlanStats()
  }
  document.getElementById("revertTaskModal").classList.remove("active")
  revertingTaskIndex = null
}

async function checkAndUpdatePlanCompletion() {
  const result = await chrome.storage.local.get("studyPlans")
  const plans = result.studyPlans || []
  const planIndex = plans.findIndex((p) => p.id === Number.parseInt(currentPlanId))

  if (planIndex !== -1) {
    const plan = plans[planIndex]
    const allTasksCompleted = currentTasks.length > 0 && currentTasks.every((t) => t.completed)
    plan.completed = allTasksCompleted
    await chrome.storage.local.set({ studyPlans: plans })

    // Update the plan card styling if viewing from study plans page
    const planCard = document.querySelector(`[data-plan-id="${currentPlanId}"]`)
    if (planCard) {
      if (allTasksCompleted) {
        planCard.classList.add("completed")
      } else {
        planCard.classList.remove("completed")
      }
    }

    const planDetailContainer = document.querySelector(".plan-detail-container")
    if (planDetailContainer) {
      if (allTasksCompleted) {
        planDetailContainer.style.background =
          "linear-gradient(180deg, rgba(134, 239, 172, 0.4) 0%, rgba(187, 247, 208, 0.2) 100%)"
      } else {
        planDetailContainer.style.background =
          "linear-gradient(180deg, rgba(165, 230, 255, 0.4) 0%, rgba(200, 240, 255, 0.2) 100%)"
      }
    }
  }
}

function updatePlanStats() {
  const completedCount = currentTasks.filter((t) => t.completed).length
  const incompleteCount = currentTasks.length - completedCount
  document.getElementById("completedCount").textContent = completedCount
  document.getElementById("incompleteCountDetail").textContent = incompleteCount
}

document.getElementById("confirmRevertBtn")?.addEventListener("click", revertTaskToIncomplete)

document.getElementById("cancelRevertBtn")?.addEventListener("click", () => {
  document.getElementById("revertTaskModal").classList.remove("active")
  revertingTaskIndex = null
})

document.getElementById("revertTaskModal")?.addEventListener("click", (e) => {
  if (e.target.id === "revertTaskModal") {
    document.getElementById("revertTaskModal").classList.remove("active")
    revertingTaskIndex = null
  }
})

let originalTaskData = null

function openEditModal(index) {
  editingTaskIndex = index
  const task = currentTasks[index]

  // Preserve original only for edit mode
  if (!isAddingTask) {
    originalTaskData = JSON.parse(JSON.stringify(task))
  } else {
    originalTaskData = null
  }

  document.getElementById("taskNameInput").value = task.title || ""
  document.getElementById("taskSubjectInput").value = task.subject || ""
  // Normalize date to YYYY-MM-DD format for date input
  const dateValue = task.dueDate ? (task.dueDate.includes('T') ? task.dueDate.split('T')[0] : task.dueDate) : ""
  document.getElementById("taskDateInput").value = dateValue
  document.getElementById("taskLengthInput").value = task.taskLength || "1 hour"

  document.querySelectorAll(".urgency-btn").forEach((btn) => {
    btn.classList.remove("active")
    if (btn.dataset.urgency === (task.urgency || "medium")) {
      btn.classList.add("active")
    }
  })

  // Adjust modal UI based on add vs edit
  const modalTitleEl = document.querySelector(".modal-title")
  const saveBtn = document.getElementById("saveChangesBtn")
  if (isAddingTask) {
    if (modalTitleEl) modalTitleEl.textContent = "Add new task"
    if (saveBtn) {
      saveBtn.textContent = "Add Task"
      saveBtn.classList.remove("hidden")
    }
  } else {
    if (modalTitleEl) modalTitleEl.textContent = "Edit your task"
    if (saveBtn) saveBtn.textContent = "Save Changes"
    updateSaveChangesButton()
  }

  document.getElementById("editModalOverlay").classList.add("active")
}

function closeEditModal() {
  document.getElementById("editModalOverlay").classList.remove("active")
  editingTaskIndex = null
  originalTaskData = null
  // Restore defaults
  const modalTitleEl = document.querySelector(".modal-title")
  const saveBtn = document.getElementById("saveChangesBtn")
  if (modalTitleEl) modalTitleEl.textContent = "Edit your task"
  if (saveBtn) saveBtn.textContent = "Save Changes"
  isAddingTask = false
}

function hasTaskChanged() {
  if (!originalTaskData || editingTaskIndex === null) return false

  const currentName = document.getElementById("taskNameInput").value.trim()
  const currentSubject = document.getElementById("taskSubjectInput").value.trim()
  const currentDate = document.getElementById("taskDateInput").value
  const currentLength = document.getElementById("taskLengthInput").value
  const currentUrgency = document.querySelector(".urgency-btn.active")?.dataset.urgency || "medium"

  // Normalize values for comparison (handle undefined/empty string cases)
  const originalName = (originalTaskData.title || "").trim()
  const originalSubject = (originalTaskData.subject || "").trim()
  const originalLength = originalTaskData.taskLength || "1 hour"
  const originalUrgency = originalTaskData.urgency || "medium"
  // Normalize date to YYYY-MM-DD format (handle ISO strings)
  const originalDate = originalTaskData.dueDate ? (originalTaskData.dueDate.includes('T') ? originalTaskData.dueDate.split('T')[0] : originalTaskData.dueDate) : ""

  return (
    currentName !== originalName ||
    currentSubject !== originalSubject ||
    currentDate !== originalDate ||
    currentLength !== originalLength ||
    currentUrgency !== originalUrgency
  )
}

function updateSaveChangesButton() {
  const saveBtn = document.getElementById("saveChangesBtn")
  if (saveBtn) {
    if (isAddingTask || hasTaskChanged()) {
      saveBtn.classList.remove("hidden")
    } else {
      saveBtn.classList.add("hidden")
    }
  }
}

async function saveTask() {
  if (editingTaskIndex === null) return

  const task = currentTasks[editingTaskIndex]
  task.title = document.getElementById("taskNameInput").value
  task.subject = document.getElementById("taskSubjectInput").value
  task.dueDate = document.getElementById("taskDateInput").value
  task.taskLength = document.getElementById("taskLengthInput").value

  const urgencyBtn = document.querySelector(".urgency-btn.active")
  if (urgencyBtn) {
    task.urgency = urgencyBtn.dataset.urgency
  }

  await savePlanToStorage()
  closeEditModal()
  renderTasks()
}

function showDeleteConfirmation(type, index) {
  const modal = document.getElementById("confirmationModal")
  const text = document.getElementById("confirmationText")

  if (type === "task") {
    text.textContent = "Are you sure you want to delete this task?"
    deletingTaskIndex = index
  } else if (type === "plan") {
    text.textContent = "Are you sure you want to delete this study plan?"
    deletingPlanId = currentPlanId
  }

  modal.classList.add("active")
}

async function confirmDelete() {
  const modal = document.getElementById("confirmationModal")

  if (deletingTaskIndex !== null) {
    currentTasks.splice(deletingTaskIndex, 1)
    await savePlanToStorage()
    renderTasks()
    deletingTaskIndex = null
  } else if (deletingPlanId !== null) {
    const result = await chrome.storage.local.get("studyPlans")
    const plans = result.studyPlans || []
    const filtered = plans.filter((p) => p.id !== Number.parseInt(deletingPlanId))
    await chrome.storage.local.set({ studyPlans: filtered })
    showPage("studyPlansPage")
  }

  modal.classList.remove("active")
}

async function savePlanToStorage() {
  const result = await chrome.storage.local.get("studyPlans")
  const plans = result.studyPlans || []
  const planIndex = plans.findIndex((p) => p.id === Number.parseInt(currentPlanId))
  if (planIndex !== -1) {
    plans[planIndex].tasks = currentTasks
    await chrome.storage.local.set({ studyPlans: plans })
  }
}

document.getElementById("sortBtn")?.addEventListener("click", () => {
  const dropdown = document.getElementById("sortDropdown")
  dropdown.classList.toggle("active")
})

document.querySelectorAll(".sort-option").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    currentSortBy = e.target.dataset.sort
    const sortLabels = {
      urgency: "Most Urgent",
      date: "Date of Deadline",
      subject: "Subject",
      length: "Estimated Length",
    }
    document.getElementById("sortLabel").textContent = sortLabels[currentSortBy]
    document.getElementById("sortDropdown").classList.remove("active")
    renderTasks()
  })
})

document.getElementById("addTaskDetailBtn")?.addEventListener("click", () => {
  const newTask = {
    title: "New Task",
    subject: "",
    dueDate: new Date().toISOString().split("T")[0],
    taskLength: "1 hour",
    urgency: "medium",
    completed: false,
  }
  currentTasks.push(newTask)
  editingTaskIndex = currentTasks.length - 1
  isAddingTask = true
  openEditModal(editingTaskIndex)
})

document.getElementById("deletePlanBtn")?.addEventListener("click", () => {
  showDeleteConfirmation("plan")
})

document.getElementById("modalCloseBtn")?.addEventListener("click", closeEditModal)

document.getElementById("deleteTaskBtn")?.addEventListener("click", () => {
  closeEditModal()
  showDeleteConfirmation("task", editingTaskIndex)
})

document.getElementById("saveChangesBtn")?.addEventListener("click", saveTask)

document.querySelectorAll(".urgency-btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault()
    document.querySelectorAll(".urgency-btn").forEach((b) => b.classList.remove("active"))
    e.target.classList.add("active")
    updateSaveChangesButton()
  })
})

document.getElementById("taskNameInput")?.addEventListener("input", updateSaveChangesButton)
document.getElementById("taskSubjectInput")?.addEventListener("input", updateSaveChangesButton)
document.getElementById("taskDateInput")?.addEventListener("change", updateSaveChangesButton)
document.getElementById("taskLengthInput")?.addEventListener("change", updateSaveChangesButton)

document.getElementById("editForm")?.addEventListener("submit", (e) => {
  e.preventDefault()
  saveTask()
})

document.getElementById("cancelConfirmBtn")?.addEventListener("click", () => {
  document.getElementById("confirmationModal").classList.remove("active")
  deletingTaskIndex = null
  deletingPlanId = null
})

document.getElementById("confirmConfirmBtn")?.addEventListener("click", confirmDelete)

document.getElementById("editModalOverlay")?.addEventListener("click", (e) => {
  if (e.target.id === "editModalOverlay") {
    closeEditModal()
  }
})

document.getElementById("confirmationModal")?.addEventListener("click", (e) => {
  if (e.target.id === "confirmationModal") {
    document.getElementById("confirmationModal").classList.remove("active")
    deletingTaskIndex = null
    deletingPlanId = null
  }
})

// ===========================
// AI ANALYSIS (Analyze Task -> Modal + Add to Plan)
// ===========================

async function analyzeTask(task) {
  try {
    currentAnalyzedTask = task
    const modal = document.getElementById('aiAnalysisModal')
    const loadingState = document.getElementById('aiLoadingState')
    const resultsState = document.getElementById('aiResultsState')
    const content = document.getElementById('aiAnalysisContent')
    if (!content) return
    // Show modal with loading state
    if (modal) modal.classList.add('show')
    if (loadingState) loadingState.style.display = 'block'
    if (resultsState) resultsState.style.display = 'none'

    const analysis = await analyzeAssignment(task)
    displayAnalysisResults(analysis, task)
  } catch (err) {
    console.error('[Marshal] Analyze failed:', err)
    alert('Failed to analyze assignment. Please try again.')
    document.getElementById('aiAnalysisModal')?.classList.remove('show')
    currentAnalyzedTask = null
  }
}

function displayAnalysisResults(analysis, task) {
  const loadingState = document.getElementById('aiLoadingState')
  const resultsState = document.getElementById('aiResultsState')
  const content = document.getElementById('aiAnalysisContent')
  if (!content) return

  lastAiAnalysis = analysis

  const stepsHTML = (analysis.breakdown || []).map((step, i) => `
    <div class="ai-step">
      <div class="step-number">${i + 1}</div>
      <div class="step-info">
        <div class="step-title">${step.step}</div>
        <div class="step-desc">${step.description}</div>
        <div class="step-time">⏰ ${step.estimatedTime}</div>
      </div>
    </div>
  `).join('')

  const tipsHTML = ((analysis.strategy && analysis.strategy.tips) || []).map((tip) => `
    <li class="ai-tip">${tip}</li>
  `).join('')

  const urgency = analysis.urgency || 'medium'
  const urgencyClass = `badge-urgency-${urgency}`

  content.innerHTML = `
    <h3 style="font-size: 18px; font-weight: 700; color: #1f2937; margin-bottom: 8px;">${task.title || 'Assignment'}</h3>
    <div class="ai-summary">${analysis.summary || 'AI analysis generated successfully.'}</div>
    <div class="ai-badges">
      <span class="ai-badge ${urgencyClass}">⚡ ${(urgency || 'medium').toUpperCase()}</span>
      <span class="ai-badge badge-time">⏰ ${analysis.totalTimeEstimate || 'Variable'}</span>
    </div>
    <div class="ai-section">
      <div class="ai-section-title">📝 What To Do</div>
      <div class="ai-steps">${stepsHTML || '<p>No steps available</p>'}</div>
    </div>
    <div class="ai-section">
      <div class="ai-section-title">💡 Strategy & Tips</div>
      <p style="font-size: 14px; color: #374151; line-height: 1.6; margin-bottom: 12px;">${(analysis.strategy && analysis.strategy.approach) || 'Break the work into manageable chunks and stay focused.'}</p>
      <ul class="ai-tips">${tipsHTML || '<li class="ai-tip">Work in focused sessions</li>'}</ul>
    </div>
    <div class="ai-section">
      <div class="ai-section-title">⏰ Recommendation</div>
      <div class="ai-recommendation">${analysis.recommendedStartTime || 'Start as soon as possible to ensure quality work.'}</div>
    </div>
  `

  if (loadingState) loadingState.style.display = 'none'
  if (resultsState) resultsState.style.display = 'flex'
}

function closeAiModal() {
  const modal = document.getElementById('aiAnalysisModal')
  modal?.classList.remove('show')
  currentAnalyzedTask = null
  lastAiAnalysis = null
  // Navigate back to originating list page if known
  if (aiSourcePage) {
    showPage(aiSourcePage)
  }
  aiSourcePage = null
}

async function addAnalyzedTaskToPlan() {
  if (!currentAnalyzedTask) return
  try {
    const analysis = lastAiAnalysis || await analyzeAssignment(currentAnalyzedTask)
    const planTasks = (analysis.breakdown || []).map((step) => ({
      title: `${currentAnalyzedTask.title} - ${step.step}`,
      subject: currentAnalyzedTask.subject || 'General',
      dueDate: currentAnalyzedTask.dueDate,
      taskLength: step.estimatedTime,
      urgency: analysis.urgency || 'medium',
      completed: false,
    }))
    const studyPlan = {
      id: Date.now(),
      title: `${currentAnalyzedTask.title} - AI Plan`,
      createdAt: new Date().toISOString(),
      tasks: planTasks,
      schedule: planTasks.map((t) => ({
        task: t.title,
        date: t.dueDate ? new Date(t.dueDate).toLocaleDateString() : new Date().toLocaleDateString(),
        duration: t.taskLength,
        priority: (analysis.urgency || 'medium') === 'high' ? 'High' : 'Medium',
        completed: false,
      })),
      type: 'ai',
      completed: false,
    }
    const result = await chrome.storage.local.get('studyPlans')
    const plans = result.studyPlans || []
    plans.unshift(studyPlan)
    await chrome.storage.local.set({ studyPlans: plans })
    closeAiModal()
    alert('Study plan created! 🎉')
    setTimeout(() => showPage('studyPlansPage'), 300)
  } catch (err) {
    console.error('[Marshal] Error adding analyzed plan:', err)
    alert('Failed to create study plan.')
  }
}

// Use delegation to ensure handlers are bound regardless of render timing
document.addEventListener('click', (e) => {
  const el = e.target
  if (!(el instanceof Element)) return
  if (el.closest('#closeAiModal') || el.closest('#closeAiBtn')) {
    e.preventDefault()
    closeAiModal()
    return
  }
  if (el.closest('#addToPlanBtn')) {
    e.preventDefault()
    addAnalyzedTaskToPlan()
    return
  }
  if (el.id === 'aiAnalysisModal') {
    // click outside modal content closes
    closeAiModal()
  }
})

// ===========================
// FOCUS MODE STATS PAGE
// ===========================
async function loadFocusModeStats() {
  try {
    console.log("[Marshal] Loading Focus Mode Stats...")

    const result = await chrome.storage.local.get([
      "dailyBlockedAttempts",
      "totalTimeSaved",
      "hourlyAttempts",
      "blockedSitesCount",
      "weeklyStats",
      "studyStartTime",
      "lastBlockTime",
    ])

    const attempts = result.dailyBlockedAttempts || 0
    const timeSaved = result.totalTimeSaved || 0
    const hourlyAttempts = result.hourlyAttempts || {}
    const blockedSites = result.blockedSitesCount || {}
    const weeklyStats = result.weeklyStats || {}

    console.log("[Marshal] Stats loaded:", { attempts, timeSaved, hourlyAttempts, blockedSites })

    const now = new Date()
    document.getElementById("currentDateStats").textContent = now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })

    const hours = Math.floor(timeSaved / 60)
    const minutes = timeSaved % 60
    if (hours > 0) {
      document.getElementById("timeSavedTodayStats").textContent = `${hours}h ${minutes}m`
    } else {
      document.getElementById("timeSavedTodayStats").textContent = `${minutes}m`
    }

    document.getElementById("blocksTodayStats").textContent = attempts

    let peakHour = "--"
    if (Object.keys(hourlyAttempts).length > 0) {
      const maxHour = Object.keys(hourlyAttempts).reduce((a, b) => (hourlyAttempts[a] > hourlyAttempts[b] ? a : b))
      const hour12 = maxHour % 12 || 12
      const ampm = maxHour < 12 ? "AM" : "PM"
      peakHour = `${hour12} ${ampm}`
    }
    document.getElementById("peakTimeStats").textContent = peakHour

    const streak = Object.keys(weeklyStats).length
    document.getElementById("streakDaysStats").textContent = streak

    renderHourlyChart(hourlyAttempts)

    const weekTotal = Object.values(weeklyStats).reduce((sum, val) => sum + val, 0)
    const weekTimeSaved = weekTotal * 5
    const weekHours = Math.floor(weekTimeSaved / 60)
    const weekMins = weekTimeSaved % 60
    document.getElementById("weekTimeSavedStats").textContent = `${weekHours}h ${weekMins}m`
    document.getElementById("weekBlocksStats").textContent = weekTotal

    if (Object.keys(weeklyStats).length > 0) {
      const mostProductiveDay = Object.keys(weeklyStats).reduce((a, b) => (weeklyStats[a] > weeklyStats[b] ? a : b))
      const date = new Date(mostProductiveDay)
      document.getElementById("mostProductiveDayStats").textContent = date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
      document.getElementById("peakDayStats").textContent = date.toLocaleDateString("en-US", {
        weekday: "short",
      })
    } else {
      document.getElementById("mostProductiveDayStats").textContent = "--"
      document.getElementById("peakDayStats").textContent = "--"
    }

    renderBlockedSitesList(blockedSites)

    const messages = [
      "You're doing great! Keep up the focus! 💪",
      "Excellent work staying on track! 🎯",
      "Your dedication is paying off! 🌟",
      "Stay strong! Your future self will thank you! 🚀",
      "Amazing focus today! Keep it going! ⭐",
    ]
    const randomMessage = messages[Math.floor(Math.random() * messages.length)]
    document.getElementById("motivationTextStats").textContent = randomMessage

    console.log("[Marshal] Focus Mode Stats loaded successfully")
  } catch (error) {
    console.error("[Marshal] Error loading focus mode stats:", error)
  }
}

function renderHourlyChart(hourlyAttempts) {
  const chartContainer = document.getElementById("hourlyChartStats")
  const labelsContainer = document.getElementById("hourlyLabelsStats")

  if (!chartContainer || !labelsContainer) {
    console.error("[Marshal] Chart containers not found")
    return
  }

  if (Object.keys(hourlyAttempts).length === 0) {
    chartContainer.innerHTML = '<div class="empty-chart">No data yet today</div>'
    labelsContainer.innerHTML = ""
    return
  }

  const maxAttempts = Math.max(...Object.values(hourlyAttempts))

  const sortedHours = Object.entries(hourlyAttempts).sort(([a], [b]) => Number.parseInt(a) - Number.parseInt(b))

  const bars = sortedHours
    .map(([hour, count]) => {
      const height = (count / maxAttempts) * 100

      return `
        <div class="chart-bar-wrapper">
          <div class="chart-bar" style="height: ${height}%; min-height: 20px;">
            <span class="bar-value">${count}</span>
          </div>
        </div>
      `
    })
    .join("")

  const labels = sortedHours
    .map(([hour]) => {
      const hour12 = hour % 12 || 12
      const ampm = hour < 12 ? "AM" : "PM"
      return `<div class="chart-label">${hour12}${ampm}</div>`
    })
    .join("")

  chartContainer.innerHTML = bars
  labelsContainer.innerHTML = labels
}

function renderBlockedSitesList(blockedSites) {
  const container = document.getElementById("blockedSitesListStats")

  if (!container) {
    console.error("[Marshal] Blocked sites container not found")
    return
  }

  if (Object.keys(blockedSites).length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No sites blocked yet today!</p></div>'
    return
  }

  const sortedSites = Object.entries(blockedSites)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  const maxCount = sortedSites[0][1]

  container.innerHTML = sortedSites
    .map(([site, count], index) => {
      const percentage = (count / maxCount) * 100
      return `
        <div class="blocked-site-item">
          <span class="site-rank">${index + 1}</span>
          <div class="site-info">
            <div class="site-name">${site}</div>
            <div class="site-bar-container">
              <div class="site-bar-fill" style="width: ${percentage}%"></div>
            </div>
          </div>
          <span class="site-count">${count}</span>
        </div>
      `
    })
    .join("")
}
// ===========================
// MANAGE BLOCKED SITES PAGE - IMPROVED LOGIC
// Replace the existing loadBlockedSites() function in popup.js
// ===========================

async function loadBlockedSites() {
  const response = await chrome.runtime.sendMessage({ action: "getBlockedSites" })
  const defaultSites = response.default || []
  const customSites = response.custom || []
  const disabledDefaultSites = response.disabledDefault || []
  const disabledCustomSites = response.disabledCustom || []

  // Render Default Blocked Sites
  const defaultContainer = document.getElementById("defaultSitesList")
  if (defaultSites.length === 0) {
    defaultContainer.innerHTML = '<div class="empty-state"><p>No default sites available</p></div>'
  } else {
    defaultContainer.innerHTML = defaultSites
      .map((site) => {
        const isDisabled = disabledDefaultSites.includes(site)
        const disabledClass = isDisabled ? 'disabled' : ''
        const checkedAttr = isDisabled ? '' : 'checked'
        
        return `
          <div class="site-item default ${disabledClass}">
            <span class="site-icon">🔒</span>
            <span class="site-name">${site}</span>
            <div class="site-controls">
              <label class="toggle-switch">
                <input type="checkbox" class="default-site-toggle" data-site="${site}" ${checkedAttr}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        `
      })
      .join("")

    // Attach event listeners for default site toggles
    document.querySelectorAll(".default-site-toggle").forEach((toggle) => {
      toggle.addEventListener("change", async (e) => {
        const site = e.target.dataset.site
        const isEnabled = e.target.checked
        
        if (isEnabled) {
          // Enable the site (remove from disabled list)
          await chrome.runtime.sendMessage({ action: "enableDefaultSite", site })
        } else {
          // Disable the site (add to disabled list)
          await chrome.runtime.sendMessage({ action: "disableDefaultSite", site })
        }
        
        // Reload to update UI
        loadBlockedSites()
      })
    })
  }

  // Render Customized Blocked Sites
  const customContainer = document.getElementById("customSitesList")
  if (customSites.length === 0) {
    customContainer.innerHTML = '<div class="empty-state"><p>No custom sites yet</p></div>'
  } else {
    customContainer.innerHTML = customSites
      .map((site) => {
        const isDisabled = disabledCustomSites.includes(site)
        const disabledClass = isDisabled ? 'disabled' : ''
        const checkedAttr = isDisabled ? '' : 'checked'
        
        return `
          <div class="site-item custom ${disabledClass}">
            <span class="site-icon">🚫</span>
            <span class="site-name">${site}</span>
            <div class="site-controls">
              <button class="delete-site-btn" data-site="${site}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
              </button>
              <label class="toggle-switch">
                <input type="checkbox" class="custom-site-toggle" data-site="${site}" ${checkedAttr}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        `
      })
      .join("")

    // Attach event listeners for custom site delete buttons
    document.querySelectorAll(".delete-site-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const site = e.currentTarget.dataset.site
        
        // Confirm deletion
        if (confirm(`Are you sure you want to permanently delete "${site}" from your blocked sites?`)) {
          await chrome.runtime.sendMessage({ action: "removeCustomSite", site })
          showNotification(`${site} removed from blocked list`, "success")
          loadBlockedSites()
        }
      })
    })

    // Attach event listeners for custom site toggles
    document.querySelectorAll(".custom-site-toggle").forEach((toggle) => {
      toggle.addEventListener("change", async (e) => {
        const site = e.target.dataset.site
        const isEnabled = e.target.checked
        
        if (isEnabled) {
          // Enable the site
          await chrome.runtime.sendMessage({ action: "enableCustomSite", site })
        } else {
          // Disable the site (temporarily)
          await chrome.runtime.sendMessage({ action: "disableCustomSite", site })
        }
        
        // Reload to update UI
        loadBlockedSites()
      })
    })
  }
}

// Keep existing add site button handler
document.getElementById("addSiteBtn")?.addEventListener("click", async () => {
  const input = document.getElementById("newSiteInput")
  let site = input.value.trim()

  if (!site) {
    showNotification("Please enter a website URL", "error")
    return
  }

  site = site.replace(/^https?:\/\//, "")
  site = site.replace(/^www\./, "")
  site = site.split("/")[0]

  if (!site.includes(".")) {
    showNotification("Please enter a valid website (e.g., example.com)", "error")
    return
  }

  await chrome.runtime.sendMessage({ action: "addCustomSite", site })
  input.value = ""
  loadBlockedSites()
  showNotification(`${site} added to blocked list`, "success")
})

document.getElementById("newSiteInput")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    document.getElementById("addSiteBtn").click()
  }
})

function showNotification(message, type = "info") {
  const notification = document.createElement("div")
  notification.className = `notification ${type}`
  notification.textContent = message
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${type === "error" ? "#ef4444" : "#10b981"};
    color: white;
    border-radius: 8px;
    font-weight: 600;
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
  `

  document.body.appendChild(notification)

  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease-out"
    setTimeout(() => notification.remove(), 300)
  }, 3000)
}

// ===========================
// AI PLAN NAMING PAGE
// ===========================
async function loadAiPlanNamingPage() {
  try {
    const result = await chrome.storage.local.get("tempAiTasks")
    const allTasks = result.tempAiTasks || []

    if (allTasks.length === 0) {
      document.getElementById("aiPlanName").value = "Untitled Plan"
      return
    }

    document.getElementById("aiPlanName").value = `Study Plan - ${new Date().toLocaleDateString()}`
  } catch (error) {
    console.error("[Marshal] Error loading AI plan naming page:", error)
  }
}

document.getElementById("aiPlanName")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    document.getElementById("generateAiPlanBtn").click()
  }
})

// ===========================
// GENERATE SCHEDULE FUNCTION
// ===========================
function generateSchedule(tasks) {
  const schedule = []
  const now = new Date()

  tasks.forEach((task, index) => {
    const scheduleDate = new Date(now)
    scheduleDate.setDate(scheduleDate.getDate() + index)

    schedule.push({
      task: task.title,
      date: scheduleDate.toLocaleDateString(),
      duration: task.taskLength || "1-2 hours",
      priority: index < 3 ? "High" : "Medium",
      completed: false,
    })
  })

  return schedule
}

document.getElementById("focusModeStatsBtn")?.addEventListener("click", () => {
  showPage("focusModeStatsPage")
  loadFocusModeStats()
})

document.getElementById("viewFocusStatsBtn").addEventListener("click", () => {
  showPage("focusModeStatsPage")
  loadFocusModeStats()
})

document.addEventListener("click", (e) => {
  if (e.target.closest("[data-page='focusModeStatsPage']")) {
    loadFocusModeStats()
  }
})

window.addEventListener("load", () => {
  const focusStatsPage = document.getElementById("focusModeStatsPage")
  if (focusStatsPage && !focusStatsPage.classList.contains("hidden")) {
    loadFocusModeStats()
  }
})
