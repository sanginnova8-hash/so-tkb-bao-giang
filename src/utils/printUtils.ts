/**
 * Utility functions for printing and PDF generation for Lesson Logs
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { AppSettings, LessonLogEntry, TeacherProfile } from '../types';
import { formatDateVN, getWeekDateRangeVN, WEEKDAYS } from './dateUtils';

export function generatePrintableHTML(params: {
  logs: LessonLogEntry[];
  profile: TeacherProfile;
  settings: AppSettings;
  weekNumber: number;
}): string {
  const { logs, profile, settings, weekNumber } = params;
  const currentWeekLogs = logs.filter((l) => l.weekNumber === weekNumber);
  const weekRange = getWeekDateRangeVN(settings.startMondayDate, weekNumber, settings.includeSaturday);

  const totalCount = currentWeekLogs.length;
  const taughtCount = currentWeekLogs.filter((l) => l.status === 'taught').length;
  const pendingCount = currentWeekLogs.filter((l) => l.status === 'pending').length;

  const rowsHtml =
    currentWeekLogs.length === 0
      ? `<tr><td colspan="9" style="text-align: center; font-style: italic; padding: 24px; color: #64748b;">Chưa có tiết báo giảng nào trong tuần ${weekNumber}</td></tr>`
      : currentWeekLogs
          .map((log, idx) => {
            const weekdayObj = WEEKDAYS.find((w) => w.key === log.weekday);
            const sessionLabel = log.session === 'morning' ? 'S' : 'C';
            return `
            <tr>
              <td style="text-align: center; font-weight: bold; width: 38px;">${idx + 1}</td>
              <td style="text-align: center; white-space: nowrap; width: 75px;">${formatDateVN(log.date)}</td>
              <td style="text-align: center; width: 65px;">${weekdayObj?.shortLabel || `T${log.weekday}`} (${sessionLabel})</td>
              <td style="text-align: center; font-weight: bold; width: 38px;">${log.period}</td>
              <td style="text-align: left; font-weight: 500; width: 85px;">${log.subject}</td>
              <td style="text-align: center; font-weight: bold; width: 55px;">${log.className || '-'}</td>
              <td style="text-align: center; font-weight: bold; width: 60px;">${log.curriculumPeriod ?? '-'}</td>
              <td style="text-align: left; padding: 4px 6px;">${log.lessonTitle || ''}</td>
              <td style="text-align: left; font-style: italic; width: 110px; padding: 4px 6px;">${log.adjustment || ''}</td>
            </tr>
          `;
          })
          .join('');

  const today = new Date();

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Lịch Báo Giảng Tuần ${weekNumber} - ${profile.teacherName}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm 10mm 10mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 10px;
      font-size: 13px;
      line-height: 1.35;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    .header-table td {
      vertical-align: top;
      border: none;
      padding: 0;
    }
    .text-center { text-align: center; }
    .uppercase { text-transform: uppercase; }
    .bold { font-weight: bold; }
    .italic { font-style: italic; }
    
    .title-box {
      text-align: center;
      margin: 10px 0 14px 0;
    }
    .main-title {
      font-size: 18px;
      font-weight: bold;
      text-transform: uppercase;
      margin: 0;
      letter-spacing: 0.5px;
    }
    .sub-title {
      font-size: 14px;
      font-weight: bold;
      text-transform: uppercase;
      margin-top: 3px;
    }
    .teacher-info {
      font-size: 13px;
      font-style: italic;
      margin-top: 4px;
    }

    table.data-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      margin-top: 6px;
      font-size: 12px;
    }
    table.data-table th, table.data-table td {
      border: 1px solid #000;
      padding: 5px 4px;
    }
    table.data-table th {
      background-color: #f1f5f9;
      text-align: center;
      font-weight: bold;
    }
    table.data-table tr {
      page-break-inside: avoid;
    }
    thead {
      display: table-header-group;
    }

    .signature-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 24px;
      page-break-inside: avoid;
    }
    .signature-table td {
      width: 50%;
      text-align: center;
      vertical-align: top;
      border: none;
      font-size: 13px;
    }
    .signature-space {
      height: 65px;
    }
  </style>
</head>
<body>
  <!-- Header Quốc Hiệu & Trường -->
  <table class="header-table">
    <tr>
      <td style="width: 45%; text-align: center;">
        <div class="bold uppercase" style="font-size: 13px;">${profile.school || 'TRƯỜNG CAO ĐẲNG NGHỀ 1-BQP'}</div>
        <div class="bold uppercase" style="font-size: 12px; margin-top: 2px;">${profile.department || 'TỔ TOÁN - TIN'}</div>
        <div style="width: 100px; height: 1px; background: #000; margin: 4px auto 0 auto;"></div>
      </td>
      <td style="width: 55%; text-align: center;">
        <div class="bold uppercase" style="font-size: 13px;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
        <div class="bold" style="font-size: 12px; margin-top: 2px; text-decoration: underline;">Độc lập - Tự do - Hạnh phúc</div>
      </td>
    </tr>
  </table>

  <!-- Tiêu đề văn bản -->
  <div class="title-box">
    <div class="main-title">LỊCH BÁO GIẢNG NĂM HỌC ${profile.schoolYear}</div>
    <div class="sub-title">TUẦN ${weekNumber} (${weekRange.displayRange})</div>
    <div class="teacher-info">
      Họ và tên giáo viên: <strong>${profile.teacherName}</strong> &nbsp;•&nbsp; Tổ chuyên môn: <strong>${profile.department}</strong>
    </div>
  </div>

  <!-- Bảng dữ liệu chính -->
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 38px;">STT</th>
        <th style="width: 75px;">Ngày</th>
        <th style="width: 65px;">Thứ/Buổi</th>
        <th style="width: 38px;">Tiết</th>
        <th style="width: 85px;">Môn</th>
        <th style="width: 55px;">Lớp</th>
        <th style="width: 60px;">Tiết PPCT</th>
        <th>Tên đầu bài dạy</th>
        <th style="width: 110px;">Điều chỉnh</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr style="background-color: #f8fafc; font-weight: bold; border-top: 2px solid #000;">
        <td colspan="9" style="text-align: right; padding: 6px 10px;">
          Tổng số tiết thực hiện trong tuần: <span style="font-size: 13px;">${totalCount}</span> tiết (Đã dạy: ${taughtCount} tiết | Chưa dạy: ${pendingCount} tiết)
        </td>
      </tr>
    </tbody>
  </table>

  <!-- Khung chữ ký -->
  <table class="signature-table">
    <tr>
      <td>
        <div class="bold uppercase">NGƯỜI DUYỆT BÁO GIẢNG</div>
        <div class="italic" style="font-size: 12px;">(${profile.reviewerTitle || 'Tổ trưởng chuyên môn'})</div>
        <div class="signature-space"></div>
        <div class="bold">${profile.reviewer || ''}</div>
      </td>
      <td>
        <div class="italic" style="font-size: 12px; margin-bottom: 2px;">
          Ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}
        </div>
        <div class="bold uppercase">GIÁO VIÊN BÁO GIẢNG</div>
        <div class="italic" style="font-size: 12px;">(Ký và ghi rõ họ tên)</div>
        <div class="signature-space"></div>
        <div class="bold">${profile.teacherName}</div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Triggers robust printing via hidden iframe to avoid iframe sandbox/focus blocks
 */
