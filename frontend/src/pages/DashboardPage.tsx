import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, BookOpenText, CheckCircle2, ClipboardCheck, Clock3, FileText, Library, Plus, Search, Sparkles, Trash2, UploadCloud } from 'lucide-react';
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
    <div className="page-enter mx-auto max-w-7xl space-y-7">
      <section className="relative overflow-hidden rounded-[32px] bg-[#18312A] px-6 py-7 text-white shadow-[0_20px_50px_rgba(24,49,42,0.16)] sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border-[40px] border-white/5" />
        <div className="relative grid items-end gap-7 lg:grid-cols-[1fr_auto]">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-[#B9E0D0]"><Sparkles size={13} /> Không gian học của bạn</div>
            <h2 className="text-balance text-3xl font-black tracking-[-0.035em] sm:text-4xl">Hôm nay bạn muốn học gì?</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">Chọn một tài liệu để tiếp tục, hoặc thêm nội dung mới và bắt đầu một buổi học ngay.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button data-testid="upload-button-banner" variant="secondary" size="lg" onClick={() => setIsUploadModalOpen(true)} leftIcon={<Plus size={18} />}>Thêm tài liệu</Button>
            <Button variant="outline" size="lg" className="border-white/15 bg-white/10 text-white hover:bg-white/15" onClick={() => navigate('/learning')} rightIcon={<ArrowRight size={17} />}>Vào phòng học</Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Tài liệu của bạn', value: documents.length, note: documents.length ? 'Sẵn sàng để học bất cứ lúc nào' : 'Hãy thêm tài liệu đầu tiên', icon: Library, tone: 'bg-[#E1EEE8] text-[#2F6B58]' },
          { label: 'Đã sẵn sàng', value: readyDocuments, note: 'Có thể đọc, hỏi và luyện tập', icon: CheckCircle2, tone: 'bg-[#E7F3EA] text-[#267044]' },
          { label: 'Phần nội dung', value: totalSections, note: 'Đã được chuẩn bị để tra cứu', icon: FileText, tone: 'bg-[#FFF0EA] text-[#D95F38]' },
        ].map(({ label, value, note, icon: Icon, tone }) => (
          <Card key={label} className="flex items-center gap-4 p-5 sm:block">
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tone}`}><Icon size={20} /></div>
            <div className="sm:mt-5"><div className="flex items-end gap-2"><strong className="text-3xl font-black tracking-[-0.04em] text-[#17201E]">{value}</strong><span className="pb-1 text-xs font-bold text-[#56635E]">{label}</span></div><p className="mt-1 text-[11px] text-[#7B8782]">{note}</p></div>
          </Card>
        ))}
      </section>

      <section data-testid="document-library" className="space-y-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#2F6B58]">Thư viện</p><h3 className="mt-1 text-2xl font-black tracking-[-0.03em] text-[#17201E]">Tài liệu học tập</h3><p className="mt-1 text-sm text-[#69756F]">Mở tài liệu để đọc, hỏi hoặc tạo bài luyện.</p></div>
          <Button data-testid="upload-button" size="md" leftIcon={<UploadCloud size={16} />} onClick={() => setIsUploadModalOpen(true)}>Tải tài liệu lên</Button>
        </div>

        {documents.length > 0 && (
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A9691]" />
            <input data-testid="document-search-input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Tìm theo tên tài liệu..." className="h-12 w-full rounded-2xl border border-[#DCE2DE] bg-white pl-11 pr-11 text-sm text-[#17201E] shadow-sm outline-none transition focus:border-[#2F6B58] focus:ring-4 focus:ring-[#2F6B58]/10" />
            {searchQuery && <button data-testid="document-search-clear" onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-[#7A8681] hover:bg-[#EDF1EE]" aria-label="Xóa tìm kiếm">×</button>}
          </div>
        )}

        {isLoading ? (
          <Card className="flex min-h-56 items-center justify-center"><LoadingSpinner text="Đang mở thư viện của bạn..." /></Card>
        ) : documents.length === 0 ? (
          <Card data-testid="documents-empty-state" className="soft-grid flex min-h-[360px] flex-col items-center justify-center border-2 border-dashed border-[#CAD5D0] bg-white/70 p-8 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-[#E1EEE8] text-[#2F6B58]"><UploadCloud size={29} /></div>
            <h4 className="mt-6 text-xl font-black tracking-[-0.02em]">Bắt đầu với tài liệu đầu tiên</h4>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#6B7772]">Tải lên giáo trình, bài giảng hoặc tài liệu cần ôn. SmartStudy sẽ chuẩn bị để bạn có thể hỏi, tóm tắt và luyện tập.</p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button data-testid="upload-button-empty" onClick={() => setIsUploadModalOpen(true)} leftIcon={<Plus size={16} />}>Chọn tài liệu</Button>
              <Button id="seed-document-btn" variant="outline" onClick={() => void handleSeedDocument()}>Dùng tài liệu mẫu</Button>
            </div>
          </Card>
        ) : filteredDocuments.length === 0 ? (
          <Card data-testid="documents-search-empty" className="p-12 text-center"><Search className="mx-auto text-[#9AA59F]" /><h4 className="mt-4 font-extrabold">Không tìm thấy tài liệu</h4><p className="mt-1 text-sm text-[#74807B]">Thử một tên khác hoặc xóa nội dung tìm kiếm.</p></Card>
        ) : (
          <div data-testid="document-list" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredDocuments.map((doc) => (
              <Card key={doc.id} data-testid={`document-card-${doc.id}`} variant="interactive" className="flex min-h-[230px] flex-col p-5" onClick={() => navigate(`/learning?docId=${doc.id}`)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#E8F1ED] text-[#2F6B58]"><FileText size={20} /></div>
                  <div className="flex items-center gap-2">
                    {doc.status === 'ready' ? <Badge data-testid={`document-status-${doc.id}`} variant="success" size="sm"><CheckCircle2 size={12} /> Sẵn sàng</Badge> : doc.status === 'processing' || doc.status === 'uploading' ? <Badge data-testid={`document-status-${doc.id}`} variant="warning" size="sm"><Clock3 size={12} className="animate-pulse" /> Đang chuẩn bị</Badge> : <Badge data-testid={`document-status-${doc.id}`} variant="error" size="sm"><AlertCircle size={12} /> Cần thử lại</Badge>}
                    <button data-testid={`delete-button-${doc.id}`} onClick={(e) => { e.stopPropagation(); void handleDelete(doc.id); }} className="rounded-lg p-2 text-[#89958F] hover:bg-[#FEE4E2] hover:text-[#B42318]" title="Xóa tài liệu"><Trash2 size={15} /></button>
                  </div>
                </div>
                <div className="mt-5 flex-1"><h4 className="line-clamp-2 text-[15px] font-extrabold leading-snug text-[#26332F] transition group-hover:text-[#2F6B58]">{doc.title}</h4><p className="mt-1.5 truncate text-xs text-[#87928D]">{doc.originalName}</p><p className="mt-3 text-[11px] font-semibold text-[#6A7771]">{doc.chunkCount || 0} phần nội dung đã nhận diện</p></div>
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#E7EBE8] pt-4" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/learning?docId=${doc.id}`)} title="Mở tài liệu" leftIcon={<BookOpenText size={14} />}>Bắt đầu học</Button>
                  <Button variant="ghost" size="sm" className="text-[#A94B2E] hover:bg-[#FFF0EA] hover:text-[#A94B2E]" onClick={() => navigate(`/exam-center?docId=${doc.id}`)} title="Tạo bài luyện" leftIcon={<ClipboardCheck size={14} />}>Luyện tập</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Modal isOpen={isUploadModalOpen} onClose={closeUploadModal} title="Thêm tài liệu mới" size="md">
        <form data-testid="upload-form" onSubmit={handleUploadSubmit} className="space-y-5">
          <p className="text-sm leading-relaxed text-[#69756F]">Chọn một file PDF. Sau khi tải lên, bạn có thể đọc, đặt câu hỏi, tóm tắt và tạo bài luyện từ tài liệu này.</p>
          <Input data-testid="document-title-input" label="Tên tài liệu" placeholder="Ví dụ: Kinh tế vi mô - Chương 1" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} helperText="Dùng một tên ngắn để dễ tìm lại sau này." required />
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#26332F]">File PDF</label>
            <div data-testid="file-drop-zone" onClick={() => fileInputRef.current?.click()} className={clsx('flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-6 text-center transition', selectedFile ? 'border-[#2F6B58] bg-[#F0F7F3]' : 'border-[#CAD4CF] bg-[#FAFBF9] hover:border-[#2F6B58] hover:bg-[#F3F7F4]')}>
              <input ref={fileInputRef} data-testid="file-input" type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#E1EEE8] text-[#2F6B58]"><UploadCloud size={23} /></div>
              {selectedFile ? <><p className="mt-4 max-w-full truncate font-bold text-[#285D4C]">{selectedFile.name}</p><p className="mt-1 text-xs text-[#69756F]">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Sẵn sàng tải lên</p></> : <><p className="mt-4 font-bold text-[#26332F]">Nhấn để chọn file từ máy tính</p><p className="mt-1 text-xs text-[#7A8681]">Định dạng PDF, dung lượng tối đa 50 MB</p></>}
            </div>
          </div>
          <div className="rounded-2xl bg-[#F0F6F2] p-4 text-xs leading-5 text-[#5E6A66]"><span className="font-bold text-[#285D4C]">Sau khi tải lên:</span> SmartStudy cần một chút thời gian để đọc và chuẩn bị nội dung. Bạn có thể rời trang trong lúc chờ.</div>
          {uploadError && <div data-testid="upload-error" className="rounded-xl bg-[#FEE4E2] p-3 text-xs font-semibold text-[#9B251C]">{uploadError}</div>}
          <div className="flex justify-end gap-3 pt-1"><Button data-testid="upload-cancel-button" type="button" variant="ghost" onClick={closeUploadModal} disabled={isUploading}>Để sau</Button><Button data-testid="upload-submit-button" type="submit" disabled={!selectedFile} isLoading={isUploading} leftIcon={<UploadCloud size={16} />}>{isUploading ? 'Đang tải lên' : 'Thêm vào thư viện'}</Button></div>
        </form>
      </Modal>
    </div>
  );
};
