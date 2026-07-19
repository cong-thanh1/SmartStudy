import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, BookOpenText, CheckCircle2, ClipboardCheck, Clock3, FileText, Plus, Search, Trash2, UploadCloud } from 'lucide-react';
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

  const fetchDocs = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setIsLoading(true);
    }
    try {
      setDocuments(await documentService.listDocuments());
    } catch {
      // Keep the most recent successful list visible.
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchDocs(true);
  }, [fetchDocs]);

  useEffect(() => {
    const hasProcessingDocument = documents.some(
      (document) => document.status === 'uploading' || document.status === 'processing',
    );

    // Refresh only while an uploaded document is being processed. Polling a
    // completed library creates needless requests and makes the UI flicker.
    if (!hasProcessingDocument) {
      return;
    }

    const refreshId = window.setInterval(() => void fetchDocs(), 3_000);
    return () => window.clearInterval(refreshId);
  }, [documents, fetchDocs]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (!docTitle) setDocTitle(file.name.replace(/\.[^/.]+$/, ''));
  };

  const closeUploadModal = () => {
    if (isUploading) return;
    setIsUploadModalOpen(false);
    setUploadError('');
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
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Chưa thể tải tài liệu lên. Vui lòng thử lại.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa tài liệu này khỏi thư viện? Bạn sẽ không thể khôi phục sau khi xóa.')) return;
    await documentService.deleteDocument(id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const handleSeedDocument = async () => {
    const pdfContent = '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 5 0 R\n>>\nendobj\n5 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 24 Tf\n100 700 Td\n(SmartStudy Sample Document) Tj\nET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000222 00000 n \n0000000305 00000 n \ntrailer\n<<\n/Size 6\n/Root 1 0 R\n>>\nstartxref\n399\n%%EOF\n';
    const file = new File([new Blob([pdfContent], { type: 'application/pdf' })], 'tai-lieu-mau.pdf', { type: 'application/pdf' });
    await documentService.uploadDocument(file, 'Tài liệu mẫu SmartStudy');
    await fetchDocs();
  };

  const totalSections = documents.reduce((acc, d) => acc + (d.chunkCount || 0), 0);
  const readyDocuments = documents.filter((d) => d.status === 'ready').length;
  const filteredDocuments = searchQuery.trim()
    ? documents.filter((d) => d.title.toLowerCase().includes(searchQuery.toLowerCase()) || (d.originalName || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : documents;

  return (
    <div className="page-enter space-y-10">
      <section className="grid gap-8 border-b border-rule pb-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="max-w-3xl">
          <h2 className="text-3xl sm:text-5xl">Tiếp tục từ tài liệu gần nhất.</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted">Mở một tài liệu đang học hoặc thêm nội dung mới. Mọi câu hỏi, bản tóm tắt và bài luyện sẽ đi theo tài liệu bạn chọn.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button data-testid="upload-button-banner" size="lg" onClick={() => setIsUploadModalOpen(true)} leftIcon={<Plus size={18} />}>Thêm tài liệu</Button>
          <Button variant="outline" size="lg" onClick={() => navigate('/learning')} rightIcon={<ArrowRight size={17} />}>Mở phòng học</Button>
        </div>
      </section>

      <section className="grid divide-y divide-rule border-y border-rule sm:grid-cols-3 sm:divide-x sm:divide-y-0" aria-label="Tóm tắt thư viện">
        {[
          { label: 'Tài liệu', value: documents.length, note: documents.length ? 'trong thư viện' : 'chưa có tài liệu' },
          { label: 'Sẵn sàng', value: readyDocuments, note: 'để đọc và hỏi' },
          { label: 'Phần nội dung', value: totalSections, note: 'đã nhận diện' },
        ].map(({ label, value, note }) => (
          <div key={label} className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 px-1 py-5 sm:block sm:px-6">
            <strong className="hm-data text-3xl font-medium text-ink">{value}</strong>
            <p className="text-sm font-semibold text-ink-2 sm:mt-2">{label}</p>
            <p className="col-start-2 text-sm text-muted sm:mt-1">{note}</p>
          </div>
        ))}
      </section>

      <section data-testid="document-library" className="space-y-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><h3 className="text-2xl text-ink">Thư viện tài liệu</h3><p className="mt-2 text-sm text-muted">Mở tài liệu để đọc, hỏi hoặc tạo bài luyện.</p></div>
          <Button data-testid="upload-button" size="md" leftIcon={<UploadCloud size={16} />} onClick={() => setIsUploadModalOpen(true)}>Tải tài liệu lên</Button>
        </div>

        {documents.length > 0 && (
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
            <input data-testid="document-search-input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Tên tài liệu" aria-label="Tìm tài liệu" className="h-12 w-full rounded-lg border border-rule-strong bg-surface pl-11 pr-12 text-sm text-ink outline-2 outline-transparent outline-offset-1 transition-colors duration-150 hover:bg-paper-2 focus-visible:border-ink focus-visible:outline-focus" />
            {searchQuery && <button data-testid="document-search-clear" onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-paper-3" aria-label="Xóa tìm kiếm">×</button>}
          </div>
        )}

        {isLoading ? (
          <Card className="flex min-h-56 items-center justify-center"><LoadingSpinner text="Đang mở thư viện của bạn..." /></Card>
        ) : documents.length === 0 ? (
          <Card data-testid="documents-empty-state" className="soft-grid flex min-h-[360px] flex-col items-center justify-center border-2 border-dashed border-[var(--color-rule-strong)] bg-surface/70 p-8 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]"><UploadCloud size={29} /></div>
            <h4 className="mt-6 text-xl font-black tracking-[-0.02em]">Bắt đầu với tài liệu đầu tiên</h4>
            <p className="mt-2 max-w-md text-sm leading-6 text-[var(--color-muted)]">Tải lên giáo trình, bài giảng hoặc tài liệu cần ôn. SmartStudy sẽ chuẩn bị để bạn có thể hỏi, tóm tắt và luyện tập.</p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button data-testid="upload-button-empty" onClick={() => setIsUploadModalOpen(true)} leftIcon={<Plus size={16} />}>Chọn tài liệu</Button>
              <Button id="seed-document-btn" variant="outline" onClick={() => void handleSeedDocument()}>Dùng tài liệu mẫu</Button>
            </div>
          </Card>
        ) : filteredDocuments.length === 0 ? (
          <Card data-testid="documents-search-empty" className="p-12 text-center"><Search className="mx-auto text-[var(--color-muted)]" /><h4 className="mt-4 font-extrabold">Không tìm thấy tài liệu</h4><p className="mt-1 text-sm text-[var(--color-muted)]">Thử một tên khác hoặc xóa nội dung tìm kiếm.</p></Card>
        ) : (
          <div data-testid="document-list" className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            {filteredDocuments.map((doc) => (
              <Card key={doc.id} data-testid={`document-card-${doc.id}`} variant="interactive" className="flex min-h-[220px] flex-col rounded-lg p-5" onClick={() => navigate(`/learning?docId=${doc.id}`)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-accent"><FileText size={18} /> PDF</div>
                  <div className="flex items-center gap-2">
                    {doc.status === 'ready' ? <Badge data-testid={`document-status-${doc.id}`} variant="success" size="sm"><CheckCircle2 size={12} /> Sẵn sàng</Badge> : doc.status === 'processing' || doc.status === 'uploading' ? <Badge data-testid={`document-status-${doc.id}`} variant="warning" size="sm"><Clock3 size={12} className="animate-pulse" /> Đang chuẩn bị</Badge> : <Badge data-testid={`document-status-${doc.id}`} variant="error" size="sm"><AlertCircle size={12} /> Cần thử lại</Badge>}
                    <button data-testid={`delete-button-${doc.id}`} onClick={(e) => { e.stopPropagation(); void handleDelete(doc.id); }} className="grid h-11 w-11 place-items-center rounded-lg text-muted hover:bg-error-soft hover:text-error" title="Xóa tài liệu" aria-label={`Xóa ${doc.title}`}><Trash2 size={15} /></button>
                  </div>
                </div>
                <div className="mt-5 flex-1"><h4 className="line-clamp-2 text-[15px] font-extrabold leading-snug text-[var(--color-ink-2)] transition group-hover:text-[var(--color-accent)]">{doc.title}</h4><p className="mt-1.5 truncate text-xs text-[var(--color-muted)]">{doc.originalName}</p><p className="mt-3 text-[11px] font-semibold text-[var(--color-muted)]">{doc.chunkCount || 0} phần nội dung đã nhận diện</p></div>
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[var(--color-rule)] pt-4" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/learning?docId=${doc.id}`)} title="Mở tài liệu" leftIcon={<BookOpenText size={14} />}>Bắt đầu học</Button>
                  <Button variant="ghost" size="sm" className="text-[var(--color-signal)] hover:bg-[var(--color-signal-soft)] hover:text-[var(--color-signal)]" onClick={() => navigate(`/exam-center?docId=${doc.id}`)} title="Tạo bài luyện" leftIcon={<ClipboardCheck size={14} />}>Luyện tập</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Modal isOpen={isUploadModalOpen} onClose={closeUploadModal} title="Thêm tài liệu mới" size="md">
        <form data-testid="upload-form" onSubmit={handleUploadSubmit} className="space-y-5">
          <p className="text-sm leading-relaxed text-[var(--color-muted)]">Chọn một file PDF. Sau khi tải lên, bạn có thể đọc, đặt câu hỏi, tóm tắt và tạo bài luyện từ tài liệu này.</p>
          <Input data-testid="document-title-input" label="Tên tài liệu" placeholder="Ví dụ: Kinh tế vi mô - Chương 1" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} helperText="Dùng một tên ngắn để dễ tìm lại sau này." required />
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--color-ink-2)]">File PDF</label>
            <div data-testid="file-drop-zone" onClick={() => fileInputRef.current?.click()} className={clsx('flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-6 text-center transition', selectedFile ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]' : 'border-[var(--color-rule-strong)] bg-[var(--color-paper-2)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]')}>
              <input ref={fileInputRef} data-testid="file-input" type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]"><UploadCloud size={23} /></div>
              {selectedFile ? <><p className="mt-4 max-w-full truncate font-bold text-[var(--color-accent)]">{selectedFile.name}</p><p className="mt-1 text-xs text-[var(--color-muted)]">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Sẵn sàng tải lên</p></> : <><p className="mt-4 font-bold text-[var(--color-ink-2)]">Nhấn để chọn file từ máy tính</p><p className="mt-1 text-xs text-[var(--color-muted)]">Định dạng PDF, dung lượng tối đa 50 MB</p></>}
            </div>
          </div>
          <div className="rounded-2xl bg-[var(--color-accent-soft)] p-4 text-xs leading-5 text-[var(--color-muted)]"><span className="font-bold text-[var(--color-accent)]">Sau khi tải lên:</span> SmartStudy cần một chút thời gian để đọc và chuẩn bị nội dung. Bạn có thể rời trang trong lúc chờ.</div>
          {uploadError && <div data-testid="upload-error" className="rounded-xl bg-[var(--color-error-soft)] p-3 text-xs font-semibold text-[var(--color-error)]">{uploadError}</div>}
          <div className="flex justify-end gap-3 pt-1"><Button data-testid="upload-cancel-button" type="button" variant="ghost" onClick={closeUploadModal} disabled={isUploading}>Để sau</Button><Button data-testid="upload-submit-button" type="submit" disabled={!selectedFile} isLoading={isUploading} leftIcon={<UploadCloud size={16} />}>{isUploading ? 'Đang tải lên' : 'Thêm vào thư viện'}</Button></div>
        </form>
      </Modal>
    </div>
  );
};
