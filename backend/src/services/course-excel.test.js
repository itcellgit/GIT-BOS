import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { MAX_UNPACKED_BYTES, zipUncompressedSize } from "./course-excel.js";

describe("Excel upload size check (zip bombs)", () => {
  it("reads the unpacked size of a real workbook", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Courses").addRow(["Semester", "Course Code"]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const size = zipUncompressedSize(buf);
    expect(size).toBeGreaterThan(buf.length / 10);
    expect(size).toBeLessThan(MAX_UNPACKED_BYTES);
  });

  it("reports a file that is not a zip as unreadable", () => {
    expect(zipUncompressedSize(Buffer.from("not a workbook at all, just some text"))).toBeNull();
  });

  it("reports a huge declared size", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Courses").addRow(["x"]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    // Declare the first entry of the central directory as 4 GB − 2 bytes.
    const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    const cd = buf.readUInt32LE(eocd + 16);
    buf.writeUInt32LE(0xfffffffe, cd + 24);
    expect(zipUncompressedSize(buf)).toBeGreaterThan(MAX_UNPACKED_BYTES);
  });
});
