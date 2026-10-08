"use client";

import { createContext, useContext, type ReactNode } from "react";
import { CATEGORY_ITEMS, SATISFACTION_OPTIONS, TEXT_MAX_LENGTH, type CategoryKey, type SurveyAnswers } from "../model";
import styles from "./survey-fields.module.css";

const SATISFACTION_LABELS = SATISFACTION_OPTIONS.map(({ value, label }) => `${value} ${label}`);
const QuestionContext = createContext<{ required: boolean; describedBy?: string; error?: string }>({ required: false });

function SelectionMark() {
  return (
    <span className={styles.selectionMark} aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="none">
        <path d="m4 8 2.5 2.5L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Question({
  number,
  title,
  required = true,
  error,
  id,
  children,
  description,
}: {
  number: number;
  title: string;
  required?: boolean;
  error?: string;
  id: string;
  children: ReactNode;
  description?: string;
}) {
  const describedBy = [description && `${id}-description`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset
      id={id}
      className={`${styles.question} ${error ? styles.questionError : ""}`}
      tabIndex={-1}
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
    >
      <legend id={`${id}-title`} className={styles.questionLegend}>
        <span className={styles.questionNumber} aria-hidden="true">{String(number).padStart(2, "0")}</span>
        <span className={styles.questionTitle}>{title}</span>
        <span className={required ? styles.requiredBadge : styles.optionalBadge}>{required ? <><span aria-hidden="true">*</span> 필수</> : "선택"}</span>
      </legend>
      {description && <p id={`${id}-description`} className={styles.description}>{description}</p>}
      <div className={styles.questionBody}><QuestionContext.Provider value={{ required, describedBy, error }}>{children}</QuestionContext.Provider></div>
      {error && <p id={`${id}-error`} className={styles.error} role="alert">{error}</p>}
    </fieldset>
  );
}

