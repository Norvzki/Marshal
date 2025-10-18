async function loadUrgentTasks() {
  try {
    const result = await window.chrome.storage.local.get("urgentTasks")
    let tasks = result.urgentTasks || []

    const tasksList = document.getElementById("tasksList")

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
        </div>
      `
      })
      .join("")
  } catch (error) {
    console.error("[v0] Error loading urgent tasks:", error)
  }
}

document.getElementById("backBtn").addEventListener("click", () => {
  window.location.replace(window.chrome.runtime.getURL("popup.html"))
})

document.getElementById("closeBtn").addEventListener("click", () => {
  window.close()
})

loadUrgentTasks()
