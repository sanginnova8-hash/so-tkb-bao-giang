import React from 'react';
import {
  CalendarDays,
  BookOpen,
  FileSpreadsheet,
  Printer,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  LogIn,
  UserPlus,
  Clock,
  Sparkles,
  School,
  FileCheck2,
  Users,
} from 'lucide-react';

interface PublicLandingProps {
  onOpenAuthModal: (tab: 'login' | 'register') => void;
}

export const PublicLanding: React.FC<PublicLandingProps> = ({ onOpenAuthModal }) => {
  const hiddenFeatures = [
    {
      title: 'Thời khóa biểu thông minh',
      icon: <CalendarDays className="w-6 h-6 text-indigo-600" />,
      desc: 'Quản lý lịch dạy sáng và chiều cả tuần, phân môn, phân lớp trực quan. Hỗ trợ nhập liệu nhanh từ Excel hoặc trích xuất tự động qua công nghệ AI.',
      color: 'from-indigo-500/10 to-blue-500/10',
      border: 'border-indigo-100',
    },
    {
      title: 'Phân phối chương trình (PPCT)',
      icon: <BookOpen className="w-6 h-6 text-emerald-600" />,
      desc: 'Bảo lưu tuyệt đối 100% nguyên văn tên bài dạy gốc theo tài liệu chuẩn. Phân tách bài học nhiều tiết, quản lý đa khối lớp và chuyên đề.',
      color: 'from-emerald-500/10 to-teal-500/10',
      border: 'border-emerald-100',
    },
    {
      title: 'Lập sổ báo giảng tự động 1-Click',
      icon: <FileSpreadsheet className="w-6 h-6 text-amber-600" />,
      desc: 'Tự động tính toán và ghép nối bài dạy với thời khóa biểu theo đúng tiến độ từng tuần. Linh hoạt điều chỉnh, hoán đổi tiết và theo dõi trạng thái đã dạy.',
      color: 'from-amber-500/10 to-orange-500/10',
      border: 'border-amber-100',
    },
    {
      title: 'In ấn & Xuất file chuẩn Bộ GD&ĐT',
      icon: <Printer className="w-6 h-6 text-sky-600" />,
      desc: 'Xem trước khổ giấy A4 dọc/ngang sắc nét, xuất file Word, Excel hoặc in ấn trực tiếp chỉ trong vài giây, sẵn sàng nộp tổ chuyên môn và ban giám hiệu.',
      color: 'from-sky-500/10 to-cyan-500/10',
      border: 'border-sky-100',
    },
    {
      title: 'Đồng bộ Đám mây & Bảo mật riêng',
      icon: <ShieldCheck className="w-6 h-6 text-purple-600" />,
      desc: 'Mỗi thầy/cô sở hữu tài khoản và không gian làm việc độc lập. Tự động sao lưu an toàn trên Cloud Firestore, không lo thất lạc dữ liệu giảng dạy.',
      color: 'from-purple-500/10 to-pink-500/10',
      border: 'border-purple-100',
    },
    {
      title: 'Trợ lý bóc tách tài liệu AI',
      icon: <Sparkles className="w-6 h-6 text-rose-600" />,
      desc: 'Tự động nhận diện TKB và PPCT từ hình ảnh chụp, tài liệu PDF, file Word mà không cần mất công gõ tay từng dòng.',
      color: 'from-rose-500/10 to-red-500/10',
      border: 'border-rose-100',
    },
  ];

  return (
    <div className="space-y-10 py-2 sm:py-6">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-sky-900 text-white shadow-xl p-6 sm:p-10 lg:p-14">
        {/* Background decorative circles */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-80 h-80 rounded-full bg-sky-500/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-sky-200">
            <School className="w-4 h-4 text-sky-300" />
            <span>Hệ thống chuyển đổi số giảng dạy chuyên nghiệp</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Sổ Thời Khóa Biểu & Báo Giảng Tự Động
          </h1>

          <p className="text-sm sm:text-base text-sky-100/90 leading-relaxed font-normal">
            Giải pháp quản lý giảng dạy thông minh dành cho giáo viên phổ thông, trung cấp và cao đẳng.
            Tự động ghép nối <strong className="text-white font-semibold">Thời khóa biểu</strong> với{' '}
            <strong className="text-white font-semibold">Phân phối chương trình</strong>, lập lịch báo giảng cho 37 tuần học
            chỉ với một cú nhấp chuột.
          </p>

          {/* Primary Action Buttons */}
          <div className="pt-2 flex flex-wrap items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => onOpenAuthModal('login')}
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-white text-indigo-900 hover:bg-sky-50 font-bold text-sm shadow-lg shadow-black/10 transition transform hover:-translate-y-0.5 cursor-pointer"
            >
              <LogIn className="w-4 h-4 text-indigo-700" />
              <span>Đăng nhập vào sổ</span>
              <ArrowRight className="w-4 h-4 text-indigo-500" />
            </button>

            <button
              type="button"
              onClick={() => onOpenAuthModal('register')}
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-indigo-700/80 hover:bg-indigo-600 text-white font-bold text-sm border border-indigo-400/40 backdrop-blur-sm shadow-md transition transform hover:-translate-y-0.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-sky-300" />
              <span>Tạo tài khoản giáo viên mới</span>
            </button>
          </div>

          {/* Privacy & Security Guarantee */}
          <div className="pt-4 border-t border-white/10 flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-sky-200/90">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Dữ liệu cá nhân được phân lập an toàn</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-sky-300 shrink-0" />
              <span>Bảo toàn 100% tên bài dạy gốc</span>
            </div>
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-amber-300 shrink-0" />
              <span>Mẫu in chuẩn quy định Bộ GD&ĐT</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Showcase (Locked Modules Notice) */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider mb-1">
              <Lock className="w-3.5 h-3.5" />
              <span>Yêu cầu đăng nhập để truy cập</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              Các chức năng giảng dạy chuyên biệt
            </h2>
          </div>
          <p className="text-xs text-slate-500 max-w-md">
            Mỗi giáo viên sở hữu sổ riêng biệt. Vui lòng đăng nhập hoặc tạo tài khoản để bắt đầu sử dụng đầy đủ các tính năng bên dưới.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {hiddenFeatures.map((f, idx) => (
            <div
              key={idx}
              onClick={() => onOpenAuthModal('login')}
              className={`group relative bg-white rounded-2xl border ${f.border} p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer overflow-hidden`}
            >
              {/* Subtle gradient background banner */}
              <div className={`absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r ${f.color}`} />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:scale-105 transition">
                    {f.icon}
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-200 transition">
                    <Lock className="w-3 h-3 text-slate-400 group-hover:text-indigo-500" />
                    <span>Mở khóa sau đăng nhập</span>
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-base group-hover:text-indigo-600 transition">
                  {f.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {f.desc}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-indigo-600">
                <span>Nhấn để đăng nhập & sử dụng</span>
                <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3 Steps Guide */}
      <section className="bg-slate-100/80 border border-slate-200 rounded-3xl p-6 sm:p-8">
        <div className="text-center max-w-xl mx-auto mb-8">
          <span className="text-xs uppercase tracking-wider font-bold text-indigo-600">
            Quy trình làm việc
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            Chỉ với 3 bước để có cuốn sổ báo giảng hoàn chỉnh
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-xs">
              1
            </div>
            <h4 className="font-bold text-sm text-slate-900">Đăng ký & Đăng nhập</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tạo tài khoản giáo viên với tên trường, tổ bộ môn. Mỗi thầy/cô có mật khẩu và kho lưu trữ riêng biệt, không sợ bị ghi đè.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-xs">
              2
            </div>
            <h4 className="font-bold text-sm text-slate-900">Nạp Thời khóa biểu & PPCT</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Nhập lịch dạy các lớp trong tuần và nạp phân phối chương trình của môn giảng dạy (hỗ trợ nhập tay, copy/paste Excel hoặc quét AI).
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-xs">
              3
            </div>
            <h4 className="font-bold text-sm text-slate-900">Tự động xuất Sổ Báo Giảng</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Hệ thống tự động nối đúng bài dạy cho từng tiết, từng tuần. Thầy/cô chỉ việc kiểm tra và in ấn hoặc xuất file Word/Excel nộp chuyên môn.
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-sky-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center sm:text-left">
          <h3 className="text-xl sm:text-2xl font-bold">
            Bắt đầu quản lý sổ báo giảng thông minh ngay hôm nay
          </h3>
          <p className="text-xs sm:text-sm text-sky-100">
            Tiết kiệm hàng giờ soạn thảo sổ sách mỗi tuần, loại bỏ sai sót và nhầm lẫn tiết dạy.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onOpenAuthModal('login')}
            className="px-5 py-3 rounded-xl bg-white text-indigo-900 font-bold text-xs hover:bg-sky-50 shadow-md transition cursor-pointer"
          >
            Đăng nhập ngay
          </button>
          <button
            type="button"
            onClick={() => onOpenAuthModal('register')}
            className="px-5 py-3 rounded-xl bg-indigo-800/80 text-white font-bold text-xs hover:bg-indigo-800 border border-white/20 transition cursor-pointer"
          >
            Đăng ký tài khoản mới
          </button>
        </div>
      </section>
    </div>
  );
};
