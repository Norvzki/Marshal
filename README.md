# Marshal

<div align="center">
  
  **Your Trusty Google Classroom AI Assistant**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=google-chrome&logoColor=white)](https://www.google.com/chrome/)
  [![Hacktoberfest 2025](https://img.shields.io/badge/Hacktoberfest-2025-orange)](https://hacktoberfest.com)
  
  *Built for Cebu Hacktoberfest 2025 Hackathon*
  
</div>

---

## 🎯 About

Marshal is a Chrome extension that helps students stay organized and focused by integrating with Google Classroom. It automatically syncs assignments, generates AI-powered study plans, tracks grades, and blocks distracting websites during study sessions.

### ✨ Key Features

- 🔄 **Auto-sync assignments** from Google Classroom with smart categorization
- 🎯 **Focus Mode** blocks distracting sites (Facebook, YouTube, TikTok, etc.)
- 📊 **AI Study Plans** with task prioritization and time management
- 📈 **GWA Calculator** for grade tracking across subjects
- 💡 **Productivity tools** including motivational quotes and quick navigation

---

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/marshal.git
   ```

2. **Load in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the cloned Marshal folder

3. **Start using Marshal**
   - Click the Marshal icon in your browser
   - Sign in with your Google account
   - Grant Google Classroom permissions
   - Wait for initial sync (30-60 seconds)

---

## 🤝 Contributing

We're student developers building this for students! We welcome all contributions to make Marshal better.

### How to Contribute

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/AmazingFeature
   ```
3. **Make your changes**
   - Fix bugs or add features
   - Follow existing code style
   - Test thoroughly
4. **Commit your changes**
   ```bash
   git commit -m 'Add some AmazingFeature'
   ```
5. **Push to your branch**
   ```bash
   git push origin feature/AmazingFeature
   ```
6. **Open a Pull Request**
   - Describe what you changed and why
   - Reference any related issues

### Ways to Help

- 🐛 **Report bugs** - Open an issue with details on how to reproduce
- 💡 **Suggest features** - Share ideas that would help students
- 💻 **Submit code** - Fix issues or implement new features
- 🎨 **Improve design** - Enhance UI/UX or create new themes
- 📚 **Add content** - Contribute motivational quotes or study tips
- 📖 **Update docs** - Help others understand how to use Marshal

---

## 🔧 Tech Stack

- **Frontend:** HTML5, CSS3, JavaScript (ES6+)
- **Chrome APIs:** identity, storage, tabs, webNavigation
- **Google APIs:** Classroom API v1

---

## 🔒 Privacy & Security

- ✅ All data stored locally in Chrome storage
- ✅ Read-only access to Google Classroom
- ✅ No personal data collection or tracking
- ✅ Secure OAuth 2.0 authentication

---

## 🐛 Troubleshooting

**No assignments showing?**
- Sign in to Google Classroom in your browser first
- Grant all permissions when prompted
- Wait 30-60 seconds for initial sync

**Focus Mode not working?**
- Confirm Focus Mode toggle shows "ON"
- Check background service worker console for errors

**"Failed to fetch courses"?**
- Verify OAuth Client ID in `manifest.json`
- Ensure Google Classroom API is enabled
- Check Extension ID in OAuth credentials

---

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🏆 Cebu Hacktoberfest 2025

Created by the **Marshal Development Team** - students passionate about education technology and open-source development.

**Mission:** Empower students with better tools for academic success through technology.

---

## 🙏 Acknowledgments

Thanks to Google Classroom API, Chrome Extensions Documentation, Cebu Hacktoberfest 2025 Organizers, and the Open Source Community.

---

## 📧 Contact

- **Issues:** [GitHub Issues](https://github.com/Norvzki/marshal/issues)
- **Email:** norvzki@gmail.com

---

<div align="center">

**Stay organized. Stay focused. Stay ahead with Marshal.** 📚✨

*Made with ❤️ by students, for students*

⭐ **Star us on GitHub if Marshal helps you!** ⭐

</div>
