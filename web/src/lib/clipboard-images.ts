// 剪贴板图片解析：截图与文件管理器复制都只在 clipboardData.items 里暴露文件。
// 聊天输入、生图工作台和画布节点共用这一处解析，避免各自判断 kind/type 时出现分歧。

const FALLBACK_IMAGE_NAME = "clipboard-image.png";

function extensionForMimeType(mimeType: string) {
    const subtype = mimeType.split("/")[1]?.split("+")[0]?.trim().toLowerCase();
    if (!subtype) return "png";
    return subtype === "jpeg" ? "jpg" : subtype;
}

/**
 * 从剪贴板取出图片文件。
 * 只接受 image/*；其余类型（文本、视频、未知二进制）一律忽略，交给调用方原本的文本粘贴逻辑。
 * 系统剪贴板里的图片常常没有文件名，这里补一个带扩展名的占位名，上传后才能得到正确的 MIME。
 */
export function clipboardImageFiles(data: DataTransfer | null | undefined): File[] {
    if (!data) return [];
    const files: File[] = [];
    const seen = new Set<string>();
    const push = (file: File | null, fallbackType: string) => {
        if (!file) return;
        const type = file.type || fallbackType;
        if (!type.startsWith("image/")) return;
        // 系统剪贴板里的截图往往没有文件名，此时不参与去重，避免两张同尺寸截图被误判成一张。
        // 有文件名时同一张图可能同时出现在 items 与 files 中，按 类型+大小+名称 去重。
        if (file.name) {
            const key = `${type}:${file.size}:${file.name}`;
            if (seen.has(key)) return;
            seen.add(key);
            files.push(file);
            return;
        }
        files.push(new File([file], `${FALLBACK_IMAGE_NAME.replace(/\.png$/, `.${extensionForMimeType(type)}`)}`, { type }));
    };

    for (const item of Array.from(data.items || [])) {
        if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
        push(item.getAsFile(), item.type);
    }
    // 某些浏览器只在 files 里给出条目（例如从资源管理器复制多张图）。
    for (const file of Array.from(data.files || [])) {
        push(file, file.type);
    }
    return files;
}

const IMAGE_URL_PATTERN = /^https?:\/\/[^\s]+\.(?:png|jpe?g|webp|gif|bmp|avif)(?:[?#][^\s]*)?$/i;

/**
 * 从剪贴板取出图片地址。
 * 从网页右键复制图片时，部分浏览器只在 text/html 里给 <img src>，不提供 image/* 文件项；
 * 这类内容交给调用方按远程图片导入，避免粘贴后毫无反应。
 */
export function clipboardImageUrlSource(data: DataTransfer | null | undefined): string {
    if (!data) return "";
    const resolve = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed || trimmed.startsWith("data:")) return "";
        try {
            const url = new URL(trimmed, window.location.href);
            return /^https?:$/.test(url.protocol) ? url.toString() : "";
        } catch {
            return "";
        }
    };

    const html = data.getData("text/html");
    if (html) {
        const parsed = new DOMParser().parseFromString(html, "text/html");
        for (const image of Array.from(parsed.querySelectorAll("img"))) {
            const resolved = resolve(image.getAttribute("src") || "");
            if (resolved) return resolved;
        }
    }
    // 直接复制图片地址的情况；text/uri-list 以 # 开头的是注释行。
    const plain = data.getData("text/uri-list") || data.getData("text/plain");
    if (plain) {
        for (const line of plain.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (trimmed.startsWith("#") || !IMAGE_URL_PATTERN.test(trimmed)) continue;
            const resolved = resolve(trimmed);
            if (resolved) return resolved;
        }
    }
    return "";
}
