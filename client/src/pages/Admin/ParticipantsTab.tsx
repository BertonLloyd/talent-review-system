import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Upload,
  Search,
  Users,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { getErrorMsg } from '@client/src/utils/request';
import * as XLSX from 'xlsx';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

import { review } from '@/api';
import {
  ReviewParticipantRecord,
  ReviewBatchRecord,
  CreateParticipantRequest,
  UpdateParticipantRequest,
  BatchImportParticipantsRequest,
  RuleSetRecord,
} from '@shared/api.interface';
import { showConfirm } from '@lark-apaas/client-toolkit';

interface ParticipantsTabProps {
  batches: ReviewBatchRecord[] | null;
  participants: ReviewParticipantRecord[] | null;
  loading: boolean;
  error: unknown;
  selectedBatchId: string;
  ruleSets: RuleSetRecord[] | null;
  onBatchChange: (id: string) => void;
  onRefresh: () => void;
}

interface ParticipantFormData {
  reviewerKey: string;
  reviewerName: string;
  revieweeName: string;
  employeeNo: string;
  department: string;
  positionType: string;
}

const TEMPLATE_COLUMNS = [
  '姓名',
  '工号',
  '部门',
  '岗位类型',
  '角色',
  '评价人姓名',
] as const;

type TemplateRow = Record<(typeof TEMPLATE_COLUMNS)[number], string>;

interface ParsedImportRow {
  lineNumber: number;
  raw: TemplateRow;
  name: string;
  employeeId: string;
  department: string;
  positionType: string;
  role: string;
  reviewerName: string;
  error?: string;
  reviewerKey?: string;
}

interface ImportResult {
  success: number;
  failed: number;
}

const emptyForm: ParticipantFormData = {
  reviewerKey: '',
  reviewerName: '',
  revieweeName: '',
  employeeNo: '',
  department: '',
  positionType: '',
};

