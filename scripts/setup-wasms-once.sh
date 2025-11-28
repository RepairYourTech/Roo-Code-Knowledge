#!/bin/bash

# One-time WASM setup script
# This script automates the setup of WASM files for the project
# Usage: ./scripts/setup-wasms-once.sh
# To make executable: chmod +x scripts/setup-wasms-once.sh

set -e  # Exit on any error

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions for colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to calculate file size in human readable format
format_size() {
    local bytes=$1
    if [ $bytes -lt 1024 ]; then
        echo "${bytes}B"
    elif [ $bytes -lt 1048576 ]; then
        echo "$(( bytes / 1024 ))KB"
    elif [ $bytes -lt 1073741824 ]; then
        echo "$(( bytes / 1048576 ))MB"
    else
        echo "$(( bytes / 1073741824 ))GB"
    fi
}

# Function to calculate total size of files in a directory
calculate_total_size() {
    local dir=$1
    local pattern=$2
    if [ -d "$dir" ]; then
        find "$dir" -name "$pattern" -exec du -b {} + | awk '{sum += $1} END {print sum}'
    else
        echo "0"
    fi
}

# Function to count files matching a pattern
count_files() {
    local dir=$1
    local pattern=$2
    if [ -d "$dir" ]; then
        find "$dir" -name "$pattern" | wc -l
    else
        echo "0"
    fi
}

print_info "Starting one-time WASM setup process..."

# Check required dependencies
if ! command_exists tsx; then
    print_error "tsx is not installed. Please install it first: npm install -g tsx"
    exit 1
fi

if ! command_exists mkdir; then
    print_error "mkdir command not found"
    exit 1
fi

if ! command_exists cp; then
    print_error "cp command not found"
    exit 1
fi

# Step 1: Create directory structure
print_info "Creating directory structure..."
mkdir -p src/wasms/tree-sitter src/wasms/tiktoken
print_success "Created directories: src/wasms/tree-sitter and src/wasms/tiktoken"

# Step 2: Run download scripts
print_info "Downloading tree-sitter WASMs..."
if tsx scripts/download-tree-sitter-wasms.ts; then
    print_success "Tree-sitter WASMs downloaded successfully"
else
    print_error "Failed to download tree-sitter WASMs"
    exit 1
fi

print_info "Downloading tiktoken WASMs..."
if tsx scripts/download-tiktoken-wasms.ts; then
    print_success "Tiktoken WASMs downloaded successfully"
else
    print_error "Failed to download tiktoken WASMs"
    exit 1
fi

# Step 3: Copy tree-sitter WASMs
print_info "Copying tree-sitter WASMs to target directory..."
if [ -d "dist/services/tree-sitter" ]; then
    cp dist/services/tree-sitter/*.wasm src/wasms/tree-sitter/
    print_success "Copied tree-sitter WASMs to src/wasms/tree-sitter/"
else
    print_error "Source directory dist/services/tree-sitter not found"
    exit 1
fi

# Step 4: Verify files
print_info "Verifying WASM files..."

# Check tree-sitter WASMs
tree_sitter_count=$(count_files "src/wasms/tree-sitter" "*.wasm")
if [ "$tree_sitter_count" -eq 30 ]; then
    print_success "Found exactly 30 tree-sitter WASM files"
else
    print_error "Expected 30 tree-sitter WASM files, found $tree_sitter_count"
    exit 1
fi

# Check tiktoken WASMs
tiktoken_files=$(find src/wasms/tiktoken -name "tiktoken_bg.wasm" | wc -l)
if [ "$tiktoken_files" -eq 1 ]; then
    print_success "Found tiktoken_bg.wasm in src/wasms/tiktoken/"
else
    print_error "Expected tiktoken_bg.wasm in src/wasms/tiktoken/, found $tiktoken_files files"
    exit 1
fi

# Step 5: Calculate total size
print_info "Calculating total WASM file sizes..."

tree_sitter_size=$(calculate_total_size "src/wasms/tree-sitter" "*.wasm")
tiktoken_size=$(calculate_total_size "src/wasms/tiktoken" "*.wasm")
total_size=$((tree_sitter_size + tiktoken_size))

tree_sitter_size_hr=$(format_size $tree_sitter_size)
tiktoken_size_hr=$(format_size $tiktoken_size)
total_size_hr=$(format_size $total_size)

# Step 6: Print success message with details
echo ""
print_success "WASM setup completed successfully!"
echo ""
echo -e "${GREEN}Summary:${NC}"
echo -e "  Tree-sitter WASMs: $tree_sitter_count files ($tree_sitter_size_hr)"
echo -e "  Tiktoken WASMs: 1 file ($tiktoken_size_hr)"
echo -e "  Total size: $total_size_hr"
echo ""

# Check if total size is approximately as expected (44MB)
expected_size=46137344  # 44MB in bytes
size_diff=$((total_size - expected_size))
size_diff_abs=${size_diff#-}
size_diff_percent=$((size_diff_abs * 100 / expected_size))

if [ $size_diff_percent -le 10 ]; then
    print_success "Total size is within expected range (~44MB)"
else
    print_warning "Total size differs significantly from expected (~44MB)"
fi

echo ""
print_info "Next steps:"
echo "  1. Review the downloaded files if needed"
echo "  2. Commit the changes to your repository:"
echo "     git add src/wasms/"
echo "     git commit -m \"Add WASM files for tree-sitter and tiktoken\""
echo "  3. Push the changes to your remote repository"
echo ""

print_success "Setup script completed successfully! 🎉"