/// <reference types="jest" />

import fs from "fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";

import {
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";

let testEnv: Awaited<ReturnType<typeof initializeTestEnvironment>>;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "uni-event-test",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: fs.readFileSync("firestore.rules", "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("Firestore Security Rules", () => {
  // ---------------- EVENTS ----------------

  test("Unauthenticated user reads /events -> allowed", async () => {
    const db = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(
      getDoc(doc(db, "events/event1"))
    );
  });

  test("Unauthenticated user writes /events -> denied", async () => {
    const db = testEnv.unauthenticatedContext().firestore();

    await assertFails(
      setDoc(doc(db, "events/event1"), {
        title: "Hackathon",
      })
    );
  });

  test("Club admin creates event -> allowed", async () => {
    const db = testEnv
      .authenticatedContext("clubAdmin1", {
        club: true,
      })
      .firestore();

    await assertSucceeds(
      setDoc(doc(db, "events/event1"), {
        title: "Tech Fest",
        ownerId: "clubAdmin1",
      })
    );
  });

  test("Student tries to create event -> denied", async () => {
    const db = testEnv
      .authenticatedContext("student1")
      .firestore();

    await assertFails(
      setDoc(doc(db, "events/event1"), {
        title: "Unauthorized Event",
      })
    );
  });

  test("Admin updates any event -> allowed", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();

      await setDoc(doc(adminDb, "events/event1"), {
        title: "Original Event",
        ownerId: "owner123",
      });
    });

    const db = testEnv
      .authenticatedContext("admin1", {
        admin: true,
      })
      .firestore();

    await assertSucceeds(
      setDoc(
        doc(db, "events/event1"),
        {
          title: "Updated By Admin",
        },
        { merge: true }
      )
    );
  });

  // ---------------- USERS ----------------

  test("Student reads own /users/{uid} doc -> allowed", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      await setDoc(doc(db, "users/student1"), {
        name: "Hasti",
      });
    });

    const db = testEnv
      .authenticatedContext("student1")
      .firestore();

    await assertSucceeds(
      getDoc(doc(db, "users/student1"))
    );
  });

  test("Student reads another user's doc -> denied", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      await setDoc(doc(db, "users/student2"), {
        name: "Another User",
      });
    });

    const db = testEnv
      .authenticatedContext("student1")
      .firestore();

    await assertFails(
      getDoc(doc(db, "users/student2"))
    );
  });

  // ---------------- CLUBS ----------------

  test("Non-admin creates club -> denied", async () => {
    const db = testEnv
      .authenticatedContext("student1")
      .firestore();

    await assertFails(
      setDoc(doc(db, "clubs/club1"), {
        name: "Chess Club",
      })
    );
  });

  test("Admin creates club -> allowed", async () => {
    const db = testEnv
      .authenticatedContext("admin1", {
        admin: true,
      })
      .firestore();

    await assertSucceeds(
      setDoc(doc(db, "clubs/club1"), {
        name: "Chess Club",
      })
    );
  });

  // ---------------- REMINDERS ----------------

  test("User creates own reminder -> allowed", async () => {
    const db = testEnv
      .authenticatedContext("student1")
      .firestore();

    await assertSucceeds(
      setDoc(doc(db, "reminders/rem1"), {
        userId: "student1",
        text: "Attend seminar",
      })
    );
  });

  test("User creates reminder for another user -> denied", async () => {
    const db = testEnv
      .authenticatedContext("student1")
      .firestore();

    await assertFails(
      setDoc(doc(db, "reminders/rem1"), {
        userId: "student2",
        text: "Unauthorized reminder",
      })
    );
  });

  // ---------------- ADMIN ----------------

  test("Admin reads /admin doc -> allowed", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      await setDoc(doc(db, "admin/config"), {
        maintenance: false,
      });
    });

    const db = testEnv
      .authenticatedContext("admin1", {
        admin: true,
      })
      .firestore();

    await assertSucceeds(
      getDoc(doc(db, "admin/config"))
    );
  });

  test("Non-admin reads /admin doc -> denied", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      await setDoc(doc(db, "admin/config"), {
        maintenance: false,
      });
    });

    const db = testEnv
      .authenticatedContext("student1")
      .firestore();

    await assertFails(
      getDoc(doc(db, "admin/config"))
    );
  });
});