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
exports.logger = void 0;
exports.logEntry = logEntry;
exports.logError = logError;
const winston = __importStar(require("winston"));
const { combine, timestamp, json, errors } = winston.format;
exports.logger = winston.createLogger({
    level: 'info',
    format: combine(errors({ stack: true }), timestamp(), json()),
    defaultMeta: { service: 'uni-event' },
    transports: [new winston.transports.Console()],
});
function logEntry(service, message, context) {
    exports.logger.info({
        message,
        service,
        timestamp: new Date().toISOString(),
        userId: context?.userId ?? null,
        eventId: context?.eventId ?? null,
        requestId: context?.requestId ?? null,
        context: context?.input ?? null,
        output: context?.output ?? null,
        stack: context?.stack ?? null,
    });
}
function logError(service, message, error, context) {
    let errorMessage = 'unknown error';
    let stack = null;
    if (error instanceof Error) {
        errorMessage = error.message;
        stack = error.stack ?? null;
    }
    else if (typeof error === 'string') {
        errorMessage = error;
    }
    else if (error && typeof error === 'object') {
        try {
            errorMessage = JSON.stringify(error);
        }
        catch (_) {
            errorMessage = '[unserializable error object]';
        }
    }
    exports.logger.error({
        message,
        errorMessage,
        service,
        timestamp: new Date().toISOString(),
        userId: context?.userId ?? null,
        eventId: context?.eventId ?? null,
        requestId: context?.requestId ?? null,
        context: context?.context ?? null,
        stack,
    });
}
