import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Award, Sparkles, RefreshCw, BookOpen } from 'lucide-react';
import { Button, Card, AiFeedbackCard } from '../components';
import { GradingResult, ExamQuestion } from '../types';

export const ResultsPage: React.FC = () => {
  const navigate = useNavigate();
  const [result, setResult] = useState<GradingResult | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('last_grading_result');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setResult(parsed.result);
        setQuestions(parsed.questions || []);
      } catch {
        // Ignore fallback
      }
    }

    // If no stored result, load demo sample result
    if (!stored) {
      const demoQuestions: ExamQuestion[] = [
        {
          id: 'eq-1',
          questionText: 'Trong kiến trúc Hexagonal của SmartStudy AI, tại sao business logic không được import trực tiếp từ SDK cloud?',
          options: [
            'Vì SDK cloud tốn quá nhiều bộ nhớ RAM',
            'Để cách ly nghiệp vụ, dễ kiểm thử unit test với mock adapter và chuyển đổi hạ tầng cloud không gãy vỡ',
            'Vì Node.js không hỗ trợ import SDK cloud trong controller',
            'Để giảm thời gian compile TypeScript',
          ],
          points: 10,
        },
        {
          id: 'eq-2',
          questionText: 'Extension pgvector trên PostgreSQL sử dụng thuật toán lập chỉ mục nào để truy vấn RAG đạt tốc độ x10?',
          options: ['B-Tree standard', 'HNSW (Hierarchical Navigable Small World)', 'GIN index', 'Hash Index'],
          points: 10,
        },
        {
          id: 'eq-3',
          questionText: 'Trong luồng xử lý PDF bất đồng bộ, công cụ nào quản lý hàng đợi tác vụ worker?',
          options: ['Redis + BullMQ', 'Apache ActiveMQ', 'Amazon SQS trực tiếp', 'SQLite Queue'],
          points: 10,
        },
      ];

      const demoResult: GradingResult = {
        attemptId: 'demo-res-1',
        score: 20,
        totalPoints: 30,
        details: [
          {
            questionId: 'eq-1',
            userOption: 1,
            correctOption: 1,
            isCorrect: true,
          },
          {
            questionId: 'eq-2',
            userOption: 0,
            correctOption: 1,
            isCorrect: false,
            explanationForWrong:
              'Bạn đã chọn B-Tree. Tuy nhiên, B-Tree chỉ hỗ trợ tra cứu vô hướng (scalar). Đối với vector embeddings số chiều lớn (768/1536 dims), hệ thống sử dụng HNSW để tìm kiếm k-NN siêu tốc độ.',
          },
          {
            questionId: 'eq-3',
            userOption: 0,
            correctOption: 0,
            isCorrect: true,
          },
        ],
        aiFeedback:
          '💡 **Nhận xét từ AI:** Bạn đã nắm vững lý thuyết kiến trúc Ports & Adapters và luồng BullMQ. Hãy lưu ý thêm về chỉ mục vector HNSW của pgvector ở Chương 1 nhé!',
      };

      setResult(demoResult);
      setQuestions(demoQuestions);
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
