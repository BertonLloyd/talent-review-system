#!/usr/bin/env bash
set -euo pipefail

# 开源版本导出脚本
# 用法：bash scripts/export-opensource.sh [输出目录]
# 功能：创建一个干净的开源发布版本，不含真实数据、密钥、备份表

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="${1:-$PROJECT_ROOT/dist/opensource}"
VERSION="${2:-1.0.0}"
PACKAGE_NAME="talent-review-system-${VERSION}"

echo "==> 准备开源发布包：${PACKAGE_NAME}"
echo "    项目根目录：${PROJECT_ROOT}"
echo "    输出目录：${OUTPUT_DIR}"

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR/$PACKAGE_NAME"

echo "==> 复制源代码..."

# 核心源码目录
cp -r "$PROJECT_ROOT/client" "$OUTPUT_DIR/$PACKAGE_NAME/"
cp -r "$PROJECT_ROOT/server" "$OUTPUT_DIR/$PACKAGE_NAME/"
cp -r "$PROJECT_ROOT/shared" "$OUTPUT_DIR/$PACKAGE_NAME/"
cp -r "$PROJECT_ROOT/docs" "$OUTPUT_DIR/$PACKAGE_NAME/"
cp -r "$PROJECT_ROOT/scripts" "$OUTPUT_DIR/$PACKAGE_NAME/"

# 配置文件
cp "$PROJECT_ROOT/package.json" "$OUTPUT_DIR/$PACKAGE_NAME/"
cp "$PROJECT_ROOT/package-lock.json" "$OUTPUT_DIR/$PACKAGE_NAME/"
cp "$PROJECT_ROOT/nest-cli.json" "$OUTPUT_DIR/$PACKAGE_NAME/"
cp "$PROJECT_ROOT/vite.config.ts" "$OUTPUT_DIR/$PACKAGE_NAME/"
cp "$PROJECT_ROOT/tsconfig.json" "$OUTPUT_DIR/$PACKAGE_NAME/"
cp "$PROJECT_ROOT/postcss.config.js" "$OUTPUT_DIR/$PACKAGE_NAME/"
cp "$PROJECT_ROOT/tailwind.config.js" "$OUTPUT_DIR/$PACKAGE_NAME/" 2>/dev/null || true
cp "$PROJECT_ROOT/components.json" "$OUTPUT_DIR/$PACKAGE_NAME/"
cp "$PROJECT_ROOT/eslint.config.js" "$OUTPUT_DIR/$PACKAGE_NAME/"
cp "$PROJECT_ROOT/.prettierrc" "$OUTPUT_DIR/$PACKAGE_NAME/"
cp "$PROJECT_ROOT/.stylelintrc.js" "$OUTPUT_DIR/$PACKAGE_NAME/"
cp "$PROJECT_ROOT/.npmrc" "$OUTPUT_DIR/$PACKAGE_NAME/"
cp "$PROJECT_ROOT/.gitignore" "$OUTPUT_DIR/$PACKAGE_NAME/"

# 文档
cp "$PROJECT_ROOT/README.md" "$OUTPUT_DIR/$PACKAGE_NAME/"
cp "$PROJECT_ROOT/LICENSE" "$OUTPUT_DIR/$PACKAGE_NAME/"
cp "$PROJECT_ROOT/.env.example" "$OUTPUT_DIR/$PACKAGE_NAME/"

# 清理不需要的文件
echo "==> 清理敏感文件和构建产物..."

# 删除敏感环境文件
rm -f "$OUTPUT_DIR/$PACKAGE_NAME/.env"
rm -f "$OUTPUT_DIR/$PACKAGE_NAME/.env.local"

# 删除 node_modules 和构建产物
rm -rf "$OUTPUT_DIR/$PACKAGE_NAME/node_modules"
rm -rf "$OUTPUT_DIR/$PACKAGE_NAME/dist"
rm -rf "$OUTPUT_DIR/$PACKAGE_NAME/.next"
rm -rf "$OUTPUT_DIR/$PACKAGE_NAME/.turbo"

