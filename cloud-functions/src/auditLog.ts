import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Determines the action type from before/after existence.
 */
function getAction(
    beforeExists: boolean, afterExists: boolean,
): 'create' | 'update' | 'delete' {
  if (!beforeExists && afterExists) return 'create';
  if (beforeExists && !afterExists) return 'delete';
  return 'update';
}

/**
 * Extracts the userId based on action type and document data.
 */
function getUserId(
    action: 'create' | 'update' | 'delete',
    beforeData: admin.firestore.DocumentData | undefined,
    afterData: admin.firestore.DocumentData | undefined,
): string | null {
  if (action === 'create' && afterData) {
    return afterData.createdBy || afterData.updatedBy || null;
  }
  if (action === 'update' && afterData) {
    return afterData.updatedBy || afterData.createdBy || null;
  }
  if (action === 'delete' && beforeData) {
    return beforeData.updatedBy || beforeData.createdBy || null;
  }
  return null;
}

/**
 * Firestore trigger that logs all create, update, and delete operations
 * across collections into the `auditLog` admin-only collection.
 *
 * It prevents self-triggering by explicitly checking that the collection
 * is not 'auditLog'.
 */
export const auditLog = functions.firestore
    .document('{collectionId}/{docId}')
    .onWrite(async (change, context) => {
      const collection = context.params.collectionId;

      // Prevent self-triggering recursion
      if (collection === 'auditLog') {
        return;
      }

      const beforeExists = change.before?.exists ?? false;
      const afterExists = change.after?.exists ?? false;

      const beforeData = beforeExists ? change.before.data() : undefined;
      const afterData = afterExists ? change.after.data() : undefined;

      const action = getAction(beforeExists, afterExists);
      const userId = getUserId(action, beforeData, afterData);

      const logEntry = {
        timestamp: FieldValue.serverTimestamp(),
        userId,
        action,
        collection,
        documentId: context.params.docId,
        before: beforeData || null,
        after: afterData || null,
      };

      try {
        await admin.firestore().collection('auditLog').add(logEntry);
      } catch (error) {
        console.error('Failed to write audit log entry:', error);
      }
    });
