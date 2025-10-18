// Simulate AI study plan generation
async function generateStudyPlan() {
  console.log("[v0] Starting study plan generation...")

  try {
    // Get tasks from storage
    console.log("[v0] Fetching tasks from storage...")
    const result = await window.chrome.storage.local.get(["urgentTasks", "missedTasks"])
    console.log("[v0] Tasks retrieved:", result)

    const urgentTasks = result.urgentTasks || []
    const missedTasks = result.missedTasks || []
    const allTasks = [...urgentTasks, ...missedTasks]

    console.log("[v0] Total tasks:", allTasks.length)

    if (allTasks.length === 0) {
      console.log("[v0] No tasks found, creating sample tasks...")
      allTasks.push(
        {
          title: "Math Assignment - Chapter 5",
          subject: "Mathematics",
          deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        },
        { title: "English Essay Draft", subject: "English", deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) },
        { title: "Science Lab Report", subject: "Science", deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) },
      )
    }

    // Simulate AI processing time
    console.log("[v0] Simulating AI processing...")
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Create a new study plan
    const studyPlan = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      title: `Study Plan - ${new Date().toLocaleDateString()}`,
      tasks: allTasks,
      schedule: generateSchedule(allTasks),
      completed: false,
    }

    console.log("[v0] Study plan created:", studyPlan)

    // Save to storage
    const existingPlans = await window.chrome.storage.local.get("studyPlans")
    const plans = existingPlans.studyPlans || []
    plans.unshift(studyPlan)
    await window.chrome.storage.local.set({ studyPlans: plans })

    console.log("[v0] Study plan saved. Total plans:", plans.length)

    await new Promise((resolve) => setTimeout(resolve, 500))

    console.log("[v0] Redirecting to study plans view...")
    window.location.replace(window.chrome.runtime.getURL("study-plans.html"))
  } catch (error) {
    console.error("[v0] Error generating study plan:", error)
    alert("Failed to generate study plan. Error: " + error.message)
    setTimeout(() => {
      window.location.replace(window.chrome.runtime.getURL("popup.html"))
    }, 1000)
  }
}

function generateSchedule(tasks) {
  // Simple scheduling algorithm
  const schedule = []
  const now = new Date()

  tasks.forEach((task, index) => {
    const scheduleDate = new Date(now)
    scheduleDate.setDate(scheduleDate.getDate() + index)

    schedule.push({
      task: task.title,
      date: scheduleDate.toLocaleDateString(),
      duration: "1-2 hours",
      priority: index < 3 ? "High" : "Medium",
    })
  })

  return schedule
}

// Start generation
generateStudyPlan()
