// ═══════════════════════════════════════════════
// AI-HELPERS.JS - Marshal Extension AI Functions
// Phase 2A: Assignment Analysis + Focus Insights
// ═══════════════════════════════════════════════

console.log('[Marshal AI] AI Helpers loaded')

// ═══════════════════════════════════════════════
// CORE API CALLING FUNCTION
// ═══════════════════════════════════════════════

async function callGeminiAPI(prompt, options = {}) {
  return new Promise((resolve, reject) => {
    console.log('[Marshal AI] Calling Gemini API...')
    
    chrome.runtime.sendMessage(
      { 
        action: 'callGeminiAPI', 
        payload: { prompt, ...options } 
      },
      response => {
        if (chrome.runtime.lastError) {
          console.error('[Marshal AI] Runtime error:', chrome.runtime.lastError)
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        
        if (response && response.success) {
          console.log('[Marshal AI] API call successful')
          resolve(response.data)
        } else {
          console.error('[Marshal AI] API call failed:', response?.error)
          reject(new Error(response?.error || 'Unknown error'))
        }
      }
    )
  })
}

// ═══════════════════════════════════════════════
// ASSIGNMENT ANALYSIS FUNCTION
// ═══════════════════════════════════════════════

async function analyzeAssignment(assignment) {
  console.log('[Marshal AI] Analyzing assignment:', assignment.title)
  
  let daysUntilDue = null
  let dueDateText = 'No due date specified'
  
  if (assignment.dueDate) {
    const dueDate = new Date(assignment.dueDate)
    const now = new Date()
    const diffTime = dueDate - now
    daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    dueDateText = dueDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    })
    
    if (daysUntilDue >= 0) {
      dueDateText += ` (${daysUntilDue} ${daysUntilDue === 1 ? 'day' : 'days'} from now)`
    } else {
      dueDateText += ` (OVERDUE by ${Math.abs(daysUntilDue)} ${Math.abs(daysUntilDue) === 1 ? 'day' : 'days'})`
    }
  }
  

const prompt = `
You are an intelligent academic assistant that helps students analyze their assignments thoroughly and strategically. 
Your role is to provide structured, evidence-based, and realistic guidance — written in a professional, polished tone. 
Your responses should sound trustworthy and informed, as if coming from an academic advisor who understands real study habits. 
You may include subtle wit or charm *only* in the "recommendedStartTime" or closing lines, to make the advice feel motivating and approachable.

**Assignment Information:**
- Title: ${assignment.title}
- Subject: ${assignment.subject || assignment.courseName || 'General'}
- Description: ${assignment.description || 'No description provided'}
- Due Date: ${dueDateText}
- Maximum Points: ${assignment.maxPoints || 'Not specified'}

**Your Objective:**
Provide a detailed analysis that helps the student plan their work effectively. 
The response must be informative, actionable, and structured for real academic use. 
Avoid filler, exaggeration, or over-friendly tones — aim for concise professionalism.

**Response Format (MUST be valid JSON, no markdown or code blocks):**
{
  "summary": "One sentence summarizing what the assignment requires, stated clearly and objectively.",
  "breakdown": [
    {
      "step": "Step name (e.g., Research, Draft, Review)",
      "description": "Detailed, practical explanation of what to do in this step (1–3 sentences).",
      "estimatedTime": "Realistic time estimate (e.g., 45 min, 2 hours) based on task complexity."
    }
  ],
  "totalTimeEstimate": "Total estimated time (e.g., 3–4 hours).",
  "difficulty": "easy | medium | hard (based on actual workload and reasoning demands).",
  "strategy": {
    "approach": "A well-reasoned, professional recommendation of how to approach the task efficiently (2–3 sentences).",
    "tips": [
      "Specific actionable tip 1 — factual and realistic.",
      "Specific actionable tip 2 — can include references to good academic practice.",
      "Specific actionable tip 3 — concise and helpful."
    ]
  },
  "urgency": "low | medium | high (based on time remaining and task complexity).",
  "recommendedStartTime": "A short, polished, and possibly witty recommendation (e.g., 'Start tonight — future you will thank you.')."
}

**Guidelines:**
1. Maintain a professional, academic tone with precise and evidence-based reasoning.
2. Give realistic time estimates — avoid random or exaggerated durations.
3. Subtle wit is allowed *only* in the “recommendedStartTime” or conclusion; it should never reduce professionalism.
4. Avoid markdown formatting — return valid JSON only.
5. Be practical, informative, and concise.
`

  try {
    const response = await callGeminiAPI(prompt)
    
    let cleanedResponse = response.trim()
    
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\n?/, '').replace(/\n?```$/, '')
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\n?/, '').replace(/\n?```$/, '')
    }
    
    const analysis = JSON.parse(cleanedResponse)
    
    console.log('[Marshal AI] Analysis completed successfully')
    return analysis
    
  } catch (error) {
    console.error('[Marshal AI] Error analyzing assignment:', error)
    
    return {
      summary: "Unable to generate detailed AI analysis at this time.",
      breakdown: [
        {
          step: "Review Requirements",
          description: "Carefully read the assignment description and understand what's expected.",
          estimatedTime: "10 min"
        },
        {
          step: "Plan Your Approach",
          description: "Create an outline or plan for how you'll complete the assignment.",
          estimatedTime: "15 min"
        },
        {
          step: "Complete the Work",
          description: "Work through the assignment step by step according to your plan.",
          estimatedTime: "1-2 hours"
        },
        {
          step: "Review and Submit",
          description: "Check your work for errors and ensure you've met all requirements before submitting.",
          estimatedTime: "15 min"
        }
      ],
      totalTimeEstimate: "2-3 hours",
      difficulty: "medium",
      strategy: {
        approach: "Start by understanding the requirements, then break the work into smaller manageable tasks. Work in focused 25-minute sessions with 5-minute breaks between them.",
        tips: [
          "Read the instructions carefully at least twice",
          "Start early to avoid last-minute stress",
          "Take regular breaks to maintain focus",
          "Ask for help if you get stuck"
        ]
      },
      urgency: daysUntilDue !== null && daysUntilDue <= 2 ? "high" : 
              daysUntilDue !== null && daysUntilDue <= 5 ? "medium" : "low",
      recommendedStartTime: daysUntilDue !== null && daysUntilDue <= 1 ? "Start immediately" : 
                           daysUntilDue !== null && daysUntilDue <= 3 ? "Start today" : "Start soon"
    }
  }
}

