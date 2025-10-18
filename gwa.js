// Load GWA and grades
async function loadGrades() {
  console.log("[v0] Loading grades...")
  try {
    const result = await window.chrome.storage.local.get("grades")
    const grades = result.grades || []
    console.log("[v0] Grades loaded:", grades)

    if (grades.length === 0) {
      document.getElementById("gwaDisplay").textContent = "--"
      return
    }

    // Calculate GWA
    const total = grades.reduce((sum, grade) => sum + grade.value, 0)
    const gwa = (total / grades.length).toFixed(2)
    document.getElementById("gwaDisplay").textContent = gwa

    // Display individual grades
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
    console.error("[v0] Error loading grades:", error)
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  console.log("[v0] GWA page loaded")

  // Back button
  const backBtn = document.getElementById("backBtn")
  if (backBtn) {
    console.log("[v0] Back button found, adding listener")
    backBtn.addEventListener("click", (e) => {
      console.log("[v0] Back button clicked")
      e.preventDefault()
      window.location.replace(window.chrome.runtime.getURL("popup.html"))
    })
  } else {
    console.error("[v0] Back button not found!")
  }

  // Load grades
  loadGrades()
})
