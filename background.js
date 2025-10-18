// Background service worker for Marshal
console.log("[Marshal Background] Service worker initialized")

// Blocked websites for study mode
const BLOCKED_SITES = [
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

// Load study mode state on startup
chrome.storage.local.get("studyModeActive", (result) => {
  studyModeActive = result.studyModeActive || false
  console.log("[Marshal Background] Study mode:", studyModeActive ? "ON" : "OFF")
  updateBlockingRules()
})

// Listen for study mode toggle
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "toggleStudyMode") {
    studyModeActive = message.active
    console.log("[Marshal Background] Study mode toggled:", studyModeActive ? "ON" : "OFF")
    updateBlockingRules()
    sendResponse({ success: true })
  }
  return true
})

// Update blocking rules
function updateBlockingRules() {
  if (studyModeActive) {
    // Block distracting websites
    chrome.webNavigation.onBeforeNavigate.addListener(blockDistractingSites)
    console.log("[Marshal Background] Blocking rules activated")
  } else {
    // Remove blocking
    chrome.webNavigation.onBeforeNavigate.removeListener(blockDistractingSites)
    console.log("[Marshal Background] Blocking rules deactivated")
  }
}

// Block distracting sites
function blockDistractingSites(details) {
  if (details.frameId !== 0) return // Only check main frame

  const url = new URL(details.url)
  const isBlocked = BLOCKED_SITES.some((site) => url.hostname.includes(site))

  if (isBlocked) {
    console.log("[Marshal Background] Blocked:", url.hostname)
    chrome.tabs.update(details.tabId, {
      url: chrome.runtime.getURL("blocked.html"),
    })
  }
}

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