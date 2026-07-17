import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  FileQuestion,
  Clock,
  CheckSquare,
  Sparkles,
  BookOpen,
  Award,
  ArrowLeft,
  Send,
  UploadCloud,
} from 'lucide-react';
import { Button, Card, Badge, LoadingSpinner } from '../components';
import { documentService, quizService, examService, jobService } from '../services';
import { Document, Exam, Quiz } from '../types';
import { clsx } from 'clsx';

export const ExamCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const docIdParam = searchParams.get('docId');

  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [selectedDocId, setSelectedDocId] = useState<string>(docIdParam || '');
  const [numQuestions, setNumQuestions] = useState(3);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [difficulty, setDifficulty] = useState<'balanced' | 'easy' | 'medium' | 'hard'>('balanced');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Active Exam / Quiz State
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const docs = await documentService.listDocuments();
        setDocuments(docs);
        if (docs.length > 0 && !selectedDocId) {
          setSelectedDocId(docs[0].id);
        }
      } catch (error) {
        setDocuments([]);
        setGenerationError(getGenerationErrorMessage(error, 'documents'));
      } finally {
        setIsLoadingDocuments(false);
      }
    };
    void init();
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
    setGenerationError(null);
    setIsGenerating(true);
    try {
      const generated = await quizService.generateQuiz(selectedDocId, undefined, numQuestions);
      const quiz = 'status' in generated ? await waitForQuiz(generated.id) : generated;
      setActiveQuiz(quiz);
      setActiveExam(null);
      setUserAnswers({});
      setTimeLeftSeconds(numQuestions * 60 * 2); // 2 mins per question for quiz
    } catch (error) {
      setGenerationError(getGenerationErrorMessage(error, 'quiz'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateExam = async () => {
    if (!selectedDocId) return;
    setGenerationError(null);
    setIsGenerating(true);
    try {
      const difficultyDistribution = difficulty === 'balanced'
        ? undefined
        : difficulty === 'easy'
          ? { easy: 100, medium: 0, hard: 0 }
          : difficulty === 'medium'
            ? { easy: 0, medium: 100, hard: 0 }
            : { easy: 0, medium: 0, hard: 100 };
      const generated = await examService.generateExam(
        selectedDocId,
        numQuestions,
        durationMinutes,
        difficultyDistribution,
      );
      const exam = 'status' in generated ? await waitForExam(generated.id) : generated;
      setActiveExam(exam);
      setActiveQuiz(null);
      setUserAnswers({});
      setTimeLeftSeconds(durationMinutes * 60);
    } catch (error) {
      setGenerationError(getGenerationErrorMessage(error, 'exam'));
    } finally {
      setIsGenerating(false);
    }
  };

  const waitForQuiz = async (jobId: string): Promise<Quiz> => {
    for (;;) {
      const job = await jobService.getJob(jobId);
      if (job.status === 'completed' && job.resultId) return quizService.getQuiz(job.resultId);
      if (job.status === 'failed') throw new Error(job.errorMessage || 'Tạo quiz thất bại');
      await new Promise((resolve) => window.setTimeout(resolve, 2_000));
    }
  };

  const waitForExam = async (jobId: string): Promise<Exam> => {
    for (;;) {
      const job = await jobService.getJob(jobId);
      if (job.status === 'completed' && job.resultId) return examService.getExam(job.resultId, 'take');
      if (job.status === 'failed') throw new Error(job.errorMessage || 'Tạo đề thi thất bại');
      await new Promise((resolve) => window.setTimeout(resolve, 2_000));
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
      <div className="page-enter mx-auto max-w-5xl space-y-6">
        <Card className="relative overflow-hidden bg-[#18312A] p-7 text-white sm:p-9">
          <div className="pointer-events-none absolute -right-12 -top-14 h-52 w-52 rounded-full border-[34px] border-white/5" />
          <div className="space-y-3">
            <Badge variant="success" size="sm" className="bg-white/10 text-[#B9E0D0]">
              <Sparkles className="mr-1 h-3 w-3" /> Ôn đúng nội dung bạn đang học
            </Badge>
            <h2 className="text-3xl font-black tracking-[-0.035em] sm:text-4xl">Tạo một bài luyện phù hợp với bạn</h2>
            <p className="max-w-2xl text-sm leading-6 text-white/65">
              Chọn tài liệu, số câu và độ khó. Câu hỏi sẽ được tạo từ chính nội dung bạn đã tải lên.
            </p>
          </div>
        </Card>

        {generationError && (
          <div
            role="alert"
            data-testid="generation-error"
            className="flex items-start justify-between gap-4 rounded-2xl border border-[#BA1A1A]/30 bg-[#FFDAD6] p-4 text-[#93000A]"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-bold text-sm">Không thể hoàn tất thao tác</p>
                <p className="mt-1 text-xs leading-relaxed">{generationError}</p>
              </div>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold hover:bg-[#BA1A1A]/10"
              onClick={() => setGenerationError(null)}
            >
              Đóng
            </button>
          </div>
        )}

        {isLoadingDocuments ? (
          <Card className="flex min-h-[320px] items-center justify-center"><LoadingSpinner text="Đang mở tài liệu của bạn..." /></Card>
        ) : documents.length === 0 ? (
          <Card className="soft-grid flex min-h-[360px] flex-col items-center justify-center border-2 border-dashed border-[#CAD5D0] bg-white/75 p-8 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-[#E1EEE8] text-[#2F6B58]"><UploadCloud size={28} /></div>
            <h3 className="mt-6 text-xl font-black">Bạn chưa có tài liệu để luyện tập</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#6B7772]">Hãy tải lên giáo trình hoặc bài đọc. Sau đó SmartStudy có thể tạo câu hỏi từ chính nội dung đó.</p>
            <Button className="mt-6" onClick={() => navigate('/dashboard')} leftIcon={<UploadCloud size={16} />}>Thêm tài liệu</Button>
          </Card>
        ) : isGenerating ? (
          <Card className="flex min-h-[360px] flex-col items-center justify-center space-y-4 p-10">
            <LoadingSpinner size="xl" variant="secondary" />
            <div className="text-center space-y-1">
              <h4 className="font-bold text-base text-[#17201E]">Đang chuẩn bị câu hỏi cho bạn...</h4>
              <p className="text-xs text-[#74807B]">SmartStudy đang chọn những nội dung quan trọng trong tài liệu.</p>
            </div>
          </Card>
        ) : (
          <Card className="space-y-7 p-6 sm:p-8">
            <div className="border-b border-[#E3E8E4] pb-5">
              <p className="text-[11px] font-black uppercase tracking-[0.17em] text-[#2F6B58]">Thiết lập nhanh</p>
              <h3 className="mt-1 text-xl font-black tracking-[-0.025em] text-[#17201E]">Bạn muốn luyện như thế nào?</h3>
              <p className="mt-1 text-sm text-[#74807B]">Chỉ mất vài giây để tạo một bài luyện mới.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Document Selector */}
              <div className="space-y-2 md:col-span-2">
                <label className="font-semibold text-sm text-[#181C1E] flex items-center gap-2">
                  <BookOpen size={16} className="text-[#2F6B58]" /> Tài liệu dùng để tạo câu hỏi
                </label>
                <select
                  data-testid="document-selector"
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="w-full rounded-2xl border border-[#DCE2DE] bg-[#F8FAF7] px-4 py-3 text-sm font-semibold text-[#26332F] focus:outline-none focus:ring-4 focus:ring-[#2F6B58]/10"
                >
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Num Questions Selector */}
              <div className="space-y-2">
                <label className="font-semibold text-sm text-[#181C1E] flex items-center gap-2">
                  <FileQuestion size={16} className="text-[#ED7148]" /> Số câu hỏi
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[3, 5, 10, 15, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      data-testid={`num-questions-${num}`}
                      onClick={() => setNumQuestions(num)}
                      className={clsx(
                        'py-2.5 rounded-xl font-bold text-xs border transition-all',
                        numQuestions === num
                          ? 'border-[#ED7148] bg-[#ED7148] text-white shadow-sm'
                          : 'border-[#DCE2DE] bg-[#F8FAF7] text-[#56635E] hover:border-[#ED7148]'
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
                  <Clock size={16} className="text-[#2F6B58]" /> Thời gian dự kiến
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
                          ? 'border-[#2F6B58] bg-[#2F6B58] text-white shadow-sm'
                          : 'border-[#DCE2DE] bg-[#F8FAF7] text-[#56635E] hover:border-[#2F6B58]'
                      )}
                    >
                      {mins} phút
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="font-semibold text-sm text-[#181C1E] flex items-center gap-2">
                  <Sparkles size={16} className="text-[#ED7148]" /> Mức độ câu hỏi
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {([
                    ['balanced', 'Cân bằng'],
                    ['easy', 'Dễ'],
                    ['medium', 'Trung bình'],
                    ['hard', 'Khó'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      data-testid={`difficulty-${value}`}
                      onClick={() => setDifficulty(value)}
                      className={clsx(
                        'py-2.5 rounded-xl font-bold text-xs border transition-all',
                        difficulty === value
                          ? 'border-[#ED7148] bg-[#ED7148] text-white shadow-sm'
                          : 'border-[#DCE2DE] bg-[#F8FAF7] text-[#56635E] hover:border-[#ED7148]'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 gap-3 border-t border-[#E3E8E4] pt-6 sm:grid-cols-2">
              <Button
                data-testid="generate-quiz-button"
                variant="outline"
                size="lg"
                className="w-full justify-center font-bold"
                leftIcon={<CheckSquare size={18} />}
                onClick={handleGenerateQuiz}
              >
                Luyện nhanh
              </Button>

              <Button
                data-testid="generate-exam-button"
                variant="primary"
                size="lg"
                className="w-full justify-center font-bold"
                leftIcon={<Award size={18} />}
                onClick={handleGenerateExam}
              >
                Tạo bài kiểm tra
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
    <div className="page-enter mx-auto max-w-4xl space-y-6 pb-16">
      {/* Top Sticky Progress & Timer Header */}
      <div className="sticky top-20 z-20 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#DFE5E1] bg-white/95 p-4 shadow-[0_12px_35px_rgba(28,49,42,0.1)] backdrop-blur-md sm:p-5">
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
              {activeExam ? `Bài kiểm tra #${activeExam.id.slice(0, 8)}` : activeQuiz ? `Bài luyện #${activeQuiz.id.slice(0, 8)}` : 'Bài kiểm tra'}
            </h3>
            <p className="text-xs text-[#74807B]">Đã trả lời {answeredCount}/{currentQuestions.length} câu</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex-1 max-w-xs hidden sm:block">
          <div className="h-2 w-full overflow-hidden rounded-full border border-[#DCE2DE] bg-[#EFF3EF]">
            <div
              className="h-full bg-gradient-to-r from-[#2F6B58] to-[#ED7148] transition-all duration-300"
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
                : 'border-[#DCE2DE] bg-[#F7F9F6] text-[#26332F]'
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
            Nộp bài
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
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E1EEE8] text-xs font-bold text-[#285D4C]">
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
                          ? 'border-[#2F6B58] bg-[#EDF6F1] font-bold text-[#285D4C] shadow-sm'
                          : 'border-[#E0E6E2] bg-white text-[#56635E] hover:border-[#91B3A5] hover:bg-[#F7FAF8]'
                      )}
                    >
                      <span
                        className={clsx(
                          'w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors',
                          isSelected
                            ? 'border-[#2F6B58] bg-[#2F6B58] text-white'
                            : 'border-[#DCE2DE] bg-[#F7F9F6] text-[#74807B]'
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
          variant="primary"
          size="lg"
          onClick={handleSubmitExam}
          isLoading={isSubmitting}
          className="px-12 shadow-xl text-base"
          leftIcon={<Send size={18} />}
        >
          Hoàn tất và xem kết quả
        </Button>
      </div>
    </div>
  );
};

type GenerationOperation = 'documents' | 'exam' | 'quiz';

interface ApiErrorPayload {
  readonly error?: {
    readonly code?: string;
  };
}

function getGenerationErrorMessage(
  error: unknown,
  operation: GenerationOperation,
): string {
  const fallback = operation === 'documents'
    ? 'Không thể tải danh sách tài liệu. Vui lòng kiểm tra kết nối và thử lại.'
    : operation === 'exam'
      ? 'Không thể tạo đề thi lúc này. Vui lòng thử lại sau.'
      : 'Không thể tạo quiz lúc này. Các câu đã hợp lệ sẽ không bị mất; vui lòng thử lại sau.';

  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    const code = error.response?.data?.error?.code;
    if (!error.response) {
      return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.';
    }
    if (code === 'QUIZ_DOCUMENT_NOT_READY' || code === 'EXAM_DOCUMENT_NOT_READY') {
      return 'Tài liệu vẫn đang được xử lý. Vui lòng đợi tài liệu chuyển sang trạng thái Sẵn sàng rồi thử lại.';
    }
    if (code === 'PROVIDER_NOT_CONFIGURED' || error.response.status === 503) {
      return 'Dịch vụ AI hiện chưa sẵn sàng. Vui lòng bật máy AI local hoặc thử lại sau.';
    }
    return fallback;
  }

  if (error instanceof Error && /timeout|unavailable|provider|kết nối/i.test(error.message)) {
    return 'Dịch vụ AI hiện chưa phản hồi. Vui lòng kiểm tra máy AI local và thử lại.';
  }

  return fallback;
}
