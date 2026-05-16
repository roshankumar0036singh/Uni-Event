import {
  sendEmail,
  sendBulkAnnouncement,
  sendBulkFeedbackRequest,
  sendBulkCertificates,
} from "../EmailService";

global.fetch = jest.fn();

const mockUser = {
  name: "Test User",
  email: "test@example.com",
};

const mockParticipants = [
  mockUser,
];

describe("EmailService", () => {

  beforeEach(() => {

    fetch.mockClear();

    jest
      .spyOn(console, "log")
      .mockImplementation(() => {});

    jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("sendEmail returns true on success", async () => {

    fetch.mockResolvedValueOnce({
      ok: true,
    });

    const result = await sendEmail(
      mockUser.name,
      mockUser.email,
      "Hello",
      "Test message"
    );

    expect(result).toBe(true);

    expect(fetch).toHaveBeenCalled();
  });

  test("sendEmail returns false on API failure", async () => {

    fetch.mockResolvedValueOnce({
      ok: false,
      text: jest.fn().mockResolvedValue("API Error"),
    });

    const result = await sendEmail(
      mockUser.name,
      mockUser.email,
      "Hello",
      "Test message"
    );

    expect(result).toBe(false);

    expect(console.error).toHaveBeenCalled();
  });

  test("sendEmail returns false on network error", async () => {

    fetch.mockRejectedValueOnce(
      new Error("Network failure")
    );

    const result = await sendEmail(
      mockUser.name,
      mockUser.email,
      "Hello",
      "Test message"
    );

    expect(result).toBe(false);

    expect(console.error).toHaveBeenCalled();
  });

  test("sendBulkAnnouncement sends emails", async () => {

    fetch.mockResolvedValue({
      ok: true,
    });

    const participants = [
      mockUser,
      {
        name: "Another User",
        email: "another@example.com",
      },
    ];

    const result =
      await sendBulkAnnouncement(
        participants,
        "Announcement",
        "Message"
      );

    expect(result).toBe(2);

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test("sendBulkFeedbackRequest sends feedback emails", async () => {

    fetch.mockResolvedValue({
      ok: true,
    });

    const result =
      await sendBulkFeedbackRequest(
        mockParticipants,
        "Tech Fest",
        "event123"
      );

    expect(result).toBe(1);
  });

  test("sendBulkCertificates sends certificates", async () => {

    fetch.mockResolvedValue({
      ok: true,
    });

    const result =
      await sendBulkCertificates(
        mockParticipants,
        "Hackathon",
        new Date().toLocaleDateString(),
        "https://example.com"
      );

    expect(result).toBe(1);
  });

  test("skips participants without email", async () => {

    fetch.mockResolvedValue({
      ok: true,
    });

    const participants = [
      {
        name: "No Email User",
      },
    ];

    const result =
      await sendBulkAnnouncement(
        participants,
        "Announcement",
        "Message"
      );

    expect(result).toBe(0);

    expect(fetch).not.toHaveBeenCalled();
  });

});