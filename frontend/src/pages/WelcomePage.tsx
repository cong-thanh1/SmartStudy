import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  FileText,
  MessageSquare,
  CheckSquare,
  Award,
  ShieldCheck,
  Zap,
  Lock,
  Mail,
} from 'lucide-react';
import { Button, Modal, Input, Badge } from '../components';
import { authService } from '../services';

export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      if (authMode === 'login') {
        await authService.login(email, password);
      } else {
        await authService.register(email, password, name);
      }
      navigate('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      const serverMsg = axiosErr?.response?.data?.error?.message;
      if (authMode === 'register' && serverMsg?.includes('12')) {
        setError('Mật khẩu phải có ít nhất 12 ký tự.');
      } else if (serverMsg?.includes('already')) {
        setError('Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.');
      } else {
        setError(serverMsg || (authMode === 'login' ? 'Email hoặc mật khẩu không đúng.' : 'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F4F7F9] via-white to-[#F4F7F9] text-[#181C1E] flex flex-col selection:bg-[#0073BB] selection:text-white">
      {/* Top Navigation */}
      <header className="max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0073BB] to-[#8A2BE2] flex items-center justify-center shadow-md">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight text-[#232F3E]">SmartStudy</span>
            <span className="text-xs font-bold text-[#8A2BE2] ml-1 bg-[#8A2BE2]/10 px-2 py-0.5 rounded-full">
              AI v2.0
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setAuthMode('login');
              setIsAuthModalOpen(true);
            }}
            className="text-sm font-semibold text-[#404751] hover:text-[#0073BB] transition-colors px-3 py-2"
          >
            Đăng nhập
          </button>
          <Button
            variant="ai"
            size="md"
            onClick={() => {
              setAuthMode('register');
              setIsAuthModalOpen(true);
            }}
          >
            Bắt đầu miễn phí
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 pt-12 pb-24 max-w-5xl mx-auto relative z-10">
        <Badge variant="ai" size="md" className="mb-6 px-4 py-1.5 text-xs shadow-sm">
          <Zap className="w-3.5 h-3.5 mr-1.5" /> Kiến trúc Ports &amp; Adapters — Local First Engine
        </Badge>

        <h1 className="font-extrabold text-4xl sm:text-6xl lg:text-7xl tracking-tight text-[#232F3E] leading-[1.15] mb-6">
          Trợ lý Học tập AI <br />
          <span className="ai-gradient-text">Chuẩn hóa &amp; Tối ưu hóa</span>
        </h1>

        <p className="text-base sm:text-lg text-[#404751] max-w-2xl mx-auto leading-relaxed mb-10">
          Biến tài liệu PDF giáo trình thành không gian tri thức tương tác với công nghệ RAG độ trễ thấp, tự động tóm
          tắt Map-Reduce và sinh đề thi trắc nghiệm theo thời gian thực.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md">
          <Button
            variant="ai"
            size="lg"
            className="w-full sm:w-auto text-base shadow-xl"
            rightIcon={<ArrowRight className="w-5 h-5" />}
            onClick={() => {
              setAuthMode('register');
              setIsAuthModalOpen(true);
            }}
          >
            Khám phá Không gian AI
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto text-base bg-white shadow-sm"
            onClick={() => navigate('/dashboard')}
          >
            Vào thẳng Demo (Không cần tài khoản)
          </Button>
        </div>

        {/* Trust Badges */}
        <div className="flex flex-wrap items-center justify-center gap-8 mt-16 pt-8 border-t border-[#E0E3E5]/60 text-xs font-semibold text-[#707882] uppercase tracking-wider">
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> 100% Isolated User Data
          </span>
          <span className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#0073BB]" /> HNSW pgvector 10x Speed
          </span>
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#8A2BE2]" /> BullMQ Async Pipeline
          </span>
        </div>
      </section>

      {/* Bento Grid Features Section */}
      <section className="bg-[#232F3E] text-white py-24 px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#9CCAFF] bg-[#0073BB]/20 px-3 py-1 rounded-full border border-[#0073BB]/40">
              Tính năng cốt lõi
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold mt-4 text-white">
              Sức mạnh 8 Module trong Một Bảng điều khiển
            </h2>
            <p className="text-[#C0C7D2] mt-4 text-sm sm:text-base">
              Thiết kế theo chuẩn mực UI Corporate Modern của Stitch, tích hợp liền mạch từ khâu tải lên tài liệu đến
              chấm điểm năng lực.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Bento Item 1: PDF Library */}
            <div className="md:col-span-2 rounded-3xl bg-white/5 border border-white/10 p-8 hover:bg-white/10 transition-all group flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#0073BB] flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white">Quản lý PDF &amp; Xử lý Bất đồng bộ</h3>
                <p className="text-[#C0C7D2] text-sm leading-relaxed max-w-xl">
                  Tải lên tài liệu PDF với dung lượng lớn. Hệ thống tự động bóc tách văn bản, phân mảnh theo ngữ nghĩa
                  (chunking) và tạo vector embedding qua worker BullMQ trên nền Redis.
                </p>
              </div>
              <div className="mt-8 pt-6 border-t border-white/10 flex items-center gap-4 text-xs font-medium text-[#9CCAFF]">
                <span>✅ Presigned Upload URL</span>
                <span>✅ Trạng thái Real-time</span>
                <span>✅ MinIO / AWS S3 Adapter</span>
              </div>
            </div>

            {/* Bento Item 2: RAG Chat */}
            <div className="rounded-3xl bg-gradient-to-br from-[#8A2BE2]/40 to-[#0073BB]/40 border border-white/15 p-8 hover:brightness-110 transition-all group flex flex-col justify-between shadow-xl">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-white text-[#8A2BE2] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white">Chatbot RAG Chuyên sâu</h3>
                <p className="text-white/80 text-sm leading-relaxed">
                  Trò chuyện trực tiếp với tài liệu. Câu trả lời được trích dẫn chính xác đến từng số trang và đoạn
                  văn bản trong PDF, loại bỏ hoàn toàn hiện tượng ảo giác AI.
                </p>
              </div>
              <div className="mt-8 flex items-center justify-between text-xs font-bold text-white bg-black/20 px-4 py-2.5 rounded-xl">
                <span>⚡ HNSW Indexing</span>
                <span>100% Accurate</span>
              </div>
            </div>

            {/* Bento Item 3: Auto Quiz Generator */}
            <div className="rounded-3xl bg-white/5 border border-white/10 p-8 hover:bg-white/10 transition-all group flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#D0E4FF] text-[#00497A] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <CheckSquare className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white">Tạo Đề thi &amp; Quiz Tự động</h3>
                <p className="text-[#C0C7D2] text-sm leading-relaxed">
                  AI quét toàn bộ tài liệu hoặc từng chương để tự động tạo bộ câu hỏi trắc nghiệm ôn tập, giúp củng cố
                  khái niệm trọng tâm trước kỳ thi.
                </p>
              </div>
              <div className="mt-8 pt-6 border-t border-white/10 text-xs text-[#9CCAFF] font-medium">
                ⏱️ Sinh đề thi trong 3 giây với độ khó tùy chỉnh
              </div>
            </div>

            {/* Bento Item 4: AI Grading & Feedback */}
            <div className="md:col-span-2 rounded-3xl bg-white/5 border border-white/10 p-8 hover:bg-white/10 transition-all group flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#8A2BE2] to-[#0073BB] text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Award className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white">Chấm điểm tức thì &amp; Gia sư 1-kèm-1</h3>
                <p className="text-[#C0C7D2] text-sm leading-relaxed max-w-xl">
                  Hệ thống chấm điểm đạt độ phủ kiểm thử 100% coverage. Không chỉ đưa ra điểm số, AI còn phân tích
                  nguyên nhân tại sao bạn chọn sai và đề xuất hướng tư duy chuẩn xác.
                </p>
              </div>
              <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center gap-6 text-xs font-medium text-[#9CCAFF]">
                <span>🎯 Lời khuyên cá nhân hóa</span>
                <span>💡 Giải thích chi tiết đáp án</span>
                <span>🧑‍🏫 Gia sư AI giải đáp thắc mắc</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#181C1E] text-[#707882] py-8 px-6 text-center text-xs border-t border-white/10">
        <p>© 2026 SmartStudy AI. Built by Cong-Thanh1 &amp; Team with Hexagonal Ports &amp; Adapters Architecture.</p>
      </footer>

      {/* Auth Modal */}
      <Modal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        title={authMode === 'login' ? 'Đăng nhập hệ thống' : 'Tạo tài khoản học viên mới'}
        size="sm"
      >
        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {authMode === 'register' && (
            <Input
              label="Họ và tên"
              placeholder="Nhập tên của bạn"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <Input
            label="Địa chỉ Email"
            type="email"
            placeholder="student@smartstudy.ai"
            leftIcon={<Mail size={16} />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label={authMode === 'register' ? 'Mật khẩu (tối thiểu 12 ký tự)' : 'Mật khẩu'}
            type="password"
            placeholder={authMode === 'register' ? 'Nhập mật khẩu (≥ 12 ký tự)' : '••••••••'}
            leftIcon={<Lock size={16} />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={authMode === 'register' ? 12 : 1}
          />

          {error && <div className="p-3 rounded-lg bg-[#FFDAD6] text-[#93000A] text-xs font-medium">{error}</div>}

          <Button type="submit" variant="ai" size="lg" className="w-full mt-2" isLoading={isLoading}>
            {authMode === 'login' ? 'Đăng nhập ngay' : 'Hoàn tất Đăng ký'}
          </Button>

          <div className="text-center pt-2 text-xs text-[#707882]">
            {authMode === 'login' ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
            <button
              type="button"
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              className="text-[#0073BB] font-bold hover:underline"
            >
              {authMode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
