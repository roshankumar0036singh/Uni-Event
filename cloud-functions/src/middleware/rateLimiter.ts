import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export const RATE_LIMITS = {
  ADMIN_WRITE: {
    windowMs: 60 * 1000,
    maxRequests: 10
  },
  WRITE: {
    windowMs: 60 * 1000,
    maxRequests: 20
  },
  READ: {
    windowMs: 60 * 1000,
    maxRequests: 100
  }
};

export async function checkRateLimit(
  userId: string,
  functionName: string,
  config: RateLimitConfig
): Promise<void> {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  
  const rateLimitRef = admin.firestore()
    .collection("rateLimits")
    .doc(`${userId}_${functionName}`);
  
  try {
    await admin.firestore().runTransaction(async (transaction) => {
      const doc = await transaction.get(rateLimitRef);
      
      if (doc.exists) {
        const data = doc.data();
        
        if (data?.requests) {
          const recentRequests = (data.requests as number[])
            .filter((timestamp: number) => timestamp > windowStart);
          
          if (recentRequests.length >= config.maxRequests) {
            const oldestRequest = recentRequests[0];
            const retryAfterMs = oldestRequest + config.windowMs - now;
            const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
            
            console.warn("Rate limit exceeded", {
              userId,
              functionName,
              retryAfterSeconds,
              maxRequests: config.maxRequests,
              windowSeconds: config.windowMs / 1000,
              docId: rateLimitRef.id
            });
            
            throw new functions.https.HttpsError(
              "resource-exhausted",
              `Rate limit exceeded. You can try again in ${retryAfterSeconds} seconds.`,
              {
                retryAfter: retryAfterSeconds,
                limit: config.maxRequests,
                window: config.windowMs / 1000
              }
            );
          }
          
          recentRequests.push(now);
          transaction.set(rateLimitRef, {
            requests: recentRequests,
            lastUpdated: now
          });
        } else {
          transaction.set(rateLimitRef, {
            requests: [now],
            lastUpdated: now
          });
        }
      } else {
        transaction.set(rateLimitRef, {
          requests: [now],
          lastUpdated: now
        });
      }
    });
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    console.error("Rate limit check failed:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Rate limit check failed",
      { message: String(error) }
    );
  }
}


export async function cleanupOldRateLimits(olderThanMs: number = 60 * 60 * 1000): Promise<void> {
  const cutoffTime = Date.now() - olderThanMs;
  let totalDeleted = 0;
  
  while (true) {
    const snapshot = await admin.firestore()
      .collection("rateLimits")
      .where("lastUpdated", "<", cutoffTime)
      .limit(500)
      .get();
    
    if (snapshot.empty) {
      break;
    }
    
    const batch = admin.firestore().batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    totalDeleted += snapshot.size;
  }
  
  if (totalDeleted > 0) {
    console.log(`Cleaned up ${totalDeleted} old rate limit records`);
  }
}
