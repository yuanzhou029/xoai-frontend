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
        <div style="display: flex; justify-content: center; align-items: center; height: 100vh;">
          <ha-alert alertType="error">${this._error}</ha-alert>
        </div>
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
          width: 100%;
          height: 100vh;
          overflow: hidden;
        }

        .login-container {
          display: flex;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #0a1628 100%);
          position: relative;
          overflow: hidden;
        }

        /* 背景动画效果 */
        .login-container::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(0, 150, 255, 0.1) 0%, transparent 70%);
          animation: pulse 15s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.2); opacity: 0.5; }
        }

        /* 左侧宣传区域 */
        .promo-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 40px;
          position: relative;
          z-index: 1;
        }

        .promo-title {
          font-size: 2.5rem;
          font-weight: bold;
          color: #ffffff;
          margin-bottom: 30px;
          text-shadow: 0 0 20px rgba(0, 150, 255, 0.5);
          letter-spacing: 2px;
        }

        .city-illustration {
          width: 100%;
          max-width: 500px;
          height: auto;
          position: relative;
        }

        .tech-icons {
          display: flex;
          gap: 20px;
          margin-top: 30px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .tech-icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(0, 150, 255, 0.3), rgba(0, 200, 255, 0.2));
          border: 2px solid rgba(0, 150, 255, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 20px rgba(0, 150, 255, 0.3);
          transition: all 0.3s ease;
        }

        .tech-icon:hover {
          transform: translateY(-5px);
          box-shadow: 0 0 30px rgba(0, 150, 255, 0.5);
        }

        .tech-icon svg {
          width: 30px;
          height: 30px;
          fill: #00d4ff;
        }

        /* 右侧登录区域 */
        .login-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 40px;
          position: relative;
          z-index: 1;
        }

        .login-card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 40px;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          position: relative;
          overflow: hidden;
        }

        .login-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, transparent, #00d4ff, transparent);
        }

        .login-title {
          font-size: 1.8rem;
          font-weight: bold;
          color: #00d4ff;
          text-align: center;
          margin-bottom: 30px;
          text-shadow: 0 0 10px rgba(0, 212, 255, 0.3);
        }

        .subtitle {
          text-align: center;
          color: rgba(255, 255, 255, 0.7);
          font-size: 14px;
          margin-bottom: 20px;
          animation: fadeInUp 0.6s ease-out 0.2s both;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        ha-alert {
          margin-bottom: 20px;
          --ha-alert-background-color: rgba(0, 150, 255, 0.1);
          --ha-alert-border-color: rgba(0, 150, 255, 0.3);
        }

        .card-content {
          margin-bottom: 20px;
        }

        .footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid rgba(0, 150, 255, 0.2);
        }

        ha-language-picker {
          --mdc-text-field-fill-color: transparent;
          --mdc-text-field-ink-color: #00d4ff;
        }

        ha-button {
          --mdc-button-outline-color: rgba(0, 150, 255, 0.5);
          --mdc-button-label-text-color: #00d4ff;
        }

        /* 响应式设计 */
        @media (max-width: 1024px) {
          .login-container {
            flex-direction: column;
          }

          .promo-section {
            min-height: 300px;
            padding: 20px;
          }

          .promo-title {
            font-size: 2rem;
          }

          .city-illustration {
            max-width: 300px;
          }

          .tech-icon {
            width: 50px;
            height: 50px;
          }

          .tech-icon svg {
            width: 25px;
            height: 25px;
          }
        }

        @media (max-width: 768px) {
          .promo-section {
            min-height: 200px;
          }

          .promo-title {
            font-size: 1.5rem;
          }

          .login-card {
            padding: 30px 20px;
          }

          .login-title {
            font-size: 1.5rem;
          }

          .tech-icons {
            gap: 15px;
          }

          .tech-icon {
            width: 45px;
            height: 45px;
          }
        }
      
/* ========================================
   修复1: 确保全屏显示
   ======================================== */
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