# 删除 .git 和其他版本控制文件
rm -rf "$OUTPUT_DIR/$PACKAGE_NAME/.git"
rm -rf "$OUTPUT_DIR/$PACKAGE_NAME/.githooks"

# 删除平台特定文件
rm -rf "$OUTPUT_DIR/$PACKAGE_NAME/.agent"
rm -rf "$OUTPUT_DIR/$PACKAGE_NAME/.agent-memory"
rm -rf "$OUTPUT_DIR/$PACKAGE_NAME/.spark"
rm -f "$OUTPUT_DIR/$PACKAGE_NAME/.spark_project"

# 删除 AGENTS.md（开发文档，非开源必需）
rm -f "$OUTPUT_DIR/$PACKAGE_NAME/AGENTS.md"

# 清理 schema.ts 中的备份表定义（开源版本不含备份表）
echo "==> 清理 schema.ts 中的备份表定义..."
SCHEMA_FILE="$OUTPUT_DIR/$PACKAGE_NAME/server/database/schema.ts"
if [ -f "$SCHEMA_FILE" ]; then
  # 使用 node 脚本清理备份表相关内容
  node -e "
    const fs = require('fs');
    let content = fs.readFileSync('$SCHEMA_FILE', 'utf8');
    
    // 移除备份表的 pgTable 定义（从 export const xxxBak20261111 = pgTable 到它的结束 });）
    const bakRegex = /export const \\w+Bak20261111 = pgTable\\([\\s\\S]*?\\}\\);\\n/g;
    content = content.replace(bakRegex, '');
    
    // 移除备份表的 table aliases
    const aliasRegex = /export const \\w+Bak20261111Table = \\w+;\\n/g;
    content = content.replace(aliasRegex, '');
    
    // 移除空行过多
    content = content.replace(/\\n{3,}/g, '\\n\\n');
    
    fs.writeFileSync('$SCHEMA_FILE', content);
    console.log('已清理备份表定义');
  "
fi

echo "==> 验证清理结果..."
# 检查是否还有真实品牌或人名残留
REMAINS=$(grep -r "至美\|zhimei\|李维天\|王志坚\|美地\|金港湾\|新华保险" \
  "$OUTPUT_DIR/$PACKAGE_NAME/" 2>/dev/null || true)
if [ -n "$REMAINS" ]; then
  echo "警告：仍有品牌残留："
  echo "$REMAINS"
else
  echo "✓ 品牌/真实人名清理完成"
fi

# 检查是否还有硬编码密钥
SECRETS=$(grep -rn "admin2024\|JWT_SECRET.*='" \
  "$OUTPUT_DIR/$PACKAGE_NAME/server/" "$OUTPUT_DIR/$PACKAGE_NAME/client/" 2>/dev/null || true)
if [ -n "$SECRETS" ]; then
  echo "警告：仍有硬编码密钥："
  echo "$SECRETS"
else
  echo "✓ 硬编码密钥清理完成"
fi

# 检查备份表
BAK_TABLES=$(grep "Bak20261111\|_bak_20261111" "$SCHEMA_FILE" 2>/dev/null || true)
if [ -n "$BAK_TABLES" ]; then
  echo "警告：schema.ts 中仍有备份表定义"
  echo "$BAK_TABLES"
else
  echo "✓ 备份表清理完成"
fi

# 打包
echo "==> 创建压缩包..."
cd "$OUTPUT_DIR"
zip -r "${PACKAGE_NAME}.zip" "$PACKAGE_NAME" 2>/dev/null || tar -czf "${PACKAGE_NAME}.tar.gz" "$PACKAGE_NAME"

echo ""
echo "========================================="
echo "  开源发布包已生成："
echo "  ${OUTPUT_DIR}/${PACKAGE_NAME}.zip"
echo "========================================="
echo ""
echo "目录结构："
find "$OUTPUT_DIR/$PACKAGE_NAME" -maxdepth 2 -type f | sort | head -30
echo "..."
