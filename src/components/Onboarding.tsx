import { useTranslation } from "react-i18next";

interface OnboardingProps {
  onLoadSamples: () => void;
  onSkip: () => void;
}

export default function Onboarding({ onLoadSamples, onSkip }: OnboardingProps) {
  const { t, i18n } = useTranslation();

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <h1 className="onboarding-title">{t("app.name")}</h1>
        <p className="onboarding-desc">{t("onboarding.welcome")}</p>

        <div className="onboarding-steps">
          <div className="onboarding-step">
            <span className="onboarding-step-num">1</span>
            <span>{t("onboarding.step1")}</span>
          </div>
          <div className="onboarding-step">
            <span className="onboarding-step-num">2</span>
            <span>{t("onboarding.step2")}</span>
          </div>
          <div className="onboarding-step">
            <span className="onboarding-step-num">3</span>
            <span>{t("onboarding.step3")}</span>
          </div>
        </div>

        <div className="onboarding-lang">
          <button
            className={`btn btn-sm ${i18n.language === "ja" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => i18n.changeLanguage("ja")}
          >
            日本語
          </button>
          <button
            className={`btn btn-sm ${i18n.language === "en" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => i18n.changeLanguage("en")}
          >
            English
          </button>
        </div>

        <div className="onboarding-actions">
          <button className="btn btn-primary" onClick={onLoadSamples}>
            {t("onboarding.loadSamples")}
          </button>
          <button className="btn btn-ghost" onClick={onSkip}>
            {t("onboarding.skip")}
          </button>
        </div>
      </div>
    </div>
  );
}
