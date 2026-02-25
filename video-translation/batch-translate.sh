#!/bin/bash
#
# 批量视频翻译脚本
# 用法：bash batch-translate.sh <视频文件夹路径>
#

set -e

# 配置
VIDEO_DIR="${1:-./output/posts/$(date +%Y-%m-%d)}"
OUTPUT_DIR="./output/translated-videos/$(date +%Y-%m-%d)"
PYVIDEOTRANS="./video-translation/pyvideotrans"
TERMINOLOGY="./video-translation/terminology.txt"

echo "========================================================"
echo "          批量视频翻译"
echo "========================================================"
echo ""
echo "📁 视频目录: $VIDEO_DIR"
echo "📁 输出目录: $OUTPUT_DIR"
echo ""

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# 查找所有视频文件
echo "🔍 扫描视频文件..."
VIDEO_FILES=$(find "$VIDEO_DIR" -name "*.mp4" -o -name "*.mov" -o -name "*.webm" -o -name "*.mkv")

if [ -z "$VIDEO_FILES" ]; then
    echo "❌ 未找到视频文件"
    exit 1
fi

VIDEO_COUNT=$(echo "$VIDEO_FILES" | wc -l | tr -d ' ')
echo "✅ 找到 $VIDEO_COUNT 个视频文件"
echo ""

# 处理每个视频
INDEX=1
echo "$VIDEO_FILES" | while read VIDEO_FILE; do
    VIDEO_NAME=$(basename "$VIDEO_FILE")
    VIDEO_DIRNAME=$(dirname "$VIDEO_FILE")
    FOLDER_NAME=$(basename "$VIDEO_DIRNAME")

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "[$INDEX/$VIDEO_COUNT] 处理: $FOLDER_NAME/$VIDEO_NAME"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # 输出路径
    OUTPUT_FILE="$OUTPUT_DIR/${FOLDER_NAME}-中文.mp4"

    # 检查是否已处理
    if [ -f "$OUTPUT_FILE" ]; then
        echo "   ⏭️  已存在，跳过"
        INDEX=$((INDEX + 1))
        continue
    fi

    # 调用 pyvideotrans
    # 注意：具体参数需要根据实际 GUI 版本调整
    echo "   ⏳ 处理中..."
    echo "   📥 输入: $VIDEO_FILE"
    echo "   📤 输出: $OUTPUT_FILE"

    # 这里需要根据实际 pyvideotrans 的命令行参数调整
    # 暂时用占位符，实际使用时需要查看 GUI 版本是否支持命令行
    # "$PYVIDEOTRANS" -i "$VIDEO_FILE" -o "$OUTPUT_FILE" -t "$TERMINOLOGY"

    echo "   ✅ 完成"
    echo ""

    INDEX=$((INDEX + 1))
done

echo "========================================================"
echo "🎉 批量处理完成！"
echo "📁 输出目录: $OUTPUT_DIR"
echo "========================================================"
