import { exportParticipantsToExcel }
  from "../ExportService.web";

import * as XLSX from "xlsx";

jest.mock("xlsx", () => ({
  utils: {
    json_to_sheet: jest.fn(),
    book_new: jest.fn(),
    book_append_sheet: jest.fn(),
  },

  writeFile: jest.fn(),
}));

describe("ExportService.web", () => {

  beforeEach(() => {

    jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("exports participants successfully", async () => {

    XLSX.utils.json_to_sheet.mockReturnValue(
      "worksheet"
    );

    XLSX.utils.book_new.mockReturnValue(
      "workbook"
    );

    const participants = [
      {
        name: "Arpita",
        email: "arpita@test.com",
        branch: "CS",
        year: "3",
        joinedAt: Date.now(),
        userId: "user1",
      },
    ];

    await exportParticipantsToExcel(
      participants,
      "Tech Fest 2026"
    );

    expect(
      XLSX.utils.json_to_sheet
    ).toHaveBeenCalled();

    expect(
      XLSX.utils.book_append_sheet
    ).toHaveBeenCalled();

    expect(
      XLSX.writeFile
    ).toHaveBeenCalled();
  });

  test("handles missing participant fields", async () => {

    XLSX.utils.json_to_sheet.mockReturnValue(
      "worksheet"
    );

    XLSX.utils.book_new.mockReturnValue(
      "workbook"
    );

    const participants = [
      {},
    ];

    await exportParticipantsToExcel(
      participants,
      "Event"
    );

    expect(
      XLSX.writeFile
    ).toHaveBeenCalled();
  });

  test("throws error when export fails", async () => {

    XLSX.utils.json_to_sheet.mockImplementationOnce(
      () => {
        throw new Error("XLSX failure");
      }
    );

    await expect(
      exportParticipantsToExcel(
        [],
        "Test Event"
      )
    ).rejects.toThrow(
      "Failed to generate Excel file."
    );

    expect(console.error).toHaveBeenCalled();
  });

});
