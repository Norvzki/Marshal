let taskCount = 0

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

document.getElementById("addTaskBtn").addEventListener("click", addTask)

document.getElementById("savePlanBtn").addEventListener("click", async () => {
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
      tasks.push({ title, subject, dueDate, urgency })
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

  const result = await window.chrome.storage.local.get("studyPlans")
  const studyPlans = result.studyPlans || []
  studyPlans.unshift(studyPlan)

  await window.chrome.storage.local.set({ studyPlans })

  window.location.replace(window.chrome.runtime.getURL("study-plans.html"))
})

document.getElementById("backBtn").addEventListener("click", () => {
  window.location.replace(window.chrome.runtime.getURL("popup.html"))
})

document.getElementById("closeBtn").addEventListener("click", () => {
  window.close()
})

// Add initial task
addTask()
