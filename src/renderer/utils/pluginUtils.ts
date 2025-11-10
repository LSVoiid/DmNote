/**
 * 플러그인 파일 내용에서 @id 메타데이터를 추출하거나 파일명으로 폴백합니다.
 *
 * @param content - 플러그인 파일 내용
 * @param filename - 플러그인 파일명
 * @returns 플러그인 고유 ID (네임스페이스로 사용)
 */
export function extractPluginId(content: string, filename: string): string {
  // 첫 20줄에서 @id 메타데이터 찾기
  const lines = content.split("\n").slice(0, 20);
  for (const line of lines) {
    const match = line.match(/\/\/\s*@id:\s*([a-z0-9-_]+)/i);
    if (match) {
      return match[1].toLowerCase();
    }
  }

  // 폴백: 파일명 정규화
  return filename
    .toLowerCase()
    .replace(/\.(js|mjs|ts)$/i, "")
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "");
}