export function ChoiceField({
  name,
  options,
  value,
  onChange,
  compact = false,
}: {
  name: string;
  options: readonly { value: string; label: string }[];
  value: string | null;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const question = useContext(QuestionContext);
  return (
    <div className={`${styles.choices} ${compact ? styles.compactChoices : ""}`} role="radiogroup" aria-labelledby={`${name}-title`} aria-required={question.required} aria-describedby={question.describedBy}>
      {options.map((option) => (
        <label key={option.value} className={styles.choice}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className={styles.radioInput}
          />
          <span className={styles.choiceSurface}>
            <SelectionMark />
            <span>{option.label}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export function RatingField({
  name,
  min,
  max,
  value,
  onChange,
  minLabel,
  maxLabel,
}: {
  name: string;
  min: number;
  max: number;
  value: number | null;
  onChange: (value: number) => void;
  minLabel: string;
  maxLabel: string;
}) {
  const question = useContext(QuestionContext);
  const numbers = Array.from({ length: max - min + 1 }, (_, index) => min + index);
  const isRecommendationScale = numbers.length > 5;

  return (
    <div>
      <div className={`${styles.ratingChoices} ${isRecommendationScale ? styles.recommendationChoices : ""}`} role="radiogroup" aria-labelledby={`${name}-title`} aria-required={question.required} aria-describedby={question.describedBy}>
        {numbers.map((number) => (
          <label key={number} className={styles.ratingChoice}>
            <input
              type="radio"
              name={name}
              value={number}
              checked={value === number}
              onChange={() => onChange(number)}
              aria-label={`${number}${number === min ? ` ${minLabel}` : number === max ? ` ${maxLabel}` : "점"}`}
              className={styles.radioInput}
            />
            <span className={styles.ratingSurface}>{number}</span>
          </label>
        ))}
      </div>
      <div className={styles.scaleLabels}>
        <span>{min} {minLabel}</span>
        <span>{max} {maxLabel}</span>
      </div>
    </div>
  );
}

export function CategoryRatings({
  values,
  onChange,
  errors = {},
}: {
  values: SurveyAnswers["categoryRatings"];
  onChange: (key: CategoryKey, value: number) => void;
  errors?: Partial<Record<string, string>>;
}) {
  return (
    <div className={styles.categories}>
      <table className={styles.categoryTable}>
        <caption className={styles.srOnly}>항목별 만족도. 각 항목에서 1부터 5까지 하나를 선택해 주십시오.</caption>
        <thead>
          <tr>
            <th scope="col" className={styles.categoryHeading}>평가 항목</th>
            {SATISFACTION_LABELS.map((label, index) => (
              <th scope="col" key={label} className={styles.scoreHeading}>
                <span>{index + 1}</span>
                <span>{label.slice(2)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CATEGORY_ITEMS.map((item) => (
            <tr key={item.key}>
              <th scope="row" className={styles.categoryLabel} id={`category-${item.key}-desktop-title`}>
                {item.label}
                {errors[`categoryRatings.${item.key}`] && <span id={`category-${item.key}-desktop-error`} className={styles.rowError}>{errors[`categoryRatings.${item.key}`]}</span>}
              </th>
              {SATISFACTION_LABELS.map((label, index) => (
                <td key={label}>
                  <label className={styles.tableChoice}>
                    <input
                      type="radio"
                      name={`categoryRatings.${item.key}-desktop`}
                      value={index + 1}
                      checked={values[item.key] === index + 1}
                      onChange={() => onChange(item.key, index + 1)}
                      aria-label={`${item.label}: ${label}`}
                      aria-describedby={errors[`categoryRatings.${item.key}`] ? `category-${item.key}-desktop-error` : undefined}
                      className={styles.radioInput}
                    />
                    <span className={styles.tableChoiceSurface}><SelectionMark /></span>
                  </label>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.mobileCategories}>
        <div className={styles.mobileScaleLegend}>
          {SATISFACTION_OPTIONS.map(({ value, label }) => <span key={value}><strong>{value}</strong>{label}</span>)}
        </div>
        {CATEGORY_ITEMS.map((item) => {
          const error = errors[`categoryRatings.${item.key}`];
          return (
            <fieldset key={item.key} className={styles.mobileCategory} role="radiogroup" aria-required="true" aria-describedby={error ? `category-${item.key}-error` : undefined}>
              <legend>{item.label}</legend>
              <div className={styles.ratingChoices}>
                {SATISFACTION_LABELS.map((label, index) => (
                  <label key={label} className={styles.ratingChoice}>
                    <input
                      type="radio"
                      name={`categoryRatings.${item.key}-mobile`}
                      value={index + 1}
                      checked={values[item.key] === index + 1}
                      onChange={() => onChange(item.key, index + 1)}
                      aria-label={label}
                      aria-describedby={error ? `category-${item.key}-error` : undefined}
                      className={styles.radioInput}
                    />
                    <span className={styles.ratingSurface}>{index + 1}</span>
                  </label>
                ))}
              </div>
              {error && <p id={`category-${item.key}-error`} className={styles.rowError}>{error}</p>}
            </fieldset>
          );
        })}
        <div className={styles.scaleLabels}><span>1 매우 불만족</span><span>5 매우 만족</span></div>
      </div>
    </div>
  );
}

export function TextField({
  name,
  value,
  onChange,
  required = false,
  placeholder,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const question = useContext(QuestionContext);
  const showCounter = value.length >= TEXT_MAX_LENGTH * 0.8;
  const describedBy = [question.describedBy, showCounter && `${name}-count`].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.textField}>
      <textarea
        id={`${name}-input`}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        maxLength={TEXT_MAX_LENGTH}
        required={required}
        placeholder={placeholder}
        aria-labelledby={`${name}-title`}
        aria-describedby={describedBy}
        aria-invalid={question.error ? true : undefined}
        className={styles.textarea}
      />
      {showCounter && <p id={`${name}-count`} className={styles.textCounter}>{value.length.toLocaleString()} / {TEXT_MAX_LENGTH.toLocaleString()}자</p>}
    </div>
  );
}
