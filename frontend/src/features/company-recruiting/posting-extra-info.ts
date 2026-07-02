export type PostingExtraInfoKey = "career" | "education" | "salary" | "location" | "employmentType";

export type PostingExtraInfoField = {
  enabled: boolean;
  value: string;
};

export type PostingExtraInfo = Record<PostingExtraInfoKey, PostingExtraInfoField>;

export type PostingExtraInfoFieldDefinition = {
  key: PostingExtraInfoKey;
  label: string;
  placeholder: string;
};

export const postingExtraInfoFields: PostingExtraInfoFieldDefinition[] = [
  {
    key: "career",
    label: "경력",
    placeholder: "신입 / 경력 3년 이상 / 경력무관",
  },
  {
    key: "education",
    label: "학력",
    placeholder: "학력무관 / 고졸 / 초대졸 / 대졸 이상",
  },
  {
    key: "salary",
    label: "급여",
    placeholder: "회사 내규에 따름 / 연봉 4,000만원 이상 / 협의 가능",
  },
  {
    key: "location",
    label: "근무지역",
    placeholder: "서울 / 판교 / 원격 / 하이브리드",
  },
  {
    key: "employmentType",
    label: "근무형태",
    placeholder: "정규직 / 계약직 / 인턴 / 프리랜서",
  },
];

const extraInfoBlockPattern = /<blockquote\b[^>]*data-init-posting-extra-info="true"[^>]*>[\s\S]*?<\/blockquote>/i;
const extraInfoFieldPattern =
  /<p\b[^>]*data-init-posting-extra-info-field="([^"]+)"[^>]*>\s*<strong>[\s\S]*?<\/strong>\s*:\s*([\s\S]*?)<\/p>/gi;

export function createEmptyPostingExtraInfo(): PostingExtraInfo {
  return Object.fromEntries(
    postingExtraInfoFields.map((field) => [field.key, { enabled: false, value: "" }]),
  ) as PostingExtraInfo;
}

export function hasPostingExtraInfo(extraInfo: PostingExtraInfo) {
  return postingExtraInfoFields.some((field) => extraInfo[field.key].enabled && extraInfo[field.key].value.trim());
}

export function composeJobDescriptionWithExtraInfo(jobDescription: string, extraInfo: PostingExtraInfo) {
  const body = stripPostingExtraInfoBlock(jobDescription).trim();
  const extraInfoHtml = buildPostingExtraInfoHtml(extraInfo);

  return [extraInfoHtml, body].filter(Boolean).join("");
}

export function extractPostingExtraInfo(jobDescription: string | null | undefined) {
  const content = jobDescription?.trim() ?? "";
  const extraInfo = createEmptyPostingExtraInfo();
  const block = content.match(extraInfoBlockPattern)?.[0] ?? "";

  if (block) {
    for (const match of block.matchAll(extraInfoFieldPattern)) {
      const key = match[1] as PostingExtraInfoKey;
      if (isPostingExtraInfoKey(key)) {
        extraInfo[key] = {
          enabled: true,
          value: decodeHtml(stripHtml(match[2]).trim()),
        };
      }
    }
  }

  return {
    jobDescription: stripPostingExtraInfoBlock(content).trim(),
    extraInfo,
  };
}

export function stripPostingExtraInfoBlock(jobDescription: string | null | undefined) {
  return (jobDescription ?? "").replace(extraInfoBlockPattern, "");
}

function buildPostingExtraInfoHtml(extraInfo: PostingExtraInfo) {
  const rows = postingExtraInfoFields
    .map((field) => {
      const value = extraInfo[field.key].value.trim();
      if (!extraInfo[field.key].enabled || !value) {
        return "";
      }
      return `<p data-init-posting-extra-info-field="${field.key}"><strong>${field.label}</strong>: ${escapeHtml(value)}</p>`;
    })
    .filter(Boolean)
    .join("");

  if (!rows) {
    return "";
  }

  return `<blockquote data-init-posting-extra-info="true"><p><strong>공고 조건</strong></p>${rows}</blockquote>`;
}

function isPostingExtraInfoKey(value: string): value is PostingExtraInfoKey {
  return postingExtraInfoFields.some((field) => field.key === value);
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeHtml(value: string) {
  return value
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}
