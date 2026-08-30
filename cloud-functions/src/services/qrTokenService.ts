import * as crypto from 'crypto';

/**
 * Service for generating and managing QR code tokens
 */
export class QRTokenService {
  /**
   * Generate a unique, secure QR token for event check-in
   */
  static generateToken(eventId: string): string {
    // Combine event ID with random bytes for uniqueness
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now().toString(36);

    // Create hash of combination
    const combined = `${eventId}-${randomBytes}-${timestamp}`;
    const token = crypto
      .createHash('sha256')
      .update(combined)
      .digest('hex')
      .substring(0, 32);

    return token;
  }

  /**
   * Validate token format (basic check)
   */
  static isValidTokenFormat(token: string): boolean {
    return /^[a-f0-9]{32}$/.test(token);
  }

  /**
   * Generate check-in URL for QR code
   */
  static generateCheckInUrl(eventId: string, token: string, baseUrl = 'https://uni-event.app'): string {
    return `${baseUrl}/events/${eventId}/checkin?token=${token}`;
  }
}

export default QRTokenService;
