import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpenText, BrainCircuit, Check, ClipboardCheck, FileText, Lock, Mail, MessageCircleMore, ShieldCheck } from 'lucide-react';
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
    <div className="min-h-dvh bg-paper text-ink">
      <header className="hm-shell flex h-20 items-center justify-between border-b border-rule">
        <button type="button" onClick={() => navigate('/welcome')} className="flex items-center gap-3" aria-label="Trang chủ SmartStudy">
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-ink bg-ink text-paper"><BookOpenText size={18} /></span>
          <span className="font-display text-lg font-bold tracking-[-0.03em]">SmartStudy</span>
        </button>
        <button data-testid="auth-login-open" onClick={() => openAuth('login')} className="hm-affordance border-b border-ink px-1 text-sm font-semibold text-ink transition-colors duration-150 hover:border-accent hover:text-accent">Đăng nhập</button>
      </header>

      <main>
        <section className="hm-shell grid min-h-[calc(82dvh-5rem)] content-end border-b border-rule pb-12 pt-20 sm:pb-16 lg:pb-20">
          <h1 className="max-w-[12ch] [font-size:var(--text-display)] leading-[0.96] tracking-[-0.055em]">
            Tài liệu vào.<br />Kiến thức ở lại.
          </h1>
          <div className="mt-8 flex flex-col gap-3 border-t border-rule pt-5 font-mono text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
            <span>01 · đọc &nbsp; 02 · hiểu &nbsp; 03 · luyện</span>
            <span>SmartStudy / study workflow</span>
          </div>
        </section>

        <section className="hm-shell py-16 sm:py-24" aria-labelledby="workflow-title">
          <div className="grid gap-8 border-b border-rule pb-12 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:items-end">
            <h2 id="workflow-title" className="max-w-[15ch] text-3xl sm:text-5xl">Một phiên học, ba bước rõ ràng.</h2>
            <p className="max-w-[62ch] text-base leading-7 text-muted lg:justify-self-end">Tải giáo trình hoặc bài đọc lên. SmartStudy giữ mọi câu hỏi, bản tóm tắt và bài luyện gắn với chính tài liệu đó để bạn luôn biết thông tin đến từ đâu.</p>
          </div>

          <ol className="divide-y divide-rule">
            <li className="grid gap-8 py-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
              <div><span className="hm-data block text-sm text-accent">1.0 / ĐỌC</span><h3 className="mt-5 text-2xl sm:text-3xl">Đặt tài liệu vào đúng chỗ.</h3><p className="mt-4 max-w-[48ch] leading-7 text-muted">Thư viện giữ giáo trình, bài giảng và tài liệu ôn tập theo trạng thái xử lý. Mở lại đúng nội dung mà không phải thiết lập lại phiên học.</p></div>
              <div className="grid min-w-0 gap-4 rounded-xl border border-rule bg-surface p-5">
                <div className="flex items-center gap-4"><FileText className="text-accent" /><div><p className="font-semibold">Kinh tế vi mô · Chương 3</p><p className="mt-1 text-sm text-muted">PDF · đã sẵn sàng để học</p></div></div>
                <div className="flex flex-wrap gap-2 border-t border-rule pt-4 text-sm"><span className="rounded-full bg-accent-soft px-3 py-1 text-accent">Đọc</span><span className="rounded-full bg-paper-2 px-3 py-1 text-muted">Tóm tắt</span><span className="rounded-full bg-paper-2 px-3 py-1 text-muted">Luyện tập</span></div>
              </div>
            </li>

            <li className="grid gap-8 py-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
              <div><span className="hm-data block text-sm text-accent">2.0 / HIỂU</span><h3 className="mt-5 text-2xl sm:text-3xl">Hỏi ngay tại phần còn vướng.</h3><p className="mt-4 max-w-[48ch] leading-7 text-muted">Câu trả lời đi kèm trích dẫn để bạn kiểm tra lại đoạn liên quan. Bản tóm tắt giữ ý chính trong một mạch đọc ngắn.</p></div>
              <div className="space-y-4 rounded-xl border border-rule bg-surface p-5">
                <div className="flex gap-3"><MessageCircleMore className="mt-1 shrink-0 text-accent" size={18} /><p className="text-sm leading-6 text-ink-2">“Giải thích độ co giãn của cầu bằng một ví dụ dễ kiểm tra.”</p></div>
                <div className="border-l border-accent pl-4"><p className="text-sm leading-6 text-muted">Khi giá thay đổi ít nhưng lượng cầu thay đổi mạnh, cầu được xem là co giãn.</p><p className="mt-2 font-mono text-xs text-accent">Nguồn · Chương 3, mục 3.2</p></div>
              </div>
            </li>

            <li className="grid gap-8 py-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
              <div><span className="hm-data block text-sm text-accent">3.0 / LUYỆN</span><h3 className="mt-5 text-2xl sm:text-3xl">Kiểm tra phần vừa học.</h3><p className="mt-4 max-w-[48ch] leading-7 text-muted">Tạo câu hỏi từ tài liệu, xem giải thích cho đáp án sai và quay lại đúng phần kiến thức cần ôn.</p></div>
              <div className="grid gap-4 border-y border-rule py-5 sm:grid-cols-2">
                <div className="flex items-start gap-3"><ClipboardCheck className="mt-1 shrink-0 text-signal" size={18} /><div><p className="font-semibold">Bài luyện theo tài liệu</p><p className="mt-1 text-sm leading-6 text-muted">Chọn số câu và mức độ trước khi bắt đầu.</p></div></div>
                <div className="flex items-start gap-3"><BrainCircuit className="mt-1 shrink-0 text-accent" size={18} /><div><p className="font-semibold">Giải thích sau mỗi lượt</p><p className="mt-1 text-sm leading-6 text-muted">Biết vì sao sai và nên đọc lại ở đâu.</p></div></div>
              </div>
            </li>
          </ol>

          <div className="grid gap-8 pt-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div><p className="text-lg font-semibold">Bắt đầu với tài liệu bạn đang cần học.</p><div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted"><span className="flex items-center gap-2"><Check size={15} className="text-accent" /> Không cần thiết lập phức tạp</span><span className="flex items-center gap-2"><ShieldCheck size={15} className="text-accent" /> Dữ liệu của từng người học được tách biệt</span></div></div>
            <Button data-testid="auth-register-open" size="lg" onClick={() => openAuth('register')} rightIcon={<ArrowRight size={18} />}>Tạo tài khoản</Button>
          </div>
        </section>
      </main>

      <footer className="bg-ink text-paper">
        <div className="hm-shell py-14 sm:py-20">
          <p className="max-w-[28ch] font-display text-3xl font-bold leading-tight tracking-[-0.035em] sm:text-5xl">Một tài liệu tốt xứng đáng với một phiên học tập trung.</p>
          <div className="mt-12 flex flex-col gap-3 border-t border-ink-2 pt-5 text-sm text-paper/70 sm:flex-row sm:items-center sm:justify-between"><span className="font-semibold text-paper">SmartStudy</span><span>© 2026 · Học từ chính tài liệu của bạn.</span></div>
        </div>
      </footer>

      <Modal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} title={authMode === 'login' ? 'Chào mừng bạn trở lại' : 'Tạo tài khoản SmartStudy'} size="sm">
        <form onSubmit={handleAuthSubmit} className="space-y-4">
          <p className="-mt-1 mb-5 text-sm leading-relaxed text-[var(--color-muted)]">{authMode === 'login' ? 'Tiếp tục buổi học còn dang dở của bạn.' : 'Bắt đầu xây dựng thư viện học tập của riêng bạn.'}</p>
          {authMode === 'register' && <Input data-testid="auth-full-name-input" label="Tên của bạn" placeholder="Ví dụ: Minh Anh" value={name} onChange={(e) => setName(e.target.value)} required />}
          <Input data-testid="auth-email-input" label="Email" type="email" placeholder="ban@example.com" leftIcon={<Mail size={16} />} value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input data-testid="auth-password-input" label={authMode === 'register' ? 'Mật khẩu (ít nhất 12 ký tự)' : 'Mật khẩu'} type="password" placeholder="Nhập mật khẩu" leftIcon={<Lock size={16} />} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={authMode === 'register' ? 12 : 1} />
          {error && <div data-testid="auth-error" className="rounded-lg bg-error-soft p-3 text-sm font-semibold text-error">{error}</div>}
          <Button data-testid="auth-submit" type="submit" size="lg" className="mt-2 w-full" isLoading={isLoading}>{authMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</Button>
          <div className="pt-2 text-center text-sm text-muted">{authMode === 'login' ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}<button data-testid="auth-mode-switch" type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setError(''); }} className="hm-affordance font-semibold text-accent underline decoration-rule-strong underline-offset-4 hover:decoration-accent">{authMode === 'login' ? 'Đăng ký' : 'Đăng nhập'}</button></div>
        </form>
      </Modal>
    </div>
  );
};
