#!/bin/bash
#
# pyvideotrans macOS 一键安装脚本
# 用法：bash install-macos.sh
#

set -e

echo "========================================================"
echo "     pyvideotrans macOS 安装脚本"
echo "========================================================"
echo ""

# ============================================
# 1. 检查系统环境
# ============================================
echo "🔍 [1/6] 检查系统环境..."

# 检测 macOS
if [[ "$(uname)" != "Darwin" ]]; then
    echo "❌ 此脚本仅适用于 macOS"
    exit 1
fi
echo "   ✅ macOS 系统"

# 检查 Python3
if ! command -v python3 &> /dev/null; then
    echo "❌ 未找到 Python3，请先安装"
    echo "   访问: https://www.python.org/downloads/"
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "   ✅ Python 版本: $PYTHON_VERSION"

# 检查 FFmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "   ⚠️  FFmpeg 未安装"
    echo "   📥 正在安装 FFmpeg..."

    if command -v brew &> /dev/null; then
        brew install ffmpeg
        echo "   ✅ FFmpeg 安装完成"
    else
        echo "   ❌ 请先安装 Homebrew: https://brew.sh"
        echo "   或手动安装 FFmpeg: https://ffmpeg.org/download.html"
        exit 1
    fi
else
    FFMPEG_VERSION=$(ffmpeg -version 2>&1 | head -n1)
    echo "   ✅ FFmpeg: $FFMPEG_VERSION"
fi

echo ""

# ============================================
# 2. 克隆项目
# ============================================
echo "📥 [2/6] 克隆 pyvideotrans 项目..."

INSTALL_DIR="./video-translation/pyvideotrans-app"

if [ -d "$INSTALL_DIR" ]; then
    echo "   ⏭️  目录已存在，跳过克隆"
else
    # 使用镜像加速（如果 GitHub 访问慢）
    GIT_MIRROR="https://mirror.ghproxy.com/https://github.com"

    echo "   正在克隆项目（使用加速镜像）..."
    git clone "${GIT_MIRROR}/jianchang512/pyvideotrans.git" "$INSTALL_DIR" || {
        echo "   ⚠️  镜像克隆失败，尝试直接克隆..."
        git clone "https://github.com/jianchang512/pyvideotrans.git" "$INSTALL_DIR"
    }
    echo "   ✅ 克隆完成"
fi

cd "$INSTALL_DIR"
echo ""

# ============================================
# 3. 创建虚拟环境
# ============================================
echo "🐍 [3/6] 创建 Python 虚拟环境..."

if [ -d "venv" ]; then
    echo "   ⏭️  虚拟环境已存在"
else
    python3 -m venv venv
    echo "   ✅ 虚拟环境创建完成"
fi

# 激活虚拟环境
source venv/bin/activate
echo "   ✅ 虚拟环境已激活"
echo ""

# ============================================
# 4. 安装依赖
# ============================================
echo "📦 [4/6] 安装项目依赖..."

# 检查 requirements.txt 是否存在
if [ ! -f "requirements.txt" ]; then
    echo "   ❌ 未找到 requirements.txt"
    exit 1
fi

# 配置 pip 镜像（加速下载）
pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/
pip config set install.trusted-host mirrors.aliyun.com

# 安装依赖
echo "   正在安装依赖（可能需要几分钟）..."
pip install -r requirements.txt

echo "   ✅ 依赖安装完成"
echo ""

# ============================================
# 5. 检查启动文件
# ============================================
echo "🔍 [5/6] 检查启动文件..."

# 查找启动脚本
if [ -f "sp.py" ]; then
    START_FILE="sp.py"
    echo "   ✅ 找到启动文件: sp.py"
elif [ -f "main.py" ]; then
    START_FILE="main.py"
    echo "   ✅ 找到启动文件: main.py"
elif [ -f "app.py" ]; then
    START_FILE="app.py"
    echo "   ✅ 找到启动文件: app.py"
else
    echo "   ⚠️  未找到明确的启动文件"
    echo "   可用的 Python 文件:"
    ls -1 *.py 2>/dev/null || echo "   (无)"
    START_FILE="sp.py"  # 默认尝试
fi

echo ""

# ============================================
# 6. 复制术语表
# ============================================
echo "📝 [6/6] 配置术语表..."

TERMINOLOGY_SOURCE="../../terminology.txt"
TERMINOLOGY_TARGET="./terminology.txt"

if [ -f "$TERMINOLOGY_SOURCE" ]; then
    cp "$TERMINOLOGY_SOURCE" "$TERMINOLOGY_TARGET"
    echo "   ✅ 术语表已复制"
else
    echo "   ⚠️  未找到术语表源文件"
fi

echo ""

# ============================================
# 完成
# ============================================
echo "========================================================"
echo "✅ 安装完成！"
echo "========================================================"
echo ""
echo "📁 安装目录: $INSTALL_DIR"
echo "🐍 虚拟环境: $INSTALL_DIR/venv"
echo ""
echo "🚀 启动方式："
echo ""
echo "   方式1（手动启动）："
echo "   cd $INSTALL_DIR"
echo "   source venv/bin/activate"
echo "   python $START_FILE"
echo ""
echo "   方式2（一键启动）："
echo "   bash $INSTALL_DIR/start.sh"
echo ""
echo "========================================================"

# 创建一键启动脚本
cat > "$INSTALL_DIR/start.sh" << 'EOFSCRIPT'
#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate
python sp.py
EOFSCRIPT

chmod +x "$INSTALL_DIR/start.sh"

echo "✅ 一键启动脚本已创建: $INSTALL_DIR/start.sh"
echo ""
echo "========================================================"
echo "📖 使用说明:"
echo "   1. 运行启动脚本: bash $INSTALL_DIR/start.sh"
echo "   2. 在打开的界面中导入你的视频文件"
echo "   3. 设置：英语 → 中文"
echo "   4. 加载术语表: $INSTALL_DIR/terminology.txt"
echo "   5. 点击开始翻译"
echo "========================================================"
