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
        ha-authorize {
          display: flex;
          flex-direction: row;
          height: 100%;
          width: 100%;
          overflow: hidden;
        }

        .promo-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 40px;
          background: linear-gradient(135deg, #0096c7 0%, #f0a500 100%);
          color: white;
          text-align: center;
        }

        .promo-title {
          font-size: 3rem;
          font-weight: bold;
          margin-bottom: 20px;
        }

        .promo-text {
          font-size: 1.2rem;
          opacity: 0.9;
        }

        .promo-image {
          max-width: 300px;
          margin-bottom: 2rem;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        }

        .login-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 20px;
          background-color: var(--primary-background-color, #fafafa);
        }

        .card-content {
    background: rgba(10, 22, 40, 0.85);
    backdrop-filter: blur(20px);
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(0, 123, 255, 0.3),
      inset 0 0 20px rgba(0, 123, 255, 0.1);
    border-radius: 12px;
    border: 1px solid rgba(0, 123, 255, 0.4);
    padding: 40px;
    width: 100%;
    max-width: 420px;
    position: relative;
    z-index: 1;
  }

/* 登录标题样式 */
.card-content h1,
.card-content h2,
.card-content h3 {
  color: #00d4ff !important;
  text-align: center;
  margin-bottom: 30px;
  font-size: 28px;
  font-weight: 600;
  text-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
  letter-spacing: 2px;
}

/* 输入框容器样式 */
.card-content ha-textfield,
.card-content .mdc-text-field {
  --mdc-text-field-fill-color: rgba(0, 123, 255, 0.1);
  --mdc-text-field-ink-color: #ffffff;
  --mdc-text-field-label-ink-color: rgba(255, 255, 255, 0.7);
  --mdc-text-field-idle-line-color: rgba(0, 123, 255, 0.5);
  --mdc-text-field-hover-line-color: #00d4ff;
  --mdc-text-field-focus-line-color: #00d4ff;
  margin-bottom: 20px;
  border-radius: 8px;
  overflow: hidden;
}

/* 输入框聚焦效果 */
.card-content ha-textfield:focus-within,
.card-content .mdc-text-field--focused {
  box-shadow: 0 0 15px rgba(0, 212, 255, 0.3);
}

/* 登录按钮样式 */
.card-content ha-button,
.card-content mwc-button,
.card-content button[type="submit"] {
  --mdc-theme-primary: #007bff;
  --mdc-button-fill-color: linear-gradient(135deg, #007bff 0%, #00d4ff 100%);
  --mdc-button-ink-color: #ffffff;
  --mdc-button-border-radius: 8px;
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  box-shadow: 0 4px 15px rgba(0, 123, 255, 0.4);
  transition: all 0.3s ease;
  margin-top: 10px;
}

.card-content ha-button:hover,
.card-content mwc-button:hover,
.card-content button[type="submit"]:hover {
  box-shadow: 0 6px 20px rgba(0, 212, 255, 0.6);
  transform: translateY(-2px);
}

/* 复选框和链接样式 */
.card-content ha-checkbox,
.card-content .mdc-checkbox {
  --mdc-checkbox-unchecked-color: rgba(255, 255, 255, 0.7);
  --mdc-checkbox-checked-color: #00d4ff;
}

.card-content a {
  color: #00d4ff !important;
  text-decoration: none;
  transition: all 0.3s ease;
}

.card-content a:hover {
  color: #007bff !important;
  text-shadow: 0 0 8px rgba(0, 212, 255, 0.5);
}

/* 错误提示文字样式 */
.card-content .error-message,
.card-content ha-alert {
  color: #ff6b6b !important;
  background: rgba(255, 107, 107, 0.1);
  border-left: 3px solid #ff6b6b;
  padding: 10px 15px;
  border-radius: 4px;
  margin-bottom: 15px;
}

/* 语言选择器样式 */
.language-picker {
  position: fixed;
  bottom: 20px;
  left: 20px;
  z-index: 10;
}

.language-picker ha-select {
  --mdc-select-fill-color: rgba(0, 123, 255, 0.1);
  --mdc-select-ink-color: #ffffff;
  --mdc-select-label-ink-color: rgba(255, 255, 255, 0.7);
  --mdc-select-dropdown-icon-color: #00d4ff;
}
  
  .card-content::before {
    content: '';
    position: absolute;
    top: -1px;
    left: -1px;
    right: -1px;
    bottom: -1px;
    background: linear-gradient(45deg, transparent, rgba(0, 123, 255, 0.3), transparent);
    border-radius: 12px;
    z-index: -1;
    opacity: 0.5;
  }

        ha-alert {
          margin-bottom: 16px;
        }

        .footer {
          width: 100%;
          max-width: 400px;
          margin-top: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        @media (max-width: 768px) {
          ha-authorize {
            flex-direction: column;
          }
          .promo-section {
            min-height: 200px;
            padding: 20px;
          }
          .promo-title {
            font-size: 2rem;
          }
        }
      </style>

      <!-- 左侧：宣传标语 -->
      <div class="promo-section">
        <img src="/static/images/yuanzhou.png" alt="智能家居宣传图" class="promo-image">
        <div class="promo-title">欢迎回家</div>
        <div class="promo-text">智能 · 便捷 · 安全<br>掌控你的每一个生活细节</div>
      </div>

      <!-- 右侧：登录界面 -->
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
