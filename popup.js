// Google Classroom API Integration
let allAssignments = []

// Authentication
function getAuthToken() {
  return new Promise((resolve, reject) => {
    window.chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (window.chrome.runtime.lastError) {
        reject(window.chrome.runtime.lastError)
      } else {
        resolve(token)
      }
    })
  })
}

// API calls
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

// Load assignments from Google Classroom
async function loadGoogleClassroomData() {
  try {
    console.log("[Marshal] Fetching Google Classroom data...")
    const token = await getAuthToken()
    const coursesData = await fetchCourses(token)

    if (!coursesData.courses || coursesData.courses.length === 0) {
      console.log("[Marshal] No courses found")
      return
    }

    allAssignments = []

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

          allAssignments.push(assignment)
        }
      }
    }

    // Process and categorize assignments
    await categorizeAssignments()
    console.log("[Marshal] Google Classroom data loaded successfully")
  } catch (error) {
    console.error("[Marshal] Error loading Google Classroom data:", error)
  }
}

// Categorize assignments into urgent and missed
async function categorizeAssignments() {
  const now = new Date()
  const urgentTasks = []
  const missedTasks = []

  for (const assignment of allAssignments) {
    if (assignment.turnedIn) continue // Skip completed assignments

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
      link: assignment.link,
    }

    if (diffTime < 0) {
      missedTasks.push(task)
    } else if (diffDays <= 7) {
      urgentTasks.push(task)
    }
  }

  // Save to storage
  await window.chrome.storage.local.set({
    urgentTasks: urgentTasks,
    missedTasks: missedTasks,
  })

  console.log(`[Marshal] Categorized: ${urgentTasks.length} urgent, ${missedTasks.length} missed`)
}

// Load daily quote
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

// Study mode toggle
const studyModeBtn = document.getElementById("studyModeBtn")
studyModeBtn.addEventListener("click", async () => {
  const isActive = studyModeBtn.dataset.active === "true"
  const newState = !isActive

  studyModeBtn.dataset.active = newState
  studyModeBtn.querySelector(".status-text").textContent = newState ? "ON" : "OFF"

  await window.chrome.storage.local.set({ studyModeActive: newState })
  window.chrome.runtime.sendMessage({ action: "toggleStudyMode", active: newState })
})

// Load study mode state
async function loadStudyModeState() {
  const result = await window.chrome.storage.local.get("studyModeActive")
  const isActive = result.studyModeActive || false
  studyModeBtn.dataset.active = isActive
  studyModeBtn.querySelector(".status-text").textContent = isActive ? "ON" : "OFF"
}

// Load tasks from storage (updated by Google Classroom sync)
async function loadTasks() {
  try {
    const result = await window.chrome.storage.local.get(["urgentTasks", "missedTasks"])

    const urgentTasksList = document.getElementById("urgentTasksList")
    const missedTasksList = document.getElementById("missedTasksList")

    let filteredUrgentTasks = []
    if (result.urgentTasks && result.urgentTasks.length > 0) {
      const highUrgency = result.urgentTasks.filter((task) => task.urgency === "high")
      const mediumUrgency = result.urgentTasks.filter((task) => task.urgency === "medium")
      const lowUrgency = result.urgentTasks.filter((task) => task.urgency === "low")

      filteredUrgentTasks = [...highUrgency, ...mediumUrgency, ...lowUrgency]
    }

    // Display urgent tasks
    if (filteredUrgentTasks.length > 0) {
      urgentTasksList.innerHTML = filteredUrgentTasks
        .slice(0, 3)
        .map((task) => `<div class="task-item urgent">${task.title}</div>`)
        .join("")
    } else {
      urgentTasksList.innerHTML = '<p class="no-tasks">No urgent tasks</p>'
    }

    // Display missed tasks
    if (result.missedTasks && result.missedTasks.length > 0) {
      missedTasksList.innerHTML = result.missedTasks
        .slice(0, 3)
        .map((task) => `<div class="task-item missed">${task.title}</div>`)
        .join("")
    } else {
      missedTasksList.innerHTML = '<p class="no-tasks">No missed tasks</p>'
    }
  } catch (error) {
    console.error("[Marshal] Error loading tasks:", error)
  }
}

// Navigation handlers
document.getElementById("incompleteBtn").addEventListener("click", () => {
  window.location.replace(window.chrome.runtime.getURL("study-plans.html?view=incomplete"))
})

document.getElementById("completedBtn").addEventListener("click", () => {
  window.location.replace(window.chrome.runtime.getURL("study-plans.html?view=completed"))
})

document.getElementById("urgentTasksBtn").addEventListener("click", () => {
  window.location.replace(window.chrome.runtime.getURL("urgent-tasks.html"))
})

document.getElementById("missedTasksBtn").addEventListener("click", () => {
  window.location.replace(window.chrome.runtime.getURL("missed-tasks.html"))
})

document.getElementById("viewAllBtn").addEventListener("click", () => {
  window.location.replace(window.chrome.runtime.getURL("study-plans.html"))
})

// Generate study plan
const optionsCard = document.getElementById("optionsCard")
const generateBtn = document.getElementById("generateBtn")

generateBtn.addEventListener("click", () => {
  const isActive = optionsCard.classList.contains("active")
  if (isActive) {
    optionsCard.classList.remove("active")
  } else {
    optionsCard.classList.add("active")
  }
})

document.getElementById("aiGenerateBtn").addEventListener("click", () => {
  window.location.replace(window.chrome.runtime.getURL("loading.html"))
})

document.getElementById("manualGenerateBtn").addEventListener("click", () => {
  window.location.replace(window.chrome.runtime.getURL("manual-plan.html"))
})

document.getElementById("gwaBtn").addEventListener("click", () => {
  window.location.replace(window.chrome.runtime.getURL("gwa.html"))
})

document.getElementById("closeBtn").addEventListener("click", () => {
  window.close()
})

// Initialize
async function initialize() {
  console.log("[Marshal] Initializing...")
  loadDailyQuote()
  loadStudyModeState()
  
  // Load Google Classroom data in background
  loadGoogleClassroomData()
  
  // Load existing tasks immediately
  loadTasks()
  
  // Refresh tasks every 30 seconds
  setInterval(loadTasks, 30000)
}

initialize()