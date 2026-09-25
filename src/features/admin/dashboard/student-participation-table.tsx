"use client";

import { useMemo, useState } from "react";

import {
  STAFF_PARTICIPANT_GRADE,
  type AdminStudentSummary,
} from "@/shared/contracts";

import styles from "./teacher-dashboard.module.css";

const STATUS_LABELS: Record<AdminStudentSummary["participationStatus"], string> = {
  completed: "완주",
  completedToday: "오늘 완료",
  missingToday: "오늘 미참여",
  noRecord: "아직 기록 없음",
};

const sortedUnique = (values: string[]) => [...new Set(values)]
  .sort((left, right) => left.localeCompare(right, "ko-KR", { numeric: true }));
const isStaff = (student: AdminStudentSummary) => student.grade === STAFF_PARTICIPANT_GRADE;

type StudentParticipationTableProps = {
  students: AdminStudentSummary[];
  deletingStudentId?: string;
  onDelete?: (student: AdminStudentSummary) => void;
};

export function StudentParticipationTable({ students, deletingStudentId, onDelete }: StudentParticipationTableProps) {
  const [grade, setGrade] = useState("");
  const [classNo, setClassNo] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const grades = useMemo(() => sortedUnique(students.map((student) => student.grade)), [students]);
  const classes = useMemo(() => sortedUnique(students
    .filter((student) => !grade || student.grade === grade)
    .map((student) => student.classNo)), [grade, students]);
  const staffDepartments = useMemo(() => new Set(students
    .filter(isStaff)
    .map((student) => student.classNo)), [students]);
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const visible = students.filter((student) => {
    const searchable = `${student.name} ${student.studentNo} ${student.classNo}`.toLocaleLowerCase("ko-KR");
    return (!grade || student.grade === grade)
      && (!classNo || student.classNo === classNo)
      && (!status || student.participationStatus === status)
      && (!normalizedQuery || searchable.includes(normalizedQuery));
  });

  return (
    <section className={styles.panel} aria-labelledby="student-status-title">
      <div className={styles.sectionHeading}>
        <div><p className={styles.eyebrow}>참여자 대시보드</p><h2 id="student-status-title">참여 현황</h2></div>
        <strong>{visible.length}명 표시</strong>
      </div>
      <div className={styles.filters}>
        <label>구분·학년 필터
          <select value={grade} onChange={(event) => { setGrade(event.target.value); setClassNo(""); }}>
            <option value="">전체</option>
            {grades.map((value) => <option key={value} value={value}>{value === STAFF_PARTICIPANT_GRADE ? value : `${value}학년`}</option>)}
          </select>
        </label>
        <label>반·부서 필터
          <select value={classNo} onChange={(event) => setClassNo(event.target.value)}>
            <option value="">전체</option>
            {classes.map((value) => <option key={value} value={value}>{grade === STAFF_PARTICIPANT_GRADE || staffDepartments.has(value) ? value : `${value}반`}</option>)}
          </select>
        </label>
        <label>참여 상태 필터
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">전체 상태</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>참여자 검색
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름, 번호 또는 부서" />
        </label>
      </div>
      <div className={styles.tableWrap}>
        <table>
          <thead><tr><th>참여자</th><th>스탬프 횟수</th><th>상태</th><th>최근 참여일</th>{onDelete && <th>관리</th>}</tr></thead>
          <tbody>
            {visible.map((student) => (
              <tr key={student.studentId}>
                <td><strong>{student.name}</strong><span>{isStaff(student) ? `교직원 · ${student.classNo}` : `${student.grade}학년 ${student.classNo}반 ${student.studentNo}번`}</span></td>
                <td>스탬프 {student.acceptedDays} / {student.targetDays}개</td>
                <td><span className={`${styles.statusBadge} ${styles[student.participationStatus]}`}>{STATUS_LABELS[student.participationStatus]}</span></td>
                <td>{student.lastParticipationDate ?? "-"}</td>
                {onDelete && (
                  <td>
                    <button
                      className={styles.deleteButton}
                      type="button"
                      disabled={Boolean(deletingStudentId)}
                      aria-label={`${student.name} 참여자 삭제`}
                      onClick={() => onDelete(student)}
                    >
                      {deletingStudentId === student.studentId ? "삭제 중…" : "삭제"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <p className={styles.empty}>조건에 맞는 참여자가 없습니다.</p>}
      </div>
    </section>
  );
}
