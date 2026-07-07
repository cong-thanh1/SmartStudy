import React from 'react';
import { Sparkles, CheckCircle2, XCircle, Lightbulb, ArrowRight } from 'lucide-react';
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
    <div className="space-y-6 animate-fadeIn">
      {/* Overview Score Header Card */}
      <Card variant="ai-glow" className="p-8 bg-gradient-to-br from-white via-[#F4F7F9] to-[#EFDBFF]/30">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <Badge variant={isPassed ? 'success' : 'warning'} size="md">
              {isPassed ? '🌟 Hoàn thành xuất sắc' : '💪 Cần cố gắng thêm'}
            </Badge>
            <h2 className="text-2xl font-bold text-[#181C1E] flex items-center justify-center md:justify-start gap-2">
              <span>Kết quả Phân tích Năng lực AI</span>
              <Sparkles className="w-6 h-6 text-[#8A2BE2] animate-bounce" />
            </h2>
            <p className="text-sm text-[#404751] max-w-xl">
              {result.aiFeedback || 'Hệ thống đã tự động chấm điểm và tổng hợp lỗi sai để giúp bạn cải thiện kiến thức nhanh chóng.'}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white shadow-md border border-[#E0E3E5] min-w-[160px]">
            <span className="text-xs font-semibold text-[#707882] uppercase tracking-wider">Điểm số của bạn</span>
            <span className={clsx('text-4xl font-extrabold my-1', isPassed ? 'text-emerald-600' : 'text-[#8A2BE2]')}>
              {result.score} <span className="text-lg font-normal text-[#707882]">/ {result.totalPoints}</span>
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#F4F7F9] text-[#181C1E]">
              Đạt {percentage}%
            </span>
          </div>
        </div>
      </Card>

      {/* Question breakdown & AI Explanations */}
      <div className="space-y-4">
        <h3 className="font-bold text-lg text-[#181C1E] flex items-center gap-2">
          <span>Chi tiết Từng câu hỏi &amp; Giải thích từ AI</span>
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
                className={clsx(
                  'p-6 transition-all border-l-4',
                  detail.isCorrect ? 'border-l-emerald-500 bg-white' : 'border-l-[#BA1A1A] bg-[#FFDAD6]/10'
                )}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-start gap-3">
                    <span
                      className={clsx(
                        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 text-white shadow-sm',
                        detail.isCorrect ? 'bg-emerald-500' : 'bg-[#BA1A1A]'
                      )}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-sm text-[#181C1E]">{qText}</p>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-xs">
                        <span className={clsx('font-medium', detail.isCorrect ? 'text-emerald-700' : 'text-[#BA1A1A]')}>
                          Lựa chọn của bạn: {question.options[detail.userOption] || `Đáp án ${detail.userOption + 1}`}
                        </span>
                        {!detail.isCorrect && (
                          <span className="font-semibold text-emerald-700">
                            Đáp án đúng: {question.options[detail.correctOption] || `Đáp án ${detail.correctOption + 1}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {detail.isCorrect ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    ) : (
                      <XCircle className="w-6 h-6 text-[#BA1A1A]" />
                    )}
                  </div>
                </div>

                {/* AI Explanation for Wrong Answer */}
                {!detail.isCorrect && detail.explanationForWrong && (
                  <div className="mt-4 ml-10 p-4 rounded-xl bg-white border border-[#8A2BE2]/30 shadow-sm flex items-start gap-3">
                    <Lightbulb className="w-5 h-5 text-[#8A2BE2] shrink-0 mt-0.5 animate-pulse" />
                    <div className="flex-1 text-xs space-y-1">
                      <p className="font-bold text-[#8A2BE2] uppercase tracking-wider text-[11px]">Phân tích lỗi sai từ AI:</p>
                      <p className="text-[#404751] leading-relaxed">{detail.explanationForWrong}</p>
                    </div>
                    {onReviewTutor && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReviewTutor(qText, detail.explanationForWrong)}
                        className="text-[#8A2BE2] hover:bg-[#8A2BE2]/10 text-xs shrink-0"
                        rightIcon={<ArrowRight size={14} />}
                      >
                        Hỏi Gia sư AI
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
          <Button variant="ai" size="lg" onClick={onRetake} leftIcon={<Sparkles className="w-5 h-5" />}>
            Làm lại đề thi thử năng lực
          </Button>
        </div>
      )}
    </div>
  );
};