// ═══════════════════════════════════════════════
// FOCUS MODE AI ANALYTICS - ENHANCED
// ═══════════════════════════════════════════════

async function analyzeFocusPatterns(focusData) {
  console.log('[Marshal AI] Analyzing focus patterns with AI...')
  
  const context = {
    totalBlocks: focusData.dailyBlockedAttempts || 0,
    timeSaved: focusData.totalTimeSaved || 0,
    hourlyPattern: focusData.hourlyAttempts || {},
    siteDistribution: focusData.blockedSitesCount || {},
    weeklyTrend: focusData.weeklyStats || {},
    studyStartTime: focusData.studyStartTime
  }
  
  let peakHour = null
  let peakCount = 0
  if (Object.keys(context.hourlyPattern).length > 0) {
    peakHour = Object.keys(context.hourlyPattern).reduce((a, b) => 
      context.hourlyPattern[a] > context.hourlyPattern[b] ? a : b
    )
    peakCount = context.hourlyPattern[peakHour]
  }
  
  let topSite = null
  let topSiteCount = 0
  if (Object.keys(context.siteDistribution).length > 0) {
    topSite = Object.keys(context.siteDistribution).reduce((a, b) =>
      context.siteDistribution[a] > context.siteDistribution[b] ? a : b
    )
    topSiteCount = context.siteDistribution[topSite]
  }
  
  const weeklyTotal = Object.values(context.weeklyTrend).reduce((sum, val) => sum + val, 0)
  const daysActive = Object.keys(context.weeklyTrend).length
  
  const prompt = `You are an AI productivity analyst helping a student understand their focus patterns and improve their study habits.

**Today's Focus Data:**
- Total distractions blocked: ${context.totalBlocks}
- Time saved: ${context.timeSaved} minutes (${Math.floor(context.timeSaved / 60)}h ${context.timeSaved % 60}m)
- Peak distraction hour: ${peakHour ? `${peakHour % 12 || 12}${peakHour < 12 ? 'AM' : 'PM'} with ${peakCount} attempts` : 'No data yet'}
- Most blocked site: ${topSite ? `${topSite} (${topSiteCount} times)` : 'No data yet'}
- Days active this week: ${daysActive}
- Total blocks this week: ${weeklyTotal}

**Response Format (MUST be valid JSON):**
{
  "interpretation": "2-3 sentences explaining what these patterns mean and why they happen",
  "strengths": [
    {
      "title": "Strength title (max 6 words)",
      "description": "What they're doing well (1-2 sentences)",
      "metric": "Specific number or percentage"
    }
  ],
  "improvements": [
    {
      "title": "Area to improve (max 6 words)",
      "issue": "What's happening (1 sentence)",
      "recommendation": "Specific actionable advice with timing (1-2 sentences)"
    }
  ],
  "predictions": [
    {
      "topic": "What you're predicting (max 8 words)",
      "risk": "low/medium/high",
      "reasoning": "Why this prediction (1 sentence)",
      "action": "What to do about it (1 sentence)"
    }
  ],
  "siteInsights": {
    "sitename.com": "Brief psychological insight"
  },
  "bestTimes": {
    "morning": "high/medium/low",
    "afternoon": "high/medium/low", 
    "evening": "high/medium/low"
  },
  "recommendations": [
    "Specific action 1",
    "Specific action 2",
    "Specific action 3"
  ]
}

Return ONLY valid JSON, no markdown.`

  try {
    const response = await callGeminiAPI(prompt)
    
    let cleanedResponse = response.trim()
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\n?/, '').replace(/\n?```$/, '')
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\n?/, '').replace(/\n?```$/, '')
    }
    
    const parsed = JSON.parse(cleanedResponse)
    console.log('[Marshal AI] Focus analysis completed')
    return parsed
    
  } catch (error) {
    console.error('[Marshal AI] Error analyzing focus patterns:', error)
    return generateFallbackAnalysis(context, peakHour, topSite, topSiteCount)
  }
}

