let expandedSection = null
let planToDelete = null

const urlParams = new URLSearchParams(window.location.search)
const viewMode = urlParams.get("view")

// Load and display study plans
async function loadStudyPlans() {
  try {
    const result = await window.chrome.storage.local.get("studyPlans")
    const plans = result.studyPlans || []

    const incompletePlans = plans.filter((plan) => !plan.completed)
    const completePlans = plans.filter((plan) => plan.completed)

    document.getElementById("incompleteCount").textContent =
      `${incompletePlans.length} Study Plan${incompletePlans.length !== 1 ? "s" : ""}`
    document.getElementById("completeCount").textContent =
      `${completePlans.length} Study Plan${completePlans.length !== 1 ? "s" : ""}`

    renderPlans("incompleteList", incompletePlans)
    renderPlans("completeList", completePlans)

    if (viewMode === "incomplete") {
      document.getElementById("incompleteSection").classList.add("expanded")
      document.getElementById("expandIncomplete").classList.add("expanded")
      expandedSection = document.getElementById("incompleteSection")
    } else if (viewMode === "completed") {
      document.getElementById("completeSection").classList.add("expanded")
      document.getElementById("expandComplete").classList.add("expanded")
      expandedSection = document.getElementById("completeSection")
    }
  } catch (error) {
    console.error("[v0] Error loading study plans:", error)
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
      const badgeClass = plan.type === "manual" ? "manual" : "ai"
      const badgeText = plan.type === "manual" ? "Manual" : "AI-Generated"

      const incompleteTasks = plan.schedule ? plan.schedule.filter((t) => !t.completed).length : 0
      const completedTasks = plan.schedule ? plan.schedule.filter((t) => t.completed).length : 0

      return `
      <div class="plan-card" data-plan-id="${plan.id}">
        <div class="plan-card-header">
          <h3 class="plan-card-title">${plan.title}</h3>
          <span class="plan-card-badge ${badgeClass}">${badgeText}</span>
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
      window.location.replace(window.chrome.runtime.getURL(`plan-detail.html?id=${planId}`))
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
    const result = await window.chrome.storage.local.get("studyPlans")
    const plans = result.studyPlans || []
    const updatedPlans = plans.filter((plan) => plan.id !== Number.parseInt(planToDelete))
    await window.chrome.storage.local.set({ studyPlans: updatedPlans })
    hideDeleteModal()
    loadStudyPlans()
  } catch (error) {
    console.error("[v0] Error deleting plan:", error)
  }
}

document.getElementById("backBtn").addEventListener("click", () => {
  window.location.replace(window.chrome.runtime.getURL("popup.html"))
})

document.getElementById("closeBtn").addEventListener("click", () => {
  window.close()
})

document.getElementById("addPlanBtn").addEventListener("click", () => {
  window.location.replace(window.chrome.runtime.getURL("popup.html"))
})

document.getElementById("expandIncomplete").addEventListener("click", function () {
  const section = document.getElementById("incompleteSection")
  const isExpanded = section.classList.contains("expanded")

  if (isExpanded) {
    section.classList.remove("expanded")
    this.classList.remove("expanded")
    expandedSection = null
  } else {
    if (expandedSection) {
      expandedSection.classList.remove("expanded")
      document.getElementById("expandIncomplete").classList.remove("expanded")
      document.getElementById("expandComplete").classList.remove("expanded")
    }
    section.classList.add("expanded")
    this.classList.add("expanded")
    expandedSection = section
  }
})

document.getElementById("expandComplete").addEventListener("click", function () {
  const section = document.getElementById("completeSection")
  const isExpanded = section.classList.contains("expanded")

  if (isExpanded) {
    section.classList.remove("expanded")
    this.classList.remove("expanded")
    expandedSection = null
  } else {
    if (expandedSection) {
      expandedSection.classList.remove("expanded")
      document.getElementById("expandIncomplete").classList.remove("expanded")
      document.getElementById("expandComplete").classList.remove("expanded")
    }
    section.classList.add("expanded")
    this.classList.add("expanded")
    expandedSection = section
  }
})

document.getElementById("confirmDeleteBtn").addEventListener("click", deletePlan)
document.getElementById("cancelDeleteBtn").addEventListener("click", hideDeleteModal)

document.getElementById("deleteModal").addEventListener("click", (e) => {
  if (e.target.id === "deleteModal") {
    hideDeleteModal()
  }
})

loadStudyPlans()
