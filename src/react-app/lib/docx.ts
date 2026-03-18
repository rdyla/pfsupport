import { unzipSync } from "fflate";

export function convertDocxToMarkdown(bytes: Uint8Array, title: string): string {
	let files: Record<string, Uint8Array>;
	try {
		files = unzipSync(bytes);
	} catch {
		throw new Error("Could not read file. Make sure it's a valid .docx file.");
	}

	const docXml = files["word/document.xml"];
	if (!docXml) throw new Error("Invalid DOCX structure — word/document.xml not found.");

	const xmlStr = new TextDecoder("utf-8").decode(docXml);
	const paras = xmlStr.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
	const lines: string[] = [];

	for (const para of paras) {
		const styleMatch = para.match(/<w:pStyle w:val="([^"]+)"/);
		const style = styleMatch?.[1] ?? "";

		// Check for bold runs — treat short all-bold paragraphs as headings
		const hasBold = /<w:b\/>|<w:b w:val="true"|<w:b>/.test(para);

		const runs = para.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g) ?? [];
		const text = runs
			.map((r) => r.replace(/<w:t(?:\s[^>]*)?>/, "").replace(/<\/w:t>/, ""))
			.join("");

		if (!text.trim()) {
			if (lines.length > 0 && lines[lines.length - 1] !== "") lines.push("");
			continue;
		}

		if (style === "Title") lines.push(`# ${text}`);
		else if (style === "Subtitle") lines.push(`*${text}*`);
		else if (style === "Heading1") lines.push(`# ${text}`);
		else if (style === "Heading2") lines.push(`## ${text}`);
		else if (style === "Heading3") lines.push(`### ${text}`);
		else if (style === "Heading4") lines.push(`#### ${text}`);
		else if (style === "Heading5") lines.push(`##### ${text}`);
		else if (style.startsWith("ListBullet") || style === "ListParagraph") lines.push(`- ${text}`);
		else if (style.startsWith("ListNumber")) lines.push(`1. ${text}`);
		else if (hasBold && text.length < 120) lines.push(`## ${text}`);
		else lines.push(text);
	}

	// Ensure title heading exists
	const content = lines.join("\n").trim();
	if (!content.startsWith("# ")) {
		return `# ${title}\n\n${content}`;
	}
	return content;
}

export function convertTextToMarkdown(text: string, title: string): string {
	return `# ${title}\n\n${text.trim()}`;
}
