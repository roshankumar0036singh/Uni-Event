# UniEvent - University Event Management Platform

<div align="center">

![UniEvent Banner](./app/assets/banner.png)

[![GitHub stars](https://img.shields.io/github/stars/roshankumar0036singh/Uni-Event?style=social)](https://github.com/roshankumar0036singh/Uni-Event/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/roshankumar0036singh/Uni-Event?style=social)](https://github.com/roshankumar0036singh/Uni-Event/network/members)
[![GitHub watchers](https://img.shields.io/github/watchers/roshankumar0036singh/Uni-Event?style=social)](https://github.com/roshankumar0036singh/Uni-Event/watchers)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![GitHub issues](https://img.shields.io/github/issues/roshankumar0036singh/Uni-Event)](https://github.com/roshankumar0036singh/Uni-Event/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/roshankumar0036singh/Uni-Event)](https://github.com/roshankumar0036singh/Uni-Event/pulls)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![React Native](https://img.shields.io/badge/React_Native-20232A?logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?logo=github-actions&logoColor=white)](https://github.com/features/actions)
[![ESLint](https://img.shields.io/badge/ESLint-4B32C3?logo=eslint&logoColor=white)](https://eslint.org/)
[![Prettier](https://img.shields.io/badge/Prettier-F7B93E?logo=prettier&logoColor=black)](https://prettier.io/)

[Features](#features) • [Quick Start](#quick-start) • [Documentation](#documentation) • [Contributing](#contributing) • [License](#license)

</div>

---

## Overview

UniEvent is a comprehensive event management platform designed specifically for universities, colleges, and educational institutions. It streamlines event discovery, registration, attendance tracking, and analytics while providing role-based access for students, club administrators, and system administrators.

### Key Benefits

- **Centralized Platform**: Single source of truth for all campus events
- **Data-Driven Insights**: Comprehensive analytics for event organizers
- **Scalable Architecture**: Built on Firebase for enterprise-grade reliability
- **Cross-Platform**: Native iOS, Android, and Progressive Web App support
- **Open Source**: MIT licensed, community-driven development

---

## Features

### For Students

| Feature | Description |
|---------|-------------|
| **Event Discovery** | Browse and search events filtered by department, year, and interests |
| **One-Tap Registration** | Quick RSVP with automatic calendar integration |
| **Smart Notifications** | Push notifications and reminders before events |
| **QR Code Check-in** | Contactless attendance tracking |
| **Gamification** | Earn reputation points and compete on leaderboards |
| **Saved Events** | Bookmark events for later review |
| **Event Chat** | Real-time discussion with other attendees |

### For Event Organizers

| Feature | Description |
|---------|-------------|
| **Event Creation** | Rich media support with audience targeting |
| **Attendance Dashboard** | Real-time QR code scanning and tracking |
| **Analytics Suite** | Branch-wise, year-wise participation insights |
| **Custom Forms** | Dynamic registration forms with validation |
| **Payment Integration** | Built-in ticketing for paid events |
| **Google Meet Integration** | Auto-generate meeting links for virtual events |
| **Reputation Tracking** | Gamified scoring based on event success metrics |

### For Administrators

| Feature | Description |
|---------|-------------|
| **Control Panel** | Platform-wide event moderation and oversight |
| **Role Management** | Assign admin/club privileges via cloud functions |
| **Event Moderation** | Suspend/unsuspend events that violate guidelines |
| **User Analytics** | Track platform engagement and usage metrics |
| **Bulk Operations** | Manage multiple events efficiently |

---

## Technology Stack

### Frontend
- **React Native** + **Expo** - Cross-platform mobile development
- **React Navigation** - Routing and navigation
- **Firebase SDK** - Authentication, Firestore, Storage, Functions
- **Expo Notifications** - Push notification system
- **React Native Reanimated** - Smooth animations

### Backend
- **Firebase Cloud Functions** - Serverless TypeScript functions
- **Firebase Admin SDK** - Server-side operations
- **Node.js 18+** - Runtime environment
- **EmailJS & Resend** - Automated email services
- **PDF-lib** - Certificate generation

### DevOps & Quality
- **GitHub Actions** - CI/CD automation
- **ESLint + Prettier** - Code quality enforcement
- **Jest** - Unit testing framework
- **Firebase Emulators** - Local development environment
- **Dependabot** - Automated dependency management
- **CodeRabbit AI** - Automated code reviews

---

## Quick Start

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

2. **Configure credentials** in `app/.env`:
   - Firebase project configuration
   - Google OAuth Client IDs
   - EmailJS keys (optional)

3. **Detailed setup**: See [docs/SETUP.md](./docs/SETUP.md)

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

## Documentation

- **[Setup Guide](./docs/SETUP.md)** - Comprehensive installation and configuration
- **[Firebase Setup](./docs/FIREBASE_SETUP.md)** - Emulator configuration details
- **[Architecture](./docs/Architecture.md)** - System design and architecture
- **[Contributing Guide](./CONTRIBUTING.md)** - Contribution guidelines
- **[Code of Conduct](./CODE_OF_CONDUCT.md)** - Community standards

---

## Contributing

We welcome contributions from the community. Whether you're fixing bugs, adding features, improving documentation, or reporting issues, your input is valuable.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](./LICENSE) file for details.

---

## Support

- **Issues**: [GitHub Issues](https://github.com/roshankumar0036singh/Uni-Event/issues)
- **Discussions**: [GitHub Discussions](https://github.com/roshankumar0036singh/Uni-Event/discussions)
- **Documentation**: [Project Wiki](https://github.com/roshankumar0036singh/Uni-Event/wiki)

---

## Acknowledgments

Built for the university community to streamline event management and enhance student engagement.

Powered by Firebase, Expo, and React Native.

---

<div align="center">

**Professional event management for modern educational institutions**

[⬆ Back to Top](#unievent---university-event-management-platform)

</div>