export default function ParticipantsTab({
  batches,
  participants,
  loading,
  error,
  selectedBatchId,
  ruleSets,
  onBatchChange,
  onRefresh,
}: ParticipantsTabProps) {
  const [reviewerFilter, setReviewerFilter] = useState<string>('all');
  const [searchName, setSearchName] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ReviewParticipantRecord | null>(null);
  const [form, setForm] = useState<ParticipantFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [parsed, setParsed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const positionOptions = useMemo(() => {
    const batch = batches?.find((b) => b.id === selectedBatchId);
    if (!batch || !ruleSets) return [];
    const rs = ruleSets.find((r) => r.id === batch.ruleSetId);
    return rs?.config?.positionTypes?.map((pt) => ({ value: pt.code, label: pt.name })) ?? [];
  }, [batches, selectedBatchId, ruleSets]);

  const positionLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const opt of positionOptions) {
      map[opt.value] = opt.label;
    }
    return map;
  }, [positionOptions]);

  // 单批次自动选中
  useEffect(() => {
    if (batches && batches.length === 1 && !selectedBatchId) {
      onBatchChange(batches[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches]);

  const reviewerOptions = useMemo(() => {
    if (!participants) return [] as { key: string; name: string }[];
    const map = new Map<string, string>();
    for (const p of participants) {
      if (!map.has(p.reviewerKey)) {
        map.set(p.reviewerKey, p.reviewerName);
      }
    }
    return Array.from(map.entries()).map(([key, name]) => ({ key, name }));
  }, [participants]);

  const handleDownloadTemplate = async (): Promise<void> => {
    try {
      const blob = await review.downloadParticipantTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '人员名单模板.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('模板下载成功');
    } catch (err) {
      logger.error('下载模板失败', err);
      toast.error(getErrorMsg(err));
    }
  };

  const handleOpenImport = (): void => {
    if (!selectedBatchId) {
      toast.info('请先选择批次');
      return;
    }
    setFileName('');
    setParsedRows([]);
    setParsed(false);
    setImportResult(null);
    setMissingColumns([]);
    setImportDialogOpen(true);
  };

  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const rowsFromFile = useCallback(
    (file: File): Promise<TemplateRow[]> => {
      return new Promise((resolve, reject) => {
        const isCsv = file.name.toLowerCase().endsWith('.csv');
        const reader = new FileReader();

        reader.onload = (): void => {
          try {
            let rows: TemplateRow[] = [];

            if (isCsv) {
              const arrayBuffer = reader.result as ArrayBuffer;
              const uint8 = new Uint8Array(arrayBuffer);

              const decodeCsv = (text: string): TemplateRow[] => {
                // 去除 BOM
                let cleanText = text;
                if (cleanText.charCodeAt(0) === 0xfeff) {
                  cleanText = cleanText.slice(1);
                }
                const lines = cleanText.split(/\r?\n/);
                const dataLines = lines.filter(
                  (l) => l.trim() !== '' && !l.trim().startsWith('#'),
                );
                if (dataLines.length === 0) return [];

                const headers = parseCsvLine(dataLines[0]).map((h) => h.trim());
                const headerMap = new Map<string, number>();
                headers.forEach((h, idx) => {
                  headerMap.set(h, idx);
                });

                const result: TemplateRow[] = [];
                for (let i = 1; i < dataLines.length; i++) {
                  const cols = parseCsvLine(dataLines[i]);
                  const row: TemplateRow = {
                    姓名: '',
                    工号: '',
                    部门: '',
                    岗位类型: '',
                    角色: '',
                    评价人姓名: '',
                  };
                  for (const col of TEMPLATE_COLUMNS) {
                    const idx = headerMap.get(col);
                    if (idx !== undefined && cols[idx] !== undefined) {
                      row[col] = cols[idx];
                    }
                  }
                  result.push(row);
                }
                return result;
              };

              const hasRequiredColumns = (rowList: TemplateRow[]): boolean => {
                if (rowList.length === 0) return false;
                const first = rowList[0];
                return TEMPLATE_COLUMNS.every(
                  (col) => col in first && first[col] !== undefined,
                );
              };

              // 先尝试 UTF-8
              const utf8Decoder = new TextDecoder('utf-8', { fatal: false });
              const utf8Text = utf8Decoder.decode(uint8);
              rows = decodeCsv(utf8Text);

              // 如果 UTF-8 解析后缺少必要列，尝试 GBK
              if (!hasRequiredColumns(rows)) {
                try {
                  const gbkDecoder = new TextDecoder('gbk', { fatal: false });
                  const gbkText = gbkDecoder.decode(uint8);
                  const gbkRows = decodeCsv(gbkText);
                  if (hasRequiredColumns(gbkRows)) {
                    rows = gbkRows;
                  }
                } catch {
                  // GBK 不受支持时保留 UTF-8 结果
                }
              }
            } else {
              const data = new Uint8Array(reader.result as ArrayBuffer);
              const workbook = XLSX.read(data, { type: 'array' });
              const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
              const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
                header: 1,
                defval: '',
              }) as string[][];

              const dataLines = jsonData.filter(
                (row) =>
                  row.length > 0 &&
                  row[0] !== undefined &&
                  String(row[0]).trim() !== '' &&
                  !String(row[0]).trim().startsWith('#'),
              );
              if (dataLines.length === 0) {
                resolve([]);
                return;
              }

              const headers = dataLines[0].map((h) => String(h).trim());
              const headerMap = new Map<string, number>();
              headers.forEach((h, idx) => {
                headerMap.set(h, idx);
              });

              rows = [];
              for (let i = 1; i < dataLines.length; i++) {
                const cols = dataLines[i];
                const row: TemplateRow = {
                  姓名: '',
                  工号: '',
                  部门: '',
                  岗位类型: '',
                  角色: '',
                  评价人姓名: '',
                };
                for (const col of TEMPLATE_COLUMNS) {
                  const idx = headerMap.get(col);
                  if (idx !== undefined && cols[idx] !== undefined) {
                    row[col] = String(cols[idx]).trim();
                  }
                }
                rows.push(row);
              }
            }

            resolve(rows);
          } catch (err) {
            reject(err);
          }
        };

        reader.onerror = (): void => {
          reject(new Error('文件读取失败'));
        };

        if (isCsv) {
          reader.readAsArrayBuffer(file);
        } else {
          reader.readAsArrayBuffer(file);
        }
      });
    },
    [],
  );

  const validateAndMapRows = useCallback(
    (rows: TemplateRow[]): ParsedImportRow[] => {
      const result: ParsedImportRow[] = [];
      const reviewerKeys = new Map<string, string>();

      for (const p of reviewerOptions) {
        reviewerKeys.set(p.name, p.key);
      }

      const fileReviewerNames = new Set<string>();
      for (const row of rows) {
        const role = row['角色']?.trim();
        const name = row['姓名']?.trim();
        if (role === '评价人' && name) {
          fileReviewerNames.add(name);
        }
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const lineNumber = i + 2;
        const name = row['姓名']?.trim() ?? '';
        const employeeId = row['工号']?.trim() ?? '';
        const department = row['部门']?.trim() ?? '';
        const positionType = row['岗位类型']?.trim() ?? '';
        const role = row['角色']?.trim() ?? '';
        const reviewerName = row['评价人姓名']?.trim() ?? '';

        const parsed: ParsedImportRow = {
          lineNumber,
          raw: row,
          name,
          employeeId,
          department,
          positionType,
          role,
          reviewerName,
        };

        if (!name) {
          parsed.error = '姓名不能为空';
          result.push(parsed);
          continue;
        }
        if (!department) {
          parsed.error = '部门不能为空';
          result.push(parsed);
          continue;
        }
        if (role !== '评价人' && role !== '被盘人') {
          parsed.error = '角色只能填「评价人」或「被盘人」';
          result.push(parsed);
          continue;
        }
        if (role === '被盘人') {
          if (!reviewerName) {
            parsed.error = '被盘人必须填写评价人姓名';
            result.push(parsed);
            continue;
          }
          const key = reviewerKeys.get(reviewerName);
          if (key) {
            parsed.reviewerKey = key;
          } else if (!fileReviewerNames.has(reviewerName)) {
            parsed.error = `评价人「${reviewerName}」未在名单中找到`;
            result.push(parsed);
            continue;
          } else {
            parsed.reviewerKey = reviewerName;
          }
        }

        result.push(parsed);
      }

      return result;
    },
    [reviewerOptions],
  );

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('文件大小不能超过 5MB');
      e.target.value = '';
      return;
    }

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.xlsx')) {
      toast.error('仅支持 .csv 或 .xlsx 格式文件');
      e.target.value = '';
      return;
    }

    setFileName(file.name);
    setParsed(false);
    setImportResult(null);
    setMissingColumns([]);

    try {
      const rows = await rowsFromFile(file);

      if (rows.length === 0) {
        toast.error('文件为空或格式不正确');
        return;
      }

      const firstRow = rows[0];
      const missing: string[] = [];
      for (const col of TEMPLATE_COLUMNS) {
        if (!(col in firstRow) || firstRow[col] === undefined) {
          missing.push(col);
        }
      }

      if (missing.length > 0) {
        setMissingColumns(missing);
        setParsedRows([]);
        setParsed(true);
        return;
      }

      const validated = validateAndMapRows(rows);
      setParsedRows(validated);
      setParsed(true);
    } catch (err) {
      logger.error('解析文件失败', err);
      toast.error('文件解析失败，请检查文件格式');
    } finally {
      e.target.value = '';
    }
  };

  const validRows = useMemo(
    () => parsedRows.filter((r) => !r.error),
    [parsedRows],
  );
  const errorRows = useMemo(
    () => parsedRows.filter((r) => r.error),
    [parsedRows],
  );
  const previewRows = useMemo(
    () => parsedRows.slice(0, 20),
    [parsedRows],
  );

  const handleImport = async (): Promise<void> => {
    if (validRows.length === 0) {
      toast.error('没有可导入的有效数据');
      return;
    }

    setImporting(true);
    try {
      const reviewerReviewers = validRows.filter((r) => r.role === '评价人');
      const nameToKey = new Map<string, string>();
      for (const r of reviewerReviewers) {
        const key = r.name.toLowerCase().replace(/\s+/g, '_');
        nameToKey.set(r.name, key);
      }

      for (const opt of reviewerOptions) {
        nameToKey.set(opt.name, opt.key);
      }

      const items: Omit<CreateParticipantRequest, 'batchId'>[] = [];

      for (const row of validRows) {
        if (row.role !== '被盘人') continue;

        let reviewerKey = '';
        let reviewerName = '';

        if (row.reviewerName) {
          reviewerName = row.reviewerName;
          const key = nameToKey.get(row.reviewerName);
          if (key) {
            reviewerKey = key;
          } else {
            reviewerKey = row.reviewerName
              .toLowerCase()
              .replace(/\s+/g, '_');
          }
        }

        if (!reviewerKey || !reviewerName) continue;

        items.push({
          reviewerKey,
          reviewerName,
          revieweeName: row.name,
          employeeNo: row.employeeId || undefined,
          department: row.department || undefined,
          positionType: row.positionType || undefined,
        });
      }

      const payload: BatchImportParticipantsRequest = {
        batchId: selectedBatchId,
        items,
      };
      const result = await review.batchImportParticipants(payload);
      setImportResult(result);
      toast.success(
        `导入完成：成功 ${result.success} 条，跳过 ${result.failed} 条`,
      );
      onRefresh();
    } catch (err) {
      logger.error('批量导入失败', err);
      toast.error(getErrorMsg(err));
    } finally {
      setImporting(false);
    }
  };

  const filtered = useMemo(() => {
    if (!participants) return [];
    const kw = searchName.trim().toLowerCase();
    return participants.filter((p) => {
      if (reviewerFilter !== 'all' && p.reviewerKey !== reviewerFilter)
        return false;
      if (kw) {
        const matchName = p.revieweeName.toLowerCase().includes(kw);
        const matchReviewer = p.reviewerName.toLowerCase().includes(kw);
        const matchEmployeeNo = p.employeeNo
          ? p.employeeNo.toLowerCase().includes(kw)
          : false;
        if (!matchName && !matchReviewer && !matchEmployeeNo) return false;
      }
      return true;
    });
  }, [participants, reviewerFilter, searchName]);

  const handleOpenCreate = (): void => {
    if (!selectedBatchId) {
      toast.info('请先选择批次');
      return;
    }
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (p: ReviewParticipantRecord): void => {
    setEditing(p);
    setForm({
      reviewerKey: p.reviewerKey,
      reviewerName: p.reviewerName,
      revieweeName: p.revieweeName,
      employeeNo: p.employeeNo || '',
      department: p.department || '',
      positionType: p.positionType || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async (): Promise<void> => {
    if (!form.reviewerKey.trim()) {
      toast.error('请输入评价人标识');
      return;
    }
    if (!form.reviewerName.trim()) {
      toast.error('请输入评价人姓名');
      return;
    }
    if (!form.revieweeName.trim()) {
      toast.error('请输入被盘人姓名');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const payload: UpdateParticipantRequest = {
          reviewerKey: form.reviewerKey.trim(),
          reviewerName: form.reviewerName.trim(),
          revieweeName: form.revieweeName.trim(),
          employeeNo: form.employeeNo.trim() || undefined,
          department: form.department.trim() || undefined,
          positionType: form.positionType.trim() || undefined,
        };
        await review.updateParticipant(editing.id, payload);
        toast.success('更新成功');
      } else {
        const payload: CreateParticipantRequest = {
          batchId: selectedBatchId,
          reviewerKey: form.reviewerKey.trim(),
          reviewerName: form.reviewerName.trim(),
          revieweeName: form.revieweeName.trim(),
          employeeNo: form.employeeNo.trim() || undefined,
          department: form.department.trim() || undefined,
          positionType: form.positionType.trim() || undefined,
        };
        await review.createParticipant(payload);
        toast.success('新增成功');
      }
      setDialogOpen(false);
      onRefresh();
    } catch (err) {
      logger.error(editing ? '更新参评人员失败' : '新增参评人员失败', err);
      toast.error(getErrorMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    if (!(await showConfirm('确定删除该参评人员？'))) return;
    try {
      await review.deleteParticipant(id);
      toast.success('删除成功');
      onRefresh();
    } catch (err) {
      logger.error('删除参评人员失败', err);
      toast.error(getErrorMsg(err));
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0_0_0_0.08)] border-0">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] text-[#64748b]">批次</label>
              <Select value={selectedBatchId} onValueChange={onBatchChange}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="选择批次" />
                </SelectTrigger>
                <SelectContent>
                  {batches && batches.length > 0 ? (
                    batches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-[12px] text-[#94a3b8] text-center">
                      暂无批次
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] text-[#64748b]">评价人</label>
              <Select
                value={reviewerFilter}
                onValueChange={setReviewerFilter}
                disabled={!selectedBatchId}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="选择评价人" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部评价人</SelectItem>
                  {reviewerOptions.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] text-[#64748b]">搜索姓名/工号</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                <Input
                  placeholder="评价人/被盘人/工号"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="w-[220px] pl-9"
                />
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => void handleDownloadTemplate()}
              >
                <Download className="w-4 h-4 mr-1" />
                下载名单模板
              </Button>
              <Button
                variant="outline"
                onClick={handleOpenImport}
              >
                <Upload className="w-4 h-4 mr-1" />
                批量导入
              </Button>
              <Button
                onClick={handleOpenCreate}
                className="bg-[#1e6feb] hover:bg-[#1a5fd4] text-white"
              >
                <Plus className="w-4 h-4 mr-1" />
                新增参评人
              </Button>
            </div>
          </div>
          <div className="mt-3 text-[12px] text-[#94a3b8]">
            <Users className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
            支持下载标准模板后批量导入，支持 .xlsx 和 .csv 格式
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0_0_0_0.08)] border-0">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <h2 className="text-[16px] font-semibold text-[#0f172a]">
            参评名单
            {filtered.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 bg-[#eff6ff] text-[#1e6feb] hover:bg-[#eff6ff]"
              >
                共 {filtered.length} 人
              </Badge>
            )}
          </h2>
        </CardHeader>
        <CardContent>
          {loading ? (
            <ParticipantSkeleton />
          ) : error ? (
            <div className="text-center py-12 text-[#64748b] text-sm">
              加载失败，请稍后重试
            </div>
          ) : !selectedBatchId ? (
            <div className="text-center py-12">
              <div className="text-[14px] text-[#0f172a] font-medium mb-1">
                请先选择批次
              </div>
              <div className="text-[12px] text-[#64748b]">
                从上方下拉框中选择一个批次，即可查看对应参评名单
              </div>
            </div>
          ) : !participants || participants.length === 0 ? (
            <div className="text-center py-12 text-[#64748b] text-sm">
              该批次暂无参评人员
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-[#64748b] text-sm">
              未找到匹配的参评人员
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[12px] text-[#64748b] font-normal">
                    评价人
                  </TableHead>
                  <TableHead className="text-[12px] text-[#64748b] font-normal">
                    被盘人
                  </TableHead>
                  <TableHead className="text-[12px] text-[#64748b] font-normal">
                    工号
                  </TableHead>
                  <TableHead className="text-[12px] text-[#64748b] font-normal">
                    部门
                  </TableHead>
                  <TableHead className="text-[12px] text-[#64748b] font-normal">
                    岗位类型
                  </TableHead>
                  <TableHead className="text-[12px] text-[#64748b] font-normal text-right">
                    操作
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-[#0f172a]">
                      {p.reviewerName}
                    </TableCell>
                    <TableCell>{p.revieweeName}</TableCell>
                    <TableCell>{p.employeeNo || '-'}</TableCell>
                    <TableCell>{p.department || '-'}</TableCell>
                    <TableCell>
                      {p.positionType
                        ? positionLabelMap[p.positionType] ?? p.positionType
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenEdit(p)}
                          aria-label="编辑"
                          className="h-8 w-8"
                        >
                          <Edit2 className="w-4 h-4 text-[#64748b]" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => void handleDelete(p.id)}
                          aria-label="删除"
                          className="h-8 w-8 text-[#ef4444] hover:bg-[#fef2f2]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>批量导入参评人员</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="text-[13px] text-[#64748b] bg-[#f8fafc] rounded-lg p-3 border border-[#e2e8f0]">
              <p className="font-medium text-[#0f172a] mb-1">导入说明</p>
              <ul className="space-y-0.5 list-disc list-inside">
                <li>支持 .csv 和 .xlsx 格式，文件大小不超过 5MB</li>
                <li>
                  角色只能填「评价人」或「被盘人」；被盘人必须填写评价人姓名
                </li>
                <li>
                  评价人必须先在名单中（已有账号或本次导入新增的评价人行）
                </li>
              </ul>
              <div className="mt-2 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleDownloadTemplate()}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                  下载名单模板
                </Button>
                <span className="text-[12px] text-[#94a3b8]">
                  CSV 格式，可用 Excel 直接打开编辑
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>选择文件</Label>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(e) => void handleFileSelect(e)}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-1" />
                  选择文件
                </Button>
                {fileName && (
                  <span
                    className="text-[13px] text-[#0f172a] truncate max-w-[300px]"
                    title={fileName}
                  >
                    {fileName}
                  </span>
                )}
              </div>
            </div>

            {parsed && missingColumns.length > 0 && (
              <div className="bg-[#fef2f2] border border-[#fecaca] rounded-lg p-3">
                <div className="text-[13px] font-medium text-[#991b1b] mb-1 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  模板列缺失
                </div>
                <div className="text-[12px] text-[#b91c1c]">
                  文件缺少以下必要列：{missingColumns.join('、')}
                  <br />
                  请下载最新模板后重新填写上传
                </div>
              </div>
            )}

            {parsed && parsedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] text-[#0f172a] font-medium">
                    解析预览：共 {parsedRows.length} 行
                    {parsedRows.length > 20 && '（仅展示前 20 行）'}
                  </div>
                  <div className="flex items-center gap-3 text-[12px]">
                    <span className="flex items-center gap-1 text-[#10b981]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      可导入 {validRows.length} 行
                    </span>
                    {errorRows.length > 0 && (
                      <span className="flex items-center gap-1 text-[#ef4444]">
                        <XCircle className="w-3.5 h-3.5" />
                        问题 {errorRows.length} 行
                      </span>
                    )}
                  </div>
                </div>

                <div className="border border-[#e2e8f0] rounded-lg overflow-hidden max-h-[340px] overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-[#f8fafc] sticky top-0">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[12px] text-[#64748b] font-normal w-12">
                          行号
                        </TableHead>
                        <TableHead className="text-[12px] text-[#64748b] font-normal">
                          姓名
                        </TableHead>
                        <TableHead className="text-[12px] text-[#64748b] font-normal">
                          部门
                        </TableHead>
                        <TableHead className="text-[12px] text-[#64748b] font-normal">
                          岗位类型
                        </TableHead>
                        <TableHead className="text-[12px] text-[#64748b] font-normal">
                          角色
                        </TableHead>
                        <TableHead className="text-[12px] text-[#64748b] font-normal">
                          评价人姓名
                        </TableHead>
                        <TableHead className="text-[12px] text-[#64748b] font-normal">
                          状态
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, idx) => (
                        <TableRow
                          key={idx}
                          className={row.error ? 'bg-[#fef2f2]' : ''}
                        >
                          <TableCell className="text-[12px] text-[#94a3b8]">
                            {row.lineNumber}
                          </TableCell>
                          <TableCell
                            className={row.error ? 'text-[#ef4444]' : ''}
                          >
                            {row.name || '-'}
                          </TableCell>
                          <TableCell>{row.department || '-'}</TableCell>
                          <TableCell>{row.positionType || '-'}</TableCell>
                          <TableCell>{row.role || '-'}</TableCell>
                          <TableCell>{row.reviewerName || '-'}</TableCell>
                          <TableCell>
                            {row.error ? (
                              <span
                                className="flex items-center gap-1 text-[11px] text-[#ef4444]"
                                title={row.error}
                              >
                                <AlertCircle className="w-3 h-3" />
                                {row.error.length > 14
                                  ? row.error.slice(0, 14) + '...'
                                  : row.error}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[11px] text-[#10b981]">
                                <CheckCircle2 className="w-3 h-3" />
                                有效
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {importResult && (
                  <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg p-3">
                    <div className="text-[13px] font-medium text-[#166534] mb-1">
                      导入完成
                    </div>
                    <div className="text-[12px] text-[#15803d] space-y-0.5">
                      <p>成功导入：{importResult.success} 条</p>
                      <p>重复跳过：{importResult.failed} 条</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setImportDialogOpen(false)}
              disabled={importing}
            >
              {importResult ? '关闭' : '取消'}
            </Button>
            <Button
              onClick={() => void handleImport()}
              disabled={
                !parsed || validRows.length === 0 || importing || missingColumns.length > 0
              }
              className="bg-[#1e6feb] hover:bg-[#1a5fd4] text-white"
            >
              {importing
                ? '导入中...'
                : `确认导入（${validRows.length} 行）`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? '编辑参评人员' : '新增参评人员'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>评价人标识</Label>
                <Input
                  placeholder="如: xiao_lin_tao"
                  value={form.reviewerKey}
                  onChange={(e) =>
                    setForm({ ...form, reviewerKey: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>评价人姓名</Label>
                <Input
                  placeholder="如: 张三"
                  value={form.reviewerName}
                  onChange={(e) =>
                    setForm({ ...form, reviewerName: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>被盘人姓名</Label>
                <Input
                  placeholder="请输入被盘人姓名"
                  value={form.revieweeName}
                  onChange={(e) =>
                    setForm({ ...form, revieweeName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>工号</Label>
                <Input
                  placeholder="请输入工号（选填）"
                  value={form.employeeNo}
                  onChange={(e) =>
                    setForm({ ...form, employeeNo: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>部门</Label>
                <Input
                  placeholder="如: 财务管理部"
                  value={form.department}
                  onChange={(e) =>
                    setForm({ ...form, department: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>岗位类型</Label>
                <Select
                  value={form.positionType || ''}
                  onValueChange={(val) =>
                    setForm({ ...form, positionType: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择岗位类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {positionOptions.length > 0 ? (
                      positionOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="" disabled>
                        请先选择批次
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              取消
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={saving}
              className="bg-[#1e6feb] hover:bg-[#1a5fd4] text-white"
            >
              {editing ? '保存' : '新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ParticipantSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-3 border border-[#e2e8f0] rounded-lg"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <div className="flex-1" />
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-6 w-6 rounded-md" />
        </div>
      ))}
    </div>
  );
}
