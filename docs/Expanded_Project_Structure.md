# Project Structure : Uni-Event

```bash
Uni-Event
├── 📁 .github
│   ├── 📁 ISSUE_TEMPLATE
│   │   ├── 📝 bug_report.md
│   │   └── 📝 feature_request.md
│   ├── 📁 workflows
│   │   ├── ⚙️ auto-assign.yml
│   │   ├── ⚙️ build-android-apk.yml
│   │   ├── ⚙️ ci.yml
│   │   ├── ⚙️ pr-validation.yml
│   │   └── ⚙️ update-lockfile.yml
│   ├── 📝 PULL_REQUEST_TEMPLATE.md
│   ├── ⚙️ coderabbit.yaml
│   └── ⚙️ dependabot.yml
├── 📁 .husky
│   ├── 📄 pre-commit
│   └── 📄 pre-push
├── 📁 app
│   ├── 📁 %ProgramData%
│   │   └── 📁 Microsoft
│   │       └── 📁 Windows
│   │           └── 📁 UUS
│   │               └── 📁 State
│   │                   └── 📄 _active.uusver
│   ├── 📁 .expo
│   │   ├── 📁 web
│   │   ├── 📝 README.md
│   │   └── ⚙️ devices.json
│   ├── 📁 assets
│   │   ├── 🖼️ UniEvent.png
│   │   ├── 🖼️ adaptive-icon.png
│   │   ├── 🖼️ banner.png
│   │   ├── 🖼️ favicon.png
│   │   ├── 🖼️ icon.png
│   │   └── 🖼️ splash.png
│   ├── 📁 cypress
│   │   └── 📁 e2e
│   │       ├── 📄 auth.cy.js
│   │       └── 📄 critical_flows.cy.js
│   ├── 📁 public
│   │   └── 📄 firebase-messaging-sw.example.js
│   ├── 📁 scripts
│   │   ├── 📝 README.md
│   │   ├── 📄 generate-sw.js
│   │   └── 📄 patch-expo-sea.js
│   ├── 📁 src
│   │   ├── 📁 components
│   │   │   ├── 📁 __tests__
│   │   │   │   └── 📄 EventCard.test.js
│   │   │   ├── 📄 AppealModal.js
│   │   │   ├── 📄 CustomTabBar.js
│   │   │   ├── 📄 EventCard.js
│   │   │   ├── 📄 FeaturedCarousel.js
│   │   │   ├── 📄 FeedbackModal.js
│   │   │   ├── 📄 GradientWrapper.js
│   │   │   ├── 📄 LiquidPullToRefresh.js
│   │   │   ├── 📄 MapComponent.js
│   │   │   ├── 📄 NotificationBell.js
│   │   │   ├── 📄 OfflineBanner.js
│   │   │   ├── 📄 PWAInstallPrompt.js
│   │   │   ├── 📄 PaymentSuccessAnimation.js
│   │   │   ├── 📄 PremiumButton.js
│   │   │   ├── 📄 PremiumInput.js
│   │   │   ├── 📄 ScreenWrapper.js
│   │   │   ├── 📄 SkeletonLoader.js
│   │   │   ├── 📄 TopContributors.js
│   │   │   ├── 📄 UniEventLogo.js
│   │   │   ├── 📄 WebQRScanner.js
│   │   │   └── 📄 WrappedConfetti.js
│   │   ├── 📁 hooks
│   │   │   ├── 📄 useCopyToClipboard.js
│   │   │   ├── 📄 useNetworkStatus.js
│   │   │   └── 📄 usePullToRefresh.js
│   │   ├── 📁 lib
│   │   │   ├── 📁 __tests__
│   │   │   │   ├── 📄 AutomationService.test.js
│   │   │   │   ├── 📄 CalendarService.test.js
│   │   │   │   ├── 📄 EmailService.test.js
│   │   │   │   ├── 📄 ExportService.web.test.js
│   │   │   │   ├── 📄 ThemeContext.test.js
│   │   │   │   ├── 📄 capacityPredictor.test.js
│   │   │   │   ├── 📄 checkInService.test.js
│   │   │   │   ├── 📄 earlyBird.test.js
│   │   │   │   ├── 📄 eventHeatmapData.test.js
│   │   │   │   ├── 📄 feedbackSentiment.test.js
│   │   │   │   ├── 📄 feedbackService.test.js
│   │   │   │   ├── 📄 formatEventDate.test.js
│   │   │   │   ├── 📄 profileBadges.test.js
│   │   │   │   ├── 📄 tagExtractor.test.js
│   │   │   │   ├── 📄 theme.test.js
│   │   │   │   ├── 📄 usePushNotifications.test.js
│   │   │   │   └── 📄 userLevels.test.js
│   │   │   ├── 📄 AuthContext.js
│   │   │   ├── 📄 AutomationService.js
│   │   │   ├── 📄 CalendarService.js
│   │   │   ├── 📄 EmailService.js
│   │   │   ├── 📄 ExportService.native.js
│   │   │   ├── 📄 ExportService.web.js
│   │   │   ├── 📄 ThemeContext.js
│   │   │   ├── 📄 attendanceExportService.native.js
│   │   │   ├── 📄 attendanceExportService.web.js
│   │   │   ├── 📄 attendanceReportTemplate.js
│   │   │   ├── 📄 capacityPredictor.js
│   │   │   ├── 📄 checkInService.js
│   │   │   ├── 📄 config.js
│   │   │   ├── 📄 earlyBird.js
│   │   │   ├── 📄 eventAnalyticsCounters.js
│   │   │   ├── 📄 eventHeatmapData.js
│   │   │   ├── 📄 exportUtils.js
│   │   │   ├── 📄 feedbackSentiment.js
│   │   │   ├── 📄 feedbackService.js
│   │   │   ├── 📄 firebaseConfig.js
│   │   │   ├── 📄 firestorePaths.js
│   │   │   ├── 📄 formatEventDate.js
│   │   │   ├── 📄 logger.js
│   │   │   ├── 📄 notificationService.js
│   │   │   ├── 📄 participantService.js
│   │   │   ├── 📄 profileBadges.js
│   │   │   ├── 📄 publicProfile.js
│   │   │   ├── 📄 rateLimiter.js
│   │   │   ├── 📄 tagExtractor.js
│   │   │   ├── 📄 theme.js
│   │   │   ├── 📄 useAnimatedThemeColor.js
│   │   │   ├── 📄 usePushNotifications.js
│   │   │   └── 📄 userLevels.js
│   │   └── 📁 screens
│   │       ├── 📁 __tests__
│   │       │   ├── 📄 AuthScreen.test.js
│   │       │   ├── 📄 CreateEvent.test.js
│   │       │   ├── 📄 EventRegistrationFormScreen.test.js
│   │       │   ├── 📄 MyEventsScreen.test.js
│   │       │   └── 📄 QRScannerScreen.test.js
│   │       ├── 📄 AdminDashboard.js
│   │       ├── 📄 AppearanceScreen.js
│   │       ├── 📄 AttendanceDashboard.js
│   │       ├── 📄 AuthScreen.js
│   │       ├── 📄 ClubProfileScreen.js
│   │       ├── 📄 CreateEvent.js
│   │       ├── 📄 DesktopAdmin.js
│   │       ├── 📄 EventAnalytics.js
│   │       ├── 📄 EventChatScreen.js
│   │       ├── 📄 EventDetail.js
│   │       ├── 📄 EventRegistrationFormScreen.js
│   │       ├── 📄 FormBuilderScreen.js
│   │       ├── 📄 LeaderboardScreen.js
│   │       ├── 📄 LocationHeatmapScreen.js
│   │       ├── 📄 MobileAdmin.js
│   │       ├── 📄 MyEventsScreen.js
│   │       ├── 📄 MyRegisteredEventsScreen.js
│   │       ├── 📄 ParticipatingEventsScreen.js
│   │       ├── 📄 PaymentScreen.js
│   │       ├── 📄 ProfileScreen.js
│   │       ├── 📄 QRScannerScreen.js
│   │       ├── 📄 RemindersScreen.js
│   │       ├── 📄 ReportBugScreen.js
│   │       ├── 📄 SavedEventsScreen.js
│   │       ├── 📄 StreakScreen.js
│   │       ├── 📄 TicketScreen.js
│   │       ├── 📄 UserFeed.js
│   │       ├── 📄 WalletScreen.js
│   │       └── 📄 WrappedScreen.js
│   ├── ⚙️ .env.example
│   ├── ⚙️ .gitignore
│   ├── ⚙️ .npmrc
│   ├── ⚙️ .nvmrc
│   ├── 📄 App.js
│   ├── 📝 App_Feature_Documentation.md
│   ├── ⚙️ app.json
│   ├── 📄 babel.config.js
│   ├── 📄 cypress.config.js
│   ├── ⚙️ eas.json
│   ├── 📄 eslint.config.mjs
│   ├── 📄 jest.config.js
│   ├── 📄 metro.config.js
│   ├── ⚙️ package-lock.json
│   └── ⚙️ package.json
├── 📁 cloud-functions
│   ├── 📁 assets
│   │   ├── 📕 1.pdf
│   │   ├── 📕 certificate_template.pdf
│   │   └── 📕 certificate_template1.pdf
│   ├── 📁 lib
│   │   ├── 📁 lib
│   │   │   └── 📄 participants.js
│   │   ├── 📁 utils
│   │   │   ├── 📄 distance.js
│   │   │   └── 📄 fraudScore.js
│   │   ├── 📄 analyzeAttendance.js
│   │   ├── 📄 certificateService.js
│   │   ├── 📄 dailyDigest.js
│   │   ├── 📄 eventNotifications.js
│   │   ├── 📄 index.js
│   │   ├── 📄 onEventCreate.js
│   │   ├── 📄 reminders.js
│   │   ├── 📄 reputation.js
│   │   ├── 📄 server.js
│   │   └── 📄 setRole.js
│   ├── 📁 migrations
│   │   ├── 📄 001_add_feedbackRequestSent_to_events.ts
│   │   └── 📄 migrate.ts
│   ├── 📁 src
│   │   ├── 📁 lib
│   │   │   └── 📄 participants.ts
│   │   ├── 📁 middleware
│   │   │   ├── 📄 appCheck.ts
│   │   │   ├── 📄 ipWhitelist.ts
│   │   │   └── 📄 rateLimiter.ts
│   │   ├── 📁 utils
│   │   │   ├── 📄 distance.ts
│   │   │   ├── 📄 emailSender.test.ts
│   │   │   ├── 📄 emailSender.ts
│   │   │   ├── 📄 emailTemplateRenderer.test.ts
│   │   │   ├── 📄 emailTemplateRenderer.ts
│   │   │   ├── 📄 fraudScore.ts
│   │   │   ├── 📄 push.ts
│   │   │   └── 📄 rateLimiter.ts
│   │   ├── 📄 analyzeAttendance.ts
│   │   ├── 📄 attendanceStreak.ts
│   │   ├── 📄 auditLog.ts
│   │   ├── 📄 backfillEventAnalytics.ts
│   │   ├── 📄 branchReport.ts
│   │   ├── 📄 certificateService.ts
│   │   ├── 📄 clubReputation.integration.test.ts
│   │   ├── 📄 clubReputation.test.ts
│   │   ├── 📄 clubReputation.ts
│   │   ├── 📄 computeShowUpRatios.ts
│   │   ├── 📄 dailyDigest.ts
│   │   ├── 📄 dedicatedStudentCertificate.ts
│   │   ├── 📄 eventNotifications.ts
│   │   ├── 📄 feedbackSentimentAnalysis.ts
│   │   ├── 📄 inactiveUsers.ts
│   │   ├── 📄 index.ts
│   │   ├── 📄 logger.ts
│   │   ├── 📄 onEventCreate.ts
│   │   ├── 📄 onFeedbackSubmit.test.ts
│   │   ├── 📄 onFeedbackSubmit.ts
│   │   ├── 📄 permanentCleanup.ts
│   │   ├── 📄 postEventFeedback.ts
│   │   ├── 📄 reminders.ts
│   │   ├── 📄 reputation.test.ts
│   │   ├── 📄 reputation.ts
│   │   ├── 📄 sendBulkEmails.ts
│   │   ├── 📄 server.ts
│   │   └── 📄 setRole.ts
│   ├── 📁 templates
│   │   ├── 🌐 certificate_email_template.html
│   │   ├── 🌐 feedback_email_template.html
│   │   └── 🌐 universal_email_template.html
│   ├── ⚙️ .env.example
│   ├── ⚙️ .gitignore
│   ├── 📝 FIREBASE_SETUP.md
│   ├── 📄 babel.config.js
│   ├── 📄 eslint.config.mjs
│   ├── 📄 jest.config.js
│   ├── ⚙️ package-lock.json
│   ├── ⚙️ package.json
│   ├── ⚙️ tsconfig.eslint.json
│   └── ⚙️ tsconfig.json
├── 📁 docs
│   ├── 📁 EmailJs_Template
│   │   ├── 🌐 certificate_email_template.html
│   │   ├── 🌐 feedback_email_template.html
│   │   └── 🌐 universal_email_template.html
│   ├── 📝 ANDROID_BUILD_SETUP.md
│   ├── 📝 Architecture.md
│   ├── 📝 Centralized_Event_Platform_Summary.md
│   ├── 📝 DATA_MODEL.md
│   ├── 📝 EMAIL_TEMPLATE_DEBUG.md
│   ├── 📝 EMAIL_TEMPLATE_SETUP_GUIDE.md
│   ├── 📝 ENV_SETUP.md
│   ├── 📝 Expanded_Project_Structure.md
│   ├── 📝 FEATURES.md
│   ├── 📝 FIREBASE_SETUP.md
│   ├── 📝 SETUP.md
│   ├── 📝 TROUBLESHOOTING.md
│   └── 📝 notifications_architecture.md
├── 📁 tests
│   ├── 📄 firestore.rules.test.ts
│   └── 📄 storage.rules.test.js
├── ⚙️ .gitignore
├── ⚙️ .prettierrc
├── 🎬 20260605-0923-32.6107489.mp4
├── 🖼️ Auth.png
├── 📝 CODE_OF_CONDUCT.md
├── 📝 CONTRIBUTING.md
├── 📄 LICENSE
├── 📝 README.md
├── 📝 SECURITY.md
├── ⚙️ cors.json
├── ⚙️ database.rules.json
├── ⚙️ firebase.json
├── ⚙️ firestore.indexes.json
├── 📄 firestore.rules
├── 🖼️ image.png
├── 📄 jest.config.js
├── ⚙️ package-lock.json
├── ⚙️ package.json
├── 📄 sonar-project.properties
├── 📄 storage.rules
└── ⚙️ tsconfig.json
```
