// Content script for Marshal
console.log("[Marshal Content] Content script loaded")

// Check if we're on Google Classroom
const isGoogleClassroom = window.location.hostname.includes("classroom.google.com")

if (isGoogleClassroom) {
  console.log("[Marshal Content] Google Classroom detected")
  
  // Add Marshal button to Google Classroom UI
  addMarshalButton()
}

function addMarshalButton() {
  // Wait for the page to load
  const observer = new MutationObserver(() => {
    const header = document.querySelector('[role="banner"]')
    
    if (header && !document.getElementById('marshal-button')) {
      const marshalBtn = document.createElement('button')
      marshalBtn.id = 'marshal-button'
      marshalBtn.innerHTML = '📚 Marshal'
      marshalBtn.style.cssText = `
        position: fixed;
        top: 16px;
        right: 80px;
        z-index: 9999;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 20px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        transition: all 0.3s;
      `
      
      marshalBtn.addEventListener('mouseenter', () => {
        marshalBtn.style.transform = 'translateY(-2px)'
        marshalBtn.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)'
      })
      
      marshalBtn.addEventListener('mouseleave', () => {
        marshalBtn.style.transform = 'translateY(0)'
        marshalBtn.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)'
      })
      
      marshalBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'openMarshal' })
      })
      
      document.body.appendChild(marshalBtn)
      
      console.log("[Marshal Content] Marshal button added to Google Classroom")
      observer.disconnect()
    }
  })
  
  observer.observe(document.body, { childList: true, subtree: true })
}

// Listen for study mode notifications
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.studyModeActive) {
    const isActive = changes.studyModeActive.newValue
    
    if (isActive) {
      showStudyModeNotification('Study Mode is now ON! 🎯')
    } else {
      showStudyModeNotification('Study Mode is now OFF')
    }
  }
})

function showStudyModeNotification(message) {
  const notification = document.createElement('div')
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 24px;
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    font-family: 'Segoe UI', sans-serif;
    font-weight: 600;
    animation: slideIn 0.3s ease-out;
  `
  
  notification.textContent = message
  
  const style = document.createElement('style')
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }
  `
  
  document.head.appendChild(style)
  document.body.appendChild(notification)
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out'
    setTimeout(() => {
      notification.remove()
      style.remove()
    }, 300)
  }, 3000)
}

// Track study time when on educational sites
const educationalSites = [
  'classroom.google.com',
  'canvas.instructure.com',
  'moodle.org',
  'coursera.org',
  'udemy.com',
  'khanacademy.org',
  'edx.org'
]

const isEducationalSite = educationalSites.some(site => window.location.hostname.includes(site))

if (isEducationalSite) {
  // Track time spent on educational sites
  let startTime = Date.now()
  
  window.addEventListener('beforeunload', () => {
    const timeSpent = Date.now() - startTime
    chrome.storage.local.get('totalStudyTime', (result) => {
      const total = (result.totalStudyTime || 0) + timeSpent
      chrome.storage.local.set({ totalStudyTime: total })
    })
  })
}

// Enhance Google Classroom assignment cards
if (isGoogleClassroom) {
  enhanceAssignmentCards()
}

function enhanceAssignmentCards() {
  const observer = new MutationObserver(() => {
    const assignmentCards = document.querySelectorAll('[data-item-id]')
    
    assignmentCards.forEach(card => {
      if (!card.dataset.marshalEnhanced) {
        card.dataset.marshalEnhanced = 'true'
        
        // Add subtle highlight for due soon assignments
        const dueText = card.textContent.toLowerCase()
        if (dueText.includes('due today') || dueText.includes('due tomorrow')) {
          card.style.borderLeft = '4px solid #ff9800'
        }
      }
    })
  })
  
  observer.observe(document.body, { childList: true, subtree: true })
}
