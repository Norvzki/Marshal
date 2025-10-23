
// Sync Google Classroom data periodically
async function syncGoogleClassroomData() {
  console.log("[Marshal Background] Starting Google Classroom sync...")
  console.log("[Marshal Background] ⚡ Starting FAST sync...")
  const startTime = Date.now()

try {
const token = await getAuthToken()
@@ -338,41 +339,101 @@ async function syncGoogleClassroomData() {
return
}

    const allAssignments = []
    console.log(`[Marshal Background] Found ${coursesData.courses.length} courses`)

    for (const course of coursesData.courses) {
      const courseWorkData = await fetchCourseWork(token, course.id)
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
            link: work.alternateLink
          }

          allAssignments.push(assignment)
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

    console.log(`[Marshal Background] Fetching ${submissionPromises.length} submissions in parallel...`)
    const submissionResults = await Promise.all(submissionPromises)

    // Build assignments array
    const allAssignments = submissionResults.map(({ course, work, submission }) => {
      const submissionState = submission?.state || "NEW"
      const isTurnedIn =
        submissionState === "TURNED_IN" ||
        submissionState === "RETURNED" ||
        submissionState === "RECLAIMED_BY_STUDENT"

      return {
        courseId: course.id,
        courseName: course.name,
        title: work.title,
        dueDate: work.dueDate,
        dueTime: work.dueTime,
        turnedIn: isTurnedIn,
        link: work.alternateLink
      }
    })

await categorizeAndSaveAssignments(allAssignments)
    console.log("[Marshal Background] Sync completed successfully")
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`[Marshal Background] ✅ Sync completed in ${elapsed}s`)
} catch (error) {
    console.error("[Marshal Background] Sync error:", error)
    console.error("[Marshal Background] ❌ Sync error:", error)
  }
}

async function fetchWithRetry(fetchFn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchFn()
    } catch (error) {
      if (i === maxRetries - 1) throw error
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, i), 5000)
      console.log(`[Marshal] Retry ${i + 1}/${maxRetries} after ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

// OPTIMIZATION: Batch submissions fetching (optional, for even more speed)
async function fetchSubmissionStatusBatch(token, courseId, courseWorkIds) {
  // Fetch multiple submissions in parallel chunks to avoid overwhelming the API
  const CHUNK_SIZE = 10
  const results = []
  
  for (let i = 0; i < courseWorkIds.length; i += CHUNK_SIZE) {
    const chunk = courseWorkIds.slice(i, i + CHUNK_SIZE)
    const chunkResults = await Promise.all(
      chunk.map(id => fetchSubmissionStatus(token, courseId, id))
    )
    results.push(...chunkResults)
    
    // Small delay between chunks to respect rate limits
    if (i + CHUNK_SIZE < courseWorkIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
}
  
  return results
}

// Helper functions