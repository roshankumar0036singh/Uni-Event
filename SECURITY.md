# Security Policy

## Supported Versions

Use this section to tell people about which versions of your project are
currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of this project seriously. If you have discovered a security vulnerability, we appreciate your help in disclosing it to us in a responsible manner.

### How to Report

Please include the following details in your report:
*   A description of the vulnerability.
*   Steps to reproduce the vulnerability.
*   Any relevant logs or screenshots.

### Response Timeline

*   We will acknowledge receipt of your report within 48 hours.
*   We will provide a status update every 5 days.
*   We aim to fix critical vulnerabilities within 14 days.

## Cloud Function Authorization

All callable (`onCall`) Cloud Functions enforce authentication and role-based access:

| Function | Auth Required | Claims Required |
|----------|---------------|-----------------|
| `setRole` | Yes | `admin` |
| `calculateReputation` | Yes | `admin` |
| `backfillEventAnalyticsCounters` | Yes | `admin` |
| `sendDailyDigest` | Yes | `admin` |
| `getTopContributors` | Yes | None (any authenticated user) |

Express routes (`server.ts`) use a Firebase ID token verification middleware and enforce the same claim checks before processing requests.

Thank you for helping keep the community safe!
