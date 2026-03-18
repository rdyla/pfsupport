import { unzipSync } from "fflate";

export function extractDocxText(bytes: Uint8Array): string {
	let files: Record<string, Uint8Array>;
	try {
		files = unzipSync(bytes);
	} catch {
		return "";
	}

	const docXml = files["word/document.xml"];
	if (!docXml) return "";

	const xmlStr = new TextDecoder("utf-8").decode(docXml);

	// Each <w:p> is a paragraph; each <w:t> inside is a text run
	const paras = xmlStr.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
	const result: string[] = [];

	for (const para of paras) {
		const runs = para.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g) ?? [];
		const text = runs
			.map((r) => r.replace(/<w:t(?:\s[^>]*)?>/, "").replace(/<\/w:t>/, ""))
			.join("");
		if (text.trim()) result.push(text);
	}

	return result.join("\n\n");
}
