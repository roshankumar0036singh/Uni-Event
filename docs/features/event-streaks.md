# Event Streaks Feature - Implementation Plan

## Overview
Reward consistent event attendance with streak tracking and bonus rewards.

## Feature Design

### Streak Mechanics
- Track consecutive event attendances
- Streak increments when user attends N events in a row
- Streak resets if user misses an event they RSVP'd to
- Visual streak counter on profile and event pages

### Streak Tiers
| Streak | Badge | Bonus |
|--------|-------|-------|
| 3 events | 🥉 Bronze | 5% priority for waitlist |
| 5 events | 🥈 Silver | 10% discount on paid events |
| 10 events | 🥇 Gold | Early access to new events |
| 25 events | 💎 Diamond | Free VIP access (1x/month) |
| 50 events | 🏆 Legend | Custom profile badge + perks |

### Database Schema
```sql
CREATE TABLE event_streaks (
    user_id UUID REFERENCES users(id),
    current_streak INT DEFAULT 0,
    longest_streak INT DEFAULT 0,
    last_attended_event_id UUID,
    last_attended_at TIMESTAMP,
    tier VARCHAR(20) DEFAULT 'none',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id)
);

CREATE TABLE streak_history (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    event_id UUID REFERENCES events(id),
    attended_at TIMESTAMP DEFAULT NOW(),
    streak_count_at_time INT
);
```

### API Endpoints
- `GET /api/streaks/:userId` - Get current streak info
- `POST /api/streaks/check-in` - Record attendance (auto-increment)
- `GET /api/streaks/leaderboard` - Top streaks

### UI Components
1. **Streak Badge**: Shows current streak count with tier icon
2. **Streak Calendar**: Visual calendar showing attended/missed events
3. **Streak Notification**: "Don't break your streak!" reminder before events
4. **Profile Streak Display**: Prominent streak info on user profile

### Notification Rules
- 24h before event: "Keep your X-event streak going!"
- After attendance: "Nice! Your streak is now X events 🔥"
- Streak broken: "Your streak was reset. Start a new one!"
- Tier up: "Congratulations! You've reached Silver tier! 🥈"
