import {
  postingExtraInfoFields,
  type PostingExtraInfo,
  type PostingExtraInfoKey,
} from "./posting-extra-info";

type PostingExtraInfoFieldsProps = {
  value: PostingExtraInfo;
  disabled?: boolean;
  onChange: (value: PostingExtraInfo) => void;
};

export function PostingExtraInfoFields({ value, disabled = false, onChange }: PostingExtraInfoFieldsProps) {
  function updateField(key: PostingExtraInfoKey, patch: Partial<PostingExtraInfo[PostingExtraInfoKey]>) {
    onChange({
      ...value,
      [key]: {
        ...value[key],
        ...patch,
      },
    });
  }

  return (
    <div className="posting-extra-fields">
      {postingExtraInfoFields.map((field) => {
        const state = value[field.key];

        return (
          <div className={`posting-extra-field ${state.enabled ? "is-enabled" : ""}`} key={field.key}>
            <label className="posting-extra-check">
              <input
                type="checkbox"
                checked={state.enabled}
                disabled={disabled}
                onChange={(event) => updateField(field.key, { enabled: event.target.checked })}
              />
              <span>{field.label}</span>
            </label>
            {state.enabled ? (
              <input
                aria-label={`${field.label} 입력`}
                disabled={disabled}
                value={state.value}
                onChange={(event) => updateField(field.key, { value: event.target.value })}
                placeholder={field.placeholder}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

type PostingExtraInfoSummaryProps = {
  value: PostingExtraInfo;
};

export function PostingExtraInfoSummary({ value }: PostingExtraInfoSummaryProps) {
  const items = postingExtraInfoFields
    .map((field) => ({
      ...field,
      value: value[field.key].enabled ? value[field.key].value.trim() : "",
    }))
    .filter((field) => field.value);

  if (items.length === 0) {
    return null;
  }

  return (
    <dl className="posting-extra-summary">
      {items.map((item) => (
        <div className="posting-extra-summary-item" key={item.key}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
