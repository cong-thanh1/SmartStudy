import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpenText,
  Brain,
  Check,
  ClipboardText,
  FileText,
  Lock,
  EnvelopeSimple,
  Quotes,
  ShieldCheck,
} from '@phosphor-icons/react';
import { Button, Input, Modal } from '../components';
import { authService } from '../services';

const workflow = [
  { index: '01', title: 'Đưa tài liệu vào', body: 'Tải giáo trình hoặc bài đọc. SmartStudy giữ nguyên ngữ cảnh của từng phiên học.', icon: FileText },
  { index: '02', title: 'Hỏi đến khi hiểu', body: 'Mỗi câu trả lời đi cùng trích dẫn để bạn kiểm tra lại đúng đoạn nguồn.', icon: Quotes },
  { index: '03', title: 'Luyện để nhớ', body: 'Tạo câu hỏi từ chính nội dung vừa đọc và quay lại phần kiến thức còn yếu.', icon: ClipboardText },
];

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

  const handleAuthSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      if (authMode === 'login') await authService.login(email, password);
      else await authService.register(email, password, name);
      navigate('/dashboard');
    } catch (caught: unknown) {
      const axiosError = caught as { response?: { data?: { error?: { message?: string } } } };
      const serverMessage = axiosError?.response?.data?.error?.message;
      if (authMode === 'register' && serverMessage?.includes('12')) setError('Mật khẩu cần có ít nhất 12 ký tự.');
      else if (serverMessage?.includes('already')) setError('Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.');
      else setError(serverMessage || (authMode === 'login' ? 'Email hoặc mật khẩu chưa đúng.' : 'Chưa thể tạo tài khoản. Vui lòng thử lại.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-paper text-ink">
      <header className="dt-shell flex h-20 items-center justify-between border-b border-rule">
        <button type="button" onClick={() => navigate('/welcome')} className="group flex items-center gap-3" aria-label="Trang chủ SmartStudy">
          <span className="grid h-10 w-10 place-items-center rounded-[0.7rem] border border-ink bg-ink text-paper transition-transform duration-300 group-hover:-rotate-3">
            <BookOpenText size={19} weight="duotone" />
          </span>
          <span>
            <span className="block text-left font-display text-lg font-semibold tracking-[-0.04em]">SmartStudy</span>
            <span className="block text-left font-mono text-[8px] uppercase tracking-[0.16em] text-muted">learning signal</span>
          </span>
        </button>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted sm:flex"><span className="dt-status-pulse" /> System ready</span>
          <button data-testid="auth-login-open" onClick={() => openAuth('login')} className="hm-affordance rounded-[var(--radius-control)] border border-rule-strong bg-surface px-4 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:border-ink">Đăng nhập</button>
        </div>
      </header>

      <main>
        <section className="dt-shell grid min-h-[calc(100dvh-5rem)] grid-cols-1 content-center gap-12 py-16 md:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] md:gap-8 lg:py-24">
          <div className="page-enter md:pr-[7vw]">
            <p className="dt-rule-label">PDF → hiểu → nhớ</p>
            <h1 className="mt-8 max-w-[10ch] text-[clamp(3.1rem,7vw,6.7rem)] leading-[0.88] tracking-[-0.075em]">
              Học sâu hơn từ tài liệu đang có.
            </h1>
            <p className="mt-8 max-w-[58ch] text-base leading-7 text-muted sm:text-lg sm:leading-8">
              Một không gian đọc, hỏi và luyện tập được nối với chính giáo trình của bạn. Không đoán nguồn. Không mất mạch học.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button data-testid="auth-register-open" size="lg" onClick={() => openAuth('register')} rightIcon={<ArrowRight size={18} weight="bold" />}>Bắt đầu với một PDF</Button>
              <Button variant="ghost" size="lg" onClick={() => document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' })}>Xem cách hoạt động</Button>
            </div>
          </div>

          <div className="reveal-cascade relative self-center md:translate-y-12" style={{ '--reveal-index': 2 } as React.CSSProperties}>
            <div className="dt-panel overflow-hidden p-4 sm:p-5">
              <div className="flex items-center justify-between border-b border-rule pb-4">
                <div className="flex items-center gap-2"><span className="dt-status-pulse" /><span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Live study trace</span></div>
                <span className="font-mono text-[10px] text-muted">12:42</span>
              </div>
              <div className="py-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">Kinh tế vi mô / chương 03</p>
                <p className="mt-3 text-lg font-semibold leading-6 tracking-[-0.03em]">Độ co giãn của cầu phản ứng thế nào khi giá thay đổi?</p>
                <div className="mt-6 border-l-2 border-accent pl-4">
                  <p className="text-sm leading-6 text-muted">Lượng cầu thay đổi mạnh hơn tỷ lệ thay đổi của giá khi cầu co giãn.</p>
                  <p className="mt-3 font-mono text-[10px] text-accent">Nguồn · trang 42–43</p>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-xl bg-ink px-4 py-3 text-paper">
                <div><p className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/45">Recall prompt</p><p className="mt-1 text-sm">Giải thích bằng ví dụ của bạn</p></div>
                <Brain size={24} weight="duotone" className="text-paper/70" />
              </div>
            </div>
            <div className="absolute -bottom-5 -left-4 hidden rounded-xl border border-rule bg-accent-soft px-4 py-3 shadow-[var(--shadow-float)] sm:block md:-left-8">
              <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-accent">Session</p>
              <p className="mt-1 text-sm font-semibold">8 ý đã nắm · 2 cần ôn</p>
            </div>
          </div>
        </section>

        <div className="dt-ticker border-y border-ink bg-ink py-3 text-paper">
          <div className="dt-ticker-track font-mono text-[10px] uppercase tracking-[0.14em] text-paper/60">
            {[0, 1].map((copy) => <div key={copy} className="flex shrink-0 gap-12 pr-12"><span>Trích dẫn có nguồn</span><span>Tóm tắt theo chương</span><span>Luyện tập theo tài liệu</span><span>Phản hồi ngay sau câu sai</span></div>)}
          </div>
        </div>

        <section id="workflow" className="dt-shell py-20 sm:py-28" aria-labelledby="workflow-title">
          <div className="grid gap-8 border-b border-rule pb-12 md:grid-cols-[0.65fr_1.35fr] md:items-end">
            <p className="dt-rule-label">Một phiên học rõ ràng</p>
            <h2 id="workflow-title" className="max-w-[16ch] text-4xl sm:text-6xl">Không thêm công cụ. Chỉ bớt ma sát.</h2>
          </div>
          <ol className="divide-y divide-rule">
            {workflow.map(({ index, title, body, icon: Icon }, itemIndex) => (
              <li key={index} className="reveal-cascade grid gap-6 py-10 md:grid-cols-[5rem_0.8fr_1.2fr_auto] md:items-center" style={{ '--reveal-index': itemIndex } as React.CSSProperties}>
                <span className="font-mono text-xs text-accent">{index}</span>
                <Icon size={28} weight="duotone" className="text-ink" />
                <div><h3 className="text-2xl sm:text-3xl">{title}</h3><p className="mt-3 max-w-[54ch] text-sm leading-6 text-muted">{body}</p></div>
                <ArrowRight size={19} className="hidden text-rule-strong md:block" />
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-accent-soft">
          <div className="dt-shell grid gap-10 py-16 md:grid-cols-[1.2fr_0.8fr] md:items-center sm:py-20">
            <div><p className="dt-kicker">Bắt đầu từ nội dung thật</p><h2 className="mt-4 max-w-[15ch] text-4xl sm:text-5xl">Mang tài liệu khó nhất của bạn vào.</h2></div>
            <div className="md:justify-self-end"><Button size="lg" onClick={() => openAuth('register')} rightIcon={<ArrowRight size={18} weight="bold" />}>Tạo không gian học</Button><div className="mt-4 flex flex-col gap-2 text-xs text-muted sm:flex-row sm:gap-5"><span className="flex items-center gap-2"><Check size={14} weight="bold" className="text-accent" />Thiết lập trong vài phút</span><span className="flex items-center gap-2"><ShieldCheck size={15} weight="duotone" className="text-accent" />Dữ liệu được tách biệt</span></div></div>
          </div>
        </section>
      </main>

      <footer className="bg-ink text-paper">
        <div className="dt-shell grid gap-10 py-12 sm:grid-cols-[1fr_auto] sm:items-end">
          <div><p className="font-display text-2xl font-semibold tracking-[-0.04em]">SmartStudy</p><p className="mt-2 max-w-md text-sm text-paper/45">Đọc từ nguồn. Hiểu bằng câu hỏi. Nhớ qua luyện tập.</p></div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-paper/35">© 2026 · Learning signal desk</p>
        </div>
      </footer>

      <Modal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} title={authMode === 'login' ? 'Tiếp tục phiên học' : 'Tạo không gian SmartStudy'} size="sm">
        <form onSubmit={handleAuthSubmit} className="space-y-4">
          <p className="-mt-1 mb-5 text-sm leading-relaxed text-muted">{authMode === 'login' ? 'Mở lại tài liệu và tiến độ gần nhất của bạn.' : 'Bắt đầu xây thư viện học tập từ tài liệu của riêng bạn.'}</p>
          {authMode === 'register' && <Input data-testid="auth-full-name-input" label="Tên của bạn" placeholder="Ví dụ: Minh Anh" value={name} onChange={(event) => setName(event.target.value)} required />}
          <Input data-testid="auth-email-input" label="Email" type="email" placeholder="ban@example.com" leftIcon={<EnvelopeSimple size={17} />} value={email} onChange={(event) => setEmail(event.target.value)} required />
          <Input data-testid="auth-password-input" label={authMode === 'register' ? 'Mật khẩu (ít nhất 12 ký tự)' : 'Mật khẩu'} type="password" placeholder="Nhập mật khẩu" leftIcon={<Lock size={17} />} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={authMode === 'register' ? 12 : 1} />
          {error && <div data-testid="auth-error" className="rounded-xl border border-error/15 bg-error-soft p-3 text-sm font-semibold text-error">{error}</div>}
          <Button data-testid="auth-submit" type="submit" size="lg" className="mt-2 w-full" isLoading={isLoading}>{authMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</Button>
          <div className="pt-2 text-center text-sm text-muted">{authMode === 'login' ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}<button data-testid="auth-mode-switch" type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setError(''); }} className="hm-affordance font-semibold text-accent underline decoration-accent/35 underline-offset-4 hover:decoration-accent">{authMode === 'login' ? 'Đăng ký' : 'Đăng nhập'}</button></div>
        </form>
      </Modal>
    </div>
  );
};
