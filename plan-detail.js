let currentPlanId = null
let currentTasks = []
let currentSortBy = "urgency"
let editingTaskIndex = null
let deletingTaskIndex = null
let deletingPlanId = null

// Get plan ID from URL
const urlParams = new URLSearchParams(window.location.search)
const planId = urlParams.get("id")

// Load plan details
async function loadPlanDetails() {
  try {
    const result = await window.chrome.storage.local.get("studyPlans")
    const plans = result.studyPlans || []
    const plan = plans.find((p) => p.id === Number.parseInt(planId))

    if (!plan) {
      alert("Study plan not found")
      window.location.href = "study-plans.html"
      return
    }

    currentPlanId = plan.id
    currentTasks = plan.tasks || []

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
    document.getElementById("incompleteCount").textContent = incompleteCount

    renderTasks()
  } catch (error) {
    console.error("[v0] Error loading plan details:", error)
  }
}

// Sort tasks
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
      sorted.sort((a, b) => (Number.parseInt(b.taskLength) || 0) - (Number.parseInt(a.taskLength) || 0))
      break
  }

  return sorted
}

// Render tasks
function renderTasks() {
  const sortedTasks = sortTasks(currentTasks, currentSortBy)
  const container = document.getElementById("tasksContainer")

  if (sortedTasks.length === 0) {
    container.innerHTML = '<p class="no-tasks">No tasks in this plan</p>'
    return
  }

  container.innerHTML = sortedTasks
    .map((task, index) => {
      const originalIndex = currentTasks.indexOf(task)
      return `
        <div class="task-item">
          <div class="task-content">
            <div class="task-name">${task.title}</div>
            <div class="task-meta">
              <span class="task-meta-item">${task.subject}</span>
              <span class="task-meta-item">•</span>
              <span class="task-meta-item">${task.taskLength} to finish</span>
              <span class="task-meta-item">Due on ${new Date(task.dueDate).toLocaleDateString()}</span>
            </div>
          </div>
          <span class="task-urgency ${task.urgency}">${task.urgency.charAt(0).toUpperCase() + task.urgency.slice(1)} Urgency</span>
          <div class="task-actions">
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
          </div>
        </div>
      `
    })
    .join("")

  // Add event listeners
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
}

// Open edit modal
function openEditModal(index) {
  editingTaskIndex = index
  const task = currentTasks[index]

  document.getElementById("taskNameInput").value = task.title
  document.getElementById("taskSubjectInput").value = task.subject
  document.getElementById("taskDateInput").value = task.dueDate
  document.getElementById("taskLengthInput").value = task.taskLength

  // Set urgency button
  document.querySelectorAll(".urgency-btn").forEach((btn) => {
    btn.classList.remove("active")
    if (btn.dataset.urgency === task.urgency) {
      btn.classList.add("active")
    }
  })

  document.getElementById("modalOverlay").classList.add("active")
}

// Close edit modal
function closeEditModal() {
  document.getElementById("modalOverlay").classList.remove("active")
  editingTaskIndex = null
}

// Save task
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

// Show delete confirmation
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

// Confirm delete
async function confirmDelete() {
  const modal = document.getElementById("confirmationModal")

  if (deletingTaskIndex !== null) {
    currentTasks.splice(deletingTaskIndex, 1)
    await savePlanToStorage()
    renderTasks()
    deletingTaskIndex = null
  } else if (deletingPlanId !== null) {
    const result = await window.chrome.storage.local.get("studyPlans")
    const plans = result.studyPlans || []
    const filtered = plans.filter((p) => p.id !== deletingPlanId)
    await window.chrome.storage.local.set({ studyPlans: filtered })
    window.location.replace(window.chrome.runtime.getURL("study-plans.html"))
  }

  modal.classList.remove("active")
}

// Save plan to storage
async function savePlanToStorage() {
  const result = await window.chrome.storage.local.get("studyPlans")
  const plans = result.studyPlans || []
  const planIndex = plans.findIndex((p) => p.id === currentPlanId)
  if (planIndex !== -1) {
    plans[planIndex].tasks = currentTasks
    await window.chrome.storage.local.set({ studyPlans: plans })
  }
}

// Event listeners
document.getElementById("backBtn").addEventListener("click", () => {
  window.location.replace(window.chrome.runtime.getURL("study-plans.html"))
})

document.getElementById("closeBtn").addEventListener("click", () => {
  window.close()
})

document.getElementById("sortBtn").addEventListener("click", () => {
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

document.getElementById("addTaskBtn").addEventListener("click", () => {
  const newTask = {
    title: "New Task",
    subject: "",
    dueDate: new Date().toISOString().split("T")[0],
    taskLength: "1 hour",
    urgency: "medium",
    completed: false,
  }
  currentTasks.push(newTask)
  savePlanToStorage()
  renderTasks()
})

document.getElementById("deletePlanBtn").addEventListener("click", () => {
  showDeleteConfirmation("plan")
})

document.getElementById("modalCloseBtn").addEventListener("click", closeEditModal)

document.getElementById("deleteTaskBtn").addEventListener("click", () => {
  closeEditModal()
  showDeleteConfirmation("task", editingTaskIndex)
})

document.querySelectorAll(".urgency-btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    document.querySelectorAll(".urgency-btn").forEach((b) => b.classList.remove("active"))
    e.target.classList.add("active")
  })
})

document.getElementById("editForm").addEventListener("submit", (e) => {
  e.preventDefault()
  saveTask()
})

document.getElementById("cancelBtn").addEventListener("click", () => {
  document.getElementById("confirmationModal").classList.remove("active")
  deletingTaskIndex = null
  deletingPlanId = null
})

document.getElementById("confirmBtn").addEventListener("click", confirmDelete)

// Initialize
loadPlanDetails()
