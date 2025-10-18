async function loadMissedTasks() {
  try {
    const result = await window.chrome.storage.local.get("missedTasks")
    const tasks = result.missedTasks || []

    const tasksList = document.getElementById("tasksList")

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
        </div>
      `
      })
      .join("")
  } catch (error) {
    console.error("[v0] Error loading missed tasks:", error)
  }
}

document.getElementById("backBtn").addEventListener("click", () => {
  window.location.replace(window.chrome.runtime.getURL("popup.html"))
})

document.getElementById("closeBtn").addEventListener("click", () => {
  window.close()
})

loadMissedTasks()
