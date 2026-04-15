/* eslint-disable lit/prefer-static-styles */
import { mdiOpenInNew } from "@mdi/js";
import type { PropertyValues } from "lit";
import { html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators";
import punycode from "punycode";
import { applyThemesOnElement } from "../common/dom/apply_themes_on_element";
import { extractSearchParamsObject } from "../common/url/search-params";
import "../components/ha-alert";
import "../components/ha-button";
import "../components/ha-svg-icon";
import type { AuthProvider, AuthUrlSearchParams } from "../data/auth";
import { fetchAuthProviders } from "../data/auth";
import { litLocalizeLiteMixin } from "../mixins/lit-localize-lite-mixin";
import { registerServiceWorker } from "../util/register-service-worker";
import "./ha-auth-flow";

import("./ha-pick-auth-provider");

const appNames = {
  "https://home-assistant.io/iOS": "iOS",
  "https://home-assistant.io/android": "Android",
};

@customElement("ha-authorize")
export class HaAuthorize extends litLocalizeLiteMixin(LitElement) {
  @property({ attribute: false }) public clientId?: string;

  @property({ attribute: false }) public redirectUri?: string;

  @property({ attribute: false }) public oauth2State?: string;

  @property({ attribute: false }) public translationFragment = "page-authorize";

  @state() private _authProvider?: AuthProvider;

  @state() private _authProviders?: AuthProvider[];

  @state() private _preselectStoreToken = false;

  @state() private _ownInstance = false;

  @state() private _error?: string;

  constructor() {
    super();
    const query = extractSearchParamsObject() as AuthUrlSearchParams;
    if (query.client_id) {
      this.clientId = query.client_id;
    }
    if (query.redirect_uri) {
      this.redirectUri = query.redirect_uri;
    }
    if (query.state) {
      this.oauth2State = query.state;
    }
  }

  protected render() {
    if (this._error) {
      return html`
        <style>
          ha-authorize ha-alert {
            display: block;
            margin: 16px 0;
            background-color: var(--primary-background-color, #fafafa);
          }
        </style>
        <ha-alert alert-type="error"
          >${this._error} ${this.redirectUri}</ha-alert
        >
      `;
    }

    const inactiveProviders = this._authProviders?.filter(
      (prv) => prv !== this._authProvider
    );

    const app = this.clientId && this.clientId in appNames;

    return html`
      <style>
        :host {
          display: block;
          height: 100vh;
          overflow: hidden;
        }
        .split-layout {
          display: flex;
          height: 100%;
          width: 100%;
          background: linear-gradient(135deg, #0a0f1c 0%, #111827 25%, #1a2236 50%, #111827 75%, #0a0f1c 100%);
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
        }
        /* --- 左侧宣传区 --- */
        .promo-side {
          flex: 1;
          background: transparent;
          color: white;
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          overflow: hidden;
          padding: 40px;
        }
        .promo-content {
          z-index: 2;
          text-align: center;
          max-width: 500px;
        }
        .promo-content h1 {
          font-size: 3.5rem;
          font-weight: 800;
          margin-bottom: 1rem;
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
        .promo-content .subtitle {
          font-size: 1.4rem;
          opacity: 0.9;
          margin-bottom: 3rem;
          color: #94a3b8;
          font-weight: 300;
          letter-spacing: 1px;
        }
        .tech-circle {
          width: 180px;
          height: 180px;
          border: 2px solid rgba(96, 165, 250, 0.3);
          border-radius: 50%;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: pulse 4s infinite;
        }
        .tech-circle::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 120px;
          height: 120px;
          border: 1px solid rgba(167, 139, 250, 0.2);
          border-radius: 50%;
          animation: pulse 4s infinite 1s;
        }
        @keyframes pulse {
          0% { transform: translate(-50%, -50%) scale(0.95); box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.4); }
          70% { transform: translate(-50%, -50%) scale(1); box-shadow: 0 0 0 30px rgba(96, 165, 250, 0); }
          100% { transform: translate(-50%, -50%) scale(0.95); box-shadow: 0 0 0 0 rgba(96, 165, 250, 0); }
        }
        /* --- 广告区域 --- */
        .ad-section {
          margin-top: 3rem;
          padding-top: 2rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        .ad-section .ad-title {
          font-size: 1.1rem;
          color: #60a5fa;
          margin-bottom: 1rem;
          font-weight: 500;
          letter-spacing: 0.5px;
        }
        .ad-section .ad-text {
          font-size: 0.95rem;
          color: #64748b;
          line-height: 1.6;
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
        /* --- 右侧登录区 --- */
        .login-side {
          flex: 1;
          background: transparent;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 24px;
          position: relative;
        }
        .card-content {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 48px 40px 40px 40px;
          width: 100%;
          max-width: 420px;
          box-shadow: 
            0 4px 6px -1px rgba(0, 0, 0, 0.1),
            0 2px 4px -1px rgba(0, 0, 0, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          position: relative;
          overflow: hidden;
        }
        /* 顶部渐变光条装饰 */
        .card-content::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(96, 165, 250, 0.6), transparent);
        }
        ha-auth-flow {
          display: flex;
          justify-content: center;
          flex-direction: column;
          align-items: center;
          width: 100%;
        }
        ha-pick-auth-provider {
          display: block;
          margin-top: 24px;
          width: 100%;
        }
        ha-alert {
          display: block;
          margin: 16px 0;
          background-color: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #e2e8f0;
        }
        p {
          font-size: var(--ha-font-size-m);
          line-height: var(--ha-line-height-normal);
        }
        .footer {
          margin-top: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          max-width: 420px;
          font-size: 0.9rem;
        }
        .footer ha-svg-icon {
          --mdc-icon-size: var(--ha-space-5);
        }
        h1 {
          font-size: var(--ha-font-size-3xl);
          font-weight: var(--ha-font-weight-normal);
          margin-top: 16px;
          margin-bottom: 16px;
          text-align: center;
        }
        @media (max-width: 768px) {
          .promo-side {
            display: none;
          }
          .login-side {
            flex: 1;
          }
          .card-content {
            padding: 32px 24px 24px 24px;
            max-width: 100%;
          }
        }
      </style>

      <div class="split-layout">
        <!-- 左侧：宣传与动画区 -->
        <div class="promo-side">
          <div class="promo-content">
            <h1>XOAI Home</h1>
            <p class="subtitle">智控未来 · 极简生活</p>
            <div class="tech-circle"></div>
            
            <!-- 广告区域 -->
            <div class="ad-section">
              <div class="ad-title">智慧生活 从这里开始</div>
              <div class="ad-text">
                一站式智能家居控制中心，让您的生活更加便捷、舒适、安全。<br>
                支持多种设备接入，场景自由定制。              </div>
              <div class="ad-tags">
                <span class="ad-tag">全屋智能</span>
                <span class="ad-tag">语音控制</span>
                <span class="ad-tag">场景联动</span>
                <span class="ad-tag">远程控制</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧：登录操作区 -->
        <div class="login-side">
          ${!this._ownInstance
            ? html`<ha-alert .alertType=${app ? "info" : "warning"} style="width: 100%; max-width: 420px;">
                ${app
                  ? this.localize("ui.panel.page-authorize.authorizing_app", {
                      app: appNames[this.clientId!],
                    })
                  : this.localize("ui.panel.page-authorize.authorizing_client", {
                      clientId: html`<b
                        >${this.clientId
                          ? punycode.toASCII(this.clientId)
                          : this.clientId}</b
                      >`,
                    })}
              </ha-alert>`
            : nothing}

          <div class="card-content">
            ${!this._authProvider
              ? html`<p>
                  ${this.localize("ui.panel.page-authorize.initializing")}
                </p> `
              : html`<ha-auth-flow
                    .clientId=${this.clientId}
                    .redirectUri=${this.redirectUri}
                    .oauth2State=${this.oauth2State}
                    .authProvider=${this._authProvider}
                    .localize=${this.localize}
                    .initStoreToken=${this._preselectStoreToken}
                  ></ha-auth-flow>
                  ${inactiveProviders!.length > 0
                    ? html`
                        <ha-pick-auth-provider
                          .localize=${this.localize}
                          .clientId=${this.clientId}
                          .authProviders=${inactiveProviders!}
                          @pick-auth-provider=${this._handleAuthProviderPick}
                        ></ha-pick-auth-provider>
                      `
                    : ""}`}
          </div>
          <div class="footer">
            <ha-language-picker
              .value=${this.language}
              .label=${""}
              button-style
              native-name
              @value-changed=${this._languageChanged}
            ></ha-language-picker>
            <ha-button
              appearance="plain"
              variant="neutral"
              href="https://www.home-assistant.io/docs/authentication/"
              target="_blank"
              rel="noreferrer noopener"
            >
              ${this.localize("ui.panel.page-authorize.help")}
              <ha-svg-icon slot="end" .path=${mdiOpenInNew}></ha-svg-icon>
            </ha-button>
          </div>
        </div>
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }

  protected firstUpdated(changedProps: PropertyValues) {
    super.firstUpdated(changedProps);

    if (!this.redirectUri) {
      this._error = "Invalid redirect URI";
      return;
    }

    let url: URL;

    try {
      url = new URL(this.redirectUri);
    } catch (_err) {
      this._error = "Invalid redirect URI";
      return;
    }

    if (
      // eslint-disable-next-line no-script-url
      ["javascript:", "data:", "vbscript:", "file:", "about:"].includes(
        url.protocol
      )
    ) {
      this._error = "Invalid redirect URI";
      return;
    }

    this._fetchAuthProviders();

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

    // 移除粒子效果加载
    // if (
    //   window.innerWidth > 450 &&
    //   !matchMedia("(prefers-reduced-motion)").matches
    // ) {
    //   import("../resources/particles");
    // }

    // If we are logging into the instance that is hosting this auth form
    // we will register the service worker to start preloading.
    if (url.host === location.host) {
      this._ownInstance = true;
      registerServiceWorker(this, false);
    }

    import("../components/ha-language-picker");
  }

  protected updated(changedProps: PropertyValues) {
    super.updated(changedProps);
    if (changedProps.has("language")) {
      document.querySelector("html")!.setAttribute("lang", this.language!);
    }
  }

  private async _fetchAuthProviders() {
    // Fetch auth providers
    try {
      // We prefetch this data on page load in authorize.html.template for modern builds
      const response = await ((window as any).providersPromise ||
        fetchAuthProviders());
      const authProviders = await response.json();

      // Forward to main screen which will redirect to right onboarding page.
      if (
        response.status === 400 &&
        authProviders.code === "onboarding_required"
      ) {
        location.href = `/onboarding.html${location.search}`;
        return;
      }

      if (authProviders.providers.length === 0) {
        this._error = "No auth providers returned. Unable to finish login.";
        return;
      }

      this._authProviders = authProviders.providers;
      this._authProvider = authProviders.providers[0];
      this._preselectStoreToken = authProviders.preselect_remember_me;
    } catch (err: any) {
      this._error = "Unable to fetch auth providers.";
      // eslint-disable-next-line
      console.error("Error loading auth providers", err);
    }
  }

  private async _handleAuthProviderPick(ev) {
    this._authProvider = ev.detail;
  }

  private _languageChanged(ev: CustomEvent) {
    const language = ev.detail.value;
    this.language = language;

    try {
      window.localStorage.setItem("selectedLanguage", JSON.stringify(language));
    } catch (_err: any) {
      // Ignore
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-authorize": HaAuthorize;
  }
}
