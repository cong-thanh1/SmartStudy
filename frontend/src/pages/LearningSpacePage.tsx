import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChatCenteredText as MessageSquare,
  Sparkle as Sparkles,
  PaperPlaneTilt as Send,
  BookOpen,
  GraduationCap,
  Stack as Layers,
  CaretRight as ChevronRight,
  ArrowClockwise as RefreshCw,
  Question as HelpCircle,
  Lightbulb,
  FileText as FileQuestion,
  ChartBar as BarChart3,
  ArrowLeft,
  FileText,
  DotsThree as MoreHorizontal,
  SidebarSimple as PanelRightClose,
  SidebarSimple as PanelRightOpen,
  UploadSimple as UploadCloud,
  X,
} from '@phosphor-icons/react';
import { Button, Card, Badge, ChatBubble, FormattedText, LoadingSpinner } from '../components';
import { documentService, chatService, summaryService, tutorService } from '../services';
import { Document, DocumentChapter, DocumentPreviewChunk, Message, Summary, Citation } from '../types';
import { clsx } from 'clsx';

export const LearningSpacePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const docIdParam = searchParams.get('docId');

  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [selectedDocId, setSelectedDocId] = useState<string>(docIdParam || '');
  const [activeTab, setActiveTab] = useState<'rag' | 'summary' | 'tutor'>('rag');
  const [isReaderOpen, setIsReaderOpen] = useState(false);

  // Document chat state
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Summary State
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryType, setSummaryType] = useState<'FULL' | 'CHAPTER'>('FULL');
  const [chapters, setChapters] = useState<readonly DocumentChapter[]>([]);
  const [previewChunks, setPreviewChunks] = useState<readonly DocumentPreviewChunk[]>([]);
  const [previewPageCount, setPreviewPageCount] = useState<number | null>(null);
  const [selectedChapterRef, setSelectedChapterRef] = useState('');
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Tutor State
  const [tutorQuestion, setTutorQuestion] = useState('');
  const [tutorAnswer, setTutorAnswer] = useState<string | null>(null);
  const [tutorError, setTutorError] = useState<string | null>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [isAskingTutor, setIsAskingTutor] = useState(false);
  const [useDocumentTutorContext, setUseDocumentTutorContext] = useState(true);

  // Citation Preview Highlight in PDF Viewer
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const docs = await documentService.listDocuments();
        setDocuments(docs);
        if (docs.length > 0 && !selectedDocId) {
          setSelectedDocId(docs[0].id);
        }
      } catch {
        // Handle fetch error
      } finally {
        setIsLoadingDocuments(false);
      }
    };
    init();
  }, [selectedDocId]);

  useEffect(() => {
    let cancelled = false;

    if (selectedDocId) {
      setSearchParams({ docId: selectedDocId });
      setMessages([]);
      setSummary(null);
      setSummaryError(null);
      setTutorAnswer(null);
      setTutorError(null);
      setSuggestedQuestions([]);
      setActiveCitation(null);
      setPreviewChunks([]);
      setPreviewPageCount(null);
      documentService.getDocumentPreview(selectedDocId).then((document) => {
        if (cancelled) return;
        const nextChapters = document.chapters || [];
        setChapters(nextChapters);
        setPreviewChunks(document.chunks);
        setPreviewPageCount(document.pageCount);
        setSelectedChapterRef(nextChapters[0]?.chapterTitle || '');
      }).catch(() => {
        if (cancelled) return;
        setChapters([]);
        setPreviewChunks([]);
        setPreviewPageCount(null);
        setSelectedChapterRef('');
      });
      chatService.listConversations(selectedDocId).then(async (convs) => {
        if (cancelled) return;
        if (convs.length > 0) {
          const conversation = convs[0]!;
          setActiveConversationId(conversation.id);
          const history = await chatService.listMessages(conversation.id);
          if (!cancelled) setMessages(history);
        } else {
          const newConv = await chatService.createConversation('Hỏi đáp tài liệu: ' + selectedDocId, selectedDocId);
          if (!cancelled) setActiveConversationId(newConv.id);
        }
      }).catch(() => {
        if (!cancelled) setActiveConversationId('');
      });
    }

    return () => {
      cancelled = true;
    };
  }, [selectedDocId, setSearchParams]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeTab === 'rag') {
      scrollToBottom();
    }
  }, [messages, activeTab]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isSending) return;

    let convId = activeConversationId;
    if (!convId) {
      const newConv = await chatService.createConversation('Hội thoại mới', selectedDocId);
      convId = newConv.id;
      setActiveConversationId(convId);
    }

    const userMsg: Message = {
      id: 'usr-' + Date.now(),
      conversationId: convId,
      role: 'user',
      content: inputMessage,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    const prompt = inputMessage;
    setInputMessage('');
    setIsSending(true);

    try {
      const aiReply = await chatService.sendMessage(convId, prompt);
      setMessages((prev) => [...prev, aiReply]);
    } finally {
      setIsSending(false);
    }
  };

  const handleGenerateSummary = async (type: 'FULL' | 'CHAPTER') => {
    if (!selectedDocId) return;
    if (type === 'CHAPTER' && !selectedChapterRef) return;
    setIsLoadingSummary(true);
    setSummaryError(null);
    try {
      // Use generateSummary (POST) which triggers LLM generation
      const chapterRef = type === 'CHAPTER' ? selectedChapterRef : undefined;
      const res = await summaryService.generateSummary(
        selectedDocId,
        type === 'FULL' ? 'full' : 'chapter',
        chapterRef,
      );
      setSummary(res);
    } catch {
      // If POST fails (already exists), try GET
      try {
        const chapterRef = type === 'CHAPTER' ? selectedChapterRef : undefined;
        const res = await summaryService.getSummary(selectedDocId, type, chapterRef);
        setSummary(res);
      } catch {
        setSummaryError('Chưa thể tạo tóm tắt. Hãy kiểm tra máy AI local đang bật và kết nối, sau đó bấm “Tạo lại”.');
      }
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const handleAskTutor = async (questionToAsk: string) => {
    if (!questionToAsk.trim() || isAskingTutor) return;
    setIsAskingTutor(true);
    setTutorError(null);
    try {
      const res = await tutorService.askTutor({
        question: questionToAsk,
        ...(useDocumentTutorContext && selectedDocId
          ? { documentId: selectedDocId }
          : {}),
      });
      setTutorAnswer(res.answer);
      if (res.suggestedQuestions) {
        setSuggestedQuestions(res.suggestedQuestions);
      }
    } catch {
      setTutorError('Gia sư AI chưa thể trả lời. Hãy kiểm tra máy ASUS đang chạy Ollama và Cloudflare relay, rồi thử lại.');
    } finally {
      setIsAskingTutor(false);
    }
  };

  const currentDoc = documents.find((d) => d.id === selectedDocId) || documents[0];

  if (isLoadingDocuments) {
    return <Card className="mx-auto flex min-h-[420px] max-w-3xl items-center justify-center"><LoadingSpinner text="Đang mở phòng học..." /></Card>;
  }

  if (documents.length === 0) {
    return (
      <Card className="soft-grid page-enter mx-auto flex min-h-[480px] max-w-3xl flex-col items-center justify-center border-2 border-dashed border-[var(--color-rule-strong)] bg-surface/75 p-8 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]"><BookOpen size={29} /></div>
        <h2 className="mt-6 text-2xl font-black tracking-[-0.03em]">Thêm tài liệu để bắt đầu học</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-[var(--color-muted)]">Phòng học sẽ giúp bạn đọc, đặt câu hỏi và tóm tắt nội dung từ tài liệu của mình.</p>
        <Button className="mt-6" onClick={() => navigate('/dashboard')} leftIcon={<UploadCloud size={17} />}>Đến thư viện tài liệu</Button>
      </Card>
    );
  }

  return (
    <div className="flex min-h-0 w-full flex-col gap-4">
      <header className="flex flex-col gap-4 border-b border-rule pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            aria-label="Quay lại danh sách tài liệu"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-paper-3 hover:text-ink"
          >
            <ArrowLeft size={19} />
          </button>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
            <FileText size={20} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-[var(--color-ink)]">{currentDoc?.title || 'Tài liệu học tập'}</p>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">{previewPageCount ? `${previewPageCount} trang` : 'Đang tải thông tin tài liệu'}</p>
          </div>
          <Badge variant={currentDoc?.status === 'ready' ? 'success' : 'warning'} size="sm" className="ml-1 shrink-0">
            {currentDoc?.status === 'ready' ? 'Đã sẵn sàng' : 'Đang xử lý'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={isReaderOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            onClick={() => setIsReaderOpen((open) => !open)}
            data-testid="document-reader-toggle"
          >
            {isReaderOpen ? 'Đóng tài liệu' : 'Mở tài liệu'}
          </Button>
          <button
            type="button"
            aria-label="Thao tác tài liệu"
            className="grid h-11 w-11 place-items-center rounded-lg text-muted hover:bg-paper-3 hover:text-ink"
          >
            <MoreHorizontal size={20} />
          </button>
        </div>
      </header>

      <div
        data-testid="learning-workspace"
        className={clsx(
          'grid h-[clamp(28rem,calc(100dvh-13.5rem),52rem)] min-h-0 min-w-0 gap-4 lg:h-[clamp(28rem,calc(100dvh-15rem),52rem)]',
          isReaderOpen ? 'lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]' : 'grid-cols-1',
        )}
      >
      {/* Source reader: fixed drawer on mobile, bounded rail on desktop. */}
      {isReaderOpen && (
      <>
      <button
        type="button"
        className="fixed inset-0 z-[var(--z-dropdown)] bg-ink/45 backdrop-blur-sm lg:hidden"
        onClick={() => setIsReaderOpen(false)}
        aria-label="Đóng tài liệu"
      />
      <Card
        data-testid="document-reader"
        className="fixed inset-x-3 bottom-3 top-[5.25rem] z-[var(--z-sticky)] flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--radius-panel)] p-0 shadow-[var(--shadow-float)] lg:relative lg:inset-auto lg:z-auto lg:order-2 lg:h-full lg:rounded-[var(--radius-card)] lg:shadow-[var(--shadow-whisper)]"
      >
        {/* Document Selector Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-paper/10 bg-[var(--color-ink)] p-3.5 text-paper">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <BookOpen className="h-5 w-5 shrink-0 text-[var(--color-accent-soft)]" />
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-paper/20 bg-ink-2 px-3 py-2 text-sm font-semibold text-paper outline-2 outline-transparent outline-offset-1 focus-visible:outline-focus"
            >
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title}
                </option>
              ))}
            </select>
          </div>
          <Badge variant="success" size="sm" className="hidden shrink-0 sm:inline-flex">Sẵn sàng học</Badge>
          <button
            type="button"
            onClick={() => setIsReaderOpen(false)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-paper/60 transition-colors hover:bg-white/10 hover:text-paper lg:hidden"
            aria-label="Đóng tài liệu"
            data-testid="document-reader-close"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Extracted document preview */}
        <div data-testid="document-reader-scroll" className="scrollbar-subtle relative min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain bg-[var(--color-paper-3)] p-4 sm:p-5">
          {activeCitation && (
            <div className="rounded-lg border border-rule-strong bg-warning-soft p-4 text-warning">
              <div className="mb-1 flex items-center justify-between text-xs font-bold">
                <span>Đoạn được nhắc đến · Trang {activeCitation.pageNumber || 1}</span>
                <button
                  onClick={() => setActiveCitation(null)}
                  className="hm-affordance font-normal underline underline-offset-4"
                >
                  Đóng
                </button>
              </div>
              <p className="text-sm font-medium">&ldquo;{activeCitation.snippet}&rdquo;</p>
            </div>
          )}

          <article className="mx-auto w-full max-w-[65ch] space-y-5 bg-surface p-6 sm:p-8">
            <div className="border-b border-[var(--color-rule)] pb-4 flex items-center justify-between">
              <h3 className="font-bold text-base text-[var(--color-ink)]">{currentDoc?.title || 'Tài liệu học tập'}</h3>
              <span className="text-xs font-semibold text-[var(--color-muted)]">
                {previewPageCount ? `${previewPageCount} trang` : 'Đang tải nội dung'}
              </span>
            </div>

            {previewChunks.length > 0 ? (
              <div className="space-y-7 text-base leading-[1.7] text-ink-2">
                {previewChunks.map((chunk, index) => (
                  <section key={`${chunk.pageStart ?? 'unknown'}-${index}`} className="space-y-2">
                    {(chunk.chapterTitle || chunk.pageStart) && (
                      <h4 className="text-lg text-ink-2">
                        {chunk.chapterTitle || 'Nội dung tài liệu'}
                        {chunk.pageStart ? ` — Trang ${chunk.pageStart}${chunk.pageEnd && chunk.pageEnd !== chunk.pageStart ? `–${chunk.pageEnd}` : ''}` : ''}
                      </h4>
                    )}
                    <p className="whitespace-pre-wrap">{chunk.text}</p>
                  </section>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--color-muted)]">
                Chưa có nội dung trích xuất. Hãy chờ tài liệu xử lý xong hoặc tải lại trang.
              </p>
            )}
          </article>
        </div>
      </Card>
      </>
      )}

      {/* Chat is the primary surface and never grows beyond the workspace. */}
      <Card
        data-testid="chat-workspace"
        className={clsx(
          'order-1 flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--radius-card)] p-0',
          !isReaderOpen && 'mx-auto w-full max-w-[64rem]',
        )}
      >
        {/* Navigation Tabs Header */}
        <div className="scrollbar-subtle flex items-center gap-5 overflow-x-auto border-b border-rule bg-surface px-4 pt-2 sm:px-5" role="tablist" aria-label="Công cụ học tập">
          <button
            data-testid="chat-tab"
            onClick={() => setActiveTab('rag')}
            className={clsx(
              'hm-affordance flex shrink-0 items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors duration-150',
              activeTab === 'rag'
                ? 'border-accent text-ink'
                : 'border-transparent text-muted hover:text-ink'
            )}
          >
            <MessageSquare size={16} />
            <span>Hỏi tài liệu</span>
          </button>

          <button
            data-testid="summary-tab"
            onClick={() => {
              setActiveTab('summary');
            }}
            className={clsx(
              'hm-affordance flex shrink-0 items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors duration-150',
              activeTab === 'summary'
                ? 'border-accent text-ink'
                : 'border-transparent text-muted hover:text-ink'
            )}
          >
            <Layers size={16} />
            <span>Tóm tắt</span>
          </button>

          <button
            data-testid="tutor-tab"
            onClick={() => setActiveTab('tutor')}
            className={clsx(
              'hm-affordance flex shrink-0 items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors duration-150',
              activeTab === 'tutor'
                ? 'border-accent text-ink'
                : 'border-transparent text-muted hover:text-ink'
            )}
          >
            <GraduationCap size={16} />
            <span>Trợ lý học tập</span>
          </button>

          <button
            type="button"
            onClick={() => navigate(`/exam-center${selectedDocId ? `?docId=${selectedDocId}` : ''}`)}
            className="hm-affordance flex shrink-0 items-center gap-2 border-b-2 border-transparent px-1 py-3 text-sm font-medium text-muted transition-colors duration-150 hover:text-ink"
          >
            <FileQuestion size={16} />
            <span>Bài kiểm tra</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/results')}
            className="hm-affordance flex shrink-0 items-center gap-2 border-b-2 border-transparent px-1 py-3 text-sm font-medium text-muted transition-colors duration-150 hover:text-ink"
          >
            <BarChart3 size={16} />
            <span>Kết quả</span>
          </button>
        </div>

        {/* Tab 1: document chat */}
        {activeTab === 'rag' && (
          <div className="flex min-h-0 flex-1 flex-col bg-paper">
            <div data-testid="chat-message-scroll" className="scrollbar-subtle min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
              {messages.length === 0 && !isSending && (
                <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center py-8 text-left">
                  <div className="grid h-11 w-11 place-items-center rounded-xl border border-accent/20 bg-accent-soft text-accent"><MessageSquare size={21} weight="duotone" /></div>
                  <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.12em] text-accent">Hỏi theo tài liệu</p>
                  <h2 className="mt-2 text-2xl text-ink sm:text-3xl">Bắt đầu từ điều bạn chưa rõ.</h2>
                  <p className="mt-3 max-w-[54ch] text-sm leading-6 text-muted">Trợ lý chỉ dùng nội dung đang mở và luôn kèm nguồn để bạn kiểm tra lại.</p>
                  <div className="mt-6 flex flex-wrap gap-2" aria-label="Câu hỏi gợi ý">
                    {['Tóm tắt ý chính', 'Giải thích đoạn khó', 'Tạo 5 câu ôn tập'].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setInputMessage(prompt)}
                        className="hm-affordance rounded-full border border-rule-strong bg-surface px-3.5 py-2 text-xs font-semibold text-ink transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:text-accent"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  onSelectCitation={(cite) => {
                    setActiveCitation(cite);
                    setIsReaderOpen(true);
                  }}
                />
              ))}
              {isSending && (
                <div className="flex w-fit items-center gap-3 rounded-lg border border-rule bg-surface p-4">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-rule border-t-accent" aria-hidden="true" />
                  <span className="text-sm font-semibold text-ink-2">
                    Đang tìm trong tài liệu để trả lời bạn…
                  </span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input Box */}
            <form onSubmit={handleSendMessage} className="shrink-0 border-t border-rule bg-surface/92 px-3 pb-3 pt-2 backdrop-blur-xl sm:px-5 sm:pb-4">
              <div className="flex items-end gap-2 rounded-2xl border border-rule-strong bg-paper p-2.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.8),0_18px_40px_-30px_rgb(24_26_24/0.5)] outline-2 outline-transparent outline-offset-1 transition-[border-color,box-shadow] duration-200 focus-within:border-accent focus-within:shadow-[0_0_0_4px_rgb(49_89_216/0.07)] focus-within:outline-focus">
              <textarea
                data-testid="chat-input"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={1}
                placeholder="Hỏi một điều bạn chưa hiểu trong tài liệu..."
                disabled={isSending}
                className="max-h-32 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 text-ink placeholder:text-muted focus:outline-none"
              />
              <Button
                data-testid="chat-send-button"
                type="submit"
                variant="primary"
                size="md"
                disabled={!inputMessage.trim() || isSending}
                aria-label="Gửi câu hỏi"
                className="h-11 w-11 shrink-0 rounded-xl px-0"
              >
                <Send size={16} />
              </Button>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[10px] text-muted sm:text-xs">
                <span>Enter để gửi · Shift + Enter để xuống dòng</span>
                <button type="button" onClick={() => setIsReaderOpen(true)} className="hidden font-semibold text-accent hover:underline sm:inline">Mở nguồn</button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: summary */}
        {activeTab === 'summary' && (
          <div className="flex-1 space-y-6 overflow-y-auto bg-[var(--color-paper)] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--color-rule)] bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Button
                  data-testid="summary-full-btn"
                  variant={summaryType === 'FULL' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setSummaryType('FULL');
                    handleGenerateSummary('FULL');
                  }}
                >
                  Toàn bộ tài liệu
                </Button>
                <Button
                  data-testid="summary-chapter-btn"
                  variant={summaryType === 'CHAPTER' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setSummaryType('CHAPTER');
                  }}
                  disabled={chapters.length === 0}
                >
                  Theo từng chương
                </Button>
              </div>

              {summaryType === 'CHAPTER' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--color-muted)]">Chọn chương:</span>
                  <select
                    data-testid="summary-chapter-select"
                    value={selectedChapterRef}
                    onChange={(e) => {
                      setSelectedChapterRef(e.target.value);
                    }}
                    className="rounded-lg border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-3 py-1 text-xs font-semibold text-[var(--color-ink)]"
                  >
                    {chapters.map((chapter) => (
                      <option key={chapter.chapterTitle} value={chapter.chapterTitle}>
                        {chapter.chapterTitle} (trang {chapter.startPage}-{chapter.endPage})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <Button
                data-testid="summary-generate-btn"
                variant="outline"
                size="sm"
                leftIcon={<RefreshCw size={14} className={clsx(isLoadingSummary && 'animate-spin')} />}
                onClick={() => handleGenerateSummary(summaryType)}
                disabled={isLoadingSummary || (summaryType === 'CHAPTER' && !selectedChapterRef)}
              >
                Làm mới
              </Button>
            </div>

            {isLoadingSummary ? (
              <Card className="p-16 flex items-center justify-center">
                <LoadingSpinner text="Đang chắt lọc những ý quan trọng..." variant="secondary" />
              </Card>
            ) : summaryError ? (
              <Card className="space-y-3 border-warning bg-warning-soft p-8 text-center">
                <p className="text-sm font-bold text-[var(--color-ink-2)]">Không thể tạo tóm tắt</p>
                <p className="text-xs text-[var(--color-muted)]">{summaryError}</p>
              </Card>
            ) : summary ? (
              <Card data-testid="summary-result-card" variant="ai-glow" className="p-8 space-y-4 bg-surface">
                <div className="flex items-center justify-between border-b border-[var(--color-rule)] pb-4">
                  <h4 className="font-bold text-base text-[var(--color-ink)] flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[var(--color-signal)]" />
                    <span>{summary.chapterRef || summary.chapterTitle || 'Tóm tắt toàn bộ tài liệu'}</span>
                  </h4>
                  <Badge variant="success" size="sm">Đã tóm tắt</Badge>
                </div>

                {/* Key Points */}
                {summary.keyPoints && summary.keyPoints.length > 0 && (
                  <div data-testid="summary-key-points" className="rounded-2xl border border-[var(--color-rule)] bg-[var(--color-accent-soft)] p-4">
                    <p className="mb-2 text-xs font-bold text-[var(--color-accent)]">Điểm chính</p>
                    <ul className="space-y-1">
                      {summary.keyPoints.map((kp, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-ink-2)]">
                          <span className="shrink-0 font-bold text-[var(--color-accent)]">{i + 1}.</span>
                          <span>{kp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <FormattedText
                  data-testid="summary-content"
                  content={summary.summaryText || summary.content || summary.summary || ''}
                  className="space-y-3 text-xs leading-relaxed text-[var(--color-ink-2)] whitespace-pre-wrap"
                />
              </Card>
            ) : (
              <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
                <Layers className="mx-auto mb-3 h-8 w-8 text-[var(--color-signal)]" />
                <h2 className="text-lg font-bold text-[var(--color-ink)]">Nắm nhanh nội dung chính</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">Tạo bản tóm tắt để xem các ý chính và ôn lại tài liệu hiệu quả hơn.</p>
                <Button type="button" variant="primary" size="md" className="mt-5" onClick={() => handleGenerateSummary('FULL')}>
                  Tạo bản tóm tắt
                </Button>
              </Card>
            )}
          </div>
        )}

        {/* Tab 3: learning assistant */}
        {activeTab === 'tutor' && (
          <div className="flex-1 space-y-6 overflow-y-auto bg-[var(--color-paper)] p-6">
            <Card className="space-y-3 bg-ink p-6 text-paper">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-2 text-paper">
                  <GraduationCap size={19} />
                </div>
                <div>
                  <h4 className="font-bold text-base">Trợ lý học tập của bạn</h4>
                  <p className="text-xs text-paper/65">Hỏi lại phần khó, xin ví dụ hoặc nhờ hướng dẫn từng bước.</p>
                </div>
              </div>
            </Card>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskTutor(tutorQuestion);
              }}
              className="flex gap-2"
            >
              <input
                data-testid="tutor-input"
                type="text"
                value={tutorQuestion}
                onChange={(e) => setTutorQuestion(e.target.value)}
                placeholder="Ví dụ: Hãy giải thích phần này bằng một ví dụ đơn giản..."
                disabled={isAskingTutor}
                className="min-h-11 flex-1 rounded-lg border border-rule-strong bg-surface px-4 py-3 text-sm text-ink outline-2 outline-transparent outline-offset-1 placeholder:text-muted hover:bg-paper-2 focus-visible:border-ink focus-visible:outline-focus"
              />
              <Button data-testid="tutor-ask-button" type="submit" variant="primary" size="md" disabled={!tutorQuestion.trim() || isAskingTutor}>
                Gửi câu hỏi
              </Button>
            </form>

            <label className="flex items-center gap-2 text-xs text-[var(--color-ink-2)] cursor-pointer w-fit">
              <input
                data-testid="tutor-use-document-context"
                type="checkbox"
                checked={useDocumentTutorContext}
                onChange={(event) => setUseDocumentTutorContext(event.target.checked)}
              />
              Dựa trên tài liệu đang mở
            </label>

            {isAskingTutor ? (
              <Card className="p-12 flex items-center justify-center">
                <LoadingSpinner text="Đang chuẩn bị lời giải thích dễ hiểu..." variant="secondary" />
              </Card>
            ) : tutorError ? (
              <Card data-testid="tutor-error" className="border-error bg-error-soft p-5 text-sm text-error">
                {tutorError}
              </Card>
            ) : tutorAnswer ? (
              <Card data-testid="tutor-answer" className="space-y-4 border-accent bg-surface p-6">
                <FormattedText
                  content={tutorAnswer}
                  className="space-y-2 text-xs leading-relaxed text-[var(--color-ink)] whitespace-pre-wrap"
                />

                {suggestedQuestions.length > 0 && (
                  <div className="pt-4 border-t border-[var(--color-rule)] space-y-2">
                    <p className="text-xs font-bold text-[var(--color-muted)] flex items-center gap-1.5">
                      <Lightbulb size={14} className="text-signal" /> Câu hỏi gợi ý tiếp theo:
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {suggestedQuestions.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setTutorQuestion(q);
                            handleAskTutor(q);
                          }}
                          className="group flex items-center justify-between rounded-xl bg-[var(--color-accent-soft)] p-2.5 text-left text-xs font-medium text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)]"
                        >
                          <span>{q}</span>
                          <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  'Tóm tắt phần này trong 3 ý ngắn gọn.',
                  'Giải thích khái niệm khó nhất bằng ví dụ đời thường.',
                  'Tạo một câu hỏi để kiểm tra xem tôi đã hiểu chưa.',
                  'Tôi nên ghi nhớ điều gì trước khi chuyển sang phần tiếp theo?',
                ].map((item, idx) => (
                  <Card
                    key={idx}
                    variant="interactive"
                    className="flex items-center justify-between p-4 text-xs font-medium text-[var(--color-ink-2)] hover:text-[var(--color-accent)]"
                    onClick={() => {
                      setTutorQuestion(item);
                      handleAskTutor(item);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <HelpCircle size={16} className="shrink-0 text-[var(--color-accent)]" />
                      {item}
                    </span>
                    <ChevronRight size={16} className="shrink-0" />
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
      </div>
    </div>
  );
};
