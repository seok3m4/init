import {
  composeJobDescriptionWithExtraInfo,
  createEmptyPostingExtraInfo,
  extractPostingExtraInfo,
  hasPostingExtraInfo,
} from "./posting-extra-info";

const extraInfo = createEmptyPostingExtraInfo();
extraInfo.career = { enabled: true, value: "신입 / 경력 3년 이상" };
extraInfo.education = { enabled: false, value: "대졸 이상" };
extraInfo.salary = { enabled: true, value: "회사 내규에 따름" };
extraInfo.location = { enabled: true, value: "서울 / 판교 / 원격" };
extraInfo.employmentType = { enabled: true, value: "정규직" };

if (!hasPostingExtraInfo(extraInfo)) {
  throw new Error("Enabled extra posting info with values should be detected.");
}

const composed = composeJobDescriptionWithExtraInfo("<p>담당 업무</p>", extraInfo);

if (!composed.includes('data-init-posting-extra-info="true"')) {
  throw new Error("Composed JD should include the posting extra info marker.");
}

if (!composed.includes("<strong>경력</strong>") || !composed.includes("신입 / 경력 3년 이상")) {
  throw new Error("Composed JD should include enabled career info.");
}

if (composed.includes("대졸 이상")) {
  throw new Error("Disabled extra posting info should not be included.");
}

const extracted = extractPostingExtraInfo(composed);

if (extracted.jobDescription !== "<p>담당 업무</p>") {
  throw new Error("Extracting extra posting info should preserve the original JD body.");
}

if (extracted.extraInfo.salary.value !== "회사 내규에 따름" || !extracted.extraInfo.salary.enabled) {
  throw new Error("Extracting extra posting info should restore salary state.");
}

const recomposed = composeJobDescriptionWithExtraInfo(composed, extraInfo);
const markerCount = (recomposed.match(/data-init-posting-extra-info="true"/g) ?? []).length;

if (markerCount !== 1) {
  throw new Error("Recomposing an existing JD should not duplicate the extra info block.");
}
