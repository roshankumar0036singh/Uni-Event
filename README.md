# UniEvent - University Event Management Platform

<div align="center">

![UniEvent Logo](./app/assets/UniEvent.png)

**A modern, comprehensive event management solution for universities and educational institutions**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![React Native](https://img.shields.io/badge/React_Native-20232A?logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?logo=github-actions&logoColor=white)](https://github.com/features/actions)
[![ESLint](https://img.shields.io/badge/ESLint-4B32C3?logo=eslint&logoColor=white)](https://eslint.org/)
[![Prettier](https://img.shields.io/badge/Prettier-F7B93E?logo=prettier&logoColor=black)](https://prettier.io/)

[Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Contributing](#-contributing) • [License](#-license)

</div>

---

## 🎯 Overview

**UniEvent** bridges the gap between student organizations and the student body by providing a unified platform for event discovery, management, and engagement. Say goodbye to scattered announcements across WhatsApp groups, emails, and notice boards.

### Why UniEvent?

- **📱 Centralized Discovery**: All campus events in one place
- **🔔 Smart Reminders**: Never miss an event with push notifications and calendar sync
- **📊 Data-Driven Insights**: Track engagement and optimize event promotion
- **🎮 Gamification**: Leaderboards and reputation system to boost participation
- **🌐 Multi-Platform**: Native iOS, Android, and Progressive Web App

---

## ✨ Features

### 👨‍🎓 For Students

| Feature | Description |
|---------|-------------|
| **Personalized Feed** | Events filtered by department, year, and interests |
| **One-Tap RSVP** | Quick registration with automatic calendar integration |
| **Smart Reminders** | Push notifications 10 minutes before events |
| **QR Check-ins** | Contactless attendance tracking |
| **Leaderboard** | Earn reputation points for event participation |
| **Saved Events** | Bookmark events for later |
| **Event Chat** | Real-time discussion with attendees |

### 🎪 For Club Organizers

| Feature | Description |
|---------|-------------|
| **Easy Event Creation** | Rich media support with targeting options |
| **Attendance Dashboard** | Real-time QR code scanning and tracking |
| **Analytics Hub** | Branch-wise, year-wise participation insights |
| **Custom Forms** | Dynamic registration forms with validation |
| **Payment Integration** | Built-in ticketing for paid events |
| **Google Meet Integration** | Auto-generate meeting links for online events |
| **Reputation System** | Gamified scoring based on event success |

### 👑 For Administrators

| Feature | Description |
|---------|-------------|
| **Control Panel** | Platform-wide event moderation |
| **Role Management** | Assign admin/club privileges via cloud functions |
| **Event Suspension** | Moderate events that violate guidelines |
| **User Analytics** | Track platform engagement metrics |
| **Bulk Operations** | Manage multiple events efficiently |

---

## 🛠️ Tech Stack

### Frontend
- **React Native** + **Expo** (Cross-platform mobile)
- **React Navigation** (Routing & navigation)
- **Firebase SDK** (Auth, Firestore, Storage, Functions)
- **Expo Notifications** (Push notifications)
- **React Native Reanimated** (Smooth animations)

### Backend
- **Firebase Cloud Functions** (Serverless TypeScript)
- **Firebase Admin SDK** (Server-side operations)
- **Node.js 18+** (Runtime)
- **EmailJS & Resend** (Automated emails)
- **PDF-lib** (Certificate generation)

### DevOps & Quality
- **GitHub Actions** (CI/CD pipelines)
- **ESLint + Prettier** (Code quality)
- **Jest** (Unit testing)
- **Firebase Emulators** (Local development)
- **Dependabot** (Automated dependency updates)
- **CodeRabbit AI** (Automated PR reviews)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **npm** or **yarn**
- **Firebase CLI**: `npm install -g firebase-tools`
- **Java 11+** (for Firebase Emulators)

### Installation

```bash
# Clone the repository
git clone https://github.com/roshankumar0036singh/Uni-Event.git
cd Uni-Event

# Install app dependencies
cd app
npm install

# Install cloud functions dependencies
cd ../cloud-functions
npm install
```

### Configuration

1. **Copy environment template**:
   ```bash
   cp app/.env.example app/.env
   ```

2. **Fill in your credentials** in `app/.env`:
   - Firebase configuration
   - Google OAuth Client IDs
   - EmailJS keys (optional)

3. **For detailed setup instructions**, see [docs/SETUP.md](./docs/SETUP.md)

### Running Locally

**Terminal 1 - Backend (Emulators)**:
```bash
cd cloud-functions
npm run serve
```

**Terminal 2 - Frontend (Expo)**:
```bash
cd app
npm start
# Press 'w' for web, 'a' for Android, 'i' for iOS
```

---

## 📚 Documentation

- **[Setup Guide](./docs/SETUP.md)** - Detailed installation and configuration
- **[Firebase Setup](./docs/FIREBASE_SETUP.md)** - Emulator configuration
- **[Architecture](./docs/Architecture.md)** - System design overview
- **[Contributing Guide](./CONTRIBUTING.md)** - How to contribute
- **[Code of Conduct](./CODE_OF_CONDUCT.md)** - Community guidelines

---

## 🤝 Contributing

We welcome contributions from the community! Whether it's:

- 🐛 Bug reports
- ✨ Feature requests
- 📝 Documentation improvements
- 🔧 Code contributions

Please read our [Contributing Guide](./CONTRIBUTING.md) to get started.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](./LICENSE) file for details.

---

## 🌟 Acknowledgments

- Built with ❤️ for the university community
- Powered by Firebase and Expo
- Inspired by the need for better campus event management

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/roshankumar0036singh/Uni-Event/issues)
- **Discussions**: [GitHub Discussions](https://github.com/roshankumar0036singh/Uni-Event/discussions)
- **Email**: Open an issue for contact information

---

<div align="center">

**Made with ❤️ for students, by students**

[⬆ Back to Top](#unievent---university-event-management-platform)

</div>
