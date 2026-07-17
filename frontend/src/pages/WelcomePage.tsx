import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpenText, BrainCircuit, Check, CheckCircle2, ClipboardCheck, FileText, Lock, Mail, MessageCircleMore, Play, ShieldCheck, Sparkles } from 'lucide-react';
import { Button, Modal, Input } from '../components';
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

  const openAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setError('');
    setIsAuthModalOpen(true);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      if (authMode === 'login') await authService.login(email, password);
      else await authService.register(email, password, name);
      navigate('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      const serverMsg = axiosErr?.response?.data?.error?.message;
      if (authMode === 'register' && serverMsg?.includes('12')) setError('Mật khẩu cần có ít nhất 12 ký tự.');
      else if (serverMsg?.includes('already')) setError('Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.');
      else setError(serverMsg || (authMode === 'login' ? 'Email hoặc mật khẩu chưa đúng.' : 'Chưa thể tạo tài khoản. Vui lòng thử lại.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#F6F7F2] text-[#17201E]">
      <div className="soft-grid relative">
        <div className="pointer-events-none absolute -right-24 -top-28 h-96 w-96 rounded-full bg-[#DDEDE6] blur-3xl" />
        <div className="pointer-events-none absolute -left-36 top-80 h-80 w-80 rounded-full bg-[#FFE4D9] blur-3xl" />

        <header className="relative z-10 mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#18312A] text-white shadow-[0_10px_25px_rgba(24,49,42,0.22)]"><Sparkles size={20} /></div>
            <div>
              <p className="text-lg font-extrabold leading-none tracking-[-0.03em]">SmartStudy</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.17em] text-[#ED7148]">Học dễ hiểu hơn</p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <button data-testid="auth-login-open" onClick={() => openAuth('login')} className="rounded-xl px-3 py-2 text-sm font-bold text-[#40504A] transition hover:bg-white/80 hover:text-[#18312A]">Đăng nhập</button>
            <Button data-testid="auth-register-open" size="md" onClick={() => openAuth('register')}>Bắt đầu miễn phí</Button>
          </div>
        </header>

        <main className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[1.03fr_.97fr] lg:pb-28 lg:pt-20">
          <section className="page-enter">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#D1E2DA] bg-white/80 px-3 py-1.5 text-xs font-bold text-[#2F6B58] shadow-sm backdrop-blur">
              <CheckCircle2 size={14} /> Từ tài liệu đến kiến thức của riêng bạn
            </div>
            <h1 className="max-w-3xl text-balance text-[42px] font-black leading-[1.05] tracking-[-0.055em] text-[#17201E] sm:text-6xl lg:text-[68px]">
              Đọc ít lan man.<br /><span className="ai-gradient-text">Hiểu đúng trọng tâm.</span>
            </h1>
            <p className="mt-7 max-w-xl text-[16px] leading-7 text-[#5E6A66] sm:text-lg">
              Tải tài liệu lên, hỏi những điều chưa hiểu, nhận bản tóm tắt và luyện tập ngay trên chính nội dung bạn đang học.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" onClick={() => openAuth('register')} rightIcon={<ArrowRight size={18} />}>Tạo không gian học</Button>
              <Button variant="outline" size="lg" onClick={() => navigate('/dashboard')} leftIcon={<Play size={17} fill="currentColor" />}>Xem bản dùng thử</Button>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-[#64716C]">
              <span className="flex items-center gap-2"><Check size={15} className="text-[#2F6B58]" /> Không cần thiết lập phức tạp</span>
              <span className="flex items-center gap-2"><ShieldCheck size={15} className="text-[#2F6B58]" /> Tài liệu được giữ riêng tư</span>
            </div>
          </section>

          <section className="relative mx-auto w-full max-w-xl page-enter">
            <div className="absolute -inset-5 rotate-2 rounded-[36px] bg-[#CFE2D9] opacity-70" />
            <div className="relative overflow-hidden rounded-[32px] border border-white/80 bg-white p-4 shadow-[0_30px_80px_rgba(31,59,50,0.18)] sm:p-5">
              <div className="rounded-[24px] bg-[#18312A] p-5 text-white sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9FC9B9]">Buổi học hôm nay</p>
                    <h2 className="mt-1 text-xl font-extrabold">Kinh tế vi mô · Chương 3</h2>
                  </div>
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><BookOpenText size={19} /></div>
                </div>
                <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[68%] rounded-full bg-[#ED7148]" /></div>
                <div className="mt-2 flex justify-between text-[10px] font-semibold text-white/55"><span>Tiến độ đọc</span><span>68%</span></div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[#F0F6F2] p-4">
                  <MessageCircleMore size={19} className="text-[#2F6B58]" />
                  <p className="mt-4 text-xs font-bold text-[#26332F]">Hỏi tài liệu</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-[#718079]">“Giải thích phần này bằng ví dụ dễ hiểu.”</p>
                </div>
                <div className="rounded-2xl bg-[#FFF0EA] p-4">
                  <ClipboardCheck size={19} className="text-[#D95F38]" />
                  <p className="mt-4 text-xs font-bold text-[#26332F]">Luyện nhanh</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-[#718079]">10 câu · khoảng 8 phút</p>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-[#E2E7E3] p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#E1EEE8] text-[#2F6B58]"><BrainCircuit size={18} /></div>
                  <div>
                    <p className="text-xs font-extrabold text-[#26332F]">Ý chính cần nhớ</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-[#68756F]">Cầu co giãn khi lượng cầu thay đổi mạnh hơn mức thay đổi của giá.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      <section className="border-y border-[#E1E6E2] bg-white px-5 py-8">
        <div className="mx-auto grid max-w-5xl gap-6 text-center sm:grid-cols-3">
          {[['01', 'Tải tài liệu', 'Thêm giáo trình hoặc bài đọc của bạn.'], ['02', 'Học chủ động', 'Hỏi, tóm tắt và làm rõ phần khó.'], ['03', 'Kiểm tra lại', 'Luyện tập và xem phần cần ôn thêm.']].map(([number, title, text]) => (
            <div key={number} className="flex items-center gap-4 text-left sm:block sm:text-center">
              <span className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#E3EEE9] text-xs font-black text-[#2F6B58]">{number}</span>
              <div><h3 className="mt-0 text-sm font-extrabold sm:mt-3">{title}</h3><p className="mt-1 text-xs leading-relaxed text-[#6B7772]">{text}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#F6F7F2] px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ED7148]">Một nơi cho cả quá trình học</p>
            <h2 className="mt-4 text-balance text-3xl font-black tracking-[-0.035em] sm:text-5xl">Không chỉ trả lời. SmartStudy giúp bạn thật sự ghi nhớ.</h2>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {[
              { icon: FileText, title: 'Thư viện gọn gàng', text: 'Tất cả tài liệu được sắp xếp rõ ràng, luôn sẵn sàng để đọc, hỏi và ôn tập.', color: 'bg-[#E1EEE8] text-[#2F6B58]' },
              { icon: MessageCircleMore, title: 'Câu trả lời có căn cứ', text: 'Mỗi câu trả lời đều chỉ về đoạn nội dung liên quan để bạn dễ kiểm tra lại.', color: 'bg-[#FFF0EA] text-[#D95F38]' },
              { icon: ClipboardCheck, title: 'Luyện đúng phần cần học', text: 'Tạo bài luyện theo tài liệu, xem giải thích và quay lại phần mình còn yếu.', color: 'bg-[#ECE9F6] text-[#6650A4]' },
            ].map(({ icon: Icon, title, text, color }) => (
              <article key={title} className="rounded-[28px] border border-[#E0E6E2] bg-white p-7 shadow-[0_12px_36px_rgba(28,49,42,0.05)]">
                <div className={`grid h-12 w-12 place-items-center rounded-2xl ${color}`}><Icon size={22} /></div>
                <h3 className="mt-6 text-xl font-extrabold tracking-[-0.02em]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#66736D]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#18312A] px-5 py-16 text-white sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-8 text-center md:flex-row md:text-left">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9FC9B9]">Sẵn sàng bắt đầu?</p><h2 className="mt-2 text-3xl font-black tracking-[-0.035em]">Biến tài liệu tiếp theo thành một buổi học.</h2></div>
          <Button variant="secondary" size="lg" onClick={() => openAuth('register')} rightIcon={<ArrowRight size={18} />}>Bắt đầu miễn phí</Button>
        </div>
      </section>

      <footer className="flex flex-col items-center justify-between gap-3 bg-[#11251F] px-6 py-7 text-[11px] text-white/50 sm:flex-row">
        <span className="font-bold text-white/75">SmartStudy</span><span>© 2026 · Đồng hành cùng việc học mỗi ngày.</span>
      </footer>

      <Modal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} title={authMode === 'login' ? 'Chào mừng bạn trở lại' : 'Tạo tài khoản SmartStudy'} size="sm">
        <form onSubmit={handleAuthSubmit} className="space-y-4">
          <p className="-mt-1 mb-5 text-sm leading-relaxed text-[#69756F]">{authMode === 'login' ? 'Tiếp tục buổi học còn dang dở của bạn.' : 'Bắt đầu xây dựng thư viện học tập của riêng bạn.'}</p>
          {authMode === 'register' && <Input data-testid="auth-full-name-input" label="Tên của bạn" placeholder="Ví dụ: Minh Anh" value={name} onChange={(e) => setName(e.target.value)} required />}
          <Input data-testid="auth-email-input" label="Email" type="email" placeholder="ban@example.com" leftIcon={<Mail size={16} />} value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input data-testid="auth-password-input" label={authMode === 'register' ? 'Mật khẩu (ít nhất 12 ký tự)' : 'Mật khẩu'} type="password" placeholder="Nhập mật khẩu" leftIcon={<Lock size={16} />} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={authMode === 'register' ? 12 : 1} />
          {error && <div data-testid="auth-error" className="rounded-xl bg-[#FEE4E2] p-3 text-xs font-semibold text-[#9B251C]">{error}</div>}
          <Button data-testid="auth-submit" type="submit" size="lg" className="mt-2 w-full" isLoading={isLoading}>{authMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</Button>
          <div className="pt-2 text-center text-xs text-[#69756F]">{authMode === 'login' ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}<button data-testid="auth-mode-switch" type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setError(''); }} className="font-bold text-[#2F6B58] hover:underline">{authMode === 'login' ? 'Đăng ký miễn phí' : 'Đăng nhập'}</button></div>
        </form>
      </Modal>
    </div>
  );
};
