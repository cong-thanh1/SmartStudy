import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileQuestion,
  Clock,
  CheckSquare,
  Sparkles,
  BookOpen,
  Award,
  ArrowLeft,
  Send,
} from 'lucide-react';
import { Button, Card, Badge, LoadingSpinner } from '../components';
import { documentService, quizService, examService } from '../services';
import { Document, Exam, Quiz } from '../types';
import { clsx } from 'clsx';

export const ExamCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const docIdParam = searchParams.get('docId');

  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>(docIdParam || '');
  const [numQuestions, setNumQuestions] = useState(5);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [isGenerating, setIsGenerating] = useState(false);

  // Active Exam / Quiz State
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const init = async () => {
      const docs = await documentService.listDocuments();
      setDocuments(docs);
      if (docs.length > 0 && !selectedDocId) {
        setSelectedDocId(docs[0].id);
      }
    };
    init();
  }, [selectedDocId]);

  const submitRef = React.useRef<() => void>(() => {});
  useEffect(() => {
    submitRef.current = handleSubmitExam;
  });

  // Timer effect
  useEffect(() => {
    if (!activeExam && !activeQuiz) return;
    if (timeLeftSeconds <= 0) return;

    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          submitRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeExam, activeQuiz, timeLeftSeconds]);

  const handleGenerateQuiz = async () => {
    if (!selectedDocId) return;
    setIsGenerating(true);
    try {
      const quiz = await quizService.generateQuiz(selectedDocId, undefined, numQuestions);
      setActiveQuiz(quiz);
      setActiveExam(null);
      setUserAnswers({});
      setTimeLeftSeconds(numQuestions * 60 * 2); // 2 mins per question for quiz
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateExam = async () => {
    if (!selectedDocId) return;
    setIsGenerating(true);
    try {
      const exam = await examService.generateExam(selectedDocId, numQuestions, durationMinutes);
      setActiveExam(exam);
      setActiveQuiz(null);
      setUserAnswers({});
      setTimeLeftSeconds(durationMinutes * 60);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOptionSelect = (questionId: string, selectedOption: string) => {
    setUserAnswers((prev) => ({ ...prev, [questionId]: selectedOption }));
  };

  const handleSubmitExam = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (activeExam) {
        // Convert userAnswers {question_id: selectedOptionText} to API format
        const answers = Object.entries(userAnswers).map(([question_id, selected_answer]) => ({
          question_id,
          selected_answer,
        }));
        const attempt = await examService.submitAttempt(activeExam.id, answers);
        // Navigate to results page with attempt data
        localStorage.setItem('last_grading_result', JSON.stringify({
          attempt,
          questions: activeExam.questions,
        }));
        navigate('/results');
      } else if (activeQuiz) {
        // Submit quiz via API
        const answers = Object.entries(userAnswers).map(([question_id, selected_answer]) => ({
          question_id,
          selected_answer,
        }));
        const attempt = await examService.submitQuizAttempt(activeQuiz.id, answers);
        localStorage.setItem('last_grading_result', JSON.stringify({
          attempt,
          questions: activeQuiz.questions,
        }));
        navigate('/results');
      }
    } catch {
      alert('Nộp bài thất bại. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentQuestions = activeExam ? activeExam.questions : activeQuiz ? activeQuiz.questions : [];
  const answeredCount = Object.keys(userAnswers).length;
  const progressPercentage = Math.round((answeredCount / (currentQuestions.length || 1)) * 100);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ==========================================
  // View 1: Generator Setup View
  // ==========================================
  if (!activeExam && !activeQuiz) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
        <Card variant="ai-glow" className="p-8 bg-gradient-to-r from-[#232F3E] via-[#0073BB] to-[#8A2BE2] text-white">
          <div className="space-y-3">
            <Badge variant="ai" size="sm" className="bg-white/20 text-white border-white/30">
              <Sparkles className="w-3 h-3 mr-1" /> Automated Exam Engine v2.0
            </Badge>
            <h2 className="text-3xl font-extrabold">Trung tâm Khảo thí &amp; Tạo đề thi AI</h2>
            <p className="text-sm text-[#9CCAFF] max-w-2xl leading-relaxed">
              Hệ thống tự động phân tích ngữ nghĩa file PDF để tạo bộ câu hỏi trắc nghiệm độ chính xác cao. Đảm bảo
              nguyên tắc kiểm thử 100% coverage cho hàm chấm điểm.
            </p>
          </div>
        </Card>

        {isGenerating ? (
          <Card className="p-20 flex flex-col items-center justify-center space-y-4">
            <LoadingSpinner size="xl" variant="secondary" />
            <div className="text-center space-y-1">
              <h4 className="font-bold text-base text-[#181C1E]">AI đang quét tài liệu &amp; sinh câu hỏi trắc nghiệm...</h4>
              <p className="text-xs text-[#707882]">Đang phân tích các khái niệm trọng tâm từ chỉ mục pgvector</p>
            </div>
          </Card>
        ) : (
          <Card className="p-8 space-y-6">
            <div className="border-b border-[#E0E3E5] pb-4">
              <h3 className="font-bold text-lg text-[#181C1E]">Cấu hình Bài kiểm tra</h3>
              <p className="text-xs text-[#707882]">Tùy chỉnh thông số để AI sinh bộ đề phù hợp với mục tiêu học tập</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Document Selector */}
              <div className="space-y-2 md:col-span-2">
                <label className="font-semibold text-sm text-[#181C1E] flex items-center gap-2">
                  <BookOpen size={16} className="text-[#0073BB]" /> Chọn tài liệu nguồn từ Thư viện
                </label>
                <select
                  data-testid="document-selector"
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="w-full bg-[#F4F7F9] border border-[#E0E3E5] rounded-xl px-4 py-3 text-sm font-medium text-[#181C1E] focus:outline-none focus:ring-2 focus:ring-[#0073BB]"
                >
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      📄 {doc.title} ({doc.chunkCount} vector chunks)
                    </option>
                  ))}
                </select>
              </div>

              {/* Num Questions Selector */}
              <div className="space-y-2">
                <label className="font-semibold text-sm text-[#181C1E] flex items-center gap-2">
                  <FileQuestion size={16} className="text-[#8A2BE2]" /> Số lượng câu hỏi trắc nghiệm
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 15, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      data-testid={`num-questions-${num}`}
                      onClick={() => setNumQuestions(num)}
                      className={clsx(
                        'py-2.5 rounded-xl font-bold text-xs border transition-all',
                        numQuestions === num
                          ? 'bg-[#8A2BE2] text-white border-[#8A2BE2] shadow-sm'
                          : 'bg-[#F4F7F9] text-[#404751] border-[#E0E3E5] hover:border-[#8A2BE2]'
                      )}
                    >
                      {num} câu
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration Selector */}
              <div className="space-y-2">
                <label className="font-semibold text-sm text-[#181C1E] flex items-center gap-2">
                  <Clock size={16} className="text-[#0073BB]" /> Thời gian làm bài thi
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[10, 15, 30].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      data-testid={`duration-${mins}`}
                      onClick={() => setDurationMinutes(mins)}
                      className={clsx(
                        'py-2.5 rounded-xl font-bold text-xs border transition-all',
                        durationMinutes === mins
                          ? 'bg-[#0073BB] text-white border-[#0073BB] shadow-sm'
                          : 'bg-[#F4F7F9] text-[#404751] border-[#E0E3E5] hover:border-[#0073BB]'
                      )}
                    >
                      {mins} phút
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-6 border-t border-[#E0E3E5] grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button
                data-testid="generate-quiz-button"
                variant="outline"
                size="lg"
                className="w-full justify-center border-2 border-[#0073BB] text-[#0073BB] hover:bg-[#D0E4FF]/20 font-bold"
                leftIcon={<CheckSquare size={18} />}
                onClick={handleGenerateQuiz}
              >
                Sinh bài Quiz ôn tập nhanh
              </Button>

              <Button
                data-testid="generate-exam-button"
                variant="ai"
                size="lg"
                className="w-full justify-center font-bold"
                leftIcon={<Award size={18} />}
                onClick={handleGenerateExam}
              >
                Tạo Đề thi chuẩn chỉnh (AI Grading)
              </Button>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ==========================================
  // View 2: Active Exam / Quiz Taking View
  // ==========================================
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-16">
      {/* Top Sticky Progress & Timer Header */}
      <div className="sticky top-20 z-20 bg-white/95 backdrop-blur-md p-5 rounded-2xl border border-[#E0E3E5] shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm('Bạn có chắc chắn muốn hủy bài làm và quay lại?')) {
                setActiveExam(null);
                setActiveQuiz(null);
              }
            }}
            title="Quay lại cài đặt"
          >
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h3 className="font-bold text-base text-[#181C1E]">
              {activeExam ? `Đề thi #${activeExam.id.slice(0, 8)}` : activeQuiz ? `Quiz #${activeQuiz.id.slice(0, 8)}` : 'Bài kiểm tra'}
            </h3>
            <p className="text-xs text-[#707882]">Đã trả lời: {answeredCount} / {currentQuestions.length} câu</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex-1 max-w-xs hidden sm:block">
          <div className="w-full bg-[#F4F7F9] h-2 rounded-full overflow-hidden border border-[#E0E3E5]">
            <div
              className="bg-gradient-to-r from-[#0073BB] to-[#8A2BE2] h-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Timer & Submit */}
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono font-bold text-sm border',
              timeLeftSeconds < 60
                ? 'bg-[#FFDAD6] text-[#93000A] border-[#BA1A1A] animate-pulse'
                : 'bg-[#F4F7F9] text-[#232F3E] border-[#C0C7D2]'
            )}
          >
            <Clock size={16} />
            <span>{formatTime(timeLeftSeconds)}</span>
          </div>

          <Button
            data-testid="submit-exam-button-header"
            variant="primary"
            size="md"
            onClick={handleSubmitExam}
            isLoading={isSubmitting}
            leftIcon={<Send size={16} />}
          >
            Nộp bài ngay
          </Button>
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-6">
        {currentQuestions.map((q, qIdx) => {
          const qId = q.question_id || q.id || String(qIdx);
          const qText = q.question_text || q.questionText || '';
          const selectedOpt = userAnswers[qId];
          return (
            <Card key={qId} data-testid={`question-card-${qIdx}`} className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-[#D0E4FF] text-[#00497A] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  {qIdx + 1}
                </span>
                <h4 data-testid={`question-text-${qIdx}`} className="font-bold text-sm text-[#181C1E] leading-relaxed flex-1">
                  {qText}
                </h4>
              </div>

              {/* Options Grid */}
              <div className="grid grid-cols-1 gap-2.5 pl-10">
                {q.options.map((optionText, optIdx) => {
                  const isSelected = selectedOpt === optionText;
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      data-testid={`option-${qIdx}-${optIdx}`}
                      onClick={() => handleOptionSelect(qId, optionText)}
                      className={clsx(
                        'w-full text-left p-3.5 rounded-xl font-medium text-xs border transition-all flex items-center gap-3 cursor-pointer',
                        isSelected
                          ? 'bg-[#D0E4FF]/40 border-[#0073BB] text-[#00497A] font-bold shadow-sm'
                          : 'bg-white border-[#E0E3E5] text-[#404751] hover:border-[#0073BB]/50 hover:bg-[#F4F7F9]'
                      )}
                    >
                      <span
                        className={clsx(
                          'w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors',
                          isSelected
                            ? 'bg-[#0073BB] text-white border-[#0073BB]'
                            : 'bg-[#F4F7F9] text-[#707882] border-[#C0C7D2]'
                        )}
                      >
                        {String.fromCharCode(65 + optIdx)}
                      </span>
                      <span className="flex-1 leading-snug">{optionText}</span>
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Bottom Floating Submit CTA */}
      <div className="flex justify-center pt-6">
        <Button
          data-testid="submit-exam-button"
          variant="ai"
          size="lg"
          onClick={handleSubmitExam}
          isLoading={isSubmitting}
          className="px-12 shadow-xl text-base"
          leftIcon={<Send size={18} />}
        >
          Hoàn tất &amp; Xem phân tích AI
        </Button>
      </div>
    </div>
  );
};
