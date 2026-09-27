import * as XLSX from 'xlsx';
import {
  CurriculumEntry,
  LessonLogEntry,
  TeacherProfile,
  TimetableSlot,
  Weekday,
} from '../types';
import { formatDateVN, WEEKDAYS } from './dateUtils';

/**
 * Downloads a binary blob as a file in browser
 */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Exports Weekly Lesson Log to styled Excel (.xlsx) file
 */
export function exportLessonLogToExcel(params: {
  logs: LessonLogEntry[];
  profile: TeacherProfile;
  weekNumber: number;
  dateRangeStr: string;
}) {
  const { logs, profile, weekNumber, dateRangeStr } = params;

  const wb = XLSX.utils.book_new();

  // Prepare header info
  const wsData: (string | number)[][] = [
    [profile.school.toUpperCase(), '', '', '', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'],
    [profile.department.toUpperCase(), '', '', '', 'Độc lập - Tự do - Hạnh phúc'],
    ['', '', '', '', '------------------------'],
    [],
    [`LỊCH BÁO GIẢNG NĂM HỌC ${profile.schoolYear}`],
    [`TUẦN ${weekNumber} (${dateRangeStr})`],
    [`Giáo viên: ${profile.teacherName} | Tổ: ${profile.department}`],
    [],
    // Table Header
    [
      'STT',
      'Ngày',
      'Thứ',
      'Buổi',
      'Tiết',
      'Môn học',
      'Lớp',
      'Tiết PPCT',
      'Tên bài dạy / Nội dung công việc',
      'Điều chỉnh / Ghi chú',
      'Trạng thái',
    ],
  ];

  // Populate row data
  logs.forEach((log, index) => {
    const weekdayObj = WEEKDAYS.find((w) => w.key === log.weekday);
    const weekdayLabel = weekdayObj ? weekdayObj.label : `Thứ ${log.weekday}`;
    const sessionLabel = log.session === 'morning' ? 'Sáng' : 'Chiều';
    const statusLabel =
      log.status === 'taught'
        ? 'Đã dạy'
        : log.status === 'adjusted'
        ? 'Có điều chỉnh'
        : log.status === 'cancelled'
        ? 'Hủy / Nghỉ'
        : 'Chưa dạy';

    wsData.push([
      index + 1,
      formatDateVN(log.date),
      weekdayLabel,
      sessionLabel,
      log.period,
      log.subject,
      log.className || '-',
      log.curriculumPeriod ?? '-',
      log.lessonTitle,
      log.adjustment || '',
      statusLabel,
    ]);
  });

  // Calculate totals
  const total = logs.length;
  const taught = logs.filter((l) => l.status === 'taught').length;
  const pending = logs.filter((l) => l.status === 'pending').length;

  wsData.push([]);
  wsData.push([
    '',
    `TỔNG CỘNG: ${total} tiết (Đã dạy: ${taught} tiết | Chưa dạy: ${pending} tiết)`,
  ]);
  wsData.push([]);
  wsData.push([]);

  // Signing block
  wsData.push([
    '',
    'NGƯỜI DUYỆT BÁO GIẢNG',
    '',
    '',
    '',
    '',
    '',
    'GIÁO VIÊN BÁO GIẢNG',
  ]);
  wsData.push([
    '',
    `(${profile.reviewerTitle})`,
    '',
    '',
    '',
    '',
    '',
    '(Ký và ghi rõ họ tên)',
  ]);
  wsData.push([]);
  wsData.push([]);
  wsData.push(['', profile.reviewer, '', '', '', '', '', profile.teacherName]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 6 }, // STT
    { wch: 12 }, // Ngày
    { wch: 11 }, // Thứ
    { wch: 8 }, // Buổi
    { wch: 6 }, // Tiết
    { wch: 14 }, // Môn
    { wch: 10 }, // Lớp
    { wch: 10 }, // Tiết PPCT
    { wch: 45 }, // Tên bài dạy
    { wch: 25 }, // Điều chỉnh
    { wch: 14 }, // Trạng thái
  ];

  XLSX.utils.book_append_sheet(wb, ws, `Báo giảng T${weekNumber}`);

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, `BaoGiang_Tuan${weekNumber}_${profile.teacherName.replace(/\s+/g, '_')}.xlsx`);
}

/**
 * Exports Curriculum (PPCT) to Excel (.xlsx) file
 */
