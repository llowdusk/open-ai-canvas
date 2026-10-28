import { useEffect, useRef } from "react";

import { clipboardImageFiles } from "@/lib/clipboard-images";

// 页面级图片粘贴：焦点不在输入框时也能把截图加为参考素材。
// 富文本编辑器自己会处理粘贴并 preventDefault，这里据此跳过，避免同一次粘贴添加两次。

const EDITABLE_SELECTOR = "input, textarea, select, [contenteditable='true']";
// 弹窗/抽屉打开时不接管粘贴，避免在别的浮层里粘贴却往页面参考区加素材。
const OVERLAY_SELECTOR = "[role='dialog'], .ant-modal-root, .ant-drawer";

function shouldIgnorePasteTarget(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest(EDITABLE_SELECTOR) || target.closest(OVERLAY_SELECTOR));
}

export function usePasteImageFiles(onFiles: (files: File[]) => void, enabled = true) {
    const handlerRef = useRef(onFiles);
    handlerRef.current = onFiles;

    useEffect(() => {
        if (!enabled) return;
        const handlePaste = (event: ClipboardEvent) => {
            // 编辑器、输入框或已打开的浮层已经处理过（含文本粘贴），不再重复导入。
            if (event.defaultPrevented || shouldIgnorePasteTarget(event.target)) return;
            const images = clipboardImageFiles(event.clipboardData);
            if (!images.length) return;
            event.preventDefault();
            handlerRef.current(images);
        };
        window.addEventListener("paste", handlePaste);
        return () => window.removeEventListener("paste", handlePaste);
    }, [enabled]);
}
