import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { getErrorMsg } from '@client/src/utils/request';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

import { review } from '@/api';
import type { DisplaySettingRecord } from '@shared/api.interface';

interface DisplaySettingsBlockProps {
  settings: DisplaySettingRecord[] | null;
  loading: boolean;
  error: unknown;
  onRefresh: () => void;
}

interface EditableSetting {
  id?: string;
  settingKey: string;
  settingValue: string;
  sortOrder: number;
}

export default function DisplaySettingsBlock({
  settings,
  loading,
  error,
  onRefresh,
}: DisplaySettingsBlockProps) {
  const [items, setItems] = useState<EditableSetting[] | null>(
    settings
      ? settings
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((s) => ({
            id: s.id,
            settingKey: s.settingKey,
            settingValue: s.settingValue,
            sortOrder: s.sortOrder,
          }))
      : null,
  );
  const [saving, setSaving] = useState(false);

  // Sync incoming settings when loaded externally
  useEffect(() => {
    if (settings && items === null) {
      setItems(
        settings
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((s) => ({
            id: s.id,
            settingKey: s.settingKey,
            settingValue: s.settingValue,
            sortOrder: s.sortOrder,
          })),
      );
    }
  }, [settings, items]);

  const addItem = (): void => {
    const base = items ?? [];
    setItems([
      ...base,
      {
        settingKey: '',
        settingValue: '',
        sortOrder: base.length + 1,
      },
    ]);
  };

  const updateItem = (index: number, patch: Partial<EditableSetting>): void => {
    if (!items) return;
    const next = items.slice();
    next[index] = { ...next[index], ...patch };
    setItems(next);
  };

  const removeItem = (index: number): void => {
    if (!items) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSave = async (): Promise<void> => {
    if (!items) return;
    const valid = items.filter((it) => it.settingKey.trim());
    setSaving(true);
    try {
      await review.updateDisplaySettings(
        valid.map((it) => ({
          settingKey: it.settingKey.trim(),
          settingValue: it.settingValue.trim() || it.settingKey.trim(),
          sortOrder: it.sortOrder,
        })),
      );
      toast.success('保存成功');
      onRefresh();
    } catch (err) {
      logger.error('保存显示设置失败', err);
      toast.error(getErrorMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccordionItem
      value="display-settings"
      className="border border-[#e2e8f0] rounded-lg px-4 bg-white"
    >
      <AccordionTrigger className="py-3 hover:no-underline">
        <div className="flex items-center gap-3 flex-1 pr-4">
          <Settings2 className="w-4 h-4 text-[#1e6feb]" />
          <span className="text-[14px] font-medium text-[#0f172a]">
            显示名称设置
          </span>
          <span className="text-[12px] text-[#64748b] ml-2">
            配置组织单元、岗位、部门等展示名称
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="ml-7 space-y-4">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-8 w-40" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-6 w-6 rounded-md" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-sm text-[#64748b]">加载失败</div>
          ) : (
            <>
              <div className="space-y-2">
                {(!items || items.length === 0) && (
                  <div className="text-[12px] text-[#94a3b8] py-2">
                    暂无配置，点击「新增配置项」添加
                  </div>
                )}
                {items?.map((item, idx) => (
                  <div
                    key={item.id || `new-${idx}`}
                    className="flex items-center gap-3"
                  >
                    <div className="flex flex-col gap-1 flex-1 max-w-[200px]">
                      <Label className="text-[11px] text-[#64748b]">
                        配置项 Key
                      </Label>
                      <Input
                        value={item.settingKey}
                        onChange={(e) =>
                          updateItem(idx, { settingKey: e.target.value })
                        }
                        placeholder="如：部门名称"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <Label className="text-[11px] text-[#64748b]">
                        显示名称
                      </Label>
                      <Input
                        value={item.settingValue}
                        onChange={(e) =>
                          updateItem(idx, { settingValue: e.target.value })
                        }
                        placeholder="如: 销售部"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1 w-20">
                      <Label className="text-[11px] text-[#64748b]">
                        排序
                      </Label>
                      <Input
                        type="number"
                        value={item.sortOrder}
                        onChange={(e) =>
                          updateItem(idx, {
                            sortOrder: Number(e.target.value) || 0,
                          })
                        }
                        className="h-8 text-sm"
                        min="1"
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 mt-5 text-[#ef4444] hover:bg-[#fef2f2]"
                      onClick={() => removeItem(idx)}
                      aria-label="删除配置项"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-[#f1f5f9]">
                <Button size="sm" variant="outline" onClick={addItem}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  新增配置项
                </Button>
                <Button
                  size="sm"
                  onClick={() => void handleSave()}
                  disabled={saving || !items || items.length === 0}
                  className="bg-[#1e6feb] hover:bg-[#1a5fd4] text-white"
                >
                  <Save className="w-3.5 h-3.5 mr-1" />
                  保存设置
                </Button>
              </div>
            </>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
