"use client";

import { useMemo, useState } from "react";

import type { AdminStudentSummary } from "@/shared/contracts";

import styles from "./teacher-dashboard.module.css";

const STATUS_LABELS: Record<AdminStudentSummary["participationStatus"], string> = {
  completed: "완주",
  completedToday: "오늘 완료",
  missingToday: "오늘 미참여",
  noRecord: "아직 기록 없음",
};

const sortedUnique = (values: string[]) => [...new Set(values)]
  .sort((left, right) => left.localeCompare(right, "ko-KR", { numeric: true }));

export function StudentParticipationTable({ students }: { students: AdminStudentSummary[] }) {
  const [grade, setGrade] = useState("");
  const [classNo, setClassNo] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const grades = useMemo(() => sortedUnique(students.map((student) => student.grade)), [students]);
  const classes = useMemo(() => sortedUnique(students
    .filter((student) => !grade || student.grade === grade)
    .map((student) => student.classNo)), [grade, students]);
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const visible = students.filter((student) => {
    const searchable = `${student.name} ${student.studentNo}`.toLocaleLowerCase("ko-KR");
    return (!grade || student.grade === grade)
      && (!classNo || student.classNo === classNo)
      && (!status || student.participationStatus === status)
      && (!normalizedQuery || searchable.includes(normalizedQuery));
  });

  return (
    <section className={styles.panel} aria-labelledby="student-status-title">
      <div className={styles.sectionHeading}>
        <div><p className={styles.eyebrow}>학생 대시보드</p><h2 id="student-status-title">참여 현황</h2></div>
        <strong>{visible.length}명 표시</strong>
      </div>
      <div className={styles.filters}>
        <label>학년 필터
          <select value={grade} onChange={(event) => { setGrade(event.target.value); setClassNo(""); }}>
            <option value="">전체 학년</option>
            {grades.map((value) => <option key={value} value={value}>{value}학년</option>)}
          </select>
        </label>
        <label>반 필터
          <select value={classNo} onChange={(event) => setClassNo(event.target.value)}>
            <option value="">전체 반</option>
            {classes.map((value) => <option key={value} value={value}>{value}반</option>)}
          </select>
        </label>
        <label>참여 상태 필터
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">전체 상태</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>학생 검색
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름 또는 번호" />
        </label>
      </div>
      <div className={styles.tableWrap}>
        <table>
          <thead><tr><th>학생</th><th>도장</th><th>상태</th><th>최근 참여일</th></tr></thead>
          <tbody>
            {visible.map((student) => (
              <tr key={student.studentId}>
                <td><strong>{student.name}</strong><span>{student.grade}학년 {student.classNo}반 {student.studentNo}번</span></td>
                <td>{student.acceptedDays} / {student.targetDays}일</td>
                <td><span className={`${styles.statusBadge} ${styles[student.participationStatus]}`}>{STATUS_LABELS[student.participationStatus]}</span></td>
                <td>{student.lastParticipationDate ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <p className={styles.empty}>조건에 맞는 학생이 없습니다.</p>}
      </div>
    </section>
  );
}
