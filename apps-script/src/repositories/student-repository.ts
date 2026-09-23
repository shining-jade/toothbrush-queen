import type { SheetGateway } from "../platform/sheet-gateway";

export type StudentRow = {
  studentId: string;
  challengeId: string;
  grade: string;
  classNo: string;
  studentNo: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: "active" | "inactive";
};

const normalize = (value: string) => value.trim().normalize("NFC").toLocaleLowerCase("ko-KR");

const toRow = (value: StudentRow): unknown[] => [
  value.studentId,
  value.challengeId,
  value.grade,
  value.classNo,
  value.studentNo,
  value.name,
  value.createdAt,
  value.updatedAt,
  value.status,
];

const fromRow = (row: unknown[]): StudentRow => ({
  studentId: String(row[0]), challengeId: String(row[1]), grade: String(row[2]),
  classNo: String(row[3]), studentNo: String(row[4]), name: String(row[5]),
  createdAt: String(row[6]), updatedAt: String(row[7]), status: String(row[8]) as StudentRow["status"],
});

export class StudentRepository {
  constructor(private readonly gateway: SheetGateway) {}

  insert(value: StudentRow) {
    this.gateway.append("Students", toRow(value));
    return value;
  }

  findById(studentId: string) {
    const row = this.gateway.readAll("Students").find((candidate) => String(candidate[0]) === studentId);
    return row ? fromRow(row) : null;
  }

  findByIdentity(challengeId: string, grade: string, classNo: string, studentNo: string, name: string) {
    const identity = [challengeId, grade, classNo, studentNo, name].map(normalize);
    const row = this.gateway.readAll("Students").find((candidate) =>
      [candidate[1], candidate[2], candidate[3], candidate[4], candidate[5]]
        .map((value) => normalize(String(value)))
        .every((value, index) => value === identity[index]),
    );
    return row ? fromRow(row) : null;
  }
}
