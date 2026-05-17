# UniEvent - Complete Features Documentation

## Table of Contents
- [Overview](#overview)
- [User Roles](#user-roles)
- [Authentication & Account Management](#authentication--account-management)
- [Admin Features](#admin-features)
- [Club/Organizer Features](#cluborganizer-features)
- [Student Features](#student-features)
- [Shared Features (All Users)](#shared-features-all-users)
- [Technical Features](#technical-features)

---

## Overview

UniEvent is a comprehensive event management platform designed for universities and educational institutions. It connects event organizers (clubs and admins) with students, providing tools for event creation, registration, attendance tracking, payments, and engagement analytics.

---

## User Roles

### 1. **Admin**
- Full platform control
- Approve/reject club registrations
- Manage event appeals
- Seed sample data
- Access to all features

### 2. **Club/Organizer**
- Create and manage events
- Track attendance and analytics
- Send certificates
- Collect feedback
- Build reputation through ratings

### 3. **Student**
- Discover and register for events
- Earn points through participation
- Track event calendar
- Compete on leaderboards
- Provide feedback

---

## Authentication & Account Management

### Multi-Account Support
- **Account Switching**: Seamlessly switch between multiple saved accounts
- **Quick Switch UI**: Horizontal scroll view with avatar indicators
- **Account Management**: 
  - Tap to switch accounts
  - Long press to remove saved accounts
  - Add new accounts via sign-out flow
- **Persistent Sessions**: Saved accounts remain logged in

### Authentication Features
- Email/Password authentication via Firebase
- Secure token-based sessions
- Role-based access control (Admin, Club, Student)
- Profile creation with academic details (Branch, Year)

---

## Admin Features

### 1. **Admin Dashboard**
Centralized control panel with two main sections:

#### Club Approval System
- **View Pending Requests**: List of clubs awaiting approval
- **Club Details**: Name, owner email, description
- **Actions**:
  - Approve club (grants access to create events)
  - Reject club (removes request)
- **Real-time Updates**: Live sync with Firebase

#### Event Appeals Management
- **View Suspended Events**: Events flagged for guideline violations
- **Appeal Review**: Read organizer's appeal messages
- **Actions**:
  - Restore Event (set status to active)
  - Reject Appeal (keep event suspended)
- **Status Tracking**: Pending, Resolved, Rejected

### 2. **Sample Data Seeding**
- One-click sample event generation
- Pre-configured events across categories:
  - Hackathons
  - Cultural Fests
  - Tech Symposiums
  - Sports Days
  - Workshops
  - Pitch Fests
- Automatic date scheduling (future events)

### 3. **Daily Digest Broadcasting**
- Send email updates to all users
- Summarize upcoming events
- Triggered manually from profile

---

## Club/Organizer Features

### 1. **Event Creation & Management**

#### Create Event Wizard
**Basic Information**:
- Event title and description
- Cover image upload (or auto-select from defaults)
- Category selection (Tech, Cultural, Sports, Workshop, Seminar, General)

**Logistics**:
- Start and end date/time pickers
- Event mode toggle (Online/Offline)
- **Online Mode**: 
  - Manual meeting link entry
  - Auto-generate Google Meet link via OAuth
- **Offline Mode**: Venue location input

**Audience Targeting**:
- Target branches (CSE, ETC, EE, ME, Civil, All)
- Target years (1st, 2nd, 3rd, 4th)
- Multi-select chip interface

**Ticketing & Payments**:
- Free or Paid event toggle
- Ticket price input (₹)
- UPI ID for payment collection
- External registration link (optional)

**Custom Registration Forms**:
- Toggle custom form requirement
- Visual form builder with field types:
  - Text input
  - Email
  - Phone number
  - Dropdown
  - Checkbox
  - Radio buttons
- Drag-and-drop field ordering
- Required field marking

#### Edit Event
- Full edit access to all event details
- Update banner, description, pricing
- Modify custom forms
- Real-time preview

### 2. **Event Analytics Dashboard**

#### Attendance Tracking
**Live Check-In Feed**:
- Real-time check-in notifications
- User details (name, branch, year)
- Timestamp with "time ago" formatting
- Live dot indicator

**Statistics Cards**:
- Total Registered count
- Total Checked-In count
- Attendance rate visualization

**Demographic Analytics**:
- Department-wise breakdown (bar charts)
- Year-wise distribution (percentage graphs)
- Visual progress bars with gradients

#### QR Code Scanner
- Camera-based QR scanning
- Instant check-in confirmation
- Duplicate check-in prevention
- User profile validation
- Points allocation (+10 for attendance)

### 3. **Communication Tools**

#### Bulk Announcements
- **Modal Interface**: Subject and message input
- **Email Delivery**: Send to all registered participants
- **Use Cases**: 
  - Venue changes
  - Schedule updates
  - Important reminders

#### Feedback Requests
- **Automatic Trigger**: Sent when event ends
- **Manual Override**: Force send from dashboard
- **Status Indicator**: Shows if already sent
- **Email Template**: Pre-formatted feedback link

### 4. **Certificate Management**
- **Bulk Certificate Generation**: Cloud function integration
- **Email Delivery**: Automated sending to confirmed attendees
- **Status Tracking**: "Certificates Sent" badge
- **One-Time Action**: Prevents duplicate sends

### 5. **Data Export**

#### Participant Export (CSV)
- Name, Email, Branch, Year, Join Date
- Live profile data enrichment
- UTF-8 BOM encoding for Excel compatibility
- Web: Direct download
- Mobile: Share sheet

#### Form Responses Export (CSV)
- Dynamic columns based on custom form schema
- All user responses
- Timestamp tracking
- Proper CSV escaping

#### Reviews Export (CSV)
- User name and feedback text
- Event rating (1-5 stars)
- Organizer rating (1-5 stars)
- Submission date

### 6. **Organizer Reputation System**
- **Rating Aggregation**: Average of all event reviews
- **Display**: Star rating on profile
- **Calculation**: `totalPoints / totalRatings`
- **Visibility**: Public on club profile pages

### 7. **My Events Management**
- List of all created events
- Quick access to:
  - Edit event
  - View analytics
  - Check attendance
  - Send certificates
- Event status indicators (Active, Suspended, Ended)

---

## Student Features

### 1. **Event Discovery**

#### User Feed
- **Personalized Feed**: Events matching user's branch and year
- **Category Filters**: Filter by event type
- **Search**: Find events by title or description
- **Sort Options**: 
  - Upcoming first
  - Most popular (by registrations)
  - Recently added

#### Event Cards
- Eye-catching banner images
- Event title and category badge
- Date, time, and location
- Price indicator (Free/Paid)
- Organizer name
- Quick RSVP button
- Bookmark icon

### 2. **Event Registration**

#### Standard RSVP
- One-click registration
- Automatic reminder scheduling
- Points reward (+10 points)
- Email confirmation
- Calendar integration option

#### Custom Form Registration
- Navigate to form screen
- Fill required fields
- Submit responses to Firestore
- Auto-RSVP after submission

#### Paid Event Registration
- **External Link**: Redirect to registration URL
- **In-App Payment**: 
  - Navigate to payment screen
  - Display UPI QR code
  - Manual payment confirmation
  - Upload payment screenshot
  - Admin verification

### 3. **Event Detail View**

#### Immersive Header
- Full-width banner image
- Gradient overlay
- Back button
- Bookmark toggle
- Live badge (if event is currently happening)

#### Quick Actions Bar
- **Remind Me**: Set/remove event reminders
- **Add to Calendar**: Google Calendar OAuth integration
- **Share Event**: 
  - Web Share API
  - WhatsApp, Twitter quick share
  - Copy link
- **Event Chat**: Group discussion for attendees

#### Event Information
- Category and price badges
- Event title
- Hosted by (clickable to club profile)
- Date, time, and location cards
- Full description
- Attendee count

#### Conditional Features
- **Meeting Link**: Visible only to registered users
- **Feedback Button**: Appears after event ends
- **Ticket Access**: View QR code ticket

### 4. **My Calendar**
- All registered events
- Chronological sorting
- Event status (Upcoming, Live, Ended)
- Quick access to event details
- Ticket view

### 5. **Saved Events**
- Bookmarked events list
- Save for later functionality
- Remove from saved
- Quick registration access

### 6. **Event Chat**
- Real-time group messaging
- Participant-only access
- Emoji picker integration
- Message bubbles (sent/received)
- Auto-scroll to latest
- User identification

### 7. **Digital Tickets**

#### QR Code Ticket
- Unique QR code per user per event
- Event details display
- User name and email
- Check-in status indicator
- Shareable ticket

#### Wallet Integration
- View all tickets in one place
- Past and upcoming events
- Payment history
- Transaction records

### 8. **Feedback & Reviews**

#### Post-Event Feedback
- **Event Rating**: 1-5 stars
- **Organizer Rating**: 1-5 stars
- **Written Feedback**: Text input
- **Submission**: One-time per event
- **Impact**: Updates organizer reputation

### 9. **Leaderboard & Gamification**

#### Points System
- **Event Registration**: +10 points
- **Event Attendance**: +10 points (via QR check-in)
- **Event Withdrawal**: -10 points
- **Profile Display**: Total points badge

#### Leaderboard Rankings
- **Global Leaderboard**: Top students across all branches
- **Branch-wise Leaderboard**: Filter by department
- **Year-wise Leaderboard**: Filter by academic year
- **Real-time Updates**: Live ranking changes
- **User Highlighting**: Current user's position highlighted
- **Top 3 Podium**: Special display for top performers

### 10. **Reminders & Notifications**

#### Event Reminders
- **Scheduling**: 10 minutes before event start
- **Push Notifications**: Expo notification service
- **Management**: View and cancel from Reminders tab
- **Auto-Schedule**: On RSVP confirmation

#### Notification Types
- Event starting soon
- New event matching interests
- Event updates from organizers
- Feedback requests
- Certificate availability

---

## Shared Features (All Users)

### 1. **Profile Management**

#### Profile Editing
- **Display Name**: Update full name
- **Headline/Tagline**: For clubs (e.g., "Official Student Chapter")
- **Bio**: Multi-line description
- **Social Links** (Club/Admin only):
  - Instagram URL
  - LinkedIn URL
- **Academic Info** (Students/Clubs):
  - Year of study (1st-4th)
  - Branch (CSE, ETC, EE, ME, Civil)

#### Profile Display
- Avatar with gradient border
- Role badge (Admin, Club, Student)
- Statistics cards:
  - **Students**: Year, Points, Events Attended
  - **Clubs**: Rating, Points, Events Created
- Edit button (top-right)

### 2. **Club Profile Pages**
- Public profile for each organizer
- Display name and bio
- Social media links (Instagram, LinkedIn)
- Organizer rating (star display)
- List of created events
- Follow/Unfollow functionality
- Follower count
- **Self-Follow Prevention**: Users cannot follow themselves

### 3. **Appearance & Theming**

#### Dark Mode
- System-wide dark theme toggle
- Persistent preference
- Smooth color transitions
- Optimized for OLED displays

#### Theme System
- **Colors**: Primary, Secondary, Surface, Background, Text, Borders
- **Typography**: Consistent font scales (H1-H4, Body, Button)
- **Shadows**: Small, Default, Medium
- **Spacing**: Consistent padding/margins (XS, S, M, L, XL)

### 4. **Navigation**

#### Bottom Tab Bar
- **Home**: Event feed
- **Admin** (Admin only): Control panel
- **My Events** (Club/Admin): Created events
- **Reminders**: Scheduled notifications
- **Leaderboard**: Rankings
- **Profile**: User settings

#### Custom Tab Bar
- Glassmorphism effect (blur background)
- Active tab highlighting
- Icon + label
- Smooth animations

### 5. **Activity Tracking**

#### My Calendar
- All registered events
- Upcoming and past events
- Quick access to tickets

#### Saved Events
- Bookmarked events
- Quick un-save option

#### Wallet
- Payment history
- Transaction records
- Ticket archive

---

## Technical Features

### 1. **Real-time Data Sync**
- **Firebase Firestore**: Live updates
- **onSnapshot Listeners**: 
  - Event participants
  - Check-ins
  - Chat messages
  - Leaderboard rankings
- **Optimistic UI Updates**: Instant feedback

### 2. **Cloud Functions Integration**
- **Certificate Generation**: Automated PDF creation
- **Email Delivery**: Bulk announcements and feedback requests
- **Automation Service**: 
  - Auto-send feedback after event ends
  - Scheduled notifications

### 3. **File Storage**
- **Firebase Storage**: Event banners, payment screenshots
- **Image Upload**: Camera and gallery access
- **Image Optimization**: Compression and resizing

### 4. **Authentication & Security**
- **Firebase Auth**: Secure user management
- **ID Tokens**: API authorization
- **Role-based Access**: Firestore security rules
- **Safe Path Validation**: Prevent unauthorized access

### 5. **Push Notifications**
- **Expo Notifications**: Cross-platform support
- **Token Management**: Store push tokens in user profiles
- **Foreground Handling**: In-app notification display
- **Background Handling**: System tray notifications

### 6. **Calendar Integration**
- **Google Calendar OAuth**: Add events to calendar
- **Event Creation**: Auto-populate event details
- **Meeting Links**: Generate Google Meet links

### 7. **Deep Linking**
- **URL Schemes**: `unievent://` and `https://unievent-ez2w.onrender.com`
- **Event Sharing**: Direct links to event details
- **Navigation**: Deep link to specific screens

### 8. **Progressive Web App (PWA)**
- **Install Prompt**: Custom PWA install UI
- **Offline Support**: Service worker caching
- **Responsive Design**: Mobile and desktop layouts
- **Desktop Admin**: Optimized admin dashboard for large screens

### 9. **Analytics & Tracking**
- **View Counting**: Unique views per user per event
- **Attendance Analytics**: Department and year breakdowns
- **Engagement Metrics**: Registration vs. attendance rates

### 10. **Data Export**
- **CSV Generation**: UTF-8 BOM encoding
- **Web Download**: Blob creation and auto-download
- **Mobile Sharing**: Native share sheet
- **Excel Compatibility**: Proper formatting

### 11. **Form Builder**
- **Drag-and-Drop**: Reorder form fields
- **Field Types**: Text, Email, Phone, Dropdown, Checkbox, Radio
- **Validation**: Required field enforcement
- **Preview Mode**: Test form before publishing
- **Response Storage**: Firestore collection

### 12. **Payment System**
- **UPI Integration**: QR code generation
- **Payment Verification**: Screenshot upload
- **Transaction History**: Wallet view
- **Paid Event Gating**: Access control for paid events

### 13. **Search & Filtering**
- **Event Search**: Title and description matching
- **Category Filters**: Multi-select categories
- **Branch Filters**: Department-specific events
- **Year Filters**: Academic year targeting
- **Date Filters**: Upcoming, past, live events

### 14. **Automation Service**
- **Event End Detection**: Monitor event completion
- **Auto-Feedback**: Send feedback requests automatically
- **Status Tracking**: Prevent duplicate sends
- **Background Processing**: Cloud function triggers

### 15. **Error Handling**
- **Graceful Degradation**: Fallback UI for errors
- **User Feedback**: Alert dialogs for errors
- **Retry Logic**: Network request retries
- **Logging**: Console error tracking

---

## Feature Summary by Role

### Admin (All Features)
✅ Club approval/rejection  
✅ Event appeal management  
✅ Sample data seeding  
✅ Daily digest broadcasting  
✅ Full event management  
✅ Analytics dashboard  
✅ All student features  

### Club/Organizer
✅ Event creation & editing  
✅ Custom registration forms  
✅ QR code check-in  
✅ Attendance analytics  
✅ Bulk announcements  
✅ Certificate generation  
✅ Data export (participants, reviews, forms)  
✅ Reputation system  
✅ Profile customization  
✅ All student features  

### Student
✅ Event discovery & search  
✅ Event registration (free/paid)  
✅ Custom form submission  
✅ Digital tickets  
✅ Event chat  
✅ Reminders & notifications  
✅ Calendar integration  
✅ Feedback & reviews  
✅ Leaderboard & points  
✅ Saved events  
✅ Wallet & payment history  
✅ Profile management  
✅ Club following  

---

## Platform Support

- **Mobile**: iOS and Android (React Native)
- **Web**: Progressive Web App (PWA)
- **Desktop**: Optimized admin dashboard for large screens
- **Responsive**: Adaptive layouts for all screen sizes

---

## Key Differentiators

1. **Gamification**: Points and leaderboards drive engagement
2. **Real-time Updates**: Live attendance tracking and chat
3. **Custom Forms**: Flexible data collection for organizers
4. **Automated Workflows**: Auto-feedback, reminders, certificates
5. **Multi-Account Support**: Seamless role switching
6. **Comprehensive Analytics**: Deep insights into event performance
7. **Payment Integration**: Built-in UPI payment system
8. **Reputation System**: Trust and quality through ratings
9. **PWA Support**: Install on any device
10. **Accessibility**: Dark mode, responsive design, intuitive UI

---

*Last Updated: January 2026*  
*Version: 1.0.0*