export function printViaIframe(htmlContent: string): void {
  const iframeId = 'applet_print_hidden_iframe';
  let iframe = document.getElementById(iframeId) as HTMLIFrameElement | null;

  if (iframe) {
    document.body.removeChild(iframe);
  }

  iframe = document.createElement('iframe');
  iframe.id = iframeId;
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    // Fallback to window.print if iframe document is not accessible
    window.print();
    return;
  }

  doc.open();
  doc.write(htmlContent);
  doc.close();

  setTimeout(() => {
    try {
      iframe?.contentWindow?.focus();
      iframe?.contentWindow?.print();
    } catch (err) {
      console.warn('Iframe print failed, falling back to window.print():', err);
      window.print();
    }
  }, 400);
}

/**
 * Downloads a standalone printable HTML file that opens in any browser
 * ready to save as PDF or print via Ctrl+P
 */
export function downloadPrintableHTMLFile(htmlContent: string, fileName: string): void {
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Directly captures the rendered A4 element using html2canvas and saves as PDF via jsPDF.
 * NO popups, NO browser print dialogs, NO printer connections required.
 */
export async function exportDirectPDFFromElement(element: HTMLElement, fileName: string): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2, // 2x resolution for crisp high-density text
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  // A4 Landscape: 297mm x 210mm
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * pageWidth) / canvas.width;

  if (imgHeight <= pageHeight) {
    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
  } else {
    let position = 0;
    let heightLeft = imgHeight;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage('a4', 'landscape');
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
  }

  pdf.save(fileName);
}

/**
 * Exports lesson log to a Microsoft Word document (.doc) in A4 Landscape format.
 * Opens natively in Microsoft Word without any popup or browser restrictions.
 */
export function exportToWordDoc(htmlBodyContent: string, fileName: string): void {
  const wordHeader = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' 
          xmlns:w='urn:schemas-microsoft-com:office:word' 
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>Lịch Báo Giảng</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page Section1 {
          size: 841.9pt 595.3pt; /* A4 Landscape: 297mm x 210mm */
          mso-page-orientation: landscape;
          margin: 28.35pt 28.35pt 28.35pt 28.35pt; /* 1cm margins */
        }
        div.Section1 { page: Section1; }
        body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #000; }
        table { border-collapse: collapse; width: 100%; margin-top: 6pt; }
        th, td { border: 1px solid black; padding: 4pt; font-size: 10pt; }
        th { background-color: #f1f5f9; text-align: center; font-weight: bold; }
        .text-center { text-align: center; }
        .bold { font-weight: bold; }
        .italic { font-style: italic; }
        .uppercase { text-transform: uppercase; }
      </style>
    </head>
    <body>
      <div class="Section1">
  `;
  const wordFooter = `
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', wordHeader + htmlBodyContent + wordFooter], {
    type: 'application/msword;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

