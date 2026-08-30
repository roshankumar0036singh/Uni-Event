export interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  startTime: Date;
  endTime: Date;
  capacity: number;
  organizerId: string;
  qrToken?: string;
  liveAttendeeCount?: number;
  lastCheckInTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CheckInRecord {
  userId: string;
  eventId: string;
  timestamp: Date;
  checkedInAt: string;
}

export interface AttendeeInfo {
  userId: string;
  userName: string;
  userEmail: string;
  checkedInAt: string;
}

export interface CheckInResponse {
  success: boolean;
  message: string;
  timestamp?: string;
}
