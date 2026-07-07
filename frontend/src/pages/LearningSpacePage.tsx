import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
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
} from 'lucide-react';
import { Button, Card, Badge, ChatBubble, LoadingSpinner } from '../components';
import { documentService, chatService, summaryService, tutorService } from '../services';
import { Document, Message, Summary, Citation } from '../types';
import { clsx } from 'clsx';

export const LearningSpacePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const docIdParam = searchParams.get('docId');

  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>(docIdParam || '');
  const [activeTab, setActiveTab] = useState<'rag' | 'summary' | 'tutor'>('rag');

  // RAG Chat State
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Summary State
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryType, setSummaryType] = useState<'FULL' | 'CHAPTER'>('FULL');
  const [selectedChapter, setSelectedChapter] = useState(0);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  // Tutor State
  const [tutorQuestion, setTutorQuestion] = useState('');
  const [tutorAnswer, setTutorAnswer] = useState<string | null>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [isAskingTutor, setIsAskingTutor] = useState(false);

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
      }
    };
    init();
  }, [selectedDocId]);

  useEffect(() => {
    if (selectedDocId) {
      setSearchParams({ docId: selectedDocId });
      setMessages([]);
      chatService.listConversations(selectedDocId).then(async (convs) => {
        if (convs.length > 0) {
          setActiveConversationId(convs[0].id);
        } else {
          const newConv = await chatService.createConversation('Hội thoại RAG: ' + selectedDocId, selectedDocId);
          setActiveConversationId(newConv.id);
        }
      }).catch(() => {
        setActiveConversationId('');
      });
    }
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

  const handleGenerateSummary = async (type: 'FULL' | 'CHAPTER', chapterIdx = 0) => {
    if (!selectedDocId) return;
    setIsLoadingSummary(true);
    try {
      // Use generateSummary (POST) which triggers LLM generation
      const chapterRef = type === 'CHAPTER' ? `Chapter ${chapterIdx + 1}` : undefined;
      const res = await summaryService.generateSummary(
        selectedDocId,
        type === 'FULL' ? 'full' : 'chapter',
        chapterRef,
      );
      setSummary(res);
    } catch {
      // If POST fails (already exists), try GET
      try {
        const chapterRef = type === 'CHAPTER' ? `Chapter ${chapterIdx + 1}` : undefined;
        const res = await summaryService.getSummary(selectedDocId, type, chapterRef);
        setSummary(res);
      } catch {
        // Summary not available yet
      }
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const handleAskTutor = async (questionToAsk: string) => {
    if (!questionToAsk.trim() || isAskingTutor) return;
    setIsAskingTutor(true);
    try {
      const res = await tutorService.askTutor({
        question: questionToAsk,
        documentId: selectedDocId,
        chapterIndex: selectedChapter,
      });
      setTutorAnswer(res.answer);
      if (res.suggestedQuestions) {
        setSuggestedQuestions(res.suggestedQuestions);
      }
    } finally {
      setIsAskingTutor(false);
    }
  };

  const currentDoc = documents.find((d) => d.id === selectedDocId) || documents[0];

  return (
    <div className="h-[calc(100vh-80px-64px)] flex flex-col lg:flex-row gap-6 animate-fadeIn max-w-7xl mx-auto">
      {/* Left Panel: PDF Viewer / Textbook Reader (45% width) */}
      <Card className="lg:w-[45%] flex flex-col h-full p-0 overflow-hidden shadow-md">
        {/* Document Selector Header */}
        <div className="p-4 bg-[#232F3E] text-white flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <BookOpen className="w-5 h-5 text-[#9CCAFF] shrink-0" />
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="bg-[#181C1E] text-white border border-white/20 rounded-xl px-3 py-1.5 text-xs font-semibold w-full focus:outline-none focus:ring-2 focus:ring-[#0073BB]"
            >
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  📄 {doc.title} ({doc.chunkCount} chunks)
                </option>
              ))}
            </select>
          </div>
          <Badge variant="ai" size="sm" className="ml-2 shrink-0">pgvector Ready</Badge>
        </div>

        {/* Simulated PDF Viewer Body */}
        <div className="flex-1 bg-[#F4F7F9] p-6 overflow-y-auto space-y-6 relative">
          {activeCitation && (
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-400 shadow-md animate-bounce">
              <div className="flex items-center justify-between text-xs font-bold text-amber-800 mb-1">
                <span>📍 Trích dẫn đang chọn (Trang {activeCitation.pageNumber || 1})</span>
                <button
                  onClick={() => setActiveCitation(null)}
                  className="text-amber-900 hover:underline font-normal"
                >
                  Đóng vệt sáng
                </button>
              </div>
              <p className="text-xs italic text-amber-950 font-medium">&ldquo;{activeCitation.snippet}&rdquo;</p>
            </div>
          )}

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#E0E3E5] space-y-4">
            <div className="border-b border-[#E0E3E5] pb-4 flex items-center justify-between">
              <h3 className="font-bold text-base text-[#181C1E]">{currentDoc?.title || 'Tài liệu giáo trình AI'}</h3>
              <span className="text-xs font-semibold text-[#707882]">Trang 1 / 45</span>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-[#404751]">
              <p className="font-bold text-sm text-[#232F3E]">Chương 1: Kiến trúc Hexagonal &amp; Retrieval-Augmented Generation (RAG)</p>
              <p>
                Trong phát triển ứng dụng AI hiện đại, kiến trúc Ports &amp; Adapters (hay Hexagonal Architecture) đóng vai
                trò tối quan trọng trong việc cách ly logic nghiệp vụ cốt lõi khỏi sự phụ thuộc vào cơ sở hạ tầng bên
                ngoài...
              </p>
              <p>
                Cơ chế RAG cho phép kết hợp sức mạnh của mô hình ngôn ngữ lớn (LLM) như Gemini 1.5 Pro với cơ sở tri
                thức cục bộ. Khi người dùng đặt câu hỏi, hệ thống chuyển đổi câu hỏi thành vector nhúng thông qua mô
                hình embedding, sau đó thực hiện tìm kiếm k-NN trên chỉ mục HNSW của pgvector để trích xuất ngữ cảnh.
              </p>
              <div className="p-3 bg-[#D0E4FF]/30 rounded-xl border-l-4 border-[#0073BB]">
                <p className="font-semibold text-[#00497A]">
                  📌 Định lý quan trọng: Một hệ thống RAG không có chỉ mục HNSW sẽ suy giảm hiệu năng logarit khi dung
                  lượng tài liệu vượt quá 10,000 chunks.
                </p>
              </div>
              <p>
                Để đảm bảo tính toàn vẹn dữ liệu, các tác vụ nặng như phân mảnh (chunking) và sinh vector phải được đẩy
                vào hàng đợi bất đồng bộ quản lý bởi Redis và BullMQ.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#E0E3E5] space-y-4">
            <div className="border-b border-[#E0E3E5] pb-4 flex items-center justify-between">
              <span className="font-bold text-xs text-[#707882] uppercase tracking-wider">Chương 2: Kiểm thử tự động &amp; Quality Assurance</span>
              <span className="text-xs font-semibold text-[#707882]">Trang 12 / 45</span>
            </div>
            <p className="text-xs leading-relaxed text-[#404751]">
              Theo quy định DEV_GUIDELINES.md của nhóm, mọi thay đổi trong nghiệp vụ chấm điểm trắc nghiệm phải được
              kiểm chứng bằng unit test đạt 100% test coverage. Việc kiểm thử giúp loại bỏ hoàn toàn các lỗi suy thoái
              (regression)...
            </p>
          </div>
        </div>
      </Card>

      {/* Right Panel: Interactive AI Workspace (55% width) */}
      <Card className="lg:w-[55%] flex flex-col h-full p-0 overflow-hidden shadow-md">
        {/* Navigation Tabs Header */}
        <div className="flex items-center bg-white border-b border-[#E0E3E5] px-6 h-16 shrink-0 gap-2">
          <button
            onClick={() => setActiveTab('rag')}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all relative',
              activeTab === 'rag'
                ? 'bg-[#0073BB] text-white shadow-sm'
                : 'text-[#707882] hover:bg-[#F4F7F9] hover:text-[#181C1E]'
            )}
          >
            <MessageSquare size={16} />
            <span>Chat RAG Trích dẫn</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('summary');
              if (!summary) handleGenerateSummary('FULL');
            }}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all',
              activeTab === 'summary'
                ? 'bg-[#8A2BE2] text-white shadow-sm'
                : 'text-[#707882] hover:bg-[#F4F7F9] hover:text-[#181C1E]'
            )}
          >
            <Layers size={16} />
            <span>Tóm tắt Map-Reduce</span>
          </button>

          <button
            onClick={() => setActiveTab('tutor')}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all',
              activeTab === 'tutor'
                ? 'ai-gradient text-white shadow-sm ai-glow'
                : 'text-[#707882] hover:bg-[#F4F7F9] hover:text-[#181C1E]'
            )}
          >
            <GraduationCap size={16} />
            <span>Gia sư AI 1-kèm-1</span>
          </button>
        </div>

        {/* Tab 1: RAG Chat Content */}
        {activeTab === 'rag' && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#F4F7F9]/50">
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  onSelectCitation={(cite) => setActiveCitation(cite)}
                />
              ))}
              {isSending && (
                <div className="flex items-center gap-3 p-4 bg-white rounded-2xl w-fit shadow-sm border border-[#E0E3E5]">
                  <Sparkles className="w-4 h-4 text-[#8A2BE2] animate-spin" />
                  <span className="text-xs font-semibold text-[#404751] animate-pulse">
                    AI đang tra cứu HNSW vector để tổng hợp câu trả lời...
                  </span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input Box */}
            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-[#E0E3E5] flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Đặt câu hỏi về tài liệu (VD: Giải thích cơ chế HNSW pgvector...)"
                disabled={isSending}
                className="flex-1 bg-[#F4F7F9] border border-[#E0E3E5] rounded-xl px-4 py-2.5 text-xs text-[#181C1E] placeholder-[#707882] focus:outline-none focus:ring-2 focus:ring-[#0073BB]"
              />
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={!inputMessage.trim() || isSending}
                className="px-5 shrink-0"
              >
                <Send size={16} />
              </Button>
            </form>
          </div>
        )}

        {/* Tab 2: Map-Reduce Summary Content */}
        {activeTab === 'summary' && (
          <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-[#F4F7F9]/50">
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-[#E0E3E5] shadow-sm">
              <div className="flex items-center gap-2">
                <Button
                  variant={summaryType === 'FULL' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setSummaryType('FULL');
                    handleGenerateSummary('FULL');
                  }}
                >
                  Tóm tắt Toàn văn (Full Doc)
                </Button>
                <Button
                  variant={summaryType === 'CHAPTER' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setSummaryType('CHAPTER');
                    handleGenerateSummary('CHAPTER', selectedChapter);
                  }}
                >
                  Tóm tắt theo Chương
                </Button>
              </div>

              {summaryType === 'CHAPTER' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#707882]">Chọn chương:</span>
                  <select
                    value={selectedChapter}
                    onChange={(e) => {
                      const idx = Number(e.target.value);
                      setSelectedChapter(idx);
                      handleGenerateSummary('CHAPTER', idx);
                    }}
                    className="bg-[#F4F7F9] border border-[#E0E3E5] rounded-lg px-3 py-1 text-xs font-semibold text-[#181C1E]"
                  >
                    <option value={0}>Chương 1: Tổng quan RAG</option>
                    <option value={1}>Chương 2: Kiểm thử &amp; QA</option>
                    <option value={2}>Chương 3: Tối ưu MinIO Storage</option>
                  </select>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                leftIcon={<RefreshCw size={14} className={clsx(isLoadingSummary && 'animate-spin')} />}
                onClick={() => handleGenerateSummary(summaryType, selectedChapter)}
                disabled={isLoadingSummary}
              >
                Tạo lại
              </Button>
            </div>

            {isLoadingSummary ? (
              <Card className="p-16 flex items-center justify-center">
                <LoadingSpinner text="Đang thực hiện thuật toán Map-Reduce tổng hợp ý chính..." variant="secondary" />
              </Card>
            ) : summary ? (
              <Card variant="ai-glow" className="p-8 space-y-4 bg-white">
                <div className="flex items-center justify-between border-b border-[#E0E3E5] pb-4">
                  <h4 className="font-bold text-base text-[#181C1E] flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#8A2BE2]" />
                    <span>{summary.chapterRef || summary.chapterTitle || 'Bản tóm tắt toàn diện tài liệu'}</span>
                  </h4>
                  <Badge variant="ai" size="sm">Map-Reduce Engine</Badge>
                </div>

                {/* Key Points */}
                {summary.keyPoints && summary.keyPoints.length > 0 && (
                  <div className="p-4 rounded-xl bg-[#D0E4FF]/30 border border-[#0073BB]/20">
                    <p className="font-bold text-xs text-[#0073BB] mb-2">📌 Điểm chính:</p>
                    <ul className="space-y-1">
                      {summary.keyPoints.map((kp, i) => (
                        <li key={i} className="text-xs text-[#232F3E] flex items-start gap-2">
                          <span className="text-[#0073BB] font-bold shrink-0">{i + 1}.</span>
                          <span>{kp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div
                  className="space-y-3 text-xs leading-relaxed text-[#404751] whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: (summary.summaryText || summary.content || summary.summary || '')
                      .replace(/### (.*?)\n/g, '<h5 class="font-bold text-sm text-[#232F3E] mt-4 mb-2">$1</h5>')
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-[#181C1E]">$1</strong>'),
                  }}
                />
              </Card>
            ) : null}
          </div>
        )}

        {/* Tab 3: AI Tutor Content */}
        {activeTab === 'tutor' && (
          <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-[#F4F7F9]/50">
            <Card className="p-6 bg-gradient-to-br from-[#232F3E] to-[#0073BB] text-white space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold">
                  🧑‍🏫
                </div>
                <div>
                  <h4 className="font-bold text-base">Gia sư AI 1-kèm-1 (Chuyên gia Hexagonal &amp; RAG)</h4>
                  <p className="text-xs text-[#9CCAFF]">Hỏi bất cứ điều gì về lý thuyết, code convention hoặc bài tập</p>
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
                type="text"
                value={tutorQuestion}
                onChange={(e) => setTutorQuestion(e.target.value)}
                placeholder="Nhập câu hỏi cho gia sư (VD: Làm sao để viết mock adapter cho S3?)..."
                disabled={isAskingTutor}
                className="flex-1 bg-white border border-[#E0E3E5] rounded-xl px-4 py-3 text-xs text-[#181C1E] placeholder-[#707882] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8A2BE2]"
              />
              <Button type="submit" variant="ai" size="md" disabled={!tutorQuestion.trim() || isAskingTutor}>
                Hỏi Gia sư
              </Button>
            </form>

            {isAskingTutor ? (
              <Card className="p-12 flex items-center justify-center">
                <LoadingSpinner text="Gia sư AI đang soạn bài hướng dẫn chi tiết..." variant="secondary" />
              </Card>
            ) : tutorAnswer ? (
              <Card className="p-6 space-y-4 bg-white border-l-4 border-l-[#8A2BE2]">
                <div
                  className="space-y-2 text-xs leading-relaxed text-[#181C1E] whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: tutorAnswer.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-[#8A2BE2]">$1</strong>'),
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
                          className="text-left p-2.5 rounded-xl bg-[#F4F7F9] hover:bg-[#EFDBFF]/40 text-xs font-medium text-[#404751] hover:text-[#8A2BE2] transition-colors flex items-center justify-between group"
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
                  'Giải thích sự khác nhau giữa HNSW và IVFFlat trong pgvector?',
                  'Làm thế nào để viết mock test đạt 100% coverage cho quy trình chấm điểm?',
                  'Tại sao business logic không được phép import trực tiếp từ AWS SDK?',
                  'Quy trình xử lý bất đồng bộ với worker BullMQ hoạt động ra sao?',
                ].map((item, idx) => (
                  <Card
                    key={idx}
                    variant="interactive"
                    className="p-4 flex items-center justify-between text-xs font-medium text-[#404751] hover:text-[#8A2BE2]"
                    onClick={() => {
                      setTutorQuestion(item);
                      handleAskTutor(item);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <HelpCircle size={16} className="text-[#0073BB] shrink-0" />
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
  );
};
