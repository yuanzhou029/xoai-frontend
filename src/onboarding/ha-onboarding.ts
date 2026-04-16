import "@material/mwc-linear-progress/mwc-linear-progress";
import type { Auth } from "home-assistant-js-websocket";
import {
  createConnection,
  genClientId,
  getAuth,
  subscribeConfig,
} from "home-assistant-js-websocket";
import type { PropertyValues } from "lit";
import { css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators";
import {
  enableWrite,
  loadTokens,
  saveTokens,
} from "../common/auth/token_storage";
import { applyThemesOnElement } from "../common/dom/apply_themes_on_element";
import type { HASSDomEvent } from "../common/dom/fire_event";
import {
  addSearchParam,
  extractSearchParam,
  extractSearchParamsObject,
} from "../common/url/search-params";
import { subscribeOne } from "../common/util/subscribe-one";
import "../components/ha-card";
import type { AuthUrlSearchParams } from "../data/auth";
import { hassUrl } from "../data/auth";
import { saveFrontendSystemData } from "../data/frontend";
import type { OnboardingResponses, OnboardingStep } from "../data/onboarding";
import {
  fetchInstallationType,
  fetchOnboardingOverview,
  onboardIntegrationStep,
} from "../data/onboarding";
import { subscribeUser } from "../data/ws-user";
import { litLocalizeLiteMixin } from "../mixins/lit-localize-lite-mixin";
import { HassElement } from "../state/hass-element";
import type { HomeAssistant } from "../types";
import { storeState } from "../util/ha-pref-storage";
import { registerServiceWorker } from "../util/register-service-worker";
import "./onboarding-analytics";
import "./onboarding-create-user";
import "./onboarding-loading";
import "./onboarding-welcome";
import "./onboarding-welcome-links";
import { makeDialogManager } from "../dialogs/make-dialog-manager";
import { navigate } from "../common/navigate";
import { mainWindow } from "../common/dom/get_main_window";

type OnboardingEvent =
  | {
      type: "init";
      result?: { restore: "upload" | "cloud" };
    }
  | {
      type: "user";
      result: OnboardingResponses["user"];
    }
  | {
      type: "core_config";
      result: OnboardingResponses["core_config"];
    }
  | {
      type: "integration";
    }
  | {
      type: "analytics";
    };

interface OnboardingProgressEvent {
  increase?: number;
  decrease?: number;
  progress?: number;
}

declare global {
  interface HASSDomEvents {
    "onboarding-step": OnboardingEvent;
    "onboarding-progress": OnboardingProgressEvent;
  }

  interface GlobalEventHandlersEventMap {
    "onboarding-step": HASSDomEvent<OnboardingEvent>;
    "onboarding-progress": HASSDomEvent<OnboardingProgressEvent>;
  }
}

@customElement("ha-onboarding")
class HaOnboarding extends litLocalizeLiteMixin(HassElement) {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @property({ attribute: false }) public translationFragment =
    "page-onboarding";

  @state() private _progress = 0;

  @state() private _loading = false;

  @state() private _init = false;

  @state() private _restoring?: "upload" | "cloud";

  @state() private _supervisor?: boolean;

  @state() private _steps?: OnboardingStep[];

  @state() private _page = extractSearchParam("page");

  private _mobileApp =
    extractSearchParam("redirect_uri") === "homeassistant://auth-callback";

  connectedCallback() {
    super.connectedCallback();
    mainWindow.addEventListener("location-changed", this._updatePage);
    mainWindow.addEventListener("popstate", this._updatePage);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    mainWindow.removeEventListener("location-changed", this._updatePage);
    mainWindow.removeEventListener("popstate", this._updatePage);
  }

  private _updatePage = () => {
    this._page = extractSearchParam("page");
  };

  // ═══════════════════════════════════════════════════════
  // 【布局修改】添加左右分栏布局
  // 修改时间：2026-04-16
  // 修改内容：
  //   1. 添加左侧品牌宣传区（XOAI Home + 呼吸灯动画）
  //   2. 添加右侧操作区（原有内容）
  //   3. 保持所有原有功能不变
  // ═══════════════════════════════════════════════════════
  protected render() {
    return html`<mwc-linear-progress
        .progress=${this._progress}
      ></mwc-linear-progress>
      <div class="split-layout">
        <!-- 【新增】左侧：品牌宣传与动画区 -->
        <div class="promo-side">
          <div class="promo-content">
            <!-- 呼吸灯包裹品牌文字 -->
            <div class="tech-circle-wrapper">
              <div class="tech-circle"></div>
              <div class="circle-content">
                <h1>XOAI Home</h1>
                <p class="subtitle">智控未来 · 极简生活</p>
              </div>
            </div>

            <!-- 广告/功能介绍区域 -->
            <div class="ad-section">
              <div class="ad-title">智慧生活 从这里开始</div>
              <div class="ad-text">
                一站式智能家居控制中心，让您的生活更加便捷、舒适、安全。<br>
                支持多种设备接入，场景自由定制。
              </div>
              <div class="ad-tags">
                <span class="ad-tag">全屋智能</span>
                <span class="ad-tag">语音控制</span>
                <span class="ad-tag">场景联动</span>
                <span class="ad-tag">远程控制</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 【修改】右侧：操作区（原有内容移至此处） -->
        <div class="action-side">
          <ha-card>
            <div class="card-content">${this._renderStep()}</div>
          </ha-card>
          ${this._init && !this._restoring
            ? html`<onboarding-welcome-links
                .localize=${this.localize}
                .mobileApp=${this._mobileApp}
              ></onboarding-welcome-links>`
            : nothing}
          <div class="footer">
            <ha-language-picker
              .value=${this.language}
              .label=${""}
              native-name
              @value-changed=${this._languageChanged}
            ></ha-language-picker>
            <a
              href="https://www.home-assistant.io/getting-started/onboarding/"
              target="_blank"
              rel="noreferrer noopener"
              >${this.localize("ui.panel.page-onboarding.help")}</a
            >
          </div>
        </div>
      </div>`;
  }

  private _renderStep() {
    if (this._restoring) {
      return html`<onboarding-restore-backup
        .localize=${this.localize}
        .supervisor=${this._supervisor ?? false}
        .mode=${this._restoring}
      >
      </onboarding-restore-backup>`;
    }

    if (this._init) {
      return html`<onboarding-welcome
        .localize=${this.localize}
      ></onboarding-welcome>`;
    }

    const step = this._curStep()!;

    if (this._loading || !step) {
      return html`<onboarding-loading></onboarding-loading>`;
    }
    if (step.step === "user") {
      return html`<onboarding-create-user
        .localize=${this.localize}
        .language=${this.language}
      >
      </onboarding-create-user>`;
    }
    if (step.step === "core_config") {
      return html`
        <onboarding-core-config
          .hass=${this.hass}
          .onboardingLocalize=${this.localize}
        ></onboarding-core-config>
      `;
    }
    if (step.step === "analytics") {
      return html`
        <onboarding-analytics
          .hass=${this.hass}
          .localize=${this.localize}
        ></onboarding-analytics>
      `;
    }
    if (step.step === "integration") {
      return html`
        <onboarding-integrations
          .hass=${this.hass}
          .onboardingLocalize=${this.localize}
        ></onboarding-integrations>
      `;
    }
    return nothing;
  }

  protected firstUpdated(changedProps: PropertyValues) {
    super.firstUpdated(changedProps);
    this._fetchOnboardingSteps();
    import("./onboarding-integrations");
    import("./onboarding-core-config");
    import("./onboarding-restore-backup");
    registerServiceWorker(this, false);
    this.addEventListener("onboarding-step", (ev) => this._handleStepDone(ev));
    this.addEventListener("onboarding-progress", (ev) =>
      this._handleProgress(ev)
    );
    if (
      window.innerWidth > 450 &&
      !matchMedia("(prefers-reduced-motion)").matches
    ) {
      import("../resources/particles");
    }
    makeDialogManager(this);
    import("../components/ha-language-picker");
  }

  protected updated(changedProps: PropertyValues) {
    super.updated(changedProps);
    if (changedProps.has("_page")) {
      this._restoring =
        this._page === "restore_backup"
          ? "upload"
          : this._page === "restore_backup_cloud"
            ? "cloud"
            : undefined;
      if (this._page === null && this._steps && !this._steps[0].done) {
        this._init = true;
      }
    }
    if (changedProps.has("language")) {
      document.querySelector("html")!.setAttribute("lang", this.language);
    }
    if (changedProps.has("hass")) {
      const oldHass = changedProps.get("hass") as HomeAssistant | undefined;
      this.hassChanged(this.hass!, oldHass);
      if (oldHass?.themes !== this.hass!.themes) {
        if (matchMedia("(prefers-color-scheme: dark)").matches) {
          applyThemesOnElement(
            document.documentElement,
            {
              default_theme: "default",
              default_dark_theme: null,
              themes: {},
              darkMode: true,
              theme: "default",
            },
            undefined,
            undefined,
            true
          );
        }
      }
    }
  }

  private _curStep() {
    return this._steps ? this._steps.find((stp) => !stp.done) : undefined;
  }

  private async _fetchInstallationType(): Promise<void> {
    try {
      const response = await fetchInstallationType();
      this._supervisor = [
        "Home Assistant OS",
        "Home Assistant Supervised",
      ].includes(response.installation_type);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(
        "Something went wrong loading onboarding-restore-backup",
        err
      );
    }
  }

  private async _fetchOnboardingSteps() {
    try {
      const response = await (window.stepsPromise || fetchOnboardingOverview());

      if (response.status === 401 || response.status === 404) {
        // We don't load the component when onboarding is done
        document.location.assign("/");
        return;
      }

      const steps: OnboardingStep[] = await response.json();

      if (steps.every((step) => step.done)) {
        // Onboarding is done!
        document.location.assign("/");
        return;
      }

      if (steps[0].done) {
        // First step is already done, so we need to get auth somewhere else.
        const auth = await getAuth({
          hassUrl,
          limitHassInstance: true,
          saveTokens,
          loadTokens: () => Promise.resolve(loadTokens()),
        });
        history.replaceState(null, "", location.pathname);
        await this._connectHass(auth);
        const currentStep = steps.findIndex((stp) => !stp.done);
        const singelStepProgress = 1 / steps.length;
        this._progress = currentStep * singelStepProgress + singelStepProgress;
      } else {
        this._init = true;
        // Init screen needs to know the installation type.
        this._fetchInstallationType();
      }

      this._steps = steps;
    } catch (_err: any) {
      alert("Something went wrong loading onboarding, try refreshing");
    }
  }

  private _handleProgress(ev: HASSDomEvent<OnboardingProgressEvent>) {
    const stepSize = 1 / this._steps!.length;
    if (ev.detail.increase) {
      this._progress += ev.detail.increase * stepSize;
    }
    if (ev.detail.decrease) {
      this._progress -= ev.detail.decrease * stepSize;
    }
    if (ev.detail.progress) {
      this._progress = ev.detail.progress;
    }
  }

  private async _handleStepDone(ev: HASSDomEvent<OnboardingEvent>) {
    const stepResult = ev.detail;
    this._steps = this._steps!.map((step) =>
      step.step === stepResult.type ? { ...step, done: true } : step
    );

    if (stepResult.type === "init") {
      this._init = false;
      this._restoring = stepResult.result?.restore;
      if (!this._restoring) {
        this._progress = 0.25;
      } else {
        navigate(
          `${location.pathname}?${addSearchParam({ page: `restore_backup${this._restoring === "cloud" ? "_cloud" : ""}` })}`
        );
      }
    } else if (stepResult.type === "user") {
      const result = stepResult.result as OnboardingResponses["user"];
      this._loading = true;
      this._progress = 0.5;
      enableWrite();
      try {
        const auth = await getAuth({
          hassUrl,
          limitHassInstance: true,
          authCode: result.auth_code,
          saveTokens,
        });
        await this._connectHass(auth);
      } catch (_err: any) {
        alert("Ah snap, something went wrong!");
        location.reload();
      } finally {
        this._loading = false;
      }
    } else if (stepResult.type === "core_config") {
      this._progress = 0.75;
      // We do nothing
    } else if (stepResult.type === "analytics") {
      this._progress = 1;
      // We do nothing
    } else if (stepResult.type === "integration") {
      this._loading = true;

      // Determine if oauth redirect has been provided
      const externalAuthParams =
        extractSearchParamsObject() as AuthUrlSearchParams;
      const authParams =
        externalAuthParams.client_id && externalAuthParams.redirect_uri
          ? externalAuthParams
          : {
              client_id: genClientId(),
              redirect_uri: `${location.protocol}//${location.host}/?auth_callback=1`,
              state: btoa(
                JSON.stringify({
                  hassUrl: `${location.protocol}//${location.host}`,
                  clientId: genClientId(),
                })
              ),
            };

      await saveFrontendSystemData(this.hass!.connection, "core", {
        onboarded_version: this.hass!.config.version,
        onboarded_date: new Date().toISOString(),
      });

      let result: OnboardingResponses["integration"];

      try {
        result = await onboardIntegrationStep(this.hass!, {
          client_id: authParams.client_id!,
          redirect_uri: authParams.redirect_uri!,
        });
      } catch (err: any) {
        this.hass!.connection.close();
        await this.hass!.auth.revoke();

        alert(`Unable to finish onboarding: ${err.message}`);

        document.location.assign("/?");
        return;
      }

      // If we don't close the connection manually, the connection will be
      // closed when we navigate away from the page. Firefox allows JS to
      // continue to execute, and so HAWS will automatically reconnect once
      // the connection is closed. However, since we revoke our token below,
      // HAWS will reload the page, since that will trigger the auth flow.
      // In Firefox, triggering a reload will overrule the navigation that
      // was in progress.
      this.hass!.connection.close();

      // Revoke current auth token.
      await this.hass!.auth.revoke();

      // Build up the url to redirect to
      let redirectUrl = authParams.redirect_uri!;
      redirectUrl +=
        (redirectUrl.includes("?") ? "&" : "?") +
        `code=${encodeURIComponent(result.auth_code)}&storeToken=true`;

      if (authParams.state) {
        redirectUrl += `&state=${encodeURIComponent(authParams.state)}`;
      }

      document.location.assign(redirectUrl);
    }
  }

  private async _connectHass(auth: Auth) {
    const conn = await createConnection({ auth });
    // Make sure config and user info is loaded before we initialize.
    // It is needed for the core config step.
    await Promise.all([
      subscribeOne(conn, subscribeConfig),
      subscribeOne(conn, subscribeUser),
    ]);
    this.initializeHass(auth, conn);
    if (this.language !== this.hass!.language) {
      this._updateHass({
        locale: { ...this.hass!.locale, language: this.language },
        language: this.language,
        selectedLanguage: this.language,
      });
      storeState(this.hass!);
    }
    // Load config strings for integrations
    (this as any)._loadFragmentTranslations(this.hass!.language, "config");
    // Make sure hass is initialized + the config/user callbacks have called.
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }

  private _languageChanged(ev: CustomEvent) {
    const language = ev.detail.value;
    this.language = language;
    if (this.hass) {
      this._updateHass({
        locale: { ...this.hass!.locale, language },
        language,
        selectedLanguage: language,
      });
      storeState(this.hass!);
    } else {
      try {
        window.localStorage.setItem(
          "selectedLanguage",
          JSON.stringify(language)
        );
      } catch (_err: any) {
        // Ignore
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // 【样式修改】完全对齐登录界面样式
  // 修改时间：2026-04-16
  // 参考文件：src/auth/ha-authorize.ts
  // ═══════════════════════════════════════════════════════
  static styles = css`
    /* 深色渐变背景 */
    :host {
      display: block;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      background: linear-gradient(135deg, #0a0f1c 0%, #111827 25%, #1a2236 50%, #111827 75%, #0a0f1c 100%);
    }

    /* 深色主题表单 CSS 变量 —— 完全透明 */
    ha-onboarding {
      --ha-color-form-background: transparent;
      --ha-color-form-background-hover: transparent;
      --ha-color-form-background-disabled: transparent;
      --ha-color-border-neutral-quiet: rgba(96, 165, 250, 0.3);
      --ha-color-border-neutral-loud: rgba(96, 165, 250, 0.4);
      --ha-color-text-secondary: #94a3b8;
      --ha-color-neutral-60: #64748b;
      --secondary-text-color: #94a3b8;
      --card-background-color: transparent;
      --ha-color-fill-danger-loud-resting: #ef4444;
      --ha-color-on-danger-quiet: #f87171;
      --primary-color: #60a5fa;
      width: 100vw;
      min-width: 100vw;
    }

    /* 左右分栏布局 */
    .split-layout {
      display: flex;
      height: 100%;
      width: 100%;
      position: relative;
    }

    /* 网格背景纹理 */
    .split-layout::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image:
        linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
      background-size: 50px 50px;
      pointer-events: none;
      z-index: 0;
    }

    /* 左侧宣传区 */
    .promo-side {
      flex: 0 0 50%;
      width: 50%;
      min-width: 50%;
      background: transparent;
      color: white;
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
      overflow: hidden;
      padding: 40px;
      z-index: 1;
    }

    .promo-content {
      z-index: 2;
      text-align: center;
      max-width: 500px;
      width: 100%;
      position: relative;
    }

    /* 呼吸灯容器 */
    .tech-circle-wrapper {
      position: relative;
      width: 280px;
      height: 280px;
      margin: 0 auto 3rem auto;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    /* 外圈呼吸灯 */
    .tech-circle {
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: 2px solid rgba(96, 165, 250, 0.3);
      animation: pulse 4s ease-in-out infinite;
      box-sizing: border-box;
    }

    /* 内圈呼吸灯 */
    .tech-circle::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 75%;
      height: 75%;
      border: 1px solid rgba(167, 139, 250, 0.25);
      border-radius: 50%;
      animation: pulse 4s ease-in-out infinite 1s;
    }

    /* 第三圈呼吸灯 */
    .tech-circle::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 50%;
      height: 50%;
      border: 1px solid rgba(96, 165, 250, 0.15);
      border-radius: 50%;
      animation: pulse 4s ease-in-out infinite 2s;
    }

    /* 呼吸灯动画关键帧 */
    @keyframes pulse {
      0%, 100% {
        transform: scale(0.95);
        opacity: 0.6;
        box-shadow: 0 0 20px rgba(96, 165, 250, 0.2);
      }
      50% {
        transform: scale(1.02);
        opacity: 1;
        box-shadow: 0 0 60px rgba(96, 165, 250, 0.4), 0 0 100px rgba(167, 139, 250, 0.2);
      }
    }

    /* 中心品牌文字 */
    .circle-content {
      position: relative;
      z-index: 10;
      text-align: center;
    }

    .circle-content h1 {
      font-size: 2.8rem;
      font-weight: 800;
      margin: 0 0 0.5rem 0;
      letter-spacing: 3px;
      background: linear-gradient(135deg, #60a5fa, #a78bfa, #60a5fa);
      background-size: 200% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: gradient 3s ease infinite;
      text-shadow: none;
    }

    @keyframes gradient {
      0% { background-position: 0% center; }
      50% { background-position: 100% center; }
      100% { background-position: 0% center; }
    }

    .circle-content .subtitle {
      font-size: 1.2rem;
      color: #94a3b8;
      font-weight: 300;
      letter-spacing: 2px;
      margin: 0;
    }

    /* 广告/介绍区域 */
    .ad-section {
      margin-top: 0;
      padding-top: 2rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .ad-section .ad-title {
      font-size: 1.1rem;
      color: #60a5fa;
      margin-bottom: 1.2rem;
      font-weight: 500;
      letter-spacing: 0.5px;
    }

    .ad-section .ad-text {
      font-size: 0.9rem;
      color: #64748b;
      line-height: 1.7;
      margin-bottom: 1.5rem;
    }

    .ad-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
    }

    .ad-tag {
      padding: 6px 14px;
      background: rgba(96, 165, 250, 0.1);
      border: 1px solid rgba(96, 165, 250, 0.2);
      border-radius: 20px;
      font-size: 0.8rem;
      color: #93c5fd;
      transition: all 0.3s ease;
    }

    .ad-tag:hover {
      background: rgba(96, 165, 250, 0.2);
      border-color: rgba(96, 165, 250, 0.4);
    }

    /* 右侧操作区 */
    .action-side {
      flex: 0 0 50%;
      width: 50%;
      min-width: 50%;
      background: transparent;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 24px 40px;
      position: relative;
      z-index: 1;
    }

    /* 卡片样式 —— 完全透明，无白色痕迹 */
    .card-content {
      background: transparent;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(96, 165, 250, 0.3);
      border-radius: 24px;
      padding: 48px 40px 40px 40px;
      width: 100%;
      max-width: 440px;
      position: relative;
      overflow: hidden;
    }

    /* 卡片顶部光条 */
    .card-content::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, rgba(96, 165, 250, 0.6), transparent);
    }

    mwc-linear-progress {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      z-index: 10;
    }

    .footer {
      margin-top: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      max-width: 440px;
      font-size: 0.9rem;
    }

    /* 底部链接和按钮颜色 */
    .footer ha-button {
      --ha-color-button-text: #60a5fa;
      color: #60a5fa;
    }

    .footer ha-language-picker {
      --ha-color-button-text: #60a5fa;
      color: #60a5fa;
      display: block;
      width: 200px;
      border-radius: var(--ha-border-radius-sm);
      overflow: hidden;
      --ha-select-height: 40px;
      --mdc-select-fill-color: none;
      --mdc-select-label-ink-color: #94a3b8;
      --mdc-select-ink-color: #94a3b8;
      --mdc-select-idle-line-color: transparent;
      --mdc-select-hover-line-color: transparent;
      --mdc-select-dropdown-icon-color: #60a5fa;
      --mdc-shape-small: 0;
    }

    a {
      text-decoration: none;
      color: #60a5fa;
      margin-right: 16px;
      margin-inline-end: 16px;
      margin-inline-start: initial;
    }

    /* 响应式 */
    @media (max-width: 768px) {
      .promo-side {
        display: none;
      }
      .action-side {
        flex: 0 0 100%;
        width: 100%;
        min-width: 100%;
      }
      .card-content {
        padding: 32px 24px 24px 24px;
        max-width: 100%;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-onboarding": HaOnboarding;
  }
}
