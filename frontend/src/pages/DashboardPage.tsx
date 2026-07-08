import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  FileText,
  BookOpen,
  FileQuestion,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Database,
  Layers,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Button, Card, Modal, Input, Badge, LoadingSpinner } from '../components';
import { documentService } from '../services';
import { Document } from '../types';
import { clsx } from 'clsx';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = async () => {
    setIsLoading(true);
    try {
      const docs = await documentService.listDocuments();
      setDocuments(docs);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!docTitle) {
        setDocTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadError('');
    try {
      const newDoc = await documentService.uploadDocument(selectedFile, docTitle);
      setDocuments((prev) => [newDoc, ...prev]);
      setIsUploadModalOpen(false);
      setSelectedFile(null);
      setDocTitle('');
      setUploadError('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Tải lên thất bại. Vui lòng thử lại.';
      setUploadError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa tài liệu này khỏi thư viện?')) {
      await documentService.deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    }
  };

  const totalChunks = documents.reduce((acc, d) => acc + (d.chunkCount || 0), 0);
  const filteredDocuments = searchQuery.trim()
    ? documents.filter((d) =>
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.originalName || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : documents;

  return (
    <div className="space-y-8 animate-fadeIn max-w-7xl mx-auto">
      {/* Top Welcome Banner & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card variant="ai-glow" className="md:col-span-2 p-6 bg-gradient-to-r from-[#0073BB] to-[#8A2BE2] text-white flex flex-col justify-between">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
              Thư viện Tri thức RAG
            </span>
            <h2 className="text-2xl font-bold">Xin chào, hãy bắt đầu không gian học tập!</h2>
            <p className="text-xs text-white/80 leading-relaxed">
              Tải lên tài liệu PDF giáo trình. Hệ thống tự động phân mảnh và lập chỉ mục HNSW vector tốc độ cao trên nền
              pgvector.
            </p>
          </div>
          <div className="pt-4 flex items-center gap-3">
            <Button
              data-testid="upload-button-banner"
              variant="outline"
              size="sm"
              className="bg-white text-[#232F3E] border-none hover:bg-white/90 font-bold shadow-md"
              leftIcon={<UploadCloud size={16} />}
              onClick={() => setIsUploadModalOpen(true)}
            >
              Tải PDF mới
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10"
              rightIcon={<ArrowRight size={14} />}
              onClick={() => navigate('/learning')}
            >
              Vào phòng học RAG
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-red-500 text-white border-none"
              id="seed-document-btn"
              onClick={async () => {
                const pdfContent = '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 5 0 R\n>>\nendobj\n5 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 24 Tf\n100 700 Td\n(Dummy PDF Document) Tj\nET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000222 00000 n \n0000000305 00000 n \ntrailer\n<<\n/Size 6\n/Root 1 0 R\n>>\nstartxref\n399\n%%EOF\n';
                const blob = new Blob([pdfContent], { type: 'application/pdf' });
                const file = new File([blob], 'dummy.pdf', { type: 'application/pdf' });
                await documentService.uploadDocument(file, 'Dummy PDF Document for E2E Test');
                fetchDocs();
              }}
            >
              Seed Document
            </Button>
          </div>
        </Card>

        {/* Stat Card 1 */}
        <Card className="p-6 flex flex-col justify-between border-l-4 border-l-[#0073BB]">
          <div className="flex items-center justify-between text-[#707882]">
            <span className="text-xs font-semibold uppercase">Tài liệu đã tải</span>
            <FileText className="w-5 h-5 text-[#0073BB]" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-[#181C1E]">{documents.length}</span>
            <span className="text-xs text-[#707882] ml-1.5">file PDF</span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-600 font-medium flex items-center gap-1">
            <CheckCircle2 size={13} /> 100% Sẵn sàng truy vấn
          </div>
        </Card>

        {/* Stat Card 2 */}
        <Card className="p-6 flex flex-col justify-between border-l-4 border-l-[#8A2BE2]">
          <div className="flex items-center justify-between text-[#707882]">
            <span className="text-xs font-semibold uppercase">Đoạn nhúng Vector</span>
            <Database className="w-5 h-5 text-[#8A2BE2]" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-[#181C1E]">{totalChunks}</span>
            <span className="text-xs text-[#707882] ml-1.5">chunks</span>
          </div>
          <div className="mt-2 text-[11px] text-[#8A2BE2] font-medium flex items-center gap-1">
            <Layers size={13} /> Index HNSW pgvector
          </div>
        </Card>
      </div>

      {/* Document Library List */}
      <div className="space-y-4" data-testid="document-library">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-[#181C1E]">Danh sách Giáo trình &amp; Tài liệu</h3>
            <p className="text-xs text-[#707882]">Nhấn chọn chức năng để học tập AI hoặc tạo bài kiểm tra nhanh</p>
          </div>
          <Button
            data-testid="upload-button"
            variant="primary"
            size="sm"
            leftIcon={<UploadCloud size={16} />}
            onClick={() => setIsUploadModalOpen(true)}
          >
            Tải tài liệu mới
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input
            data-testid="document-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm tài liệu theo tên..."
            className="w-full bg-[#F4F7F9] border border-[#E0E3E5] rounded-xl px-4 py-2.5 text-sm text-[#181C1E] placeholder-[#707882] focus:outline-none focus:ring-2 focus:ring-[#0073BB]"
          />
          {searchQuery && (
            <button
              data-testid="document-search-clear"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#707882] hover:text-[#181C1E]"
            >
              ✕
            </button>
          )}
        </div>

        {isLoading ? (
          <Card className="p-16 flex items-center justify-center">
            <LoadingSpinner text="Đang đồng bộ danh sách tài liệu từ MinIO..." />
          </Card>
        ) : documents.length === 0 ? (
          <Card data-testid="documents-empty-state" className="p-16 text-center space-y-4 border-dashed border-2 border-[#C0C7D2]">
            <div className="w-16 h-16 rounded-full bg-[#D0E4FF]/40 text-[#0073BB] flex items-center justify-center mx-auto">
              <UploadCloud size={32} />
            </div>
            <div className="max-w-md mx-auto">
              <h4 className="font-bold text-base text-[#181C1E]">Chưa có tài liệu nào trong thư viện</h4>
              <p className="text-xs text-[#707882] mt-1">
                Tải lên file PDF bài giảng hoặc giáo trình của bạn để kích hoạt hệ thống RAG và tự động sinh câu hỏi trắc nghiệm.
              </p>
            </div>
            <Button data-testid="upload-button-empty" variant="ai" size="md" onClick={() => setIsUploadModalOpen(true)}>
              Tải tài liệu đầu tiên
            </Button>
          </Card>
        ) : filteredDocuments.length === 0 && searchQuery ? (
          <Card data-testid="documents-search-empty" className="p-16 text-center space-y-4 border-dashed border-2 border-[#C0C7D2]">
            <div className="max-w-md mx-auto">
              <h4 className="font-bold text-base text-[#181C1E]">Không tìm thấy tài liệu nào</h4>
              <p className="text-xs text-[#707882] mt-1">Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc.</p>
            </div>
          </Card>
        ) : (
          <div data-testid="document-list" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDocuments.map((doc) => (
              <Card
                key={doc.id}
                data-testid={`document-card-${doc.id}`}
                variant="interactive"
                className="p-6 flex flex-col justify-between h-[230px]"
                onClick={() => navigate(`/learning?docId=${doc.id}`)}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F4F7F9] text-[#0073BB] flex items-center justify-center shrink-0">
                      <FileText size={20} />
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.status === 'ready' ? (
                        <Badge data-testid={`document-status-${doc.id}`} variant="success" size="sm">
                          <CheckCircle2 size={12} className="mr-1" /> Sẵn sàng
                        </Badge>
                      ) : doc.status === 'processing' || doc.status === 'uploading' ? (
                        <Badge data-testid={`document-status-${doc.id}`} variant="warning" size="sm">
                          <Clock size={12} className="mr-1 animate-spin" /> Đang xử lý
                        </Badge>
                      ) : (
                        <Badge data-testid={`document-status-${doc.id}`} variant="error" size="sm">
                          <AlertCircle size={12} className="mr-1" /> Lỗi
                        </Badge>
                      )}
                      <button
                        data-testid={`delete-button-${doc.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(doc.id);
                        }}
                        className="p-1 text-[#707882] hover:text-[#BA1A1A] hover:bg-black/5 rounded transition-colors"
                        title="Xóa tài liệu"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <h4 className="font-bold text-sm text-[#181C1E] line-clamp-2 leading-snug group-hover:text-[#0073BB] transition-colors">
                    {doc.title}
                  </h4>
                  <p className="text-xs text-[#707882] mt-1 truncate">{doc.originalName}</p>
                </div>

                <div className="pt-4 border-t border-[#E0E3E5] flex items-center justify-between text-xs text-[#707882]">
                  <span className="font-medium bg-[#F4F7F9] px-2 py-0.5 rounded">
                    {doc.chunkCount} vector chunks
                  </span>
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-2 py-1 text-xs text-[#0073BB] hover:bg-[#0073BB]/10"
                      onClick={() => navigate(`/learning?docId=${doc.id}`)}
                      title="Mở không gian học tập RAG"
                    >
                      <BookOpen size={14} className="mr-1" /> Học RAG
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-2 py-1 text-xs text-[#8A2BE2] hover:bg-[#8A2BE2]/10"
                      onClick={() => navigate(`/exam-center?docId=${doc.id}`)}
                      title="Tạo bài trắc nghiệm nhanh"
                    >
                      <FileQuestion size={14} className="mr-1" /> Quiz
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => !isUploading && setIsUploadModalOpen(false)}
        title="Tải lên Tài liệu Giáo trình (PDF)"
        size="md"
      >
        <form data-testid="upload-form" onSubmit={handleUploadSubmit} className="space-y-6">
          <Input
            data-testid="document-title-input"
            label="Tên hiển thị của tài liệu"
            placeholder="Ví dụ: Chương 1 - Trí tuệ Nhân tạo & RAG"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            required
          />

          <div className="space-y-1.5">
            <label className="font-medium text-sm text-[#181C1E]">Chọn file PDF từ máy tính</label>
            <div
              data-testid="file-drop-zone"
              onClick={() => fileInputRef.current?.click()}
              className={clsx(
                'border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3',
                selectedFile
                  ? 'border-[#0073BB] bg-[#0073BB]/5'
                  : 'border-[#C0C7D2] hover:border-[#0073BB] hover:bg-[#F4F7F9]'
              )}
            >
              <input
                ref={fileInputRef}
                data-testid="file-input"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-12 h-12 rounded-full bg-[#D0E4FF] text-[#0073BB] flex items-center justify-center">
                <UploadCloud size={24} />
              </div>
              {selectedFile ? (
                <div>
                  <p className="font-semibold text-sm text-[#0073BB]">{selectedFile.name}</p>
                  <p className="text-xs text-[#707882] mt-0.5">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB — Sẵn sàng phân mảnh và lập chỉ mục
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-semibold text-sm text-[#181C1E]">Nhấn để chọn hoặc kéo thả file PDF vào đây</p>
                  <p className="text-xs text-[#707882] mt-0.5">Hỗ trợ file PDF dung lượng tối đa 50MB</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F4F7F9] border border-[#E0E3E5] text-xs text-[#404751] space-y-1">
            <p className="font-semibold text-[#181C1E] flex items-center gap-1.5">
              <Sparkles size={14} className="text-[#8A2BE2]" /> Xử lý tự động trong nền (BullMQ):
            </p>
            <p>1. Tải file trực tiếp lên MinIO storage qua Presigned URL.</p>
            <p>2. Worker bóc tách văn bản, chia nhỏ theo câu và tạo nhúng HNSW pgvector.</p>
          </div>

          {uploadError && (
            <div className="p-3 rounded-lg bg-[#FFDAD6] text-[#93000A] text-xs font-medium">
              {uploadError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              data-testid="upload-cancel-button"
              type="button"
              variant="outline"
              onClick={() => { setIsUploadModalOpen(false); setUploadError(''); }}
              disabled={isUploading}
            >
              Hủy bỏ
            </Button>
            <Button
              data-testid="upload-submit-button"
              type="submit"
              variant="ai"
              disabled={!selectedFile}
              isLoading={isUploading}
              leftIcon={<UploadCloud size={16} />}
            >
              Bắt đầu Tải lên &amp; Lập chỉ mục
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
