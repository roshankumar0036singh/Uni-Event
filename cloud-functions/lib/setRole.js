"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRole = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
// Assumes admin.initializeApp() is called in index.ts
/**
 * Sets the role for a user.
 * Restricted to admins.
 * Payload: { uid: string, role: 'admin' | 'club' | 'student' }
 */
exports.setRole = functions.https.onCall(async (data, context) => {
    // Check if caller is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    // Check if caller is admin
    // Note: For initial bootstrap, this check might need to be bypassed temporarily or the first admin set manually.
    // We will assume the first admin is set via Firebase Console or script.
    if (!context.auth.token.admin) {
        throw new functions.https.HttpsError("permission-denied", "Only admins can set roles.");
    }
    const { uid, role } = data;
    if (!uid || !role) {
        throw new functions.https.HttpsError("invalid-argument", "The function must be called with 'uid' and 'role' arguments.");
    }
    // Validate role
    const validRoles = ["admin", "club", "student"];
    if (!validRoles.includes(role)) {
        throw new functions.https.HttpsError("invalid-argument", `Role must be one of: ${validRoles.join(", ")}`);
    }
    const claims = {};
    if (role === "admin")
        claims.admin = true;
    if (role === "club")
        claims.club = true;
    // Student role implies no special claims
    try {
        // Set custom user claims
        await admin.auth().setCustomUserClaims(uid, claims);
        // Update user document in Firestore for easy client-side access (optional but recommended)
        await admin.firestore().collection("users").doc(uid).set({ role }, { merge: true });
        return { success: true };
    }
    catch (error) {
        throw new functions.https.HttpsError("internal", "Error setting role", error);
    }
});
//# sourceMappingURL=setRole.js.map