function generateFallbackAnalysis(context, peakHour, topSite, topSiteCount) {
  const hasData = context.totalBlocks > 0
  
  if (!hasData) {
    return {
      interpretation: "You're just getting started with Focus Mode! Enable it during study sessions to track your productivity patterns and receive personalized insights.",
      strengths: [
        {
          title: "Taking the First Step",
          description: "You've installed Marshal and are ready to improve your focus. That's the hardest part done!",
          metric: "Ready to start"
        }
      ],
      improvements: [
        {
          title: "Enable Focus Mode",
          issue: "Not enough data collected yet to provide insights",
          recommendation: "Turn on Focus Mode during your next study session to start building your productivity profile."
        }
      ],
      predictions: [],
      siteInsights: {},
      bestTimes: {
        morning: "Unknown - need data",
        afternoon: "Unknown - need data",
        evening: "Unknown - need data"
      },
      recommendations: [
        "Enable Focus Mode during your next study session",
        "Try blocking distracting sites for at least 3 days to see patterns",
        "Check back after a week for personalized insights"
      ]
    }
  }
  
  const peakTimeText = peakHour ? `${peakHour % 12 || 12}${peakHour < 12 ? 'AM' : 'PM'}` : 'afternoon'
  const interpretation = peakHour 
    ? `Your distraction peak at ${peakTimeText} likely happens due to natural energy fluctuations. This is common after lunch or during late afternoon slumps.`
    : `You're building good focus habits! With ${context.totalBlocks} distractions blocked, you've saved ${Math.floor(context.timeSaved / 60)} hours of productive time.`
  
  return {
    interpretation,
    strengths: [
      {
        title: "Strong Self-Control",
        description: `You've successfully resisted ${context.totalBlocks} distractions today. That shows real commitment to your goals.`,
        metric: `${context.totalBlocks} blocks`
      },
      {
        title: "Time Recovery",
        description: "Every blocked distraction saved you approximately 5 minutes that you can use for actual studying.",
        metric: `${context.timeSaved}min saved`
      }
    ],
    improvements: [
      {
        title: peakHour ? "Peak Distraction Time" : "Consistency Needed",
        issue: peakHour 
          ? `Most distractions happen around ${peakTimeText}`
          : "Build a consistent focus routine across different times of day",
        recommendation: peakHour
          ? `Schedule lighter tasks or take a 10-minute break at ${(peakHour - 1) % 12 || 12}:45${peakHour < 13 ? 'AM' : 'PM'} to prevent the ${peakTimeText} slump.`
          : "Try using Focus Mode at the same times each day to build a habit."
      }
    ],
    predictions: [
      {
        topic: "Focus Improvement Potential",
        risk: "low",
        reasoning: "You're actively using Focus Mode and building awareness of your patterns",
        action: "Keep using Focus Mode consistently for best results"
      }
    ],
    siteInsights: topSite ? {
      [topSite]: `You've tried to visit this ${topSiteCount} times - it's your go-to distraction when you need a mental break.`
    } : {},
    bestTimes: {
      morning: peakHour && peakHour < 12 ? "medium" : "high",
      afternoon: peakHour && peakHour >= 12 && peakHour < 17 ? "medium" : "high",
      evening: peakHour && peakHour >= 17 ? "medium" : "high"
    },
    recommendations: [
      peakHour ? `Take a proactive break before ${peakTimeText} to prevent distractions` : "Use Focus Mode during your most challenging study sessions",
      topSite ? `Consider pre-blocking ${topSite} during high-focus tasks` : "Identify and block your top distraction sites",
      "Aim for consistent 25-minute focused work sessions with 5-minute breaks"
    ]
  }
}

function formatTimeMinutes(minutes) {
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function getTimeOfDay(hour) {
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  if (hour < 21) return 'evening'
  return 'night'
}

console.log('[Marshal AI] AI Helpers ready with Focus Insights!')

