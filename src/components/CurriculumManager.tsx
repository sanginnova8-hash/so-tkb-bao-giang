import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit3,
  Download,
  Upload,
  CheckCircle,
  AlertCircle,
  X,
  Sparkles,
  ArrowUpDown,
  BookMarked,
  Tags,
  Undo2,
} from 'lucide-react';
import { CurriculumEntry, SubjectAlias } from '../types';
import { exportCurriculumToExcel } from '../utils/excelUtils';
import { AiCurriculumParserModal } from './AiCurriculumParserModal';

interface CurriculumManagerProps {
  curriculum: CurriculumEntry[];
  setCurriculum: React.Dispatch<React.SetStateAction<CurriculumEntry[]>>;
  aliases: SubjectAlias[];
  setAliases: React.Dispatch<React.SetStateAction<SubjectAlias[]>>;
}

export const CurriculumManager: React.FC<CurriculumManagerProps> = ({
  curriculum,
  setCurriculum,
  aliases,
  setAliases,
}) => {
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [filterSemester, setFilterSemester] = useState<string>('all');
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'aliases'>('list');

  // AI Parser Modal state
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Edit / Add Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CurriculumEntry | null>(null);

  // Form state
  const [formData, setFormData] = useState<{
    subject: string;
    grade: number;
    periodNumber: number;
    lessonTitle: string;
    semester: 'Học kỳ I' | 'Học kỳ II';
    category: string;
    note: string;
  }>({
    subject: 'Toán',
    grade: 10,
    periodNumber: 1,
    lessonTitle: '',
    semester: 'Học kỳ I',
    category: 'Đại số',
    note: '',
  });

  // Alias modal state
  const [isAliasModalOpen, setIsAliasModalOpen] = useState(false);
  const [aliasFormData, setAliasFormData] = useState({
    alias: '',
    canonicalSubject: 'Toán',
    grade: 10,
  });

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // In-app confirmation & undo states (No popup window.confirm)
  const [isBatchConfirming, setIsBatchConfirming] = useState(false);
  const [isFilterConfirming, setIsFilterConfirming] = useState(false);
  const [confirmRowDeleteId, setConfirmRowDeleteId] = useState<string | null>(null);

  // Undo notification state
  const [undoState, setUndoState] = useState<{
    items: CurriculumEntry[];
    message: string;
    expiresAt: number;
  } | null>(null);

  // Clear undo after timer expires
  useEffect(() => {
    if (!undoState) return;
    const remaining = Math.max(0, undoState.expiresAt - Date.now());
    const timer = setTimeout(() => {
      setUndoState(null);
    }, remaining);
    return () => clearTimeout(timer);
  }, [undoState]);

  // Extract distinct subjects and grades for filters
  const distinctSubjects = Array.from(new Set(curriculum.map((c) => c.subject))).sort();
  const distinctGrades = Array.from(new Set(curriculum.map((c) => c.grade))).sort((a, b) => a - b);

  // Filtered entries
  const filteredCurriculum = curriculum
    .filter((c) => {
      const matchSearch =
        searchTerm === '' ||
        c.lessonTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.note || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchSub = filterSubject === 'all' || c.subject === filterSubject;
      const matchGrade = filterGrade === 'all' || c.grade.toString() === filterGrade;
      const matchSemester = filterSemester === 'all' || c.semester === filterSemester;

      return matchSearch && matchSub && matchGrade && matchSemester;
    })
    .sort((a, b) => {
      if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
      if (a.grade !== b.grade) return a.grade - b.grade;
      return a.periodNumber - b.periodNumber;
    });

  const handleOpenAdd = () => {
    // Guess next period number
    const currentSubject = filterSubject !== 'all' ? filterSubject : 'Toán';
    const currentGrade = filterGrade !== 'all' ? Number(filterGrade) : 10;
    const sameItems = curriculum.filter(
      (c) => c.subject === currentSubject && c.grade === currentGrade
    );
    const maxPeriod = sameItems.reduce((max, c) => Math.max(max, c.periodNumber), 0);

    setEditingItem(null);
    setFormData({
      subject: currentSubject,
      grade: currentGrade,
      periodNumber: maxPeriod + 1,
      lessonTitle: '',
      semester: 'Học kỳ I',
      category: 'Đại số',
      note: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: CurriculumEntry) => {
    setEditingItem(item);
    setFormData({
      subject: item.subject,
      grade: item.grade,
      periodNumber: item.periodNumber,
      lessonTitle: item.lessonTitle,
      semester: item.semester,
      category: item.category || '',
      note: item.note || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.lessonTitle.trim()) {
      alert('Vui lòng nhập tên đầu bài dạy!');
      return;
    }

    if (editingItem) {
      // Update
      setCurriculum((prev) =>
        prev.map((c) =>
          c.id === editingItem.id
            ? {
                ...c,
                subject: formData.subject.trim(),
                grade: Number(formData.grade),
                periodNumber: Number(formData.periodNumber),
                lessonTitle: formData.lessonTitle.trim(),
                semester: formData.semester,
                category: formData.category.trim(),
                note: formData.note.trim(),
              }
            : c
        )
      );
    } else {
      // Create new
      const newItem: CurriculumEntry = {
        id: `ppct-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        subject: formData.subject.trim(),
        grade: Number(formData.grade),
        periodNumber: Number(formData.periodNumber),
        lessonTitle: formData.lessonTitle.trim(),
        semester: formData.semester,
        category: formData.category.trim(),
        note: formData.note.trim(),
      };
      setCurriculum((prev) => [...prev, newItem]);
    }

    setIsModalOpen(false);
  };

  // Trigger Undo
  const handleUndoDelete = () => {
    if (!undoState) return;
    setCurriculum((prev) => {
      const existingIds = new Set(prev.map((c) => c.id));
      const restored = undoState.items.filter((item) => !existingIds.has(item.id));
      return [...prev, ...restored];
    });
    setUndoState(null);
  };

  // Single item deletion (inline, no popup)
  const executeDeleteSingle = (item: CurriculumEntry) => {
    setCurriculum((prev) => prev.filter((c) => c.id !== item.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
    setConfirmRowDeleteId(null);
    setUndoState({
      items: [item],
      message: `Đã xóa tiết ${item.periodNumber}: ${item.lessonTitle}`,
      expiresAt: Date.now() + 8000,
    });
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const allFilteredSelected =
      filteredCurriculum.length > 0 &&
      filteredCurriculum.every((c) => selectedIds.has(c.id));

    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredCurriculum.forEach((c) => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredCurriculum.forEach((c) => next.add(c.id));
        return next;
      });
    }
  };

  // Batch delete selected (inline, no popup)
  const executeDeleteSelected = () => {
    const toDelete = curriculum.filter((c) => selectedIds.has(c.id));
    if (toDelete.length === 0) return;

    setCurriculum((prev) => prev.filter((c) => !selectedIds.has(c.id)));
    setSelectedIds(new Set());
    setIsBatchConfirming(false);

    setUndoState({
      items: toDelete,
      message: `Đã xóa ${toDelete.length} bài học đã chọn khỏi PPCT`,
      expiresAt: Date.now() + 8000,
    });
  };

  // Bulk delete filtered items (inline, no popup)
  const executeDeleteFilteredAll = () => {
    const filteredIdSet = new Set(filteredCurriculum.map((c) => c.id));
    const toDelete = curriculum.filter((c) => filteredIdSet.has(c.id));
    if (toDelete.length === 0) return;

    setCurriculum((prev) => prev.filter((c) => !filteredIdSet.has(c.id)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredIdSet.forEach((id) => next.delete(id));
      return next;
    });
    setIsFilterConfirming(false);

    setUndoState({
      items: toDelete,
      message: `Đã xóa toàn bộ ${toDelete.length} bài học đang hiển thị`,
      expiresAt: Date.now() + 8000,
    });
  };

  // Add Alias
  const handleSaveAlias = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aliasFormData.alias.trim()) return;

    const newAlias: SubjectAlias = {
      id: `al-${Date.now().toString(36)}`,
      alias: aliasFormData.alias.trim(),
      canonicalSubject: aliasFormData.canonicalSubject.trim(),
      grade: aliasFormData.grade ? Number(aliasFormData.grade) : undefined,
    };

    setAliases((prev) => [...prev, newAlias]);
    setAliasFormData({ alias: '', canonicalSubject: 'Toán', grade: 10 });
    setIsAliasModalOpen(false);
  };

  const handleDeleteAlias = (id: string) => {
    setAliases((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800">
              Phân phối chương trình (PPCT)
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
              {curriculum.length} bài đã lập
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Danh mục bài dạy được dùng để tự động khớp đầu bài và tiết PPCT khi sinh lịch báo giảng
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sub tabs: List vs Aliases */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setActiveSubTab('list')}
              className={`px-3 py-1 font-medium rounded-md transition ${
                activeSubTab === 'list'
                  ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Danh sách bài ({curriculum.length})
            </button>
            <button
              onClick={() => setActiveSubTab('aliases')}
              className={`px-3 py-1 font-medium rounded-md transition ${
                activeSubTab === 'aliases'
                  ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Quy tắc viết tắt ({aliases.length})
            </button>
          </div>

          {activeSubTab === 'list' && (
            <>
              <button
                onClick={() => setIsAiModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg text-white bg-gradient-to-r from-indigo-600 via-indigo-700 to-sky-600 hover:from-indigo-700 hover:to-sky-700 transition cursor-pointer shadow-md shadow-indigo-100"
                title="Tải ảnh chụp hoặc dán văn bản PPCT để Gemini AI tự động trích xuất và lưu vĩnh viễn"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Tải lên PPCT bằng AI</span>
              </button>

              <button
                onClick={() => exportCurriculumToExcel(curriculum)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Xuất Excel</span>
              </button>

              <button
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm bài mới</span>
              </button>
            </>
          )}

          {activeSubTab === 'aliases' && (
            <button
              onClick={() => setIsAliasModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm quy tắc</span>
            </button>
          )}
        </div>
      </div>

      {/* SUB TAB: LIST */}
      {activeSubTab === 'list' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo tên bài học, phân loại, ghi chú..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Subject filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">Môn:</span>
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-hidden font-medium text-slate-700 cursor-pointer"
              >
                <option value="all">Tất cả môn</option>
                {distinctSubjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Grade filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">Khối:</span>
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-hidden font-medium text-slate-700 cursor-pointer"
              >
                <option value="all">Tất cả khối</option>
                {distinctGrades.map((g) => (
                  <option key={g} value={g.toString()}>
                    Khối {g}
                  </option>
                ))}
              </select>
            </div>

            {/* Semester filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">Kỳ:</span>
              <select
                value={filterSemester}
                onChange={(e) => setFilterSemester(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-hidden font-medium text-slate-700 cursor-pointer"
              >
                <option value="all">Cả năm</option>
                <option value="Học kỳ I">Học kỳ I</option>
                <option value="Học kỳ II">Học kỳ II</option>
              </select>
            </div>

            {/* Quick bulk action: Delete all filtered (Inline confirmation, no popup) */}
            {filteredCurriculum.length > 0 && (
              <div className="ml-auto">
                {!isFilterConfirming ? (
                  <button
                    type="button"
                    onClick={() => setIsFilterConfirming(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition font-medium cursor-pointer"
                    title="Xóa toàn bộ các bài đang hiển thị theo bộ lọc này"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Xóa {filteredCurriculum.length} bài đang lọc</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-300 px-2.5 py-1 rounded-lg animate-in fade-in shadow-2xs">
                    <span className="text-[11px] font-bold text-rose-800">
                      Xác nhận xóa {filteredCurriculum.length} bài?
                    </span>
                    <button
                      type="button"
                      onClick={executeDeleteFilteredAll}
                      className="px-2 py-0.5 bg-rose-600 text-white rounded text-[11px] font-bold hover:bg-rose-700 cursor-pointer shadow-xs"
                    >
                      Xác nhận xóa
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsFilterConfirming(false)}
                      className="px-2 py-0.5 bg-white text-slate-700 border border-slate-300 rounded text-[11px] hover:bg-slate-100 cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Batch Selection Action Bar (Inline confirmation, no popup) */}
          {selectedIds.size > 0 && (
            <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <span className="font-bold text-xs bg-indigo-600 px-3 py-1 rounded-lg">
                  Đã chọn {selectedIds.size} bài học
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIds(new Set());
                    setIsBatchConfirming(false);
                  }}
                  className="text-slate-300 hover:text-white text-xs underline cursor-pointer"
                >
                  Bỏ chọn tất cả
                </button>
              </div>

              <div className="flex items-center gap-2">
                {!isBatchConfirming ? (
                  <button
                    type="button"
                    onClick={() => setIsBatchConfirming(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa {selectedIds.size} bài đã chọn</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-rose-950/80 border border-rose-500/50 px-3 py-1.5 rounded-xl animate-in fade-in">
                    <span className="text-xs font-semibold text-rose-200">
                      Xác nhận xóa {selectedIds.size} bài học?
                    </span>
                    <button
                      type="button"
                      onClick={executeDeleteSelected}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                    >
                      Đồng ý xóa
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsBatchConfirming(false)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredCurriculum.length > 0 &&
                          filteredCurriculum.every((c) => selectedIds.has(c.id))
                        }
                        onChange={handleSelectAllFiltered}
                        className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        title="Chọn / Bỏ chọn tất cả các bài đang hiển thị"
                      />
                    </th>
                    <th className="py-3 px-3 w-14 text-center">Tiết</th>
                    <th className="py-3 px-4 w-28">Môn học</th>
                    <th className="py-3 px-3 w-20 text-center">Khối</th>
                    <th className="py-3 px-4">Tên đầu bài dạy</th>
                    <th className="py-3 px-3 w-28">Phân loại</th>
                    <th className="py-3 px-3 w-24">Học kỳ</th>
                    <th className="py-3 px-4 w-32">Ghi chú</th>
                    <th className="py-3 px-4 w-20 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCurriculum.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-medium">Không tìm thấy bài học nào phù hợp</p>
                        <p className="text-[11px] mt-1">
                          Hãy thử thay đổi bộ lọc hoặc thêm bài học mới!
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredCurriculum.map((item) => {
                      const isSelected = selectedIds.has(item.id);
                      return (
                        <tr
                          key={item.id}
                          className={`transition ${
                            isSelected
                              ? 'bg-indigo-50/80 hover:bg-indigo-100/70 text-indigo-950 font-medium'
                              : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(item.id)}
                              className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center font-extrabold text-indigo-700">
                            {item.periodNumber}
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-slate-800">
                            {item.subject}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 bg-slate-100 font-semibold rounded text-slate-700">
                              Khối {item.grade}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-medium text-slate-900">
                            {item.lessonTitle}
                          </td>
                          <td className="py-2.5 px-3">
                            {item.category && (
                              <span className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded-md text-[11px] font-medium border border-sky-100">
                                {item.category}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-medium">
                            {item.semester}
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 truncate max-w-[150px]">
                            {item.note || '-'}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            {confirmRowDeleteId === item.id ? (
                              <div className="flex items-center justify-center gap-1 bg-rose-50 p-1 rounded-lg border border-rose-200 animate-in fade-in">
                                <button
                                  type="button"
                                  onClick={() => executeDeleteSingle(item)}
                                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded cursor-pointer shadow-2xs"
                                  title="Xác nhận xóa"
                                >
                                  Xóa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmRowDeleteId(null)}
                                  className="px-1.5 py-0.5 bg-white text-slate-600 border border-slate-300 text-[11px] rounded hover:bg-slate-100 cursor-pointer"
                                  title="Hủy"
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleOpenEdit(item)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition cursor-pointer"
                                  title="Sửa bài"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setConfirmRowDeleteId(item.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                  title="Xóa bài (nhấn để xác nhận)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB: ALIASES */}
      {activeSubTab === 'aliases' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div>
            <h3 className="font-bold text-sm text-slate-800">
              Quy tắc ánh xạ tên môn viết tắt ↔ Tên đầy đủ
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Khi giáo viên viết tắt trong ô thời khóa biểu (ví dụ: "ĐS", "GT", "HH"), hệ thống sẽ tự đối chiếu sang môn chuẩn để tìm bài trong PPCT.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {aliases.map((alias) => (
              <div
                key={alias.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-xs">
                      {alias.alias}
                    </span>
                    <span className="text-xs text-slate-400">➔</span>
                    <span className="font-bold text-slate-800 text-xs">{alias.canonicalSubject}</span>
                  </div>
                  {alias.grade && (
                    <p className="text-[11px] text-slate-500 mt-1">Áp dụng cho Khối {alias.grade}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteAlias(alias.id)}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-base">
                {editingItem ? 'Sửa bài học PPCT' : 'Thêm bài học vào PPCT'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-slate-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Môn học *</label>
                  <input
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Khối lớp *</label>
                  <select
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    {[10, 11, 12, 6, 7, 8, 9].map((g) => (
                      <option key={g} value={g}>
                        Khối {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tiết PPCT số * (tăng dần)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={formData.periodNumber}
                    onChange={(e) => setFormData({ ...formData, periodNumber: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-700"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Học kỳ</label>
                  <select
                    value={formData.semester}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        semester: e.target.value as 'Học kỳ I' | 'Học kỳ II',
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Học kỳ I">Học kỳ I</option>
                    <option value="Học kỳ II">Học kỳ II</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tên đầu bài dạy *
                </label>
                <input
                  type="text"
                  required
                  value={formData.lessonTitle}
                  onChange={(e) => setFormData({ ...formData, lessonTitle: e.target.value })}
                  placeholder="Ví dụ: Bài 1: Mệnh đề (Tiết 1)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phân loại / Mảng kiến thức</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Đại số, Hình học, Giải tích, Kiểm tra..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ghi chú</label>
                  <input
                    type="text"
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    placeholder="Lý thuyết, bài tập..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                >
                  Lưu bài học
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Alias Modal */}
      {isAliasModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Thêm quy tắc viết tắt</h3>
              <button
                onClick={() => setIsAliasModalOpen(false)}
                className="p-1 hover:bg-slate-800 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveAlias} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tên viết tắt (trong ô TKB) *
                </label>
                <input
                  type="text"
                  required
                  value={aliasFormData.alias}
                  onChange={(e) => setAliasFormData({ ...aliasFormData, alias: e.target.value })}
                  placeholder="Ví dụ: ĐS, GT, HH, HĐTN..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Môn học chuẩn trong PPCT *
                </label>
                <input
                  type="text"
                  required
                  value={aliasFormData.canonicalSubject}
                  onChange={(e) =>
                    setAliasFormData({ ...aliasFormData, canonicalSubject: e.target.value })
                  }
                  placeholder="Ví dụ: Toán, HĐTN-HN..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Khối áp dụng (tùy chọn)</label>
                <select
                  value={aliasFormData.grade || ''}
                  onChange={(e) =>
                    setAliasFormData({
                      ...aliasFormData,
                      grade: e.target.value ? Number(e.target.value) : 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-hidden"
                >
                  <option value="">Áp dụng cho mọi khối</option>
                  <option value="10">Khối 10</option>
                  <option value="11">Khối 11</option>
                  <option value="12">Khối 12</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAliasModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                >
                  Lưu quy tắc
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Curriculum Parser Modal */}
      <AiCurriculumParserModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        currentSubject={filterSubject !== 'all' ? filterSubject : 'Toán'}
        currentGrade={filterGrade !== 'all' ? Number(filterGrade) : 10}
        onSaveEntries={(newEntries, mode) => {
          if (newEntries.length === 0) return;

          setCurriculum((prev) => {
            if (mode === 'replace') {
              // Replace all (subject, grade) combinations present in newEntries
              const replaceKeys = new Set(
                newEntries.map((c) => `${c.subject.trim().toLowerCase()}__${c.grade}`)
              );
              const remaining = prev.filter(
                (c) => !replaceKeys.has(`${c.subject.trim().toLowerCase()}__${c.grade}`)
              );
              return [...remaining, ...newEntries];
            }
            return [...prev, ...newEntries];
          });
        }}
      />

      {/* Floating In-App Undo Notification Banner (No popups) */}
      {undoState && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900/95 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700/60 backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-rose-500/20 text-rose-400 rounded-lg">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-100">{undoState.message}</p>
              <p className="text-[10px] text-slate-400">Đã cập nhật tự động lên hệ thống</p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-700 mx-1" />

          <button
            type="button"
            onClick={handleUndoDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer hover:scale-105 active:scale-95"
            title="Khôi phục lại các bài vừa xóa"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Hoàn tác</span>
          </button>

          <button
            type="button"
            onClick={() => setUndoState(null)}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg cursor-pointer"
            title="Đóng thông báo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
