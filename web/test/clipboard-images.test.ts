import { describe, expect, test } from "bun:test";

import { clipboardImageFiles } from "../src/lib/clipboard-images";

type ClipboardItemStub = { kind: string; type: string; getAsFile: () => File | null };

function clipboard(items: ClipboardItemStub[], files: File[] = []) {
    return { items, files } as unknown as DataTransfer;
}

function fileItem(file: File | null, type = file?.type || "image/png"): ClipboardItemStub {
    return { kind: "file", type, getAsFile: () => file };
}

describe("剪贴板图片解析", () => {
    test("没有剪贴板或只有文本时返回空数组", () => {
        expect(clipboardImageFiles(null)).toEqual([]);
        expect(clipboardImageFiles(undefined)).toEqual([]);
        expect(clipboardImageFiles(clipboard([{ kind: "string", type: "text/plain", getAsFile: () => null }]))).toEqual([]);
    });

    test("只接收图片，忽略文本项与非图片文件", () => {
        const image = new File(["pixels"], "shot.png", { type: "image/png" });
        const pdf = new File(["doc"], "brief.pdf", { type: "application/pdf" });
        const result = clipboardImageFiles(clipboard([
            { kind: "string", type: "text/plain", getAsFile: () => null },
            fileItem(image),
            fileItem(pdf, "application/pdf"),
        ], [pdf]));
        expect(result.map((item) => item.name)).toEqual(["shot.png"]);
    });

    test("同一张图同时出现在 items 与 files 时只添加一次", () => {
        const image = new File(["pixels"], "shot.png", { type: "image/png" });
        const result = clipboardImageFiles(clipboard([fileItem(image)], [image]));
        expect(result).toHaveLength(1);
        expect(result[0]?.name).toBe("shot.png");
    });

    test("截图没有文件名时补一个带正确扩展名的占位名", () => {
        const png = new File(["pixels"], "", { type: "image/png" });
        const jpeg = new File(["pixels"], "", { type: "image/jpeg" });
        const result = clipboardImageFiles(clipboard([fileItem(png), fileItem(jpeg)]));
        expect(result.map((item) => item.name)).toEqual(["clipboard-image.png", "clipboard-image.jpg"]);
        expect(result.map((item) => item.type)).toEqual(["image/png", "image/jpeg"]);
    });

    test("两张同尺寸的无名截图不会被去重成一张", () => {
        const first = new File(["aaaa"], "", { type: "image/png" });
        const second = new File(["bbbb"], "", { type: "image/png" });
        expect(clipboardImageFiles(clipboard([fileItem(first), fileItem(second)]))).toHaveLength(2);
    });
});
