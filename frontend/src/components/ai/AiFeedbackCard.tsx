import React from 'react';
import { ArrowCounterClockwise as RotateCcw, ArrowRight, CheckCircle as CheckCircle2, Lightbulb, XCircle } from '@phosphor-icons/react';
import { GradingResult, ExamQuestion } from '../../types';
import { Card, Badge, Button } from '../common';
import { clsx } from 'clsx';

export interface AiFeedbackCardProps {
  result: GradingResult;
  questions: ExamQuestion[];
  onRetake?: () => void;
  onReviewTutor?: (questionText: string, explanation?: string) => void;
}

export const AiFeedbackCard: React.FC<AiFeedbackCardProps> = ({
  result,
  questions,
  onRetake,
  onReviewTutor,
}) => {
  const percentage = Math.round((result.score / (result.totalPoints || 1)) * 100);
  const isPassed = percentage >= 70;

  return (
    <div className="space-y-6 animate-fadeIn" data-testid="results-page">
      {/* Overview Score Header Card */}
      <Card variant="ai-glow" className="rounded-lg p-6 sm:p-8">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="space-y-3">
            <Badge data-testid="result-status-badge" variant={isPassed ? 'success' : 'warning'} size="md">
              {isPassed ? 'Bạn đã nắm khá tốt' : 'Mình cùng ôn thêm nhé'}
            </Badge>
            <h2 className="text-2xl text-ink">Kết quả bài làm</h2>
            <p data-testid="ai-feedback-text" className="text-sm text-[var(--color-ink-2)] max-w-xl">
              {result.aiFeedback || 'Xem lại từng câu bên dưới để biết phần nào bạn đã hiểu và phần nào nên ôn thêm.'}
            </p>
          </div>

          <div className="min-w-[10rem] border-l border-rule pl-6">
            <span className="text-sm font-semibold text-muted">Điểm của bạn</span>
            <span data-testid="score-display" className={clsx('hm-data my-1 block text-4xl font-medium', isPassed ? 'text-success' : 'text-signal')}>
              {result.score} <span className="text-lg font-normal text-[var(--color-muted)]">/ {result.totalPoints}</span>
            </span>
            <span data-testid="score-percentage" className="text-sm font-semibold text-ink">
              Đạt {percentage}%
            </span>
          </div>
        </div>
      </Card>

      {/* Question breakdown & AI Explanations */}
      <div className="space-y-4">
        <h3 className="font-bold text-lg text-[var(--color-ink)] flex items-center gap-2">
              <span>Xem lại từng câu</span>
          <Badge variant="neutral" size="sm">{result.details.length} câu</Badge>
        </h3>

        <div className="grid grid-cols-1 gap-4">
          {result.details.map((detail, idx) => {
            const question = questions.find((q) => {
              const qId = q.question_id || q.id;
              return qId === detail.questionId;
            }) || questions[idx];
            if (!question) return null;
            const qText = question.question_text || question.questionText || '';

            return (
              <Card
                key={detail.questionId}
                data-testid={`result-question-${idx}`}
                className={clsx(
                  'rounded-lg p-6',
                  detail.isCorrect ? 'border-success bg-surface' : 'border-error bg-error-soft/30'
                )}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-start gap-3">
                    <span
                      className={clsx(
                        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 text-paper shadow-sm',
                        detail.isCorrect ? 'bg-success' : 'bg-error'
                      )}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-sm text-[var(--color-ink)]">{qText}</p>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-xs">
                        <span className={clsx('font-medium', detail.isCorrect ? 'text-success' : 'text-error')}>
                          Lựa chọn của bạn: {question.options[detail.userOption] || `Đáp án ${detail.userOption + 1}`}
                        </span>
                        {!detail.isCorrect && (
                          <span data-testid={`correct-answer-${idx}`} className="font-semibold text-success">
                            Đáp án đúng: {question.options[detail.correctOption] || `Đáp án ${detail.correctOption + 1}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {detail.isCorrect ? (
                      <CheckCircle2 data-testid={`result-correct-icon-${idx}`} className="h-6 w-6 text-success" />
                    ) : (
                      <XCircle data-testid={`result-wrong-icon-${idx}`} className="w-6 h-6 text-[var(--color-error)]" />
                    )}
                  </div>
                </div>

                {/* AI Explanation for Wrong Answer */}
                {!detail.isCorrect && detail.explanationForWrong && (
                  <div data-testid={`explanation-${idx}`} className="mt-4 ml-10 flex items-start gap-3 rounded-lg border border-rule bg-surface p-4">
                    <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-signal" />
                    <div className="flex-1 text-xs space-y-1">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-signal)]">Vì sao đáp án này chưa đúng?</p>
                      <p className="text-[var(--color-ink-2)] leading-relaxed">{detail.explanationForWrong}</p>
                    </div>
                    {onReviewTutor && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReviewTutor(qText, detail.explanationForWrong)}
                        className="text-[var(--color-signal)] hover:bg-[var(--color-signal)]/10 text-xs shrink-0"
                        rightIcon={<ArrowRight size={14} />}
                      >
                        Hỏi thêm
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Footer Action */}
      {onRetake && (
        <div className="flex justify-center pt-4">
          <Button variant="ai" size="lg" onClick={onRetake} leftIcon={<RotateCcw className="h-5 w-5" />}>
            Làm một bài khác
          </Button>
        </div>
      )}
    </div>
  );
};