export function exportCurriculumToExcel(curriculum: CurriculumEntry[]) {
  const wb = XLSX.utils.book_new();

  const data = curriculum.map((c) => ({
    'Môn học': c.subject,
    'Khối': c.grade,
    'Tiết PPCT': c.periodNumber,
    'Tên bài dạy': c.lessonTitle,
    'Học kỳ': c.semester,
    'Phân loại': c.category || '',
    'Ghi chú': c.note || '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 14 },
    { wch: 8 },
    { wch: 10 },
    { wch: 45 },
    { wch: 12 },
    { wch: 16 },
    { wch: 25 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Phân phối chương trình');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, 'PhanPhoiChuongTrinh.xlsx');
}

/**
 * Exports Timetable (TKB) grid to Excel
 */
export function exportTimetableToExcel(
  timetable: TimetableSlot[],
  weekNumber: number,
  includeSaturday: boolean = false
) {
  const wb = XLSX.utils.book_new();
  const weekSlots = timetable.filter((s) => s.weekNumber === weekNumber);

  const days: Weekday[] = includeSaturday ? [2, 3, 4, 5, 6, 7] : [2, 3, 4, 5, 6];
  const dayHeaders = days.map((d) => {
    const w = WEEKDAYS.find((item) => item.key === d);
    return w ? w.label : `Thứ ${d}`;
  });

  const wsData: (string | number)[][] = [
    [`THỜI KHÓA BIỂU TUẦN ${weekNumber}`],
    [],
    ['Buổi', 'Tiết', ...dayHeaders],
  ];

  // Morning periods 1..5
  for (let p = 1; p <= 5; p++) {
    const row: (string | number)[] = ['Sáng', p];
    for (const d of days) {
      const slot = weekSlots.find(
        (s) => s.weekday === d && s.session === 'morning' && s.period === p
      );
      row.push(slot ? slot.rawText || `${slot.className}-${slot.subject}` : '');
    }
    wsData.push(row);
  }

  // Afternoon periods 1..5
  for (let p = 1; p <= 5; p++) {
    const row: (string | number)[] = ['Chiều', p];
    for (const d of days) {
      const slot = weekSlots.find(
        (s) => s.weekday === d && s.session === 'afternoon' && s.period === p
      );
      row.push(slot ? slot.rawText || `${slot.className}-${slot.subject}` : '');
    }
    wsData.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 10 }, { wch: 8 }, ...days.map(() => ({ wch: 18 }))];

  XLSX.utils.book_append_sheet(wb, ws, `TKB Tuần ${weekNumber}`);

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, `ThoiKhoaBieu_Tuan${weekNumber}.xlsx`);
}

/**
 * Generates sample Excel templates for users to download
 */
export function downloadSampleCurriculumTemplate() {
  const wb = XLSX.utils.book_new();

  const sampleData = [
    {
      'Môn': 'Toán',
      'Khối': 10,
      'Tiết PPCT': 1,
      'Tên đầu bài dạy': 'Bài 1: Mệnh đề (Tiết 1)',
      'Học kỳ': 'Học kỳ I',
      'Phân loại': 'Đại số',
      'Ghi chú': 'Bài học đầu tiên',
    },
    {
      'Môn': 'Toán',
      'Khối': 10,
      'Tiết PPCT': 2,
      'Tên đầu bài dạy': 'Bài 1: Mệnh đề (Tiết 2)',
      'Học kỳ': 'Học kỳ I',
      'Phân loại': 'Đại số',
      'Ghi chú': '',
    },
    {
      'Môn': 'Toán',
      'Khối': 12,
      'Tiết PPCT': 1,
      'Tên đầu bài dạy': 'Bài 1: Tính đơn điệu của hàm số (Tiết 1)',
      'Học kỳ': 'Học kỳ I',
      'Phân loại': 'Giải tích',
      'Ghi chú': '',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  ws['!cols'] = [
    { wch: 12 },
    { wch: 8 },
    { wch: 10 },
    { wch: 45 },
    { wch: 12 },
    { wch: 14 },
    { wch: 20 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Mau_PPCT');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, 'Mau_Nhap_PPCT.xlsx');
}

export function downloadSampleTimetableTemplate() {
  const wb = XLSX.utils.book_new();

  const wsData = [
    ['Buổi', 'Tiết', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'],
    ['Sáng', 1, 'Chào cờ', '12B1-Toán', '', '12B1-Toán', '12B6-Toán'],
    ['Sáng', 2, '10A8-HĐTN-HN', '12B1-Toán', '10A11-Toán', '12B1-Toán', '10A11-Toán'],
    ['Sáng', 3, '10A8-Toán', '12B6-Toán', '10A11-Toán', '', ''],
    ['Sáng', 4, '10A8-Toán', '12B6-Toán', '', '10A8-Toán', ''],
    ['Sáng', 5, '', '', '', '', 'Sinh hoạt lớp'],
    ['Chiều', 1, '', '', '10A8-Ôn Toán', '', ''],
    ['Chiều', 2, '', '', '10A8-Ôn Toán', '', ''],
    ['Chiều', 3, '', '', '', '', ''],
    ['Chiều', 4, '', '', '', '', ''],
    ['Chiều', 5, '', '', '', '', ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [
    { wch: 10 },
    { wch: 8 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Mau_TKB');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, 'Mau_Nhap_ThoiKhoaBieu.xlsx');
}
