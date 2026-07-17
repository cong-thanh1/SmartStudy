import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  MessageSquare,
  Sparkles,
  Send,
  BookOpen,
  GraduationCap,
  Layers,
  ChevronRight,
  RefreshCw,
  HelpCircle,
  Lightbulb,
  FileQuestion,
  BarChart3,
  ArrowLeft,
  FileText,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  UploadCloud,
} from 'lucide-react';
import { Button, Card, Badge, ChatBubble, LoadingSpinner } from '../components';
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
  const [isReaderOpen, setIsReaderOpen] = useState(true);

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
      <Card className="soft-grid page-enter mx-auto flex min-h-[480px] max-w-3xl flex-col items-center justify-center border-2 border-dashed border-[#CAD5D0] bg-white/75 p-8 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-[#E1EEE8] text-[#2F6B58]"><BookOpen size={29} /></div>
        <h2 className="mt-6 text-2xl font-black tracking-[-0.03em]">Thêm tài liệu để bắt đầu học</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-[#6B7772]">Phòng học sẽ giúp bạn đọc, đặt câu hỏi và tóm tắt nội dung từ tài liệu của mình.</p>
        <Button className="mt-6" onClick={() => navigate('/dashboard')} leftIcon={<UploadCloud size={17} />}>Đến thư viện tài liệu</Button>
      </Card>
    );
  }

  return (
    <div className="page-enter mx-auto flex min-h-full w-full max-w-[1440px] flex-col gap-5">
      <header className="flex flex-col gap-4 rounded-3xl border border-[#DCE2DE] bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            aria-label="Quay lại danh sách tài liệu"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[#69756F] transition-colors hover:bg-[#EEF3EF] hover:text-[#18312A] focus:outline-none focus:ring-2 focus:ring-[#2F6B58]"
          >
            <ArrowLeft size={19} />
          </button>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E1EEE8] text-[#2F6B58]">
            <FileText size={20} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-[#17201E]">{currentDoc?.title || 'Tài liệu học tập'}</p>
            <p className="mt-0.5 text-xs text-[#74807B]">{previewPageCount ? `${previewPageCount} trang` : 'Đang tải thông tin tài liệu'}</p>
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
            leftIcon={isReaderOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
            onClick={() => setIsReaderOpen((open) => !open)}
          >
            {isReaderOpen ? 'Ẩn tài liệu' : 'Mở tài liệu'}
          </Button>
          <button
            type="button"
            aria-label="Thao tác tài liệu"
            className="grid h-8 w-8 place-items-center rounded-lg text-[#74807B] hover:bg-[#EEF3EF] hover:text-[#18312A] focus:outline-none focus:ring-2 focus:ring-[#2F6B58]"
          >
            <MoreHorizontal size={20} />
          </button>
        </div>
      </header>

      <div className={clsx(
        'grid min-h-[calc(100vh-210px)] gap-5',
        isReaderOpen ? 'lg:grid-cols-[minmax(0,1.38fr)_minmax(360px,1fr)]' : 'grid-cols-1',
      )}>
      {/* Left Panel: PDF Viewer / Textbook Reader (45% width) */}
      {isReaderOpen && (
      <Card className="order-2 flex min-h-[560px] flex-col overflow-hidden p-0 shadow-sm lg:order-2">
        {/* Document Selector Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#18312A] p-4 text-white">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <BookOpen className="h-5 w-5 shrink-0 text-[#B9E0D0]" />
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-4 focus:ring-white/10"
            >
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title}
                </option>
              ))}
            </select>
          </div>
          <Badge variant="success" size="sm" className="ml-2 shrink-0">Sẵn sàng học</Badge>
        </div>

        {/* Extracted document preview */}
        <div className="scrollbar-subtle relative flex-1 space-y-5 overflow-y-auto bg-[#EFF2ED] p-4 sm:p-5">
          {activeCitation && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold text-amber-800 mb-1">
                <span>Đoạn được nhắc đến · Trang {activeCitation.pageNumber || 1}</span>
                <button
                  onClick={() => setActiveCitation(null)}
                  className="text-amber-900 hover:underline font-normal"
                >
                  Đóng
                </button>
              </div>
              <p className="text-xs italic text-amber-950 font-medium">&ldquo;{activeCitation.snippet}&rdquo;</p>
            </div>
          )}

          <div className="space-y-4 rounded-3xl border border-[#E0E6E2] bg-white p-6 shadow-sm sm:p-7">
            <div className="border-b border-[#E0E3E5] pb-4 flex items-center justify-between">
              <h3 className="font-bold text-base text-[#17201E]">{currentDoc?.title || 'Tài liệu học tập'}</h3>
              <span className="text-xs font-semibold text-[#74807B]">
                {previewPageCount ? `${previewPageCount} trang` : 'Đang tải nội dung'}
              </span>
            </div>

            {previewChunks.length > 0 ? (
              <div className="space-y-5 text-xs leading-relaxed text-[#404751]">
                {previewChunks.map((chunk, index) => (
                  <section key={`${chunk.pageStart ?? 'unknown'}-${index}`} className="space-y-2">
                    {(chunk.chapterTitle || chunk.pageStart) && (
                      <p className="font-bold text-sm text-[#26332F]">
                        {chunk.chapterTitle || 'Nội dung tài liệu'}
                        {chunk.pageStart ? ` — Trang ${chunk.pageStart}${chunk.pageEnd && chunk.pageEnd !== chunk.pageStart ? `–${chunk.pageEnd}` : ''}` : ''}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">{chunk.text}</p>
                  </section>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#74807B]">
                Chưa có nội dung trích xuất. Hãy chờ tài liệu xử lý xong hoặc tải lại trang.
              </p>
            )}
          </div>
        </div>
      </Card>
      )}

      {/* Right Panel: Interactive AI Workspace (55% width) */}
      <Card className="order-1 flex min-h-[560px] flex-col overflow-hidden p-0 shadow-sm lg:order-1">
        {/* Navigation Tabs Header */}
        <div className="scrollbar-subtle flex items-center gap-1 overflow-x-auto border-b border-[#E0E6E2] bg-white px-4 py-3 sm:px-5">
          <button
            data-testid="chat-tab"
            onClick={() => setActiveTab('rag')}
            className={clsx(
              'flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all',
              activeTab === 'rag'
                ? 'bg-[#2F6B58] text-white shadow-sm'
                : 'text-[#707882] hover:bg-[#F4F7F3] hover:text-[#18312A]'
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
              'flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all',
              activeTab === 'summary'
                ? 'bg-[#ED7148] text-white shadow-sm'
                : 'text-[#707882] hover:bg-[#F4F7F3] hover:text-[#18312A]'
            )}
          >
            <Layers size={16} />
            <span>Tóm tắt</span>
          </button>

          <button
            data-testid="tutor-tab"
            onClick={() => setActiveTab('tutor')}
            className={clsx(
              'flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all',
              activeTab === 'tutor'
                ? 'bg-[#18312A] text-white shadow-sm'
                : 'text-[#707882] hover:bg-[#F4F7F3] hover:text-[#18312A]'
            )}
          >
            <GraduationCap size={16} />
            <span>Trợ lý học tập</span>
          </button>

          <button
            type="button"
            onClick={() => navigate(`/exam-center${selectedDocId ? `?docId=${selectedDocId}` : ''}`)}
            className="flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-[#707882] transition-all hover:bg-[#F4F7F3] hover:text-[#18312A]"
          >
            <FileQuestion size={16} />
            <span>Bài kiểm tra</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/results')}
            className="flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-[#707882] transition-all hover:bg-[#F4F7F3] hover:text-[#18312A]"
          >
            <BarChart3 size={16} />
            <span>Kết quả</span>
          </button>
        </div>

        {/* Tab 1: document chat */}
        {activeTab === 'rag' && (
          <div className="flex min-h-0 flex-1 flex-col bg-[#F6F7F2]">
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {messages.length === 0 && !isSending && (
                <div className="mx-auto mt-12 max-w-md rounded-3xl border border-[#DCE2DE] bg-white p-6 text-center shadow-sm">
                  <MessageSquare className="mx-auto mb-3 h-7 w-7 text-[#2F6B58]" />
                  <h2 className="text-base font-bold text-[#17201E]">Bạn muốn tìm hiểu gì từ tài liệu này?</h2>
                  <p className="mt-2 text-sm leading-6 text-[#69756F]">Trợ lý sẽ trả lời từ nội dung đang mở và kèm nguồn để bạn kiểm tra lại.</p>
                </div>
              )}
              {messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  onSelectCitation={(cite) => setActiveCitation(cite)}
                />
              ))}
              {isSending && (
                <div className="flex items-center gap-3 p-4 bg-white rounded-2xl w-fit shadow-sm border border-[#E0E3E5]">
                  <Sparkles className="w-4 h-4 text-[#ED7148] animate-spin" />
                  <span className="text-xs font-semibold text-[#404751] animate-pulse">
                    Đang tìm trong tài liệu để trả lời bạn...
                  </span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input Box */}
            <form onSubmit={handleSendMessage} className="border-t border-[#E0E6E2] bg-white p-4">
              <div className="flex items-end gap-2 rounded-2xl border border-[#DCE2DE] bg-[#F7F9F6] p-2 focus-within:border-[#2F6B58] focus-within:ring-4 focus-within:ring-[#2F6B58]/10">
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
                className="max-h-36 min-h-10 min-w-0 flex-1 resize-y bg-transparent px-2 py-2 text-sm text-[#17201E] placeholder:text-[#89958F] focus:outline-none"
              />
              <Button
                data-testid="chat-send-button"
                type="submit"
                variant="primary"
                size="md"
                disabled={!inputMessage.trim() || isSending}
                aria-label="Gửi câu hỏi"
                className="shrink-0 bg-[#2F6B58] px-4 hover:bg-[#285D4C] focus:ring-[#2F6B58]"
              >
                <Send size={16} />
              </Button>
              </div>
              <p className="mt-2 text-xs text-[#89958F]">Enter để gửi · Shift + Enter để xuống dòng · Nên mở nguồn đi kèm để kiểm tra thông tin.</p>
            </form>
          </div>
        )}

        {/* Tab 2: summary */}
        {activeTab === 'summary' && (
          <div className="flex-1 space-y-6 overflow-y-auto bg-[#F6F7F2] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#DCE2DE] bg-white p-4 shadow-sm">
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
                  <span className="text-xs font-semibold text-[#707882]">Chọn chương:</span>
                  <select
                    data-testid="summary-chapter-select"
                    value={selectedChapterRef}
                    onChange={(e) => {
                      setSelectedChapterRef(e.target.value);
                    }}
                    className="rounded-lg border border-[#DCE2DE] bg-[#F7F9F6] px-3 py-1 text-xs font-semibold text-[#17201E]"
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
              <Card className="p-8 text-center space-y-3 bg-white border-l-4 border-l-amber-500">
                <p className="text-sm font-bold text-[#26332F]">Không thể tạo tóm tắt</p>
                <p className="text-xs text-[#707882]">{summaryError}</p>
              </Card>
            ) : summary ? (
              <Card data-testid="summary-result-card" variant="ai-glow" className="p-8 space-y-4 bg-white">
                <div className="flex items-center justify-between border-b border-[#E0E3E5] pb-4">
                  <h4 className="font-bold text-base text-[#181C1E] flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#ED7148]" />
                    <span>{summary.chapterRef || summary.chapterTitle || 'Tóm tắt toàn bộ tài liệu'}</span>
                  </h4>
                  <Badge variant="success" size="sm">Đã tóm tắt</Badge>
                </div>

                {/* Key Points */}
                {summary.keyPoints && summary.keyPoints.length > 0 && (
                  <div data-testid="summary-key-points" className="rounded-2xl border border-[#CFE0D7] bg-[#EFF7F2] p-4">
                    <p className="mb-2 text-xs font-bold text-[#2F6B58]">Điểm chính</p>
                    <ul className="space-y-1">
                      {summary.keyPoints.map((kp, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-[#26332F]">
                          <span className="shrink-0 font-bold text-[#2F6B58]">{i + 1}.</span>
                          <span>{kp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div
                  data-testid="summary-content"
                  className="space-y-3 text-xs leading-relaxed text-[#404751] whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: (summary.summaryText || summary.content || summary.summary || '')
                      .replace(/### (.*?)\n/g, '<h5 class="font-bold text-sm text-[#26332F] mt-4 mb-2">$1</h5>')
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-[#181C1E]">$1</strong>'),
                  }}
                />
              </Card>
            ) : (
              <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
                <Layers className="mx-auto mb-3 h-8 w-8 text-[#ED7148]" />
                <h2 className="text-lg font-bold text-[#17201E]">Nắm nhanh nội dung chính</h2>
                <p className="mt-2 text-sm leading-6 text-[#69756F]">Tạo bản tóm tắt để xem các ý chính và ôn lại tài liệu hiệu quả hơn.</p>
                <Button type="button" variant="primary" size="md" className="mt-5" onClick={() => handleGenerateSummary('FULL')}>
                  Tạo bản tóm tắt
                </Button>
              </Card>
            )}
          </div>
        )}

        {/* Tab 3: learning assistant */}
        {activeTab === 'tutor' && (
          <div className="flex-1 space-y-6 overflow-y-auto bg-[#F6F7F2] p-6">
            <Card className="space-y-3 bg-[#18312A] p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold">
                  🧑‍🏫
                </div>
                <div>
                  <h4 className="font-bold text-base">Trợ lý học tập của bạn</h4>
                  <p className="text-xs text-white/65">Hỏi lại phần khó, xin ví dụ hoặc nhờ hướng dẫn từng bước.</p>
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
                className="flex-1 rounded-xl border border-[#DCE2DE] bg-white px-4 py-3 text-xs text-[#17201E] shadow-sm placeholder:text-[#89958F] focus:outline-none focus:ring-2 focus:ring-[#2F6B58]"
              />
              <Button data-testid="tutor-ask-button" type="submit" variant="primary" size="md" disabled={!tutorQuestion.trim() || isAskingTutor}>
                Gửi câu hỏi
              </Button>
            </form>

            <label className="flex items-center gap-2 text-xs text-[#404751] cursor-pointer w-fit">
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
              <Card data-testid="tutor-error" className="p-5 border border-red-200 bg-red-50 text-sm text-red-700">
                {tutorError}
              </Card>
            ) : tutorAnswer ? (
              <Card data-testid="tutor-answer" className="space-y-4 border-l-4 border-l-[#2F6B58] bg-white p-6">
                <div
                  className="space-y-2 text-xs leading-relaxed text-[#181C1E] whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: tutorAnswer.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-[#2F6B58]">$1</strong>'),
                  }}
                />

                {suggestedQuestions.length > 0 && (
                  <div className="pt-4 border-t border-[#E0E3E5] space-y-2">
                    <p className="text-xs font-bold text-[#707882] flex items-center gap-1.5">
                      <Lightbulb size={14} className="text-amber-500" /> Câu hỏi gợi ý tiếp theo:
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {suggestedQuestions.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setTutorQuestion(q);
                            handleAskTutor(q);
                          }}
                          className="group flex items-center justify-between rounded-xl bg-[#F1F5F2] p-2.5 text-left text-xs font-medium text-[#404751] transition-colors hover:bg-[#E1EEE8] hover:text-[#2F6B58]"
                        >
                          <span>👉 {q}</span>
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
                    className="flex items-center justify-between p-4 text-xs font-medium text-[#404751] hover:text-[#2F6B58]"
                    onClick={() => {
                      setTutorQuestion(item);
                      handleAskTutor(item);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <HelpCircle size={16} className="shrink-0 text-[#2F6B58]" />
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
