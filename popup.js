// State management
let allAssignments = [];
let currentFilter = 'all';

// DOM elements
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const assignmentsList = document.getElementById('assignmentsList');
const emptyState = document.getElementById('emptyState');
const filterSection = document.getElementById('filterSection');
const refreshBtn = document.getElementById('refreshBtn');
const retryBtn = document.getElementById('retryBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadAssignments();
  setupEventListeners();
});

function setupEventListeners() {
  refreshBtn.addEventListener('click', () => {
    loadAssignments();
  });

  retryBtn.addEventListener('click', () => {
    loadAssignments();
  });

  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      currentFilter = e.target.dataset.filter;
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      renderAssignments();
    });
  });
}

// Authentication
function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(token);
      }
    });
  });
}

// API calls
async function fetchCourses(token) {
  const response = await fetch(
    'https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE',
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch courses: ${response.statusText}`);
  }
  
  return response.json();
}

async function fetchCourseWork(token, courseId) {
  const response = await fetch(
    `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  
  if (!response.ok) {
    if (response.status === 404) {
      return { courseWork: [] };
    }
    throw new Error(`Failed to fetch coursework: ${response.statusText}`);
  }
  
  return response.json();
}

async function fetchSubmissionStatus(token, courseId, courseWorkId) {
  try {
    // Fetch submissions without userId to get current user's submission
    const response = await fetch(
      `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const submissions = data.studentSubmissions || [];
    
    // Find the submission for the current user (usually the first one)
    // Try to find one with state TURNED_IN or RETURNED first
    let submission = submissions.find(s => 
      s.state === 'TURNED_IN' || 
      s.state === 'RETURNED' || 
      s.state === 'RECLAIMED_BY_STUDENT'
    );
    
    // If not found, use the first submission
    if (!submission && submissions.length > 0) {
      submission = submissions[0];
    }
    
    console.log('Submission state:', submission?.state, 'for courseWork:', courseWorkId);
    return submission;
  } catch (e) {
    console.error('Error fetching submission:', e);
    return null;
  }
}

// Main loading function
async function loadAssignments() {
  showLoading();
  
  try {
    const token = await getAuthToken();
    const coursesData = await fetchCourses(token);
    
    if (!coursesData.courses || coursesData.courses.length === 0) {
      showEmpty();
      return;
    }
    
    allAssignments = [];
    
    for (const course of coursesData.courses) {
      const courseWorkData = await fetchCourseWork(token, course.id);
      
      if (courseWorkData.courseWork) {
        for (const work of courseWorkData.courseWork) {
          // Fetch submission status without needing user ID
          const submission = await fetchSubmissionStatus(token, course.id, work.id);
          
          // Better submission state detection
          const submissionState = submission?.state || 'NEW';
          const isTurnedIn = submissionState === 'TURNED_IN' || 
                            submissionState === 'RETURNED' || 
                            submissionState === 'RECLAIMED_BY_STUDENT';
          
          const assignment = {
            courseId: course.id,
            courseName: course.name,
            courseWorkId: work.id,
            title: work.title,
            description: work.description || 'No description',
            dueDate: work.dueDate,
            dueTime: work.dueTime,
            link: work.alternateLink,
            maxPoints: work.maxPoints,
            state: work.state,
            submissionState: submissionState,
            turnedIn: isTurnedIn,
            submissionTime: submission?.updateTime || submission?.creationTime,
            creationTime: work.creationTime
          };
          
          allAssignments.push(assignment);
        }
      }
    }
    
    // Sort by due date (earliest first)
    allAssignments.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return compareDates(a.dueDate, b.dueDate);
    });
    
    if (allAssignments.length === 0) {
      showEmpty();
    } else {
      showAssignments();
      renderAssignments();
    }
  } catch (error) {
    console.error('Error loading assignments:', error);
    showError(error.message);
  }
}

// Rendering functions
function renderAssignments() {
  const filteredAssignments = filterAssignments(allAssignments, currentFilter);
  
  if (filteredAssignments.length === 0) {
    assignmentsList.innerHTML = '<div class="empty-state"><p>No assignments in this category</p></div>';
    return;
  }
  
  assignmentsList.innerHTML = filteredAssignments.map(assignment => {
    const dueInfo = getDueInfo(assignment);
    const cardClass = dueInfo.isOverdue ? 'overdue' : (assignment.turnedIn ? 'completed' : '');
    
    return `
      <div class="assignment-card ${cardClass}">
        <div class="course-name">${escapeHtml(assignment.courseName)}</div>
        <div class="assignment-title">${escapeHtml(assignment.title)}</div>
        ${assignment.description !== 'No description' ? 
          `<div class="assignment-description">${escapeHtml(truncate(assignment.description, 150))}</div>` : 
          ''}
        <div class="assignment-meta">
          <div class="due-date ${dueInfo.className}">
            ${dueInfo.icon} ${dueInfo.text}
          </div>
          <span class="status-badge ${assignment.turnedIn ? 'turned-in' : 'not-turned-in'}">
            ${assignment.turnedIn ? '✓ Turned In' : 'Not Turned In'}
          </span>
        </div>
        ${assignment.submissionState !== 'NEW' ? `<div style="font-size: 11px; color: #999; margin-top: 4px;">Status: ${assignment.submissionState}</div>` : ''}
        <a href="${assignment.link}" target="_blank" class="assignment-link">
          Open in Classroom →
        </a>
      </div>
    `;
  }).join('');
}

function filterAssignments(assignments, filter) {
  switch (filter) {
    case 'upcoming':
      return assignments.filter(a => !a.turnedIn && !getDueInfo(a).isOverdue && a.dueDate);
    case 'overdue':
      return assignments.filter(a => !a.turnedIn && getDueInfo(a).isOverdue);
    case 'completed':
      return assignments.filter(a => a.turnedIn);
    case 'all':
    default:
      return assignments;
  }
}

function getDueInfo(assignment) {
  // If assignment is turned in, show submission date instead of due date status
  if (assignment.turnedIn && assignment.submissionTime) {
    const submissionDate = new Date(assignment.submissionTime);
    return {
      text: `Submitted ${formatSubmissionDate(submissionDate)}`,
      icon: '✓',
      className: 'submitted',
      isOverdue: false
    };
  }
  
  if (!assignment.dueDate) {
    return {
      text: 'No due date',
      icon: '📅',
      className: '',
      isOverdue: false
    };
  }
  
  const dueDate = new Date(
    assignment.dueDate.year,
    assignment.dueDate.month - 1,
    assignment.dueDate.day,
    assignment.dueTime?.hours || 23,
    assignment.dueTime?.minutes || 59
  );
  
  const now = new Date();
  const diffTime = dueDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const isOverdue = diffTime < 0;
  
  if (isOverdue) {
    return {
      text: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''}`,
      icon: '⚠️',
      className: 'overdue',
      isOverdue: true
    };
  } else if (diffDays === 0) {
    return {
      text: 'Due today',
      icon: '🔥',
      className: 'upcoming',
      isOverdue: false
    };
  } else if (diffDays === 1) {
    return {
      text: 'Due tomorrow',
      icon: '⏰',
      className: 'upcoming',
      isOverdue: false
    };
  } else if (diffDays <= 7) {
    return {
      text: `Due in ${diffDays} days`,
      icon: '📅',
      className: 'upcoming',
      isOverdue: false
    };
  } else {
    return {
      text: formatDate(assignment.dueDate),
      icon: '📅',
      className: '',
      isOverdue: false
    };
  }
}

// UI state functions
function showLoading() {
  loadingState.style.display = 'block';
  errorState.style.display = 'none';
  assignmentsList.style.display = 'none';
  emptyState.style.display = 'none';
  filterSection.style.display = 'none';
}

function showError(message) {
  loadingState.style.display = 'none';
  errorState.style.display = 'block';
  assignmentsList.style.display = 'none';
  emptyState.style.display = 'none';
  filterSection.style.display = 'none';
  errorMessage.textContent = message || 'Failed to load assignments. Please try again.';
}

function showEmpty() {
  loadingState.style.display = 'none';
  errorState.style.display = 'none';
  assignmentsList.style.display = 'none';
  emptyState.style.display = 'block';
  filterSection.style.display = 'none';
}

function showAssignments() {
  loadingState.style.display = 'none';
  errorState.style.display = 'none';
  assignmentsList.style.display = 'block';
  emptyState.style.display = 'none';
  filterSection.style.display = 'block';
}

// Utility functions
function formatDate(dueDate) {
  if (!dueDate) return 'No due date';
  const date = new Date(dueDate.year, dueDate.month - 1, dueDate.day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatSubmissionDate(date) {
  const now = new Date();
  const diffTime = now - date;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'today';
  } else if (diffDays === 1) {
    return 'yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

function compareDates(date1, date2) {
  const d1 = new Date(date1.year, date1.month - 1, date1.day);
  const d2 = new Date(date2.year, date2.month - 1, date2.day);
  return d1 - d2;
}

function truncate(str, maxLength) {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}