import React, { useState, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { documentAPI } from '../../services/api';
import { Database, X, Upload, FileText, CheckCircle2, ShieldCheck, RefreshCw, Layers } from 'lucide-react';

export const KnowledgeBaseManager = () => {
  const { activeModal, setActiveModal } = useChat();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterJur, setFilterJur] = useState('all');
  const [uploadOpen, setUploadOpen] = useState(false);

  // Upload state
  const [title, setTitle] = useState('');
  const [authority, setAuthority] = useState('');
  const [documentType, setDocumentType] = useState('statute');
  const [jurisdiction, setJurisdiction] = useState('india');
  const [category, setCategory] = useState('patents');
  const [versionTag, setVersionTag] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');

  useEffect(() => {
    if (activeModal === 'admin') {
      fetchDocuments();
    }
  }, [activeModal, filterJur]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterJur !== 'all') params.jurisdiction = filterJur;
      const res = await documentAPI.listDocuments(params);
      if (res.data?.documents) {
        setDocuments(res.data.documents);
      }
    } catch (err) {
      console.error('[Document List Error]', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setUploadStatus('Uploading & scheduling background ingestion...');
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('authority', authority);
      formData.append('document_type', documentType);
      formData.append('jurisdiction', jurisdiction);
      formData.append('category', category);
      formData.append('version_tag', versionTag || 'v1.0');
      if (selectedFile) formData.append('file', selectedFile);

      await documentAPI.uploadDocument(formData);
      setUploadStatus('Document uploaded! Background vectorization job queued.');
      setTimeout(() => {
        setUploadOpen(false);
        setUploadStatus('');
        fetchDocuments();
      }, 1500);
    } catch (err) {
      setUploadStatus(`Upload failed: ${err.response?.data?.error || err.message}`);
    }
  };

  if (activeModal !== 'admin') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-4xl rounded-2xl bg-white dark:bg-darkbg-card border border-slate-200 dark:border-darkbg-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-darkbg-border flex items-center justify-between bg-slate-50/50 dark:bg-darkbg-950/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Authoritative Knowledge Corpus Vault
              </h3>
              <p className="text-[11px] text-slate-500">
                SIH26045 Master Registry of Statutes, Rules, Treaties & Pharmacopoeia
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setUploadOpen(!uploadOpen)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload PDF Source</span>
            </button>
            <button
              onClick={() => setActiveModal(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Upload Drawer Form */}
          {uploadOpen && (
            <form onSubmit={handleUpload} className="p-4 rounded-xl bg-slate-50 dark:bg-darkbg-950 border border-emerald-500/30 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-darkbg-border">
                <span className="font-bold text-slate-900 dark:text-white">Ingest New Authoritative PDF Document</span>
                {uploadStatus && <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">{uploadStatus}</span>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Document Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Patents Rules 2024 Amendments"
                    className="w-full bg-white dark:bg-darkbg-card border border-slate-200 dark:border-darkbg-border rounded-lg p-2 text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Issuing Authority</label>
                  <input
                    type="text"
                    required
                    value={authority}
                    onChange={(e) => setAuthority(e.target.value)}
                    placeholder="e.g. Indian Patent Office"
                    className="w-full bg-white dark:bg-darkbg-card border border-slate-200 dark:border-darkbg-border rounded-lg p-2 text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Jurisdiction</label>
                  <select
                    value={jurisdiction}
                    onChange={(e) => setJurisdiction(e.target.value)}
                    className="w-full bg-white dark:bg-darkbg-card border border-slate-200 dark:border-darkbg-border rounded-lg p-2 text-xs text-slate-800 dark:text-slate-200"
                  >
                    <option value="india">India</option>
                    <option value="international">International</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-white dark:bg-darkbg-card border border-slate-200 dark:border-darkbg-border rounded-lg p-2 text-xs text-slate-800 dark:text-slate-200"
                  >
                    <option value="patents">Patents</option>
                    <option value="trademarks">Trademarks</option>
                    <option value="biodiversity">Biodiversity & ABS</option>
                    <option value="ayush">AYUSH / Drugs & Cosmetics</option>
                    <option value="fssai">FSSAI / Ayurveda-Aahara</option>
                    <option value="treaties">International Treaties</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Version Tag</label>
                  <input
                    type="text"
                    value={versionTag}
                    onChange={(e) => setVersionTag(e.target.value)}
                    placeholder="e.g. 2024-Consolidated"
                    className="w-full bg-white dark:bg-darkbg-card border border-slate-200 dark:border-darkbg-border rounded-lg p-2 text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Upload PDF File</label>
                  <input
                    type="file"
                    accept=".pdf,.txt"
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 dark:file:bg-emerald-950/40 dark:file:text-emerald-300"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md"
              >
                Start Background Ingestion Pipeline
              </button>
            </form>
          )}

          {/* Filter Bar */}
          <div className="flex items-center space-x-2 pb-2">
            <span className="text-slate-400 font-bold text-[10px] uppercase">Filter Jurisdiction:</span>
            {['all', 'india', 'international'].map((j) => (
              <button
                key={j}
                onClick={() => setFilterJur(j)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition-colors ${
                  filterJur === j
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-darkbg-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {j}
              </button>
            ))}
          </div>

          {/* Documents Table */}
          <div className="rounded-xl border border-slate-200 dark:border-darkbg-border overflow-hidden bg-white dark:bg-darkbg-card">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-darkbg-950 border-b border-slate-200 dark:border-darkbg-border text-slate-500 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Statute / Rule / Treaty</th>
                  <th className="p-3">Authority</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Jurisdiction</th>
                  <th className="p-3">Version</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-darkbg-border">
                {documents.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/50 dark:hover:bg-darkbg-border/30">
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        <span>{d.title}</span>
                      </div>
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">{d.authority}</td>
                    <td className="p-3 uppercase text-[10px] font-bold text-slate-500">{d.category}</td>
                    <td className="p-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          d.jurisdiction === 'india'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                        }`}
                      >
                        {d.jurisdiction}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 font-mono text-[11px]">{d.version_tag || 'Current'}</td>
                    <td className="p-3">
                      <span className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Indexed</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
