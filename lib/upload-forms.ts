// Client-side checks for the credential and video forms. The API trims the text and checks the
// same limits, so these only catch mistakes before the request. Limits mirror tuition-api.

export const MAX_TUTOR_CREDENTIALS = 20;
export const MAX_TUTOR_VIDEOS = 3;

export interface CredentialFormValues {
  examLabel: string;
  result: string;
  fileId: string | null;
}

export interface VideoFormValues {
  title: string;
  fileId: string | null;
}

export type CredentialFormErrors = Partial<
  Record<keyof CredentialFormValues, string>
>;
export type VideoFormErrors = Partial<Record<keyof VideoFormValues, string>>;

function checkText(
  value: string,
  { min = 1, max }: { min?: number; max: number },
  emptyMessage: string,
): string | undefined {
  const text = value.trim();
  if (text.length < min) return emptyMessage;
  if (text.length > max) return `Keep it to ${max} characters or fewer.`;
  return undefined;
}

export function validateCredentialForm(
  values: CredentialFormValues,
): CredentialFormErrors {
  const errors: CredentialFormErrors = {};
  const examLabel = checkText(
    values.examLabel,
    { max: 80 },
    "Enter the exam, like SSC 2024.",
  );
  const result = checkText(
    values.result,
    { max: 40 },
    "Enter the result, like GPA 5.00.",
  );
  if (examLabel) errors.examLabel = examLabel;
  if (result) errors.result = result;
  if (!values.fileId) errors.fileId = "Upload the result sheet.";
  return errors;
}

export function validateVideoForm(values: VideoFormValues): VideoFormErrors {
  const errors: VideoFormErrors = {};
  const title = checkText(values.title, { max: 100 }, "Enter a title.");
  if (title) errors.title = title;
  if (!values.fileId) errors.fileId = "Upload the video.";
  return errors;
}

/** True when a tutor has used up their credential slots. */
export function credentialLimitReached(count: number): boolean {
  return count >= MAX_TUTOR_CREDENTIALS;
}

/** True when a tutor has used up their video slots. */
export function videoLimitReached(count: number): boolean {
  return count >= MAX_TUTOR_VIDEOS;
}
