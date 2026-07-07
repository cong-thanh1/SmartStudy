import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Award, Sparkles, RefreshCw, BookOpen } from 'lucide-react';
import { Button, Card, AiFeedbackCard } from '../components';
import { GradingResult, ExamQuestion, ExamAttempt } from '../types';

export const ResultsPage: React.FC = () => {
  const navigate = useNavigate();
  const [result, setResult] = useState<GradingResult | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('last_grading_result');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);

        // New format: { attempt: ExamAttempt, questions: ExamQuestion[] }
        if (parsed.attempt) {
          const attempt = parsed.attempt as ExamAttempt;
          const rawQuestions = parsed.questions as ExamQuestion[] || [];
          setQuestions(rawQuestions);

          // Convert ExamAttempt to GradingResult for AiFeedbackCard compatibility
          if (attempt.detailedResult) {
            const details = attempt.detailedResult.map((d, idx) => {
              const q = rawQuestions[idx] || null;
              const opts = q?.options || [];
              const userOptIdx = opts.indexOf(d.selected_answer);
              const correctOptIdx = opts.indexOf(d.correct_answer);
              return {
                questionId: d.question_id,
                userOption: userOptIdx >= 0 ? userOptIdx : 0,
                correctOption: correctOptIdx >= 0 ? correctOptIdx : 0,
                isCorrect: d.is_correct,
                explanationForWrong: !d.is_correct ? d.explanation : undefined,
              };
            });
            setResult({
              attemptId: attempt.id,
              score: attempt.score ?? 0,
              totalPoints: attempt.maxScore ?? rawQuestions.length,
              details,
              aiFeedback: attempt.aiFeedback || undefined,
            });
          }
        } else if (parsed.result) {
          // Legacy format: { result: GradingResult, questions: ExamQuestion[] }
          setResult(parsed.result);
          setQuestions(parsed.questions || []);
        }
      } catch {
        // Ignore JSON parse errors for corrupted storage
      }
    }
  }, []);

  const handleReviewTutor = (questionText: string, explanation?: string) => {
    // Navigate to learning space and open tutor tab
    navigate(`/learning?ask=${encodeURIComponent(`Giải thích chi tiết cho tôi về câu hỏi: "${questionText}". Tại sao lỗi sai lại là: ${explanation || ''}`)}`);
  };

  if (!result) {
    return (
      <Card className="p-16 text-center max-w-lg mx-auto space-y-4">
        <Award className="w-12 h-12 text-[#8A2BE2] mx-auto animate-bounce" />
        <h3 className="font-bold text-base text-[#181C1E]">Chưa có kết quả làm bài thi nào</h3>
        <p className="text-xs text-[#707882]">
          Bạn chưa thực hiện bài kiểm tra trắc nghiệm hoặc đề thi thử năng lực AI nào.
        </p>
        <Button variant="ai" size="md" onClick={() => navigate('/exam-center')} leftIcon={<Sparkles size={16} />}>
          Vào Trung tâm Khảo thí ngay
        </Button>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-16">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/exam-center')} leftIcon={<ArrowLeft size={16} />}>
          Quay lại Trung tâm Khảo thí
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/learning')}
            leftIcon={<BookOpen size={16} />}
          >
            Mở giáo trình ôn tập
          </Button>
          <Button
            variant="ai"
            size="sm"
            onClick={() => navigate('/exam-center')}
            leftIcon={<RefreshCw size={14} />}
          >
            Làm bài kiểm tra mới
          </Button>
        </div>
      </div>

      {/* Main AI Feedback Breakdown Component */}
      <AiFeedbackCard
        result={result}
        questions={questions}
        onRetake={() => navigate('/exam-center')}
        onReviewTutor={handleReviewTutor}
      />
    </div>
  );
};
