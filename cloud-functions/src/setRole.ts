import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { checkRateLimit, RATE_LIMITS } from "./middleware/rateLimiter";

/**
 * Sets the role for a user.
 * Restricted to admins.
 * Payload: { uid: string, role: 'admin' | 'club' | 'student' }
 * 
 * Note: Rate limiting is applied to this function as part of a phased rollout.
 * Other callable functions (calculateReputation, getTopContributors, sendDailyDigest)
 * will have rate limiting added in future updates as needed.
 */
export const setRole = functions.https.onCall(async (data, context) => {
  // Check if caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  // Check if caller is admin BEFORE rate limiting
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only admins can set roles."
    );
  }

  // Apply rate limiting after auth checks
  await checkRateLimit(context.auth.uid, "setRole", RATE_LIMITS.ADMIN_WRITE);

  const { uid, role } = data;

  if (!uid || !role) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function must be called with 'uid' and 'role' arguments."
    );
  }

  // Validate role
  const validRoles = ["admin", "club", "student"];
  if (!validRoles.includes(role)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `Role must be one of: ${validRoles.join(", ")}`
    );
  }

  const claims: { [key: string]: boolean } = {};
  if (role === "admin") claims.admin = true;
  if (role === "club") claims.club = true;
  // Student role implies no special claims

  try {
    // Set custom user claims
    await admin.auth().setCustomUserClaims(uid, claims);

    // Update user document in Firestore for easy client-side access (optional but recommended)
    await admin.firestore().collection("users").doc(uid).set(
      { role },
      { merge: true }
    );

    return { success: true };
  } catch (error) {
    throw new functions.https.HttpsError("internal", "Error setting role");
  }
});
