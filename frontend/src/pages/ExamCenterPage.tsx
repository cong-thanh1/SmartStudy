import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  WarningCircle as AlertTriangle,
  FileText as FileQuestion,
  Clock,
  CheckSquare,
  Sparkle as Sparkles,
  BookOpen,
  Medal as Award,
  ArrowLeft,
  PaperPlaneTilt as Send,
  UploadSimple as UploadCloud,
} from '@phosphor-icons/react';
import { Button, Card, LoadingSpinner } from '../components';
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
      <div className="page-enter mx-auto max-w-5xl space-y-8">
        <section className="grid gap-6 border-b border-rule pb-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.58fr)] lg:items-end">
          <h2 className="max-w-[16ch] text-3xl sm:text-5xl">Tạo bài luyện từ phần bạn vừa học.</h2>
          <p className="max-w-[52ch] text-base leading-7 text-muted">Chọn tài liệu, số câu và độ khó. Câu hỏi được tạo từ chính nội dung bạn đã tải lên.</p>
        </section>

        {generationError && (
          <div
            role="alert"
            data-testid="generation-error"
            className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--color-error)]/30 bg-[var(--color-error-soft)] p-4 text-[var(--color-error)]"
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
              className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold hover:bg-[var(--color-error)]/10"
              onClick={() => setGenerationError(null)}
            >
              Đóng
            </button>
          </div>
        )}

        {isLoadingDocuments ? (
          <Card className="flex min-h-[320px] items-center justify-center"><LoadingSpinner text="Đang mở tài liệu của bạn..." /></Card>
        ) : documents.length === 0 ? (
          <Card className="soft-grid flex min-h-[360px] flex-col items-center justify-center border-2 border-dashed border-[var(--color-rule-strong)] bg-surface/75 p-8 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]"><UploadCloud size={28} /></div>
            <h3 className="mt-6 text-xl font-black">Bạn chưa có tài liệu để luyện tập</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-[var(--color-muted)]">Hãy tải lên giáo trình hoặc bài đọc. Sau đó SmartStudy có thể tạo câu hỏi từ chính nội dung đó.</p>
            <Button className="mt-6" onClick={() => navigate('/dashboard')} leftIcon={<UploadCloud size={16} />}>Thêm tài liệu</Button>
          </Card>
        ) : isGenerating ? (
          <Card className="flex min-h-[360px] flex-col items-center justify-center space-y-4 p-10">
            <LoadingSpinner size="xl" variant="secondary" />
            <div className="text-center space-y-1">
              <h4 className="font-bold text-base text-[var(--color-ink)]">Đang chuẩn bị câu hỏi cho bạn...</h4>
              <p className="text-xs text-[var(--color-muted)]">SmartStudy đang chọn những nội dung quan trọng trong tài liệu.</p>
            </div>
          </Card>
        ) : (
          <Card className="space-y-8 rounded-lg p-6 sm:p-8">
            <div className="border-b border-[var(--color-rule)] pb-5">
              <h3 className="text-xl text-ink">Thiết lập bài luyện</h3>
              <p className="mt-2 text-sm text-muted">Các lựa chọn này chỉ áp dụng cho lần luyện hiện tại.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Document Selector */}
              <div className="space-y-2 md:col-span-2">
                <label className="font-semibold text-sm text-[var(--color-ink)] flex items-center gap-2">
                  <BookOpen size={16} className="text-[var(--color-accent)]" /> Tài liệu dùng để tạo câu hỏi
                </label>
                <select
                  data-testid="document-selector"
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="min-h-12 w-full rounded-lg border border-rule-strong bg-paper-2 px-4 py-3 text-sm font-semibold text-ink-2 outline-2 outline-transparent outline-offset-1 focus-visible:border-ink focus-visible:outline-focus"
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
                <label className="font-semibold text-sm text-[var(--color-ink)] flex items-center gap-2">
                  <FileQuestion size={16} className="text-[var(--color-signal)]" /> Số câu hỏi
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[3, 5, 10, 15, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      data-testid={`num-questions-${num}`}
                      onClick={() => setNumQuestions(num)}
                      className={clsx(
                        'hm-affordance rounded-lg border px-2 py-2.5 text-xs font-bold transition-colors duration-150',
                        numQuestions === num
                          ? 'border-ink bg-ink text-paper'
                          : 'border-rule bg-paper-2 text-muted hover:border-rule-strong hover:text-ink'
                      )}
                    >
                      {num} câu
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration Selector */}
              <div className="space-y-2">
                <label className="font-semibold text-sm text-[var(--color-ink)] flex items-center gap-2">
                  <Clock size={16} className="text-[var(--color-accent)]" /> Thời gian dự kiến
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[10, 15, 30].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      data-testid={`duration-${mins}`}
                      onClick={() => setDurationMinutes(mins)}
                      className={clsx(
                        'hm-affordance rounded-lg border px-2 py-2.5 text-xs font-bold transition-colors duration-150',
                        durationMinutes === mins
                          ? 'border-ink bg-ink text-paper'
                          : 'border-rule bg-paper-2 text-muted hover:border-rule-strong hover:text-ink'
                      )}
                    >
                      {mins} phút
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="font-semibold text-sm text-[var(--color-ink)] flex items-center gap-2">
                  <Sparkles size={16} className="text-[var(--color-signal)]" /> Mức độ câu hỏi
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
                        'hm-affordance rounded-lg border px-2 py-2.5 text-xs font-bold transition-colors duration-150',
                        difficulty === value
                          ? 'border-ink bg-ink text-paper'
                          : 'border-rule bg-paper-2 text-muted hover:border-rule-strong hover:text-ink'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 gap-3 border-t border-[var(--color-rule)] pt-6 sm:grid-cols-2">
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
      <div className="sticky top-[5.25rem] z-[var(--z-sticky)] flex flex-wrap items-center justify-between gap-4 rounded-lg border border-rule bg-surface p-4 sm:p-5">
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
            <h3 className="font-bold text-base text-[var(--color-ink)]">
              {activeExam ? `Bài kiểm tra #${activeExam.id.slice(0, 8)}` : activeQuiz ? `Bài luyện #${activeQuiz.id.slice(0, 8)}` : 'Bài kiểm tra'}
            </h3>
            <p className="text-xs text-[var(--color-muted)]">Đã trả lời {answeredCount}/{currentQuestions.length} câu</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex-1 max-w-xs hidden sm:block">
          <div className="h-2 w-full overflow-hidden rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-3)]">
            <div
              className="h-full origin-left bg-accent transition-transform duration-300 ease-[var(--ease-out)]"
              style={{ transform: `scaleX(${progressPercentage / 100})` }}
            />
          </div>
        </div>

        {/* Timer & Submit */}
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono font-bold text-sm border',
              timeLeftSeconds < 60
                ? 'border-error bg-error-soft text-error'
                : 'border-[var(--color-rule)] bg-[var(--color-paper-2)] text-[var(--color-ink-2)]'
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
            <Card key={qId} data-testid={`question-card-${qIdx}`} className="space-y-4 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-xs font-bold text-[var(--color-accent)]">
                  {qIdx + 1}
                </span>
                <h4 data-testid={`question-text-${qIdx}`} className="font-bold text-sm text-[var(--color-ink)] leading-relaxed flex-1">
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
                        'flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-lg border p-3.5 text-left text-sm font-medium transition-colors duration-150',
                        isSelected
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] font-bold text-[var(--color-accent)] shadow-sm'
                          : 'border-[var(--color-rule)] bg-surface text-[var(--color-muted)] hover:border-[var(--color-muted)] hover:bg-[var(--color-paper-2)]'
                      )}
                    >
                      <span
                        className={clsx(
                          'w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors',
                          isSelected
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-paper'
                            : 'border-[var(--color-rule)] bg-[var(--color-paper-2)] text-[var(--color-muted)]'
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
          className="px-12 text-base"
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
