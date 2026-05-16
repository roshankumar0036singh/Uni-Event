import {
  submitFeedback,
  calculateAverageRating,
} from "../feedbackService";

import {
  getDoc,
  writeBatch,
} from "firebase/firestore";

jest.mock("firebase/firestore", () => ({

  doc: jest.fn(),

  getDoc: jest.fn(),

  increment: jest.fn(value => value),

  serverTimestamp: jest.fn(() => "mock-timestamp"),

  writeBatch: jest.fn(),

}));

jest.mock("../firebaseConfig", () => ({
  db: {},
}));

describe("feedbackService", () => {

  let mockBatch;

  beforeEach(() => {

    mockBatch = {
      set: jest.fn(),
      update: jest.fn(),
      commit: jest.fn().mockResolvedValue(),
    };

    writeBatch.mockReturnValue(mockBatch);

    jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    jest
      .spyOn(console, "log")
      .mockImplementation(() => {});
      
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("submits attended feedback successfully", async () => {

    getDoc.mockResolvedValueOnce({
      exists: () => true,
    });

    const result = await submitFeedback({
      feedbackRequestId: "req1",
      eventId: "event1",
      clubId: "club1",
      userId: "user1",
      attended: true,
      eventRating: 5,
      clubRating: 4,
      feedback: "Great event",
    });

    expect(mockBatch.set).toHaveBeenCalled();

    expect(mockBatch.update).toHaveBeenCalled();

    expect(mockBatch.commit).toHaveBeenCalled();

    expect(result).toEqual({
      success: true,
    });
  });

  test("handles no-show attendee feedback", async () => {

    const result = await submitFeedback({
      feedbackRequestId: "req1",
      eventId: "event1",
      clubId: "club1",
      userId: "user1",
      attended: false,
      feedback: "",
    });

    expect(mockBatch.set).toHaveBeenCalled();

    expect(mockBatch.commit).toHaveBeenCalled();

    expect(result).toEqual({
      success: true,
    });
  });

  test("creates reputation if club document does not exist", async () => {

    getDoc.mockResolvedValueOnce({
      exists: () => false,
    });

    await submitFeedback({
      feedbackRequestId: "req1",
      eventId: "event1",
      clubId: "club1",
      userId: "user1",
      attended: true,
      eventRating: 5,
      clubRating: 4,
      feedback: "Nice",
    });

    expect(mockBatch.set).toHaveBeenCalled();
  });

  test("throws error if batch commit fails", async () => {

    getDoc.mockResolvedValueOnce({
      exists: () => true,
    });

    mockBatch.commit.mockRejectedValueOnce(
      new Error("Commit failed")
    );

    await expect(
      submitFeedback({
        feedbackRequestId: "req1",
        eventId: "event1",
        clubId: "club1",
        userId: "user1",
        attended: true,
        eventRating: 5,
        clubRating: 4,
        feedback: "Nice",
      })
    ).rejects.toThrow("Commit failed");
  });

  test("calculates average rating correctly", () => {

    const result = calculateAverageRating({
      totalPoints: 20,
      totalRatings: 4,
    });

    expect(result).toBe("5.0");
  });

  test("returns 0 when no ratings exist", () => {

    expect(
      calculateAverageRating(null)
    ).toBe(0);

    expect(
      calculateAverageRating({
        totalRatings: 0,
      })
    ).toBe(0);
  });

});
