## Description

Fixes #215

This PR resolves a critical data integrity flaw where sequential document writes during event registration and check-ins could result in partial updates (corrupted data) if the network dropped or the app crashed mid-execution.

## Changes Made
- **`app/src/lib/checkInService.js`:** Wrapped the sequential `setDoc` and `updateDoc` calls inside `checkInAttendee` into a single, atomic `writeBatch` transaction. Now, creating the check-in record, updating the ticket status, incrementing event stats, and updating user activity will either entirely succeed together or fail safely without corrupting the state.
- **`app/src/screens/EventRegistrationFormScreen.js`:** Similarly updated the `handleSubmit` logic. Form response saving, event participant additions, user participating list updates, and points/badge awards are now successfully grouped into an atomic `writeBatch` commit. Replaced the `addDoc` call with generating a standard ref (`doc(collection(db, 'registrations'))`) and using `batch.set()` to properly include the dynamic ID inside the transaction.

## GSSoC 2026
This PR is submitted as part of GSSoC 2026. Closes #215.