:host {
  display: block;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.login-container {
  display: flex;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #0a1628 100%);
  position: relative;
  overflow: hidden;
}

/* ========================================
   修复2: 输入框深色主题样式
   ======================================== */
ha-auth-form,
ha-textfield,
paper-input,
vaadin-text-field,
mwc-textfield,
input[type="text"],
input[type="password"],
input[type="email"] {
  --mdc-text-field-fill-color: rgba(0, 20, 40, 0.6) !important;
  --mdc-text-field-ink-color: #00d4ff !important;
  --mdc-text-field-label-ink-color: rgba(0, 212, 255, 0.7) !important;
  --mdc-text-field-idle-line-color: rgba(0, 150, 255, 0.3) !important;
  --mdc-text-field-hover-line-color: rgba(0, 212, 255, 0.6) !important;
  --mdc-text-field-focus-line-color: #00d4ff !important;
  --mdc-theme-primary: #00d4ff !important;
  
  background: rgba(0, 20, 40, 0.6) !important;
  color: #00d4ff !important;
  border: 1px solid rgba(0, 150, 255, 0.3) !important;
  border-radius: 8px !important;
}

ha-auth-form:focus-within,
ha-textfield:focus-within,
input[type="text"]:focus,
input[type="password"]:focus,
input[type="email"]:focus {
  border-color: #00d4ff !important;
  box-shadow: 0 0 15px rgba(0, 212, 255, 0.3) !important;
}

::placeholder {
  color: rgba(0, 212, 255, 0.5) !important;
}

/* ========================================
   修复3: h1 标题样式（欢迎回家）
   ======================================== */
ha-auth-flow h1 {
  color: #00d4ff !important;
  font-size: 2rem !important;
  font-weight: bold !important;
  text-align: center !important;
  margin-bottom: 24px !important;
  text-shadow: 0 0 15px rgba(0, 212, 255, 0.4) !important;
  letter-spacing: 1px !important;
}

@media (max-width: 768px) {
  ha-auth-flow h1 {
    font-size: 1.5rem !important;
  }
}

/* ========================================
   其他增强样式
   ======================================== */
.login-card,
.login-card * {
  color: #e0f7ff !important;
}

.login-card a {
  color: #00d4ff !important;
}

.login-card ha-button,
.login-card button {
  background: linear-gradient(135deg, #0066cc, #00d4ff) !important;
  color: #ffffff !important;
  border: none !important;
  border-radius: 8px !important;
  padding: 12px 24px !important;
  font-weight: bold !important;
  transition: all 0.3s ease !important;
}

.login-card ha-button:hover,
.login-card button:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 5px 20px rgba(0, 212, 255, 0.4) !important;
}

</style>

      <div class="login-container">
        <!-- 左侧：科技宣传区域 -->
        <div class="promo-section">
          <div class="promo-title">小鸥智能控制台</div>
          
          <!-- 城市插图 SVG -->
          <svg class="city-illustration" viewBox="0 0 500 400" xmlns="http://www.w3.org/2000/svg">
            <!-- 背景网格 -->
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(0, 150, 255, 0.1)" stroke-width="1"/>
              </pattern>
              <linearGradient id="buildingGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#00d4ff;stop-opacity:0.8" />
                <stop offset="100%" style="stop-color:#0066cc;stop-opacity:0.3" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            <!-- 背景网格 -->
            <rect width="500" height="400" fill="url(#grid)"/>
            
            <!-- 建筑物 -->
            <g filter="url(#glow)">
              <!-- 建筑1 -->
              <rect x="50" y="200" width="60" height="150" fill="url(#buildingGrad)" rx="3"/>
              <rect x="60" y="220" width="10" height="10" fill="#00d4ff" opacity="0.6"/>
              <rect x="80" y="220" width="10" height="10" fill="#00d4ff" opacity="0.6"/>
              <rect x="60" y="240" width="10" height="10" fill="#00d4ff" opacity="0.6"/>
              <rect x="80" y="240" width="10" height="10" fill="#00d4ff" opacity="0.6"/>
              
              <!-- 建筑2 -->
              <rect x="130" y="180" width="70" height="170" fill="url(#buildingGrad)" rx="3"/>
              <rect x="140" y="200" width="10" height="10" fill="#00d4ff" opacity="0.6"/>
              <rect x="160" y="200" width="10" height="10" fill="#00d4ff" opacity="0.6"/>
              <rect x="180" y="200" width="10" height="10" fill="#00d4ff" opacity="0.6"/>
              
              <!-- 建筑3 -->
              <rect x="220" y="150" width="80" height="200" fill="url(#buildingGrad)" rx="3"/>
              <rect x="230" y="170" width="10" height="10" fill="#00d4ff" opacity="0.6"/>
              <rect x="250" y="170" width="10" height="10" fill="#00d4ff" opacity="0.6"/>
              <rect x="270" y="170" width="10" height="10" fill="#00d4ff" opacity="0.6"/>
              
              <!-- 建筑4 -->
              <rect x="320" y="190" width="65" height="160" fill="url(#buildingGrad)" rx="3"/>
              <rect x="330" y="210" width="10" height="10" fill="#00d4ff" opacity="0.6"/>
              <rect x="350" y="210" width="10" height="10" fill="#00d4ff" opacity="0.6"/>
              
              <!-- 建筑5 -->
              <rect x="400" y="210" width="55" height="140" fill="url(#buildingGrad)" rx="3"/>
              <rect x="410" y="230" width="10" height="10" fill="#00d4ff" opacity="0.6"/>
              <rect x="430" y="230" width="10" height="10" fill="#00d4ff" opacity="0.6"/>
            </g>
            
            <!-- 连接线 -->
            <path d="M 80 200 Q 250 100 420 210" stroke="#00d4ff" stroke-width="2" fill="none" opacity="0.4"/>
            <path d="M 165 180 Q 300 80 420 210" stroke="#00d4ff" stroke-width="2" fill="none" opacity="0.4"/>
            
            <!-- 数据流动画点 -->
            <circle cx="80" cy="200" r="4" fill="#00d4ff" opacity="0.8">
              <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite"/>
            </circle>
            <circle cx="250" cy="150" r="4" fill="#00d4ff" opacity="0.8">
              <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite"/>
            </circle>
            <circle cx="420" cy="210" r="4" fill="#00d4ff" opacity="0.8">
              <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite"/>
            </circle>
          </svg>
          
          <!-- 科技图标 -->
          <div class="tech-icons">
            <div class="tech-icon" title="智能家居">
              <svg viewBox="0 0 24 24">
                <path d="M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2zm0 2.8L19.2 12H17v8h-4v-6h-2v6H7v-8H4.8L12 4.8z"/>
              </svg>
            </div>
            <div class="tech-icon" title="安全监控">
              <svg viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
              </svg>
            </div>
            <div class="tech-icon" title="数据分析">
              <svg viewBox="0 0 24 24">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
              </svg>
            </div>
            <div class="tech-icon" title="云计算">
              <svg viewBox="0 0 24 24">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
              </svg>
            </div>
            <div class="tech-icon" title="物联网">
              <svg viewBox="0 0 24 24">
                <path d="M12 6c3.79 0 7.17 2.13 8.82 5.5-.59 1.22-1.42 2.27-2.41 3.12l1.41 1.41c1.39-1.23 2.49-2.77 3.18-4.53C21.27 7.11 17 4 12 4c-1.27 0-2.49.2-3.64.57l1.65 1.65C10.66 6.09 11.32 6 12 6zm-1.07 1.14L13 9.21c.57.25 1.03.71 1.28 1.28l2.07 2.07c.08-.34.14-.7.14-1.07C16.5 9.01 14.48 7 12 7c-.37 0-.72.05-1.07.14zM2.01 3.87l2.68 2.68C3.06 7.83 1.77 9.53 1 11.5 2.73 15.89 7 19 12 19c1.52 0 2.98-.29 4.32-.82l3.42 3.42 1.41-1.41L2.01 3.87z"/>
              </svg>
            </div>
          </div>
        </div>

        <!-- 右侧：登录表单区域 -->
        <div class="login-section">
          ${!this._ownInstance
            ? html`<ha-alert .alertType=${app ? "info" : "warning"}>
                ${app
                  ? this.localize("ui.panel.page-authorize.authorizing_app", {
                      app: appNames[this.clientId!],
                    })
                  : this.localize("ui.panel.page-authorize.authorizing_client", {
                      clientId: html`<b>${this.clientId ? punycode.toASCII(this.clientId) : this.clientId}</b>`,
                    })}
              </ha-alert>`
            : nothing}

          <h2 class="subtitle">欢迎回家！</h2>
          <div class="login-card">
            <div class="login-title">用户登录</div>
            
            <div class="card-content">
              ${!this._authProvider
                ? html`<p>${this.localize("ui.panel.page-authorize.initializing")}</p>`
                : html`<ha-auth-flow
                      .clientId=${this.clientId}
                      .redirectUri=${this.redirectUri}
                      .oauth2State=${this.oauth2State}
                      .authProvider=${this._authProvider}
                      .localize=${this.localize}
                      .initStoreToken=${this._preselectStoreToken}
                    ></ha-auth-flow>
                    ${inactiveProviders!.length > 0
                      ? html`<ha-pick-auth-provider
                          .localize=${this.localize}
                          .clientId=${this.clientId}
                          .authProviders=${inactiveProviders!}
                          @pick-auth-provider=${this._handleAuthProviderPick}
                        ></ha-pick-auth-provider>`
                      : ""}`}
            </div>
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

    if (
      window.innerWidth > 450 &&
      !matchMedia("(prefers-reduced-motion)").matches
    ) {
      import("../resources/particles");
    }

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
