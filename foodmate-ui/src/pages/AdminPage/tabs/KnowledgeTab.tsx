import { FileText, UploadCloud } from 'lucide-react';
import { ChangeEvent, DragEvent, useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import styles from '../AdminPage.module.css';
import { type KnowledgeRow, canManage } from './AdminShared';
import type { AdminActionPayload } from './types';
import {
  changeKnowledgeVisibility,
  loadAdminKnowledge,
  loadKnowledgeBatch,
  retryKnowledgeItem,
  streamKnowledgeBatch,
  updateKnowledgeStatus,
  uploadKnowledgeBatch,
} from '../../../services/adminService';

const figmaKnowledgeRows: KnowledgeRow[] = [
  {
    key: 'doc-118a9',
    documentId: 'doc_118a9',
    title: 'USDA_Keto_Ingredient_Guidelines.pdf',
    status: 'indexed',
    visibility: 'published',
    chunks: 148,
    owner: 'Anddy',
    source: 'knowledge/USDA_Keto_Ingredient_Guidelines.pdf',
    indexProgress: '100%',
    updatedAt: '2026-07-31 10:24',
  },
  {
    key: 'doc-552b1',
    documentId: 'doc_552b1',
    title: 'FoodMate_Custom_Recipes_v3.csv',
    status: 'indexing',
    visibility: 'draft',
    chunks: 890,
    owner: 'Anddy',
    source: 'knowledge/FoodMate_Custom_Recipes_v3.csv',
    indexProgress: '64%',
    updatedAt: '2026-07-31 10:12',
  },
  {
    key: 'doc-990c4',
    documentId: 'doc_990c4',
    title: 'Allergen_Safety_Manual.xlsx',
    status: 'failed',
    visibility: 'draft',
    chunks: 0,
    owner: 'Anddy',
    source: 'knowledge/Allergen_Safety_Manual.xlsx',
    indexProgress: '0%',
    updatedAt: '2026-07-31 09:48',
  },
];

function documentSize(document: KnowledgeRow) {
  if (document.documentId === 'doc_118a9') return '4.2 MB';
  if (document.documentId === 'doc_552b1') return '12.8 MB';
  if (document.documentId === 'doc_990c4') return '890 KB';
  return document.chunks > 500 ? '12.8 MB' : document.chunks ? '4.2 MB' : '890 KB';
}

function documentStatus(document: KnowledgeRow, figmaFixture: boolean) {
  if (figmaFixture) {
    const fixtureLabel = document.status === 'indexed' ? '已索引' : document.status === 'indexing' ? '索引中' : '失败';
    return (
      <span className={`${styles.knowledgeStatus} ${styles[`knowledgeStatus${document.status}`] ?? ''}`}>
        {fixtureLabel}
      </span>
    );
  }
  const visibility = document.visibility;
  const label =
    visibility === 'published'
      ? '已发布'
      : visibility === 'disabled'
        ? '已下线'
        : visibility === 'draft'
          ? '草稿'
          : document.status === 'indexed'
            ? '已索引'
            : document.status === 'indexing'
              ? '索引中'
              : '失败';
  const styleKey =
    visibility === 'published' || visibility === 'disabled' || visibility === 'draft' ? visibility : document.status;
  return <span className={`${styles.knowledgeStatus} ${styles[`knowledgeStatus${styleKey}`] ?? ''}`}>{label}</span>;
}

export function KnowledgeSection({
  onAction,
  figmaFixture = false,
  openUploadRequest = 0,
  refreshNonce = 0,
}: {
  onAction: (payload: AdminActionPayload) => void;
  figmaFixture?: boolean;
  openUploadRequest?: number;
  refreshNonce?: number;
}) {
  const isRealMode = import.meta.env.VITE_AGENT_MODE === 'real';
  const [documents, setDocuments] = useState<KnowledgeRow[]>(isRealMode ? [] : figmaKnowledgeRows);
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeRow | undefined>(documents[0]);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [batchId, setBatchId] = useState<string | undefined>(() =>
    isRealMode ? (window.localStorage.getItem('foodmate:admin:knowledge:last-batch') ?? undefined) : undefined,
  );
  const [sourceName, setSourceName] = useState('管理员导入');
  const [sourceVersion, setSourceVersion] = useState('1');
  const [licenseNotice, setLicenseNotice] = useState('管理员确认具备发布授权');
  const [loading, setLoading] = useState(isRealMode);
  const [loadError, setLoadError] = useState('');
  const [localRefreshNonce, setLocalRefreshNonce] = useState(0);
  const fileInputId = useId();

  useEffect(() => {
    if (openUploadRequest > 0) {
      // 顶部批量上传按钮通过请求号通知子组件打开受控 Dialog。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUploadVisible(true);
    }
  }, [openUploadRequest]);

  useEffect(() => {
    if (!isRealMode) return;
    let active = true;
    // The effect owns the request lifecycle, so loading/error reset belongs to this subscription boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setLoadError('');
    loadAdminKnowledge()
      .then((result) => {
        if (!active) return;
        const rows = result.items as KnowledgeRow[];
        setDocuments(rows);
        setSelectedDoc(rows[0]);
      })
      .catch((cause) => {
        if (!active) return;
        setDocuments([]);
        setSelectedDoc(undefined);
        setLoadError(cause instanceof Error ? cause.message : '知识库数据加载失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isRealMode, localRefreshNonce, refreshNonce]);

  const notify = (message: string, tone: 'warning' | 'success') => {
    window.dispatchEvent(new CustomEvent('foodmate:admin-notice', { detail: { message, tone } }));
  };
  const selectFiles = (files: FileList | File[]) => {
    const selected = Array.from(files);
    // Figma fixture 只替换验收展示和对应的选择提示，真实模式继续遵循后端上传契约。
    const valid = figmaFixture
      ? selected.every((file) => file.size <= 50 * 1024 * 1024 && /\.(pdf|csv|xlsx|txt)$/i.test(file.name))
      : selected.length <= 20 &&
        selected.every((file) => file.size <= 20 * 1024 * 1024 && /\.(pdf|docx|md|txt)$/i.test(file.name));
    if (!valid) {
      return notify(
        figmaFixture
          ? '仅支持 PDF、CSV、XLSX、TXT 文件，单个不超过 50 MB。'
          : '仅支持至多 20 个 PDF、DOCX、Markdown 或 TXT 文件，单个不超过 20 MB。',
        'warning',
      );
    }
    setUploadFiles(selected);
    if (selected.length) setUploadVisible(true);
  };
  const submitUpload = async () => {
    try {
      if (isRealMode) {
        if (!uploadFiles.length || !sourceName.trim() || !sourceVersion.trim() || !licenseNotice.trim()) {
          return notify('请完整填写来源、版本和授权说明。', 'warning');
        }
        const uploaded = await uploadKnowledgeBatch({
          files: uploadFiles,
          sourceType: 'admin_upload',
          sourceName,
          sourceVersion,
          licenseNotice,
          idempotencyKey: crypto.randomUUID(),
        });
        setBatchId(uploaded.batch_id);
        window.localStorage.setItem('foodmate:admin:knowledge:last-batch', uploaded.batch_id);
        setLocalRefreshNonce((current) => current + 1);
      }
      setUploadVisible(false);
      setUploadFiles([]);
      notify('文档上传已提交', 'success');
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : '文档上传失败，请重试。', 'warning');
    }
  };
  const requestVisibilityChange = (visibility: 'published' | 'disabled' | 'draft' | 'deleted', label: string) => {
    if (!selectedDoc) return;
    onAction({
      action: label,
      targetLabel: selectedDoc.documentId,
      targetType: 'knowledge_document',
      targetId: selectedDoc.documentId,
      execute: async () => {
        if (isRealMode) await changeKnowledgeVisibility(selectedDoc.documentId, visibility);
        else await updateKnowledgeStatus(selectedDoc.documentId, visibility === 'disabled' ? 'disabled' : 'indexed');
      },
      onApply: () => {
        setDocuments((current) =>
          visibility === 'deleted'
            ? current.filter((document) => document.documentId !== selectedDoc.documentId)
            : current.map((document) =>
                document.documentId === selectedDoc.documentId
                  ? {
                      ...document,
                      visibility,
                      status:
                        document.status === 'indexed'
                          ? document.status
                          : visibility === 'draft'
                            ? 'parsed'
                            : document.status,
                    }
                  : document,
              ),
        );
        setSelectedDoc((current) =>
          visibility === 'deleted' ? undefined : current ? { ...current, visibility } : current,
        );
        setLocalRefreshNonce((current) => current + 1);
      },
    });
  };
  const selectedVisibility = selectedDoc?.visibility ?? (selectedDoc?.status === 'indexed' ? 'published' : 'draft');

  return (
    <section
      className={`${styles.knowledgeWorkspace} ${figmaFixture ? styles.knowledgeFixtureWorkspace : ''}`}
      aria-label="知识库文档管理"
    >
      <div className={styles.knowledgeMainColumn}>
        <label
          className={styles.knowledgeDropZone}
          htmlFor={fileInputId}
          onDragOver={(event: DragEvent<HTMLLabelElement>) => event.preventDefault()}
          onDrop={(event: DragEvent<HTMLLabelElement>) => {
            event.preventDefault();
            selectFiles(event.dataTransfer.files);
          }}
        >
          <UploadCloud aria-hidden="true" />
          <strong>拖入多个文件，后台异步建索引</strong>
          <span>
            {figmaFixture
              ? 'Max file size: 50MB. Allowed formats: PDF, CSV, XLSX, TXT.'
              : '最多 20 个文件，单个不超过 20 MB。支持 PDF、DOCX、Markdown、TXT。'}
          </span>
          <input
            id={fileInputId}
            aria-label="选择知识库文件"
            type="file"
            multiple
            accept={figmaFixture ? '.pdf,.csv,.xlsx,.txt' : '.pdf,.docx,.md,.txt'}
            onChange={(event: ChangeEvent<HTMLInputElement>) => event.target.files && selectFiles(event.target.files)}
          />
        </label>
        <Card className={styles.knowledgeTableCard}>
          <div className={styles.knowledgeTableHeader}>
            <span>文档 ID</span>
            <span>标题</span>
            <span>大小</span>
            <span>上传 / 索引状态</span>
            <span>分块数</span>
          </div>
          {loading ? (
            <div className={styles.knowledgeTableEmpty}>正在加载知识库文档...</div>
          ) : documents.length ? (
            documents.map((document) => (
              <Button
                variant="ghost"
                className={`${styles.knowledgeTableRow} ${selectedDoc?.documentId === document.documentId ? styles.knowledgeTableRowSelected : ''}`}
                key={document.documentId}
                type="button"
                onClick={() => setSelectedDoc(document)}
              >
                <code>{document.documentId}</code>
                <span className={styles.knowledgeDocumentTitle}>
                  <FileText aria-hidden="true" />
                  <strong>{document.title}</strong>
                </span>
                <span>{isRealMode ? '-' : documentSize(document)}</span>
                <span>{documentStatus(document, figmaFixture)}</span>
                <span>{document.chunks} chunks</span>
              </Button>
            ))
          ) : loadError ? (
            <div className={styles.knowledgeTableEmpty} role="alert">
              <span>{loadError}</span>
              <Button variant="outline" onClick={() => setLocalRefreshNonce((current) => current + 1)}>
                重试
              </Button>
            </div>
          ) : (
            <div className={styles.knowledgeTableEmpty}>暂无可展示的知识库文档</div>
          )}
        </Card>
      </div>
      <Card className={styles.knowledgeInsights}>
        <strong className={styles.knowledgeInsightsTitle}>文档向量洞察</strong>
        <div className={styles.knowledgeVectorStats}>
          <strong>索引向量统计</strong>
          <span>{isRealMode ? 'Dimensions: 由当前 RAG 模式决定' : 'Dimensions: 1536 (text-embedding-ada-002)'}</span>
          <span>Total Chunks indexed: {selectedDoc?.chunks ?? 0}</span>
        </div>
        <strong className={styles.knowledgeChunksTitle}>分块预览</strong>
        {isRealMode ? (
          <p className={styles.knowledgeChunkEmpty}>当前管理查询不返回原文分块，避免在后台展示未经授权的知识正文。</p>
        ) : (
          <div className={styles.knowledgeChunkList}>
            <ChunkPreview id="chunk_01" score="0.912" text="牛油果富含单不饱和脂肪，对维持治疗性酮症非常有效..." />
            <ChunkPreview id="chunk_02" score="0.884" text="避免食用酸面包，除非标明为低碳水高纤维小麦淀粉替代品..." />
          </div>
        )}
        {selectedDoc && !figmaFixture ? (
          <div className={styles.knowledgeManageActions}>
            {selectedVisibility === 'published' ? (
              <Button
                className={styles.knowledgeManageButton}
                disabled={!canManage}
                variant="outline"
                onClick={() => requestVisibilityChange('disabled', '下线文档')}
              >
                下线文档
              </Button>
            ) : (
              <>
                <Button
                  className={styles.knowledgeManageButton}
                  disabled={!canManage || selectedDoc.status !== 'indexed'}
                  variant="outline"
                  onClick={() => requestVisibilityChange('published', '发布文档')}
                >
                  发布文档
                </Button>
                <Button
                  className={styles.knowledgeManageButton}
                  disabled={!canManage}
                  variant="outline"
                  onClick={() => requestVisibilityChange('draft', '恢复草稿')}
                >
                  恢复草稿
                </Button>
              </>
            )}
            <Button
              className={styles.knowledgeManageButton}
              disabled={!canManage}
              variant="destructive"
              onClick={() => requestVisibilityChange('deleted', '删除文档')}
            >
              删除文档
            </Button>
          </div>
        ) : null}
      </Card>
      <Dialog open={uploadVisible} onOpenChange={setUploadVisible}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>上传知识库文档</DialogTitle>
            <DialogDescription>上传后将在后台完成解析和向量索引。</DialogDescription>
          </DialogHeader>
          <div className={styles.uploadMock}>
            <strong>{uploadFiles.length ? `已选择 ${uploadFiles.length} 个文件` : '选择文件'}</strong>
            <Textarea
              aria-label="来源名称"
              value={sourceName}
              onChange={(event) => setSourceName(event.target.value)}
              placeholder="来源名称"
            />
            <Textarea
              aria-label="来源版本"
              value={sourceVersion}
              onChange={(event) => setSourceVersion(event.target.value)}
              placeholder="来源版本"
            />
            <Textarea
              aria-label="授权说明"
              value={licenseNotice}
              onChange={(event) => setLicenseNotice(event.target.value)}
              placeholder="授权说明"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadVisible(false)}>
              取消
            </Button>
            <Button onClick={() => void submitUpload()}>提交上传</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {isRealMode && batchId ? (
        <BatchProgress batchId={batchId} onRetry={(itemId) => retryKnowledgeItem(batchId, itemId)} />
      ) : null}
    </section>
  );
}

function BatchProgress({ batchId, onRetry }: { batchId: string; onRetry: (documentId: string) => Promise<unknown> }) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof loadKnowledgeBatch>>>();
  const [retryingItemId, setRetryingItemId] = useState<string>();
  const [retryError, setRetryError] = useState('');
  const refresh = () =>
    loadKnowledgeBatch(batchId)
      .then(setDetail)
      .catch(() => undefined);
  const retry = async (itemId: string, documentId: string) => {
    setRetryingItemId(itemId);
    setRetryError('');
    try {
      await onRetry(documentId);
      await refresh();
    } catch (cause) {
      setRetryError(cause instanceof Error ? cause.message : '索引重试失败，请稍后重试');
    } finally {
      setRetryingItemId(undefined);
    }
  };
  useEffect(() => {
    let active = true;
    const load = () =>
      loadKnowledgeBatch(batchId)
        .then((value) => active && setDetail(value))
        .catch(() => undefined);
    load();
    const closeStream = streamKnowledgeBatch(batchId, load);
    return () => {
      active = false;
      closeStream();
    };
  }, [batchId]);
  return (
    <Card className={styles.knowledgeInsights} aria-label="批次进度">
      <strong>批次 {batchId}</strong>
      <span>{detail?.batch.job.status ?? '上传已提交'}</span>
      {retryError ? <span role="alert">{retryError}</span> : null}
      {detail?.batch.items.map((item) => (
        <div key={item.item_id}>
          <span>
            {item.filename}: {item.index_status}
            {item.error_code ? ` (${item.error_code})` : ''}
          </span>
          {item.index_status === 'index_failed' ? (
            <Button
              variant="outline"
              disabled={retryingItemId === item.item_id}
              onClick={() => void retry(item.item_id, item.document_id)}
            >
              {retryingItemId === item.item_id ? '重试中...' : '重试'}
            </Button>
          ) : null}
        </div>
      ))}
    </Card>
  );
}

function ChunkPreview({ id, score, text }: { id: string; score: string; text: string }) {
  return (
    <article className={styles.knowledgeChunk}>
      <div>
        <code>{id}</code>
        <span>Score: {score}</span>
      </div>
      <p>{text}</p>
    </article>
  );
}
