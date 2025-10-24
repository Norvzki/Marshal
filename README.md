# Marshal 📚

<div align="center">
  
  **Your Trusty Google Classroom AI Assistant**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=google-chrome&logoColor=white)](https://www.google.com/chrome/)
  [![Hacktoberfest 2025](https://img.shields.io/badge/Hacktoberfest-2025-orange)](https://hacktoberfest.com)
  
  *Built for Cebu Hacktoberfest 2025 Hackathon*
  
</div>

---

## 🎯 What is Marshal?

Marshal is a powerful Chrome extension designed specifically for students to streamline their Google Classroom experience. Whether you're juggling multiple courses, struggling to prioritize tasks, or finding it hard to stay focused, Marshal has your back.

**Primary Purpose:** Empower students with better organization, time management, and focus through seamless Google Classroom integration and AI-powered study planning.

### ✨ Key Highlights

- 🔄 **Automatic Assignment Sync** from Google Classroom
- 🎯 **Focus Mode** with website blocking
- 📊 **AI-Powered Study Plans**
- 📈 **GWA Calculator & Grade Tracking**
- 💪 **Productivity Tools** for academic success

---

## 📋 Features

### ✅ Google Classroom Integration

- **Automatic Assignment Sync** - Fetches all your assignments directly from Google Classroom in real-time
- **Smart Categorization** - Automatically sorts assignments into "Urgent" (due within 7 days) and "Missed" (overdue) categories
- **Submission Tracking** - Monitors which assignments you've turned in and which are still pending
- **Multi-Course Support** - Handles assignments from all your active courses simultaneously
- **Real-Time Updates** - Background sync every 15 minutes to keep you up-to-date

### 🎯 Focus Mode (Study Mode)

- **Website Blocking** - Blocks distracting websites when activated:
  - Facebook, Twitter, Instagram, TikTok
  - YouTube, Netflix, Reddit, Twitch
- **Motivational Redirects** - Shows inspiring quotes and study statistics when blocked sites are accessed
- **Block Counter** - Tracks how many times you've been redirected from distracting sites

### 📊 Study Planning

- **AI-Generated Study Plans** - Creates optimized study schedules based on your assignments and deadlines
- **Manual Planning** - Build custom study plans tailored to your specific needs
- **Task Management**:
  - Add, edit, and delete tasks
  - Set priorities (High, Medium, Low)
  - Assign estimated completion times
  - Track completed vs incomplete tasks
- **Smart Scheduling** - Automatically prioritizes tasks based on urgency and due dates
- **Multiple Views** - Filter study plans by incomplete and completed status

### 📈 Academic Tracking

- **GWA Calculator** - Track your General Weighted Average across all subjects
- **Subject-Based Grades** - Manage and view grades for individual subjects
- **Progress Monitoring** - Visual representation of academic performance
- **Historical Data** - Keep track of grades throughout the semester

### 💡 Productivity Features

- **Daily Motivational Quotes** - Rotating inspirational messages to keep you motivated
- **Task Prioritization** - Sort tasks by urgency, date, subject, or estimated length
- **Quick Navigation** - Easy access to urgent tasks, missed tasks, and study plans
- **Assignment Details** - View full descriptions, due dates, and direct links to Google Classroom

### 🎨 User Interface

- **Dual-Tab Interface** - Separate tabs for Marshal dashboard and Google Classroom assignments
- **Modern Design** - Clean, gradient-based UI with smooth animations
- **Filter System** - Quickly filter assignments by all, upcoming, overdue, or completed
- **Responsive Layout** - Optimized for the Chrome extension popup size
- **Visual Indicators** - Color-coded urgency levels and status badges

---

## 🚀 Roadmap

### 🔮 Planned Features

- [ ] **Smart Notifications** - Browser notifications for upcoming deadlines and study reminders
- [ ] **Pomodoro Timer Integration** - Built-in timer for focused study sessions
- [ ] **Advanced Analytics Dashboard**:
  - Study time trends and patterns
  - Assignment completion rates
  - Subject-wise performance analysis
  - Productivity heatmaps
- [ ] **Calendar Integration** - Sync with Google Calendar for comprehensive schedule management
- [ ] **AI Study Recommendations** - Machine learning-based suggestions for optimal study times
- [ ] **Collaborative Study Groups** - Connect with classmates for group study sessions
- [ ] **Assignment Difficulty Prediction** - Estimate time needed based on assignment complexity
- [ ] **Custom Study Strategies** - Personalized learning approaches based on your study patterns
- [ ] **Voice Reminders** - Audio notifications for important deadlines
- [ ] **Dark Mode** - Eye-friendly theme for night-time studying
- [ ] **Mobile Companion App** - Sync data across devices
- [ ] **Offline Mode** - Access study plans and grades without internet
- [ ] **Export Functionality** - Download study plans and reports as PDF
- [ ] **Custom Blocked Sites** - Let users add their own distracting websites to the block list
- [ ] **Study Streaks** - Gamification with achievement badges and study streaks
- [ ] **Time Zone Support** - For students studying abroad or with international classes

---

## 🔧 Technical Details

### Technologies Used

- **Frontend:** HTML5, CSS3, JavaScript (ES6+)
- **Chrome APIs:**
  - `chrome.identity` - OAuth authentication
  - `chrome.storage.local` - Data persistence
  - `chrome.tabs` - Tab management
  - `chrome.webNavigation` - Site blocking
- **Google APIs:** Google Classroom API v1
- **Design:** CSS Gradients, Flexbox, Animations

### API Integration Flow

```
User Opens Extension
        ↓
OAuth Authentication (chrome.identity)
        ↓
Fetch Google Classroom Data (API calls)
        ↓
Process & Categorize Assignments
        ↓
Save to Chrome Local Storage
        ↓
Display in Popup Interface
        ↓
Background Sync Every 15 Minutes
```

---

## 🚀 Installation

### Prerequisites

- Google Chrome browser
- Google account with access to Google Classroom
- Active Google Classroom courses

### Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/marshal.git
   cd marshal
   ```

2. **Set Up Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project
   - Enable Google Classroom API
   - Create OAuth 2.0 credentials
   - Add your extension ID to authorized origins

3. **Configure Extension**
   - Update `manifest.json` with your OAuth Client ID
   - Update extension permissions if needed

4. **Load Extension in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the Marshal directory

5. **Grant Permissions**
   - Click the Marshal icon
   - Sign in with your Google account
   - Grant Google Classroom access
   - Wait for initial sync (30-60 seconds)

---

## 🤝 Contributing

Marshal is built by students, for students. We need your help to make it even better!

### 📝 Share Your Experience

- **Report Bugs** - Found a glitch? Let us know what happened and how to reproduce it
- **Suggest Features** - Have an idea that would make studying easier? We'd love to hear it
- **Study Tips** - Share productivity techniques that work for you
- **UI Feedback** - Tell us what's confusing or could be improved

### 💻 Contribute Code

- **Fix Issues** - Check our GitHub issues and submit pull requests
- **Add Features** - Implement items from our roadmap
- **Improve Documentation** - Help other students understand how to use Marshal
- **Optimize Performance** - Make the extension faster and more efficient

### 🎨 Design Contributions

- **UI/UX Improvements** - Propose better layouts or interactions
- **Icon Design** - Create alternative icons or themes
- **Color Schemes** - Suggest more accessible or appealing color palettes

### 📚 Content Contributions

- **Motivational Quotes** - Submit inspiring quotes for students
- **Study Strategies** - Share effective learning techniques
- **Subject-Specific Tips** - Provide advice for specific courses or topics

### 🌟 How to Contribute

1. Fork the Repository
2. Create a Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit Your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## ⚠️ Important Notes

### 🔒 Privacy & Security

- ✅ **Your Data Stays Local** - All assignments and study plans are stored in Chrome's local storage, never on external servers
- ✅ **Read-Only Access** - Marshal only reads your Google Classroom data; it cannot modify assignments or submissions
- ✅ **No Data Collection** - We don't collect, track, or sell your personal information
- ✅ **OAuth Security** - Authentication is handled securely through Google's OAuth 2.0 protocol

### 🐛 Known Issues

- **First Load Delay** - Initial sync may take 30-60 seconds depending on the number of courses
- **Sync Timing** - Background sync occurs every 15 minutes; manual refresh available
- **Extension ID** - Must update OAuth credentials after loading unpacked extension
- **Browser Support** - Currently Chrome only; Firefox and Edge support planned

### ⚠️ Developer Note

We are student developers! This is our first major Chrome extension project built for the Cebu Hacktoberfest 2025 Hackathon. While we've done our best to ensure stability and security, there may be bugs or areas for improvement.

**If you have recommendations on what we can do better, please let us know!** Constructive feedback helps us grow as developers and makes Marshal better for everyone.

---

## 🔧 Troubleshooting

<details>
<summary><strong>"Failed to fetch courses" error</strong></summary>

- Verify OAuth Client ID is correct in `manifest.json`
- Check that Google Classroom API is enabled in Cloud Console
- Ensure Extension ID is added to OAuth credentials
</details>

<details>
<summary><strong>Focus Mode not blocking sites</strong></summary>

- Confirm Focus Mode toggle is ON (shows "ON" in button)
- Check `background.js` blocked sites list
- Look for errors in background service worker console
</details>

<details>
<summary><strong>No assignments showing</strong></summary>

- Sign in to Google Classroom in your browser first (must have active courses)
- Grant all permissions when prompted by extension
- Wait 30-60 seconds for initial sync
- Check background service worker console for sync logs (`chrome://extensions/` → Marshal → "service worker")
</details>

<details>
<summary><strong>Extension icon not appearing</strong></summary>

- Make sure Developer Mode is enabled
- Try reloading the extension
- Check if extension is enabled in `chrome://extensions/`
</details>

---

## 📝 License

This project is licensed under the MIT License - see below for details:

```
MIT License

Copyright (c) 2025 Marshal Development Team - Cebu Hacktoberfest 2025

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🏆 Cebu Hacktoberfest 2025

<div align="center">

Marshal was created as part of the **Cebu Hacktoberfest 2025 Hackathon**, an event celebrating open-source development and innovation in the Cebu tech community.

### 👥 Team

**Marshal Development Team**
- Students passionate about education technology
- First-time hackathon participants
- Learning by building real solutions for real problems

### 🎯 Our Mission

To empower students with better tools for academic success through technology, making Google Classroom more accessible, organized, and student-friendly.

</div>

---

## 🙏 Acknowledgments

- **Google Classroom API** for providing the foundation for our integration
- **Chrome Extensions Documentation** for excellent developer resources
- **Cebu Hacktoberfest 2025 Organizers** for hosting this amazing event
- **Open Source Community** for inspiration and learning resources
- **All Contributors** who help make Marshal better

---

## 📧 Contact & Support

- **GitHub Issues:** [Report bugs or request features](https://github.com/yourusername/marshal/issues)
- **Email:** your-email@example.com
- **Hackathon Project Page:** [Link if available]

---

## 🚀 Get Started Today!

Ready to transform your Google Classroom experience? Install Marshal now and take control of your academic journey!

1. ✅ Follow the installation guide above
2. ✅ Grant necessary permissions
3. ✅ Let Marshal sync your assignments
4. ✅ Create your first study plan
5. ✅ Enable Focus Mode and start studying!

<div align="center">

**Stay organized. Stay focused. Stay ahead with Marshal.** 📚✨

*Made with ❤️ by students, for students. Happy studying!*

---

⭐ **If Marshal helps you, consider giving us a star on GitHub!** ⭐

</div>
